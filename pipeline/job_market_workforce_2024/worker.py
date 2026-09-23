#!/usr/bin/env python3
"""Load 2024 ILO employer ownership and labour-force status as one release."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = "czbudget-janrezab"
DATASET = f"{PROJECT}.job_market"
ACCOUNT = "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError(f"{args[0]} {args[1]} failed: {(result.stderr + result.stdout).strip()}")
    return result.stdout.strip()


def fetch(url: str) -> bytes:
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "PSD-job-market-loader/1.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
            if not payload.startswith(b'\xef\xbb\xbf"ref_area","source","indicator"'):
                raise ValueError("Unexpected ILOSTAT CSV response")
            return payload
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def upload_immutable(path: Path, uri: str) -> None:
    existing = subprocess.run(["gcloud", "storage", "cat", uri], capture_output=True, timeout=60)
    if existing.returncode == 0:
        if hashlib.sha256(existing.stdout).digest() != hashlib.sha256(path.read_bytes()).digest():
            raise ValueError(f"Immutable object differs: {uri}")
        return
    run("gcloud", "storage", "cp", "--if-generation-match=0", str(path), uri)


def source_url(manifest: dict, indicator: str) -> str:
    countries = "+".join(manifest["countries"])
    year = manifest["year"]
    return (f'{manifest["source_base"]}?id={indicator}&ref_area={countries}'
            f'&timefrom={year}&timeto={year}')


def parse_source(payload: bytes, indicator: str, manifest: dict) -> list[dict]:
    rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
    if not rows:
        raise ValueError(f"Empty ILOSTAT source: {indicator}")
    for row in rows:
        if (row["indicator"], row["time"]) != (indicator, str(manifest["year"])):
            raise ValueError(f"Unexpected indicator or period in {indicator}")
        if row["ref_area"] not in manifest["countries"]:
            raise ValueError(f"Unexpected country in {indicator}")
    return rows


def observation(row: dict, common: dict) -> dict:
    raw = row["obs_value"]
    if not raw:
        raise ValueError("Missing source observation")
    number = Decimal(raw)
    if not number.is_finite() or number < 0:
        raise ValueError("Invalid source observation")
    if row["obs_status"] not in ("", "A", "U"):
        raise ValueError(f"Unknown observation status: {row['obs_status']}")
    return {**common, "source_value": raw, "obs_status": row["obs_status"],
            "source_code": row["source"], "source_note": row["note_source"]}


def normalize_ownership(rows: list[dict], url: str, manifest: dict) -> list[dict]:
    allowed = set(manifest["service_sections"])
    sectors = {"INS_SECTOR_TOTAL": "total", "INS_SECTOR_PUB": "public",
               "INS_SECTOR_PRI": "private"}
    out: list[dict] = []
    keys: set[tuple[str, str, str]] = set()
    for row in rows:
        if row["sex"] != "SEX_T":
            continue
        code = row["classif1"]
        if code == "ECO_SECTOR_TOTAL":
            section = "TOTAL"
        elif code.startswith("ECO_ISIC4_") and code.removeprefix("ECO_ISIC4_") in allowed:
            section = code.removeprefix("ECO_ISIC4_")
        else:
            continue
        if row["classif2"] not in sectors:
            continue
        country = row["ref_area"]
        if country not in manifest["ownership_countries"]:
            raise ValueError(f"Unexpected ownership observation for {country}")
        sector = sectors[row["classif2"]]
        key = (country, section, sector)
        if key in keys:
            raise ValueError(f"Duplicate ownership observation: {key}")
        keys.add(key)
        value = observation(row, {
            "country_code": country, "period": manifest["year"],
            "isic_section": section, "employer_sector": sector,
            "persons_thousands": float(Decimal(row["obs_value"])), "source_url": url,
        })
        out.append(value)
    expected = {(country, section, sector)
                for country in manifest["ownership_countries"]
                for section in ["TOTAL", *manifest["service_sections"]]
                for sector in sectors.values()}
    expected.remove(("POL", "O", "private"))  # Not published; public equals total.
    if keys != expected:
        raise ValueError(f"Ownership coverage differs: missing={sorted(expected - keys)}, extra={sorted(keys - expected)}")
    lookup = {(r["country_code"], r["isic_section"], r["employer_sector"]): Decimal(r["source_value"])
              for r in out}
    for country in manifest["ownership_countries"]:
        for section in ["TOTAL", *manifest["service_sections"]]:
            total = lookup[(country, section, "total")]
            public = lookup[(country, section, "public")]
            private = lookup.get((country, section, "private"), Decimal(0))
            if abs(total - public - private) > Decimal("0.002"):
                raise ValueError(f"Public/private total does not reconcile: {country} {section}")
    return sorted(out, key=lambda r: (r["country_code"], r["isic_section"], r["employer_sector"]))


def normalize_labour(sources: dict[str, tuple[list[dict], str]], manifest: dict) -> list[dict]:
    out: list[dict] = []
    keys: set[tuple[str, str]] = set()
    source_codes: dict[str, set[str]] = {country: set() for country in manifest["countries"]}
    for metric, (rows, url) in sources.items():
        indicator = manifest["source_indicators"][metric]
        unit = "percent" if metric == "unemployment_rate" else "thousand_persons"
        for row in rows:
            if row["sex"] != "SEX_T" or row["classif1"] != "AGE_YTHADULT_YGE15":
                continue
            country = row["ref_area"]
            key = (country, metric)
            if key in keys:
                raise ValueError(f"Duplicate labour observation: {key}")
            keys.add(key)
            source_codes[country].add(row["source"])
            out.append(observation(row, {
                "country_code": country, "period": manifest["year"], "metric": metric,
                "value": float(Decimal(row["obs_value"])), "unit": unit,
                "age_group": "15+ classification; USA survey minimum 16",
                "source_url": url,
            }))
    expected = {(country, metric) for country in manifest["countries"] for metric in sources}
    if keys != expected or any(len(codes) != 1 for codes in source_codes.values()):
        raise ValueError(f"Labour coverage/source mismatch: missing={sorted(expected - keys)}")
    values = {(r["country_code"], r["metric"]): Decimal(r["source_value"]) for r in out}
    for country in manifest["countries"]:
        employed = values[(country, "employed")]
        unemployed = values[(country, "unemployed")]
        labour_force = values[(country, "labour_force")]
        outside = values[(country, "outside_labour_force")]
        rate = values[(country, "unemployment_rate")]
        if abs(employed + unemployed - labour_force) > Decimal("0.01"):
            raise ValueError(f"Labour-force count does not reconcile: {country}")
        if abs(unemployed / labour_force * 100 - rate) > Decimal("0.01"):
            raise ValueError(f"Unemployment rate does not reconcile: {country}")
        if outside <= 0:
            raise ValueError(f"Outside-labour-force count is invalid: {country}")
    return sorted(out, key=lambda r: (r["country_code"], r["metric"]))


def bq_query(sql: str) -> str:
    return run("bq", "--project_id=" + PROJECT, "--location=EU", "query",
               "--use_legacy_sql=false", "--format=csv", sql)


def stage(uri: str, table: str, count: int, unique_expr: str) -> None:
    bq_query(f"TRUNCATE TABLE `{DATASET}.{table}`")
    run("bq", "--project_id=" + PROJECT, "--location=EU", "load",
        "--source_format=NEWLINE_DELIMITED_JSON",
        f"{PROJECT}:job_market.{table}", uri)
    result = bq_query(f"SELECT COUNT(*) AS n, COUNT(DISTINCT {unique_expr}) AS keys FROM `{DATASET}.{table}`")
    observed = [int(v) for v in result.splitlines()[-1].split(",")]
    if observed != [count, count]:
        raise ValueError(f"BigQuery staging validation failed for {table}: {result}")


def publish(release_id: str) -> None:
    own = f"{DATASET}.job_market_ownership_observations"
    labour = f"{DATASET}.job_market_labour_status_observations"
    pointer = f"{DATASET}.job_market_workforce_release_pointer"
    bq_query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{own}` WHERE release_id = '{release_id}';
      INSERT INTO `{own}`
      SELECT '{release_id}', country_code, period, isic_section, employer_sector,
             persons_thousands, source_value, obs_status, source_code, source_note,
             source_url, CURRENT_TIMESTAMP()
      FROM `{DATASET}.job_market_ownership_stage`;
      DELETE FROM `{labour}` WHERE release_id = '{release_id}';
      INSERT INTO `{labour}`
      SELECT '{release_id}', country_code, period, metric, value, unit,
             source_value, age_group, obs_status, source_code, source_note,
             source_url, CURRENT_TIMESTAMP()
      FROM `{DATASET}.job_market_labour_status_stage`;
      DELETE FROM `{pointer}` WHERE dataset_id = 'job_market_workforce';
      INSERT INTO `{pointer}` VALUES
        ('job_market_workforce', '{release_id}', 2024, CURRENT_TIMESTAMP());
      COMMIT TRANSACTION;
    """)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-id", required=True)
    parser.add_argument("--loader-sha", required=True)
    args = parser.parse_args()
    manifest = json.loads(Path("manifest.json").read_text())
    started_at = datetime.now(timezone.utc).isoformat()
    prefix = manifest["release_prefix"].rstrip("/") + "/" + args.build_id
    work = Path("/workspace/job-market-workforce-2024")
    work.mkdir(parents=True, exist_ok=True)
    source_rows: dict[str, tuple[list[dict], str]] = {}
    source_receipt: dict[str, dict] = {}
    for name, indicator in manifest["source_indicators"].items():
        url = source_url(manifest, indicator)
        payload = fetch(url)
        raw = work / f"{name}.csv"
        raw.write_bytes(payload)
        raw_uri = prefix + f"/raw/{name}.csv"
        upload_immutable(raw, raw_uri)
        rows = parse_source(payload, indicator, manifest)
        source_rows[name] = (rows, url)
        source_receipt[name] = {"indicator": indicator, "url": url,
                                "sha256": hashlib.sha256(payload).hexdigest(),
                                "raw_destination": raw_uri, "received_rows": len(rows)}
    ownership = normalize_ownership(*source_rows["ownership"], manifest)
    labour = normalize_labour({k: v for k, v in source_rows.items() if k != "ownership"}, manifest)
    staged: dict[str, dict] = {}
    for name, rows in (("ownership", ownership), ("labour", labour)):
        path = work / f"{name}.jsonl"
        path.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))
        uri = prefix + f"/staging/{name}.jsonl"
        upload_immutable(path, uri)
        staged[name] = {"uri": uri, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "accepted_rows": len(rows)}
    stage(staged["ownership"]["uri"], "job_market_ownership_stage", len(ownership),
          "CONCAT(country_code, ':', isic_section, ':', employer_sector)")
    stage(staged["labour"]["uri"], "job_market_labour_status_stage", len(labour),
          "CONCAT(country_code, ':', metric)")
    publish(args.build_id)
    totals = {country: {metric: next(r["source_value"] for r in labour
                               if r["country_code"] == country and r["metric"] == metric)
                       for metric in manifest["source_indicators"] if metric != "ownership"}
              for country in manifest["countries"]}
    receipt = {"dataset_id": manifest["dataset_id"], "period": manifest["year"],
               "status": "published", "processing_status": "succeeded",
               "publication_status": "succeeded", "build_id": args.build_id,
               "loader_git_sha": args.loader_sha, "region": "europe-west4",
               "service_account": ACCOUNT, "started_at": started_at,
               "completed_at": datetime.now(timezone.utc).isoformat(),
               "sources": source_receipt, "staging": staged,
               "received_rows": sum(item["received_rows"] for item in source_receipt.values()),
               "accepted_rows": len(ownership) + len(labour),
               "excluded_rows": sum(item["received_rows"] for item in source_receipt.values()) - len(ownership) - len(labour),
               "rejected_rows": 0, "deduplicated_rows": 0,
               "source_totals": totals,
               "coverage": {"ownership_countries": manifest["ownership_countries"],
                            "labour_countries": manifest["countries"],
                            "ownership_rows": len(ownership), "labour_rows": len(labour),
                            "missing_ownership": ["CZE", "DEU"],
                            "missing_poland_O_private": True},
               "validation": {"ownership_totals_reconcile": True,
                              "labour_force_totals_reconcile": True,
                              "unemployment_rates_reconcile": True,
                              "bigquery_staging_validated": True},
               "published_release_id": args.build_id,
               "warehouse_destinations": [manifest["ownership_observations"],
                                          manifest["labour_observations"]],
               "publication_pointer": manifest["publication_pointer"],
               "website_destinations": []}
    completed = work / "completed.json"
    completed.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    upload_immutable(completed, prefix + "/completed.json")
    print(json.dumps({"release_id": args.build_id, "ownership_rows": len(ownership),
                      "labour_rows": len(labour), "receipt": prefix + "/completed.json"}))


if __name__ == "__main__":
    main()
