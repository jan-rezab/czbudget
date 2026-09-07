#!/usr/bin/env python3
"""Resumable, bounded-memory Eurostat industrial archive. No fabricated observations.
Full compressed source responses are immutable; filtered TSV retains all dimensions,
all geographies, all source flags and every available period from --start-year.
"""
import argparse, csv, datetime as dt, gzip, hashlib, json, math, os, re, shutil, subprocess, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
BASE='https://ec.europa.eu/eurostat/api/dissemination'

def stamp(): return dt.datetime.now(dt.timezone.utc).isoformat()
def digest(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()
def save(p,obj):
 tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');tmp.replace(p)
def download(url,path):
 tmp=path.with_suffix(path.suffix+'.part')
 result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','2','--retry-delay','2','--connect-timeout','20','--max-time','300',url,'-o',str(tmp)],capture_output=True,text=True)
 if result.returncode: raise RuntimeError(result.stderr[-800:])
 tmp.replace(path)
def process(path,target,start):
 counts={};flags={};cats={};n=0;series=0
 with gzip.open(path,'rt',encoding='utf-8-sig') as src, gzip.open(target.with_suffix('.tmp'),'wt',encoding='utf-8',compresslevel=3) as dst:
  reader=csv.reader(src,delimiter='\t');head=next(reader)
  if '\\' not in head[0]:raise ValueError('Not a Eurostat TSV response')
  dims=head[0].split('\\')[0].split(',');periods=[x.strip() for x in head[1:]]
  take=[i for i,p in enumerate(periods) if re.match(r'^\d{4}',p) and int(p[:4])>=start]
  writer=csv.writer(dst,delimiter='\t',lineterminator='\n');writer.writerow([head[0]]+[periods[i] for i in take]);cats={d:set() for d in dims}
  for row in reader:
   if not row:continue
   keys=row[0].split(',');cells=[row[i+1].strip() if i+1<len(row) else ':' for i in take]
   if len(keys)!=len(dims):raise ValueError('Dimension count mismatch')
   # Preserve flags even when values are suppressed.
   if not any(v not in ('',':') for v in cells):continue
   writer.writerow([row[0]]+cells);series+=1
   for d,k in zip(dims,keys):cats[d].add(k)
   for i,v in zip(take,cells):
    bits=v.split(); flag=' '.join(bits[1:]) if bits else ''
    if flag:flags[flag]=flags.get(flag,0)+1
    try:x=float(bits[0])
    except (ValueError,IndexError):continue
    if not math.isfinite(x):raise ValueError('Nonfinite observation')
    n+=1;counts[periods[i]]=counts.get(periods[i],0)+1
 target.with_suffix('.tmp').replace(target)
 return dict(observations=n,series=series,period_counts=counts,dimensions={k:sorted(v) for k,v in cats.items()},flags=flags,first_period=min(counts,default=None),last_period=max(counts,default=None))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--config',type=Path,default=Path('pipeline/config/industrial-intelligence.json'));p.add_argument('--start-year',type=int,default=2010);p.add_argument('--workers',type=int,default=2);p.add_argument('--only',default='');a=p.parse_args()
 out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
 for d in ['raw','filtered','metadata']: (out/d).mkdir(exist_ok=True)
 config=json.loads(a.config.read_text());save(out/'scope.json',config)
 def task(item):
  code=item['code'];meta_path=out/'metadata'/f'{code}.json';raw=out/'raw'/f'{code}.tsv.gz';filtered=out/'filtered'/f'{code}.tsv.gz'
  if meta_path.exists():
   prior=json.loads(meta_path.read_text())
   if prior.get('status')=='complete' and raw.exists() and filtered.exists() and prior.get('start_year')==a.start_year and digest(filtered)==prior['filtered_sha256']:return prior
  base=BASE.replace('/api/','/api/comext/') if code.startswith('DS-') else BASE
  url=f'{base}/sdmx/2.1/data/{code}?format=TSV&compressed=true'
  m=dict(**item,status='downloading',source_url=url,start_year=a.start_year,retrieved_at=stamp())
  try:
   if not raw.exists():download(url,raw)
   m.update(raw_bytes=raw.stat().st_size,raw_sha256=digest(raw));m.update(process(raw,filtered,a.start_year));m.update(status='complete',filtered_bytes=filtered.stat().st_size,filtered_sha256=digest(filtered))
  except Exception as e:m.update(status='error',error=str(e))
  save(meta_path,m);print(code,m['status'],m.get('observations',0),m.get('error',''),flush=True);return m
 selected=[x for x in config['datasets'] if not a.only or x['code'] in a.only.split(',')]
 with ThreadPoolExecutor(max_workers=max(1,min(a.workers,2))) as pool:
  for f in as_completed([pool.submit(task,x) for x in selected]):f.result()
 records=[json.loads(p.read_text()) for p in sorted((out/'metadata').glob('*.json'))]
 report=dict(generated_at=stamp(),start_year=a.start_year,scope=config['scope'],datasets=records,complete=sum(x['status']=='complete' for x in records),errors=sum(x['status']=='error' for x in records),observations=sum(x.get('observations',0) for x in records))
 save(out/'manifest.json',report);print('SUMMARY',report['complete'],report['errors'],report['observations'],flush=True)
 if report['errors']:raise SystemExit(1)
if __name__=='__main__':main()
