"""Build a small monthly automotive serving snapshot from verified cloud archives.
Run only on Cloud Build. Does not crawl, modify the checkpoint, or load raw data locally.
"""
from __future__ import annotations
import argparse, collections, concurrent.futures, datetime, decimal, gzip, hashlib, json, os, sqlite3, subprocess, urllib.parse, urllib.request
from pathlib import Path
EU = set('AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE'.split())
REGIONS = ['USA','EU27','CHN','ROW']
LIGHT = {'870421','870431','870441','870451'}
HEAVY = {'870121','870122','870123','870124','870129','870422','870423','870432','870442','870443','870452'}
BUCKET = 'gs://czbudget-janrezab-un-comtrade-raw'
D = decimal.Decimal

def segment(code):
    if len(code)!=6:return None
    if code.startswith('8703') or code in LIGHT:return 'vehicles'
    if code in HEAVY:return 'trucks'
    if code.startswith('8708'):return 'parts'
    return None

def region(iso):return 'EU27' if iso in EU else iso if iso in {'USA','CHN'} else 'ROW'

def assemble(values, market, include_intra_eu=False):
    # World is a separate total, never added to bilateral observations.
    world = values.get('WORLD')
    if world is None:return None
    named = {r: values.get(r,D(0)) for r in REGIONS[:3]}
    residual = world - sum(named.values())
    if residual < -D('1'):raise ValueError(f'Named origins exceed World for {market}: {residual}')
    named['ROW'] = max(D(0),residual)
    if market in EU and not include_intra_eu:named['EU27']=D(0)
    return {k:float(v) for k,v in named.items()}

def country_routes(values, world):
    """Preserve every country origin; keep unallocated trade separate."""
    residual=world-sum(values.values())
    if residual < -D('1'):raise ValueError(f'Country origins exceed World: {residual}')
    routes={iso:float(value) for iso,value in values.items() if value>0}
    if residual>0:routes['UNALLOCATED']=float(residual)
    return routes

def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Cloud Build only: do not restore raw data on a workstation')
    token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True).strip()
    def get(uri, generation=None):
        bucket,key=uri[5:].split('/',1)
        url=f'https://storage.googleapis.com/storage/v1/b/{bucket}/o/{urllib.parse.quote(key,safe="")}?alt=media'
        if generation:url+='&generation='+str(generation)
        req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req,timeout=90) as r:return r.read()
            except Exception:
                if attempt==3:raise
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',default=BUCKET+'/manifests/latest.json');args=parser.parse_args()
    manifest=json.loads(get(args.manifest))
    checkpoint=manifest['checkpoint'];raw=get(checkpoint['uri'],checkpoint['generation'])
    assert hashlib.sha256(raw).hexdigest()==checkpoint['sha256']
    Path('/tmp/auto-crawl.sqlite3').write_bytes(raw);del raw
    c=sqlite3.connect('file:/tmp/auto-crawl.sqlite3?mode=ro',uri=True);c.row_factory=sqlite3.Row
    refs=json.loads(get(BUCKET+'/reference/partnerAreas.json'))['results']
    codes={r['PartnerCodeIsoAlpha3']:int(r['PartnerCode']) for r in refs if not r.get('isGroup') and not r.get('entryExpiredDate')}
    country_codes={code:iso for iso,code in codes.items() if iso and len(iso)==3 and iso not in {'W00','WLD','EUR','_X_'}}
    origin_names={r['PartnerCodeIsoAlpha3']:r['PartnerDesc'] for r in refs if r.get('PartnerCodeIsoAlpha3') in codes}
    required={codes[i] for i in EU|{'USA','CHN'}}
    tasks=[dict(r) for r in c.execute("SELECT * FROM tasks WHERE product_type='C' AND frequency='M' AND flow_code='M' AND classification_code='H6' AND status!='split'")]
    groups=collections.defaultdict(list)
    for t in tasks:
        if t['reporter_iso3'] in {'EUR',None}:continue
        groups[t['period'],t['reporter_iso3']].append(t)
    eligible={}
    for key,ts in groups.items():
        partners=set(p for t in ts for p in json.loads(t['partner_codes']))
        needed=required-{codes.get(key[1])}
        if 0 in partners and needed<=partners and all(t['status'] in {'completed','no_data'} for t in ts) and sum(t['record_count'] or 0 for t in ts)>0:
            eligible[key]=ts
    coverage=collections.Counter(p for p,m in eligible)
    print('eligible markets by month',dict(sorted(coverage.items())),flush=True)
    viable=[p for p,n in coverage.items() if n>=20]
    if not viable:raise RuntimeError('No month has at least 20 complete markets with all named origins covered')
    latest=max(viable);periods=sorted(p for p in coverage if p<=latest)[-18:]
    panel=sorted(set.intersection(*[{m for p,m in eligible if p==period} for period in periods]))
    if len(panel)<20:raise RuntimeError(f'Fixed panel has only {len(panel)} markets')
    # Extract fixed-panel markets only; equal geographical coverage in every chart month.
    selected=[t for (p,m),ts in eligible.items() if p in periods and m in panel for t in ts if t['status']=='completed']
    print('fixed panel',panel,'periods',periods,'objects',len(selected),flush=True)
    def read_task(t):
        key=t['raw_path'].split('/raw/',1)[1]
        raw=get(BUCKET+'/raw/'+key)
        assert hashlib.sha256(raw).hexdigest()==t['response_sha256'],t['task_id']
        payload=json.loads(gzip.decompress(raw));rows=payload['data']
        assert len(rows)==t['record_count'] and len(rows)<100000
        result={};countries={};seen=set()
        for r in rows:
            code=str(r.get('cmdCode',''));seg=segment(code)
            if seg is None or r.get('aggrLevel')!=6:continue
            if r.get('flowCode')!='M' or str(r.get('period'))!=t['period'] or int(r['reporterCode'])!=t['reporter_code']:raise ValueError('Raw dimensions do not match checkpoint')
            if r.get('partner2Code',0)!=0 or r.get('motCode',0)!=0 or r.get('customsCode','C00')!='C00':continue
            partner=int(r['partnerCode']);key=(code,partner)
            if key in seen:raise ValueError('Duplicate HS6/partner in archive response')
            seen.add(key)
            value=D(str(r['primaryValue']))
            if value<0:raise ValueError('Negative source trade value')
            if partner==0 or partner in required:
                reg='WORLD' if partner==0 else region(country_codes[partner])
                result[seg,reg]=result.get((seg,reg),D(0))+value
            if partner in country_codes and partner!=0:
                iso=country_codes[partner]
                countries[seg,iso]=countries.get((seg,iso),D(0))+value
        return t,result,countries,payload.get('_psd_task',{}).get('retrieved_at')
    totals=collections.defaultdict(lambda:collections.defaultdict(D));bilateral=collections.defaultdict(lambda:collections.defaultdict(D));retrieved=[];receipts=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for i,(task,values,countries,stamp) in enumerate(pool.map(read_task,selected),1):
            for (seg,reg),value in values.items():totals[task['period'],task['reporter_iso3'],seg][reg]+=value
            for (seg,iso),value in countries.items():bilateral[task['period'],task['reporter_iso3'],seg][iso]+=value
            if stamp:retrieved.append(stamp)
            receipts.append({'task':task['task_id'],'sha256':task['response_sha256']})
            if i%100==0:print('verified',i,'/',len(selected),flush=True)
    output=[]
    for period in periods:
        for market in panel:
            for seg in ['vehicles','trucks','parts']:
                values=assemble(totals[period,market,seg],market)
                values_all=assemble(totals[period,market,seg],market,include_intra_eu=True)
                # No published World product row stays missing, not a fabricated zero.
                if values is not None:output.append({'period':period,'market':market,'segment':seg,'values':values,'values_all':values_all})
    present={(r['period'],r['market'],r['segment']) for r in output}
    missing=[(p,m,s) for p in periods for m in panel for s in ['vehicles','trucks','parts'] if (p,m,s) not in present]
    excluded={m for p,m,s in missing}
    panel=[m for m in panel if m not in excluded]
    if len(panel)<20:raise RuntimeError('Fewer than 20 markets with all three product groups in every month')
    output=[r for r in output if r['market'] in panel]
    routes=[]
    for row in output:
        key=row['period'],row['market'],row['segment']
        for origin,value in country_routes(bilateral[key],totals[key]['WORLD']).items():
            routes.append({'period':row['period'],'market':row['market'],'segment':row['segment'],'origin':origin,'value':value})
    print('Excluded markets with unpublished product groups:',missing,flush=True)
    names={r['reporter_iso3']:r['reporter_name'] for r in c.execute('SELECT reporter_iso3,reporter_name FROM availability')}
    dataset={'schema_version':'automotive-monthly.v1','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'periods':periods,'panel':panel,'eu27':sorted(EU),'markets':[{'code':m,'name':names.get(m,m)} for m in panel],'rows':output,'source':{'name':'UN Comtrade','url':'https://comtradeplus.un.org/','table':'UN Comtrade C/M/HS (H6), AG6, M; verified archived responses','archive_id':manifest['archive_id'],'checkpoint_sha256':checkpoint['sha256'],'retrieved_at':max(retrieved),'objects_verified':len(receipts),'excluded_markets_missing_products':sorted(excluded),'method':'Importer-reported origins; fixed market panel; comparable view removes intra-EU27 trade; all-cross-border view retains it. ROW = World minus USA, EU27 and China, including unspecified origins. Current USD, generally CIF.'},'definitions':{'vehicles':{'hs4':['8703'],'hs6':sorted(LIGHT)},'trucks':{'hs6':sorted(HEAVY)},'parts':{'hs4':['8708']}}}
    dataset['routes']=routes
    dataset['origins']=[{'code':iso,'name':origin_names.get(iso,iso) if iso!='UNALLOCATED' else 'Unallocated origin','region':region(iso)} for iso in sorted({r['origin'] for r in routes})]
    Path('automotive-monthly.v1.json').write_text(json.dumps(dataset,separators=(',',':'))+'\n')
    Path('receipts.json').write_text(json.dumps({'checkpoint':checkpoint,'raw':receipts},separators=(',',':'))+'\n')
    print('RESULT',len(output),'rows',len(panel),'markets',periods,flush=True)
if __name__=='__main__':main()
