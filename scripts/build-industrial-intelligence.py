#!/usr/bin/env python3
"""Lossless static serving shards for the industrial archive. Bounded memory.
Every retained TSV row is represented once, including missing/suppressed cells.
No geography, measure, industry, adjustment, unit or source flag is discarded.
"""
import argparse,csv,gzip,hashlib,json,re,sys
from pathlib import Path
from collections import defaultdict
import importlib.util
spec=importlib.util.spec_from_file_location('fetcher',Path(__file__).with_name('fetch-industrial-intelligence.py'));fetcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(fetcher)

def dump(path,data):
 path.parent.mkdir(parents=True,exist_ok=True)
 raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()
 with path.open('wb') as out:
  with gzip.GzipFile(fileobj=out,mode='wb',mtime=0,compresslevel=5) as z:z.write(raw)
 return dict(file=path.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=path.stat().st_size)

def group_key(d):
 if 'product' in d:return d['product'][:2]
 if 'nace_r2' in d:return d['nace_r2'][0] if d['nace_r2'] else 'all'
 return 'all'
def build_one(m,source,out):
 code=m['code'];target=out/code;index=target/'index.json'
 if index.exists():
  old=json.loads(index.read_text())
  if old.get('filtered_sha256')==m['filtered_sha256'] and old.get('builder_version')==2 and old.get('geography_dimension')==next((d for d in ['geo','reporter','geo_exp','geo_origin','geo_orig','geo_imp','c_exp','c_orig','c_dest','c_imp','c_ctrl','partner'] if d in old['dimension_order']),None):return old
 target.mkdir(parents=True,exist_ok=True)
 buffers=defaultdict(list);groups={};total=0
 def flush(key):
  rows=buffers[key]
  if not rows:return
  group=groups[key];i=len(group['shards']);name=f'{key[0]}--{key[1]}--{i}.json.gz'
  assert re.fullmatch(r'[A-Za-z0-9_.-]+',name)
  meta=dump(target/name,rows);meta['rows']=len(rows);group['shards'].append(meta);buffers[key]=[]
 with gzip.open(source/'filtered'/f'{code}.tsv.gz','rt') as f:
  reader=csv.reader(f,delimiter='\t');head=next(reader);dims=head[0].split('\\')[0].split(',');periods=head[1:]
  geodim=next((d for d in ['geo','reporter','geo_exp','geo_origin','geo_orig','geo_imp','c_exp','c_orig','c_dest','c_imp','c_ctrl','partner'] if d in dims),None)
  for row in reader:
   keys=row[0].split(',');d=dict(zip(dims,keys));geo=d.get(geodim,'ALL');bucket=group_key(d);key=(geo,bucket)
   if key not in groups:groups[key]=dict(geo=geo,bucket=bucket,shards=[],rows=0)
   groups[key]['rows']+=1;total+=1;buffers[key].append([keys,row[1:]])
   if len(buffers[key])>=1500:flush(key)
   # cap cross-geography buffering, not just individual shards
   if total%15000==0:
    for k in list(buffers):flush(k)
 for k in buffers:flush(k)
 assert total==m['series'],(code,total,m['series'])
 result={k:v for k,v in m.items() if k not in ['raw_bytes','raw_sha256']}
 result.update(builder_version=2,geography_dimension=geodim,dimension_order=dims,periods=periods,groups=list(groups.values()),served_rows=total)
 fetcher.save(index,result);print('BUILD',code,total,len(groups),flush=True);return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('data/industrial-intelligence'));a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 config=json.loads((a.source/'scope.json').read_text());records=[]
 for item in config['datasets']:
  path=a.source/'metadata'/f"{item['code']}.json"
  if not path.exists():records.append(dict(**item,status='pending'));continue
  m=json.loads(path.read_text())
  if m['status']!='complete':records.append(m);continue
  result=build_one(m,a.source,a.output)
  records.append({k:v for k,v in result.items() if k not in ['dimensions','groups','period_counts','periods','flags']})
 report=dict(generated_at=fetcher.stamp(),start_year=2010,scope=config['scope'],datasets=records,complete=sum(x['status']=='complete' for x in records),errors=sum(x['status']=='error' for x in records),pending=sum(x['status']=='pending' for x in records),observations=sum(x.get('observations',0) for x in records))
 fetcher.save(a.output/'index.json',report)
 print('SERVED',report['complete'],report['errors'],report['pending'],report['observations'],flush=True)
if __name__=='__main__':main()
