#!/usr/bin/env python3
"""Derive 2026 YoY/MoM from the exact source vintage's index observations.
No requests; never modifies the original snapshot. Standard library only.
"""
import argparse,csv,json,math,re
from pathlib import Path

def main():
 root=Path(__file__).resolve().parents[2]
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=root/'outputs/20260907-industrial-direct/anglo');p.add_argument('--output',type=Path,default=root/'outputs/20260907-industrial-all/anglo-derived');a=p.parse_args()
 originals=[json.loads(l) for l in (a.source/'observations.jsonl').read_text().splitlines()]
 histories={}
 for raw in sorted({o['raw_file'] for o in originals}):
  related=[o for o in originals if o['raw_file']==raw];country=related[0]['country'];table={}
  if country=='GBR':
   rows=list(csv.reader(Path(raw).read_text(encoding='utf-8-sig').splitlines()));ids=rows[1]
   wanted={o['series_id'] for o in related};columns=[(i,s) for i,s in enumerate(ids) if s in wanted]
   months='JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
   for row in rows:
    m=re.fullmatch(r'(202[456]) ([A-Z]{3})',row[0])
    if not m:continue
    period=f'{m[1]}-{months.index(m[2])+1:02}'
    for i,sid in columns:
     if row[i].strip():table[(sid,period)]=float(row[i])
  elif country=='USA':
   adj=related[0]['adjustment']
   for line in Path(raw).read_text().splitlines():
    m=re.match(r'^"([^"]+)"\s+(202[456])\s+(.+)$',line)
    if not m:continue
    for month,value in enumerate(m[3].split(),1):
     if value not in ('NA','ND','n.a.','.'):
      table[(m[1]+'_'+adj,f'{m[2]}-{month:02}')]=float(value)
  else:raise ValueError(country)
  histories[raw]=table
 output=[];missing=[]
 for o in originals:
  assert o['measure']=='index' and o['frequency']=='M' and o['period'].startswith('2026-')
  table=histories[o['raw_file']];assert table[(o['series_id'],o['period'])]==o['value']
  year,month=map(int,o['period'].split('-'))
  for measure,comparison in [('yoy_pct',f'{year-1}-{month:02}'),('mom_pct',f'{year if month>1 else year-1}-{month-1 if month>1 else 12:02}')]:
   previous=table.get((o['series_id'],comparison))
   if previous is None or previous==0:
    missing.append({'series_id':o['series_id'],'country':o['country'],'period':o['period'],'measure':measure,'reason':'missing or zero denominator'});continue
   value=100*(o['value']/previous-1)
   assert math.isfinite(value)
   # Independent arithmetic formulation guards formula or period/value mixups.
   check=(o['value']-previous)*100/previous
   assert math.isclose(value,check,rel_tol=1e-10,abs_tol=1e-10)
   output.append({**o,'series_id':o['series_id']+':'+measure,'measure':measure,'value':value,'unit':'percent','base_period':None,'raw_value':o['value'],'comparison_value':previous,'comparison_period':comparison,'transformation':'100 * (raw_value / comparison_value - 1)','derived':True,'source_series_id':o['series_id'],'source_base_period':o['base_period'],'publication_date':None})
 keys=[(o['country'],o['series_id'],o['period'],o['adjustment']) for o in output];assert len(keys)==len(set(keys))
 a.output.mkdir(parents=True,exist_ok=True)
 (a.output/'observations.jsonl').write_text(''.join(json.dumps(o,ensure_ascii=False)+'\n' for o in output))
 coverage={'observations':len(output),'countries':{},'skipped':missing,'limitations':['Derived from rounded published indices (ONS generally one decimal; Fed four decimals), so results can differ from officially published growth rates calculated with unrounded inputs.','Publication dates are unknown at observation level; retrieved_at is the preserved source download time, not a release date.','Each numerator and denominator uses the same raw file, source vintage, series and adjustment. No interpolation or adjustment relabelling.','Only derived YoY and MoM observations are included here. The original direct snapshot remains unchanged.']}
 for c in ['GBR','USA']:
  rows=[o for o in output if o['country']==c];coverage['countries'][c]={'observations':len(rows),'periods':sorted({o['period'] for o in rows}),'measures':{m:sum(o['measure']==m for o in rows) for m in ['yoy_pct','mom_pct']}}
 (a.output/'coverage.json').write_text(json.dumps(coverage,indent=2));(a.output/'limitations.json').write_text(json.dumps(coverage['limitations'],indent=2));print(json.dumps(coverage,indent=2))
if __name__=='__main__':main()
