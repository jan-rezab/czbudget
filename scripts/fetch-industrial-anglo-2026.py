#!/usr/bin/env python3
"""Direct ONS DIOP and Federal Reserve G17 snapshot, 2026 reference months only.
Uses curl for TLS/CDN compatibility. No intermediary data provider or derived growth.
"""
import argparse,csv,datetime,hashlib,json,math,re,subprocess
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[2]/'outputs/20260907-industrial-direct/anglo');args=p.parse_args()
 out=args.output; (out/'raw').mkdir(parents=True,exist_ok=True)
 manifest=[];obs=[];failures={}
 def fetch(name,url):
  path=out/'raw'/name
  subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','2','--max-time','90',url,'-o',str(path)],check=True)
  data=path.read_bytes();m={'source_url':url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'raw_file':str(path.resolve()),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)};manifest.append(m);return data.decode('utf-8-sig'),m
 def add(country,publisher,dataset,sid,code,label,period,adj,value,m):
  v=float(value)
  assert math.isfinite(v)
  obs.append(dict(country=country,publisher=publisher,dataset=dataset,series_id=sid,industry_code=code,industry_label=label,frequency='M',period=period,measure='index',adjustment=adj,unit='index ('+('2023' if country=='GBR' else '2017')+'=100)',base_period=('2023' if country=='GBR' else '2017'),value=v,status='unknown',**{k:m[k] for k in ['source_url','retrieved_at','raw_file']}))
 try:
  meta,_=fetch('ons-k222-metadata.json','https://www.ons.gov.uk/economy/economicoutputandproductivity/output/timeseries/k222/diop/data')
  assert '2023=100' in json.dumps(json.loads(meta), ensure_ascii=False), 'ONS reference year documentation changed'
  text,m=fetch('ons-diop.csv','https://www.ons.gov.uk/file?uri=/economy/economicoutputandproductivity/output/datasets/indexofproduction/current/diop.csv')
  rows=list(csv.reader(text.splitlines())); titles=rows[0];ids=rows[1]
  cols=[]
  for i,title in enumerate(titles):
   match=re.fullmatch(r'IOP:\s*([^:]+):\s*(.*?):\s*CVM(NSA|SA)',title)
   if match: cols.append((i,*match.groups()))
  assert len(cols)>100,'ONS schema changed'
  base=next(row for row in rows if row[0]=='2023')
  assert all(float(base[i])==100 for i,*_ in cols), 'ONS reference year mismatch'
  months='JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
  for row in rows:
   if re.fullmatch(r'2026 [A-Z]{3}',row[0]):
    period='2026-%02d'%(months.index(row[0][5:])+1)
    for i,code,label,adj in cols:
     if row[i].strip():add('GBR','Office for National Statistics','DIOP',ids[i],code.strip(),label.strip(),period,adj,row[i],m)
 except Exception as e:failures['GBR']=str(e)
 try:
  meta,_=fetch('fed-current-release.html','https://www.federalreserve.gov/releases/g17/current/default.htm')
  assert '2017=100' in meta, 'Federal Reserve reference year changed'
  doc,_=fetch('fed-production-file-documentation.html','https://www.federalreserve.gov/releases/g17/Current/ipdisk/table1_2.htm')
  assert 'ip_sa.txt' in doc and 'ip_nsa.txt' in doc and 'Industrial Production' in doc
 except Exception as e:
  failures['USA_metadata']=str(e)
 for adj,file in ([] if 'USA_metadata' in failures else [('SA','ip_sa.txt'),('NSA','ip_nsa.txt')]):
  try:
   text,m=fetch('fed-'+file,'https://www.federalreserve.gov/releases/g17/Current/ipdisk/'+file)
   labels={}
   for line in text.splitlines():
    label=re.fullmatch(r'"([^:"]+):\s*(.*?)"',line.strip())
    if label:labels[label[1]]=label[2];continue
    row=re.match(r'^"([^"]+)"\s+2026\s+(.+)$',line)
    if row:
     code=row[1]; assert code in labels
     for month,value in enumerate(row[2].split(),1):
      assert month<=12
      if value not in ('NA','ND','n.a.','.'):add('USA','Board of Governors of the Federal Reserve System','G17 industrial production',code+'_'+adj,code,labels[code],f'2026-{month:02}',adj,value,m)
  except Exception as e:failures['USA_'+adj]=str(e)
 keys=[(o['country'],o['series_id'],o['period'],o['measure'],o['adjustment']) for o in obs];assert len(keys)==len(set(keys))
 (out/'observations.jsonl').write_text(''.join(json.dumps(o,ensure_ascii=False)+'\n' for o in obs))
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
 coverage={'countries':{},'failures':failures,'blocked_countries':[c for c in ['GBR','USA'] if not any(o['country']==c for o in obs)],'limitations':['Only published monthly index observations retained; no fabricated or calculated growth. Raw downloads retain historical years because publishers offer full files.','Latest vintage, not an archive of each original release; revision status unknown at individual observation level.','Bases verified from official metadata and source values: ONS 2023=100; Federal Reserve 2017=100. US raw files are production-only tables 1/2/10, not capacity or utilization.','GBR includes production-volume index series labelled IOP/CVM only, excludes nominal turnover, weights and separately published growth series.','Industry codes retain publisher classification (UK SIC and US G17 series codes); no cross-country harmonisation applied.']}
 for c in ['GBR','USA']:
  records=[o for o in obs if o['country']==c]
  coverage['countries'][c]={'observations':len(records),'periods':sorted({o['period'] for o in records}),'categories':len({o['industry_code'] for o in records}),'series':len({o['series_id'] for o in records}),'adjustments':sorted({o['adjustment'] for o in records})}
 (out/'coverage.json').write_text(json.dumps(coverage,indent=2));print(json.dumps(coverage,indent=2))
 if failures:raise SystemExit(1)
if __name__=='__main__':main()
