#!/usr/bin/env python3
"""Create a traceable country-level municipal publication candidate."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess


PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
REGION = "europe-west4"
SERVICE_ACCOUNT = "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
WAREHOUSE_TABLE = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
PRIVATE_ROOT = "gs://czbudget-janrezab-data-layers/processing-runs/municipal-publication"
PUBLIC_POINTER = "gs://czbudget-janrezab-public-snapshots/municipal/current.json"
COUNTRIES = {
    "POL": {
        "alpha2": "PL",
        "slug": "poland",
        "source_title": "Polish Ministry of Finance · local-government budget reports",
        "source_url": "https://www.gov.pl/web/finanse/sprawozdania-budzetowe",
        "years": (2024, 2025),
        "scopes": ("standalone_municipality",),
    },
}


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def query(sql: str) -> list[dict]:
    completed = subprocess.run(
        ["bq", "query", "--project_id=" + PROJECT, "--location=EU", "--use_legacy_sql=false", "--format=json", "--max_rows=1000000", sql],
        check=False,
        capture_output=True,
        text=True,
        timeout=3300,
    )
    if completed.returncode:
        raise RuntimeError(f"BigQuery command failed ({completed.returncode}): {completed.stderr.strip()}")
    return json.loads(completed.stdout or "[]")


def slugify(value: str) -> str:
    replacements = str.maketrans({"Ł": "L", "ł": "l"})
    import unicodedata
    value = unicodedata.normalize("NFKD", value.translate(replacements)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", value)) or "municipality"


def roots(args: argparse.Namespace) -> tuple[Path, Path, Path]:
    work = Path(args.work)
    return work, work / "raw", work / "candidate"


def extract(args: argparse.Namespace) -> None:
    config = COUNTRIES[args.country]
    _, raw, _ = roots(args)
    raw.mkdir(parents=True, exist_ok=False)
    low, high = config["years"]
    prefix = config["alpha2"] + ":%"
    scopes = ",".join("'" + item + "'" for item in config["scopes"])

    headline_rows = query(f"""
      SELECT public_entity_id, fiscal_year, fiscal_period, budget_stage, budget_side,
             is_financing, CAST(SUM(amount_local) AS STRING) AS amount_local
      FROM `{WAREHOUSE_TABLE}`
      WHERE fiscal_year BETWEEN {low} AND {high}
        AND public_entity_id LIKE '{prefix}'
        AND reporting_scope IN ({scopes})
        AND budget_side IN ('revenue', 'expenditure')
        AND NOT is_consolidation_item
      GROUP BY public_entity_id, fiscal_year, fiscal_period, budget_stage, budget_side, is_financing
      ORDER BY public_entity_id, fiscal_year, fiscal_period, budget_stage, budget_side, is_financing
    """)
    headline_body = "".join(canonical_json(row) + "\n" for row in headline_rows).encode()
    (raw / "headline-facts.jsonl").write_bytes(headline_body)

    coverage_rows = query(f"""
      SELECT
        COUNT(*) AS received_rows,
        COUNTIF(reporting_scope IN ({scopes}) AND budget_side IN ('revenue','expenditure')
          AND NOT is_consolidation_item AND NOT is_summary_row) AS accepted_detail_rows,
        COUNT(DISTINCT public_entity_id) AS received_entities,
        COUNT(DISTINCT IF(reporting_scope IN ({scopes}) AND budget_side IN ('revenue','expenditure')
          AND NOT is_consolidation_item, public_entity_id, NULL)) AS accepted_entities,
        COUNT(DISTINCT IF(reporting_scope IN ({scopes}) AND budget_side IN ('revenue','expenditure')
          AND NOT is_consolidation_item AND NOT is_summary_row, economic_item_code, NULL)) AS distinct_item_codes,
        MIN(fiscal_year) AS first_year,
        MAX(fiscal_year) AS latest_year,
        CAST(SUM(IF(reporting_scope IN ({scopes}) AND budget_side = 'revenue' AND budget_stage = 'actual'
          AND fiscal_period = 'FY' AND NOT is_consolidation_item AND NOT is_financing, amount_local, 0)) AS STRING) AS actual_revenue,
        CAST(SUM(IF(reporting_scope IN ({scopes}) AND budget_side = 'expenditure' AND budget_stage = 'actual'
          AND fiscal_period = 'FY' AND NOT is_consolidation_item AND NOT is_financing, amount_local, 0)) AS STRING) AS actual_expenditure
      FROM `{WAREHOUSE_TABLE}`
      WHERE fiscal_year BETWEEN {low} AND {high}
        AND public_entity_id LIKE '{prefix}'
    """)
    if len(coverage_rows) != 1:
        raise RuntimeError("Coverage query did not return exactly one row")
    write_json(raw / "coverage.json", coverage_rows[0])

    lineage = query(f"""
      SELECT source_id, ingestion_run_id, COUNT(*) AS row_count,
             MIN(fiscal_year) AS first_year, MAX(fiscal_year) AS latest_year,
             MIN(loaded_at) AS first_loaded_at, MAX(loaded_at) AS last_loaded_at
      FROM `{WAREHOUSE_TABLE}`
      WHERE fiscal_year BETWEEN {low} AND {high}
        AND public_entity_id LIKE '{prefix}'
      GROUP BY source_id, ingestion_run_id
      ORDER BY source_id, ingestion_run_id
    """)
    write_json(raw / "lineage.json", {"warehouse_table": WAREHOUSE_TABLE, "selections": lineage})

    source_selection = {
        "schema_version": "1.0.0",
        "dataset": "municipal-publication",
        "country_code": args.country,
        "run_id": args.run_id,
        "loader_git_sha": args.loader_git_sha,
        "selected_at": datetime.now(timezone.utc).isoformat(),
        "warehouse_table": WAREHOUSE_TABLE,
        "partition_predicate": f"fiscal_year BETWEEN {low} AND {high}",
        "entity_predicate": f"public_entity_id LIKE '{prefix}'",
        "source_url": config["source_url"],
        "files": {
            "headline-facts.jsonl": {"bytes": len(headline_body), "sha256": sha256_bytes(headline_body), "rows": len(headline_rows)},
            "coverage.json": {"sha256": sha256_bytes((raw / "coverage.json").read_bytes())},
            "lineage.json": {"sha256": sha256_bytes((raw / "lineage.json").read_bytes())},
        },
    }
    write_json(raw / "source-selection.json", source_selection)


def load_headline_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def build(args: argparse.Namespace) -> None:
    config = COUNTRIES[args.country]
    work, raw, candidate = roots(args)
    candidate.mkdir(parents=True, exist_ok=False)
    repository = Path.cwd()
    directory = read_json(repository / "data" / "registry" / "municipal-entities" / f"{args.country}.v1.json")
    rules = read_json(repository / "pipeline" / "config" / "municipal_headline_rules.json")
    rule = next((item for item in rules["countries"] if item["country_code"] == args.country), None)
    if not rule or rule.get("status") or not rule.get("authored_basis"):
        raise RuntimeError(f"{args.country} is not approved for authored headline generation")

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in load_headline_rows(raw / "headline-facts.jsonl"):
        grouped[row["public_entity_id"].split(":", 1)[1]].append(row)

    profiles = []
    rejected = []
    for entity in directory["entities"]:
        code = str(entity["code"])
        rows = grouped.get(code, [])
        history = []
        for year in sorted({int(row["fiscal_year"]) for row in rows}):
            annual = [row for row in rows if int(row["fiscal_year"]) == year]
            item = {"year": year}
            for side in ("revenue", "expenditure"):
                selected = [row for row in annual if row["budget_side"] == side and row["budget_stage"] == "actual" and row["fiscal_period"] == "FY" and str(row["is_financing"]).lower() != "true"]
                if selected:
                    item[side] = round(sum(float(row["amount_local"]) for row in selected), 2)
            if "revenue" in item and "expenditure" in item:
                item["balance"] = round(item["revenue"] - item["expenditure"], 2)
            history.append(item)
        if not any("revenue" in item and "expenditure" in item for item in history):
            rejected.append({"code": code, "reason": "missing_actual_FY_pair"})
            continue
        profile = {
            "code": code,
            "name": entity["name"],
            "region": entity.get("region"),
            "country": args.country,
            "currency": entity.get("currency", directory["currency_code"]),
            "years": [item["year"] for item in history],
            "history": history,
            "source_url": config["source_url"],
            "url": f"/municipalities/{config['slug']}/{slugify(entity['name'])}-{code}/",
        }
        profiles.append(profile)

    bundle_body = "".join(canonical_json(profile) + "\n" for profile in profiles).encode()
    (candidate / f"{args.country.lower()}.ndjson").write_bytes(bundle_body)
    country_index = {
        "schema_version": "1.0.0",
        "release_status": "candidate",
        "country_code": args.country,
        "country_slug": config["slug"],
        "profile_count": len(profiles),
        "rejected_profile_count": len(rejected),
        "years": list(config["years"]),
        "currency_code": directory["currency_code"],
        "source_title": config["source_title"],
        "source_url": config["source_url"],
        "profile_bundle": f"{args.country.lower()}.ndjson",
        "profile_bundle_sha256": sha256_bytes(bundle_body),
        "proof": "proof.html",
    }
    write_json(candidate / "country-index.json", country_index)
    write_json(candidate / "rejected-profiles.json", rejected)

    coverage = read_json(raw / "coverage.json")
    proof = f"""<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>{html.escape(config['source_title'])} — publication proof</title><body><main><h1>{args.country} municipal publication candidate</h1><p>Candidate only; the public pointer has not moved.</p><dl><dt>Profiles received</dt><dd>{directory['entity_count']}</dd><dt>Profiles accepted</dt><dd>{len(profiles)}</dd><dt>Profiles rejected</dt><dd>{len(rejected)}</dd><dt>Warehouse rows received</dt><dd>{coverage['received_rows']}</dd><dt>Detail rows accepted</dt><dd>{coverage['accepted_detail_rows']}</dd><dt>Distinct item codes</dt><dd>{coverage['distinct_item_codes']}</dd><dt>Years</dt><dd>{coverage['first_year']}–{coverage['latest_year']}</dd><dt>Source</dt><dd><a href=\"{html.escape(config['source_url'])}\">{html.escape(config['source_title'])}</a></dd><dt>Loader Git SHA</dt><dd><code>{html.escape(args.loader_git_sha)}</code></dd><dt>Cloud Build ID</dt><dd><code>{html.escape(args.run_id)}</code></dd></dl></main></body></html>"""
    (candidate / "proof.html").write_text(proof, encoding="utf-8")


def validate(args: argparse.Namespace) -> None:
    config = COUNTRIES[args.country]
    work, raw, candidate = roots(args)
    directory = read_json(Path.cwd() / "data" / "registry" / "municipal-entities" / f"{args.country}.v1.json")
    coverage = read_json(raw / "coverage.json")
    index = read_json(candidate / "country-index.json")
    profiles = [json.loads(line) for line in (candidate / f"{args.country.lower()}.ndjson").read_text(encoding="utf-8").splitlines() if line]
    rejected = read_json(candidate / "rejected-profiles.json")
    codes = [profile["code"] for profile in profiles]
    checks = {
        "registry_count_reconciled": len(profiles) + len(rejected) == int(directory["entity_count"]),
        "accepted_entity_count_reconciled": len(profiles) == int(coverage["accepted_entities"]),
        "unique_profile_codes": len(codes) == len(set(codes)),
        "canonical_routes": all(re.fullmatch(rf"/municipalities/{config['slug']}/[^/]+/", profile["url"]) for profile in profiles),
        "actual_headline_pairs": all(any("revenue" in row and "expenditure" in row for row in profile["history"]) for profile in profiles),
        "minimum_itemized_depth": int(coverage["distinct_item_codes"]) >= 5,
        "bundle_hash_matches": sha256_bytes((candidate / f"{args.country.lower()}.ndjson").read_bytes()) == index["profile_bundle_sha256"],
    }
    if not all(checks.values()):
        raise RuntimeError("Candidate validation failed: " + canonical_json(checks))
    source_selection = read_json(raw / "source-selection.json")
    completed = {
        "schema_version": "1.0.0",
        "dataset": "municipal-publication",
        "country_code": args.country,
        "processing_status": "succeeded",
        "publication_status": "not_requested",
        "run_id": args.run_id,
        "cloud_build_id": args.run_id,
        "loader_git_sha": args.loader_git_sha,
        "region": REGION,
        "service_account": SERVICE_ACCOUNT,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "title": config["source_title"],
            "url": config["source_url"],
            "warehouse_table": WAREHOUSE_TABLE,
            "selection_sha256": sha256_bytes((raw / "source-selection.json").read_bytes()),
            "lineage": read_json(raw / "lineage.json")["selections"],
        },
        "counts": {
            "received_rows": int(coverage["received_rows"]),
            "accepted_rows": int(coverage["accepted_detail_rows"]),
            "rejected_rows": int(coverage["received_rows"]) - int(coverage["accepted_detail_rows"]),
            "deduplicated_rows": 0,
            "received_profiles": int(directory["entity_count"]),
            "accepted_profiles": len(profiles),
            "rejected_profiles": len(rejected),
        },
        "coverage": {
            "first_year": int(coverage["first_year"]),
            "latest_year": int(coverage["latest_year"]),
            "distinct_item_codes": int(coverage["distinct_item_codes"]),
        },
        "validation": {"status": "passed", "checks": checks},
        "destinations": {
            "raw": f"{PRIVATE_ROOT}/{args.run_id}/raw/",
            "candidate": f"{PRIVATE_ROOT}/{args.run_id}/candidate/",
            "completed_receipt": f"{PRIVATE_ROOT}/{args.run_id}/completed.json",
            "public_release": None,
            "publication_pointer": PUBLIC_POINTER,
            "intended_website": [f"/municipalities/{config['slug']}/", f"/municipalities/{config['slug']}/<municipality-slug>-<code>/"],
        },
        "artifacts": {
            "profile_bundle": {"path": f"candidate/{args.country.lower()}.ndjson", "sha256": index["profile_bundle_sha256"]},
            "country_index": {"path": "candidate/country-index.json", "sha256": sha256_bytes((candidate / "country-index.json").read_bytes())},
            "proof_page": {"path": "candidate/proof.html", "sha256": sha256_bytes((candidate / "proof.html").read_bytes())},
        },
    }
    write_json(work / "completed.json", completed)
    print(json.dumps({"run_id": args.run_id, "country": args.country, "profiles": len(profiles), "status": "candidate_validated"}))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("extract", "build", "validate"))
    parser.add_argument("--country", choices=tuple(COUNTRIES), required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--loader-git-sha", required=True)
    parser.add_argument("--work", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    {"extract": extract, "build": build, "validate": validate}[args.command](args)


if __name__ == "__main__":
    main()
