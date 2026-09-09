#!/usr/bin/env python3
"""Archive native public Plzeň investment and ŘSD feature layers by explicit IDs."""
import argparse,gzip,hashlib,json,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode

ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'data/source_cache/czech-project-geography/2026-09-09'
OUT=ROOT/'website/data/czech-project-geography'
HISTORY='https://geoportal.rsd.cz/arcgis/rest/services/HistorieVystavbyDalnic/MapServer'
NETWORK='https://geoportal.rsd.cz/arcgis/rest/services/PrezentaceULS/MapServer'
PLZEN='https://ags.plzen.eu/arcgis/rest/services/GIS_SUPERDIO_RIA/GIS_RIADIO_Investice_UMO/MapServer/5'

def now():return datetime.now(timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,data):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp')
 tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(p)
def fetch(url,key):
 p=CACHE/(key+'.json');meta=p.with_suffix('.meta.json')
 if p.exists() and meta.exists():
  m=json.loads(meta.read_text())
  if m['url']==url and m['sha256']==sha(p):return json.loads(p.read_text()),m
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix('.part')
 for attempt in range(5):
  try:
   subprocess.run(['curl','--http1.1','--fail','--location','--retry','3','--max-time','120','--silent','--show-error',url,'--output',str(tmp)],check=True)
   data=json.loads(tmp.read_text())
   if 'error' in data:raise ValueError(str(data['error']))
   break
  except (subprocess.CalledProcessError,json.JSONDecodeError,ValueError):
   tmp.unlink(missing_ok=True)
   if attempt==4:raise
   time.sleep(2**attempt)
 tmp.replace(p);m={'url':url,'retrieved_at':now(),'sha256':sha(p),'bytes':p.stat().st_size};save(meta,m);time.sleep(.1)
 return data,m
def query(base,params,key):return fetch(base+'/query?'+urlencode({'f':'json',**params}),key)
def archive_layer(base,key,context):
 schema,sm=fetch(base+'?f=pjson',key+'/schema')
 oid=next(f['name'] for f in schema['fields'] if f['type']=='esriFieldTypeOID')
 ids,im=query(base,{'where':'1=1','returnIdsOnly':'true'},key+'/ids')
 if not isinstance(ids.get('objectIds'),list):raise ValueError('Missing explicit object ID list')
 wanted=sorted(ids['objectIds'])
 if len(set(wanted))!=len(wanted):raise ValueError('Duplicate source object IDs')
 control,cm=query(base,{'where':'1=1','returnCountOnly':'true'},key+'/count')
 if len(wanted)!=control['count']:raise ValueError('ID/count source changed during acquisition')
 pages=[];seen=set();features=0;native_ids=set();timestamps=[]
 folder=OUT/key;folder.mkdir(parents=True,exist_ok=True)
 # The large node layer occasionally truncates 200-feature HTTP/2 responses.
 # Smaller HTTP/1.1 batches are slower but reliably resumable for this layer.
 limit=min(50 if key=='rsd-network-16' else 200,schema.get('maxRecordCount',200))
 for start in range(0,len(wanted),limit):
  batch=wanted[start:start+limit]
  payload,source=query(base,{'objectIds':','.join(map(str,batch)),'outFields':'*','returnGeometry':'true','returnM':'true','returnZ':'true'},f'{key}/page-{start:07d}')
  rows=payload.get('features')
  if not isinstance(rows,list) or payload.get('exceededTransferLimit'):raise ValueError('Truncated feature batch')
  actual=[r['attributes'][oid] for r in rows]
  if len(set(actual))!=len(actual) or set(actual)!=set(batch) or seen.intersection(actual):raise ValueError('Feature ID coverage mismatch')
  seen.update(actual);features+=len(rows)
  for row in rows:
   if row['attributes'].get('RECORD_ID') is not None:native_ids.add(row['attributes']['RECORD_ID'])
  name=f'features-{start:07d}.native.json.gz';path=folder/name
  with gzip.open(path,'wt',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,separators=(',',':'))
  if path.stat().st_size>20_000_000:raise ValueError('Feature shard exceeds publication size guard')
  pages.append({'path':str(path.relative_to(ROOT/'website')),'rows':len(rows),'sha256':sha(path),'bytes':path.stat().st_size,'source':source});timestamps.append(source['retrieved_at'])
 if seen!=set(wanted):raise ValueError('Layer not complete')
 result={'id':key,'name':schema['name'],'complete':True,'feature_count':features,'native_project_record_ids':len(native_ids) if key=='plzen-investments' else None,
  'object_id_field':oid,'source_schema':schema,'source':{'url':base,'retrieved_at':sm['retrieved_at'],'raw_sha256':sm['sha256'],**context},
  'retrieved_from':min(timestamps) if timestamps else None,'retrieved_to':max(timestamps) if timestamps else None,
  'controls':{'source_count':control['count'],'source_ids':len(wanted),'retrieved_unique_ids':len(seen),'matched':True,'ids_source':im,'count_source':cm},'pages':pages,
  'definitions':{'geometry':'Native ArcGIS geometry and spatial reference retained; do not assume WGS84 or GeoJSON.',
   'identifier':'ArcGIS object ID identifies a layer feature, not a globally stable project. RECORD_ID is retained where supplied; multiple features may represent one investment.',
   'finance':'Geometry, dates, status and any expected cost do not establish payments, final outturn or a procurement-to-project link.',
   'snapshot':'Non-atomic public-service acquisition. Explicit source ID and count controls match the archived feature set; no private layers or document binaries.'}}
 save(folder/'manifest.json',result)
 print(json.dumps({'layer':key,'features':features,'pages':len(pages)},ensure_ascii=False),flush=True)
 return {'id':key,'name':schema['name'],'feature_count':features,'manifest_path':str((folder/'manifest.json').relative_to(ROOT/'website')),'source':result['source']}
def main():
 p=argparse.ArgumentParser();p.add_argument('--include-network',action='store_true');args=p.parse_args()
 layers=[archive_layer(PLZEN,'plzen-investments',{'landing_page':'https://agp.plzen.eu/app/investice/plzen/','publisher':'City of Plzeň','scope':'Published city and district investment-map features, not only the MMP budget tree.'}),
  archive_layer(HISTORY+'/1','rsd-motorway-history',{'landing_page':'https://geoportal.rsd.cz/web/Applications/LiveData','publisher':'ŘSD','scope':'Native motorway construction features. Other service layers are alternate renderings of this history, not additional projects.'})]
 if args.include_network:
  service,_=fetch(NETWORK+'?f=pjson','rsd-network-service')
  for layer in service['layers']:
   if layer['type']!='Feature Layer' or 'popis' in layer['name'].lower():continue
   layers.append(archive_layer(NETWORK+'/'+str(layer['id']),f'rsd-network-{layer["id"]}',{'landing_page':'https://geoportal.rsd.cz/web','publisher':'ŘSD','reference_date':'2026-07-01','reference_date_basis':'ISSDS date displayed by the official Geoportal on 2026-09-09; not a verified update timestamp for each individual feature.','scope':layer['name']}))
 result={'schema_version':'1.0.0','country_code':'CZE','generated_at':now(),'complete':True,'layer_count':len(layers),'layers':layers,'definition':'Selected complete public feature layers, excluding duplicate label/rendering layers. Counts across layers are not unique projects or disjoint infrastructure. Financial totals are not derived from geometry.'}
 save(ROOT/'website/data/czech-project-geography.v1.json',result)
if __name__=='__main__':main()
