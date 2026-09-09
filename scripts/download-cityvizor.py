#!/usr/bin/env python3
"""Snapshot every published CityVizor profile/year using public bulk exports.

Only visible profiles are requested. External profiles discover federation hosts.
No private/admin API, credentials, attachments or source-site writes are used.
"""
from __future__ import annotations
import argparse, csv, gzip, hashlib, io, json, os, shutil, threading, time, zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from requests import Session
from requests.exceptions import HTTPError
from urllib.parse import urlsplit, quote

ROOT = Path(__file__).resolve().parents[2]
MONEY_FIELDS = ('incomeAmount','budgetIncomeAmount','expenditureAmount','budgetExpenditureAmount')
PAGE_SORTS = {
    'contracts': 'id',
    'payments': 'year,paragraph,item,event,incomeAmount,expenditureAmount,counterpartyId,counterpartyName,description,pbo_payments.date',
}
USER_AGENT = 'PublicSpendingData-source-archiver/1.0 (+https://publicspendingdata.org)'

def now(): return datetime.now(timezone.utc).isoformat()
def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_name(path.name+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(path)
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def origin(url):
    p=urlsplit(url)
    if p.scheme!='https' or not p.hostname or p.username or p.password or p.port not in (None,443):
        raise ValueError('External instance must be a public HTTPS origin: '+url)
    # Follow only CityVizor-labelled links advertised by public profile directories.
    if 'cityvizor' not in p.hostname.lower(): raise ValueError('Unrecognized external CityVizor host: '+p.hostname)
    return 'https://'+p.hostname

def inspect_zip(path):
    result={}
    with zipfile.ZipFile(path) as z:
        names=z.namelist()
        if set(names)!={'accounting.csv','events.csv','payments.csv'} or len(names)!=3:
            raise ValueError('Unexpected bulk export members: '+str(names))
        for name in names:
            with z.open(name) as raw:
                reader=csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig',newline=''),delimiter=';')
                fields=reader.fieldnames or []
                count=0
                for row in reader:
                    if None in row: raise ValueError('CSV row wider than header: '+name)
                    count+=1
                if count and not {'year'}.issubset(fields):raise ValueError('Missing year: '+name)
                result[name]={'rows':count,'columns':fields,'uncompressed_bytes':z.getinfo(name).file_size}
    return result

class Snapshot:
    def __init__(self,path,refresh=False,delay=.08):
        self.path=path;self.refresh=refresh;self.delay=delay
        self.lock=threading.Lock();self.requests=0;self.reused=0
        self._transport=threading.local()
    def session(self):
        # requests sessions are not shared across worker threads. Each worker
        # reuses its own verified HTTPS connections across profile resources.
        if not hasattr(self._transport, "session"):
            self._transport.session=Session()
        return self._transport.session
    def fetch(self,url,relative,kind='json'):
        path=self.path/relative;meta=path.with_name(path.name+'.meta.json')
        if not self.refresh and path.exists() and meta.exists():
            m=json.loads(meta.read_text())
            if m.get('url')==url and m.get('sha256')==sha(path):
                with self.lock:self.reused+=1
                return m
        path.parent.mkdir(parents=True,exist_ok=True)
        if shutil.disk_usage(self.path).free < 1024**3: raise RuntimeError('Less than 1 GiB free; safely stopping download')
        error=None
        for attempt in range(5):
            tmp=path.with_name(path.name+'.part')
            try:
                time.sleep(self.delay)
                with self.session().get(url,headers={'User-Agent':USER_AGENT,'Accept':'application/zip' if kind=='zip' else 'application/json'},stream=True,timeout=120,verify=True) as response:
                    response.raise_for_status()
                    headers=response.headers;resolved=response.url
                    opener=tmp.open if kind=='zip' else lambda mode:gzip.open(tmp,mode)
                    with opener('wb') as out:
                        # iter_content decodes HTTP Content-Encoding (including gzip)
                        # while retaining streaming memory bounds. Cache compression
                        # is a separate layer and must never store HTTP gzip twice.
                        for block in response.iter_content(chunk_size=1024*1024):
                            if block:out.write(block)
                if kind=='zip':details={'members':inspect_zip(tmp)}
                else:
                    with gzip.open(tmp,'rt') as f:data=json.load(f)
                    details={'rows':len(data) if isinstance(data,list) else None,'json_type':type(data).__name__}
                    if not isinstance(data,(list,dict)):raise ValueError('Unexpected JSON response')
                tmp.replace(path)
                m={'url':url,'resolved_url':resolved,'retrieved_at':now(),'sha256':sha(path),'bytes':path.stat().st_size,
                   'content_type':headers.get('Content-Type'),'etag':headers.get('ETag'),'last_modified':headers.get('Last-Modified'),**details}
                dump(meta,m)
                with self.lock:self.requests+=1
                return m
            except Exception as e:
                error=e;tmp.unlink(missing_ok=True)
                if isinstance(e,HTTPError) and e.response is not None and e.response.status_code in (400,401,403,404):break
                time.sleep(min(2**attempt,16))
        raise RuntimeError(f'{url}: {error}')
    def data(self,url,relative):
        self.fetch(url,relative)
        with gzip.open(self.path/relative,'rt') as f:return json.load(f)
    def pages(self,base,rel,resource,limit):
        offset=0;total=0;previous=None;pages=[]
        while True:
            name=f'{rel}/{resource}/{offset:09d}.json.gz'
            sort=PAGE_SORTS.get(resource)
            query=f'?limit={limit}&offset={offset}'+('&sort='+quote(sort,safe='') if sort else '')
            data=self.data(f'{base}/{resource}'+query,name)
            if not isinstance(data,list):raise ValueError('Expected paginated list: '+resource)
            fingerprint=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
            if data and fingerprint==previous:raise ValueError('Repeated page; cannot establish completeness: '+resource)
            previous=fingerprint;pages.append({'path':name,'rows':len(data)});total+=len(data)
            # Servers have different limit caps. Continue until an empty page, not merely a short page.
            if not data:break
            offset+=len(data)
        return {'rows':total,'pages':pages,'terminal_empty_page':True,'sort':PAGE_SORTS.get(resource),'consistency':'Non-atomic offset pagination ordered by all native fields; indistinguishable duplicates retained.'}
    def profile(self,host,p):
        key=f'{urlsplit(host).hostname}/{p["id"]}';base=f'{host}/api/public/profiles/{p["id"]}'
        result={'key':key,'instance':host,'profile':p,'status':'complete','errors':[],'years':[]}
        def do(label,fn):
            try:return fn()
            except Exception as e:
                result['errors'].append({'resource':label,'error':str(e)});result['status']='partial';return None
        years=do('years',lambda:self.data(base+'/years',key+'/years.json.gz')) or []
        plans=do('plans',lambda:self.data(base+'/plans',key+'/plans-index.json.gz')) if p.get('type')=='pbo' else []
        months=do('payment-months',lambda:self.data(base+'/payments/months',key+'/payment-months.json.gz')) or []
        published={int(r['year']) for r in years if r.get('year') is not None}
        published.update(int(r['year']) for r in months if r.get('year') is not None)
        published.update(int(r['year']) for r in plans or [] if r.get('year') is not None)
        plan_years={int(r['year']) for r in plans or [] if r.get('year') is not None}
        for year in sorted(published):
            if not 1990<=year<=datetime.now().year+10:raise ValueError('Invalid published year')
            rel=f'{key}/{year}'
            item={'year':year,'source_validity':next((r.get('validity') for r in years if int(r['year'])==year),None)}
            m=do(f'bulk-{year}',lambda:self.fetch(f'{host}/api/exports/profiles/{p["id"]}/all/{year}',rel+'/all.zip','zip'))
            if m:item.update({'path':rel+'/all.zip','members':m['members'],'bytes':m['bytes'],'retrieved_at':m['retrieved_at'],'sha256':m['sha256']})
            if year in plan_years:
                rows=do(f'plans-{year}',lambda:self.data(base+f'/plans/{year}',rel+'/plans.json.gz'))
                if rows is not None:
                    item['plan_rows']=len(rows)
                    # Account labels are not included in the raw plans export; get each used two-digit group.
                    groups=sorted({str(r.get('sa',''))[:2] for r in rows if r.get('sa') is not None})
                    for group in groups:
                        do(f'plan-labels-{year}-{group}',lambda g=group:self.data(base+f'/plans/{year}/groups/{g}/details',rel+f'/plan-labels-{g}.json.gz'))
            result['years'].append(item)
        # Public PBO payments use a different classification view of the same underlying payment records. Preserve it in full.
        if p.get('type')=='pbo':result['pbo_payments']=do('pbo-payments',lambda:self.pages(base,key,'payments',10000))
        result['contracts']=do('contracts',lambda:self.pages(base,key,'contracts',100))
        notices=do('noticeboard',lambda:self.data(base+'/noticeboard',key+'/noticeboard.json.gz'))
        if notices is not None:result['noticeboard_rows']=len(notices)
        dump(self.path/key/'profile-completion.json',result)
        return result

def run(args):
    snapshot=Snapshot(args.output,refresh=args.refresh);args.output.mkdir(parents=True,exist_ok=True)
    pending=list(args.instances);hosts={};profiles=[];errors=[]
    while pending:
        host=origin(pending.pop(0))
        if host in hosts:continue
        rows=snapshot.data(host+'/api/public/profiles?status=visible',urlsplit(host).hostname+'/profiles.json.gz')
        if not isinstance(rows,list):raise ValueError('Expected visible profile array')
        if any(p.get('status')!='visible' for p in rows):raise ValueError('Source did not honor visible-only filter')
        if len({p['id'] for p in rows})!=len(rows):raise ValueError('Duplicate profile IDs')
        hosts[host]={'profiles':len(rows),'external_profiles':sum(p.get('type')=='external' for p in rows)}
        for p in rows:
            if p.get('type')=='external':
                try:pending.append(origin(p['url']))
                except ValueError as e:errors.append({'instance':host,'external_profile':p['id'],'error':str(e)})
            else:profiles.append((host,p))
        names=snapshot.data(host+'/api/public/codelists',urlsplit(host).hostname+'/codelists-index.json.gz')
        for name in names:
            try:snapshot.data(host+'/api/public/codelists/'+quote(str(name),safe=''),urlsplit(host).hostname+'/codelists/'+quote(str(name),safe='')+'.json.gz')
            except Exception as e:errors.append({'instance':host,'codelist':name,'error':str(e)})
    dump(args.output/'discovery.json',{'discovered_at':now(),'instances':hosts,'profile_count':len(profiles),'errors':errors})
    print(json.dumps({'event':'discovered','instances':hosts,'financial_profiles':len(profiles)}),flush=True)
    results=[]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures={pool.submit(snapshot.profile,h,p):(h,p) for h,p in profiles}
        for future in as_completed(futures):
            h,p=futures[future]
            try:r=future.result()
            except Exception as e:r={'key':f'{urlsplit(h).hostname}/{p["id"]}','instance':h,'profile':p,'status':'failed','years':[],'errors':[{'error':str(e)}]}
            results.append(r)
            print(json.dumps({'event':'profile','done':len(results),'total':len(profiles),'key':r['key'],'years':len(r['years']),'status':r['status'],'errors':r['errors'][:1]},ensure_ascii=False),flush=True)
    manifest={'schema_version':'1.0.0','dataset_id':'cityvizor-public-snapshot','completed_at':now(),'instances':hosts,
              'scope':'All visible profiles and advertised years on the national service and publicly linked CityVizor instances; public accounting/payments/events/plans, codebooks, contract and noticeboard metadata. No private profiles or linked attachment binaries.',
              'definitions':{'payment_row':'Source accounting allocation record, not necessarily a unique invoice or proof of an individual bank settlement. Identical rows and split allocations are preserved.',
                'financial_units':'CZK as supplied; original column names retained. PBO plans may be accrual accounts, not municipal budget cash.',
                'consolidation':'Profiles, accounting, plans and contract face values overlap; do not add their totals. Bulk payments and PBO API payments are two classification views of the same underlying records, not independent payments.',
                'snapshot':'Non-atomic acquisition across a changing source. Hashes and source-validity dates retained. Endpoint errors remain explicit.'},
              'profile_count':len(results),'profile_years':sum(len(r['years']) for r in results),'complete_profiles':sum(r['status']=='complete' for r in results),
              'errors':errors,'profiles':sorted(results,key=lambda r:r['key']),'requests':snapshot.requests,'reused_files':snapshot.reused}
    manifest['complete']=not errors and manifest['complete_profiles']==manifest['profile_count']
    dump(args.output/'manifest.json',manifest)
    print(json.dumps({k:v for k,v in manifest.items() if k not in ('profiles','definitions','scope')},ensure_ascii=False),flush=True)
    return 0 if manifest['complete'] else 2

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/source_cache/cityvizor/2026-09-09')
    parser.add_argument('--instances',nargs='+',default=['https://cityvizor.cz'])
    parser.add_argument('--workers',type=int,default=2,choices=range(1,17),help='Concurrent public profiles (default 2; bounded maximum 16)')
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args();return run(args)
if __name__=='__main__':raise SystemExit(main())
