#!/usr/bin/env python3
"""Fetch Seoul's official no-secret project-budget XLSX and load reviewed facts."""
from __future__ import annotations
import argparse, hashlib, json, os, re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
import openpyxl, requests

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; BUCKET="czbudget-janrezab-data-layers"
PREFIX="processing-runs/seoul-project-budget"; USER_AGENT="PublicSpendingData/1.0 (official-budget-ingestion)"
HEADERS=["번호","회계구분","부서명","세부사업명","분야","예산현액","지출액","집행잔액"]
STAGES=(("예산현액","current_budget"),("지출액","actual"),("집행잔액","unspent_balance"))

def load_contract(path):
    contract=json.loads(Path(path).read_text())
    if contract["entity"]["coverage_label"]!="anchor_legal_government_only": raise ValueError("unsafe boundary label")
    if not contract["source"]["export_url"].startswith("https://"): raise ValueError("export must use HTTPS")
    return contract

def digest(path):
    h=hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda:stream.read(1048576),b""): h.update(chunk)
    return h.hexdigest()

def money(value):
    try: return format(Decimal(str(value if value is not None else "").replace(",","").strip()),"f")
    except InvalidOperation as error: raise ValueError(f"invalid monetary amount {value!r}") from error

def fetch_export(contract,destination):
    source=contract["source"]; session=requests.Session(); session.headers["User-Agent"]=USER_AGENT
    page=session.get(source["finance_portal_url"],timeout=120); page.raise_for_status()
    match=re.search(r'name="csrfToken" value="([^"]+)"',page.text)
    if not match: raise RuntimeError("official page did not return its CSRF token")
    response=session.post(source["export_url"],data={"init":"N","mngId":"4","csrfToken":match.group(1),"fisYear":str(source["fiscal_year"]),"cate":"","deptCd":"","deptNm":"","bNm":"","won":"1"},timeout=300)
    response.raise_for_status(); destination.write_bytes(response.content)
    if not response.content.startswith(b"PK\x03\x04"): raise ValueError("official export is not XLSX")
    return {"content_type":response.headers.get("content-type"),"content_disposition":response.headers.get("content-disposition"),"bytes":len(response.content)}

def source_rows(path):
    workbook=openpyxl.load_workbook(path,read_only=True,data_only=True)
    if len(workbook.worksheets)!=1: raise ValueError("expected one worksheet")
    sheet=workbook.worksheets[0]; sheet.reset_dimensions(); rows=sheet.iter_rows(values_only=True)
    next(rows,None); next(rows,None); headers=[str(v).strip() if v is not None else "" for v in next(rows)]
    if headers!=HEADERS: raise ValueError(f"unexpected headers {headers}")
    result=[]
    for values in rows:
        row=dict(zip(headers,values)); number=str(row["번호"] or "").strip()
        if not number and not any(value not in (None,"") for value in values): continue
        if not number.isdigit() or not str(row["세부사업명"] or "").strip() or not str(row["부서명"] or "").strip(): raise ValueError(f"non-project row {row}")
        result.append(row)
    if len(result)<1000: raise ValueError(f"implausibly small export {len(result)}")
    if [int(r["번호"]) for r in result]!=list(range(1,len(result)+1)): raise ValueError("row numbers not contiguous")
    return result

def normalize(row,contract,row_number,retrieved_at,run_id):
    stable="\x1f".join(str(row[k]).strip() for k in ("회계구분","부서명","세부사업명","분야"))
    code="SEOUL_PROJECT_"+hashlib.sha1(stable.encode()).hexdigest()[:16].upper()
    flags=["official_seoul_finance_portal_xlsx","published_project_line","anchor_legal_government_only",f"account:{str(row['회계구분']).strip()}",f"department:{str(row['부서명']).strip()}",f"function:{str(row['분야']).strip()}",f"project:{str(row['세부사업명']).strip()}"]
    return [{"public_entity_id":contract["entity"]["public_entity_id"],"fiscal_year":contract["source"]["fiscal_year"],"fiscal_period":"FY","reporting_scope":contract["entity"]["legal_boundary"],"budget_stage":stage,"budget_side":"expenditure","source_budget_item_type_code":"SEOUL_PROJECT_BUDGET_EXECUTION","functional_paragraph_code":code,"economic_item_code":"UNSPECIFIED","functional_classification_id":"SEOUL_DEPARTMENT_PROJECT_FUNCTION","economic_classification_id":"SEOUL_NOT_PUBLISHED_IN_EXPORT","amount_local":money(row[column]),"currency_code":"KRW","amount_eur":None,"fx_date":None,"is_consolidation_item":False,"is_financing":False,"is_summary_row":False,"source_row_number":row_number,"source_sheet":"사업별 예산정보(지방재정)","source_id":contract["source"]["id"],"ingestion_run_id":run_id,"coverage_type":"official_project_budget_execution_line","is_imputed":False,"quality_flags":flags,"loaded_at":retrieved_at} for column,stage in STAGES]

def load_warehouse(facts,contract,run_id):
    from google.cloud import bigquery
    client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._seoul_project_budget_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
    q=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("id","STRING",contract["entity"]["public_entity_id"]),bigquery.ScalarQueryParameter("year","INT64",contract["source"]["fiscal_year"]),bigquery.ScalarQueryParameter("source","STRING",contract["source"]["id"])])
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE public_entity_id=@id AND fiscal_year=@year AND source_id=@source; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=@year; COMMIT TRANSACTION; DROP TABLE `{stage}`;",job_config=q).result()
    q2=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("id","STRING",contract["entity"]["public_entity_id"]),bigquery.ScalarQueryParameter("name","STRING",contract["entity"]["name"])])
    client.query(f"MERGE `{PROJECT}.{DATASET}.public_entities` t USING (SELECT @id id) s ON t.public_entity_id=s.id WHEN NOT MATCHED THEN INSERT(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at) VALUES(@id,@name,'metropolitan_city_government','KR','KOR',@id,'PSD_SEOUL_ENTITY_ID',FALSE,TRUE,'KRW',CURRENT_TIMESTAMP())",job_config=q2).result()
    q3=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("run","STRING",run_id),bigquery.ScalarQueryParameter("year","INT64",contract["source"]["fiscal_year"])])
    rows=list(client.query(f"SELECT budget_stage,COUNT(*) AS row_count,SUM(amount_local) AS amount FROM `{target}` WHERE fiscal_year=@year AND ingestion_run_id=@run GROUP BY 1 ORDER BY 1",job_config=q3).result())
    counts={r["budget_stage"]:int(r["row_count"]) for r in rows}; expected={stage:len(facts)//3 for _,stage in STAGES}
    if counts!=expected: raise RuntimeError(f"warehouse mismatch {counts} != {expected}")
    return {"warehouse_table":target,"warehouse_rows":sum(counts.values()),"per_stage_rows":counts,"per_stage_amounts":{r["budget_stage"]:str(r["amount"]) for r in rows}}

def main():
    from google.cloud import storage
    parser=argparse.ArgumentParser(); parser.add_argument("--contract",required=True); parser.add_argument("--work",type=Path,required=True); args=parser.parse_args()
    contract=load_contract(args.contract); run_id=os.environ["BUILD_ID"]; args.work.mkdir(parents=True,exist_ok=True); retrieved=datetime.now(timezone.utc).isoformat()
    raw=args.work/"seoul-project-budget-2025.xlsx"; response=fetch_export(contract,raw); rows=source_rows(raw)
    facts=[fact for n,row in enumerate(rows,1) for fact in normalize(row,contract,n,retrieved,run_id)]
    normalized=args.work/"normalized.jsonl"
    with normalized.open("w",encoding="utf-8") as stream:
        for fact in facts: stream.write(json.dumps(fact,ensure_ascii=False,sort_keys=True)+"\n")
    warehouse=load_warehouse(facts,contract,run_id)
    receipt={"status":"warehouse_loaded","run_id":run_id,"retrieved_at":retrieved,"source":{k:contract["source"][k] for k in ("id","title","publisher","finance_portal_url","export_url","fiscal_year")},"entity":contract["entity"],"response":response,"source_project_rows":len(rows),"normalized_facts":len(facts),"raw_sha256":digest(raw),"normalized_sha256":digest(normalized),**warehouse,"normalization":"Every contiguous numbered project retained; published current budget, expenditure, and unspent balance emitted separately; no totals or imputation."}
    completed=args.work/"completed.json"; completed.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
    bucket=storage.Client(project=PROJECT).bucket(BUCKET)
    for path in (raw,normalized,completed): bucket.blob(f"{PREFIX}/{run_id}/{path.name}").upload_from_filename(str(path),if_generation_match=0)
    print(json.dumps(receipt,ensure_ascii=False))
if __name__=="__main__": main()
