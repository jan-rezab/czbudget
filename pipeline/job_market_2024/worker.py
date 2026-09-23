#!/usr/bin/env python3
"""Load one immutable 2024 ILO/WDI sector-share release in the data plane."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = "czbudget-janrezab"
DATASET = f"{PROJECT}.job_market"
SOURCE_ID = "world_bank_ilo_modelled"


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        details = (result.stderr + "\n" + result.stdout).strip()
        raise RuntimeError(f"Command failed ({result.returncode}): {args[0]} {args[1]}; {details}")
    return result.stdout.strip()


def source_url(countries: list[str], indicator: str, period: int) -> str:
    codes = ";".join(countries)
    return (
        f"https://api.worldbank.org/v2/country/{codes}/indicator/{indicator}"
        f"?date={period}&format=json&per_page=100"
    )


def fetch(url: str) -> bytes:
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "PSD-job-market-loader/1.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def parse_rows(payload: bytes, indicator: str, sector: str, countries: list[str], period: int, url: str) -> list[dict]:
    document = json.loads(payload, parse_float=Decimal)
    if not isinstance(document, list) or len(document) != 2 or not isinstance(document[1], list):
        raise ValueError(f"Unexpected World Bank response for {indicator}")
    rows = []
    for item in document[1]:
        country = item.get("countryiso3code")
        if country not in countries or item.get("date") != str(period) or item.get("indicator", {}).get("id") != indicator:
            raise ValueError(f"Unexpected source row: {item}")
        value = item.get("value")
        if not isinstance(value, (int, Decimal)) or not 0 <= value <= 100:
            raise ValueError(f"Missing or invalid {sector} share for {country}")
        rows.append({"country_code": country, "period": period, "sector": sector,
                     "share_pct": float(value), "source_value": str(value),
                     "source_id": SOURCE_ID, "source_url": url})
    if len(rows) != len(countries) or {row["country_code"] for row in rows} != set(countries):
        raise ValueError(f"Incomplete {sector} coverage")
    return rows


def validate(rows: list[dict], countries: list[str], sectors: list[str]) -> None:
    if len(rows) != len(countries) * len(sectors):
        raise ValueError("Incorrect accepted row count")
    for country in countries:
        subset = [row for row in rows if row["country_code"] == country]
        if {row["sector"] for row in subset} != set(sectors):
            raise ValueError(f"Incomplete or duplicate sectors for {country}")
        if abs(sum(row["share_pct"] for row in subset) - 100) > 0.02:
            raise ValueError(f"Sector shares do not sum to 100 for {country}")


def upload_immutable(path: Path, uri: str) -> None:
    try:
        existing = subprocess.run(["gcloud", "storage", "cat", uri], capture_output=True, timeout=60)
        if existing.returncode == 0:
            if hashlib.sha256(existing.stdout).digest() != hashlib.sha256(path.read_bytes()).digest():
                raise ValueError(f"Immutable object differs: {uri}")
            return
        run("gcloud", "storage", "cp", "--if-generation-match=0", str(path), uri)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"Cannot upload immutable object {uri}: {error.stderr}") from error


def bq_query(sql: str) -> str:
    return run("bq", "--project_id=" + PROJECT, "--location=EU", "query",
               "--use_legacy_sql=false", "--format=csv", sql)


def publish_to_bigquery(rows_uri: str, release_id: str, row_count: int) -> None:
    stage = f"{DATASET}.job_market_2024_stage"
    stage_cli = f"{PROJECT}:job_market.job_market_2024_stage"
    target = f"{DATASET}.job_market_employment_shares"
    pointer = f"{DATASET}.job_market_release_pointer"
    bq_query(f"TRUNCATE TABLE `{stage}`")
    run("bq", "--project_id=" + PROJECT, "--location=EU", "load",
        "--source_format=NEWLINE_DELIMITED_JSON", stage_cli, rows_uri)
    check = bq_query(f"SELECT COUNT(*) AS n, COUNT(DISTINCT country_code) AS c, "
                     f"COUNT(DISTINCT CONCAT(country_code, ':', sector)) AS keys "
                     f"FROM `{stage}`")
    values = check.splitlines()[-1].split(",")
    if [int(value) for value in values] != [row_count, row_count // 3, row_count]:
        raise ValueError(f"BigQuery staging validation failed: {check}")
    bq_query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}` WHERE release_id = '{release_id}';
      INSERT INTO `{target}`
      SELECT '{release_id}', country_code, period, sector, share_pct, source_value, source_id,
             source_url, CURRENT_TIMESTAMP() FROM `{stage}`;
      DELETE FROM `{pointer}` WHERE dataset_id = 'job_market_employment_shares';
      INSERT INTO `{pointer}` VALUES
        ('job_market_employment_shares', '{release_id}', 2024, CURRENT_TIMESTAMP());
      COMMIT TRANSACTION;
    """)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-id", required=True)
    parser.add_argument("--loader-sha", required=True)
    args = parser.parse_args()
    manifest = json.loads(Path("manifest.json").read_text())
    started_at = datetime.now(timezone.utc).isoformat()
    countries = manifest["countries"]
    period = manifest["period"]
    prefix = manifest["raw_prefix"].rstrip("/") + "/" + args.build_id
    work = Path("/workspace/job-market-2024")
    work.mkdir(parents=True, exist_ok=True)
    rows = []
    source_receipts = []
    for indicator, sector in manifest["indicators"].items():
        url = source_url(countries, indicator, period)
        payload = fetch(url)
        path = work / f"{indicator}.json"
        path.write_bytes(payload)
        raw_uri = f"{prefix}/raw/{indicator}.json"
        upload_immutable(path, raw_uri)
        parsed = parse_rows(payload, indicator, sector, countries, period, url)
        rows.extend(parsed)
        source_receipts.append({"url": url, "raw_uri": raw_uri,
                                "sha256": hashlib.sha256(payload).hexdigest(),
                                "received_rows": len(parsed), "accepted_rows": len(parsed),
                                "rejected_rows": 0, "deduplicated_rows": 0})
    validate(rows, countries, list(manifest["indicators"].values()))
    rows.sort(key=lambda row: (row["country_code"], row["sector"]))
    staged = work / "normalized.jsonl"
    staged.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))
    rows_uri = f"{prefix}/staging/normalized.jsonl"
    upload_immutable(staged, rows_uri)
    publish_to_bigquery(rows_uri, args.build_id, len(rows))
    receipt = {"dataset_id": manifest["dataset_id"], "period": period,
               "status": "published", "processing_status": "succeeded",
               "publication_status": "succeeded", "build_id": args.build_id,
               "started_at": started_at, "completed_at": datetime.now(timezone.utc).isoformat(),
               "loader_git_sha": args.loader_sha, "service_account":
               "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com",
               "region": "europe-west4", "sources": source_receipts,
               "raw_destination": prefix + "/raw/", "staging_destination": rows_uri,
               "normalized_sha256": hashlib.sha256(staged.read_bytes()).hexdigest(),
               "received_rows": len(rows), "accepted_rows": len(rows),
               "rejected_rows": 0, "deduplicated_rows": 0,
               "country_count": len(countries), "sectors": list(manifest["indicators"].values()),
               "source_totals": {country: {row["sector"]: row["source_value"]
                                          for row in rows if row["country_code"] == country}
                                 for country in countries},
               "validation": {"complete_country_sector_grid": True, "sector_shares_sum_to_100": True,
                              "bigquery_staging_row_count": len(rows)},
               "published_release_id": args.build_id,
               "warehouse_destination": f"{DATASET}.job_market_employment_shares",
               "publication_pointer": manifest["publication_pointer"],
               "website_destinations": []}
    receipt_path = work / "completed.json"
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    upload_immutable(receipt_path, prefix + "/completed.json")
    print(json.dumps({"release_id": args.build_id, "rows": len(rows), "receipt": prefix + "/completed.json"}))


if __name__ == "__main__":
    main()
