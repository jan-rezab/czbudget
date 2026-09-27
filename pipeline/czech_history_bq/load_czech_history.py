#!/usr/bin/env python3
"""Load the Czech municipal budget history 2010-2025 into BigQuery.

Data-plane worker. It runs on a Cloud Build worker in europe-west4 as
psd-data-builder and never touches the website checkout, Cloud Run or any web
build. Pipeline: immutable raw -> staging -> validation -> atomic publish.

1. Fetch data/municipal-history/*.json and the directory file from the public
   GitHub repository at one pinned commit (partial clone, only those blobs).
2. Copy the exact files write-once to
   gs://<bucket>/raw/czech-municipal-history/<git-sha>/ and verify every object's
   MD5 against the local bytes (a retry reuses and re-verifies the same objects).
3. Normalize one row per municipality x fiscal year (the natural grain of the
   JSON `series`). Amounts keep the exact decimal text of the JSON as NUMERIC;
   null stays NULL, never zero.
4. Load a per-run staging table, validate it against totals recomputed from the
   JSON with Decimal arithmetic, index.json and the directory file, and
   cross-check 2025 against municipal_budget_line_facts (reported, not fixed).
5. Only if every blocking validation passes: one `bq cp -f` replaces the
   published table atomically. The staging table is retained as the immutable
   release copy for replay/rollback.
6. Write an immutable receipt (if-generation-match=0) whether or not it published.

Stdlib only; shells out to git, gcloud and bq, which the cloud-sdk image carries.
`--local-source-dir` runs steps 3 and the source-side checks without any cloud
call, for preflight on a checkout.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import gzip
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

REPOSITORY = "https://github.com/jan-rezab/czbudget.git"
HISTORY_DIR = "data/municipal-history"
DIRECTORY_FILE = "data/municipal-history-directory.v1.json"
DATASET_ID = "CZ_MUNICIPAL_HISTORY_2010_2025"
EXPECTED_MUNICIPALITIES = 6254
YEARS = list(range(2010, 2026))

AMOUNT_FIELDS = [
    "revenue_approved", "revenue_adjusted", "revenue_actual",
    "expense_approved", "expense_adjusted", "expense_actual",
    "tax_revenue", "nontax_revenue", "capital_revenue", "transfer_revenue",
    "current_expense", "capital_expense", "budget_balance",
    "cash_current", "cash_previous", "expense_per_capita",
]
INTEGER_FIELDS = ["population_mid_year"]
MEASURES = AMOUNT_FIELDS + INTEGER_FIELDS
SERIES_FIELDS = {"year", *MEASURES, "source_kind", "comparability", "quality_flags"}

SCHEMA = (
    [
        {"name": "dataset_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "schema_version", "type": "STRING", "mode": "REQUIRED"},
        {"name": "generated_at", "type": "TIMESTAMP", "mode": "REQUIRED"},
        {"name": "entity_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "national_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "municipality_name", "type": "STRING", "mode": "REQUIRED"},
        {"name": "currency_code", "type": "STRING", "mode": "REQUIRED"},
        {"name": "fiscal_year", "type": "INTEGER", "mode": "REQUIRED"},
    ]
    + [{"name": f, "type": "NUMERIC", "mode": "NULLABLE"} for f in AMOUNT_FIELDS]
    + [{"name": f, "type": "INTEGER", "mode": "NULLABLE"} for f in INTEGER_FIELDS]
    + [
        {"name": "source_kind", "type": "STRING", "mode": "NULLABLE"},
        {"name": "comparability", "type": "STRING", "mode": "NULLABLE"},
        {"name": "quality_flags", "type": "STRING", "mode": "REPEATED"},
        {"name": "source_repository", "type": "STRING", "mode": "REQUIRED"},
        {"name": "source_git_sha", "type": "STRING", "mode": "REQUIRED"},
        {"name": "source_path", "type": "STRING", "mode": "REQUIRED"},
        {"name": "source_file_sha256", "type": "STRING", "mode": "REQUIRED"},
        {"name": "source_git_blob_sha", "type": "STRING", "mode": "NULLABLE"},
        {"name": "raw_object_uri", "type": "STRING", "mode": "NULLABLE"},
        {"name": "raw_object_generation", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "ingestion_run_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "loader_git_sha", "type": "STRING", "mode": "REQUIRED"},
        {"name": "loaded_at", "type": "TIMESTAMP", "mode": "REQUIRED"},
    ]
)


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def log(message: str) -> None:
    print(f"[{now()}] {message}", flush=True)


def run(cmd: list[str], *, cwd: str | None = None, capture: bool = False) -> str:
    log("$ " + " ".join(cmd))
    result = subprocess.run(cmd, cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout if capture else ""


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def md5_b64(path: Path) -> str:
    return base64.b64encode(hashlib.md5(path.read_bytes()).digest()).decode()


def plain(value: Decimal) -> str:
    """Exact decimal text without exponent, as BigQuery NUMERIC accepts it."""
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


# ---------------------------------------------------------------- fetch/raw

def fetch_source(sha: str, workdir: Path) -> tuple[Path, dict[str, str]]:
    repo = workdir / "repo"
    repo.mkdir(parents=True)
    run(["git", "init", "-q"], cwd=str(repo))
    run(["git", "remote", "add", "origin", REPOSITORY], cwd=str(repo))
    run(["git", "fetch", "-q", "--depth=1", "origin", sha], cwd=str(repo))
    fetched = run(["git", "rev-parse", "FETCH_HEAD"], cwd=str(repo), capture=True).strip()
    if fetched != sha:
        raise RuntimeError(f"Fetched {fetched}, expected pinned {sha}")
    run(["git", "checkout", "-q", sha, "--", HISTORY_DIR, DIRECTORY_FILE], cwd=str(repo))
    tree = run(["git", "ls-tree", "-r", sha, "--", HISTORY_DIR, DIRECTORY_FILE],
               cwd=str(repo), capture=True)
    blobs = {}
    for line in tree.splitlines():
        meta, path = line.split("\t", 1)
        blobs[path] = meta.split()[2]
    # Git verifies blob integrity on checkout; re-check the working-tree bytes too.
    for path, blob in blobs.items():
        data = (repo / path).read_bytes()
        header = f"blob {len(data)}\0".encode()
        if hashlib.sha1(header + data).hexdigest() != blob:
            raise RuntimeError(f"{path} does not match git blob {blob}")
    return repo, blobs


def upload_raw(repo: Path, paths: list[str], raw_prefix: str, manifest_path: Path) -> dict[str, dict]:
    """Write-once copy; objects that already exist are reused only if MD5 matches."""
    stage = repo / "__raw_upload"
    stage.mkdir()
    for rel in paths:
        target = stage / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        os.link(repo / rel, target)
    manifest_dst = stage / "source-manifest.json"
    os.link(manifest_path, manifest_dst)
    existing = list_objects(raw_prefix)
    missing = [rel for rel in paths + ["source-manifest.json"] if rel not in existing]
    if missing:
        log(f"uploading {len(missing)} raw objects ({len(existing)} already present)")
        # --no-clobber uses an if-generation-match=0 precondition per object.
        run(["gcloud", "storage", "cp", "--no-clobber", "--recursive",
             *(str(stage / p.split("/")[0]) for p in sorted({m.split("/")[0] for m in missing})),
             raw_prefix])
    objects = list_objects(raw_prefix)
    for rel in paths + ["source-manifest.json"]:
        obj = objects.get(rel)
        if obj is None:
            raise RuntimeError(f"raw object missing after upload: {raw_prefix}{rel}")
        if obj["md5"] != md5_b64(stage / rel):
            raise RuntimeError(f"raw object {raw_prefix}{rel} differs from pinned bytes; "
                               "refusing to overwrite an immutable object")
    return objects


def list_objects(prefix: str) -> dict[str, dict]:
    try:
        text = run(["gcloud", "storage", "ls", "--recursive", "--json", prefix + "**"], capture=True)
    except subprocess.CalledProcessError:
        return {}
    result = {}
    for item in json.loads(text or "[]"):
        url = item.get("url", "")
        meta = item.get("metadata", item)
        if not url.startswith(prefix) or item.get("type") not in (None, "cloud_object"):
            continue
        md5 = meta.get("md5Hash") or meta.get("md5_hash")
        generation = meta.get("generation")
        rel = url[len(prefix):].split("#", 1)[0]
        result[rel] = {"md5": md5, "generation": int(generation) if generation else None,
                       "uri": prefix + rel}
    return result


# ---------------------------------------------------------------- transform

def normalize(repo: Path, blobs: dict[str, str], ctx: dict, raw_objects: dict[str, dict]):
    files = sorted(p for p in (repo / HISTORY_DIR).glob("*.json") if p.name != "index.json")
    rows = []
    manifest = []
    src = {
        "files": 0, "series_entries": 0, "duplicate_keys": 0,
        "sum": defaultdict(Decimal), "nonnull": defaultdict(int), "zero": defaultdict(int),
        "null_keys": defaultdict(list), "quality_flags": 0, "years": defaultdict(int),
        "municipalities": set(), "unexpected_fields": set(), "rejected": [],
    }
    for path in files:
        rel = f"{HISTORY_DIR}/{path.name}"
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        manifest.append({"path": rel, "bytes": len(data), "sha256": digest,
                         "git_blob_sha": blobs.get(rel)})
        doc = json.loads(data, parse_float=Decimal, parse_int=int)
        if doc.get("dataset_id") != DATASET_ID:
            src["rejected"].append({"path": rel, "reason": f"dataset_id {doc.get('dataset_id')}"})
            continue
        muni = doc["municipality"]
        ico = muni["national_id"]
        if path.stem != ico:
            src["rejected"].append({"path": rel, "reason": "file name does not match national_id"})
            continue
        src["files"] += 1
        src["municipalities"].add(ico)
        raw = raw_objects.get(rel, {})
        seen = set()
        for entry in doc["series"]:
            src["series_entries"] += 1
            year = entry["year"]
            if year in seen:
                src["duplicate_keys"] += 1
            seen.add(year)
            src["years"][year] += 1
            src["unexpected_fields"].update(set(entry) - SERIES_FIELDS)
            row = {
                "dataset_id": doc["dataset_id"],
                "schema_version": doc["schema_version"],
                "generated_at": doc["generated_at"],
                "entity_id": muni["entity_id"],
                "national_id": ico,
                "municipality_name": muni["name"],
                "currency_code": muni["currency_code"],
                "fiscal_year": year,
                "source_kind": entry.get("source_kind"),
                "comparability": entry.get("comparability"),
                "quality_flags": list(entry.get("quality_flags") or []),
                "source_repository": REPOSITORY,
                "source_git_sha": ctx["source_sha"],
                "source_path": rel,
                "source_file_sha256": digest,
                "source_git_blob_sha": blobs.get(rel),
                "raw_object_uri": raw.get("uri"),
                "raw_object_generation": raw.get("generation"),
                "ingestion_run_id": ctx["run_id"],
                "loader_git_sha": ctx["loader_sha"],
                "loaded_at": ctx["loaded_at"],
            }
            src["quality_flags"] += len(row["quality_flags"])
            for field in MEASURES:
                value = entry.get(field)
                key = (year, field)
                if value is None:
                    row[field] = None
                    src["null_keys"][field].append(f"{ico}:{year}")
                    continue
                if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
                    raise RuntimeError(f"{rel} {year} {field}: non-numeric {value!r}")
                dec = Decimal(value)
                if field in INTEGER_FIELDS:
                    if dec != dec.to_integral_value():
                        raise RuntimeError(f"{rel} {year} {field}: non-integer {value!r}")
                    row[field] = int(dec)
                else:
                    row[field] = plain(dec)
                src["sum"][key] += dec
                src["nonnull"][key] += 1
                if dec == 0:
                    src["zero"][key] += 1
            rows.append(row)
    return rows, manifest, src


def read_json(path: Path):
    return json.loads(path.read_bytes(), parse_float=Decimal)


def source_side_checks(repo: Path, src: dict) -> list[dict]:
    """Checks that need only the pinned files: index.json and directory totals."""
    checks = []
    index = read_json(repo / HISTORY_DIR / "index.json")
    directory = read_json(repo / DIRECTORY_FILE)

    def check(name, expected, actual, blocking=True, detail=None):
        entry = {"check": name, "expected": expected, "actual": actual,
                 "passed": expected == actual, "blocking": blocking}
        if detail:
            entry["detail"] = detail
        checks.append(entry)

    check("source.no_rejected_files", [], src["rejected"])
    check("source.no_unexpected_series_fields", [], sorted(src["unexpected_fields"]))
    check("source.no_duplicate_municipality_year", 0, src["duplicate_keys"])
    check("source.municipality_count", EXPECTED_MUNICIPALITIES, len(src["municipalities"]))
    check("source.index_municipality_count", index["municipality_count"], len(src["municipalities"]))
    check("source.index_annual_record_count", index["annual_record_count"], src["series_entries"])
    for cov in index["coverage_by_year"]:
        y = cov["year"]
        check(f"source.index_coverage_{y}",
              {"budget": cov["budget"], "cash": cov["cash"], "population": cov["population"]},
              {"budget": src["years"].get(y, 0),
               "cash": src["nonnull"].get((y, "cash_current"), 0),
               "population": src["nonnull"].get((y, "population_mid_year"), 0)})
    check("source.directory_row_count", len(directory["rows"]), src["series_entries"])
    for annual in directory["annual"]:
        y = annual["year"]
        expected = {k: plain(Decimal(annual[k])) for k in
                    ("revenue_actual", "expense_actual", "budget_balance", "cash_current")}
        expected.update({"entity_count": annual["entity_count"],
                         "cash_entity_count": annual["cash_entity_count"],
                         "population_entity_count": annual["population_entity_count"],
                         "population_total": annual["population_total"]})
        actual = {k: plain(src["sum"].get((y, k), Decimal(0))) for k in
                  ("revenue_actual", "expense_actual", "budget_balance", "cash_current")}
        actual.update({"entity_count": src["years"].get(y, 0),
                       "cash_entity_count": src["nonnull"].get((y, "cash_current"), 0),
                       "population_entity_count": src["nonnull"].get((y, "population_mid_year"), 0),
                       "population_total": int(src["sum"].get((y, "population_mid_year"), 0))})
        check(f"source.directory_annual_{y}", expected, actual)
    return checks


def source_totals(src: dict) -> dict:
    out = {}
    for year in YEARS:
        out[str(year)] = {
            "rows": src["years"].get(year, 0),
            "measures": {
                f: {"sum": plain(src["sum"].get((year, f), Decimal(0))),
                    "nonnull": src["nonnull"].get((year, f), 0),
                    "null": src["years"].get(year, 0) - src["nonnull"].get((year, f), 0),
                    "zero": src["zero"].get((year, f), 0)}
                for f in MEASURES
            },
        }
    return out


# ---------------------------------------------------------------- BigQuery

def bq_query(project: str, sql: str) -> list[dict]:
    text = run(["bq", f"--project_id={project}", "--location=EU", "query", "--quiet",
                "--use_legacy_sql=false", "--format=json", "--max_rows=1000000", sql],
               capture=True)
    return json.loads(text or "[]")


def warehouse_checks(project: str, table: str, src: dict, totals: dict) -> tuple[list[dict], dict]:
    checks = []
    fq = f"`{project}.{table}`"

    def check(name, expected, actual, blocking=True):
        checks.append({"check": name, "expected": expected, "actual": actual,
                       "passed": expected == actual, "blocking": blocking})

    head = bq_query(project, f"""
        SELECT COUNT(*) AS n, COUNT(DISTINCT national_id) AS munis,
               COUNT(DISTINCT FORMAT('%s:%d', national_id, fiscal_year)) AS keys,
               SUM(ARRAY_LENGTH(quality_flags)) AS flags,
               COUNT(DISTINCT source_git_sha) AS shas, COUNT(DISTINCT ingestion_run_id) AS runs
        FROM {fq}""")[0]
    check("stage.row_count_equals_series_entries", src["series_entries"], int(head["n"]))
    check("stage.municipality_count", EXPECTED_MUNICIPALITIES, int(head["munis"]))
    check("stage.unique_municipality_year", int(head["n"]), int(head["keys"]))
    check("stage.quality_flag_count", src["quality_flags"], int(head["flags"] or 0))
    check("stage.single_source_sha_and_run", [1, 1], [int(head["shas"]), int(head["runs"])])

    selects = ", ".join(
        f"CAST(SUM({f}) AS STRING) AS s_{f}, COUNTIF({f} IS NOT NULL) AS n_{f}, COUNTIF({f} = 0) AS z_{f}"
        for f in MEASURES)
    per_year = {int(r["fiscal_year"]): r for r in bq_query(project, f"""
        SELECT fiscal_year, COUNT(*) AS rows_, {selects}
        FROM {fq} GROUP BY fiscal_year ORDER BY fiscal_year""")}
    warehouse_totals = {}
    for year in YEARS:
        r = per_year.get(year, {})
        wt = {"rows": int(r.get("rows_", 0)), "measures": {}}
        for f in MEASURES:
            s = r.get(f"s_{f}")
            nonnull = int(r.get(f"n_{f}", 0))
            wt["measures"][f] = {"sum": plain(Decimal(s)) if s is not None else "0",
                                 "nonnull": nonnull, "null": wt["rows"] - nonnull,
                                 "zero": int(r.get(f"z_{f}", 0))}
        warehouse_totals[str(year)] = wt
        check(f"stage.year_{year}_rows", totals[str(year)]["rows"], wt["rows"])
        check(f"stage.year_{year}_measure_totals_exact", totals[str(year)]["measures"], wt["measures"])

    for f in MEASURES:
        rows = bq_query(project, f"""
            SELECT FORMAT('%s:%d', national_id, fiscal_year) AS k FROM {fq}
            WHERE {f} IS NULL ORDER BY k""")
        check(f"stage.null_keys_{f}", sorted(src["null_keys"].get(f, [])), [r["k"] for r in rows])
    return checks, warehouse_totals


def facts_crosscheck(project: str, table: str) -> dict:
    rows = bq_query(project, f"""
        WITH h AS (SELECT DISTINCT entity_id FROM `{project}.{table}` WHERE fiscal_year = 2025),
             f AS (SELECT DISTINCT public_entity_id AS entity_id
                   FROM `{project}.budget_detail.municipal_budget_line_facts`
                   WHERE fiscal_year = 2025 AND STARTS_WITH(public_entity_id, 'CZ:'))
        SELECT (SELECT COUNT(*) FROM h) AS history_2025,
               (SELECT COUNT(*) FROM f) AS facts_2025,
               ARRAY(SELECT entity_id FROM h EXCEPT DISTINCT SELECT entity_id FROM f ORDER BY 1) AS only_history,
               ARRAY(SELECT entity_id FROM f EXCEPT DISTINCT SELECT entity_id FROM h ORDER BY 1) AS only_facts""")
    r = rows[0]
    only_h = r.get("only_history") or []
    only_f = r.get("only_facts") or []
    return {"check": "crosscheck.2025_vs_municipal_budget_line_facts", "blocking": False,
            "history_2025_municipalities": int(r["history_2025"]),
            "facts_2025_municipalities": int(r["facts_2025"]),
            "only_in_history": only_h, "only_in_facts": only_f,
            "passed": not only_h and not only_f,
            "note": "Municipality-set comparison only; differences are reported, not fixed."}


# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-sha", required=True)
    ap.add_argument("--loader-sha", required=True)
    ap.add_argument("--project", default=os.environ.get("PROJECT_ID", "czbudget-janrezab"))
    ap.add_argument("--dataset", default="budget_detail")
    ap.add_argument("--table", default="czech_municipal_history_annual")
    # The data identity may edit only the published table in budget_detail (table-level grant);
    # per-run staging lives in a private processing dataset where it is a writer.
    ap.add_argument("--stage-dataset", default="processing_czech_history")
    ap.add_argument("--bucket", default="czbudget-janrezab-data-layers")
    ap.add_argument("--run-id", default=os.environ.get("BUILD_ID"))
    ap.add_argument("--region", default="europe-west4")
    ap.add_argument("--service-account", default="psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com")
    ap.add_argument("--local-source-dir", help="preflight only: read files from this checkout, no cloud calls")
    ap.add_argument("--receipt-out", help="also write the receipt JSON to this local path")
    args = ap.parse_args()

    local = bool(args.local_source_dir)
    run_id = args.run_id or ("local-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    safe_run = run_id.replace("-", "_")
    started = now()
    target = f"{args.dataset}.{args.table}"
    stage_table = f"{args.stage_dataset}._czech_municipal_history_stage_{safe_run}"
    raw_prefix = f"gs://{args.bucket}/raw/czech-municipal-history/{args.source_sha}/"
    run_prefix = f"gs://{args.bucket}/processing-runs/czech-municipal-history/{run_id}/"
    ctx = {"source_sha": args.source_sha, "loader_sha": args.loader_sha,
           "run_id": run_id, "loaded_at": started}
    receipt = {
        "receipt_schema": "czech-municipal-history-bq/1",
        "dataset": DATASET_ID,
        "ingestion_run_id": run_id,
        "cloud_build_id": os.environ.get("BUILD_ID"),
        "project": args.project,
        "region": args.region,
        "service_account": args.service_account,
        "loader_git_sha": args.loader_sha,
        "loader_script_sha256": sha256_file(Path(__file__)),
        "source": {"repository": REPOSITORY, "git_sha": args.source_sha,
                   "paths": [f"{HISTORY_DIR}/*.json", DIRECTORY_FILE],
                   "upstream": "MF Monitor FIN 2-12 M / ROZV extracts and CZSO DataStat OBY01B01, "
                               "as processed by pipeline/transforms/prepare_municipal_history.py"},
        "raw_destination": raw_prefix,
        "staging_destination": {"table": f"{args.project}.{stage_table}",
                                "rows_object": run_prefix + "staging/rows.ndjson.gz"},
        "publication_target": f"{args.project}.{target}",
        "started_at": started,
        "processing_status": "running",
        "publication_status": "not_published",
        "validations": [],
    }
    exit_code = 1
    try:
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            if local:
                repo = Path(args.local_source_dir).resolve()
                tree = subprocess.run(["git", "ls-tree", "-r", "HEAD", "--", HISTORY_DIR, DIRECTORY_FILE],
                                      cwd=repo, text=True, capture_output=True).stdout
                blobs = {l.split("\t", 1)[1]: l.split()[2] for l in tree.splitlines()}
            else:
                repo, blobs = fetch_source(args.source_sha, work)
            paths = sorted(blobs)

            # Manifest of the exact pinned bytes (all files incl. index + directory).
            manifest = [{"path": p, "bytes": (repo / p).stat().st_size,
                         "sha256": sha256_file(repo / p), "git_blob_sha": blobs[p]} for p in paths]
            manifest_path = work / "source-manifest.json"
            manifest_path.write_text(json.dumps({"repository": REPOSITORY, "git_sha": args.source_sha,
                                                 "files": manifest}, indent=1) + "\n")
            receipt["source"]["file_count"] = len(manifest)
            receipt["source"]["total_bytes"] = sum(m["bytes"] for m in manifest)
            receipt["source"]["manifest_sha256"] = sha256_file(manifest_path)
            receipt["source"]["index_sha256"] = next(m["sha256"] for m in manifest if m["path"].endswith("/index.json"))
            receipt["source"]["directory_sha256"] = next(m["sha256"] for m in manifest if m["path"] == DIRECTORY_FILE)

            raw_objects = {}
            if not local:
                objs = upload_raw(repo, paths, raw_prefix, manifest_path)
                raw_objects = {p: objs[p] for p in paths}
                receipt["source"]["raw_manifest_object"] = {
                    "uri": raw_prefix + "source-manifest.json",
                    "generation": objs["source-manifest.json"]["generation"]}

            rows, _, src = normalize(repo, blobs, ctx, raw_objects)
            totals = source_totals(src)
            receipt["source_totals"] = totals
            receipt["counts"] = {
                "files_received": len(manifest),
                "municipality_files": src["files"] + len(src["rejected"]),
                "received_rows": src["series_entries"],
                "accepted_rows": len(rows),
                "rejected_rows": src["series_entries"] - len(rows),
                "rejected_files": src["rejected"],
                "deduplicated_rows": 0,
                "municipalities": len(src["municipalities"]),
            }
            receipt["coverage"] = {str(y): {"municipalities": src["years"].get(y, 0),
                                            "cash_nonnull": src["nonnull"].get((y, "cash_current"), 0),
                                            "population_nonnull": src["nonnull"].get((y, "population_mid_year"), 0)}
                                   for y in YEARS}
            receipt["validations"] += source_side_checks(repo, src)

            ndjson = work / "rows.ndjson.gz"
            with gzip.open(ndjson, "wt", encoding="utf-8") as out:
                for row in rows:
                    out.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            schema_path = work / "schema.json"
            schema_path.write_text(json.dumps(SCHEMA, indent=1))
            receipt["normalized_rows_sha256"] = sha256_file(ndjson)

            if local:
                receipt["processing_status"] = "preflight_only"
                exit_code = 0 if all(c["passed"] for c in receipt["validations"] if c["blocking"]) else 3
            else:
                rows_uri = run_prefix + "staging/rows.ndjson.gz"
                run(["gcloud", "storage", "cp", "--if-generation-match=0", str(ndjson), rows_uri])
                run(["bq", f"--project_id={args.project}", "--location=EU", "load", "--replace",
                     "--source_format=NEWLINE_DELIMITED_JSON", "--clustering_fields=national_id,fiscal_year",
                     f"{args.project}:{stage_table}", rows_uri, str(schema_path)])
                checks, wtotals = warehouse_checks(args.project, stage_table, src, totals)
                receipt["validations"] += checks
                receipt["normalized_totals"] = wtotals
                receipt["validations"].append(facts_crosscheck(args.project, stage_table))
                failed = [c["check"] for c in receipt["validations"] if c["blocking"] and not c["passed"]]
                receipt["failed_blocking_checks"] = failed
                if failed:
                    receipt["processing_status"] = "failed_validation"
                    log(f"blocking validations failed: {failed}; nothing published")
                    exit_code = 3
                else:
                    receipt["processing_status"] = "succeeded"
                    run(["bq", f"--project_id={args.project}", "--location=EU", "cp", "-f",
                         f"{args.project}:{stage_table}", f"{args.project}:{target}"])
                    run(["bq", f"--project_id={args.project}", "update",
                         "--set_label", f"ingestion_run:{safe_run.lower()}",
                         "--set_label", f"source_git_sha:{args.source_sha[:12]}",
                         "--description",
                         f"Czech municipal budget history 2010-2025, one row per municipality x year. "
                         f"Release {run_id} from {REPOSITORY}@{args.source_sha}. Missing values are NULL, "
                         f"never zero. Receipt: {run_prefix}receipt.json",
                         f"{args.project}:{target}"])
                    pub = bq_query(args.project, f"""
                        SELECT COUNT(*) AS n, ANY_VALUE(ingestion_run_id) AS run
                        FROM `{args.project}.{target}`""")[0]
                    ok = int(pub["n"]) == len(rows) and pub["run"] == run_id
                    receipt["validations"].append({"check": "publish.target_matches_stage", "blocking": True,
                                                   "expected": [len(rows), run_id],
                                                   "actual": [int(pub["n"]), pub["run"]], "passed": ok})
                    if not ok:
                        raise RuntimeError("published table does not match the staged release")
                    receipt["publication_status"] = "published"
                    receipt["published_release_id"] = run_id
                    receipt["published_table"] = f"{args.project}.{target}"
                    receipt["published_at"] = now()
                    receipt["website_destinations"] = []
                    exit_code = 0
    except Exception as exc:  # the receipt records every failure
        if receipt["processing_status"] == "running":
            receipt["processing_status"] = "failed"
        receipt["error"] = f"{type(exc).__name__}: {exc}"
        log(receipt["error"])
        exit_code = 1
    finally:
        receipt["finished_at"] = now()
        body = json.dumps(receipt, ensure_ascii=False, indent=1, default=str) + "\n"
        if args.receipt_out:
            Path(args.receipt_out).write_text(body)
        if not local:
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
                fh.write(body)
            run(["gcloud", "storage", "cp", "--if-generation-match=0", fh.name, run_prefix + "receipt.json"])
        summary = {k: receipt.get(k) for k in ("processing_status", "publication_status", "counts",
                                                  "failed_blocking_checks", "error")}
        print(json.dumps(summary, indent=1, default=str))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
