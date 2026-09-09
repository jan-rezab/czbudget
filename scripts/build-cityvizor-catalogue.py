#!/usr/bin/env python3
"""Publish a compact catalogue of a verified local CityVizor snapshot."""
import argparse,gzip,json,hashlib,re
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def build(snapshot,out):
 m=json.loads((snapshot/'manifest.json').read_text())
 if not m.get('complete'):raise ValueError('Cannot publish a complete catalogue from an incomplete snapshot')
 verification=json.loads((snapshot/'verification.json').read_text())
 if verification.get('partial_run') or not verification.get('byte_and_row_integrity') or verification['profiles']!=m['profile_count']:raise ValueError('Snapshot verification is incomplete')
 rows=[];icos=defaultdict(list);counts=Counter();retrievals=[]
 for p in m['profiles']:
  native=p['profile'];years=[]
  for y in p['years']:
   if 'path' not in y:raise ValueError('Missing year export')
   path=snapshot/y['path']
   if not path.is_file():raise ValueError('Missing local export: '+str(path))
   if digest(path)!=y['sha256']:raise ValueError('Archived bytes changed: '+str(path))
   count={name.removesuffix('.csv'):v['rows'] for name,v in y['members'].items()}
   recovered=next((r for r in verification.get('recovered_source_csv_anomalies',[]) if r['key']==p['key'] and r['year']==y['year']),None)
   raw_count=dict(count)
   if recovered:count['payments']=recovered['preferred_payment_rows']
   counts.update(count);retrievals.append(y['retrieved_at'])
   years.append({'year':y['year'],'records':count,'raw_csv_rows':raw_count,'json_payment_recovery':recovered,'plan_rows':y.get('plan_rows',0),'source_validity':y.get('source_validity'),'retrieved_at':y['retrieved_at'],'sha256':y['sha256'],'bytes':y['bytes'],'bulk_export_url':f'{p["instance"]}/api/exports/profiles/{native["id"]}/all/{y["year"]}'})
  count_pbo=(p.get('pbo_payments') or {}).get('rows',0)
  counts['pbo_payments']+=count_pbo;counts['contracts']+=(p.get('contracts') or {}).get('rows',0);counts['noticeboard']+=p.get('noticeboard_rows',0);counts['plan_rows']+=sum(y['plan_rows'] for y in years)
  raw_ico=native.get('ico');ico=raw_ico.strip() if isinstance(raw_ico,str) else None
  if ico is not None and not re.fullmatch(r'[0-9]{8}',ico):ico=None
  row={'key':p['key'],'id':native['id'],'name':native['name'],'ico':ico,'raw_ico':raw_ico,'type':native['type'],'parent_profile_key':f'{p["instance"].removeprefix("https://")}/{native["parent"]}' if native.get('parent') is not None else None,'instance':p['instance'],'profile_url':p['instance']+'/'+str(native['url']),'years':years,'pbo_payment_rows':count_pbo,'contract_rows':(p.get('contracts') or {}).get('rows',0),'noticeboard_rows':p.get('noticeboard_rows',0),'archived':True}
  rows.append(row)
  if row['ico']:icos[row['ico']].append(row['key'])
 duplicates={ico:keys for ico,keys in icos.items() if len(keys)>1}
 preferred=[r['pbo_payment_rows'] if r['type']=='pbo' else sum(y['records']['payments'] for y in r['years']) for r in rows]
 payload={'schema_version':'1.0.0','country_code':'CZE','generated_at':datetime.now(timezone.utc).isoformat(),'snapshot_completed_at':m['completed_at'],'retrieved_from':min(retrievals) if retrievals else None,'retrieved_to':max(retrievals) if retrievals else None,'complete':True,'verification':{'verified_at':verification['verified_at'],'control_count':verification['control_count'],'source_control_exceptions':verification['source_control_exceptions'],'recovered_source_csv_anomalies':verification.get('recovered_source_csv_anomalies',[])},'scope':m['scope'],'definitions':m['definitions'],'download_policy':'Original compressed responses archived locally with per-file SHA256 and retrieval metadata. Website links point to live source exports, which may change after the archived snapshot. Linked attachment binaries are not included.','profile_count':len(rows),'profile_years':m['profile_years'],'profile_types':dict(Counter(r['type'] for r in rows)),'record_counts':dict(counts),'duplicate_ico_profiles':duplicates,'profiles':rows}
 payload['preferred_payment_view_rows']=sum(preferred)
 payload['profiles_with_payment_rows']=sum(n>0 for n in preferred)
 payload['payment_count_definition']='One native view per profile: PBO API payments for PBO profiles, bulk payments otherwise. This avoids adding alternate views but does not deduplicate invoices or consolidate profiles.'
 out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps({k:payload[k] for k in ['profile_count','profile_years','profile_types','record_counts']}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',type=Path,default=ROOT/'data/source_cache/cityvizor/2026-09-09');p.add_argument('--output',type=Path,default=ROOT/'website/data/cityvizor-catalogue.v1.json');a=p.parse_args();build(a.snapshot,a.output)
