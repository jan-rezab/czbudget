#!/usr/bin/env python3
import hashlib
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import requests
from google.cloud import bigquery, storage

PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
BUCKET = "czbudget-janrezab-data-layers"


def money(value):
    text = re.sub(r"[^0-9.()-]", "", str(value or "")).replace("(", "-").replace(")", "")
    return Decimal(text or "0")


def parse_taipei(body):
    rows = []
    for source_row, node in enumerate(ET.fromstring(body).iter("Row"), 1):
        code = (node.findtext("款") or "").strip()
        label = (node.findtext("名稱") or "").strip()
        if not code or not label or label in {"合計", "總計"}:
            continue
        amount = money(node.findtext("合計"))
        if amount:
            rows.append({"source_row": source_row, "code": code, "label": label, "amount": amount,
                         "stage": "enacted", "item_type": "TPE_AGENCY_EXPENDITURE"})
    if len(rows) != 28:
        raise RuntimeError(f"Taipei: expected 28 coded agency rows, got {len(rows)}")
    return rows


def parse_taichung(body):
    payload = json.loads(body)
    wanted = {
        "地方總決算歲出機關別-預算數(單位:元)": ("enacted", "TXG_AGENCY_BUDGET"),
        "地方總決算歲出機關別-原列決算數(單位:元)": ("actual", "TXG_AGENCY_ORIGINAL_FINAL_ACCOUNT"),
    }
    rows = []
    for source_row, row in enumerate(payload, 1):
        measure = row.get("項目", "").strip()
        if measure not in wanted:
            continue
        label = row.get("欄位名稱", "").strip()
        if not label or any(token in label for token in ("合計", "總計", "_實現數", "_應付數", "_保留數")):
            continue
        amount = money(row.get("數值"))
        stage, item_type = wanted[measure]
        rows.append({"source_row": source_row, "code": hashlib.sha1(label.encode()).hexdigest()[:12].upper(),
                     "label": label, "amount": amount, "stage": stage, "item_type": item_type})
    stages = {stage: sum(r["stage"] == stage for r in rows) for stage in ("enacted", "actual")}
    if stages != {"enacted": 27, "actual": 27}:
        raise RuntimeError(f"Taichung: expected 27 rows per stage, got {stages}")
    return rows


def normalize(city, body, run_id, loaded_at):
    rows = parse_taipei(body) if city["format"] == "xml" else parse_taichung(body)
    facts = []
    for row in rows:
        facts.append({
            "public_entity_id": city["entity_id"], "fiscal_year": city["fiscal_year"], "fiscal_period": "FY",
            "reporting_scope": f"{city['entity_name']} general-budget expenditure by agency",
            "budget_stage": row["stage"], "budget_side": "expenditure",
            "source_budget_item_type_code": row["item_type"],
            "functional_paragraph_code": f"TW_{city['un_city_code']}_{row['code']}",
            "economic_item_code": "UNSPECIFIED", "functional_classification_id": "TW_CITY_AGENCY",
            "economic_classification_id": "TW_CITY_NOT_PUBLISHED", "amount_local": str(row["amount"]),
            "currency_code": "TWD", "amount_eur": None, "fx_date": None,
            "is_consolidation_item": False, "is_financing": False, "is_summary_row": False,
            "source_row_number": row["source_row"], "source_sheet": f"ROC {city['roc_year']} agency expenditure",
            "source_id": city["source_id"], "ingestion_run_id": run_id,
            "coverage_type": "official_agency_budget_line", "is_imputed": False,
            "quality_flags": ["official_city_open_data", "published_agency_line", "published_totals_excluded",
                              "anchor_legal_government_only"], "loaded_at": loaded_at,
        })
    return facts


def main():
    config = json.loads(Path("config.json").read_text())
    run_id = os.environ["BUILD_ID"]
    now = datetime.now(timezone.utc).isoformat()
    facts, per_city, hashes = [], {}, {}
    session = requests.Session()
    session.headers["User-Agent"] = "czbudget municipal-budget-ingestion/1.0"
    for city in config["cities"]:
        response = session.get(city["download_url"], timeout=120)
        response.raise_for_status()
        body = response.content
        city_facts = normalize(city, body, run_id, now)
        facts.extend(city_facts)
        hashes[city["entity_id"]] = hashlib.sha256(body).hexdigest()
        per_city[city["entity_id"]] = {
            "municipality": city["entity_name"], "un_city_code": city["un_city_code"],
            "fiscal_year": city["fiscal_year"], "rows_loaded": len(city_facts),
            "stages": {stage: sum(f["budget_stage"] == stage for f in city_facts)
                       for stage in sorted({f["budget_stage"] for f in city_facts})},
            "amount_twd": str(sum(Decimal(f["amount_local"]) for f in city_facts)),
            "boundary": city["boundary"], "catalog_url": city["catalog_url"],
            "publisher_direct_url": city["download_url"],
        }

    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage_table = f"{PROJECT}.{DATASET}._taiwan_tpe_txg_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage_table}` LIKE `{target}`").result()
    client.load_table_from_json(facts, stage_table).result()
    for city in config["cities"]:
        params = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("id", "STRING", city["entity_id"]),
            bigquery.ScalarQueryParameter("year", "INT64", city["fiscal_year"]),
            bigquery.ScalarQueryParameter("source", "STRING", city["source_id"]),
        ])
        client.query(f"DELETE FROM `{target}` WHERE fiscal_year=@year AND public_entity_id=@id AND source_id=@source", job_config=params).result()
    client.query(f"INSERT INTO `{target}` SELECT * FROM `{stage_table}` WHERE fiscal_year IN (2018, 2026); DROP TABLE `{stage_table}`").result()
    for city in config["cities"]:
        q = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("id", "STRING", city["entity_id"]),
            bigquery.ScalarQueryParameter("name", "STRING", city["entity_name"]),
        ])
        client.query(f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'city_government','TW','TWN',@id,'PSD_TAIWAN_CITY_ID',FALSE,TRUE,'TWD',CURRENT_TIMESTAMP())", job_config=q).result()
    counts = {}
    for city in config["cities"]:
        q = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("run", "STRING", run_id),
            bigquery.ScalarQueryParameter("year", "INT64", city["fiscal_year"]),
            bigquery.ScalarQueryParameter("id", "STRING", city["entity_id"]),
        ])
        result = list(client.query(f"SELECT COUNT(*) c FROM `{target}` WHERE fiscal_year=@year AND ingestion_run_id=@run AND public_entity_id=@id", job_config=q).result())
        counts[city["entity_id"]] = result[0]["c"]
    expected = {key: value["rows_loaded"] for key, value in per_city.items()}
    if counts != expected:
        raise RuntimeError(f"warehouse mismatch {counts} != {expected}")
    receipt = {
        "status": "warehouse_loaded", "run_id": run_id, "retrieved_at": now,
        "warehouse_table": target, "warehouse_rows": sum(counts.values()),
        "source_sha256": hashes, "per_city": per_city,
        "normalization": "Official legal-city agency expenditure lines only. Explicit totals and audited component rows excluded; published TWD units preserved.",
    }
    path = Path("/workspace/taiwan-taipei-taichung-receipt.json")
    path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    blob = storage.Client(project=PROJECT).bucket(BUCKET).blob(f"processing-runs/taiwan-taipei-taichung/{run_id}/completed.json")
    blob.upload_from_filename(str(path), if_generation_match=0, content_type="application/json")
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
