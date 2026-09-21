#!/usr/bin/env python3
"""Acquire, validate, stage and atomically publish Top-100 municipality contracts."""
from __future__ import annotations

from datetime import date, datetime, timezone
import gzip
import hashlib
import json
import math
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
    first,
    write_payload,
)


PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
BUCKET = "gs://czbudget-janrezab-data-layers"
CAMPAIGN = "top100-2025-07-01-v2"
SCOPE_PATH = Path("pipeline/config/czech-hlidac-municipalities.v1.json")
HISTORY_START = date(2016, 7, 1)
HISTORY_END = date(2026, 9, 20)  # Pin the campaign snapshot across bounded builds.
LEGACY_SNAPSHOT_BUILD_ID = "628f5121-6622-4dab-a99b-47fb1f3f8dd5"
REGION = "europe-west4"
SERVICE_ACCOUNT = "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
WAREHOUSE_SCHEMA = (
    "municipality_rank:INTEGER,municipality_ico:STRING,municipality_name:STRING,"
    "contract_id:STRING,subject:STRING,signed_at:STRING,published_at:STRING,"
    "value_czk:FLOAT,source_url:STRING,contract_json:STRING,source_name:STRING,"
    "source_query:STRING,license:STRING,attribution:STRING,ingestion_run_id:STRING,"
    "loaded_at:TIMESTAMP"
)
WAREHOUSE_COLUMNS = (
    "municipality_rank, municipality_ico, municipality_name, contract_id, subject, "
    "signed_at, published_at, value_czk, source_url, contract_json, source_name, "
    "source_query, license, attribution, ingestion_run_id, loaded_at"
)


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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def upload_immutable(path: Path, uri: str) -> dict:
    digest = sha256_file(path)
    size = path.stat().st_size
    run(
        [
            "gcloud", "storage", "cp", str(path), uri,
            "--if-generation-match=0",
        ]
    )
    generation = run(
        ["gcloud", "storage", "objects", "describe", uri, "--format=value(generation)"]
    ).strip()
    if not generation:
        raise ValueError(f"missing object generation for {uri}")
    return {"uri": uri, "generation": generation, "sha256": digest, "bytes": size}


def existing_completion(prefix: str, end_date: date) -> dict | None:
    completed = subprocess.run(
        ["gcloud", "storage", "ls", f"{prefix}/attempts/*/completed.json"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if completed.returncode != 0 or not completed.stdout.strip():
        return None
    for uri in sorted(completed.stdout.splitlines(), reverse=True):
        receipt = json.loads(run(["gcloud", "storage", "cat", uri]))
        if (
            receipt.get("schema_version") != "2.0.0"
            or receipt.get("campaign") != CAMPAIGN
            or receipt.get("processing_status") != "complete"
            or any(
                key not in receipt
                for key in (
                    "municipality_ico",
                    "normalized_total",
                    "raw_object",
                    "normalized_object",
                    "warehouse_object",
                    "validation",
                )
            )
        ):
            raise ValueError(f"invalid prior municipality receipt: {uri}")
        if receipt.get("history_end") == end_date.isoformat() or (
            end_date == HISTORY_END
            and receipt.get("ingestion_run_id") == LEGACY_SNAPSHOT_BUILD_ID
        ):
            return receipt
    return None


def write_warehouse_rows(
    path: Path,
    municipality: dict,
    contracts: list[dict],
    build_id: str,
    loaded_at: str,
) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as target:
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
                        "contract_json": json.dumps(
                            contract, ensure_ascii=False, separators=(",", ":")
                        ),
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


def acquire_municipality(
    municipality: dict,
    token: str,
    build_id: str,
    end_date: date,
    work: Path,
    campaign_prefix: str,
) -> dict:
    ico = municipality["ico"]
    municipality_prefix = f"{campaign_prefix}/municipalities/{ico}"
    previous = existing_completion(municipality_prefix, end_date)
    if previous:
        print(
            f"[{municipality['rank']:03d}/100] {municipality['name']}: "
            f"reuse {previous['normalized_total']:,}",
            flush=True,
        )
        return previous

    started_at = datetime.now(timezone.utc).isoformat()
    checkpoint = work / f"{ico}.checkpoint.jsonl"
    raw_path = work / f"{ico}.raw-pages.jsonl.gz"
    normalized_path = work / f"{ico}.contracts.full.v2.json.gz"
    warehouse_path = work / f"{ico}.warehouse.ndjson.gz"
    accounting = {
        "source_reported_total": 0,
        "rows_received": 0,
        "rows_accepted": 0,
        "rows_rejected": 0,
    }

    with gzip.open(raw_path, "wt", encoding="utf-8") as raw_target:
        def observe_page(window_start: date, window_end: date, page: int, payload: dict) -> None:
            results = first(payload, "results", "Results") or []
            if page == 1:
                accounting["source_reported_total"] += int(
                    first(payload, "total", "Total") or len(results)
                )
            accounting["rows_received"] += len(results)
            for item in results:
                if first(item, "id", "Id"):
                    accounting["rows_accepted"] += 1
                else:
                    accounting["rows_rejected"] += 1
            raw_target.write(
                json.dumps(
                    {
                        "window_start": window_start.isoformat(),
                        "window_end": window_end.isoformat(),
                        "page": page,
                        "response": payload,
                    },
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                + "\n"
            )

        contracts, requests_made, windows_completed = fetch_full_history(
            token,
            ico,
            HISTORY_START,
            end_date,
            checkpoint,
            page_observer=observe_page,
        )

    normalized_total = len(contracts)
    deduplicated = accounting["rows_accepted"] - normalized_total
    if normalized_total != len({str(item.get("id")) for item in contracts}):
        raise ValueError(f"normalized IDs are not unique for {ico}")
    if accounting["rows_received"] != (
        accounting["rows_accepted"] + accounting["rows_rejected"]
    ):
        raise ValueError(f"row accounting failed for {ico}")
    if deduplicated < 0:
        raise ValueError(f"negative deduplication count for {ico}")
    drift = abs(accounting["source_reported_total"] - accounting["rows_received"])
    allowed_drift = max(25, math.ceil(accounting["source_reported_total"] * 0.001))
    if drift > allowed_drift:
        raise ValueError(
            f"live-source pagination drift too large for {ico}: {drift} > {allowed_drift}"
        )

    payload = {
        "schema_version": "2.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "Hlídač státu API v2",
            "url": API_URL,
            "query": municipality["hlidac_query"],
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
            **accounting,
            "rows_deduplicated": deduplicated,
            "normalized_total": normalized_total,
            "requests_this_run": requests_made,
            "date_windows": windows_completed,
            "history_start": HISTORY_START.isoformat(),
            "history_end": end_date.isoformat(),
        },
        "contracts": contracts,
    }
    enrich_payload(payload, None)
    payload["schema_version"] = "2.0.0"
    loaded_at = datetime.now(timezone.utc).isoformat()
    write_payload(normalized_path, payload)
    write_warehouse_rows(warehouse_path, municipality, contracts, build_id, loaded_at)

    attempt_prefix = f"{municipality_prefix}/attempts/{build_id}"
    raw_object = upload_immutable(raw_path, f"{attempt_prefix}/raw-pages.jsonl.gz")
    normalized_object = upload_immutable(
        normalized_path, f"{attempt_prefix}/contracts.full.v2.json.gz"
    )
    warehouse_object = upload_immutable(
        warehouse_path, f"{attempt_prefix}/warehouse.ndjson.gz"
    )
    receipt = {
        "schema_version": "2.0.0",
        "campaign": CAMPAIGN,
        "processing_status": "complete",
        "publication_status": "not_published_individually",
        "ingestion_run_id": build_id,
        "municipality_rank": municipality["rank"],
        "municipality_ico": ico,
        "municipality_name": municipality["name"],
        "source_query": municipality["hlidac_query"],
        **accounting,
        "rows_deduplicated": deduplicated,
        "normalized_total": normalized_total,
        "requests_this_run": requests_made,
        "date_windows": windows_completed,
        "history_end": end_date.isoformat(),
        "started_at": started_at,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "raw_object": raw_object,
        "normalized_object": normalized_object,
        "warehouse_object": warehouse_object,
        "validation": {
            "row_accounting": "passed",
            "unique_contract_ids_within_municipality": "passed",
            "source_pagination_drift": drift,
            "allowed_source_pagination_drift": allowed_drift,
        },
        "license": "CC BY 3.0",
        "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
    }
    receipt_path = work / f"{ico}.completed.json"
    receipt_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    receipt["receipt_object"] = upload_immutable(
        receipt_path, f"{attempt_prefix}/completed.json"
    )
    for path in (checkpoint, raw_path, normalized_path, warehouse_path, receipt_path):
        path.unlink(missing_ok=True)
    print(
        f"[{municipality['rank']:03d}/100] {municipality['name']}: "
        f"{normalized_total:,} normalized, {requests_made:,} requests",
        flush=True,
    )
    return receipt


def load_release_stage(completions: list[dict], build_id: str) -> tuple[str, dict]:
    safe_build = build_id.replace("-", "_")
    stage = f"{PROJECT}:{DATASET}.hlidac_top100_stage_{safe_build}"
    for index, completion in enumerate(completions):
        command = [
            "bq", "--project_id=" + PROJECT, "load", "--quiet",
            "--source_format=NEWLINE_DELIMITED_JSON",
        ]
        if index == 0:
            command.append("--replace")
        command.extend([stage, completion["warehouse_object"]["uri"], WAREHOUSE_SCHEMA])
        run(command)
    run(["bq", "--project_id=" + PROJECT, "update", "--expiration", "172800", stage])
    stage_ref = stage.replace(":", ".")
    expected = sum(int(item["normalized_total"]) for item in completions)
    validation = bq_query(
        f"""
        SELECT
          COUNT(*) AS row_count,
          COUNT(DISTINCT municipality_ico) AS municipality_count,
          COUNT(*) - COUNT(DISTINCT TO_JSON_STRING(STRUCT(municipality_ico, contract_id)))
            AS duplicate_keys,
          COUNTIF(municipality_ico IS NULL OR contract_id IS NULL OR contract_json IS NULL)
            AS null_required
        FROM `{stage_ref}`
        """
    )[0]
    if (
        int(validation["row_count"]) != expected
        or int(validation["municipality_count"]) != 100
        or int(validation["duplicate_keys"]) != 0
        or int(validation["null_required"]) != 0
    ):
        raise ValueError(f"release staging validation failed: {validation}, expected={expected}")
    per_city = bq_query(
        f"""
        SELECT municipality_ico, COUNT(*) AS row_count
        FROM `{stage_ref}`
        GROUP BY municipality_ico
        """
    )
    actual = {item["municipality_ico"]: int(item["row_count"]) for item in per_city}
    expected_by_city = {
        item["municipality_ico"]: int(item["normalized_total"]) for item in completions
    }
    if actual != expected_by_city:
        raise ValueError("per-municipality staging reconciliation failed")
    return stage_ref, validation


def create_release_table(
    stage_ref: str, build_id: str, expected_rows: int
) -> tuple[str, dict]:
    safe_build = build_id.replace("-", "_")
    release_table = f"{PROJECT}.{DATASET}.hlidac_top100_release_{safe_build}"
    run(
        ["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"],
        input_text=f"""
        CREATE TABLE `{release_table}`
        CLUSTER BY municipality_ico, contract_id
        OPTIONS(description = 'Immutable validated Top-100 Czech municipality Hlídač contract release {build_id}.')
        AS SELECT {WAREHOUSE_COLUMNS} FROM `{stage_ref}`;
        """,
    )
    final = bq_query(
        f"""
        SELECT COUNT(*) AS row_count,
               COUNT(DISTINCT municipality_ico) AS municipality_count,
               COUNT(*) - COUNT(DISTINCT TO_JSON_STRING(STRUCT(municipality_ico, contract_id)))
                 AS duplicate_keys
        FROM `{release_table}`
        """
    )[0]
    if (
        int(final["row_count"]) != expected_rows
        or int(final["municipality_count"]) != 100
        or int(final["duplicate_keys"]) != 0
    ):
        raise ValueError(
            f"immutable release validation failed: {final}, expected={expected_rows}"
        )
    return release_table, final


def read_pointer(pointer_uri: str) -> tuple[dict | None, str]:
    described = subprocess.run(
        [
            "gcloud", "storage", "objects", "describe", pointer_uri,
            "--format=value(generation)",
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if described.returncode != 0 or not described.stdout.strip():
        return None, "0"
    generation = described.stdout.strip()
    return json.loads(run(["gcloud", "storage", "cat", pointer_uri])), generation


def commit_validated_release(
    work: Path,
    pointer: dict,
    receipt: dict,
    validated_object: dict,
    previous_generation: str,
    completion_uri: str,
    pointer_uri: str,
) -> dict:
    """Put the required immutable receipt in place before the pointer CAS."""
    receipt["completed_at"] = datetime.now(timezone.utc).isoformat()
    receipt["validated_object"] = validated_object
    receipt["previous_pointer_generation"] = previous_generation
    completed_path = work / "completed.json"
    completed_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    completed_object = upload_immutable(completed_path, completion_uri)
    pointer["required_completion_sha256"] = completed_object["sha256"]
    pointer["required_completion_generation"] = completed_object["generation"]
    pointer["publication_status"] = "published_data_plane"
    pointer_path = work / "current.json"
    pointer_path.write_text(
        json.dumps(pointer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    run(
        [
            "gcloud", "storage", "cp", str(pointer_path), pointer_uri,
            "--if-generation-match=" + previous_generation,
        ]
    )
    return completed_object


def acquire_bounded_batch(
    municipalities: list[dict],
    token: str,
    build_id: str,
    end_date: date,
    work: Path,
    campaign_prefix: str,
    max_new: int,
) -> tuple[list[dict], list[str], int]:
    completions: list[dict] = []
    remaining: list[str] = []
    newly_processed = 0
    for municipality in municipalities:
        prefix = f"{campaign_prefix}/municipalities/{municipality['ico']}"
        previous = existing_completion(prefix, end_date)
        if previous:
            completions.append(previous)
        elif newly_processed < max_new:
            completions.append(
                acquire_municipality(
                    municipality, token, build_id, end_date, work, campaign_prefix
                )
            )
            newly_processed += 1
        else:
            remaining.append(municipality["ico"])
    return completions, remaining, newly_processed


def main() -> None:
    build_id = os.environ.get("BUILD_ID", "").strip()
    loader_git_sha = os.environ.get("LOADER_GIT_SHA", "").strip()
    token = os.environ.get("HLIDACSTATU_API_TOKEN", "").strip()
    if not build_id:
        raise RuntimeError("Cloud Build only")
    if not loader_git_sha:
        raise RuntimeError("LOADER_GIT_SHA is required")
    if not token:
        raise RuntimeError("HLIDACSTATU_API_TOKEN was not injected")
    max_new = int(os.environ.get("MAX_MUNICIPALITIES", "1"))
    if not 1 <= max_new <= 3:
        raise ValueError("MAX_MUNICIPALITIES must be between 1 and 3")

    started_at = datetime.now(timezone.utc).isoformat()
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    municipalities = scope["municipalities"]
    if len(municipalities) != 100:
        raise ValueError(f"expected 100 municipalities, got {len(municipalities)}")
    campaign_prefix = (
        f"{BUCKET}/processing-runs/czech-hlidac-municipality-contracts/{CAMPAIGN}"
    )
    release_prefix = f"{campaign_prefix}/releases/{build_id}"
    pointer_uri = f"{campaign_prefix}/current.json"
    work = Path("/workspace/hlidac-top100")
    work.mkdir(parents=True, exist_ok=True)
    end_date = HISTORY_END
    completions, remaining, newly_processed = acquire_bounded_batch(
        municipalities, token, build_id, end_date, work, campaign_prefix, max_new
    )
    if remaining:
        progress = {
            "schema_version": "1.0.0",
            "dataset": "czech-hlidac-top100-contracts",
            "campaign": CAMPAIGN,
            "processing_status": "partial",
            "publication_status": "not_published",
            "cloud_build_id": build_id,
            "loader_git_sha": loader_git_sha,
            "service_account": SERVICE_ACCOUNT,
            "region": REGION,
            "history_end": end_date.isoformat(),
            "completed_municipalities": len(completions),
            "newly_processed_municipalities": newly_processed,
            "remaining_municipality_icos": remaining,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        progress_path = work / "partial.json"
        progress_path.write_text(
            json.dumps(progress, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        upload_immutable(
            progress_path, f"{campaign_prefix}/runs/{build_id}/partial.json"
        )
        print(json.dumps(progress, ensure_ascii=False), flush=True)
        return

    stage_ref, staging_validation = load_release_stage(completions, build_id)
    totals = {
        "rows_received": sum(int(item["rows_received"]) for item in completions),
        "rows_accepted": sum(int(item["rows_accepted"]) for item in completions),
        "rows_rejected": sum(int(item["rows_rejected"]) for item in completions),
        "rows_deduplicated": sum(int(item["rows_deduplicated"]) for item in completions),
        "normalized_total": sum(int(item["normalized_total"]) for item in completions),
        "source_reported_total": sum(
            int(item["source_reported_total"]) for item in completions
        ),
        "requests_this_run": sum(int(item["requests_this_run"]) for item in completions),
    }
    if totals["rows_accepted"] != (
        totals["normalized_total"] + totals["rows_deduplicated"]
    ):
        raise ValueError("release row accounting failed")
    release_table, release_validation = create_release_table(
        stage_ref, build_id, totals["normalized_total"]
    )

    previous_pointer, previous_generation = read_pointer(pointer_uri)
    completion_uri = f"{release_prefix}/completed.json"
    pointer = {
        "schema_version": "1.0.0",
        "dataset": "czech-hlidac-top100-contracts",
        "release_id": build_id,
        "release_table": release_table,
        "validated_receipt_uri": f"{release_prefix}/validated.json",
        "required_completion_uri": completion_uri,
        "previous": (
            {
                "release_id": previous_pointer.get("release_id"),
                "release_table": previous_pointer.get("release_table"),
                "required_completion_uri": previous_pointer.get("required_completion_uri"),
                "pointer_generation": previous_generation,
            }
            if previous_pointer
            else None
        ),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    receipt = {
        "schema_version": "2.0.0",
        "dataset": "czech-hlidac-top100-contracts",
        "source": {
            "name": "Hlídač státu API v2",
            "url": API_URL,
            "query_template": (
                "icoPlatce:{municipality_ico} AND "
                "zverejneno:[{history_start} TO {history_end}]"
            ),
            "license": "CC BY 3.0",
            "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
        },
        "processing_status": "complete",
        "publication_status": "validated_not_yet_current",
        "release_id": build_id,
        "loader_git_sha": loader_git_sha,
        "cloud_build_id": build_id,
        "service_account": SERVICE_ACCOUNT,
        "region": REGION,
        "started_at": started_at,
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "scope": scope["selection"],
        "scope_manifest": {
            "path": str(SCOPE_PATH),
            "sha256": sha256_file(SCOPE_PATH),
        },
        "coverage": {
            "municipalities": 100,
            "history_start": HISTORY_START.isoformat(),
            "history_end": end_date.isoformat(),
        },
        "totals": totals,
        "raw_objects": [item["raw_object"] for item in completions],
        "normalized_objects": [item["normalized_object"] for item in completions],
        "warehouse_objects": [item["warehouse_object"] for item in completions],
        "municipality_results": [
            {
                key: item[key]
                for key in (
                    "municipality_rank",
                    "municipality_ico",
                    "municipality_name",
                    "source_query",
                    "source_reported_total",
                    "rows_received",
                    "rows_accepted",
                    "rows_rejected",
                    "rows_deduplicated",
                    "normalized_total",
                    "requests_this_run",
                    "date_windows",
                    "started_at",
                    "completed_at",
                    "raw_object",
                    "normalized_object",
                    "warehouse_object",
                    "validation",
                )
            }
            for item in completions
        ],
        "staging_destination": stage_ref,
        "release_table": release_table,
        "validation": {
            "municipality_receipts": 100,
            "staging": staging_validation,
            "release": release_validation,
            "row_accounting": "passed",
            "per_municipality_reconciliation": "passed",
            "required_fields": "passed",
            "unique_municipality_contract_keys": "passed",
        },
        "publication_pointer": pointer_uri,
        "website_destinations": [],
        "website_destination_status": "not_connected; data publication does not deploy the website",
        "planned_consumers_not_published": [
            "publicspendingdata.org municipality profiles for the selected Top-100",
            "publicspendingdata.org/deep-dives/plzen-contracts/",
        ],
    }
    validated_path = work / "validated.json"
    validated_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    validated_object = upload_immutable(
        validated_path, f"{release_prefix}/validated.json"
    )
    pointer["validated_receipt_generation"] = validated_object["generation"]
    completed_object = commit_validated_release(
        work, pointer, receipt, validated_object, previous_generation,
        completion_uri, pointer_uri,
    )
    print(
        json.dumps(
            {
                "processing_status": "complete",
                "publication_status": "published",
                "release_id": build_id,
                "completion": completed_object,
                **totals,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
