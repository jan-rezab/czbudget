#!/usr/bin/env python3
"""Publish one verified year of ILOSTAT service employment through the data plane."""

from __future__ import annotations

import argparse
import csv
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


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        details = (result.stderr + "\n" + result.stdout).strip()
        raise RuntimeError(f"Command failed ({result.returncode}): {args[0]} {args[1]}; {details}")
    return result.stdout.strip()


def fetch(url: str) -> bytes:
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "PSD-job-market-loader/1.0", "Accept": "text/csv"})
            with urllib.request.urlopen(request, timeout=45) as response:
                if "csv" not in response.headers.get("Content-Type", ""):
                    raise ValueError("ILOSTAT did not return CSV")
                return response.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def normalize(payload: bytes, manifest: dict) -> tuple[list[dict], dict]:
    source_rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
    countries = set(manifest["countries"])
    sections = set(manifest["service_sections"])
    year = str(manifest["year"])
    out: list[dict] = []
    coverage: dict[str, set[str]] = {country: set() for country in countries}
    notes: dict[str, set[str]] = {country: set() for country in countries}
    unreliable: dict[str, list[str]] = {country: [] for country in countries}
    for item in source_rows:
        if item["REF_AREA"] not in countries or item["TIME_PERIOD"] != year:
            raise ValueError("Unexpected country or year in ILOSTAT response")
        if item["SEX"] != "SEX_T":
            continue
        code = item["EC2"]
        if not code.startswith("EC2_ISIC4_"):
            continue
        division = code.removeprefix("EC2_ISIC4_")
        if not division or division[0] not in sections:
            continue
        if (item["FREQ"], item["MEASURE"], item["UNIT_MEASURE"], item["UNIT_MULT"]) != (
            "A", "EMP_TEMP_NB", "PS", "3"
        ):
            raise ValueError(f"Unexpected measure or unit for {item['REF_AREA']} {division}")
        if item["OBS_STATUS"] not in ("", "A", "U"):
            raise ValueError(f"Unrecognized observation status: {item['REF_AREA']} {division}")
        if not item["OBS_VALUE"]:
            raise ValueError(f"Missing service observation: {item['REF_AREA']} {division}")
        value = float(item["OBS_VALUE"])
        if not 0 <= value < 1_000_000:
            raise ValueError(f"Invalid service observation: {item['REF_AREA']} {division}")
        country = item["REF_AREA"]
        if division in coverage[country]:
            raise ValueError(f"Duplicate service division: {country} {division}")
        coverage[country].add(division)
        notes[country].add(item["NOTE_SOURCE"])
        if item["OBS_STATUS"] == "U":
            unreliable[country].append(division)
        out.append({
            "country_code": country, "period": manifest["year"],
            "isic_section": division[0], "isic_division": division,
            "persons_thousands": value, "obs_status": item["OBS_STATUS"],
            "source_name": item["SOURCE"],
            "source_note": item["NOTE_SOURCE"], "source_url": manifest["source_url"],
        })
    expected = manifest["expected_divisions_per_country"]
    code_sets = list(coverage.values())
    if any(len(codes) != expected for codes in code_sets) or any(codes != code_sets[0] for codes in code_sets):
        raise ValueError("Service-division coverage is incomplete or differs across countries")
    if len(out) != len(countries) * expected:
        raise ValueError("Incorrect normalized row count")
    if any({row["isic_section"] for row in out if row["country_code"] == country} != sections for country in countries):
        raise ValueError("Missing service section")
    out.sort(key=lambda row: (row["country_code"], row["isic_division"]))
    summary = {"received_rows": len(source_rows), "accepted_rows": len(out),
               "excluded_rows": len(source_rows) - len(out), "rejected_rows": 0,
               "deduplicated_rows": 0,
               "country_coverage": {country: {"divisions": len(coverage[country]),
                                               "sections": len(sections),
                                               "unreliable_divisions": sorted(unreliable[country]),
                                               "source_notes": sorted(notes[country])}
                                    for country in sorted(countries)}}
    return out, summary


def upload_immutable(path: Path, uri: str) -> None:
    existing = subprocess.run(["gcloud", "storage", "cat", uri], capture_output=True, timeout=60)
    if existing.returncode == 0:
        if hashlib.sha256(existing.stdout).digest() != hashlib.sha256(path.read_bytes()).digest():
            raise ValueError(f"Immutable object differs: {uri}")
        return
    run("gcloud", "storage", "cp", "--if-generation-match=0", str(path), uri)


def bq_query(sql: str) -> str:
    return run("bq", "--project_id=" + PROJECT, "--location=EU", "query",
               "--use_legacy_sql=false", "--format=csv", sql)


def publish(rows_uri: str, release_id: str, row_count: int, countries: int) -> None:
    stage = f"{DATASET}.job_market_service_stage"
    target = f"{DATASET}.job_market_service_observations"
    pointer = f"{DATASET}.job_market_service_release_pointer"
    bq_query(f"TRUNCATE TABLE `{stage}`")
    run("bq", "--project_id=" + PROJECT, "--location=EU", "load",
        "--source_format=NEWLINE_DELIMITED_JSON",
        f"{PROJECT}:job_market.job_market_service_stage", rows_uri)
    check = bq_query(f"SELECT COUNT(*) AS n, COUNT(DISTINCT country_code) AS c, "
                     f"COUNT(DISTINCT CONCAT(country_code, ':', isic_division)) AS keys "
                     f"FROM `{stage}`")
    values = [int(value) for value in check.splitlines()[-1].split(",")]
    if values != [row_count, countries, row_count]:
        raise ValueError(f"BigQuery staging validation failed: {check}")
    bq_query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}` WHERE release_id = '{release_id}';
      INSERT INTO `{target}`
      SELECT '{release_id}', country_code, period, isic_section, isic_division,
             persons_thousands, obs_status, source_name, source_note, source_url, CURRENT_TIMESTAMP()
      FROM `{stage}`;
      DELETE FROM `{pointer}` WHERE dataset_id = 'job_market_services';
      INSERT INTO `{pointer}` VALUES
        ('job_market_services', '{release_id}', 2024, CURRENT_TIMESTAMP());
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
    work = Path("/workspace/job-market-services-2024")
    work.mkdir(parents=True, exist_ok=True)
    payload = fetch(manifest["source_url"])
    raw = work / "ilostat-2024.csv"
    raw.write_bytes(payload)
    raw_uri = prefix + "/raw/ilostat-2024.csv"
    upload_immutable(raw, raw_uri)
    rows, summary = normalize(payload, manifest)
    staged = work / "normalized.jsonl"
    staged.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))
    stage_uri = prefix + "/staging/normalized.jsonl"
    upload_immutable(staged, stage_uri)
    publish(stage_uri, args.build_id, len(rows), len(manifest["countries"]))
    receipt = {"dataset_id": manifest["dataset_id"], "period": manifest["year"],
               "status": "published", "processing_status": "succeeded",
               "publication_status": "succeeded", "build_id": args.build_id,
               "loader_git_sha": args.loader_sha, "region": "europe-west4",
               "service_account": "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com",
               "started_at": started_at, "completed_at": datetime.now(timezone.utc).isoformat(),
               "source_url": manifest["source_url"], "source_id": manifest["source_id"],
               "source_sha256": hashlib.sha256(payload).hexdigest(), "raw_destination": raw_uri,
               "staging_destination": stage_uri,
               "normalized_sha256": hashlib.sha256(staged.read_bytes()).hexdigest(),
               **summary,
               "validation": {"common_isic_rev4_divisions": True,
                              "complete_service_sections": True,
                              "bigquery_staging_rows": len(rows)},
               "published_release_id": args.build_id,
               "warehouse_destination": manifest["observations_table"],
               "publication_pointer": manifest["publication_pointer"],
               "website_destinations": []}
    receipt_path = work / "completed.json"
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    upload_immutable(receipt_path, prefix + "/completed.json")
    print(json.dumps({"release_id": args.build_id, "rows": len(rows),
                      "receipt": prefix + "/completed.json"}))


if __name__ == "__main__":
    main()
