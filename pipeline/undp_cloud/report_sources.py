"""Original-provider records, with source context; never infer canonical metrics."""
import argparse,csv,gzip,hashlib,io,json,os,re,tempfile,time,urllib.request,zipfile,tarfile,codecs,math,http.cookiejar,urllib.parse
from collections import Counter
from pathlib import Path
from decimal import Decimal
from google.cloud import bigquery,storage
import openpyxl
from acquire import PROJECT,BUCKET,upload
D='czbudget-janrezab.undp_human_development'
def safe(x):
 if isinstance(x,float) and not math.isfinite(x):return {'source_ieee_special':str(x)}
 if isinstance(x,dict):return {str(k):safe(v) for k,v in x.items()}
 if isinstance(x,(tuple,list)):return [safe(v) for v in x]
 return x
def dump(x):return json.dumps(safe(x),ensure_ascii=False,separators=(',',':'),default=str,allow_nan=False)
def sha(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def stamp():return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def decode(data):
 try:return data.decode('utf-8-sig')
 except UnicodeDecodeError:return data.decode('cp1252')
def members(path,fmt):
 if fmt=='tar.gz':
  with tarfile.open(path,'r:gz') as t:
   for m in t:
    if m.isfile():yield m.name,m.size
 elif fmt=='zip':
  with zipfile.ZipFile(path) as z:
   for m in z.infolist():
    if not m.is_dir():yield m.filename,m.file_size
 else:yield path.name,path.stat().st_size

def records(path,fmt,root,max_member_bytes=2_000_000_000):
 """Yield (member, original row ordinal, source JSON). Raw always retained."""
 if fmt=='wid_csv':
  with open(path,encoding='utf-8-sig',newline='') as f:
   reader=csv.DictReader(f,delimiter=';');seen=0;accepted=0
   required={'country','variable','percentile','year','value'}
   if not required.issubset(set(reader.fieldnames or [])):raise ValueError('Unexpected WID source schema')
   for n,row in enumerate(reader,1):
    seen+=1
    if row.get('variable')=='sptinc992j' and row.get('percentile')=='p99p100':
     accepted+=1;yield path.name,n,row
   if accepted==0:raise ValueError('No requested WIDtop1income observations; raw retained, no countryseries published')
   yield path.name+'::coverage',1,{'received_csv_rows':seen,'accepted_top1_income_rows':accepted,'filtered_out_rows':seen-accepted,'filter':{'variable':'sptinc992j','percentile':'p99p100'},'denominator':'adult equal-split pretax national income; source share is proportion'}
 elif fmt=='tar.gz':
  with tarfile.open(path,'r:gz') as t:
   for i,m in enumerate(t):
    ext=Path(m.name).suffix.lower().lstrip('.')
    if not m.isfile() or ext not in {'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}:continue
    if m.size>max_member_bytes:raise ValueError('Archive member exceeds 2GB bound')
    dest=root/f'tar_member_{i}.{ext}'
    with t.extractfile(m) as src,open(dest,'wb') as out:
     while b:=src.read(1024*1024):out.write(b)
    for member,n,row in records(dest,ext,root,max_member_bytes):yield m.name+'::'+member,n,row
    dest.unlink()
 elif fmt=='zip':
  with zipfile.ZipFile(path) as z:
   for i,m in enumerate(z.infolist()):
    ext=Path(m.filename).suffix.lower().lstrip('.')
    if m.is_dir() or ext not in {'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}:continue
    if m.file_size>max_member_bytes:raise ValueError('Archive member exceeds 2GB bound')
    dest=root/f'member_{i}.{ext}'
    with z.open(m) as src,open(dest,'wb') as out:
     while b:=src.read(1024*1024):out.write(b)
    for member,n,row in records(dest,ext,root,max_member_bytes):yield m.filename+'::'+member,n,row
    dest.unlink()
 elif fmt in {'csv','tsv'}:
  # Strict decode, never discard invalid characters. Preserve duplicates via arrays.
  with open(path,'rb') as f:
   sample=f.read(65536)
  try:codecs.getincrementaldecoder('utf-8-sig')().decode(sample,final=False);encoding='utf-8-sig'
  except UnicodeDecodeError:encoding='cp1252'
  with open(path,encoding=encoding,newline='') as f:
   delim='\t' if fmt=='tsv' else ','
   sample=f.read(8192);f.seek(0)
   try:delim=csv.Sniffer().sniff(sample,delimiters=',;\t').delimiter
   except csv.Error:pass
   reader=csv.reader(f,delimiter=delim);header=next(reader,None)
   if header is None:raise ValueError('Empty CSV')
   yield path.name,1,{'kind':'header','columns':header,'encoding':encoding,'delimiter':delim}
   for n,row in enumerate(reader,2):yield path.name,n,{'kind':'data','columns':header,'values':row}
 elif fmt=='xlsx':
  for mode in [False,True]:
   wb=openpyxl.load_workbook(path,read_only=True,data_only=mode)
   for s in wb:
    for n,row in enumerate(s.iter_rows(values_only=True),1):
     if any(x is not None for x in row):
      yield path.name+'::'+s.title+('::cached' if mode else '::formula'),n,{'values':list(row),'representation':'cached_values' if mode else 'formulas_and_source_values','sheet':s.title}
   wb.close()
 elif fmt=='parquet':
  import pyarrow.parquet as pq
  n=0;pf=pq.ParquetFile(path)
  yield path.name+'::metadata',1,{'arrow_schema':str(pf.schema_arrow)}
  for batch in pf.iter_batches(batch_size=1000):
   for row in batch.to_pylist():
    n+=1;yield path.name,n,row
 elif fmt in {'dta','xpt','sav'}:
  import pyreadstat
  fn={'dta':pyreadstat.read_dta,'xpt':pyreadstat.read_xport,'sav':pyreadstat.read_sav}[fmt]
  n=0
  kwargs={'user_missing':True} if fmt in {'dta','sav'} else {}
  for df,meta in pyreadstat.read_file_in_chunks(fn,str(path),chunksize=2000,**kwargs):
   if n==0:yield path.name+'::metadata',1,{'columns':meta.column_names,'labels':meta.column_names_to_labels,'value_labels':meta.variable_value_labels,'missing_ranges':getattr(meta,'missing_ranges',None),'missing_user_values':getattr(meta,'missing_user_values',None),'original_variable_types':getattr(meta,'original_variable_types',None),'file_encoding':getattr(meta,'file_encoding',None),'readstat_variable_types':getattr(meta,'readstat_variable_types',None)}
   df=df.astype(object).where(df.notna(),None)
   for row in df.to_dict('records'):
    n+=1;yield path.name,n,row
 elif fmt=='verified_claim_html':
  claims=json.loads(Path('pipeline/undp_cloud/audit/ch3_4_verified_claims.json').read_text(),parse_float=Decimal)
  # Source association is resolved by the caller; each curated observation retains
  # its exact source URL, denominator, period and correction rationale.
  sid=path.stem
  selected=[x for x in claims if 'verified_'+x['source_id']==sid]
  source_text=re.sub(r'<[^>]*>',' ',decode(path.read_bytes()))
  source_text=re.sub(r'\s+',' ',source_text)
  if not selected:raise ValueError('No reviewed claims for source page')
  for n,row in enumerate(selected,1):
   for field in ['metric','source_value','unit','period','geography','denominator','exact_source_url']:
    if field not in row or row[field] is None:raise ValueError('Missing original observation metadata')
   # Numeric anchor binds manual review to the fetched page; does not replace
   # review of units, denominator, period or sample. No live-validation claim.
   value=str(row['source_value']);integer=str(int(Decimal(value))) if Decimal(value)==int(Decimal(value)) else value
   if value not in source_text and integer not in source_text:raise ValueError('Reviewed numerical anchor absent from source snapshot')
   row=dict(row,verification_method='manual_original_source_review_with_numeric_snapshot_anchor',reviewed_at='2026-09-26',not_live_measurement=True)
   yield 'reviewed_original_aggregate',n,row
 elif fmt=='dat':
  with open(path,encoding='utf-8-sig') as f:
   for n,line in enumerate(f,1):yield path.name,n,{'source_line':line.rstrip('\n')}
 elif fmt in {'json','worldbank_json'}:
  obj=json.loads(path.read_text(),parse_float=Decimal)
  if fmt=='worldbank_json':
   if not isinstance(obj,list) or len(obj)!=2 or obj[0]['pages']!=1:raise ValueError('Incomplete WDI pagination')
   yield path.name+'::metadata',1,obj[0];obj=obj[1]
  for n,row in enumerate(obj if isinstance(obj,list) else [obj],1):yield path.name,n,row
 elif fmt in {'js','js_geojson'}:
  s=path.read_text();start=s.find('{');end=s.rfind('}')
  obj=json.loads(s[start:end+1])
  for n,row in enumerate(obj['features'],1):yield path.name,n,row

def main():
 p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True);a=p.parse_args()
 rid=os.environ['BUILD_ID'];prefix=f'processing-runs/hdr-report-sources/{rid}';token=rid.replace('-','_')
 bucket=storage.Client(project=PROJECT).bucket(BUCKET);bq=bigquery.Client(project=PROJECT,location='EU');started=stamp()
 def query(s):return list(bq.query(s,location='EU').result(timeout=600))
 existing=query(f"SELECT receipt_uri,receipt_sha256,loader_git_sha FROM `{D}.ingestion_runs` WHERE release_id='{rid}'")
 if existing:
  row=existing[0]
  if row.loader_git_sha!=a.loader_sha:raise ValueError('Committed release loader mismatch')
  prepared=bucket.blob(f'{prefix}/prepared-receipt.json').download_as_bytes()
  if hashlib.sha256(prepared).hexdigest()!=row.receipt_sha256:raise ValueError('Committed receipt hash mismatch')
  marker=bucket.blob(f'{prefix}/completed.json')
  if not marker.exists():upload(bucket,marker.name,prepared)
  print(dump({'event':'recovered_committed_release','release_id':rid}),flush=True);return
 sources=[];allids=set()
 for f in sorted(Path('pipeline/undp_cloud/audit').glob('*_fetch.json')):
  for e in json.loads(f.read_text()):
   if e['source_id'] in allids:raise ValueError('Duplicate source id')
   allids.add(e['source_id']);sources.append(e)
 # Enumerate WID with its own published catalogue, retaining it as immutable raw.
 expanded=[]
 for e in sources:
  if not e.get('expand_catalog_url'):expanded.append(e);continue
  cu=e['expand_catalog_url'];cp=bucket.blob(f'{prefix}/raw/wid-country-catalogue.R')
  if cp.exists():cd=cp.download_as_bytes()
  else:
   with urllib.request.urlopen(cu,timeout=60) as r:cd=r.read(3_000_001)
   if len(cd)>3_000_000:raise ValueError('WID catalogue exceeded3MBbound')
   upload(bucket,cp.name,cd)
  found=re.findall(r'^([A-Z]{2})\s*<-\s*c\(([^\n]*)',cd.decode('utf-8-sig'),re.M)
  codes=sorted({code for code,variables in found if '"sptinc"' in variables})
  if len(codes)<100:raise ValueError('Incomplete WID official country catalogue')
  for code in codes:
   child=dict(e,source_id='wid_current_'+code,url=e['url_template'].replace('{COUNTRY}',code),format='wid_csv',country_or_region_source_code=code,catalogue_sha256=hashlib.sha256(cd).hexdigest(),catalogue_raw_uri=f'gs://{BUCKET}/{cp.name}',enumerated_source_codes=len(codes))
   child.pop('expand_catalog_url',None);expanded.append(child)
 sources=expanded
 catalog=[];total=0;schema=[bigquery.SchemaField(n,t) for n,t in [('release_id','STRING'),('source_id','STRING'),('member','STRING'),('row_number','INTEGER'),('record_json','STRING'),('source_url','STRING'),('source_sha256','STRING')]]
 with tempfile.TemporaryDirectory() as td:
  root=Path(td);stages=[]
  for entry in sources:
   e=dict(entry);sid=e['source_id'];start=time.monotonic();count=0;path=root/(sid+'.'+e['format']);out=root/(sid+'.jsonl.gz')
   try:
    checkpoint=bucket.blob(f'{prefix}/raw/{sid}.metadata.json')
    if checkpoint.exists():
     saved=json.loads(checkpoint.download_as_bytes());e.update(saved)
     blob=bucket.blob(e['raw_uri'].split('/',3)[3],generation=int(e['generation']))
    else:
     req=urllib.request.Request(e['url'],headers={'User-Agent':'Mozilla/5.0 (compatible; PublicSpendingData source ingestion)'})
     h=hashlib.sha256();md5=hashlib.md5();received=0
     opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
     if e['url'].startswith('https://data.icos-cp.eu/objects/'):
      object_id=e['url'].rsplit('/',1)[1];file_name=e['metadata_url'].rsplit('/',1)[1].removesuffix('.xlsx.json')
      accept='https://data.icos-cp.eu/licence_accept?'+urllib.parse.urlencode({'fileName':file_name,'ids':dump([object_id])})
      with opener.open(accept,timeout=60) as license_response:pass
     with opener.open(req,timeout=120) as r,open(path,'wb') as f:
      e['final_url']=r.url;e['content_type']=r.headers.get('Content-Type');e['etag']=r.headers.get('ETag');e['last_modified']=r.headers.get('Last-Modified');e['retrieved_at']=stamp();e['source_vintage_verification']='publisher-labelled release and immutable fetched hash; exact report snapshot equality not assumed'
      while data:=r.read(1024*1024):
       received+=len(data)
       if time.monotonic()-start>600:raise ValueError('Source download exceeded 10minute bound')
       if received>2_000_000_000:raise ValueError('Source exceeds 2GB bound')
       f.write(data);h.update(data);md5.update(data)
     if 'text/html' in (e['content_type'] or '') and e['format'] not in {'html','verified_claim_html'}:raise ValueError('Provider returned HTML instead of data')
     with open(path,'rb') as f:magic=f.read(32)
     if e['format'] in {'zip','xlsx'} and not magic.startswith(b'PK'):raise ValueError('Invalid ZIP/XLSX magic')
     if e['format']=='parquet' and not magic.startswith(b'PAR1'):raise ValueError('Invalid Parquet magic')
     if e['format']=='pdf' and not magic.startswith(b'%PDF'):raise ValueError('Invalid PDF magic')
     if e.get('expected_sha256') and h.hexdigest()!=e['expected_sha256']:raise ValueError('Provider SHA256 mismatch')
     if e.get('expected_md5') and md5.hexdigest()!=e['expected_md5']:raise ValueError('Provider MD5 mismatch')
     blob=bucket.blob(f'{prefix}/raw/{path.name}')
     if blob.exists():
      blob.reload()
      verify=root/(sid+'.verify');blob.download_to_filename(str(verify),checksum='auto')
      if sha(verify)!=h.hexdigest():raise ValueError('Existing immutable raw differs; require new run')
      verify.unlink()
     else:blob.upload_from_filename(str(path),if_generation_match=0,checksum='auto');blob.reload()
     e.update(raw_uri=f'gs://{BUCKET}/{blob.name}',generation=str(blob.generation),sha256=h.hexdigest(),received_bytes=received)
     upload(bucket,checkpoint.name,(dump(e)+'\n').encode())
    # Generation-pinned round trip before parsing. This verifies the stored input.
    blob.download_to_filename(str(path),checksum='auto')
    if sha(path)!=e['sha256']:raise ValueError('Raw cloud object checksum mismatch')
    e['members']=[{'name':n,'bytes':b} for n,b in members(path,e['format'])] if e.get('parse_mode')!='raw_only' else [{'name':path.name,'bytes':path.stat().st_size,'archive_scan':'pending_adapter'}]
    names=[m['name'] for m in e['members']]
    if len(names)!=len(set(names)):raise ValueError('Duplicate archive member names')
    supported={'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}
    e['unparsed_members']=[m for m in e['members'] if Path(m['name']).suffix.lower().lstrip('.') not in supported] if e['format'] in {'zip','tar.gz'} else []
    with gzip.open(out,'wt',encoding='utf-8',compresslevel=1) as f:
     for member,n,row in ([] if e.get('parse_mode')=='raw_only' else records(path,e['format'],root,e.get('max_member_bytes',2_000_000_000))):
      if count==0 and e.get('expected_header') and row.get('columns')!=e['expected_header']:raise ValueError('Declared provider CSV header changed')
      f.write(dump(dict(release_id=rid,source_id=sid,member=member,row_number=n,record_json=dump(row),source_url=e['url'],source_sha256=e['sha256']))+'\n');count+=1
    if e['format'] in {'csv','worldbank_json','xlsx','parquet','zip','js','wid_csv'} and not count and not e.get('parse_mode'):
     if e['format']!='zip':raise ValueError('Dataset produced no source records')
    e['accepted_records']=count;e['rejected_records']=0;e['deduplicated_records']=0
    e['processing_status']='source_records_validated' if count else 'raw_dataset_held_pending_adapter' if e.get('parse_mode')=='raw_only' else 'raw_document_preserved'
    if count:
     attempt=str(time.time_ns());st=bucket.blob(f'{prefix}/staging/{attempt}/{sid}.jsonl.gz');st.upload_from_filename(str(out),if_generation_match=0,checksum='auto');st.reload()
     e['stage_uri']=f'gs://{BUCKET}/{st.name}';e['stage_sha256']=sha(out);e['stage_generation']=str(st.generation)
     stages.append(e['stage_uri']);total+=count
   except Exception as ex:
    e['processing_status']='unavailable_or_failed';e['error']=str(ex)[:1200];e['accepted_records']=0
    e['rejected_records']=count;e['publication_status']='not_published'
   finally:
    e['seconds']=round(time.monotonic()-start,3);catalog.append(e)
    for f in [path,out,*root.glob('member_*'),*root.glob('tar_member_*')]:
     if f.exists():f.unlink()
   print(dump({'event':'source_processed','source_id':sid,'status':e['processing_status'],'rows':e['accepted_records'],'error':e.get('error')}),flush=True)
  if not stages:raise ValueError('No original-provider records available for publication')
  cpath=root/'catalog.jsonl'
  with open(cpath,'w') as f:
   for e in catalog:f.write(dump({'release_id':rid,'source_id':e['source_id'],'processing_status':e['processing_status'],'source_metadata_json':dump(e)})+'\n')
  cblob=bucket.blob(f'{prefix}/staging/{time.time_ns()}/catalog.jsonl');cblob.upload_from_filename(str(cpath),if_generation_match=0,checksum='auto')
  cs=[bigquery.SchemaField(x,'STRING') for x in ['release_id','source_id','processing_status','source_metadata_json']]
  rt=f'{D}.stage_report_records_{token}';ct=f'{D}.stage_report_catalog_{token}'
  for table,uris,s in [(rt,stages,schema),(ct,[f'gs://{BUCKET}/{cblob.name}'],cs)]:
   bq.load_table_from_uri(uris,table,job_config=bigquery.LoadJobConfig(schema=s,source_format='NEWLINE_DELIMITED_JSON',write_disposition='WRITE_TRUNCATE',max_bad_records=0),location='EU').result(timeout=900)
  checks=query(f'SELECT COUNT(*) n,COUNT(DISTINCT TO_JSON_STRING(STRUCT(source_id,member,row_number))) unique_n FROM `{rt}`')[0]
  if checks.n!=total or checks.unique_n!=total:raise ValueError('Warehouse count/key validation failed')
  by_source={r.source_id:r.n for r in query(f'SELECT source_id,COUNT(*) n FROM `{rt}` GROUP BY source_id')}
  if by_source!={x['source_id']:x['accepted_records'] for x in catalog if x['accepted_records']}:raise ValueError('Per-source warehouse count mismatch')
  for e in catalog:
   if e['accepted_records']:e['publication_status']='published_source_records'
   elif e['processing_status']=='raw_document_preserved':e['publication_status']='published_source_catalog_only'
  receipt=dict(release_id=rid,loader_git_sha=a.loader_sha,build_id=rid,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=started,completed_at=stamp(),received_sources=len(catalog),accepted_source_records=total,accepted_sources=sum(x['accepted_records']>0 for x in catalog),unavailable_sources=sum(x['processing_status']=='unavailable_or_failed' for x in catalog),publication_status='published',processing_status='validated_available_source_bundle',sources=catalog,validation={'raw_sha256':'passed for accepted records and preserved raw documents only; unavailable sources excluded','raw_generation_pinned_roundtrip':'passed for accepted records and preserved raw documents only; unavailable sources excluded','unique_source_member_row_keys':'passed','warehouse_row_count':'passed','max_bad_records':0,'semantic_metric_normalization':'not_claimed; original provider records and metadata only','numeric_totals':'not_applicable to heterogeneous unnormalized records'},publication_pointer=f'{D}.release_pointer[hdr_report_sources_2025]',destinations=[f'{D}.current_report_source_records',f'{D}.current_report_source_catalog'],website_destinations=[],coverage='Only catalogued successful provider files; not complete report coverage. Original, newer and related sources remain separate.')
  receipt_bytes=(dump(receipt)+'\n').encode();receipt_uri=f'gs://{BUCKET}/{prefix}/completed.json';receipt_sha=hashlib.sha256(receipt_bytes).hexdigest()
  prepared=bucket.blob(f'{prefix}/prepared-receipt.json')
  if prepared.exists():
   previous=prepared.download_as_bytes();pr=json.loads(previous)
   old=[(x['source_id'],x.get('sha256'),x['accepted_records']) for x in pr['sources']]
   new=[(x['source_id'],x.get('sha256'),x['accepted_records']) for x in catalog]
   if old!=new:raise ValueError('Prepared release differs; retry under a new run id')
   receipt_bytes=previous;receipt_sha=hashlib.sha256(previous).hexdigest()
  else:upload(bucket,prepared.name,receipt_bytes)
  query(f'CREATE TABLE IF NOT EXISTS `{D}.report_source_records` AS SELECT * FROM `{rt}` WHERE FALSE')
  query(f'CREATE TABLE IF NOT EXISTS `{D}.report_source_catalog` AS SELECT * FROM `{ct}` WHERE FALSE')
  for name in ['records','catalog']:query(f"CREATE OR REPLACE VIEW `{D}.current_report_source_{name}` AS SELECT r.* FROM `{D}.report_source_{name}` r JOIN `{D}.release_pointer` p ON r.release_id=p.release_id WHERE p.dataset_id='hdr_report_sources_2025'")
  query(f"CREATE OR REPLACE VIEW `{D}.current_verified_report_claims` AS SELECT release_id,JSON_VALUE(record_json,'$.source_id') source_id,JSON_VALUE(record_json,'$.metric') metric,JSON_VALUE(record_json,'$.source_value') source_value,SAFE_CAST(JSON_VALUE(record_json,'$.source_value') AS BIGNUMERIC) value,JSON_VALUE(record_json,'$.unit') unit,JSON_VALUE(record_json,'$.period') period,JSON_VALUE(record_json,'$.geography') geography,JSON_VALUE(record_json,'$.denominator') denominator,JSON_VALUE(record_json,'$.coverage') coverage,JSON_VALUE(record_json,'$.report_locator') report_locator,JSON_VALUE(record_json,'$.correction_reason') correction_reason,source_url,source_sha256 FROM `{D}.current_report_source_records` WHERE member='reviewed_original_aggregate'")
  query(f"""CREATE OR REPLACE VIEW `{D}.current_wdi_source_observations` AS
  WITH country_meta AS (SELECT JSON_VALUE(record_json,'$.id') iso3,
   JSON_VALUE(record_json,'$.region.id') region_id FROM `{D}.current_report_source_records`
   WHERE source_id='wdi_country_metadata' AND NOT ENDS_WITH(member,'::metadata')),
  indicator_meta AS (SELECT JSON_VALUE(record_json,'$.id') metric,JSON_VALUE(record_json,'$.sourceNote') source_definition,JSON_VALUE(record_json,'$.sourceOrganization') source_organizations
   FROM `{D}.current_report_source_records` WHERE STARTS_WITH(source_id,'wdi_meta_') AND NOT ENDS_WITH(member,'::metadata'))
  SELECT r.release_id,r.source_id,JSON_VALUE(r.record_json,'$.indicator.id') metric,
   JSON_VALUE(r.record_json,'$.indicator.value') metric_label,
   JSON_VALUE(r.record_json,'$.countryiso3code') country_code,
   JSON_VALUE(r.record_json,'$.country.value') country_name,
   CASE WHEN c.region_id='NA' THEN 'aggregate' WHEN c.region_id IS NOT NULL THEN 'country_or_area' ELSE 'unresolved' END geography_kind,
   JSON_VALUE(r.record_json,'$.date') period,JSON_VALUE(r.record_json,'$.value') source_value,
   SAFE_CAST(JSON_VALUE(r.record_json,'$.value') AS BIGNUMERIC) value,
   JSON_VALUE(r.record_json,'$.unit') provider_unit_field,
   JSON_VALUE(r.record_json,'$.obs_status') provider_observation_status,
   d.source_definition,d.source_organizations,r.source_url,r.source_sha256 FROM `{D}.current_report_source_records` r
   LEFT JOIN country_meta c ON JSON_VALUE(r.record_json,'$.countryiso3code')=c.iso3
   LEFT JOIN indicator_meta d ON JSON_VALUE(r.record_json,'$.indicator.id')=d.metric
   WHERE STARTS_WITH(r.source_id,'wdi_') AND r.source_id!='wdi_country_metadata' AND NOT STARTS_WITH(r.source_id,'wdi_meta_')
   AND NOT ENDS_WITH(r.member,'::metadata')""")
  query(f"""CREATE OR REPLACE VIEW `{D}.current_wid_top1_income_source_observations` AS
   SELECT release_id,source_id,JSON_VALUE(record_json,'$.country') country_or_region_source_code,
   JSON_VALUE(record_json,'$.variable') metric,JSON_VALUE(record_json,'$.percentile') percentile,
   JSON_VALUE(record_json,'$.year') period,JSON_VALUE(record_json,'$.value') source_value,
   SAFE_CAST(JSON_VALUE(record_json,'$.value') AS BIGNUMERIC) value,'proportion' unit,
   'adult equal-split pretax national income' denominator,record_json,source_url,source_sha256
   FROM `{D}.current_report_source_records` WHERE STARTS_WITH(source_id,'wid_current_')
   AND NOT ENDS_WITH(member,'::coverage')""")
  # Catalog staged metadata is authoritative for process status; receipt adds publication status.
  q=dump
  query(f"""BEGIN TRANSACTION;
  ASSERT (SELECT COUNT(*) FROM `{D}.report_source_records` WHERE release_id={q(rid)})=0 AS 'release already committed';
  INSERT INTO `{D}.report_source_records` SELECT * FROM `{rt}`;
  INSERT INTO `{D}.report_source_catalog` SELECT * FROM `{ct}`;
  DELETE FROM `{D}.release_pointer` WHERE dataset_id='hdr_report_sources_2025';
  INSERT INTO `{D}.release_pointer` VALUES ('hdr_report_sources_2025',{q(rid)},CURRENT_TIMESTAMP());
  INSERT INTO `{D}.ingestion_runs` VALUES ({q(rid)},{q(a.loader_sha)},CURRENT_TIMESTAMP(),{q(receipt_uri)},{q(receipt_sha)},{q(dump({'source_records':total,'sources':len(catalog)}))});
  COMMIT TRANSACTION;""")
  upload(bucket,f'{prefix}/completed.json',receipt_bytes)
  for table in [rt,ct]:bq.delete_table(table)
  print(dump({'event':'published','receipt_uri':receipt_uri,'sha256':receipt_sha,'source_records':total}),flush=True)
if __name__=='__main__':main()
