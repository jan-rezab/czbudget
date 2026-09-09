#!/usr/bin/env python3
"""Read the official MŠMT 2026 allocation workbook; preserve native fields (openpyxl)."""
import argparse, hashlib, json
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[2]
URL='https://msmt.gov.cz/media/wp-content/uploads/2026/07/Podrobny_rozpis_pro_skoly_na_rok_2026.xlsx'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT/'outputs/czech-source-implementation-20260909/sources/msmt-school-funding-2026.xlsx');args=p.parse_args()
 w=openpyxl.load_workbook(args.input,read_only=True,data_only=True)
 rows=list(w.worksheets[0].values);header=list(rows[7]);assert header[1:4]==['RED_IZO','ICO','ZRIZ']
 records=[]
 for number,row in enumerate(rows[8:],9):
  if row[1] is None:continue
  if not isinstance(row[1],(int,float)):raise ValueError(f'Unexpected entity row {number}')
  record={k:v for k,v in zip(header,row) if k};record['RED_IZO']=str(int(record['RED_IZO']));record['ICO']=str(int(record['ICO'])).zfill(8) if str(record['ICO']).isdigit() else None;record['source_row']=number
  assert abs(record['NIV_CELKEM']-sum(record[k] for k in ['PLATY_CELKEM','ODVODY_CELKEM','FKSP_CELKEM','OBV_CELKEM']))<=1,number
  records.append(record)
 assert len(records)>7000 and len({r['RED_IZO'] for r in records})==len(records)
 definitions={str(r[0]):r[1] for r in w['Položky'].values if r[0] and r[1]}
 output={'schema_version':'1.0.0','year':2026,'concept':'ministry_allocation_not_expenditure','scope':'Schools and after-school clubs established by regions, municipalities or municipal associations. 2026 pedagogical work and specified vocational preparation. Excludes additional regional allocations; not comparable to total school expenditure or previous scope without a bridge.','source':{'url':URL,'sha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),'sheet':w.worksheets[0].title},'native_field_definitions':definitions,'entity_count':len(records),'allocation_czk':sum(r['NIV_CELKEM'] for r in records),'records':records}
 summary={k:v for k,v in output.items() if k not in ('records','native_field_definitions')};summary['records_url']='data/cze-school-funding-2026.v1.json';(ROOT/'website/data/cze-school-funding-2026-summary.v1.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 out=ROOT/'website/data/cze-school-funding-2026.v1.json';out.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');print(f'{len(records)} entities; {output["allocation_czk"]} CZK allocated; all component sums reconcile')
if __name__=='__main__':main()
