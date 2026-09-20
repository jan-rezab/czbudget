#!/usr/bin/env python3
"""Load Calgary's official approved 2023-2026 business-unit budget rows."""
import hashlib,json
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
import requests
from google.cloud import bigquery

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; ENTITY="CA:4806016"
SID="ca-calgary-open-budget-2023-2026"; URL="https://data.calgary.ca/resource/fqax-i3nz.json?$limit=50000"
def main():
 loaded=datetime.now(timezone.utc).isoformat(); response=requests.get(URL,timeout=120); response.raise_for_status(); body=response.content; source=response.json(); facts=[]
 for n,row in enumerate(source,1):
  if row.get('budget_status')!='Approved': continue
  year=int(row['year']); fund=row.get('fund','Unspecified'); amount=(Decimal(row['budget'])*Decimal('1000000')).quantize(Decimal('0.01'))
  if amount==0 or year not in range(2023,2027): continue
  side='revenue' if 'revenue' in fund.lower() else 'expenditure'
  function=' > '.join(row.get(k) or 'Unspecified' for k in ('budget_department','actual_department','level_2','business_unit'))
  facts.append({"public_entity_id":ENTITY,"fiscal_year":year,"fiscal_period":"FY","reporting_scope":"standalone_municipality","budget_stage":"enacted","budget_side":side,"source_budget_item_type_code":fund,"functional_paragraph_code":function,"economic_item_code":fund,"functional_classification_id":"CA_CALGARY_BUSINESS_UNIT_2023_2026","economic_classification_id":"CA_CALGARY_FUND_2023_2026","amount_local":str(abs(amount)),"currency_code":"CAD","amount_eur":None,"fx_date":None,"is_consolidation_item":False,"is_financing":False,"is_summary_row":False,"source_row_number":n,"source_sheet":"Calgary Open Budget","source_id":SID,"ingestion_run_id":SID+'-v1',"coverage_type":"published_subset","is_imputed":False,"quality_flags":["official_city_open_data","approved_budget","amount_source_unit_millions","legal_municipality_anchor_only"],"loaded_at":loaded})
 if len(facts)<100: raise RuntimeError(f'too few approved rows: {len(facts)}')
 client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._calgary_city_budget_stage"
 client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
 if client.get_table(stage).num_rows!=len(facts): raise RuntimeError('stage mismatch')
 client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year BETWEEN 2023 AND 2026 AND public_entity_id='{ENTITY}' AND source_id='{SID}'; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year BETWEEN 2023 AND 2026; COMMIT TRANSACTION; DROP TABLE `{stage}`;").result()
 counts={str(y):sum(r['fiscal_year']==y for r in facts) for y in range(2023,2027)}
 receipt={"retrieved_at":loaded,"official_url":URL,"sha256":hashlib.sha256(body).hexdigest(),"source_bytes":len(body),"entity_id":ENTITY,"fiscal_scope":"City of Calgary legal municipality only; not the UN built-up area","stage":"enacted","years":[2023,2024,2025,2026],"rows_loaded":len(facts),"rows_by_year":counts,"amount_source_unit":"millions CAD; scaled to CAD"}
 Path('/workspace/calgary-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n'); print(json.dumps(receipt))
if __name__=='__main__': main()
