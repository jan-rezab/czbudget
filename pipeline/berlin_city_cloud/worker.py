#!/usr/bin/env python3
"""Cloud-only ingestion of Berlin's official 2024/25 double budget CSV."""
from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import requests
from google.cloud import bigquery

PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
ENTITY_ID = "DE:11000000"
SOURCE_ID = "de-berlin-double-budget-2024-2025"
URL = "https://www.berlin.de/sen/finanzen/service/daten/csv-opendata_doppelhaushalt_2024_2025.csv"
RUN_ID = f"{SOURCE_ID}-v1"


def parse_amount(value: str) -> Decimal | None:
    text = str(value or "").strip().replace(".", "").replace(",", ".")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_csv(body: bytes, loaded_at: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(body.decode("cp1252")), delimiter=";")
    rows = []
    for row_number, row in enumerate(reader, 2):
        value = parse_amount(row.get("Betrag"))
        year_text = str(row.get("Jahr") or "").strip()
        amount_type = str(row.get("BetragTyp") or "").strip()
        if value is None or value == 0 or year_text not in {"2024", "2025"} or amount_type not in {"Soll", "Ist"}:
            continue
        title_type = str(row.get("Titelart") or "").strip()
        side = "revenue" if title_type == "Einnahmetitel" else "expenditure" if title_type == "Ausgabetitel" else None
        if side is None:
            continue
        title = str(row.get("Titel") or "").strip()
        chapter = str(row.get("Kapitel") or "").strip()
        function = str(row.get("Funktion") or "").strip()
        rows.append({
            "public_entity_id": ENTITY_ID,
            "fiscal_year": int(year_text),
            "fiscal_period": "FY",
            "reporting_scope": "berlin_city_state_whole_budget",
            "budget_stage": "enacted" if amount_type == "Soll" else "actual",
            "budget_side": side,
            "source_budget_item_type_code": str(row.get("Titelbezeichnung") or "").strip(),
            "functional_paragraph_code": f"{chapter}:{function}",
            "economic_item_code": f"{side}:{title}",
            "functional_classification_id": "DE_BERLIN_FUNCTION_2024_2025",
            "economic_classification_id": "DE_BERLIN_TITLE_2024_2025",
            "amount_local": str(abs(value)),
            "currency_code": "EUR",
            "amount_eur": str(abs(value)),
            "fx_date": None,
            "is_consolidation_item": False,
            "is_financing": False,
            "is_summary_row": False,
            "source_row_number": row_number,
            "source_sheet": "Doppelhaushalt 2024/2025",
            "source_id": SOURCE_ID,
            "ingestion_run_id": RUN_ID,
            "coverage_type": "native_granular",
            "is_imputed": False,
            "quality_flags": [
                "official_berlin_open_data",
                "city_state_budget_including_senate_and_districts",
                "anchor_only_not_un_agglomeration",
                f"authority_type:{row.get('Bezeichnung', '').strip()}",
            ],
            "loaded_at": loaded_at,
        })
    return rows


def main() -> None:
    loaded_at = datetime.now(timezone.utc).isoformat()
    response = requests.get(URL, timeout=180)
    response.raise_for_status()
    body = response.content
    rows = parse_csv(body, loaded_at)
    years = Counter(row["fiscal_year"] for row in rows)
    stages = Counter(row["budget_stage"] for row in rows)
    sides = Counter(row["budget_side"] for row in rows)
    if len(body) < 10_000_000 or len(rows) < 10_000 or set(years) != {2024, 2025} or "enacted" not in stages:
        raise RuntimeError(f"source contract failed: bytes={len(body)} rows={len(rows)} years={years} stages={stages}")

    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage = f"{PROJECT}.{DATASET}._berlin_city_budget_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result()
    client.load_table_from_json(rows, stage).result()
    if client.get_table(stage).num_rows != len(rows):
        raise RuntimeError("staging row count mismatch")
    client.query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}`
      WHERE public_entity_id = '{ENTITY_ID}' AND source_id = '{SOURCE_ID}' AND fiscal_year BETWEEN 2024 AND 2025;
      INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year BETWEEN 2024 AND 2025;
      COMMIT TRANSACTION;
      DROP TABLE `{stage}`;
    """).result()
    receipt = {
        "source_id": SOURCE_ID,
        "official_url": URL,
        "retrieved_at": loaded_at,
        "sha256": hashlib.sha256(body).hexdigest(),
        "source_bytes": len(body),
        "entity_id": ENTITY_ID,
        "fiscal_scope": "Land Berlin city-state whole budget, including senate administrations and district budgets; not the UN built-up area",
        "years": dict(years),
        "stages": dict(stages),
        "sides": dict(sides),
        "rows_loaded": len(rows),
    }
    Path("/workspace/berlin-receipt.json").write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
