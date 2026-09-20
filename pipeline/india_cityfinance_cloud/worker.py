#!/usr/bin/env python3
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from google.cloud import bigquery, storage

from normalize import fiscal_year_end, normalize_income_statement

PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
BUCKET = "czbudget-janrezab-data-layers"


def get_json(session, url, **params):
    response = session.get(url, params=params, timeout=180)
    response.raise_for_status()
    return response, response.json()


def main():
    run_id = os.environ["BUILD_ID"]
    now = datetime.now(timezone.utc).isoformat()
    config = json.loads(Path("config.json").read_text())
    api = config["api_base"]
    session = requests.Session()
    session.headers["User-Agent"] = "PublicSpendingData/CityFinance-ingestion (+https://publicspendingdata.org)"
    facts = []
    receipts = {}

    for city in config["cities"]:
        slug = city["slug"]
        details_response, details_payload = get_json(session, api + "ledger/getUlbDetailsById", slug=slug)
        details = details_payload["ulbDetails"][0]
        if details["name"] != city["entity_name"]:
            raise RuntimeError(f"{slug}: entity drift {details['name']!r} != {city['entity_name']!r}")
        ulb_id = details["_id"]
        years_response, years_payload = get_json(session, api + "ledger/getYearsDynamic", ulbId=ulb_id)
        selected = None
        for year in years_payload.get("years", []):
            statement_response, statement_payload = get_json(
                session,
                api + "dashboard/city/bs-is",
                btnKey="incomeStatement",
                selectedUlb=ulb_id,
                ulbIds=ulb_id,
                years=year,
            )
            normalized = normalize_income_statement(statement_payload.get("data", []), ulb_id, year)
            if len(normalized) >= 5:
                selected = (year, statement_response, normalized)
                break
        if selected is None:
            raise RuntimeError(f"{slug}: no usable coded income statement in {years_payload.get('years')}")
        year_label, statement_response, normalized = selected
        year_end = fiscal_year_end(year_label)
        source_id = f"{config['source_id_prefix']}-{slug}-{year_label}"
        side_counts = {}
        for row in normalized:
            side_counts[row["budget_side"]] = side_counts.get(row["budget_side"], 0) + 1
            facts.append({
                "public_entity_id": city["entity_id"],
                "fiscal_year": year_end,
                "fiscal_period": "FY",
                "reporting_scope": f"{details['name']} standardized income statement",
                "budget_stage": "actual",
                "budget_side": row["budget_side"],
                "source_budget_item_type_code": row["report_type"] or "standardized_account",
                "functional_paragraph_code": row["line_item"],
                "economic_item_code": row["economic_item_code"],
                "functional_classification_id": f"INDIA_CITYFINANCE_INCOME_STATEMENT_{year_label}",
                "economic_classification_id": "INDIA_NATIONAL_MUNICIPAL_ACCOUNTING_CODE",
                "amount_local": row["amount_local"],
                "currency_code": "INR",
                "amount_eur": None,
                "fx_date": None,
                "is_consolidation_item": False,
                "is_financing": False,
                "is_summary_row": False,
                "source_row_number": row["source_row_number"],
                "source_sheet": "dashboard/city/bs-is?btnKey=incomeStatement",
                "source_id": source_id,
                "ingestion_run_id": run_id,
                "coverage_type": "coded_income_statement_actual",
                "is_imputed": False,
                "quality_flags": [
                    "official_national_municipal_finance_portal",
                    "standardized_coded_account",
                    "reported_actual_audit_status_not_asserted",
                    "calculated_and_summary_rows_excluded",
                    "anchor_legal_government_only",
                ],
                "loaded_at": now,
            })
        receipts[city["entity_id"]] = {
            "municipality": details["name"],
            "ulb_id": ulb_id,
            "national_ulb_code": details.get("code"),
            "lgd_code": details.get("lgdCode"),
            "un_city_code": city["un_city_code"],
            "fiscal_year_label": year_label,
            "fiscal_year_end": year_end,
            "budget_stage": "actual",
            "rows_loaded": len(normalized),
            "side_counts": side_counts,
            "details_query_url": details_response.url,
            "years_query_url": years_response.url,
            "statement_query_url": statement_response.url,
            "statement_response_sha256": hashlib.sha256(statement_response.content).hexdigest(),
            "boundary": f"{details['name']} legal ULB only; anchor government, not full UN built-up area.",
        }

    client = bigquery.Client(project=PROJECT)
    target = f"{PROJECT}.{DATASET}.municipal_budget_line_facts"
    stage = f"{PROJECT}.{DATASET}._india_cityfinance_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result()
    client.load_table_from_json(facts, stage).result()
    if client.get_table(stage).num_rows != len(facts):
        raise RuntimeError("stage row mismatch")
    entity_ids = [city["entity_id"] for city in config["cities"]]
    fiscal_years = sorted({receipt["fiscal_year_end"] for receipt in receipts.values()})
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ArrayQueryParameter("entity_ids", "STRING", entity_ids),
        bigquery.ArrayQueryParameter("fiscal_years", "INT64", fiscal_years),
        bigquery.ScalarQueryParameter("source_prefix", "STRING", config["source_id_prefix"] + "-%"),
    ])
    client.query(
        f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year IN UNNEST(@fiscal_years) AND public_entity_id IN UNNEST(@entity_ids) AND source_id LIKE @source_prefix; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year IN UNNEST(@fiscal_years); COMMIT TRANSACTION; DROP TABLE `{stage}`;",
        job_config=job_config,
    ).result()
    for city in config["cities"]:
        params = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("id", "STRING", city["entity_id"]),
            bigquery.ScalarQueryParameter("name", "STRING", city["entity_name"]),
            bigquery.ScalarQueryParameter("code", "STRING", receipts[city["entity_id"]]["national_ulb_code"]),
        ])
        client.query(
            f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'municipal_corporation','IN','IND',@code,'CITYFINANCE_ULB_CODE',FALSE,TRUE,'INR',CURRENT_TIMESTAMP())",
            job_config=params,
        ).result()
    verify_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("run_id", "STRING", run_id),
        bigquery.ArrayQueryParameter("fiscal_years", "INT64", fiscal_years),
    ])
    counts = {row["public_entity_id"]: row["c"] for row in client.query(
        f"SELECT public_entity_id, COUNT(*) c FROM `{target}` WHERE fiscal_year IN UNNEST(@fiscal_years) AND ingestion_run_id=@run_id GROUP BY public_entity_id",
        job_config=verify_config,
    ).result()}
    expected = {entity_id: receipt["rows_loaded"] for entity_id, receipt in receipts.items()}
    if counts != expected:
        raise RuntimeError(f"warehouse mismatch {counts} != {expected}")
    receipt = {
        "status": "warehouse_loaded",
        "run_id": run_id,
        "retrieved_at": now,
        "publisher": config["publisher"],
        "api_base": api,
        "warehouse_table": target,
        "warehouse_rows": sum(counts.values()),
        "per_city": receipts,
        "normalization": "Coded, non-null income-statement accounts only; calculated totals and reportType=summary rows excluded.",
        "stage_note": "Reported actual; API response does not establish an audit opinion.",
        "boundary": config["coverage_note"],
    }
    path = Path("/workspace/india-cityfinance-receipt.json")
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    blob = storage.Client(project=PROJECT).bucket(BUCKET).blob(f"processing-runs/india-cityfinance/{run_id}/completed.json")
    blob.upload_from_filename(str(path), if_generation_match=0, content_type="application/json")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
