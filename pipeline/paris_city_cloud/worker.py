#!/usr/bin/env python3
"""Load coded 2024 Ville de Paris executed-account lines from official open data."""
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
ENTITY_ID = "FR:75056"
SOURCE_ID = "fr-paris-administrative-account-main-budget-2024"
RUN_ID = f"{SOURCE_ID}-v1"
DATASET_ID = "comptes-administratifs-budgets-principaux-a-partir-de-2019-m57-ville-departement"
CATALOG_URL = f"https://opendata.paris.fr/explore/dataset/{DATASET_ID}/"
URL = (
    f"https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/{DATASET_ID}/exports/csv"
    "?lang=fr&timezone=Europe%2FParis&use_labels=false&delimiter=%3B"
)
EXPECTED_EXPORT_ROWS = 25_629
EXPECTED_2024_ROWS = 4_463
EXPECTED_2024_NONZERO_ROWS = 4_434


def money(value: str) -> Decimal | None:
    try:
        amount = Decimal(str(value or "").strip().replace(",", "."))
    except InvalidOperation:
        return None
    return amount if amount.is_finite() else None


def normalize(body: bytes, loaded_at: str) -> tuple[list[dict], dict]:
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")), delimiter=";")
    rows = []
    export_rows = 0
    rows_2024 = 0
    for row_number, source in enumerate(reader, 2):
        export_rows += 1
        if str(source.get("exercice_comptable") or "").strip() != "2024":
            continue
        rows_2024 += 1
        amount = money(source.get("mandate_titre_apres_regul"))
        nature = str(source.get("nature_budgetaire_cle") or "").strip()
        function = str(source.get("fonction_cle") or "").strip()
        chapter = str(source.get("chapitre_budgetaire_cle") or "").strip()
        side_native = str(source.get("sens_depense_recette") or "").strip()
        if amount is None or amount == 0 or not nature or not function or not chapter:
            continue
        if side_native == "Dépenses":
            side = "expenditure"
        elif side_native == "Recettes":
            side = "revenue"
        else:
            continue
        operation = str(source.get("type_d_operation_r_o_i_m") or "").strip()
        section = str(source.get("section_budgetaire_i_f") or "").strip()
        is_order = operation == "Pour Ordre"
        is_financing = nature.startswith("16")
        rows.append({
            "public_entity_id": ENTITY_ID,
            "fiscal_year": 2024,
            "fiscal_period": "FY",
            "reporting_scope": "paris_unified_city_legal_government_main_budget",
            "budget_stage": "actual",
            "budget_side": side,
            "source_budget_item_type_code": (
                f"{chapter} | {source.get('chapitre_niveau_vote_texte_descriptif', '').strip()}"
                f" | {operation} | {section}"
            ),
            "functional_paragraph_code": function,
            "economic_item_code": f"{side}:{nature}",
            "functional_classification_id": "FR_M57_FUNCTION_2024",
            "economic_classification_id": "FR_M57_NATURE_2024",
            "amount_local": format(abs(amount), "f"),
            "currency_code": "EUR",
            "amount_eur": format(abs(amount), "f"),
            "fx_date": "2024-12-31",
            "is_consolidation_item": is_order,
            "is_financing": is_financing,
            "is_summary_row": False,
            "source_row_number": row_number,
            "source_sheet": DATASET_ID,
            "source_id": SOURCE_ID,
            "ingestion_run_id": RUN_ID,
            "coverage_type": "official_coded_executed_account_nature_function",
            "is_imputed": False,
            "quality_flags": [
                "official_ville_de_paris_open_data",
                "legal_city_government_anchor_only",
                "main_budget",
                "executed_administrative_account",
                "coded_nature_and_function_leaf_line",
                f"operation:{operation}",
                f"section:{section}",
            ],
            "loaded_at": loaded_at,
        })
    stats = {"export_rows": export_rows, "rows_2024": rows_2024, "nonzero_rows_2024": len(rows)}
    if stats != {
        "export_rows": EXPECTED_EXPORT_ROWS,
        "rows_2024": EXPECTED_2024_ROWS,
        "nonzero_rows_2024": EXPECTED_2024_NONZERO_ROWS,
    }:
        raise RuntimeError(f"Paris source contract failed: {stats}")
    if any(row["is_summary_row"] or not row["economic_item_code"] or not row["functional_paragraph_code"] for row in rows):
        raise RuntimeError("Paris coded-leaf contract failed")
    return rows, stats


def main() -> None:
    loaded_at = datetime.now(timezone.utc).isoformat()
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (compatible; PublicSpendingData/1.0)"
    response = session.get(URL, timeout=240)
    response.raise_for_status()
    body = response.content
    facts, source_stats = normalize(body, loaded_at)

    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage = f"{PROJECT}.{DATASET}._paris_city_budget_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result()
    client.load_table_from_json(facts, stage).result()
    staged = next(iter(client.query(f"""
      SELECT COUNT(*) AS row_count, COUNT(DISTINCT economic_item_code) AS economic_codes,
             COUNT(DISTINCT functional_paragraph_code) AS functional_codes,
             COUNTIF(is_summary_row) AS summary_rows
      FROM `{stage}` WHERE fiscal_year = 2024
    """).result()))
    if staged["row_count"] != len(facts) or staged["summary_rows"] != 0:
        raise RuntimeError(f"Paris staging verification failed: {dict(staged)}")
    if staged["economic_codes"] < 100 or staged["functional_codes"] < 50:
        raise RuntimeError(f"Paris classification depth failed: {dict(staged)}")

    old_rows = next(iter(client.query(f"""
      SELECT COUNT(*) AS row_count FROM `{target}`
      WHERE fiscal_year BETWEEN 2024 AND 2025 AND public_entity_id = '{ENTITY_ID}'
        AND source_id = 'fr-ofgl-base-communes'
    """).result()))["row_count"]
    if old_rows != 12:
        raise RuntimeError(f"expected exactly 12 shallow OFGL Paris rows before replacement, found {old_rows}")

    client.query(f"""
      BEGIN TRANSACTION;
      DELETE FROM `{target}`
      WHERE fiscal_year BETWEEN 2024 AND 2025 AND public_entity_id = '{ENTITY_ID}'
        AND (source_id = '{SOURCE_ID}' OR source_id = 'fr-ofgl-base-communes');
      INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year = 2024;
      COMMIT TRANSACTION;
      DROP TABLE `{stage}`;
    """).result()

    counts = [dict(row) for row in client.query(f"""
      SELECT budget_side, is_consolidation_item, is_financing, COUNT(*) AS row_count,
             COUNT(DISTINCT economic_item_code) AS economic_codes,
             COUNT(DISTINCT functional_paragraph_code) AS functional_codes
      FROM `{target}`
      WHERE fiscal_year = 2024 AND public_entity_id = '{ENTITY_ID}' AND source_id = '{SOURCE_ID}'
      GROUP BY budget_side, is_consolidation_item, is_financing
      ORDER BY budget_side, is_consolidation_item, is_financing
    """).result()]
    verified = sum(int(row["row_count"]) for row in counts)
    remaining_old = next(iter(client.query(f"""
      SELECT COUNT(*) AS row_count FROM `{target}`
      WHERE fiscal_year BETWEEN 2024 AND 2025 AND public_entity_id = '{ENTITY_ID}'
        AND source_id = 'fr-ofgl-base-communes'
    """).result()))["row_count"]
    if verified != len(facts) or remaining_old != 0:
        raise RuntimeError(f"Paris warehouse verification failed: rows={verified}, old={remaining_old}")

    receipt = {
        "status": "warehouse_loaded",
        "retrieved_at": loaded_at,
        "entity_id": ENTITY_ID,
        "fiscal_year": 2024,
        "budget_stage": "actual",
        "scope": "Unified Ville de Paris legal government main budget only; not the full UN built-up area.",
        "publisher": "Direction des Finances et des Achats - Ville de Paris",
        "catalog_url": CATALOG_URL,
        "official_url": URL,
        "source_sha256": hashlib.sha256(body).hexdigest(),
        "source_bytes": len(body),
        "source_stats": source_stats,
        "rows_loaded": len(facts),
        "shallow_rows_replaced": old_rows,
        "warehouse_verification": counts,
    }
    Path("/workspace/paris-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
