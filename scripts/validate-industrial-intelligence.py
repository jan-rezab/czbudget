#!/usr/bin/env python3
"""Verify archive source checksums and EVERY referenced serving shard."""
import argparse,gzip,hashlib,json
from pathlib import Path
import importlib.util
sp=importlib.util.spec_from_file_location('fetcher',Path(__file__).with_name('fetch-industrial-intelligence.py'));f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--serving',type=Path,default=Path('data/industrial-intelligence'));a=p.parse_args()
 index=json.loads((a.serving/'index.json').read_text());assert index['errors']==index['pending']==0
 source=json.loads((a.source/'manifest.json').read_text());assert source['observations']==index['observations'];assert len(source['datasets'])==len(index['datasets'])
 shards=0;size=0;row_count=0;max_group=0
 for d in index['datasets']:
  code=d['code'];m=json.loads((a.source/'metadata'/f'{code}.json').read_text());meta=json.loads((a.serving/code/'index.json').read_text())
  for folder,key in [('raw','raw_sha256'),('filtered','filtered_sha256')]:assert f.digest(a.source/folder/f'{code}.tsv.gz')==m[key],code
  rows=0
  for group in meta['groups']:
   max_group=max(max_group,sum(s['bytes'] for s in group['shards']))
   for s in group['shards']:
    path=a.serving/code/s['file']
    with gzip.open(path,'rb') as z:raw=z.read()
    assert hashlib.sha256(raw).hexdigest()==s['sha256'],str(path)
    assert path.stat().st_size==s['bytes'];shards+=1;size+=s['bytes'];rows+=s['rows']
  assert rows==meta['series']==m['series'],code;row_count+=rows
  print('VERIFIED',code,flush=True)
 report=dict(verified_at=f.stamp(),datasets=len(index['datasets']),source_files=2*len(index['datasets']),serving_shards=shards,serving_bytes=size,series_rows=row_count,numeric_cells=index['observations'],largest_partition_compressed_bytes=max_group,status='passed')
 f.save(a.source/'validation.json',report);print(json.dumps(report),flush=True)
if __name__=='__main__':main()
