#!/usr/bin/env python3
"""Source-precision, cloud-only Rosling histories; never deploys website code."""
import argparse, base64, copy, hashlib, importlib.util, json, math, os, re, subprocess, time, urllib.request, zipfile, tarfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import xml.etree.ElementTree as ET

COUNTRIES=['CZE','DEU','DNK','FIN','FRA','GBR','POL','SWE','CHE','USA','UKR','BRA','ESP','JPN','NLD','NOR','GRC']
WEO='https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx'
BASE_HEALTH_SHA='05388d38c9f654d92ec8d9fe540f787b1b522a3e85358bbcaa1174430b2abaef'
BASE_GDP_SHA='d567a5cd90488bb449f3a9a547aafc334c7eb2e5cf0f5d9ea0b83ea813cafad2'
METRICS={
 'health_gdp_pct':('spending','SH.XPD.CHEX.GD.ZS','% of GDP',100),
 'per_capita_ppp':('spending','SH.XPD.CHEX.PP.CD','current international dollars/person',None),
 'out_of_pocket_pct':('spending','SH.XPD.OOPC.CH.ZS','% of current health expenditure',100),
 'beds_per_1000':('capacity','SH.MED.BEDS.ZS','beds/1,000 people',100),
 'physicians_per_1000':('workforce','SH.MED.PHYS.ZS','physicians/1,000 people',100),
 'nurses_per_1000':('workforce','SH.MED.NUMW.P3','nurses and midwives/1,000 people',100),
 'life_expectancy_years':('outcomes','SP.DYN.LE00.IN','years at birth',120),
 'premature_ncd_mortality_pct':('outcomes','SH.DYN.NCOM.ZS','% probability age 30–70',100),
 'suicide_rate_per_100k':('outcomes','SH.STA.SUIC.P5','deaths/100,000 people',200),
 'under5_mortality_per_1000':('outcomes','SH.DYN.MORT','deaths/1,000 live births',1000),
 'population':('population','SP.POP.TOTL','people',None),
}
N={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
now=lambda:datetime.now(timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def command(*args):return subprocess.check_output(args,text=True,timeout=180).strip()
def write_json(path,data):path.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')
def describe(uri):
 p=subprocess.run(['gcloud','storage','objects','describe',uri,'--format=json'],capture_output=True,text=True,timeout=60)
 return json.loads(p.stdout) if p.returncode==0 else None

def store(path,uri):
 body=path.read_bytes();md5=base64.b64encode(hashlib.md5(body).digest()).decode();d=describe(uri)
 if not d:
  subprocess.run(['gcloud','storage','cp',str(path),uri,'--if-generation-match=0','--quiet'],check=True,timeout=180)
  d=describe(uri)
 if not d or int(d['size'])!=len(body) or d.get('md5_hash')!=md5:raise ValueError('Immutable object mismatch: '+uri)
 return {'uri':uri,'generation':str(d['generation']),'sha256':sha(body),'bytes':len(body)}

class Sources:
 def __init__(self,root,prefix):self.root=root;self.prefix=prefix;self.records={}
 def get(self,key,url,expected=None):
  dest=self.root/(key+'.raw');uri=self.prefix+'/raw/'+dest.name;meta_uri=uri+'.json';held=describe(meta_uri)
  if held:
   meta=json.loads(command('gcloud','storage','cat',meta_uri+'#'+str(held['generation'])))
   if meta['url']!=url:raise ValueError('Immutable source URL mismatch')
   subprocess.run(['gcloud','storage','cp',meta['uri']+'#'+meta['generation'],str(dest),'--quiet'],check=True,timeout=180)
   if sha(dest.read_bytes())!=meta['sha256']:raise ValueError('Restored raw hash mismatch')
  else:
   for attempt in range(3):
    try:
     with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PublicSpendingData/1.0 (educational source audit)'}),timeout=90) as response, dest.open('wb') as out:
      count=0
      while chunk:=response.read(1024*1024):
       count+=len(chunk)
       if count>128*1024*1024:raise ValueError('Source exceeds 128 MiB')
       out.write(chunk)
      headers=dict(response.headers)
     break
    except Exception:
     if attempt==2:raise
     time.sleep(2**attempt)
   body=dest.read_bytes()
   if expected and sha(body)!=expected:raise ValueError('Published baseline hash mismatch: '+key)
   meta={**store(dest,uri),'url':url,'received_at':now(),'headers':headers}
   mp=self.root/(key+'.meta.json');write_json(mp,meta);store(mp,meta_uri)
  if expected and meta['sha256']!=expected:raise ValueError('Pinned source hash mismatch')
  self.records[key]=meta;return dest

def held_weo(sources):
 key='weo-april-2026';member='data/sources/international_fiscal/WEOApr2026all.xlsx'
 archive_uri='gs://czbudget-janrezab-data-layers/workspace-backups/2026-09-12-disk-review/payloads/data-sources.tar.gz#1789235656536595'
 archive_sha='ec147ab4d04183a75c132f85b3f4dde7a3e87669004e372d849b691e66dba008'
 member_sha='b29239cb48f8b895d1e526070c4fde01147bc8f6bd3b86f636363bb6bd87fe7a'
 uri=sources.prefix+'/raw/'+key+'.raw'
 if describe(uri+'.json'):return sources.get(key,WEO,member_sha)
 archive=sources.root/'held-data-sources.tar.gz'
 subprocess.run(['gcloud','storage','cp',archive_uri,str(archive),'--quiet'],check=True,timeout=240)
 if sha(archive.read_bytes())!=archive_sha:raise ValueError('Held raw archive hash mismatch')
 dest=sources.root/(key+'.raw')
 with tarfile.open(archive,'r:gz') as tar:
  item=tar.getmember(member)
  if not item.isfile() or item.size!=5585205:raise ValueError('Held source is not the pinned regular workbook')
  with tar.extractfile(item) as stream,dest.open('wb') as out:
   while chunk:=stream.read(1024*1024):out.write(chunk)
 if sha(dest.read_bytes())!=member_sha:raise ValueError('Held IMF workbook hash mismatch')
 meta={**store(dest,uri),'url':WEO,'received_at':now(),'source_origin':'preserved original official April 2026 source','archive':{'object':archive_uri,'sha256':archive_sha,'member':member,'member_sha256':member_sha},'headers':{}}
 mp=sources.root/(key+'.meta.json');write_json(mp,meta);store(mp,uri+'.json');sources.records[key]=meta
 print(json.dumps({'event':'held-imf-source-verified','sha256':member_sha}),flush=True)
 return dest

def workbook_rows(path):
 with zipfile.ZipFile(path) as z:
  if any(i.file_size>256*1024*1024 for i in z.infolist()):raise ValueError('Unsafe workbook member size')
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   with z.open('xl/sharedStrings.xml') as stream:
    for _,e in ET.iterparse(stream,events=('end',)):
     if e.tag.endswith('}si'):strings.append(''.join(t.text or '' for t in e.findall('.//m:t',N)));e.clear()
  wb=ET.fromstring(z.read('xl/workbook.xml'));sheets=wb.find('m:sheets',N)
  sheet=next(s for s in sheets if s.attrib['name']=='Countries')
  rid=sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
  rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'));target=next(r.attrib['Target'] for r in rels if r.attrib['Id']==rid)
  member=target.lstrip('/') if target.startswith('/') else 'xl/'+target
  with z.open(member) as stream:
   for _,row in ET.iterparse(stream,events=('end',)):
    if row.tag!='{'+N['m']+'}row':continue
    cells={}
    for c in row:
     col=re.match(r'[A-Z]+',c.attrib['r']).group();typ=c.attrib.get('t');v=c.find('m:v',N)
     if typ=='inlineStr':value=''.join(c.find('m:is',N).itertext())
     elif v is None:value=None
     elif typ=='s':value=strings[int(v.text)]
     else:value=v.text
     cells[col]=value
    yield cells;row.clear()

def number(value):
 if value is None or str(value).strip() in ('','n/a','--','…'):return None
 n=Decimal(str(value).replace(',',''))
 if not n.is_finite():raise ValueError('Non-finite source number')
 return float(n)

def gdp_from_xlsx(path,baseline):
 rows=workbook_rows(path);header=next(rows);cols={str(v):k for k,v in header.items()};found={}
 for row in rows:
  code=row.get(cols['COUNTRY.ID']);indicator=row.get(cols['INDICATOR.ID'])
  if code not in COUNTRIES or indicator!='PPPPC':continue
  if code in found:raise ValueError('Duplicate GDP country/indicator')
  latest_raw=row.get(cols['LATEST_ACTUAL_ANNUAL_DATA']);match=re.search(r'(?:19|20)\d{2}',str(latest_raw or ''));latest=int(match.group()) if match else None
  values=[]
  for year in range(1980,2026):
   raw=row.get(cols.get(str(year)));value=number(raw)
   if value is not None and value<=0:raise ValueError('Invalid GDP/person')
   values.append({'code':code,'year':year,'value':value,'source_value':raw,'status':'not_available' if value is None else 'actual' if latest and year<=latest else 'estimate'})
  found[code]={'country_code':code,'metrics':{'gdp_per_capita_ppp':{'latest_actual_year':latest,'values':values}}}
 if set(found)!=set(COUNTRIES):raise ValueError('Missing requested IMF country')
 overlap=0
 for previous in baseline['series']:
  if previous['country_code'] not in found:continue
  fresh={r['year']:r for r in found[previous['country_code']]['metrics']['gdp_per_capita_ppp']['values']}
  for old in previous['metrics']['gdp_per_capita_ppp']['values']:
   if old['year'] not in fresh:continue
   new=fresh[old['year']]
   if old['value']!=new['value'] or (old['value'] is not None and old['status']!=new['status']):raise ValueError('Same-vintage GDP baseline mismatch')
   overlap+=1
 return {'dataset_id':'rosling-imf-gdp-history.v1','source':baseline['source'],'countries':[c for c in baseline['countries'] if c['country_code'] in COUNTRIES],'series':[found[c] for c in COUNTRIES],'generated_at':now()},overlap

def parse_wb(path,id):
 payload=json.loads(path.read_text(),parse_float=Decimal);meta,records=payload
 if not isinstance(records,list) or int(meta['pages'])!=1 or len(records)!=int(meta['total']):raise ValueError('Incomplete WB pagination')
 groups={c:[] for c in COUNTRIES};seen=set();missing=0
 for row in records:
  code=row['countryiso3code'];year=int(row['date']);key=(code,year)
  if code not in groups or row['indicator']['id']!=id or not 1960<=year<=2026 or key in seen:raise ValueError('Invalid WB natural key')
  seen.add(key);v=row['value']
  if v is not None and (not isinstance(v,(int,float,Decimal)) or not math.isfinite(v) or v<0):raise ValueError('Invalid WB number')
  missing+=v is None
  groups[code].append({'code':code,'year':year,'value':float(v) if isinstance(v,Decimal) else v,'source_value':str(v) if v is not None else None,'source_status':row.get('obs_status',''),'footnote':row.get('footnote',''),'decimal':row.get('decimal')})
 for c,rows in groups.items():
  if not rows:raise ValueError('Country absent from WB response: '+c)
  rows.sort(key=lambda r:r['year'])
 return groups,meta,{'received':len(records),'accepted':len(records)-missing,'missing':missing,'rejected':0,'deduplicated':0}

def run(args):
 if not os.environ.get('BUILD_ID') or os.environ.get('PROJECT_ID')!='czbudget-janrezab':raise RuntimeError('Cloud data worker required')
 identity=command('gcloud','auth','list','--filter=status:ACTIVE','--format=value(account)')
 if identity!='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com':raise RuntimeError('Unexpected worker identity')
 build=os.environ['BUILD_ID'];prefix='gs://czbudget-janrezab-data-layers/processing-runs/rosling-history/'+build
 completed_uri=prefix+'/completed.json';done=describe(completed_uri)
 if done:
  receipt=json.loads(command('gcloud','storage','cat',completed_uri+'#'+str(done['generation'])))
  if receipt['loader_sha']!=args.loader_sha or receipt['publication_status']!='success':raise ValueError('Receipt identity mismatch')
  print(json.dumps({'event':'already-published','receipt':completed_uri}),flush=True);return
 root=Path('/workspace/.rosling-history');root.mkdir(exist_ok=True);sources=Sources(root,prefix)
 base=sources.get('published-health','https://publicspendingdata.org/data/country-health-performance.v1.json?v='+BASE_HEALTH_SHA,BASE_HEALTH_SHA)
 health=json.loads(base.read_text());baseline=json.loads(sources.get('published-gdp','https://publicspendingdata.org/lib/data/sovereign-benchmark.v1.json?v='+BASE_GDP_SHA,BASE_GDP_SHA).read_text())
 sovereign,overlap=gdp_from_xlsx(held_weo(sources),baseline)
 def collect(item):
  key,(group,id,unit,upper)=item
  url='https://api.worldbank.org/v2/country/'+';'.join(COUNTRIES)+'/indicator/'+id+'?source=2&format=json&per_page=20000&date=1960:2026&footnote=y'
  data=parse_wb(sources.get('wb-'+key,url),id)
  metadata=json.loads(sources.get('wb-meta-'+key,'https://api.worldbank.org/v2/indicator/'+id+'?source=2&format=json').read_text())
  if not metadata[1] or metadata[1][0]['id']!=id:raise ValueError('Invalid indicator metadata')
  return key,url,data,metadata[1][0]
 results=list(ThreadPoolExecutor(max_workers=3).map(collect,METRICS.items()))
 coverage={};counts={};revisions=[];pressure={'generated_at':now(),'countries':{},'sources':{'world_bank':{'url':'https://data.worldbank.org/indicator/SP.POP.TOTL'}}}
 for key,url,(groups,meta,count),metadata in results:
  group,id,unit,upper=METRICS[key];counts[key]=count;coverage[key]={}
  for code,series in groups.items():
   valid=[r for r in series if r['value'] is not None]
   if upper and any(r['value']>upper for r in valid):raise ValueError('Implausible range: '+key+'/'+code)
   coverage[key][code]={'first':valid[0]['year'] if valid else None,'last':valid[-1]['year'] if valid else None,'observations':len(valid),'missing':len(series)-len(valid),'unit':unit}
   if key=='population':
    pressure['countries'][code]={'wpp':[{'year':r['year'],'population_thousands':r['value']/1000 if r['value'] is not None else None,'source_population_persons':r['value'],'kind':'estimate','source_status':r['source_status'],'footnote':r['footnote']} for r in series]};continue
   old=health['countries'][code][group].get(key);old_series={r['year']:r['value'] for r in (old or {}).get('series',[])}
   if old_series and len(valid)<len(old_series):raise ValueError('Health history coverage regressed')
   for r in series:
    if r['year'] in old_series and old_series[r['year']]!=r['value']:revisions.append({'country':code,'metric':key,'year':r['year'],'previous':old_series[r['year']],'current':r['value']})
   latest=valid[-1] if valid else {'year':None,'value':None}
   health['countries'][code][group][key]={'year':latest['year'],'value':latest['value'],'series':series,'unit':unit,'indicator':id,'source_url':'https://data.worldbank.org/indicator/'+id,'api_url':url,'api_last_updated':meta.get('lastupdated'),'metadata':metadata,'status_note':'Source country series including official harmonised estimates; source flags and footnotes retained. Not every historical point is a direct observation.'}
 health['generated_at']=now();health['dataset_id']='rosling-health-history.v1';health['baseline_release']={'sha256':BASE_HEALTH_SHA,'generated_at':json.loads(base.read_text())['generated_at'],'retained':'OECD utilisation and avoidable mortality only'}
 health['api_queries']['world_bank']={key:url for key,url,_,_ in results if key!='population'}
 health['coverage']='17 countries; full available annual WDI source history from 1960; per-indicator missing years retained. OECD baseline remains unchanged.'
 health['methodology']['en']+=' Full source histories contain official estimates. Historical workforce comparability is limited by changes in definitions and training. No source series are spliced or locally imputed.'
 payload={'contract':'rosling-history.v1','release_id':build,'generated_at':now(),'loader_sha':args.loader_sha,'sovereign':sovereign,'health':health,'pressure':pressure,'coverage':coverage,'source_receipts':sources.records,'methodology':{'gdp':'IMF April 2026 PPPPC, current international dollars/person, 1980–2025; future forecasts retained in raw workbook but not included as history. Country actual/estimate cutoff preserved.','population':'World Bank SP.POP.TOTL native people retained alongside calculated thousands; official estimates, no country aggregates. National age/sex projections are separate source releases.','health':'Full annual source responses, no interpolation/backfill by PSD; null years, source status/footnotes and indicator definitions retained. OECD baseline not re-ingested.'}}
 staging=root/'rosling-history.v1.json';write_json(staging,payload);stored=store(staging,prefix+'/staging/rosling-history.v1.json')
 # Exact JSON roundtrip; coverage and Decimal control totals are recorded per source metric.
 restored=json.loads(staging.read_text());assert restored==payload
 validation={'status':'passed','release_id':build,'loader_sha':args.loader_sha,'identity':identity,'region':'europe-west4','sources':sources.records,'staging':stored,'counts':counts,'coverage':coverage,'gdp_baseline_records_reconciled':overlap,'source_revisions':revisions,'checks':['complete pagination','unique country/indicator/year keys','native numbers/footnotes/status retained','range bounds','baseline GDP value/status exact match','full health histories without regression','exact JSON roundtrip','country-only selection','staged SHA256'],'control_totals':{key:str(sum((Decimal(r['source_value']) for rows in groups.values() for r in rows if r['value'] is not None),Decimal(0))) for key,_,(groups,_,_),_ in results}}
 vp=root/'validation.json';write_json(vp,validation);store(vp,prefix+'/validation.json')
 lock_uri='gs://czbudget-janrezab-public-snapshots/static-assets/current.json';active=describe(lock_uri);generation=str(active['generation'])
 bp=root/'base-lock.json';subprocess.run(['gcloud','storage','cp',lock_uri+'#'+generation,str(bp),'--quiet'],check=True,timeout=120);store(bp,prefix+'/raw/static-assets-base.json')
 lock=json.loads(bp.read_text());pack_name='rosling-history';url='/data/contracts/rosling-history.v1.json'
 if lock.get('version')!=1 or lock.get('bucket')!='czbudget-janrezab-public-snapshots':raise ValueError('Invalid base lock')
 if url in lock['files'] and lock['files'][url]['pack']!=pack_name:raise ValueError('Serving path owned by another pack')
 lock['files']={k:v for k,v in lock['files'].items() if v['pack']!=pack_name};lock['packs'].pop(pack_name,None)
 body=staging.read_bytes();
 if len(body)>32*1024*1024:raise ValueError('Serving response exceeds limit')
 digest=sha(body);filename=digest+'.pack';out=root/'publication';out.mkdir();(out/filename).write_bytes(body)
 descriptor={'key':'static-assets/v1/'+filename,'file':filename,'size':len(body),'md5':base64.b64encode(hashlib.md5(body).digest()).decode(),'sha256':digest}
 lock['packs'][pack_name]=descriptor;lock['files'][url]={'pack':pack_name,'offset':0,'size':len(body),'sha256':digest}
 spec=importlib.util.spec_from_file_location('publisher','scripts/publish-serving-asset-pack.py');publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher);publisher.PACK_NAME=pack_name
 publisher.publish(lock,descriptor,out,generation)
 completed={**validation,'processing_status':'success','publication_status':'success','published_at':now(),'public_url':'https://publicspendingdata.org'+url,'publication_pointer':lock_uri,'base_generation':generation,'public_pack':descriptor}
 cp=root/'completed.json';write_json(cp,completed);store(cp,prefix+'/completed.json')
 print(json.dumps({'event':'rosling-history-published','release_id':build,'receipt':prefix+'/completed.json','coverage':coverage,'counts':counts,'gdp_baseline_records_reconciled':overlap}),flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True);args=p.parse_args()
 try:run(args)
 except Exception as e:
  if os.environ.get('BUILD_ID') and os.environ.get('PROJECT_ID')=='czbudget-janrezab':
   root=Path('/workspace/.rosling-history')
   if root.exists():
    failure=root/'failed.json'
    write_json(failure,{'build_id':os.environ['BUILD_ID'],'loader_sha':args.loader_sha,'region':'europe-west4','failed_at':now(),'error':str(e),'processing_status':'failed','publication_status':'inspect active pointer','sources':[json.loads(p.read_text()) for p in root.glob('*.meta.json')]})
    try:store(failure,'gs://czbudget-janrezab-data-layers/processing-runs/rosling-history/'+os.environ['BUILD_ID']+'/failed.json')
    except Exception as receipt_error:print('Failure receipt error: '+str(receipt_error),flush=True)
  print(json.dumps({'event':'rosling-history-failed','error':str(e),'published_data':'Previous verified pointer remains unless publication already completed; inspect receipt.'}),flush=True)
  raise
