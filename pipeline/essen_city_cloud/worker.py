#!/usr/bin/env python3
"""Cloud-only ingestion of Essen's official structured 2025/26 result plan."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
SOURCE_ID = "de-essen-budget-2025-2026"
ENTITY_ID = "DE:05113000"
URL = "https://opendata.essen.de/sites/default/files/Gesamtergebnisplan_Kostenarten_2025_2026%28inkl_interne_Leistungsbeziehungen%29.csv"
RUN_ID = f"{SOURCE_ID}-v2"


def amount(value: str) -> Decimal | None:
    text = str(value or "").replace("€", "").replace("\u00a0", "").replace(" ", "")
    if not text or text in {"[z]", "[-]", "-"}:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return None
    return parsed if parsed else None


def split_code(value: str) -> tuple[str, str]:
    text = str(value or "").strip()
    if " - " in text:
        code, name = text.split(" - ", 1)
        return code.strip(), name.strip()
    return text or "UNSPECIFIED", text or "UNSPECIFIED"


def parse_csv(body: bytes, loaded_at: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(body.decode("cp1252")), delimiter=";")
    rows = []
    for row_number, row in enumerate(reader, 2):
        function, function_name = split_code(row.get("Zeile_Ergebnisplan"))
        economic, economic_name = split_code(row.get("Kostenart"))
        side = "revenue" if economic.startswith("4") else "expenditure"
        for field, value in row.items():
            match = re.fullmatch(r"(Ansatz|Planung)_(20\d{2})", str(field or ""))
            parsed = amount(value) if match else None
            if not match or parsed is None:
                continue
            year = int(match.group(2))
            stage = "enacted" if match.group(1) == "Ansatz" else "proposal"
            rows.append({
                "public_entity_id": ENTITY_ID, "fiscal_year": year, "fiscal_period": "FY",
                "reporting_scope": "standalone_municipality", "budget_stage": stage,
                "budget_side": side, "source_budget_item_type_code": economic_name,
                "functional_paragraph_code": f"{side}:{function}", "economic_item_code": f"{side}:{economic}",
                "functional_classification_id": "DE_05113000_FUNCTION", "economic_classification_id": "DE_05113000_ECONOMIC",
                "amount_local": str(abs(parsed)), "currency_code": "EUR", "amount_eur": str(abs(parsed)),
                "fx_date": None, "is_consolidation_item": False, "is_financing": False,
                "is_summary_row": False, "source_row_number": row_number, "source_sheet": "Gesamtergebnisplan_Kostenarten",
                "source_id": SOURCE_ID, "ingestion_run_id": RUN_ID, "coverage_type": "published_subset",
                "is_imputed": False,
                "quality_flags": ["official_municipal_budget_source", "germany_decentralized_publication", "includes_internal_service_relationships", f"function_name:{function_name}"],
                "loaded_at": loaded_at,
            })
    return rows


def main() -> None:
    import requests
    from google.cloud import bigquery

    loaded_at = datetime.now(timezone.utc).isoformat()
    response = requests.get(URL, timeout=60)
    response.raise_for_status()
    body = response.content
    digest = hashlib.sha256(body).hexdigest()
    rows = [row for row in parse_csv(body, loaded_at) if 2025 <= row["fiscal_year"] <= 2029]
    years = sorted({row["fiscal_year"] for row in rows})
    if len(body) < 100_000 or len(rows) < 100 or not {2025, 2026}.issubset(years):
        raise RuntimeError(f"source contract failed: bytes={len(body)} rows={len(rows)} years={years}")

    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage = f"{PROJECT}.{DATASET}._essen_city_budget_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result()
    job = client.load_table_from_json(rows, stage)
    job.result()
    loaded = client.get_table(stage).num_rows
    if loaded != len(rows):
        raise RuntimeError(f"staging row mismatch {loaded} != {len(rows)}")
    client.query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}`
      WHERE fiscal_year BETWEEN 2025 AND 2029 AND public_entity_id = '{ENTITY_ID}' AND source_id = '{SOURCE_ID}';
      INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year BETWEEN 2025 AND 2029;
      COMMIT TRANSACTION;
      DROP TABLE `{stage}`;
    """).result()
    receipt = {
        "source_id": SOURCE_ID, "official_url": URL, "retrieved_at": loaded_at,
        "sha256": digest, "source_bytes": len(body), "entity_id": ENTITY_ID,
        "fiscal_scope": "City of Essen legal municipality; includes internal service relationships; not UN agglomeration",
        "years": years, "stages": sorted({row["budget_stage"] for row in rows}), "rows_loaded": len(rows),
    }
    Path("/workspace/essen-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
