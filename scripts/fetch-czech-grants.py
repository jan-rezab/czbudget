#!/usr/bin/env python3
"""Download official grant inputs sequentially with TLS verification and atomic cache writes."""
import argparse,json,subprocess,hashlib
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'data/source_cache'
QUERY='SELECT ?s ?d ?p ?v WHERE { ?s <http://www.w3.org/ns/dcat#distribution> ?d . ?d ?p ?v FILTER(CONTAINS(STR(?s), "red---")) }'
def fetch(url,path):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix(path.suffix+'.tmp')
 headers=['-H','Accept: application/sparql-results+json'] if '/lod/sparql?' in url else []
 subprocess.run(['curl','-fsSL','--retry','2','--max-time','600',*headers,url,'-o',str(tmp)],check=True)
 tmp.replace(path)
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 path.with_suffix(path.suffix+'.source.json').write_text(json.dumps({'url':url,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':h.hexdigest()})+'\n')
 return path

def main():
 a=argparse.ArgumentParser();a.add_argument('--source',choices=['isred','monitor','dotaceeu'],required=True);args=a.parse_args()
 if args.source=='isred':
  p=fetch('https://data.mf.gov.cz/lod/sparql?'+urlencode({'query':QUERY,'format':'application/sparql-results+json'}),CACHE/'isred/catalog-distributions.json')
  rows=json.loads(p.read_text())['results']['bindings'];urls=sorted({r['v']['value'] for r in rows if r['p']['value'].endswith('#downloadURL') and r['v']['value'].endswith('.csv.gz')})
  (CACHE/'isred/downloads.json').write_text(json.dumps(urls,indent=2)+'\n')
  for u in urls:
   if u.rsplit('/',1)[1] in ['dotace.csv.gz','rozhodnuti.csv.gz','rozpoctoveobdobi.csv.gz','prijemce.csv.gz','ciselnikdotaceposkytovatel.csv.gz']:fetch(u,CACHE/'isred'/u.rsplit('/',1)[1])
 elif args.source=='monitor':
  p=fetch('https://monitor.statnipokladna.gov.cz/api/opendata/monitor',CACHE/'monitor-grants/catalog.json');cat=json.loads(p.read_text());url=sorted(u for u in cat['datová_sada'] if '/rispf/' in u)[-1]
  p=fetch(url,CACHE/'monitor-grants/rispf-metadata.json');meta=json.loads(p.read_text());u=meta['distribuce'][0]['soubor_ke_stažení'];fetch(u,CACHE/'monitor-grants'/(u.rsplit('/',1)[1].replace('_Data_CSUIS','')))
 else:
  fetch('https://www.dotaceeu.cz/getmedia/e06f478c-d716-4dac-bfd7-48a8b6cc0d6b/2026_08_Seznam-operaci_List-of-Operations_21.xlsx.aspx?ext=.xlsx',CACHE/'dotaceeu/operations-202608.xlsx')
  fetch('https://www.dotaceeu.cz/getmedia/64ac77fd-33eb-4362-9313-ac07426dc49e/2026_08_Seznam-operaci-FN_2021_2027.xlsx.aspx?ext=.xlsx',CACHE/'dotaceeu/instruments-202608.xlsx')
if __name__=='__main__':main()
