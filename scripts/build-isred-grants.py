#!/usr/bin/env python3
"""Publish verified ISReD relational tables without flattening one-to-many grant stages."""
import argparse,csv,gzip,json,hashlib,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'data/source_cache/isred';OUT=ROOT/'website/data'
TABLES={'prijemce':'iriPrijemce','dotace':'iriDotace','rozhodnuti':'iriRozhodnuti','rozpoctoveobdobi':'iriRozpoctoveObdobi','ciselnikdotaceposkytovatel':'iriDotacePoskytovatel'}
def inspect(path,required):
 count=0;exports=set();fields=None
 with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:
  reader=csv.DictReader(f);fields=reader.fieldnames
  if required not in fields:raise ValueError(f'{path}: missing source key {required}')
  for row in reader:
   if None in row:raise ValueError(f'{path}: extra source columns at row {count+2}')
   if not row[required]:raise ValueError(f'{path}: missing key at row {count+2}')
   count+=1
   if row.get('datumExportu'):exports.add(row['datumExportu'][:10])
 return {'rows':count,'columns':fields,'export_dates':sorted(exports),'source_key':required}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--table',choices=list(TABLES));args=parser.parse_args()
 dest=OUT/'isred';dest.mkdir(exist_ok=True);tables=[]
 manifest=OUT/'czech-isred-grants.v1.json'
 if args.table and manifest.exists():tables=[t for t in json.loads(manifest.read_text())['tables'] if t['table']!=args.table]
 for name,key in TABLES.items():
  if args.table and args.table!=name:continue
  p=CACHE/(name+'.csv.gz');meta=inspect(p,key);lineage=json.loads(p.with_suffix(p.suffix+'.source.json').read_text())
  h=hashlib.sha256()
  with p.open('rb') as f:
   for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
  if h.hexdigest()!=lineage['sha256']:raise ValueError('Cache changed after download')
  shards=[];handle=None;writer=None
  try:
   with gzip.open(p,'rt',encoding='utf-8-sig',newline='') as source:
    reader=csv.reader(source);header=next(reader)
    for n,row in enumerate(row for row in reader if row):
     if n%50000==0:
      if handle:handle.close();tmp.replace(target);assert target.stat().st_size<20_000_000
      target=dest/(name+f'-{n//50000:04d}.csv.gz');tmp=target.with_suffix('.tmp');handle=gzip.open(tmp,'wt',encoding='utf-8',newline='');writer=csv.writer(handle);writer.writerow(header);shards.append('data/isred/'+target.name)
     writer.writerow(row)
    if handle:handle.close();handle=None;tmp.replace(target);assert target.stat().st_size<20_000_000
  finally:
   if handle:handle.close()
  if not shards or n+1 != meta['rows']:raise ValueError('Published shard row count differs from verified source')
  tables.append(dict(meta,table=name,source=lineage,detail_paths=shards));print(name,meta['rows'],len(shards),flush=True)
 result={'schema_version':1,'core_tables_complete':len(tables)==len(TABLES),'required_tables':list(TABLES),'discovered_csv_distributions':json.loads((CACHE/'downloads.json').read_text()),'auxiliary_tables_status':'discovered_not_ingested','country':'CZE','source_documentation':'https://data.mf.gov.cz/topics/dotace.html','tables':tables,'grain':'Five relational source tables; preserve IRIs and join cardinality.','relations':[{'from':'dotace.iriPrijemce','to':'prijemce.iriPrijemce'},{'from':'rozhodnuti.iriDotace','to':'dotace.iriDotace'},{'from':'rozpoctoveobdobi.iriRozhodnuti','to':'rozhodnuti.iriRozhodnuti'},{'from':'rozhodnuti.iriDotacePoskytovatel','to':'ciselnikdotaceposkytovatel.iriDotacePoskytovatel'}],'stages':{'castkaPozadovana':'requested','castkaRozhodnuta':'decided','castkaCerpana':'drawn','castkaSpotrebovana':'consumed','castkaUvolnena':'released','castkaVracena':'returned'},'scope_notes':['Recipient IRIs are source records; multiple records may share IČO.','Decisions and annual budget periods are separate, potentially one-to-many; do not sum after a naive join.','Source export dates reflect data vintage, not retrieval date.','ISReD includes state budget, state funds, state financial assets and National Fund transfers; not identical to new MONITOR state register.','No inferred project-ID equivalence or combined totals across ISReD, MONITOR and DotaceEU.']}
 (OUT/'czech-isred-grants.v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
