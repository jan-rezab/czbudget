#!/usr/bin/env python3
"""Merge tiny serving shards without changing a single row or source field.
Input remains untouched. The output is a separate, resumable serving release.
"""
import argparse,gzip,hashlib,json,shutil
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 assert a.source.resolve()!=a.output.resolve()
 a.output.mkdir(parents=True,exist_ok=True)
 for index in sorted(a.source.glob('*/index.json')):
  m=json.loads(index.read_text());target=a.output/index.parent.name;target.mkdir(exist_ok=True)
  out=target/'index.json'
  if out.exists() and json.loads(out.read_text()).get('serving_version')==3:continue
  count=0
  for group in m['groups']:
   buffer=[];shards=[]
   def flush():
    if not buffer:return
    name=f"{group['geo']}--{group['bucket']}--{len(shards)}.json.gz"
    raw=json.dumps(buffer,ensure_ascii=False,separators=(',',':')).encode();dest=target/name
    with dest.open('wb') as f:
     with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0,compresslevel=6) as z:z.write(raw)
    shards.append(dict(file=name,sha256=hashlib.sha256(raw).hexdigest(),rows=len(buffer),bytes=dest.stat().st_size));buffer.clear()
   for s in group['shards']:
    raw=gzip.decompress((index.parent/s['file']).read_bytes())
    assert hashlib.sha256(raw).hexdigest()==s['sha256']
    rows=json.loads(raw);assert len(rows)==s['rows']
    for row in rows:
     buffer.append(row);count+=1
     if len(buffer)>=5000:flush()
   flush();assert sum(x['rows'] for x in shards)==group['rows'];group['shards']=shards
  assert count==m['series'];m['serving_version']=3;out.write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n');print(m['code'],count,flush=True)
 for name in ['index.json','labels.json']:shutil.copyfile(a.source/name,a.output/name)
if __name__=='__main__':main()
