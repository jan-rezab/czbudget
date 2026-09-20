#!/usr/bin/env python3
"""Inventory Hlídač contract coverage for PSD's Top-100 Czech municipalities."""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import random
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request


PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
TABLE = "hlidac_municipality_contract_inventory"
API_URL = "https://api.hlidacstatu.cz/api/v2/smlouvy/hledat"
BUCKET = "gs://czbudget-janrezab-data-layers"
SCOPE_PATH = Path("pipeline/config/czech-hlidac-municipalities.v1.json")
MIN_INTERVAL_SECONDS = 0.5


def run(command: list[str], *, input_text: str | None = None) -> str:
    completed = subprocess.run(
        command,
        input=input_text,
        text=True,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if completed.stdout:
        print(completed.stdout, end="", flush=True)
    return completed.stdout


def first(mapping: dict, *names: str):
    for name in names:
        if name in mapping:
            return mapping[name]
    return None


def fetch_inventory(token: str, query: str, retries: int = 8) -> dict:
    url = API_URL + "?" + urllib.parse.urlencode(
        {"dotaz": query, "strana": 1, "razeni": 1}
    )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Token {token}",
            "User-Agent": "PublicSpendingData/municipality-inventory (+https://publicspendingdata.org)",
        },
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == retries - 1:
                raise
            delay = float(error.headers.get("Retry-After", 0) or 0)
        except (TimeoutError, urllib.error.URLError):
            if attempt == retries - 1:
                raise
            delay = 0
        time.sleep(max(delay, min(60.0, 2.0**attempt)) + random.uniform(0.1, 0.5))
    raise RuntimeError("Hlídač inventory request failed")


def latest_published(results: list[dict]) -> str | None:
    candidates = [
        first(item, "casZverejneni", "CasZverejneni", "published_at", "PublishedAt")
        for item in results
    ]
    return max((value for value in candidates if value), default=None)


def main() -> None:
    build_id = os.environ.get("BUILD_ID", "").strip()
    token = os.environ.get("HLIDACSTATU_API_TOKEN", "").strip()
    if not build_id:
        raise RuntimeError("Cloud Build only")
    if not token:
        raise RuntimeError("HLIDACSTATU_API_TOKEN was not injected")
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    municipalities = scope["municipalities"]
    if len(municipalities) != 100:
        raise ValueError(f"expected 100 municipalities, got {len(municipalities)}")

    started_at = dt.datetime.now(dt.timezone.utc)
    rows = []
    for index, municipality in enumerate(municipalities):
        if index:
            time.sleep(MIN_INTERVAL_SECONDS)
        payload = fetch_inventory(token, municipality["hlidac_query"])
        results = first(payload, "results", "Results") or []
        total = int(first(payload, "total", "Total") or 0)
        rows.append(
            {
                "municipality_rank": municipality["rank"],
                "municipality_ico": municipality["ico"],
                "municipality_name": municipality["name"],
                "population": municipality["population"],
                "query": municipality["hlidac_query"],
                "matching_contracts": total,
                "latest_published_at": latest_published(results),
                "sampled_contracts": len(results),
                "inventory_run_id": build_id,
                "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "source_url": API_URL,
                "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
            }
        )
        print(
            f"[{index + 1:03d}/100] {municipality['name']}: {total:,} contracts",
            flush=True,
        )

    completed_at = dt.datetime.now(dt.timezone.utc)
    receipt = {
        "schema_version": "1.0.0",
        "status": "complete",
        "inventory_run_id": build_id,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "source": {
            "name": "Hlídač státu API v2",
            "url": API_URL,
            "license": "CC BY 3.0",
            "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
        },
        "selection": scope["selection"],
        "summary": {
            "municipalities_checked": len(rows),
            "sum_matching_contracts_non_deduplicated": sum(
                item["matching_contracts"] for item in rows
            ),
            "largest_contract_count": max(
                rows, key=lambda item: item["matching_contracts"]
            ),
        },
        "municipalities": rows,
    }
    Path("inventory.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with Path("inventory.jsonl").open("w", encoding="utf-8") as target:
        for row in rows:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")

    prefix = f"{BUCKET}/processing-runs/czech-hlidac-municipalities/{build_id}"
    inventory_uri = f"{prefix}/inventory.json"
    run(["gcloud", "storage", "cp", "--no-clobber", "inventory.json", inventory_uri])
    schema = f"""
    CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.{TABLE}` (
      municipality_rank INT64 NOT NULL,
      municipality_ico STRING NOT NULL,
      municipality_name STRING NOT NULL,
      population INT64 NOT NULL,
      query STRING NOT NULL,
      matching_contracts INT64 NOT NULL,
      latest_published_at TIMESTAMP,
      sampled_contracts INT64 NOT NULL,
      inventory_run_id STRING NOT NULL,
      checked_at TIMESTAMP NOT NULL,
      source_url STRING NOT NULL,
      attribution STRING NOT NULL
    )
    CLUSTER BY municipality_ico
    OPTIONS(description = 'Current Top-100 municipality contract coverage metadata from the Hlídač státu API; not a contract corpus.');
    """
    run(
        ["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"],
        input_text=schema,
    )
    staging = f"{PROJECT}:{DATASET}.hlidac_inventory_{build_id.replace('-', '_')}"
    staging_schema = (
        "municipality_rank:INTEGER,municipality_ico:STRING,municipality_name:STRING,"
        "population:INTEGER,query:STRING,matching_contracts:INTEGER,"
        "latest_published_at:TIMESTAMP,sampled_contracts:INTEGER,"
        "inventory_run_id:STRING,checked_at:TIMESTAMP,source_url:STRING,attribution:STRING"
    )
    run(
        [
            "bq", "--project_id=" + PROJECT, "load", "--replace", "--quiet",
            "--source_format=NEWLINE_DELIMITED_JSON", staging, "inventory.jsonl",
            staging_schema,
        ]
    )
    staging_ref = staging.replace(":", ".")
    run(
        ["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"],
        input_text=f"""
        BEGIN TRANSACTION;
        DELETE FROM `{PROJECT}.{DATASET}.{TABLE}` WHERE TRUE;
        INSERT INTO `{PROJECT}.{DATASET}.{TABLE}` (
          municipality_rank, municipality_ico, municipality_name, population, query,
          matching_contracts, latest_published_at, sampled_contracts, inventory_run_id,
          checked_at, source_url, attribution
        )
        SELECT
          municipality_rank, municipality_ico, municipality_name, population, query,
          matching_contracts, latest_published_at, sampled_contracts, inventory_run_id,
          checked_at, source_url, attribution
        FROM `{staging_ref}`;
        COMMIT TRANSACTION;
        """,
    )
    run(["bq", "--project_id=" + PROJECT, "rm", "-f", "-t", staging])
    run(["gcloud", "storage", "cp", "--no-clobber", "inventory.json", f"{prefix}/completed.json"])
    print(json.dumps(receipt["summary"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
