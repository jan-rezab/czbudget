#!/usr/bin/env python3
"""Load Lisbon leaf economic-classification execution facts from official DGAL ODS files."""
import hashlib, io, json, re, unicodedata
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import pandas as pd
import requests
from google.cloud import bigquery

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; ENTITY="PT:1106"; YEAR=2024
SOURCES={
 "pt-dgal-municipal-expense-execution-2024": {"side":"expenditure","sheet":"DODES_TOTAL","kind":"Despesas Pagas Líquidas","url":"https://portalautarquico.dgal.gov.pt/ficheiros/?channel=a7187039-4863-4c6c-9ef0-1422b677728d&content_id=146E0A67-200E-4762-9485-1E3DE31F1EF2&dtestate=2025-11-18110913&field=storage_image&filetype=pdf&lang=pt&schema=f7664ca7-3a1a-4b25-9f46-2056eef44c33&ver=1"},
 "pt-dgal-municipal-revenue-execution-2024": {"side":"revenue","sheet":"DOREC_TOTAL","kind":"Receitas Cobradas Líquidas","url":"https://portalautarquico.dgal.gov.pt/ficheiros/?channel=a7187039-4863-4c6c-9ef0-1422b677728d&content_id=C2D515CE-1EA6-4CEA-9FD7-1849E59C2DEC&dtestate=2025-11-17103717&field=storage_image&filetype=pdf&lang=pt&schema=f7664ca7-3a1a-4b25-9f46-2056eef44c33&ver=1"},
}

def parse(body,sid,src,loaded):
 frame=pd.read_excel(io.BytesIO(body),sheet_name=src["sheet"],header=None,engine="odf")
 norm=lambda value: ''.join(c for c in unicodedata.normalize('NFKD',str(value)) if not unicodedata.combining(c)).strip().lower()
 header_index=max(range(len(frame)),key=lambda i: sum(bool(re.fullmatch(r"\d{10}",str(v).strip())) for v in frame.iloc[i]))
 header=[str(v).strip() for v in frame.iloc[header_index].tolist()]
 city_index=next(i for i in range(header_index+1,len(frame)) if any(norm(v)=="lisboa" for v in frame.iloc[i]))
 city_col=next(i for i,v in enumerate(frame.iloc[city_index]) if norm(v)=="lisboa")
 codes={i:v for i,v in enumerate(header) if re.fullmatch(r"\d{10}",v)}
 nonzero={i:(code,Decimal(str(frame.iat[city_index,i]))) for i,code in codes.items() if pd.notna(frame.iat[city_index,i]) and Decimal(str(frame.iat[city_index,i]))!=0}
 leaf=[]
 for col,(code,value) in nonzero.items():
  prefix=code.rstrip("0")
  if any(other!=code and other.startswith(prefix) for _,(other,_) in nonzero.items()): continue
  leaf.append((col,code,value))
 rows=[]
 for col,code,value in leaf:
  rows.append({"public_entity_id":ENTITY,"fiscal_year":YEAR,"fiscal_period":"FY","reporting_scope":"standalone_municipality","budget_stage":"actual","budget_side":src["side"],"source_budget_item_type_code":src["kind"],"functional_paragraph_code":None,"economic_item_code":code,"functional_classification_id":None,"economic_classification_id":"PT_DGAL_ECONOMIC_2024","amount_local":str(abs(value).quantize(Decimal('0.01'))),"currency_code":"EUR","amount_eur":str(abs(value).quantize(Decimal('0.01'))),"fx_date":None,"is_consolidation_item":False,"is_financing":code.startswith(('09','10')),"is_summary_row":False,"source_row_number":city_index+1,"source_sheet":src["sheet"],"source_id":sid,"ingestion_run_id":"pt-lisbon-dgal-2024-v1","coverage_type":"published_subset","is_imputed":False,"quality_flags":["official_dgal_municipal_accounts","legal_municipality_anchor_only","leaf_economic_classification"],"loaded_at":loaded})
 return rows,{"header_row":header_index+1,"source_row":city_index+1,"nonzero_codes":len(nonzero),"leaf_rows":len(rows)}

def main():
 loaded=datetime.now(timezone.utc).isoformat(); facts=[]; receipts={}
 for sid,src in SOURCES.items():
  response=requests.get(src["url"],timeout=120); response.raise_for_status(); body=response.content
  rows,stats=parse(body,sid,src,loaded)
  if len(rows)<20: raise RuntimeError(f"too few Lisbon leaf rows {sid}: {len(rows)}")
  facts.extend(rows); receipts[sid]={"official_url":src["url"],"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"stage":"actual","year":YEAR,"scope":"Lisbon legal municipality","rows_loaded":len(rows),**stats}
 client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._lisbon_city_budget_stage"
 client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
 if client.get_table(stage).num_rows!=len(facts): raise RuntimeError("stage count mismatch")
 client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year={YEAR} AND public_entity_id='{ENTITY}' AND STARTS_WITH(source_id,'pt-dgal-'); INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year={YEAR}; COMMIT TRANSACTION; DROP TABLE `{stage}`;").result()
 receipt={"retrieved_at":loaded,"entity_id":ENTITY,"fiscal_scope":"Lisbon legal municipality only; not the UN built-up area","rows_loaded":len(facts),"sources":receipts}
 Path('/workspace/portugal-receipt.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n'); print(json.dumps(receipt))
if __name__=='__main__': main()
