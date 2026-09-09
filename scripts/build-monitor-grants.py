#!/usr/bin/env python3
"""MONITOR RISPF paid grant facts, separate from C063 transfers and ISReD decisions."""
import csv,gzip,io,json,zipfile,hashlib
from pathlib import Path
from decimal import Decimal
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'data/source_cache/monitor-grants';OUT=ROOT/'website/data'
def main():
 meta=json.loads((CACHE/'rispf-metadata.json').read_text());p=CACHE/(meta['distribuce'][0]['soubor_ke_stažení'].rsplit('/',1)[1].replace('_Data_CSUIS',''));counts=Counter();n=0
 dest=OUT/'monitor-grants/paid-facts.ndjson.gz';dest.parent.mkdir(exist_ok=True);tmp=dest.with_suffix('.tmp')
 with zipfile.ZipFile(p) as z,gzip.open(tmp,'wt',encoding='utf8') as out:
  name=next(x for x in z.namelist() if x.endswith('.csv'));r=csv.reader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig'),delimiter=';');headers=next(r);keys=[h.split(' ',1)[0] for h in headers]
  if len(set(keys))!=len(keys):raise ValueError('Duplicate technical fields')
  for row in r:
   if not row:continue
   if len(row)!=len(keys):raise ValueError('Source row width mismatch')
   d=dict(zip(keys,row));month=d['CALMONTH']
   start=meta['časové_pokrytí']['začátek'][:7].replace('-','');end=meta['časové_pokrytí']['konec'][:7].replace('-','')
   if not start<=month<=end:raise ValueError('Unexpected period '+month)
   if d['CURRENCY']!='CZK':raise ValueError('Unexpected currency')
   value=d['ZU_ROZKZ'].replace(',','.').strip();value='-'+value[:-1] if value.endswith('-') else value
   amount=Decimal(value);counts[month]+=1;n+=1
   obj={'source_row':n+1,'project_id':d['ZC_EDS'],'beneficiary_ico':d['ZC_1PRIJ__ZC_1ICO'],'month':month,'stage':'paid','paid_czk':float(amount),'source_dimensions':d}
   out.write(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n')
 tmp.replace(dest)
 result={'schema_version':1,'country':'CZE','source_metadata':meta,'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_columns':headers,'row_count':n,'month_counts':dict(counts),'detail_path':'data/monitor-grants/paid-facts.ndjson.gz','stage':'paid','grain':'Source grant payment dimensional fact; not a unique award.','scope_notes':['State budget grants and repayable financial assistance; not all public sector transfers.','Quarterly distribution contains monthly payment facts, not the C063 YTD measure.','Preserve EDS/SMVS/ZED IDs; no inferred equivalence to ISReD or DotaceEU project IDs.','Do not combine totals with C063, ISReD or DotaceEU without explicit overlap reconciliation.']}
 (OUT/'czech-monitor-grants.v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(n,dict(counts))
if __name__=='__main__':main()
