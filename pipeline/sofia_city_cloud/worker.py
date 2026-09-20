#!/usr/bin/env python3
"""Load coded enacted 2025 Sofia municipal budget lines from official XLS annexes."""
import hashlib, io, json, math, re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import pandas as pd
import requests
from google.cloud import bigquery

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; ENTITY="BG:68134"
SOURCES={
 "bg-sofia-approved-revenue-2025":{"side":"revenue","url":"https://svc.sofia.bg/documents/d/guest/1-prilozenie-1-za-prihodite-po-budzeta-na-stolicna-obsina-za-2025g"},
 "bg-sofia-approved-expenditure-2025":{"side":"expenditure","url":"https://svc.sofia.bg/documents/d/guest/2-prilozenie-2-za-razhodite-po-budzeta-na-stolicna-obsina-za-2025-g"},
}

def value(cell):
 if pd.isna(cell) or str(cell).strip()=="": return None
 try:
  out=Decimal(str(cell)); return out if out and out.is_finite() else None
 except Exception: return None

def clean_code(cell):
 if pd.isna(cell): return ""
 text=str(cell).strip()
 if re.fullmatch(r"\d+\.0",text): text=text[:-2]
 return re.sub(r"\s+","",text)

def session():
 s=requests.Session(); s.headers.update({"User-Agent":"Mozilla/5.0 (compatible; PublicSpendingData/1.0)","Referer":"https://svc.sofia.bg/bg/web/guest/2025-financial-year"})
 s.get("https://svc.sofia.bg/bg/web/guest/2025-financial-year",timeout=120); return s

def parse(body,sid,side,loaded):
 frame=pd.read_excel(io.BytesIO(body),sheet_name="2025",header=None,engine="xlrd")
 candidates=[]
 if side=="revenue":
  for i,row in frame.iterrows():
   code=clean_code(row.iloc[1] if len(row)>1 else "")
   if code and re.fullmatch(r"\d+",code):
    for year,stage,col in ((2024,"actual",4),(2025,"enacted",6)):
     amount=value(row.iloc[col] if len(row)>col else None)
     if amount is not None: candidates.append((i,code,str(row.iloc[0]).strip(),amount,None,year,stage))
  codes={code.zfill(4) for _,code,_,amount,_,_,_ in candidates if amount}
  def summary(code):
   padded=code.zfill(4); return padded.endswith("00") and any(other[:2]==padded[:2] and other!=padded for other in codes)
 else:
  for i,row in frame.iterrows():
   function=clean_code(row.iloc[0] if len(row)>0 else ""); economic=clean_code(row.iloc[1] if len(row)>1 else "")
   if function and economic and re.fullmatch(r"\d+",function) and re.fullmatch(r"\d{2}-\d{2}",economic):
    for year,stage,col in ((2024,"actual",5),(2025,"enacted",7)):
     amount=value(row.iloc[col] if len(row)>col else None)
     if amount is not None: candidates.append((i,economic,str(row.iloc[2]).strip(),amount,function,year,stage))
  pairs={(function,code) for _,code,_,amount,function,_,_ in candidates if amount}
  def summary_pair(function,code):
   return code.endswith("-00") and any(f==function and c[:2]==code[:2] and c!=code for f,c in pairs)
 rows=[]; seen_revenue=set()
 for i,code,name,amount,function,year,stage in candidates:
  is_summary=summary(code) if side=="revenue" else summary_pair(function,code)
  if is_summary or amount==0: continue
  if side=="revenue" and (year,code) in seen_revenue: continue
  if side=="revenue": seen_revenue.add((year,code))
  row_side="financing" if side=="revenue" and int(code)>=7000 else side
  rows.append({"public_entity_id":ENTITY,"fiscal_year":year,"fiscal_period":"FY","reporting_scope":"sofia_municipality_consolidated_budget","budget_stage":stage,"budget_side":row_side,"source_budget_item_type_code":name,"functional_paragraph_code":function,"economic_item_code":f"{row_side}:{code}","functional_classification_id":"BG_EBK_FUNCTION_2025" if function else None,"economic_classification_id":"BG_EBK_ECONOMIC_2025","amount_local":str(abs(amount)),"currency_code":"BGN","amount_eur":None,"fx_date":None,"is_consolidation_item":False,"is_financing":row_side=="financing","is_summary_row":False,"source_row_number":int(i)+1,"source_sheet":"2025","source_id":sid,"ingestion_run_id":"bg-sofia-budget-2024-2025-v2","coverage_type":"published_subset","is_imputed":False,"quality_flags":["official_sofia_municipality_budget","approved_2025_annex","prior_year_actual_in_2025_annex" if year==2024 else "approved_2025_amount","coded_leaf_or_lowest_published_line","anchor_only_not_un_agglomeration","first_consolidated_occurrence_per_revenue_code" if side=="revenue" else "function_economic_pair"],"loaded_at":loaded})
 return rows,{"coded_candidates":len(candidates),"rows_loaded":len(rows),"excluded_parent_or_zero":len(candidates)-len(rows)}

def main():
 loaded=datetime.now(timezone.utc).isoformat(); facts=[]; receipts={}; s=session()
 for sid,src in SOURCES.items():
  r=s.get(src["url"],timeout=120); r.raise_for_status(); body=r.content
  rows,stats=parse(body,sid,src["side"],loaded)
  if len(body)<100000 or len(rows)<20: raise RuntimeError(f"source contract failed {sid}: bytes={len(body)} rows={len(rows)}")
  facts.extend(rows); receipts[sid]={"official_url":src["url"],"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"years":[2024,2025],"stages":["actual","enacted"],"side":src["side"],**stats}
 client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._sofia_city_budget_stage"
 client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
 if client.get_table(stage).num_rows!=len(facts): raise RuntimeError("stage row mismatch")
 client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year BETWEEN 2024 AND 2025 AND public_entity_id='{ENTITY}' AND STARTS_WITH(source_id,'bg-sofia-approved-'); INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year BETWEEN 2024 AND 2025; COMMIT TRANSACTION; DROP TABLE `{stage}`;").result()
 receipt={"retrieved_at":loaded,"entity_id":ENTITY,"fiscal_scope":"Sofia Municipality consolidated budget anchor only; not the UN built-up area","rows_loaded":len(facts),"sources":receipts}
 Path('/workspace/sofia-receipt.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n'); print(json.dumps(receipt,ensure_ascii=False))
if __name__=='__main__': main()
