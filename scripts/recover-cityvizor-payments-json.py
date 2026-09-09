#!/usr/bin/env python3
"""Recover malformed CityVizor payment CSVs through the public native JSON view.
Preserves original ZIPs; never treats payment totals as accounting control totals.
Qualified payments.date avoids upstream's accidental exclusion of null dates.
"""
import argparse,csv,gzip,hashlib,importlib.util,io,json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote,urlsplit
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('cityvizor_snapshot',Path(__file__).with_name('download-cityvizor.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
SORT='year,paragraph,item,unit,event,incomeAmount,expenditureAmount,counterpartyId,counterpartyName,description,payments.date'
MONEY=('incomeAmount','expenditureAmount')
def cents(value):
 value=Decimal(str(value or 0))*100
 if value!=value.to_integral_value():raise ValueError('Non-cent monetary amount: '+str(value))
 return int(value)
def run(args):
 output=args.snapshot/'json-payment-recovery';snapshot=module.Snapshot(output,refresh=args.refresh,delay=.15);results=[]
 for profile in args.profiles:
  host=module.origin(args.instance);key=f'{urlsplit(host).hostname}/{profile}';base=f'{host}/api/public/profiles/{profile}'
  years=snapshot.data(base+'/years',key+'/years.json.gz');published={int(r['year']) for r in years}
  directory=snapshot.data(host+'/api/public/profiles?status=visible',urlsplit(host).hostname+'/profiles.json.gz');info=next((p for p in directory if p['id']==profile),None)
  if not info or info['type']!='municipality':raise ValueError('Recovery requires a visible municipality profile')
  offset=0;pages=[];totals=defaultdict(lambda:{'rows':0,'income_cents':0,'expenditure_cents':0,'null_date_rows':0});prior=None
  while True:
   relative=f'{key}/payments/{offset:09}.json.gz';url=f'{base}/payments?limit=10000&offset={offset}&sort={quote(SORT,safe="")}'
   data=snapshot.data(url,relative)
   if not isinstance(data,list):raise ValueError('Expected payment array')
   digest=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
   if data and digest==prior:raise ValueError('Repeated page; pagination completeness unresolved')
   prior=digest;meta=json.loads((output/relative).with_name(Path(relative).name+'.meta.json').read_text());pages.append({'path':relative,'rows':len(data),'sha256':meta['sha256'],'url':url})
   for row in data:
    if int(row['profileId'])!=profile:raise ValueError('Profile mismatch')
    year=int(row['year']);t=totals[year];t['rows']+=1;t['income_cents']+=cents(row.get('incomeAmount'));t['expenditure_cents']+=cents(row.get('expenditureAmount'));t['null_date_rows']+=row.get('date') is None
   module.dump(output/key/'progress.json',{'offset':offset,'pages':len(pages),'rows':sum(v['rows'] for v in totals.values())})
   if not data:break
   offset+=len(data)
  annual=[]
  import zipfile
  for year in sorted(published|set(totals)):
   native=totals[year];zip_path=args.snapshot/key/str(year)/'all.zip';check={'status':'zip_not_yet_available'}
   if zip_path.exists():
    valid=0;malformed=[];csvtot={k:0 for k in MONEY}
    try:
     with zipfile.ZipFile(zip_path) as z:
      with z.open('payments.csv') as stream:
       for index,row in enumerate(csv.DictReader(io.TextIOWrapper(stream,encoding='utf-8-sig',newline=''),delimiter=';'),2):
        try:
         if None in row or int(row['profileId'])!=profile or int(row['year'])!=year:raise ValueError('Invalid record identity/width')
         values={k:cents(row[k]) for k in MONEY}
        except (ValueError,TypeError,KeyError,ArithmeticError):malformed.append(index);continue
        valid+=1
        for k in MONEY:csvtot[k]+=values[k]
     check={'status':'malformed_source_csv' if malformed else 'well_formed_source_csv','valid_csv_rows':valid,'malformed_csv_row_numbers':malformed,'json_minus_valid_csv_rows':native['rows']-valid,'income_difference_cents':native['income_cents']-csvtot['incomeAmount'],'expenditure_difference_cents':native['expenditure_cents']-csvtot['expenditureAmount'],'original_zip_sha256':module.sha(zip_path)}
    except (csv.Error,UnicodeDecodeError,zipfile.BadZipFile) as e:check={'status':'malformed_source_archive','error':str(e)}
   control=next((r for r in years if int(r['year'])==year),None)
   annual.append({'year':year,**native,'source_csv_comparison':check,'accounting_year_controls':control,'control_scope_note':'Accounting controls describe a different layer; payment sums are not expected to equal accounting or budget totals.'})
  result={'schema_version':'1.0.0','profile_key':key,'profile':info,'complete':True,'terminal_empty_page':True,'sort':SORT,'pages':pages,'years':annual,'rows':sum(v['rows'] for v in totals.values()),'definitions':{'source':'Public municipal payments JSON projection; source ZIP remains preserved even if malformed.','identity':'Source rows and identical/split allocations retained; no deduplication.','snapshot':'Non-atomic paginated acquisition; explicit all-field ordering and terminal empty page.','preferred_payment_representation':'Use native JSON recovery in place of ZIP payment CSV for this profile, never add both.'}}
  module.dump(output/key/'manifest.json',result);results.append(result);print(json.dumps({'profile':key,'rows':result['rows'],'pages':len(pages),'years':len(annual),'malformed_years':[x['year'] for x in annual if x['source_csv_comparison']['status']=='malformed_source_csv']}),flush=True)
 existing=json.loads((output/'manifest.json').read_text()).get('profiles',[]) if (output/'manifest.json').exists() else []
 index={r['key']:r for r in existing}
 for r in results:index[r['profile_key']]={'key':r['profile_key'],'rows':r['rows'],'manifest':r['profile_key']+'/manifest.json'}
 module.dump(output/'manifest.json',{'schema_version':'1.0.0','profiles':[index[k] for k in sorted(index)],'complete':True})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',type=Path,default=ROOT/'data/source_cache/cityvizor/2026-09-09');p.add_argument('--instance',default='https://cityvizor.cz');p.add_argument('--profiles',nargs='+',type=int,required=True);p.add_argument('--refresh',action='store_true');run(p.parse_args())
