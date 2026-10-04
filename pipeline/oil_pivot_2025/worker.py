"""Narrow annual refresh; immutable sources, atomic warehouse load, verified report CAS."""
import argparse,concurrent.futures,gzip,hashlib,json,os,re,sys,time,urllib.error,urllib.parse,urllib.request
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'transforms'))
from pipeline.trade_reports.publish import Objects,body,sha,key,PRIVATE,SERVING,PREFIX,PROJECT
from pipeline.russia_suppliers.cloud_clients import Rest
import prepare_un_comtrade_warehouse as prepare
import run_un_comtrade_warehouse as warehouse
REPORTERS={40:'AUT',56:'BEL',100:'BGR',191:'HRV',196:'CYP',203:'CZE',208:'DNK',233:'EST',246:'FIN',250:'FRA',276:'DEU',300:'GRC',348:'HUN',372:'IRL',380:'ITA',428:'LVA',440:'LTU',442:'LUX',470:'MLT',528:'NLD',616:'POL',620:'PRT',642:'ROU',703:'SVK',705:'SVN',724:'ESP',752:'SWE',156:'CHN',699:'IND'}
ENERGY_KEY=key(['energy','270900','A','2025']);PERIODS_KEY=key(['energy-periods'])

def now():return datetime.now(timezone.utc).isoformat()
def decimal_json(data):return json.loads(data,parse_float=Decimal)
def encode(x):return json.dumps(x,sort_keys=True,separators=(',',':'),default=str,allow_nan=False).encode()
def source_rows(payload,reporter):
 rows=payload.get('data',[])
 if payload.get('error') or int(payload.get('count',-1))!=len(rows) or len(rows)>=500:raise ValueError('Incomplete source response')
 identities=set()
 for r in rows:
  if str(r.get('period'))!='2025' or r.get('typeCode')!='C' or r.get('freqCode')!='A' or r.get('reporterCode')!=reporter or r.get('partnerCode')!=643 or r.get('partner2Code')!=0 or r.get('cmdCode')!='270900' or r.get('flowCode')!='M' or r.get('customsCode')!='C00' or r.get('motCode')!=0 or r.get('isOriginalClassification') is not True:raise ValueError('Source grain differs')
  if r['classificationCode'] in identities:raise ValueError('Duplicate original-classification observation')
  identities.add(r['classificationCode'])
  for f in ['primaryValue','netWgt']:
   if r.get(f) is not None and (not Decimal(str(r[f])).is_finite() or Decimal(str(r[f]))<0):raise ValueError('Invalid source numeric value')
 return rows

def comtrade(url):
 req=urllib.request.Request(url,headers={'Ocp-Apim-Subscription-Key':os.environ['UN_COMTRADE_API_KEY'],'User-Agent':'PublicSpendingData annual-oil-2025'})
 for attempt in range(4):
  try:
   with urllib.request.urlopen(req,timeout=45) as response:data=response.read(2*1024*1024+1)
   if len(data)>2*1024*1024:raise ValueError('Source response byte bound')
   return data
  except urllib.error.HTTPError as e:
   if e.code not in [429,500,502,503,504] or attempt==3:raise RuntimeError('Source HTTP '+str(e.code)) from None
   time.sleep(min(15,2**attempt))
 raise RuntimeError('Source unavailable')

def extract(objects,run,loader_sha,raw_run=None):
 root='processing-runs/oil-pivot-2025/'+(raw_run or run)+'/raw/'
 checkpoint=objects.meta(PRIVATE,root+'checkpoint.json')
 if checkpoint:
  packed=objects.read(PRIVATE,root+'checkpoint.json',checkpoint['generation']);c=json.loads(packed)
  if c['scope']!='C/A/2025/270900/M/RUS/EU27-CHN-IND':raise ValueError('Checkpoint scope drift')
 else:
  entries=[]
  for reporter,iso in REPORTERS.items():
   metadata_url='https://comtradeapi.un.org/data/v1/getDa/C/A/HS?'+urllib.parse.urlencode({'period':'2025','reporterCode':reporter})
   metadata_bytes=comtrade(metadata_url);metadata=decimal_json(metadata_bytes);available=[r for r in metadata.get('data',[]) if r.get('isOriginalClassification') is True]
   metadata_ref=objects.write(PRIVATE,root+iso+'-metadata-'+sha(metadata_bytes)+'.json',metadata_bytes)
   if len(available)>1:raise ValueError('Multiple original datasets')
   entry={'reporter':reporter,'iso3':iso,'metadata_url':metadata_url,'metadata':metadata_ref,'available':available,'retrieved_at':now()}
   if available:
    url='https://comtradeapi.un.org/data/v1/get/C/A/HS?'+urllib.parse.urlencode({'period':'2025','reporterCode':reporter,'cmdCode':'270900','flowCode':'M','partnerCode':643,'partner2Code':0,'customsCode':'C00','motCode':0,'maxRecords':500,'includeDesc':'true'})
    raw=comtrade(url);rows=source_rows(decimal_json(raw),reporter)
    entry.update(url=url,response=objects.write(PRIVATE,root+iso+'-'+sha(raw)+'.json',raw),received_rows=len(rows),status='completed' if rows else 'no_data')
   else:entry.update(received_rows=0,status='dataset_unavailable')
   entries.append(entry);print(json.dumps({'event':'annual_source_verified','market':iso,'rows':entry['received_rows'],'status':entry['status']}),flush=True);time.sleep(.25)
  c={'schema_version':'oil-pivot-checkpoint.v1','scope':'C/A/2025/270900/M/RUS/EU27-CHN-IND','loader_sha':loader_sha,'build_id':run,'entries':entries,'created_at':now()}
  packed=body(c);objects.write(PRIVATE,root+'checkpoint.json',packed)
 checkpoint_ref=objects.meta(PRIVATE,root+'checkpoint.json');checkpoint_ref={'object':root+'checkpoint.json','generation':checkpoint_ref['generation'],'sha256':sha(packed),'bytes':len(packed)}
 observations=[];responses=[];raw_sources=[];confirmed=[]
 for e in c['entries']:
  metadata=objects.verified(PRIVATE,e['metadata']);assert metadata['data']==e['available'] or [r for r in metadata['data'] if r.get('isOriginalClassification') is True]==e['available']
  if e['status']=='dataset_unavailable':continue
  confirmed.append(e['iso3']);raw=objects.read(PRIVATE,e['response']['object'],e['response']['generation']);assert sha(raw)==e['response']['sha256'] and len(raw)==e['response']['bytes']
  rows=source_rows(decimal_json(raw),e['reporter']);assert len(rows)==e['received_rows']
  a=e['available'][0];classification=a['classificationCode'];task_id=prepare.stable_id('oil-pivot-annual-2025',e['reporter'],'270900','M',643,classification)
  meta={'product_type':'C','frequency':'A','period':'2025','reporter_code':e['reporter'],'classification_code':classification,'task_id':task_id,'retrieved_at':e['retrieved_at']}
  availability={('C','A','2025',e['reporter'],classification):{'dataset_code':str(a['datasetCode']),'dataset_checksum':str(a['datasetChecksum']),'last_released':a['lastReleased']}}
  normal=[prepare.observation(r,meta,{e['reporter']:{'iso3':e['iso3'],'name':a['reporterDesc']},643:{'iso3':'RUS','name':'Russian Federation'}},{},availability,run,now(),sha(raw)) for r in rows]
  if any(r is None for r in normal):raise ValueError('Rejected normalization')
  if sum(Decimal(r['primary_value_usd']) for r in normal)!=sum(Decimal(str(r['primaryValue'])) for r in rows):raise ValueError('Normalized values differ')
  if sum(Decimal(r['net_weight_kg']) for r in normal if r['net_weight_kg'] is not None)!=sum(Decimal(str(r['netWgt'])) for r in rows if r.get('netWgt') is not None):raise ValueError('Normalized weights differ')
  observations.extend(normal);responses.append({'crawl_task_id':task_id,'source_response_sha256':sha(raw),'period_start':'2025-01-01','period':'2025','frequency':'A','product_type':'C','reporter_area_code':e['reporter'],'reporter_iso3':e['iso3'],'classification_code':classification,'source_record_count':len(rows),'normalized_row_count':len(normal),'source_status':e['status'],'checkpoint_archive_id':checkpoint_ref['sha256'],'ingestion_run_id':run,'loaded_at':now()});raw_sources.append(e)
 if not all(any(o['reporter_iso3']==code and Decimal(o['net_weight_kg'] or '0')>0 for o in observations) for code in ['CHN','IND']):raise ValueError('China and India source weights required')
 if len({o['trade_observation_id'] for o in observations})!=len(observations):raise ValueError('Duplicate normalized observations')
 return checkpoint_ref,observations,responses,raw_sources,confirmed

def load_warehouse(objects,api,run,observations,responses,confirmed):
 stages={};base='processing-runs/oil-pivot-2025/'+run+'/staging/'
 for kind,rows,target in [('observations',observations,'trade_observations'),('responses',responses,'trade_source_responses')]:
  packed=gzip.compress(b'\n'.join(encode(r) for r in rows)+b'\n',mtime=0);ref=objects.write(PRIVATE,base+kind+'.jsonl.gz',packed,content_type='application/gzip')
  table='oil_2025_'+run.replace('-','_')+'_'+kind;stages[kind]=table;warehouse.create_stage(table,target)
  warehouse.run(['bq','--location=EU','load','--project_id='+PROJECT,'--job_id=oil_2025_'+run.replace('-','_')+'_'+kind,'--source_format=NEWLINE_DELIMITED_JSON','budget_detail.'+table,'gs://'+PRIVATE+'/'+ref['object']])
 oc=', '.join(warehouse.OBSERVATION_COLUMNS);rc=', '.join(warehouse.RESPONSE_COLUMNS)
 reporter_codes=','.join(str(code) for code,iso in REPORTERS.items() if iso in confirmed)
 sql=f'''BEGIN TRANSACTION;
DELETE FROM `{PROJECT}.budget_detail.trade_observations` WHERE period_start=DATE '2025-01-01' AND product_type='C' AND frequency='A' AND product_code='270900' AND flow_code='M' AND partner_area_code=643 AND partner2_area_code=0 AND customs_code='C00' AND mode_of_transport_code=0 AND is_original_classification AND reporter_area_code IN ({reporter_codes});
INSERT INTO `{PROJECT}.budget_detail.trade_observations` ({oc}) SELECT {oc} FROM `{PROJECT}.budget_detail.{stages['observations']}`;
DELETE FROM `{PROJECT}.budget_detail.trade_source_responses` WHERE period_start=DATE '2025-01-01' AND STRUCT(crawl_task_id,source_response_sha256) IN (SELECT AS STRUCT crawl_task_id,source_response_sha256 FROM `{PROJECT}.budget_detail.{stages['responses']}`);
INSERT INTO `{PROJECT}.budget_detail.trade_source_responses` ({rc}) SELECT {rc} FROM `{PROJECT}.budget_detail.{stages['responses']}`;
ASSERT (SELECT COUNT(*) FROM `{PROJECT}.budget_detail.trade_observations` WHERE period_start=DATE '2025-01-01' AND ingestion_run_id='{run}')={len(observations)} AS 'Warehouse row count differs';
COMMIT TRANSACTION;'''
 # A single partition-pruned transaction, with a deterministic retry identity.
 job_id='oil_2025_'+run.replace('-','_')+'_atomic';root='https://bigquery.googleapis.com/bigquery/v2/projects/'+PROJECT
 q={'query':sql,'useLegacySql':False,'maximumBytesBilled':str(64*1024**3)}
 try:job=api.request(root+'/jobs',{'jobReference':{'projectId':PROJECT,'location':'EU','jobId':job_id},'configuration':{'query':q,'labels':{'plane':'data','purpose':'oil-pivot-2025'}}})
 except urllib.error.HTTPError as e:
  if e.code!=409:raise
  job=api.request(root+'/jobs/'+job_id+'?location=EU');assert job['configuration']['query']['query']==sql
 for _ in range(90):
  job=api.request(root+'/jobs/'+job_id+'?location=EU')
  if job['status']['state']=='DONE':break
  time.sleep(2)
 else:raise RuntimeError('Warehouse job running; inspect exact job ID '+job_id)
 if job['status'].get('errorResult'):raise RuntimeError(json.dumps(job['status']['errorResult']))
 for table in stages.values():warehouse.bq_remove(table)
 return {'job_id':job_id,'status':'committed','normalized_rows':len(observations),'responses':len(responses),'bytes_billed':job.get('statistics',{}).get('query',{}).get('totalBytesBilled')}

def report_row(o):
 return {'period':'2025','frequency':'A','origin_iso3':'RUS','origin_iso2':'RU','origin_name':'Russian Federation','market_iso3':o['reporter_iso3'],'market_iso2':{'AUT':'AT','BEL':'BE','BGR':'BG','HRV':'HR','CYP':'CY','CZE':'CZ','DNK':'DK','EST':'EE','FIN':'FI','FRA':'FR','DEU':'DE','GRC':'GR','HUN':'HU','IRL':'IE','ITA':'IT','LVA':'LV','LTU':'LT','LUX':'LU','MLT':'MT','NLD':'NL','POL':'PL','PRT':'PT','ROU':'RO','SVK':'SK','SVN':'SI','ESP':'ES','SWE':'SE','CHN':'CN','IND':'IN'}[o['reporter_iso3']],'market_name':o['reporter_name'],'value_usd':o['primary_value_usd'],'net_weight_kg':o['net_weight_kg'],'net_weight_is_estimated':o['net_weight_is_estimated'],'source_last_released':o['source_last_released'],'retrieved_at':o['retrieved_at']}

def updated_rows(old,observations,confirmed):
 # Only refresh the confirmed Russian-origin route slice; every other route stays exact.
 refreshed=[r for r in old if not(r['origin_iso3']=='RUS' and r['market_iso3'] in confirmed)]
 refreshed.extend(report_row(o) for o in observations if Decimal(o['primary_value_usd'])>0)
 refreshed.sort(key=lambda r:(-Decimal(str(r['value_usd'])),r['origin_iso3'],r['market_iso3']))
 if len({(r['origin_iso3'],r['market_iso3']) for r in refreshed})!=len(refreshed):raise ValueError('Duplicate serving routes')
 if [r for r in old if r['origin_iso3']!='RUS' or r['market_iso3'] not in confirmed]!=[r for r in refreshed if r['origin_iso3']!='RUS' or r['market_iso3'] not in confirmed]:raise ValueError('Untargeted routes changed')
 return refreshed

def publish_reports(objects,run,base_pointer,base_generation,manifest,observations,confirmed,checkpoint,warehouse_receipt,raw_sources,loader_sha):
 old_payload=objects.verified(SERVING,manifest['results'][ENERGY_KEY]);routes=updated_rows(old_payload['rows'],observations,confirmed)
 periods=objects.verified(SERVING,manifest['results'][PERIODS_KEY])['rows']
 for r in periods:
  if r['product_code']=='270900' and r['frequency']=='A' and r['period']=='2025':
   r.update(reporting_markets=str(len({x['market_iso3'] for x in routes})),reported_origins=str(len({x['origin_iso3'] for x in routes})),observed_value_usd=str(sum(Decimal(str(x['value_usd'])) for x in routes)),observed_net_weight_kg=str(sum(Decimal(str(x['net_weight_kg'])) for x in routes if x['net_weight_kg'] is not None)),source_last_released=max(x['source_last_released'] for x in routes if x.get('source_last_released')),retrieved_at=max(x['retrieved_at'] for x in routes if x.get('retrieved_at')))
 overrides={ENERGY_KEY:routes,PERIODS_KEY:periods};results={};done=0
 def copy(item):
  k,ref=item;payload=objects.verified(SERVING,ref)
  if payload['release_id']!=base_pointer['release_id'] or payload['key']!=k or len(payload['rows'])!=ref['rows']:raise ValueError('Base report mismatch')
  payload['release_id']=run
  if k in overrides:payload['rows']=overrides[k]
  data=body(payload)
  if k in overrides:objects.write(PRIVATE,'processing-runs/oil-pivot-2025/'+run+'/staging/'+k+'.json',data)
  output=objects.write(SERVING,PREFIX+'releases/'+run+'/'+k+'.json',data);output['rows']=len(payload['rows']);return k,output
 # The deployed reader requires one release ID in every object, so preserve all rows
 # under the new release, checking each source hash and destination readback.
 with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
  for k,ref in pool.map(copy,manifest['results'].items()):
   results[k]=ref;done+=1
   if done%500==0:print(json.dumps({'event':'report_preserved','objects':done,'total':len(manifest['results'])}),flush=True)
 if set(results)!=set(manifest['results']):raise ValueError('Serving keys changed')
 new=dict(manifest,release_id=run,results=results,loader_sha=loader_sha)
 # Preserve the original time pin of carried-forward reports; the refreshed slice
 # has its own exact source checkpoint and vintage, never a fictitious global pin.
 new['scope_refresh']={'keys':[ENERGY_KEY,PERIODS_KEY],'refreshed_at':now(),'base_release':base_pointer['release_id'],'checkpoint':checkpoint,'note':'Only annual 2025 Russian-origin crude routes refreshed; every other report row retained at its original vintage.'}
 mf=objects.write(SERVING,PREFIX+'releases/'+run+'/manifest.json',body(new))
 receipt={'schema_version':'oil-pivot-2025-receipt.v1','build_id':run,'loader_sha':loader_sha,'region':'europe-west4','service_account':'psd-data-builder@'+PROJECT+'.iam.gserviceaccount.com','source_checkpoint':checkpoint,'sources':raw_sources,'base_pointer':base_pointer,'received_rows':sum(e['received_rows'] for e in raw_sources),'accepted_rows':len(observations),'rejected_rows':0,'deduplicated_rows':0,'source_net_weight_kg':str(sum(Decimal(o['net_weight_kg']) for o in observations if o['net_weight_kg'] is not None)),'source_value_usd':str(sum(Decimal(o['primary_value_usd']) for o in observations)),'coverage':{'confirmed_reporting_datasets':confirmed,'eu_member_datasets':len([c for c in confirmed if c not in ['CHN','IND']]),'missing_is_not_zero':True},'warehouse':warehouse_receipt,'processing_status':'validated','publication_status':'prepared','preserved_report_objects':len(results)-2,'manifest':mf,'website_destinations':['/api/v1/trade/energy/flows?product=petroleum&frequency=A&period=2025','/api/v1/trade/energy/periods','/stories/the-great-oil-pivot/?view=annual&period=2025'],'completed_at':now()}
 root='processing-runs/oil-pivot-2025/'+run+'/'
 objects.write(PRIVATE,root+'prepared.json',body(receipt));pointer=dict(mf,schema_version='1.0.0',bucket=SERVING,release_id=run)
 pr=objects.write(SERVING,PREFIX+'current.json',body(pointer),base_generation)
 receipt.update(publication_status='published',pointer=pr,published_release_id=run,completed_at=now());objects.write(PRIVATE,root+'completed.json',body(receipt))
 print(json.dumps({'event':'annual_oil_published','release_id':run,'rows':len(observations),'receipt':'gs://'+PRIVATE+'/'+root+'completed.json'}),flush=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True);p.add_argument('--raw-run');args=p.parse_args();run=os.environ.get('BUILD_ID','')
 if not re.fullmatch('[a-f0-9-]{36}',run) or not re.fullmatch('[a-f0-9]{40}',args.loader_sha):raise ValueError('Cloud worker and clean loader SHA required')
 api=Rest();objects=Objects(api);meta=objects.meta(SERVING,PREFIX+'current.json');base=json.loads(objects.read(SERVING,PREFIX+'current.json',meta['generation']));manifest=objects.verified(SERVING,base)
 checkpoint,observations,responses,sources,confirmed=extract(objects,run,args.loader_sha,args.raw_run)
 wr=load_warehouse(objects,api,run,observations,responses,confirmed);print(json.dumps({'event':'annual_warehouse_committed',**wr}),flush=True)
 publish_reports(objects,run,base,meta['generation'],manifest,observations,confirmed,checkpoint,wr,sources,args.loader_sha)
if __name__=='__main__':main()
