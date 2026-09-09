#!/usr/bin/env python3
"""Replace only ČSÚ PRU01B/C series points with full native monthly/quarterly history."""
import argparse,csv,gzip,hashlib,json,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--source-dir',type=Path,default=ROOT.parent/'outputs/czech-source-implementation-20260909/sources');a=p.parse_args()
out=ROOT/'data/industry';path=out/'CZE.json';d=json.loads(path.read_text() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()))
old_count=sum(len(s['points']) for s in d['series']);stamp=datetime.now(timezone.utc).isoformat();source_meta=[]
for ds in ['PRU01B','PRU01C']:
 raw=(a.source_dir/f'{ds}.csv').read_bytes();groups={};labels={}
 for r in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
  period=r.get('CASMKMMQR',r.get('CASMQ',''))
  if not re.fullmatch(r'\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])',period):continue
  typ=r.get('TYPUDAJEZ',r.get('TYPUDAJEP2'));measure='index' if typ=='IZ2021' else 'yoy_pct' if 'Meziroční' in r['Typ indexu'] else 'mom_pct' if 'Meziměsíční' in r['Typ indexu'] else 'qoq_pct' if 'Mezičtvrtletní' in r['Typ indexu'] else None
  if not measure:continue
  try:value=float(r['Hodnota'])
  except ValueError:continue
  if measure!='index':value-=100
  code=r['NACEIPP.NACE2'] or r['NACEIPP.NACE1'];adj={'P':'CA','O':'SCA','N':'NSA'}[r.get('OCIST2',r.get('OCIST3'))];frequency='Q' if 'Q' in period else 'M'
  key=(code,measure,adj,frequency);labels[code]=r['CZ-NACE-Oddíl'] or r['CZ-NACE-Sekce'];g=groups.setdefault(key,{})
  if period in g:raise ValueError(f'Duplicate {key}/{period}')
  g[period]={'period':period,'value':value,'status':'unknown','derived':False,'source_status':None}
 matched=set()
 for s in d['series']:
  if s['channel']!='national' or s['dataset']!=ds:continue
  key=(s['industry_code'],s['measure'],s['adjustment'],s['frequency'])
  if key in groups:s['points']=[v for k,v in sorted(groups[key].items())];s['retrieved_at']=stamp;matched.add(key)
 # Native Q series absent from the previous monthly-only mart remain available separately.
 extra=[{'industry_code':k[0],'measure':k[1],'adjustment':k[2],'frequency':k[3],'unit':'index_points' if k[1]=='index' else 'percent','base_period':'2021' if k[1]=='index' else None,'points':[v for p,v in sorted(g.items())]} for k,g in groups.items() if k not in matched]
 for item in extra:
  template=next((s for s in d['series'] if s['channel']=='national' and s['industry_code']==item['industry_code']),{})
  native_id=f"{ds}:{item['industry_code']}:{item['measure']}:{item['adjustment']}:{item['frequency']}"
  d['series'].append({**template,**item,'id':hashlib.sha256(native_id.encode()).hexdigest()[:20],'source_series_id':native_id,'channel':'national','publisher':'Czech Statistical Office','dataset':ds,'source_url':f'https://data.csu.gov.cz/opendata/sady/{ds}/distribuce/csv','retrieved_at':stamp,'label_cs':template.get('label_cs',labels[item['industry_code']]),'label_en':template.get('label_en',labels[item['industry_code']]),'original_label':labels[item['industry_code']],'is_total':template.get('is_total',item['industry_code']=='B-D'),'level':template.get('level','division' if item['industry_code'].isdigit() else 'section')})
 (out/f'CZE-{ds}-additional.json').write_text(json.dumps({'dataset':ds,'source_url':f'https://data.csu.gov.cz/opendata/sady/{ds}/distribuce/csv','series':[{'industry_code':k[0],'measure':k[1],'adjustment':k[2],'frequency':k[3],'points':[v for p,v in sorted(g.items())]} for k,g in groups.items()]},ensure_ascii=False,separators=(',',':'))+'\n')
 source_meta.append({'dataset':ds,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved_at':stamp,'series':len(groups),'observations':sum(len(g) for g in groups.values()),'additional_file':f'/data/industry/CZE-{ds}-additional.json'})
 assert matched and min(p['period'] for s in d['series'] if s['dataset']==ds for p in s['points'])<'2001'
d['native_history_sources']=source_meta
body=(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n').encode();path.write_bytes(body);Path(str(path)+'.gz').write_bytes(gzip.compress(body,mtime=0))
m=json.loads((out/'archive-manifest.json').read_text());item=next(x for x in m if x['file']=='CZE.json');item.update(sha256=hashlib.sha256(body).hexdigest(),bytes=len(body));(out/'archive-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
i=json.loads((out/'index.json').read_text());i['counts']['observations']+=sum(len(s['points']) for s in d['series'])-old_count;c=next(x for x in i['countries'] if x['code']=='CZE');c['monthly_periods']=sorted({p['period'] for s in d['series'] if s['frequency']=='M' for p in s['points']});i['generated_at']=stamp;(out/'index.json').write_text(json.dumps(i,ensure_ascii=False,separators=(',',':'))+'\n');print(source_meta)
