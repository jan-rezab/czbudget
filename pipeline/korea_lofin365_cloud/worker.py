#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import requests

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; BUCKET="czbudget-janrezab-data-layers"; PREFIX="processing-runs/korea-lofin365-city"
PAGE_SIZE=1000; STAGES=(("amt1","current_budget"),("amt6","actual"),("amt7","unspent_balance"))

def digest(path):
    h=hashlib.sha256()
    with Path(path).open("rb") as f:
        for b in iter(lambda:f.read(1048576),b""): h.update(b)
    return h.hexdigest()

def start_session(config):
    session=requests.Session(); session.headers["User-Agent"]="PublicSpendingData/1.0 (official-budget-ingestion)"
    response=session.get(config["portal_url"],timeout=120); response.raise_for_status()
    meta={"menuUrl":"/lf/lnncGramStst/laf/exeSvi/retvLstDtlsBybsnAneSitu.do","menuNm":"세부사업별 세출현황","menuParaCn":"STST","menuId":"LF3120202","uprMenuId":"LF3120200","sysDvCd":"","logReg":"true"}
    response=session.post(config["view_url"],data=meta,timeout=120); response.raise_for_status()
    if "retvLstExcDtlsBybsnAneSitu.do" not in response.text: raise RuntimeError("official view did not expose export contract")
    return session

def fetch_city(session,config,city,raw_path):
    rows=[]; page=1
    with raw_path.open("w",encoding="utf-8") as out:
        while True:
            payload={"curPage":page,"pageSize":PAGE_SIZE,"subCode":city["region_code"],"inqYr":str(config["fiscal_year"]),"inqCap":city["region_code"],"inqSgg":city["legal_government_code"],"inqYmd":config["as_of_date"]}
            response=session.post(config["export_url"],json=payload,timeout=300); response.raise_for_status(); body=response.json()
            batch=body.get("excExeInqRsltDto")
            if not isinstance(batch,list): raise RuntimeError(f"{city['entity_name']}: invalid export payload")
            for row in batch: out.write(json.dumps(row,ensure_ascii=False,sort_keys=True)+"\n")
            rows.extend(batch)
            if len(batch)<PAGE_SIZE: break
            page+=1
            if page>50: raise RuntimeError(f"{city['entity_name']}: pagination runaway")
    if len(rows)<500: raise RuntimeError(f"{city['entity_name']}: implausibly few project rows ({len(rows)})")
    if [int(row["rn"]) for row in rows]!=list(range(1,len(rows)+1)): raise RuntimeError(f"{city['entity_name']}: non-contiguous row numbers")
    codes=[]
    for row in rows:
        if str(row.get("rsltYr"))!=str(config["fiscal_year"]) or row.get("lafCd")!=city["legal_government_code"] or row.get("codeNm")!=city["expected_region_name"] or row.get("codeNm2")!="본청": raise RuntimeError(f"{city['entity_name']}: boundary/year mismatch {row}")
        if not row.get("code") or not row.get("codeNm4") or not row.get("codeNm3"): raise RuntimeError(f"{city['entity_name']}: uncoded project row {row}")
        codes.append(row["code"])
    if len(codes)!=len(set(codes)): raise RuntimeError(f"{city['entity_name']}: duplicate project codes")
    return rows

def facts_for_city(rows,city,config,retrieved,run_id):
    facts=[]
    for row in rows:
        flags=["official_lofin365_project_export","metropolitan_main_office_only","anchor_legal_government_only",f"account:{row['codeNm3']}",f"function:{row['codeNm5']}",f"subfunction:{row['codeNm6']}",f"project:{row['codeNm4']}"]
        for field,stage in STAGES:
            facts.append({"public_entity_id":city["entity_id"],"fiscal_year":config["fiscal_year"],"fiscal_period":"FY","reporting_scope":city["boundary"],"budget_stage":stage,"budget_side":"expenditure","source_budget_item_type_code":"KOR_LOFIN365_PROJECT","functional_paragraph_code":row["code"],"economic_item_code":"UNSPECIFIED","functional_classification_id":"KOR_LOFIN365_FUNCTION_PROJECT","economic_classification_id":"KOR_LOFIN365_NOT_IN_EXPORT","amount_local":format(Decimal(str(row[field])),"f"),"currency_code":"KRW","amount_eur":None,"fx_date":None,"is_consolidation_item":False,"is_financing":False,"is_summary_row":False,"source_row_number":int(row["rn"]),"source_sheet":"Local Finance 365 detailed project expenditure export","source_id":config["source_id"],"ingestion_run_id":run_id,"coverage_type":"official_project_budget_execution_line","is_imputed":False,"quality_flags":flags,"loaded_at":retrieved})
    return facts

def main():
    from google.cloud import bigquery, storage
    config=json.loads(Path("config.json").read_text()); run_id=os.environ["BUILD_ID"]; work=Path("/workspace/korea-lofin365"); work.mkdir(exist_ok=True); retrieved=datetime.now(timezone.utc).isoformat()
    session=start_session(config); facts=[]; per_city={}; raw_hashes={}
    for city in config["cities"]:
        raw=work/f"{city['legal_government_code']}.jsonl"; rows=fetch_city(session,config,city,raw); city_facts=facts_for_city(rows,city,config,retrieved,run_id); facts.extend(city_facts)
        raw_hashes[city["entity_id"]]=digest(raw); per_city[city["entity_id"]]={"entity_name":city["entity_name"],"un_city_code":city["un_city_code"],"legal_government_code":city["legal_government_code"],"boundary":city["boundary"],"source_project_rows":len(rows),"normalized_facts":len(city_facts)}
    normalized=work/"normalized.jsonl"
    with normalized.open("w",encoding="utf-8") as out:
        for fact in facts: out.write(json.dumps(fact,ensure_ascii=False,sort_keys=True)+"\n")
    client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._korea_lofin365_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
    ids=[city["entity_id"] for city in config["cities"]]; q=bigquery.QueryJobConfig(query_parameters=[bigquery.ArrayQueryParameter("ids","STRING",ids),bigquery.ScalarQueryParameter("year","INT64",config["fiscal_year"]),bigquery.ScalarQueryParameter("source","STRING",config["source_id"])])
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year=@year AND public_entity_id IN UNNEST(@ids) AND source_id=@source; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=@year; COMMIT TRANSACTION; DROP TABLE `{stage}`;",job_config=q).result()
    for city in config["cities"]:
        q2=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("id","STRING",city["entity_id"]),bigquery.ScalarQueryParameter("name","STRING",city["entity_name"])])
        client.query(f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'metropolitan_city_government','KR','KOR',@id,'PSD_KOREA_METRO_ID',FALSE,TRUE,'KRW',CURRENT_TIMESTAMP())",job_config=q2).result()
    q3=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("run","STRING",run_id),bigquery.ScalarQueryParameter("year","INT64",config["fiscal_year"])])
    result=list(client.query(f"SELECT public_entity_id,budget_stage,COUNT(*) row_count,SUM(amount_local) amount FROM `{target}` WHERE fiscal_year=@year AND ingestion_run_id=@run GROUP BY 1,2 ORDER BY 1,2",job_config=q3).result())
    actual={(r["public_entity_id"],r["budget_stage"]):int(r["row_count"]) for r in result}; expected={(city["entity_id"],stage):per_city[city["entity_id"]]["source_project_rows"] for city in config["cities"] for _,stage in STAGES}
    if actual!=expected: raise RuntimeError(f"warehouse mismatch {actual} != {expected}")
    receipt={"status":"warehouse_loaded","run_id":run_id,"retrieved_at":retrieved,"publisher":config["publisher"],"portal_url":config["portal_url"],"export_url":config["export_url"],"fiscal_year":config["fiscal_year"],"as_of_date":config["as_of_date"],"warehouse_table":target,"warehouse_rows":len(facts),"per_city":per_city,"per_city_stage_amounts":{f"{r['public_entity_id']}|{r['budget_stage']}":str(r["amount"]) for r in result},"raw_sha256":raw_hashes,"normalized_sha256":digest(normalized),"normalization":config["source_contract"]}
    completed=work/"completed.json"; completed.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
    bucket=storage.Client(project=PROJECT).bucket(BUCKET)
    for city in config["cities"]:
        raw=work/f"{city['legal_government_code']}.jsonl"; bucket.blob(f"{PREFIX}/{run_id}/raw/{raw.name}").upload_from_filename(str(raw),if_generation_match=0)
    for path in (normalized,completed): bucket.blob(f"{PREFIX}/{run_id}/{path.name}").upload_from_filename(str(path),if_generation_match=0)
    print(json.dumps(receipt,ensure_ascii=False))
if __name__=="__main__": main()
