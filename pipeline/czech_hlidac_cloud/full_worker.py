#!/usr/bin/env python3
"""Load complete Hlídač contract histories for the 100 largest Czech municipalities."""
from __future__ import annotations

from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pipeline.transforms.fetch_hlidac_contracts import (
    API_URL,
    enrich_payload,
    fetch_full_history,
    write_payload,
)


PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
TABLE = "hlidac_municipality_contract_matches"
BUCKET = "gs://czbudget-janrezab-data-layers"
CAMPAIGN = "top100-2025-07-01-v1"
SCOPE_PATH = Path("pipeline/config/czech-hlidac-municipalities.v1.json")
HISTORY_START = date(2016, 7, 1)


def run(
    command: list[str],
    *,
    input_text: str | None = None,
    capture: bool = True,
) -> str:
    completed = subprocess.run(
        command,
        input=input_text,
        text=True,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )
    if capture and completed.stdout:
        print(completed.stdout, end="", flush=True)
    return completed.stdout or ""


def bq_query(sql: str) -> list[dict]:
    output = subprocess.check_output(
        [
            "bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false",
            "--format=json", "--quiet", sql,
        ],
        text=True,
    )
    return json.loads(output or "[]")


def sql_string(value: object) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def existing_completion(prefix: str) -> dict | None:
    completed = subprocess.run(
        ["gcloud", "storage", "ls", f"{prefix}/attempts/*/completed.json"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if completed.returncode != 0 or not completed.stdout.strip():
        return None
    uri = sorted(completed.stdout.splitlines())[-1]
    return json.loads(run(["gcloud", "storage", "cat", uri]))


def create_warehouse() -> None:
    run(
        ["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"],
        input_text=f"""
        CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.{TABLE}` (
          municipality_rank INT64 NOT NULL,
          municipality_ico STRING NOT NULL,
          municipality_name STRING NOT NULL,
          contract_id STRING NOT NULL,
          subject STRING,
          signed_at STRING,
          published_at STRING,
          value_czk FLOAT64,
          source_url STRING,
          contract_json STRING NOT NULL,
          source_name STRING NOT NULL,
          source_query STRING NOT NULL,
          license STRING NOT NULL,
          attribution STRING NOT NULL,
          ingestion_run_id STRING NOT NULL,
          loaded_at TIMESTAMP NOT NULL
        )
        CLUSTER BY municipality_ico, contract_id
        OPTIONS(description = 'Municipality-to-contract matches loaded from Hlídač státu; contract IDs can repeat across municipalities and must be deduplicated for unique totals.');
        """,
    )


def load_municipality(
    municipality: dict,
    contracts: list[dict],
    build_id: str,
    ndjson_path: Path,
) -> dict:
    loaded_at = datetime.now(timezone.utc).isoformat()
    with ndjson_path.open("w", encoding="utf-8") as target:
        for contract in contracts:
            contract_id = contract.get("id")
            if not contract_id:
                raise ValueError(f"contract without ID for {municipality['ico']}")
            target.write(
                json.dumps(
                    {
                        "municipality_rank": municipality["rank"],
                        "municipality_ico": municipality["ico"],
                        "municipality_name": municipality["name"],
                        "contract_id": str(contract_id),
                        "subject": contract.get("subject"),
                        "signed_at": contract.get("signed_at"),
                        "published_at": contract.get("published_at"),
                        "value_czk": contract.get("value_czk"),
                        "source_url": contract.get("source_url"),
                        "contract_json": json.dumps(contract, ensure_ascii=False, separators=(",", ":")),
                        "source_name": "Hlídač státu API v2",
                        "source_query": municipality["hlidac_query"],
                        "license": "CC BY 3.0",
                        "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
                        "ingestion_run_id": build_id,
                        "loaded_at": loaded_at,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    safe_build = build_id.replace("-", "_")
    staging = f"{PROJECT}:{DATASET}.hlidac_{municipality['ico']}_{safe_build}"
    schema = (
        "municipality_rank:INTEGER,municipality_ico:STRING,municipality_name:STRING,"
        "contract_id:STRING,subject:STRING,signed_at:STRING,published_at:STRING,"
        "value_czk:FLOAT,source_url:STRING,contract_json:STRING,source_name:STRING,"
        "source_query:STRING,license:STRING,attribution:STRING,ingestion_run_id:STRING,"
        "loaded_at:TIMESTAMP"
    )
    run(
        [
            "bq", "--project_id=" + PROJECT, "load", "--replace", "--quiet",
            "--source_format=NEWLINE_DELIMITED_JSON", staging, str(ndjson_path), schema,
        ]
    )
    run(["bq", "--project_id=" + PROJECT, "update", "--expiration", "86400", staging])
    staging_ref = staging.replace(":", ".")
    ico_sql = sql_string(municipality["ico"])
    run(
        ["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"],
        input_text=f"""
        BEGIN TRANSACTION;
        DELETE FROM `{PROJECT}.{DATASET}.{TABLE}` WHERE municipality_ico = {ico_sql};
        INSERT INTO `{PROJECT}.{DATASET}.{TABLE}`
        SELECT * FROM `{staging_ref}`;
        COMMIT TRANSACTION;
        """,
    )
    result = bq_query(
        f"""
        SELECT COUNT(*) AS row_count, COUNT(DISTINCT contract_id) AS contract_count
        FROM `{PROJECT}.{DATASET}.{TABLE}`
        WHERE municipality_ico = {ico_sql}
        """
    )[0]
    if int(result["row_count"]) != len(contracts) or int(result["contract_count"]) != len(contracts):
        raise ValueError(f"warehouse reconciliation failed for {municipality['ico']}: {result}")
    run(["bq", "--project_id=" + PROJECT, "rm", "-f", "-t", staging])
    return result


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
    create_warehouse()
    campaign_prefix = (
        f"{BUCKET}/processing-runs/czech-hlidac-municipality-contracts/{CAMPAIGN}"
    )
    work = Path("/workspace/hlidac-top100")
    work.mkdir(parents=True, exist_ok=True)
    completed = []
    total_requests = 0
    total_contract_matches = 0
    end_date = date.today()

    for municipality in municipalities:
        ico = municipality["ico"]
        municipality_prefix = f"{campaign_prefix}/municipalities/{ico}"
        previous = existing_completion(municipality_prefix)
        if previous:
            completed.append(previous)
            total_contract_matches += int(previous["contract_count"])
            print(
                f"[{municipality['rank']:03d}/100] {municipality['name']}: "
                f"already complete ({previous['contract_count']:,})",
                flush=True,
            )
            continue

        checkpoint = work / f"{ico}.checkpoint.jsonl"
        contracts, requests_made, windows_completed = fetch_full_history(
            token, ico, HISTORY_START, end_date, checkpoint
        )
        if len({str(item.get("id")) for item in contracts}) != len(contracts):
            raise ValueError(f"deduplication failed for {ico}")
        with checkpoint.open(encoding="utf-8") as checkpoint_handle:
            pages_fetched = sum(1 for _ in checkpoint_handle)
        payload = {
            "schema_version": "1.1.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": {
                "name": "Hlídač státu API v2",
                "url": API_URL,
                "query": municipality["hlidac_query"],
                "sort": "newest_published_first",
                "license": "CC BY 3.0",
                "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
            },
            "entity": {
                "country_code": "CZE",
                "ico": ico,
                "name": municipality["name"],
                "population_rank": municipality["rank"],
            },
            "summary": {
                "matching_contracts": len(contracts),
                "downloaded_contracts": len(contracts),
                "pages_fetched": pages_fetched,
                "requests_this_run": requests_made,
                "date_windows": windows_completed,
                "history_start": HISTORY_START.isoformat(),
                "history_end": end_date.isoformat(),
            },
            "contracts": contracts,
        }
        enrich_payload(payload, None)
        gzip_path = work / f"{ico}.full.v1.json.gz"
        ndjson_path = work / f"{ico}.warehouse.jsonl"
        write_payload(gzip_path, payload)
        attempt_prefix = f"{municipality_prefix}/attempts/{build_id}"
        contracts_uri = f"{attempt_prefix}/contracts.full.v1.json.gz"
        run(["gcloud", "storage", "cp", "--no-clobber", str(gzip_path), contracts_uri])
        warehouse = load_municipality(municipality, contracts, build_id, ndjson_path)
        completion = {
            "schema_version": "1.0.0",
            "status": "complete",
            "campaign": CAMPAIGN,
            "ingestion_run_id": build_id,
            "municipality_rank": municipality["rank"],
            "municipality_ico": ico,
            "municipality_name": municipality["name"],
            "contract_count": len(contracts),
            "requests_this_run": requests_made,
            "date_windows": windows_completed,
            "contracts_uri": contracts_uri,
            "warehouse_table": f"{PROJECT}.{DATASET}.{TABLE}",
            "warehouse": warehouse,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "license": "CC BY 3.0",
            "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
        }
        completion_path = work / f"{ico}.completed.json"
        completion_path.write_text(
            json.dumps(completion, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        run(
            [
                "gcloud", "storage", "cp", "--no-clobber", str(completion_path),
                f"{attempt_prefix}/completed.json",
            ]
        )
        completed.append(completion)
        total_requests += requests_made
        total_contract_matches += len(contracts)
        checkpoint.unlink(missing_ok=True)
        gzip_path.unlink(missing_ok=True)
        ndjson_path.unlink(missing_ok=True)
        print(
            f"[{municipality['rank']:03d}/100] {municipality['name']}: "
            f"complete, {len(contracts):,} contracts, {requests_made:,} requests",
            flush=True,
        )

    receipt = {
        "schema_version": "1.0.0",
        "status": "complete",
        "campaign": CAMPAIGN,
        "ingestion_run_id": build_id,
        "municipalities_complete": len(completed),
        "contract_matches_non_deduplicated": total_contract_matches,
        "requests_this_run": total_requests,
        "warehouse_table": f"{PROJECT}.{DATASET}.{TABLE}",
        "scope": scope["selection"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "municipalities": completed,
    }
    receipt_path = work / "completed.json"
    receipt_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    run(
        [
            "gcloud", "storage", "cp", "--no-clobber", str(receipt_path),
            f"{campaign_prefix}/runs/{build_id}/completed.json",
        ]
    )
    print(json.dumps({key: receipt[key] for key in (
        "municipalities_complete", "contract_matches_non_deduplicated", "requests_this_run"
    )}), flush=True)


if __name__ == "__main__":
    main()
