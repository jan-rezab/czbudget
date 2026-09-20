#!/usr/bin/env python3
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from google.cloud import bigquery, storage

from normalize import normalize_form2

PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
BUCKET = "czbudget-janrezab-data-layers"

def main():
    config = json.loads(Path("config.json").read_text())
    entity = config["entity"]
    run_id = os.environ["BUILD_ID"]
    now = datetime.now(timezone.utc).isoformat()
    response = requests.get(
        config["api_url"],
        params={
            "resource_id": config["resource_id"],
            "limit": 5000,
            "filters": json.dumps({"שם_רשות": entity["authority_name"]}, ensure_ascii=False),
        },
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=180,
    )
    response.raise_for_status()
    raw = response.content
    result = response.json()["result"]
    if result["total"] != len(result["records"]) or len(result["records"]) < 3000:
        raise RuntimeError(f"incomplete Tel Aviv response: total={result['total']} returned={len(result['records'])}")
    rows = result["records"]
    if {(str(r["שם_רשות"]), str(r["קוד_רשות"])) for r in rows} != {(entity["authority_name"], entity["authority_code"])}:
        raise RuntimeError("authority identity drift")
    normalized = normalize_form2(rows)
    if not 40 <= len(normalized) <= 80:
        raise RuntimeError(f"unexpected qualifying Form 2 fact count: {len(normalized)}")
    facts = []
    for item in normalized:
        facts.append({
            "public_entity_id": entity["entity_id"],
            "fiscal_year": config["fiscal_year"],
            "fiscal_period": "FY",
            "reporting_scope": "Tel Aviv-Yafo audited regular-budget expenditure by Form 2 service category",
            "budget_stage": item["stage"],
            "budget_side": "expenditure",
            "source_budget_item_type_code": "ISR_MOI_FORM2_EXPENDITURE",
            "functional_paragraph_code": item["functional_code"],
            "economic_item_code": item["published_code"],
            "functional_classification_id": "ISR_MOI_AUDIT_FORM2",
            "economic_classification_id": "ISR_MOI_PUBLISHED_MEASURE_CODE",
            "amount_local": str(item["amount_ils"]),
            "currency_code": config["currency_code"],
            "amount_eur": None,
            "fx_date": None,
            "is_consolidation_item": False,
            "is_financing": False,
            "is_summary_row": False,
            "source_row_number": item["source_row_id"],
            "source_sheet": "טופס 2",
            "source_id": config["source_id"],
            "ingestion_run_id": run_id,
            "coverage_type": "official_audited_service_category_line",
            "is_imputed": False,
            "quality_flags": ["official_national_datastore", "audited_municipal_report", "published_code", "published_totals_excluded", "anchor_legal_government_only"],
            "loaded_at": now,
        })
    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage = f"{PROJECT}.{DATASET}._israel_tel_aviv_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result()
    client.load_table_from_json(facts, stage).result()
    q = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("id", "STRING", entity["entity_id"]),
        bigquery.ScalarQueryParameter("year", "INT64", config["fiscal_year"]),
        bigquery.ScalarQueryParameter("source", "STRING", config["source_id"]),
    ])
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year=@year AND public_entity_id=@id AND source_id=@source; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=@year; COMMIT TRANSACTION; DROP TABLE `{stage}`;", job_config=q).result()
    qe = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("id", "STRING", entity["entity_id"]),
        bigquery.ScalarQueryParameter("name", "STRING", entity["entity_name"]),
    ])
    client.query(f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'city_government','IL','ISR',@id,'PSD_ISRAEL_CITY_ID',FALSE,TRUE,'ILS',CURRENT_TIMESTAMP())", job_config=qe).result()
    qv = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("run", "STRING", run_id),
        bigquery.ScalarQueryParameter("year", "INT64", config["fiscal_year"]),
    ])
    verification = list(client.query(f"SELECT budget_stage,COUNT(*) row_count,SUM(amount_local) amount FROM `{target}` WHERE fiscal_year=@year AND ingestion_run_id=@run GROUP BY 1 ORDER BY 1", job_config=qv).result())
    if sum(r["row_count"] for r in verification) != len(facts):
        raise RuntimeError("warehouse row-count mismatch")
    receipt = {
        "status": "warehouse_loaded",
        "run_id": run_id,
        "retrieved_at": now,
        "publisher": config["publisher"],
        "catalog_url": config["catalog_url"],
        "api_url": config["api_url"],
        "resource_id": config["resource_id"],
        "raw_response_sha256": hashlib.sha256(raw).hexdigest(),
        "raw_response_bytes": len(raw),
        "source_rows": len(rows),
        "fiscal_year": config["fiscal_year"],
        "published_unit": config["published_unit"],
        "entity": entity,
        "warehouse_table": target,
        "warehouse_rows": len(facts),
        "per_stage": {r["budget_stage"]: {"rows": r["row_count"], "amount_ils": str(r["amount"])} for r in verification},
        "normalization": config["source_contract"],
    }
    path = Path("/workspace/israel-tel-aviv-receipt.json")
    path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    storage.Client(project=PROJECT).bucket(BUCKET).blob(f"processing-runs/israel-tel-aviv/{run_id}/completed.json").upload_from_filename(str(path), if_generation_match=0, content_type="application/json")
    print(json.dumps(receipt, ensure_ascii=False))

if __name__ == "__main__":
    main()
