#!/usr/bin/env python3
"""Publish source-specific Czech and German public-employment totals for 2024."""

from __future__ import annotations

import argparse
from decimal import Decimal
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
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
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
            if b"<!doctype html" not in payload[:1000].lower():
                raise ValueError("Unexpected official HTML response")
            return payload
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


class TableRows(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_row = False
        self.in_cell = False
        self.cells: list[str] = []
        self.parts: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "tr":
            self.in_row = True
            self.cells = []
        elif tag in ("td", "th") and self.in_row:
            self.in_cell = True
            self.parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self.in_cell:
            self.cells.append(" ".join("".join(self.parts).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            self.rows.append(self.cells)
            self.in_row = False

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.parts.append(data)


def html_rows(payload: bytes) -> list[list[str]]:
    parser = TableRows()
    parser.feed(payload.decode("utf-8", "replace"))
    return parser.rows


def one(rows: list[list[str]], label: str) -> list[str]:
    matches = [row for row in rows if row and row[0] == label]
    if len(matches) != 1:
        raise ValueError(f"Expected one official row for {label}, got {len(matches)}")
    return matches[0]


def normalize(payloads: dict[str, bytes], manifest: dict) -> list[dict]:
    cz = html_rows(payloads["czech_public_account"])
    de_public = html_rows(payloads["german_public_employers"])
    de_total = html_rows(payloads["german_total_employment"])
    if not any(row[1:] == [str(year) for year in range(2015, 2025)] for row in cz):
        raise ValueError("Czech 2015–2024 header is missing")
    if one(de_total, "Persons in employment/employees")[1:3] != ["2025", "2024"]:
        raise ValueError("German annual employment year order changed")
    if len(one(de_public, "Total")) != 7:
        raise ValueError("German public-employer columns changed")
    observations = [
        ("CZE", "total_economy_fte", one(cz, "Total economy")[-1], "FTE_jobs", "2024 annual; domestic employment", "czech_public_account"),
        ("CZE", "public_sector_fte", one(cz, "Public sector")[-1], "FTE_jobs", "2024 annual; government-controlled units", "czech_public_account"),
        ("CZE", "general_government_fte", one(cz, "General government")[-1], "FTE_jobs", "2024 annual; ESA S.13", "czech_public_account"),
        ("CZE", "reported_public_sector_share", one(cz, "Public sector / total economy employment (%)")[-1], "percent", "2024 annual; FTE share", "czech_public_account"),
        ("DEU", "public_service_persons", one(de_public, "Total")[1], "thousand_persons", "30 June 2024 snapshot", "german_public_employers"),
        ("DEU", "majority_public_private_law_entities_persons", one(de_public, "Total")[5], "thousand_persons", "30 June 2024 snapshot; private legal form", "german_public_employers"),
        ("DEU", "public_employers_total_persons", one(de_public, "Total")[6], "thousand_persons", "30 June 2024 snapshot", "german_public_employers"),
        ("DEU", "total_employed_persons", one(de_total, "Persons in employment")[2], "thousand_persons", "2024 annual average; domestic concept", "german_total_employment"),
    ]
    out = []
    for country, metric, raw, unit, basis, source in observations:
        number = Decimal(raw.replace(",", ""))
        if not number.is_finite() or number <= 0:
            raise ValueError(f"Invalid national source value: {country} {metric}")
        out.append({"country_code": country, "period": manifest["year"],
                    "metric": metric, "source_value": raw, "value": float(number),
                    "unit": unit, "reference_basis": basis,
                    "source_url": manifest["sources"][source]})
    values = {r["metric"]: Decimal(r["source_value"].replace(",", "")) for r in out}
    if abs(values["public_sector_fte"] / values["total_economy_fte"] * 100 -
           values["reported_public_sector_share"]) > Decimal("0.05"):
        raise ValueError("Czech public-sector FTE share does not reconcile")
    if abs(values["public_service_persons"] + values["majority_public_private_law_entities_persons"] -
           values["public_employers_total_persons"]) > Decimal("0.001"):
        raise ValueError("German public-employer components do not reconcile")
    return out


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


def publish(uri: str, release_id: str, row_count: int) -> None:
    stage = f"{DATASET}.national_public_employment_stage"
    target = f"{DATASET}.national_public_employment_observations"
    pointer = f"{DATASET}.national_public_employment_release_pointer"
    bq_query(f"TRUNCATE TABLE `{stage}`")
    run("bq", "--project_id=" + PROJECT, "--location=EU", "load",
        "--source_format=NEWLINE_DELIMITED_JSON",
        f"{PROJECT}:job_market.national_public_employment_stage", uri)
    check = bq_query(f"SELECT COUNT(*) AS n, COUNT(DISTINCT CONCAT(country_code, ':', metric)) AS keys FROM `{stage}`")
    if [int(x) for x in check.splitlines()[-1].split(",")] != [row_count, row_count]:
        raise ValueError(f"National staging validation failed: {check}")
    bq_query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}` WHERE release_id = '{release_id}';
      INSERT INTO `{target}`
      SELECT '{release_id}', country_code, period, metric, source_value, value,
             unit, reference_basis, source_url, CURRENT_TIMESTAMP() FROM `{stage}`;
      DELETE FROM `{pointer}` WHERE dataset_id = 'job_market_national_public';
      INSERT INTO `{pointer}` VALUES
        ('job_market_national_public', '{release_id}', 2024, CURRENT_TIMESTAMP());
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
    work = Path("/workspace/job-market-national-public-2024")
    work.mkdir(parents=True, exist_ok=True)
    payloads = {}
    sources = {}
    for name, url in manifest["sources"].items():
        payload = fetch(url)
        payloads[name] = payload
        raw = work / f"{name}.html"
        raw.write_bytes(payload)
        uri = prefix + f"/raw/{name}.html"
        upload_immutable(raw, uri)
        sources[name] = {"url": url, "sha256": hashlib.sha256(payload).hexdigest(),
                         "raw_destination": uri, "received_bytes": len(payload)}
    rows = normalize(payloads, manifest)
    staged = work / "normalized.jsonl"
    staged.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))
    staged_uri = prefix + "/staging/normalized.jsonl"
    upload_immutable(staged, staged_uri)
    publish(staged_uri, args.build_id, len(rows))
    receipt = {"dataset_id": manifest["dataset_id"], "period": manifest["year"],
               "status": "published", "processing_status": "succeeded",
               "publication_status": "succeeded", "build_id": args.build_id,
               "loader_git_sha": args.loader_sha, "region": "europe-west4",
               "service_account": ACCOUNT, "started_at": started_at,
               "completed_at": datetime.now(timezone.utc).isoformat(),
               "sources": sources, "received_rows": 8, "accepted_rows": len(rows),
               "excluded_rows": 0, "rejected_rows": 0, "deduplicated_rows": 0,
               "source_values": {r["country_code"] + ":" + r["metric"]: r["source_value"] for r in rows},
               "staging_destination": staged_uri,
               "normalized_sha256": hashlib.sha256(staged.read_bytes()).hexdigest(),
               "validation": {"source_table_headers": True,
                              "czech_share_reconciles": True,
                              "german_components_reconcile": True,
                              "bigquery_staging_rows": len(rows)},
               "published_release_id": args.build_id,
               "warehouse_destination": manifest["observations_table"],
               "publication_pointer": manifest["publication_pointer"],
               "website_destinations": []}
    completed = work / "completed.json"
    completed.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    upload_immutable(completed, prefix + "/completed.json")
    print(json.dumps({"release_id": args.build_id, "rows": len(rows),
                      "receipt": prefix + "/completed.json"}))


if __name__ == "__main__":
    main()
