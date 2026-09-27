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
def csv_encoding(path):
 # Validate the whole source, not just a clean prefix: a legacy quote can occur
 # much later than the delimiter/header sample. Neither decoder replaces bytes.
 decoder=codecs.getincrementaldecoder('utf-8-sig')()
 try:
  with open(path,'rb') as stream:
   for chunk in iter(lambda:stream.read(65536),b''):decoder.decode(chunk,final=False)
  decoder.decode(b'',final=True)
  return 'utf-8-sig'
 except UnicodeDecodeError:
  decoder=codecs.getincrementaldecoder('cp1252')()
  with open(path,'rb') as stream:
   for chunk in iter(lambda:stream.read(65536),b''):decoder.decode(chunk,final=False)
  decoder.decode(b'',final=True)
  return 'cp1252'
def claim_source_text(path,fmt):
 if path.stat().st_size>50_000_000:raise ValueError('Claim document exceeds 50MB bound')
 with open(path,'rb') as f:magic=f.read(5)
 if magic==b'%PDF-':
  from pypdf import PdfReader
  reader=PdfReader(str(path),strict=True)
  if reader.is_encrypted:raise ValueError('Encrypted claim PDF')
  if len(reader.pages)>500:raise ValueError('Claim PDF exceeds 500-page bound')
  text=' '.join(page.extract_text() or '' for page in reader.pages)
  if not text.strip():raise ValueError('Claim PDF has no extractable text; manual review required')
 elif fmt=='verified_claim_pdf':raise ValueError('Expected PDF source magic absent')
 else:text=re.sub(r'<[^>]*>',' ',decode(path.read_bytes()))
 return re.sub(r'\s+',' ',text)
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

def archive_metadata_member(name):
 # Publisher ZIPs can contain binary AppleDouble sidecars named like datasets.
 # Preserve them in the immutable raw archive and receipt, never parse as CSV.
 parts=Path(name).parts
 return '__MACOSX' in parts or Path(name).name.startswith('._') or Path(name).name=='.DS_Store'

def extract_layout(data,entry,metadata):
 if data.startswith(b'PK'):
  selected=entry.get('layout_member')
  if not selected:raise ValueError('Verified SAS archive member required')
  with zipfile.ZipFile(io.BytesIO(data)) as archive:
   names=archive.namelist()
   if len(names)!=len(set(names)) or selected not in names:raise ValueError('SAS archive member identity mismatch')
   member=archive.getinfo(selected)
   if member.file_size>min(entry.get('layout_max_member_bytes',2_000_000),2_000_000):raise ValueError('SAS member exceeds reviewed bound')
   text_bytes=archive.read(selected)
   metadata['archive_members']=[dict(name=m.filename,bytes=m.file_size) for m in archive.infolist()]
   metadata['selected_member']=selected;metadata['selected_member_sha256']=hashlib.sha256(text_bytes).hexdigest()
 else:
  if entry.get('layout_member'):raise ValueError('Expected SAS ZIP archive absent')
  text_bytes=data
 return decode(text_bytes)

def acquire_layout(bucket,prefix,entry,root,resume_run=None):
 """Pin a small original SAS layout alongside the immutable data archive."""
 sid=entry['source_id'];url=entry['layout_url'];name=f'{prefix}/raw/{sid}.layout.sas.metadata.json'
 checkpoint=bucket.blob(name);saved=None
 if checkpoint.exists():saved=json.loads(checkpoint.download_as_bytes())
 elif resume_run:
  prior=bucket.blob(f'processing-runs/hdr-report-sources/{resume_run}/raw/{sid}.layout.sas.metadata.json')
  if prior.exists():
   candidate=json.loads(prior.download_as_bytes())
   if candidate.get('url')==url:saved=candidate
 if saved is None:
  request=urllib.request.Request(url,headers={'User-Agent':'PublicSpendingData/1.0 (public source ingestion)'})
  with urllib.request.urlopen(request,timeout=60) as response:
   data=response.read(2_000_001)
   if len(data)>2_000_000:raise ValueError('Source SAS layout exceeds 2MB bound')
   content_type=response.headers.get('Content-Type','')
   if 'text/html' in content_type or data.lstrip().lower().startswith(b'<!doctype html'):raise ValueError('Provider returned HTML instead of SAS layout')
   final_url=response.url
  digest=hashlib.sha256(data).hexdigest()
  if entry.get('layout_expected_sha256') and digest!=entry['layout_expected_sha256']:raise ValueError('Reviewed source SAS archive SHA256 changed')
  blob=bucket.blob(f'{prefix}/raw/{sid}.layout.sas')
  if blob.exists():
   blob.reload()
   if hashlib.sha256(blob.download_as_bytes(checksum='auto')).hexdigest()!=digest:raise ValueError('Existing immutable SAS raw differs')
  else:blob.upload_from_string(data,if_generation_match=0,checksum='auto');blob.reload()
  saved=dict(url=url,final_url=final_url,sha256=digest,generation=str(blob.generation),raw_uri=f'gs://{BUCKET}/{blob.name}',bytes=len(data),retrieved_at=stamp(),content_type=content_type)
 else:
  if saved['url']!=url:raise ValueError('SAS layout checkpoint identity mismatch')
  if not saved['raw_uri'].startswith('gs://'+BUCKET+'/processing-runs/hdr-report-sources/'):raise ValueError('Untrusted layout raw URI')
  blob=bucket.blob(saved['raw_uri'].split('/',3)[3],generation=int(saved['generation']))
  data=blob.download_as_bytes(checksum='auto')
  if len(data)>2_000_000 or hashlib.sha256(data).hexdigest()!=saved['sha256']:raise ValueError('SAS layout immutable checksum mismatch')
 # Verify the exact stored generation before any layout parsing, including a
 # fresh upload; the source and stored bytes must both match the pinned hash.
 pinned=bucket.blob(saved['raw_uri'].split('/',3)[3],generation=int(saved['generation']))
 data=pinned.download_as_bytes(checksum='auto')
 if len(data)>2_000_000 or hashlib.sha256(data).hexdigest()!=saved['sha256']:raise ValueError('SAS layout stored generation checksum mismatch')
 if entry.get('layout_expected_sha256') and saved['sha256']!=entry['layout_expected_sha256']:raise ValueError('Reviewed SAS layout checkpoint hash differs')
 if not checkpoint.exists():upload(bucket,name,(dump(saved)+'\n').encode())
 return extract_layout(data,entry,saved),saved

def records(path,fmt,root,max_member_bytes=2_000_000_000,source_binding=None):
 """Yield (member, original row ordinal, source JSON). Raw always retained."""
 if fmt=='brfss_ascii':
  from brfss_ascii import rows_from_archive
  if source_binding is None:raise ValueError('Verified SAS layout binding required')
  yield from rows_from_archive(path,source_binding['layout_text'],source_binding['expected_rows'],source_binding['expected_widths'],source_binding['expected_columns'],source_binding['layout_meta'])
 elif fmt=='wid_csv':
  with open(path,encoding='utf-8-sig',newline='') as f:
   reader=csv.DictReader(f,delimiter=';');seen=0;accepted=0
   required={'country','variable','percentile','year','value','age','pop'}
   if not required.issubset(set(reader.fieldnames or [])):raise ValueError('Unexpected WID source schema')
   yield path.name+'::metadata',1,{'kind':'header','columns':reader.fieldnames,'delimiter':';'}
   for n,row in enumerate(reader,1):
    seen+=1
    if row.get('variable')=='sptincj992' and row.get('percentile')=='p99p100' and row.get('age')=='992' and row.get('pop')=='j':
     accepted+=1;yield path.name,n,row
   if accepted==0:raise ValueError('No requested WIDtop1income observations; raw retained, no countryseries published')
   yield path.name+'::coverage',1,{'received_csv_rows':seen,'accepted_top1_income_rows':accepted,'filtered_out_rows':seen-accepted,'filter':{'variable':'sptincj992','percentile':'p99p100','age':'992','pop':'j'},'denominator':'adult equal-split pretax national income; source share is proportion'}
 elif fmt=='tar.gz':
  with tarfile.open(path,'r:gz') as t:
   for i,m in enumerate(t):
    ext=Path(m.name).suffix.lower().lstrip('.')
    if not m.isfile() or archive_metadata_member(m.name) or ext not in {'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}:continue
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
    if m.is_dir() or archive_metadata_member(m.filename) or ext not in {'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}:continue
    if m.file_size>max_member_bytes:raise ValueError('Archive member exceeds 2GB bound')
    dest=root/f'member_{i}.{ext}'
    with z.open(m) as src,open(dest,'wb') as out:
     while b:=src.read(1024*1024):out.write(b)
    for member,n,row in records(dest,ext,root,max_member_bytes):yield m.filename+'::'+member,n,row
    dest.unlink()
 elif fmt in {'csv','tsv'}:
  # Strict decode, never discard invalid characters. Preserve duplicates via arrays.
  encoding=csv_encoding(path)
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
  expected_rows=None;source_meta=None
  if fmt=='sav':
   _,source_meta=fn(str(path),metadataonly=True,**kwargs)
   expected_rows=source_meta.number_rows
   if not isinstance(expected_rows,int) or expected_rows<0:raise ValueError('SAV source case count unavailable')
  for df,meta in pyreadstat.read_file_in_chunks(fn,str(path),chunksize=20000 if fmt=='sav' else 2000,**kwargs):
   if source_meta is not None:meta=source_meta
   if n==0:yield path.name+'::metadata',1,{'expected_source_row_count':expected_rows,'columns':meta.column_names,'labels':meta.column_names_to_labels,'value_labels':meta.variable_value_labels,'missing_ranges':getattr(meta,'missing_ranges',None),'missing_user_values':getattr(meta,'missing_user_values',None),'original_variable_types':getattr(meta,'original_variable_types',None),'file_encoding':getattr(meta,'file_encoding',None),'readstat_variable_types':getattr(meta,'readstat_variable_types',None)}
   df=df.astype(object).where(df.notna(),None)
   # Keep only one row dictionary alive, not a whole wide chunk of dictionaries.
   for values in df.itertuples(index=False,name=None):
    n+=1;yield path.name,n,dict(zip(df.columns,values))
    if fmt=='sav' and n%20000==0:print(dump({'event':'statistical_source_progress','member':path.name,'rows':n,'expected_rows':expected_rows}),flush=True)
  if expected_rows is not None and n!=expected_rows:raise ValueError('SAV full source case count mismatch')
 elif fmt in {'verified_claim_html','verified_claim_pdf'}:
  claims=json.loads(Path('pipeline/undp_cloud/audit/ch3_4_verified_claims.json').read_text(),parse_float=Decimal)
  # Source association is resolved by the caller; each curated observation retains
  # its exact source URL, denominator, period and correction rationale.
  sid=path.stem
  selected=[x for x in claims if 'verified_'+x['source_id']==sid]
  source_text=claim_source_text(path,fmt)
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

def select_sources(entries, group, manifest):
 ids=[e['source_id'] for e in entries]
 flat=[sid for members in manifest['groups'].values() for sid in members]
 if len(ids)!=len(set(ids)) or len(flat)!=len(set(flat)) or set(ids)!=set(flat):
  raise ValueError('Source groups must partition every audit entry exactly once')
 if group=='all':return entries
 if group not in manifest['groups']:raise ValueError('Unknown source group')
 selected=set(manifest['groups'][group])
 return [e for e in entries if e['source_id'] in selected]

def uuid_run(value):
 if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',value):
  raise argparse.ArgumentTypeError('Resume run must be an exact UUID')
 return value

def preview_record(preview, member, row):
 # No individual respondent values. Retain headers/types and workbook structure.
 if isinstance(row,dict) and row.get('kind')=='header':preview.setdefault('headers',{})[member]=row
 elif member.endswith('::metadata'):preview.setdefault('metadata',{})[member]=row
 elif isinstance(row,dict) and 'sheet' in row:
  sheets=preview.setdefault('sheets',{});sheet=sheets.setdefault(row['sheet'],{'rows':0,'max_columns':0,'cell_types':{}})
  if row.get('representation')=='cached_values':
   if sheet['rows']<10:sheet.setdefault('first_10_source_aggregate_rows',[]).append(row['values'])
   sheet['rows']+=1;sheet['max_columns']=max(sheet['max_columns'],len(row['values']))
   for value in row['values']:
    kind=type(value).__name__;sheet['cell_types'][kind]=sheet['cell_types'].get(kind,0)+1
 elif isinstance(row,dict):
  types=preview.setdefault('column_types',{})
  for key,value in row.items():
   kind=type(value).__name__;types.setdefault(key,[])
   if kind not in types[key]:types[key].append(kind)

def verify_stage(bucket, saved, entry, path, preview):
 uri=saved['stage_uri'];name=uri.split('/',3)[3]
 if not uri.startswith('gs://'+BUCKET+'/processing-runs/hdr-report-sources/'):raise ValueError('Untrusted stage destination')
 current=bucket.blob(name);current.reload()
 if str(current.generation)!=str(saved['stage_generation']):raise ValueError('Stage latest generation differs from pinned version')
 blob=bucket.blob(name,generation=int(saved['stage_generation']));blob.reload()
 if saved.get('stage_md5') and blob.md5_hash!=saved['stage_md5']:raise ValueError('Stage metadata MD5 changed')
 blob.download_to_filename(str(path),checksum='auto')
 digest=sha(path)
 if saved.get('stage_sha256') and digest!=saved['stage_sha256']:raise ValueError('Stage SHA256 changed')
 count=0
 with gzip.open(path,'rt',encoding='utf-8') as stream:
  for line in stream:
   row=json.loads(line)
   if row['source_id']!=entry['source_id'] or row['source_sha256']!=entry['sha256'] or row['source_url']!=entry['url']:raise ValueError('Reused stage source identity mismatch')
   preview_record(preview,row['member'],json.loads(row['record_json']));count+=1
 if count!=saved['accepted_records']:raise ValueError('Reused stage row count mismatch')
 return dict(saved,stage_sha256=digest,accepted_records=count)

def transaction_with_retry(run, confirmed_committed, sleep=time.sleep):
 for attempt in range(3):
  try:return run()
  except Exception as exc:
   if confirmed_committed():return None
   message=str(exc).lower()
   aborted=type(exc).__name__=='Aborted' or 'transaction is aborted due to concurrent update' in message
   if not aborted or attempt==2:raise
   sleep(2**attempt)

def main():
 p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True);p.add_argument('--source-group',default='all');p.add_argument('--wid-shard-index',type=int,default=0);p.add_argument('--wid-shard-count',type=int,default=1);p.add_argument('--resume-run',type=lambda v: uuid_run(v) if v else None);a=p.parse_args()
 if not 1<=a.wid_shard_count<=32 or not 0<=a.wid_shard_index<a.wid_shard_count:raise ValueError('Invalid WID shard bounds')
 if a.wid_shard_count>1 and a.source_group!='inequality':raise ValueError('WID sharding requires inequality source group')
 pointer='hdr_report_sources_2025' if a.source_group=='all' else 'hdr_report_sources_2025:'+a.source_group
 if a.wid_shard_count>1:pointer+=f'-wid-{a.wid_shard_index}-of-{a.wid_shard_count}'
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
 sources=select_sources(sources,a.source_group,json.loads(Path('pipeline/undp_cloud/source_groups.json').read_text()))
 resume_manifest=json.loads(Path('pipeline/undp_cloud/education_resume.json').read_text())
 # Enumerate WID with its own published catalogue, retaining it as immutable raw.
 expanded=[];wid_catalogue_count=0;wid_selected_codes=[]
 for e in sources:
  if not e.get('expand_catalog_url'):
   if a.wid_shard_index==0:expanded.append(e)
   continue
  cu=e['expand_catalog_url'];cp=bucket.blob(f'{prefix}/raw/wid-country-catalogue.R')
  if cp.exists():cd=cp.download_as_bytes()
  else:
   with urllib.request.urlopen(cu,timeout=60) as r:cd=r.read(3_000_001)
   if len(cd)>3_000_000:raise ValueError('WID catalogue exceeded3MBbound')
   upload(bucket,cp.name,cd)
  found=re.findall(r'^([A-Z]{2})\s*<-\s*c\(([^\n]*)',cd.decode('utf-8-sig'),re.M)
  codes=sorted({code for code,variables in found if '"sptinc"' in variables})
  if len(codes)<100:raise ValueError('Incomplete WID official country catalogue')
  wid_catalogue_count=len(codes);selected_codes=[code for i,code in enumerate(codes) if i%a.wid_shard_count==a.wid_shard_index];wid_selected_codes=selected_codes
  for code in selected_codes:
   child=dict(e,source_id='wid_current_'+code,url=e['url_template'].replace('{COUNTRY}',code),format='wid_csv',country_or_region_source_code=code,catalogue_sha256=hashlib.sha256(cd).hexdigest(),catalogue_raw_uri=f'gs://{BUCKET}/{cp.name}',enumerated_source_codes=len(codes))
   child.pop('expand_catalog_url',None);expanded.append(child)
 sources=expanded
 catalog=[];total=0;schema=[bigquery.SchemaField(n,t) for n,t in [('release_id','STRING'),('source_id','STRING'),('member','STRING'),('row_number','INTEGER'),('record_json','STRING'),('source_url','STRING'),('source_sha256','STRING')]]
 with tempfile.TemporaryDirectory() as td:
  root=Path(td);stages=[]
  for entry in sources:
   e=dict(entry);sid=e['source_id'];start=time.monotonic();count=0;preview={};path=root/(sid+'.'+e['format']);out=root/(sid+'.jsonl.gz')
   try:
    checkpoint=bucket.blob(f'{prefix}/raw/{sid}.metadata.json')
    prior_checkpoint=bucket.blob(f'processing-runs/hdr-report-sources/{a.resume_run}/raw/{sid}.metadata.json') if a.resume_run else None
    prior_identity_changed=False
    if not checkpoint.exists() and prior_checkpoint is not None and prior_checkpoint.exists():
     prior=json.loads(prior_checkpoint.download_as_bytes())
     if any(prior.get(k)!=entry.get(k) for k in ('source_id','url','format')):
      e['prior_raw_catalogue_changed']={k:prior.get(k) for k in ('source_id','url','format','raw_uri','generation','sha256')}
      e['prior_raw_catalogue_changed']['run_id']=a.resume_run
      prior_checkpoint=None;prior_identity_changed=True
    if checkpoint.exists() or (prior_checkpoint is not None and prior_checkpoint.exists()):
     saved=json.loads((checkpoint if checkpoint.exists() else prior_checkpoint).download_as_bytes())
     if saved['source_id']!=sid or saved['url']!=entry['url'] or saved['format']!=entry['format']:raise ValueError('Resume raw identity mismatch')
     e.update(saved)
     # Reuse immutable bytes, while the corrected current parser contract remains
     # authoritative; older checkpoint fields describe an earlier filter/schema.
     for key in ('filters','expected_header','max_member_bytes','parse_mode','code_verification'):
      if key in entry:e[key]=entry[key]
     if not e['raw_uri'].startswith('gs://'+BUCKET+'/processing-runs/hdr-report-sources/'):raise ValueError('Untrusted resume raw destination')
     if not checkpoint.exists():e['resumed_raw_from_run']=a.resume_run;upload(bucket,checkpoint.name,(dump(e)+'\n').encode())
     blob=bucket.blob(e['raw_uri'].split('/',3)[3],generation=int(e['generation']))
    else:
     req=urllib.request.Request(e['url'],headers={'User-Agent':'PublicSpendingData/1.0 (public source ingestion)'})
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
     if e['format'] in {'zip','xlsx','brfss_ascii'} and not magic.startswith(b'PK'):raise ValueError('Invalid ZIP/XLSX magic')
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
    processed=bucket.blob(f'{prefix}/processed/{sid}.json')
    prior_processed=bucket.blob(f'processing-runs/hdr-report-sources/{a.resume_run}/processed/{sid}.json') if a.resume_run and not prior_identity_changed else None
    saved_stage=None
    if processed.exists():saved_stage=json.loads(processed.download_as_bytes())
    elif prior_processed is not None and prior_processed.exists():saved_stage=json.loads(prior_processed.download_as_bytes())
    elif a.resume_run==resume_manifest['run_id'] and sid in resume_manifest['sources']:
     saved_stage=dict(resume_manifest['sources'][sid],parser_git_sha=resume_manifest['parser_git_sha'],resumed_from_run=a.resume_run)
    if saved_stage is not None:
     saved_stage=verify_stage(bucket,saved_stage,e,out,preview);e.update(saved_stage)
     count=e['accepted_records'];e['processing_status']='source_records_validated';e['rejected_records']=0;e['deduplicated_records']=0
     stages.append(e['stage_uri']);total+=count
     upload(bucket,f'{prefix}/schema-previews/{sid}.json',(dump(dict(source_id=sid,source_sha256=e['sha256'],preview=preview))+'\n').encode())
     if not processed.exists():upload(bucket,processed.name,(dump(e)+'\n').encode())
     print(dump({'event':'source_resumed','source_id':sid,'rows':count,'parser_git_sha':e.get('parser_git_sha')}),flush=True)
     continue
    parser_binding=None
    if e['format']=='brfss_ascii':
     layout_text,layout_meta=acquire_layout(bucket,prefix,e,root,a.resume_run);e['layout_meta']=layout_meta
     parser_binding=dict(layout_text=layout_text,layout_meta=layout_meta,expected_rows=e['expected_rows'],expected_widths=e['expected_widths'],expected_columns=e['expected_columns'])
    e['members']=[{'name':n,'bytes':b} for n,b in members(path,'zip' if e['format']=='brfss_ascii' else e['format'])] if e.get('parse_mode')!='raw_only' else [{'name':path.name,'bytes':path.stat().st_size,'archive_scan':'pending_adapter'}]
    names=[m['name'] for m in e['members']]
    if len(names)!=len(set(names)):raise ValueError('Duplicate archive member names')
    supported={'csv','tsv','xlsx','parquet','xpt','dta','json','sav'}
    e['archive_metadata_members']=[dict(m,reason='archive_filesystem_metadata') for m in e['members'] if archive_metadata_member(m['name'])] if e['format'] in {'zip','tar.gz'} else []
    e['unparsed_members']=[m for m in e['members'] if archive_metadata_member(m['name']) or Path(m['name']).suffix.lower().lstrip('.') not in supported] if e['format'] in {'zip','tar.gz'} else []
    with gzip.open(out,'wt',encoding='utf-8',compresslevel=1) as f:
     for member,n,row in ([] if e.get('parse_mode')=='raw_only' else records(path,e['format'],root,e.get('max_member_bytes',2_000_000_000),parser_binding)):
      if count==0 and e.get('expected_header') and row.get('columns')!=e['expected_header']:raise ValueError('Declared provider CSV header changed')
      preview_record(preview,member,row)
      f.write(dump(dict(release_id=rid,source_id=sid,member=member,row_number=n,record_json=dump(row),source_url=e['url'],source_sha256=e['sha256']))+'\n');count+=1
    if e['format'] in {'csv','worldbank_json','xlsx','parquet','zip','js','wid_csv','brfss_ascii'} and not count and not e.get('parse_mode'):
     if e['format']!='zip':raise ValueError('Dataset produced no source records')
    e['accepted_records']=count;e['rejected_records']=0;e['deduplicated_records']=0
    e['processing_status']='source_records_validated' if count else 'raw_dataset_held_pending_adapter' if e.get('parse_mode')=='raw_only' else 'raw_document_preserved'
    if count:
     attempt=str(time.time_ns());st=bucket.blob(f'{prefix}/staging/{attempt}/{sid}.jsonl.gz');st.upload_from_filename(str(out),if_generation_match=0,checksum='auto');st.reload()
     e['stage_uri']=f'gs://{BUCKET}/{st.name}';e['stage_sha256']=sha(out);e['stage_generation']=str(st.generation)
     stages.append(e['stage_uri']);total+=count
     e['parser_git_sha']=a.loader_sha
     upload(bucket,f'{prefix}/processed/{sid}.json',(dump(e)+'\n').encode())
    upload(bucket,f'{prefix}/schema-previews/{sid}.json',(dump(dict(source_id=sid,source_sha256=e['sha256'],preview=preview))+'\n').encode())
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
  receipt=dict(release_id=rid,loader_git_sha=a.loader_sha,build_id=rid,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=started,completed_at=stamp(),received_sources=len(catalog),accepted_source_records=total,accepted_sources=sum(x['accepted_records']>0 for x in catalog),unavailable_sources=sum(x['processing_status']=='unavailable_or_failed' for x in catalog),publication_status='published',processing_status='validated_available_source_bundle',sources=catalog,validation={'raw_sha256':'passed for accepted records and preserved raw documents only; unavailable sources excluded','raw_generation_pinned_roundtrip':'passed for accepted records and preserved raw documents only; unavailable sources excluded','unique_source_member_row_keys':'passed','warehouse_row_count':'passed','max_bad_records':0,'semantic_metric_normalization':'not_claimed; original provider records and metadata only','numeric_totals':'not_applicable to heterogeneous unnormalized records'},source_group=a.source_group,resume_run=a.resume_run,wid_shard_index=a.wid_shard_index,wid_shard_count=a.wid_shard_count,wid_catalogue_count=wid_catalogue_count,wid_selected_codes=wid_selected_codes,publication_pointer=f'{D}.release_pointer[{pointer}]',destinations=[f'{D}.current_report_source_records',f'{D}.current_report_source_catalog'],website_destinations=[],coverage='Only catalogued successful provider files; not complete report coverage. Original, newer and related sources remain separate.')
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
  for name in ['records','catalog']:
   query(f"""CREATE OR REPLACE VIEW `{D}.current_report_source_{name}` AS
   WITH owners AS (SELECT c.source_id,c.release_id FROM `{D}.report_source_catalog` c
    JOIN `{D}.release_pointer` p ON c.release_id=p.release_id
    WHERE p.dataset_id='hdr_report_sources_2025' OR STARTS_WITH(p.dataset_id,'hdr_report_sources_2025:')
    QUALIFY ROW_NUMBER() OVER (PARTITION BY c.source_id ORDER BY p.published_at DESC,p.dataset_id,c.release_id)=1)
   SELECT r.* FROM `{D}.report_source_{name}` r JOIN owners o USING(source_id,release_id)""")
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
   AND NOT ENDS_WITH(member,'::coverage') AND NOT ENDS_WITH(member,'::metadata')""")
  # Catalog staged metadata is authoritative for process status; receipt adds publication status.
  q=dump
  transaction_sql=f"""BEGIN TRANSACTION;
  ASSERT (SELECT COUNT(*) FROM `{D}.report_source_records` WHERE release_id={q(rid)})=0 AS 'release already committed';
  INSERT INTO `{D}.report_source_records` SELECT * REPLACE({q(rid)} AS release_id) FROM `{rt}`;
  INSERT INTO `{D}.report_source_catalog` SELECT * FROM `{ct}`;
  DELETE FROM `{D}.release_pointer` WHERE dataset_id={q(pointer)};
  INSERT INTO `{D}.release_pointer` VALUES ({q(pointer)},{q(rid)},CURRENT_TIMESTAMP());
  INSERT INTO `{D}.ingestion_runs` VALUES ({q(rid)},{q(a.loader_sha)},CURRENT_TIMESTAMP(),{q(receipt_uri)},{q(receipt_sha)},{q(dump({'source_records':total,'sources':len(catalog)}))});
  COMMIT TRANSACTION;"""
  def committed():
   rows=query(f"SELECT loader_git_sha,receipt_sha256 FROM `{D}.ingestion_runs` WHERE release_id={q(rid)}")
   if rows and (len(rows)!=1 or rows[0].loader_git_sha!=a.loader_sha or rows[0].receipt_sha256!=receipt_sha):raise ValueError("Conflicting committed receipt")
   return bool(rows)
  transaction_with_retry(lambda:query(transaction_sql),committed)
  upload(bucket,f'{prefix}/completed.json',receipt_bytes)
  for table in [rt,ct]:bq.delete_table(table)
  print(dump({'event':'published','receipt_uri':receipt_uri,'sha256':receipt_sha,'source_records':total}),flush=True)
if __name__=='__main__':main()
