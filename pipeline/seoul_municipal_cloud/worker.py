#!/usr/bin/env python3
"""Fetch and normalize Seoul's official project-level budget/execution API."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request


BUCKET_ROOT = "gs://czbudget-janrezab-data-layers/processing-runs/seoul-project-budget"
USER_AGENT = "PublicSpendingData/1.0 (official-budget-ingestion)"


def load_contract(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    source = value["source"]
    if source["page_size"] > 1000:
        raise ValueError("Seoul API pages cannot exceed 1,000 rows")
    if value["entity"]["coverage_label"] != "anchor_legal_government_only":
        raise ValueError("Seoul must not be labelled as full-agglomeration coverage")
    return value


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def api_url(contract: dict, key: str, service_name: str, start: int, end: int) -> str:
    if not key or "/" in key or not service_name or "/" in service_name:
        raise ValueError("invalid Seoul API credential or service name")
    base = contract["source"]["api_base_url"].rstrip("/")
    parts = [key, "json", service_name, str(start), str(end)]
    return base + "/" + "/".join(urllib.parse.quote(part, safe="") for part in parts)


def response_rows(payload: object, service_name: str) -> tuple[int, list[dict]]:
    if not isinstance(payload, dict):
        raise ValueError("Seoul API response must be an object")
    if payload.get("RESULT"):
        result = payload["RESULT"]
        raise ValueError(f"Seoul API error {result.get('CODE')}: {result.get('MESSAGE')}")
    body = payload.get(service_name)
    if not isinstance(body, dict):
        candidates = [value for value in payload.values() if isinstance(value, dict) and "row" in value]
        if len(candidates) != 1:
            raise ValueError("Seoul API response does not contain the configured service object")
        body = candidates[0]
    result = body.get("RESULT", {})
    if result and result.get("CODE") not in {None, "INFO-000"}:
        raise ValueError(f"Seoul API error {result.get('CODE')}: {result.get('MESSAGE')}")
    rows = body.get("row", [])
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Seoul API row payload is invalid")
    return int(body.get("list_total_count", len(rows))), rows


def first(row: dict, aliases: list[str], required: bool = False):
    for key in aliases:
        if key in row and row[key] not in (None, ""):
            return row[key]
    if required:
        raise ValueError(f"required field absent; expected one of {aliases}")
    return None


def amount(value) -> str | None:
    if value in (None, ""):
        return None
    cleaned = str(value).replace(",", "").strip()
    try:
        return format(Decimal(cleaned), "f")
    except InvalidOperation as error:
        raise ValueError(f"invalid monetary amount {value!r}") from error


def normalize(row: dict, contract: dict, source_row_number: int, retrieved_at: str) -> list[dict]:
    fields = contract["retained_fields"]
    year = first(row, fields["fiscal_year"], required=True)
    project = first(row, fields["project_name"], required=True)
    dimensions = {
        "account_name": first(row, fields["account_name"]),
        "department_name": first(row, fields["department_name"]),
        "project_name": project,
        "project_type": first(row, fields["project_type"]),
        "function_name": first(row, fields["function_name"]),
        "subfunction_name": first(row, fields["subfunction_name"]),
    }
    result = []
    for field, stage in (("current_budget", "current_budget"), ("expenditure", "actual"), ("remaining_balance", "unspent_balance")):
        value = amount(first(row, fields[field]))
        if value is None:
            continue
        result.append({
            "public_entity_id": contract["entity"]["public_entity_id"],
            "fiscal_year": int(str(year)[:4]),
            "reporting_scope": "Seoul Metropolitan Government; autonomous districts and affiliated bodies excluded",
            "coverage_scope": "anchor_legal_government_only",
            "budget_stage": stage,
            "budget_side": "expenditure",
            **dimensions,
            "amount_local": value,
            "currency_code": contract["entity"]["currency"],
            "source_id": contract["source"]["id"],
            "source_row_number": source_row_number,
            "retrieved_at": retrieved_at,
            "source_payload": row,
        })
    if not result:
        raise ValueError(f"row {source_row_number} has no retained monetary measure")
    return result


def fetch(contract: dict, work: Path) -> dict:
    source = contract["source"]
    key = os.environ.get(source["api_key_env"], "")
    service_name = os.environ.get(source["service_name_env"], "")
    if not key or not service_name:
        raise RuntimeError(
            f"real load blocked: set {source['api_key_env']} and {source['service_name_env']} after official API registration and service-name review"
        )
    if source["api_base_url"].startswith("http://") and os.environ.get("SEOUL_ALLOW_INSECURE_HTTP") != "1":
        raise RuntimeError(
            "real load blocked: official endpoint is HTTP and embeds the API key in the path; set SEOUL_ALLOW_INSECURE_HTTP=1 only after explicit transport-security review"
        )
    work.mkdir(parents=True, exist_ok=True)
    raw_path = work / "raw.jsonl"
    normalized_path = work / "normalized.jsonl"
    retrieved_at = datetime.now(timezone.utc).isoformat()
    page_size = int(source["page_size"])
    start = 1
    total = None
    source_rows = normalized_rows = 0
    with raw_path.open("w", encoding="utf-8") as raw, normalized_path.open("w", encoding="utf-8") as normalized:
        while total is None or start <= total:
            end = start + page_size - 1
            url = api_url(contract, key, service_name, start, end)
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.load(response)
            page_total, rows = response_rows(payload, service_name)
            if total is None:
                total = page_total
            elif total != page_total:
                raise ValueError("Seoul API total changed during paginated snapshot")
            if not rows and start <= total:
                raise ValueError("Seoul API pagination stopped before advertised total")
            for row in rows:
                source_rows += 1
                raw.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
                for record in normalize(row, contract, source_rows, retrieved_at):
                    normalized.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
                    normalized_rows += 1
            start += len(rows)
    if source_rows != total or normalized_rows == 0:
        raise ValueError(f"incomplete Seoul snapshot: expected {total}, got {source_rows}")
    receipt = {
        "source_id": source["id"],
        "catalogue_url": source["catalogue_url"],
        "api_endpoint_redacted": api_url(contract, "REDACTED", service_name, 1, page_size),
        "retrieved_at": retrieved_at,
        "source_rows": source_rows,
        "normalized_rows": normalized_rows,
        "raw_sha256": sha256(raw_path),
        "normalized_sha256": sha256(normalized_path),
        "entity": contract["entity"],
    }
    (work / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return receipt


def publish(work: Path, run_id: str) -> None:
    if not run_id.replace("-", "").isalnum():
        raise ValueError("unsafe run id")
    destination = f"{BUCKET_ROOT}/{run_id}"
    subprocess.run(["gcloud", "storage", "cp", str(work / "raw.jsonl"), f"{destination}/raw.jsonl"], check=True)
    subprocess.run(["gcloud", "storage", "cp", str(work / "normalized.jsonl"), f"{destination}/normalized.jsonl"], check=True)
    subprocess.run(["gcloud", "storage", "cp", str(work / "receipt.json"), f"{destination}/receipt.json"], check=True)
    completed = work / "completed.json"
    completed.write_text(json.dumps({"status": "complete", "run_id": run_id}) + "\n", encoding="utf-8")
    subprocess.run(["gcloud", "storage", "cp", str(completed), f"{destination}/completed.json"], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    contract = load_contract(args.contract)
    print(json.dumps(fetch(contract, args.work), ensure_ascii=False, indent=2))
    if args.publish:
        publish(args.work, args.run_id)


if __name__ == "__main__":
    main()
