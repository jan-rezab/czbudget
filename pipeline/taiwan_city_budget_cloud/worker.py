#!/usr/bin/env python3
import csv, hashlib, io, json, os, re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import requests
from google.cloud import bigquery, storage

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; BUCKET="czbudget-janrezab-data-layers"

def rows_from_payload(payload):
    if isinstance(payload, list): return payload
    for key in ("data", "result", "records"):
        value=payload.get(key) if isinstance(payload,dict) else None
        if isinstance(value,list): return value
        if isinstance(value,dict):
            for child in ("records","data"):
                if isinstance(value.get(child),list): return value[child]
    raise RuntimeError(f"unrecognized API shape: {type(payload).__name__}")

def number(value):
    text=re.sub(r"[^0-9.()-]", "", str(value or "")).replace("(","-").replace(")","")
    return Decimal(text or "0") * 1000

def main():
    config=json.loads(Path("config.json").read_text()); run_id=os.environ["BUILD_ID"]
    now=datetime.now(timezone.utc).isoformat(); facts=[]; per_city={}; source_hashes={}
    for city in config["cities"]:
        body=Path("source.csv").read_bytes()
        rows=list(csv.DictReader(io.StringIO(body.decode("utf-8-sig")))); normalized=[]
        for n,row in enumerate(rows,1):
            label=next((str(row[k]).strip() for k in ("科目名稱","項目","名稱","name","Name") if k in row and str(row[k]).strip()),"")
            raw=next((row[k] for k in ("本年度預算數","本年度","115年度","value","Value") if k in row),None)
            if not label or raw is None or any(x in label for x in ("合計","總計")): continue
            amount=number(raw)
            if not amount: continue
            normalized.append((n,label,amount))
        if len(normalized)<5: raise RuntimeError(f"{city['entity_name']}: only {len(normalized)} non-total rows; keys={list(rows[0]) if rows else []}")
        for n,label,amount in normalized:
            code="KCG_"+hashlib.sha1(label.encode()).hexdigest()[:12].upper()
            facts.append({"public_entity_id":city["entity_id"],"fiscal_year":config["fiscal_year"],"fiscal_period":"FY","reporting_scope":"Kaohsiung City general budget expenditure by agency","budget_stage":"enacted","budget_side":"expenditure","source_budget_item_type_code":"KCG_AGENCY_EXPENDITURE","functional_paragraph_code":code,"economic_item_code":"UNSPECIFIED","functional_classification_id":"TW_KCG_AGENCY","economic_classification_id":"TW_KCG_NOT_PUBLISHED","amount_local":str(amount),"currency_code":config["currency_code"],"amount_eur":None,"fx_date":None,"is_consolidation_item":False,"is_financing":False,"is_summary_row":False,"source_row_number":n,"source_sheet":f"data.gov.tw dataset 101174 ROC {config['roc_year']}","source_id":config["source_id"],"ingestion_run_id":run_id,"coverage_type":"official_agency_budget_line","is_imputed":False,"quality_flags":["official_city_open_data_api","published_agency_line","published_totals_excluded","anchor_legal_government_only"],"loaded_at":now})
        source_hashes[city["entity_id"]]=hashlib.sha256(body).hexdigest()
        per_city[city["entity_id"]]={"municipality":city["entity_name"],"un_city_code":city["un_city_code"],"rows_loaded":len(normalized),"boundary":city["boundary"],"catalog_url":config["catalog_url"],"publisher_direct_url":city["csv_url"],"retrieval_url":city["quality_proxy_csv_url"]}
    client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._taiwan_city_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
    ids=[x["entity_id"] for x in config["cities"]]; q=bigquery.QueryJobConfig(query_parameters=[bigquery.ArrayQueryParameter("ids","STRING",ids),bigquery.ScalarQueryParameter("year","INT64",config["fiscal_year"]),bigquery.ScalarQueryParameter("source","STRING",config["source_id"])])
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year=@year AND public_entity_id IN UNNEST(@ids) AND source_id=@source; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=@year; COMMIT TRANSACTION; DROP TABLE `{stage}`;",job_config=q).result()
    for city in config["cities"]:
        q2=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("id","STRING",city["entity_id"]),bigquery.ScalarQueryParameter("name","STRING",city["entity_name"])])
        client.query(f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'city_government','TW','TWN',@id,'PSD_TAIWAN_CITY_ID',FALSE,TRUE,'TWD',CURRENT_TIMESTAMP())",job_config=q2).result()
    q3=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("run","STRING",run_id),bigquery.ScalarQueryParameter("year","INT64",config["fiscal_year"])])
    counts={r["public_entity_id"]:r["c"] for r in client.query(f"SELECT public_entity_id,COUNT(*) c FROM `{target}` WHERE fiscal_year=@year AND ingestion_run_id=@run GROUP BY 1",job_config=q3).result()}
    expected={k:v["rows_loaded"] for k,v in per_city.items()}
    if counts!=expected: raise RuntimeError(f"warehouse mismatch {counts} != {expected}")
    receipt={"status":"warehouse_loaded","run_id":run_id,"retrieved_at":now,"publisher":config["publisher"],"catalog_url":config["catalog_url"],"fiscal_year":config["fiscal_year"],"budget_stage":"enacted","warehouse_table":target,"warehouse_rows":sum(counts.values()),"source_sha256":source_hashes,"per_city":per_city,"normalization":"Official agency expenditure lines only; explicit totals excluded; published TWD thousands converted to TWD."}
    path=Path("/workspace/taiwan-city-budget-receipt.json"); path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
    blob=storage.Client(project=PROJECT).bucket(BUCKET).blob(f"processing-runs/taiwan-city-budget/{run_id}/completed.json"); blob.upload_from_filename(str(path),if_generation_match=0,content_type="application/json")
    print(json.dumps(receipt,ensure_ascii=False))

if __name__=="__main__": main()
