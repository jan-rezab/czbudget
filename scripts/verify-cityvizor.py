#!/usr/bin/env python3
"""Verify archived bytes, row identity and independent CityVizor accounting controls."""
import argparse,csv,gzip,hashlib,io,json,zipfile
from collections import Counter
from datetime import datetime,timezone
from decimal import Decimal,InvalidOperation
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FIELDS=('incomeAmount','expenditureAmount','budgetIncomeAmount','budgetExpenditureAmount')
def read(p):
 with gzip.open(p,'rt') as f:return json.load(f,parse_float=Decimal)
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def accounting(path,profile,year,recovered_rows=()):
 sums={k:Decimal(0) for k in FIELDS};known=Counter();counts=Counter()
 with zipfile.ZipFile(path) as z:
  if set(z.namelist())!={'accounting.csv','events.csv','payments.csv'}:raise ValueError('Unexpected ZIP members')
  for name in z.namelist():
   with z.open(name) as raw:
    for n,row in enumerate(csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig',newline=''),delimiter=';'),1):
     counts[name]+=1
     invalid=None in row or ('profileId' in row and row['profileId']!=str(profile)) or row.get('year')!=str(year)
     if invalid:
      if name=='payments.csv' and n+1 in recovered_rows:continue
      raise ValueError(f'Row identity mismatch {name}:{n}')
     if name=='accounting.csv':
      for k in FIELDS:
       if row.get(k) not in (None,''):
        v=Decimal(row[k])
        if not v.is_finite():raise ValueError('Non-finite monetary value')
        sums[k]+=v;known[k]+=1
 return {k:sums[k] if known[k] else None for k in FIELDS},counts

def recovery(snapshot,key):
 base=snapshot/'json-payment-recovery';path=base/key/'manifest.json'
 if not path.exists():return {}
 m=json.loads(path.read_text())
 if not m.get('complete') or not m.get('terminal_empty_page'):raise ValueError('Incomplete payment recovery')
 counts=Counter();sums={}
 for page in m['pages']:
  file=base/page['path']
  if digest(file)!=page['sha256']:raise ValueError('Recovery checksum mismatch')
  rows=read(file)
  if len(rows)!=page['rows']:raise ValueError('Recovery page count mismatch')
  for row in rows:
   if str(row.get('profileId'))!=key.split('/')[-1]:raise ValueError('Recovery profile mismatch')
   year=int(row['year']);counts[year]+=1;sums.setdefault(year,[Decimal(0),Decimal(0)])
   for i,k in enumerate(('incomeAmount','expenditureAmount')):
    if row.get(k) is None:raise ValueError('Missing recovery monetary value')
    sums[year][i]+=Decimal(str(row[k]))*100
 result={}
 for y in m['years']:
  year=y['year'];c=y['source_csv_comparison']
  if counts[year]!=y['rows'] or sums.get(year,[0,0])!=[y['income_cents'],y['expenditure_cents']]:raise ValueError('Recovery yearly control mismatch')
  if any(c[k]!=0 for k in ('json_minus_valid_csv_rows','income_difference_cents','expenditure_difference_cents')):raise ValueError('Payment recovery differs from valid source rows')
  if c['original_zip_sha256']!=digest(snapshot/key/str(year)/'all.zip'):raise ValueError('Recovery source ZIP changed')
  result[year]=y
 return result

def pbo_payment_controls(key,api_counts,bulk_counts):
 """Compare row coverage only: municipal and PBO money classifications differ."""
 controls=[]
 for year in sorted(set(api_counts)|set(bulk_counts),key=str):
  expected=bulk_counts.get(year)
  actual=api_counts.get(year,0)
  controls.append({'key':key,'year':year,'field':'pbo_payment_rows','api_rows':actual,'valid_bulk_rows':expected,'published_bulk_year':year in bulk_counts,'difference_rows':actual-expected if expected is not None else None,'matched':expected is not None and actual==expected,'definition':'Alternate payment views; count differences may reflect source changes or view filters and are disclosed, not treated as byte-integrity failures.'})
 return controls

def verify(snapshot,partial=False):
 manifest_path=snapshot/'manifest.json'
 manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else None
 if not partial and (not manifest or not manifest.get('complete')):raise ValueError('Full download manifest is not complete')
 profiles=[json.loads(p.read_text()) for p in snapshot.glob('*/*/profile-completion.json')] if partial else manifest['profiles']
 errors=[];exceptions=[];checks=[];files=0;records=Counter();recovered=[];seen_files=set()
 for p in profiles:
  key=p['key'];folder=snapshot/key
  try:recovered_years=recovery(snapshot,key)
  except Exception as e:errors.append({'key':key,'error':str(e)});recovered_years={}
  for y in recovered_years.values():
   if y['source_csv_comparison']['malformed_csv_row_numbers']:recovered.append({'key':key,'year':y['year'],'preferred_payment_rows':y['rows'],'source_csv_comparison':y['source_csv_comparison']})
  for meta in folder.rglob('*.meta.json'):
   path=meta.with_name(meta.name.removesuffix('.meta.json'));m=json.loads(meta.read_text())
   if not path.exists() or digest(path)!=m['sha256']:errors.append({'path':str(path.relative_to(snapshot)),'error':'checksum mismatch'})
   files+=1;seen_files.add(meta)
  pbo_counts=Counter();bulk_payment_counts={}
  for label in ('contracts','pbo_payments'):
   page_set=p.get(label)
   if page_set is None:continue
   if not page_set.get('sort') or not page_set.get('terminal_empty_page'):errors.append({'key':key,'resource':label,'error':'Deterministic pagination not verified'})
   total=0;previous_id=None
   for page in page_set.get('pages',[]):
    rows=read(snapshot/page['path']);total+=len(rows)
    if len(rows)!=page['rows']:errors.append({'key':key,'resource':label,'error':'Page row count mismatch'})
    for row in rows:
     if label=='pbo_payments':pbo_counts[str(row.get('year'))]+=1
     if str(row.get('profileId'))!=str(p['profile']['id']):errors.append({'key':key,'resource':label,'error':'Page profile mismatch'})
     if label=='contracts':
      identifier=row.get('id')
      if identifier is None or (previous_id is not None and int(identifier)<=previous_id):errors.append({'key':key,'resource':label,'error':'Contract IDs not strictly increasing'})
      if identifier is not None:previous_id=int(identifier)
   if total!=page_set['rows'] or (page_set.get('pages') and page_set['pages'][-1]['rows']!=0):errors.append({'key':key,'resource':label,'error':'Incomplete pagination controls'})
  years={int(r['year']):r for r in read(folder/'years.json.gz')}
  for y in p['years']:
   if not y.get('path'):errors.append({'key':key,'year':y['year'],'error':'missing bulk export'});continue
   try:
    sums,counts=accounting(snapshot/y['path'],p['profile']['id'],y['year'],recovered_years.get(y['year'],{}).get('source_csv_comparison',{}).get('malformed_csv_row_numbers',[]));records.update(counts)
    bulk_payment_counts[str(y['year'])]=recovered_years.get(y['year'],{}).get('rows',counts['payments.csv'])
    for name,details in y['members'].items():
     if counts[name]!=details['rows']:raise ValueError('Manifest row count mismatch '+name)
    for field in FIELDS:
     value=years.get(y['year'],{}).get(field);expected=Decimal(str(value)) if value is not None else None;actual=sums[field]
     delta=actual-expected if actual is not None and expected is not None else None
     check={'key':key,'year':y['year'],'field':field,'csv_sum':str(actual) if actual is not None else None,'api_sum':str(expected) if expected is not None else None,'difference_czk':str(delta) if delta is not None else None,'matched':(actual is None and expected is None) or (delta is not None and abs(delta)<=Decimal('.01'))}
     checks.append(check)
     if not check['matched']:exceptions.append(check)
   except Exception as e:errors.append({'key':key,'year':y['year'],'error':str(e)})
  if p.get('pbo_payments') is not None:
   for check in pbo_payment_controls(key,pbo_counts,bulk_payment_counts):
    checks.append(check)
    if not check['matched']:exceptions.append(check)
  plan_index=folder/'plans-index.json.gz'
  if plan_index.exists():
   for control in read(plan_index):
    year=control['year'];path=folder/str(year)/'plans.json.gz'
    if not path.exists():errors.append({'key':key,'year':year,'error':'Missing plans'});continue
    rows=read(path)
    for row in rows:
     if str(row.get('profileId'))!=str(p['profile']['id']) or str(row.get('year'))!=str(year):errors.append({'key':key,'year':year,'error':'Plan identity mismatch'})
    for field in FIELDS:
     values=[Decimal(str(r[field])) for r in rows if r.get(field) is not None];actual=sum(values,Decimal(0)) if values else None;expected=Decimal(str(control[field])) if control.get(field) is not None else None
     delta=actual-expected if actual is not None and expected is not None else None
     check={'key':key,'year':year,'field':'plan_'+field,'csv_sum':str(actual) if actual is not None else None,'api_sum':str(expected) if expected is not None else None,'difference_czk':str(delta) if delta is not None else None,'matched':(actual is None and expected is None) or (delta is not None and abs(delta)<=Decimal('.01'))};checks.append(check)
     if not check['matched']:exceptions.append(check)
  print(json.dumps({'verified':key,'profiles_so_far':len({c['key'] for c in checks}),'errors':len(errors),'source_control_exceptions':len(exceptions)}),flush=True)
 if not partial:
  for meta in snapshot.rglob('*.meta.json'):
   if meta in seen_files:continue
   path=meta.with_name(meta.name.removesuffix('.meta.json'));m=json.loads(meta.read_text())
   if not path.exists() or digest(path)!=m['sha256']:errors.append({'path':str(path.relative_to(snapshot)),'error':'checksum mismatch'})
   files+=1
 result={'verified_at':datetime.now(timezone.utc).isoformat(),'partial_run':partial,'profiles':len(profiles),'verified_profile_files':files,'record_counts':dict(records),'recovered_source_csv_anomalies':recovered,'byte_and_row_integrity':not errors,'errors':errors,'control_count':len(checks),'source_control_exceptions':exceptions,'controls':checks,'definition':'PBO payment annual row coverage compared between alternate views; differences disclosed separately from byte integrity. Complete-scope accounting and PBO plan sums compared with separately retrieved API controls, tolerance CZK0.01. A source mismatch is retained, not silently corrected; API and ZIP snapshots are non-atomic.'}
 out=snapshot/('verification-partial.json' if partial else 'verification.json');out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k not in ('controls','errors','source_control_exceptions')},ensure_ascii=False))
 return 0 if not errors else 2
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',type=Path,default=ROOT/'data/source_cache/cityvizor/2026-09-09');p.add_argument('--partial',action='store_true');a=p.parse_args();raise SystemExit(verify(a.snapshot,a.partial))
