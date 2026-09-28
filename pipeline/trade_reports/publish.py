"""Cloud-only, bounded report extraction -> immutable raw -> staging -> verified CAS publication."""
import argparse,concurrent.futures,gzip,hashlib,json,os,re,sys,time,urllib.error,urllib.parse
from collections import defaultdict
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from pipeline.russia_suppliers.cloud_clients import Rest,ScalarQueryParameter
from pipeline.trade_reports.queries import bulk,pinned,SQL,SOURCE,PRODUCTS,EXPORTERS,VIAS,HS6
PROJECT='czbudget-janrezab';PRIVATE='czbudget-janrezab-data-layers';SERVING='czbudget-janrezab-public-snapshots'
PREFIX='static-assets/trade-reports/';GIB=1024**3;MIB=1024**2
PIN='2026-09-28T10:37:44.312451+00:00'

def body(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def sha(x):return hashlib.sha256(x).hexdigest()
def key(parts):return sha(json.dumps(parts,separators=(',',':')).encode())
def normal(row):
    # BQ ANY_VALUE names and STRING_AGG order are unspecified; compare all reported
    # values, identities, source IDs, timestamps and counts, ignoring only labels.
    r={k:v for k,v in row.items() if not k.endswith('_name') and not k.startswith('_')}
    for k,v in list(r.items()):
        if isinstance(v,str) and k in ['classifications','release_ids','source_hashes']:r[k]='|'.join(sorted(v.split('|')))
        if isinstance(v,list):r[k]=sorted(v,key=lambda x:json.dumps(x,sort_keys=True))
    return body(r)
def equivalent(a,b):return sorted(map(normal,a))==sorted(map(normal,b))
def numeric(rows):
    for row in rows:
        for k,v in row.items():
            if (k.endswith('_usd') or k.endswith('_kg')) and v is not None and not Decimal(str(v)).is_finite():raise ValueError('Nonfinite '+k)
            if k=='frequency' and v not in ['A','M']:raise ValueError('Unexpected grain')

def partition(family,rows):
    groups=defaultdict(list)
    for row in rows:
        r=dict(row)
        if family=='profile':parts=['profile',r.pop('_reporter')]
        elif family=='product-partners':parts=['product-partners',r.pop('_reporter'),r.pop('_chapter')]
        elif family=='energy':parts=['energy',r.pop('_product'),r['frequency'],r['period']]
        elif family=='russia-bilateral':parts=['russia-bilateral',r['reporter_iso3']]
        elif family=='russia-routes':continue
        elif family=='russia-aggregate':continue
        else:parts=[family]
        groups[tuple(parts)].append(r)
    if family=='russia-aggregate':
        for frequency in ['A','M']:
            selected=[{k:v for k,v in r.items() if k!='_frequency'} for r in rows if r['_frequency']==frequency]
            base=[r for r in selected if (int(r['partner_area_code'])==0 or (r['flow_code']=='X' and r['partner_iso3']=='RUS')) and len(r['product_code'])!=6]
            for product in PRODUCTS:
                extra=[r for r in selected if r['product_code']==product and not ((int(r['partner_area_code'])==0 or (r['flow_code']=='X' and r['partner_iso3']=='RUS')) and len(r['product_code'])!=6)]
                groups[('russia-aggregate',frequency,product)]=sorted(base+extra,key=lambda r:(r['period'],r['reporter_iso3'],r['flow_code'],int(r['partner_area_code']),r['product_code']))
    if family=='russia-routes':
        for exporter in EXPORTERS:
            for via in VIAS:
                if exporter==via:continue
                for product in HS6:
                    selected=[{k:v for k,v in r.items() if k!='_product'} for r in rows if r['_product']==product and ((r['reporter_iso3']==exporter and r['partner_iso3'] in ['RUS',via]) or (r['reporter_iso3']==via and r['partner_iso3']=='RUS'))]
                    groups[('russia-routes',exporter,via,product)]=sorted(selected,key=lambda r:(r['period'],r['reporter_iso3'],r['partner_iso3']))
    if not groups and family in ['countries','areas','energy-periods','explorer']:groups[(family,)]=[]
    return groups

class Objects:
    def __init__(self,api):self.api=api
    def root(self,bucket,name):return 'https://storage.googleapis.com/storage/v1/b/'+bucket+'/o/'+urllib.parse.quote(name,safe='')
    def meta(self,bucket,name):
        try:return self.api.request(self.root(bucket,name))
        except urllib.error.HTTPError as e:
            if e.code==404:return None
            raise
    def read(self,bucket,name,generation=None):
        return self.api.request(self.root(bucket,name)+'?'+urllib.parse.urlencode({'alt':'media',**({'generation':generation} if generation else {})}),raw=True)
    def write(self,bucket,name,data,generation=0,content_type='application/json'):
        url='https://storage.googleapis.com/upload/storage/v1/b/'+bucket+'/o?'+urllib.parse.urlencode({'uploadType':'media','name':name,'ifGenerationMatch':generation})
        try:m=self.api.request(url,data,content_type=content_type)
        except urllib.error.HTTPError as e:
            if e.code!=412 or generation!=0:raise
            m=self.meta(bucket,name)
        actual=self.read(bucket,name,m['generation'])
        if actual!=data:raise ValueError('Immutable readback mismatch: '+name)
        return {'object':name,'generation':m['generation'],'sha256':sha(data),'bytes':len(data)}
    def verified(self,bucket,ref):
        data=self.read(bucket,ref['object'],ref['generation'])
        if len(data)!=ref['bytes'] or sha(data)!=ref['sha256']:raise ValueError('Pinned input hash mismatch')
        return json.loads(data)

class Queries:
    def __init__(self,api,objects,run,sha_id,raw_run=None):
        self.api=api;self.objects=objects;self.run=run;self.raw_run=raw_run or run;self.sha_id=sha_id;self.admitted=0;self.billed=0;self.receipts=[]
        self.root='https://bigquery.googleapis.com/bigquery/v2/projects/'+PROJECT
    def params(self,sql,extra):
        values={'snapshot_at':('TIMESTAMP',PIN),'min_date':('DATE','2019-01-01' if 'COUNT(DISTINCT observation.reporter_iso3)' in sql else '2000-01-01')}
        values.update(extra)
        return [ScalarQueryParameter(n,*values[n]).api() for n in sorted(set(re.findall(r'@(\w+)',sql)))]
    def extract(self,name,sql,extra=None):
        extra=extra or {};params=self.params(sql,extra);signature=sha(body({'sql':sql,'params':params}));prefix='processing-runs/trade-reports/'+self.raw_run+'/raw/'+name
        checkpoint=self.objects.meta(PRIVATE,prefix+'.json')
        if checkpoint:
            receipt=json.loads(self.objects.read(PRIVATE,prefix+'.json',checkpoint['generation']))
            if receipt['signature']!=signature or receipt['snapshot_at']!=PIN:raise ValueError('Raw checkpoint differs')
            self.admitted+=receipt['estimated_bytes'];self.billed+=receipt['billed_bytes'];self.receipts.append(receipt)
            packed=self.objects.read(PRIVATE,receipt['object'],receipt['generation'])
            if sha(packed)!=receipt['sha256']:raise ValueError('Raw hash mismatch')
            decoded=gzip.decompress(packed)
            if len(decoded)>768*MIB:raise ValueError('Decoded raw bound exceeded')
            rows=json.loads(decoded)
            if len(rows)!=receipt['received_rows']:raise ValueError('Raw count mismatch')
            return rows
        labels={'plane':'data','purpose':'trade-reports','dataset':'comtrade','run_id':self.raw_run,'loader_sha':self.sha_id}
        query={'query':sql,'useLegacySql':False,'parameterMode':'NAMED','queryParameters':params}
        dry=self.api.request(self.root+'/jobs',{'configuration':{'dryRun':True,'query':dict(query,useQueryCache=False),'labels':labels}})
        estimated=int(dry['statistics']['query']['totalBytesProcessed'])
        if estimated>512*GIB or self.admitted+estimated>2*1024*GIB:raise ValueError('Report scan budget rejected before query')
        self.admitted+=estimated
        job_id='trade_report_'+self.raw_run.replace('-','_')+'_'+name.replace('-','_')
        config={'query':dict(query,maximumBytesBilled=str(min(512*GIB,2*1024*GIB-self.admitted+estimated))),'labels':labels}
        try:job=self.api.request(self.root+'/jobs',{'jobReference':{'projectId':PROJECT,'location':'EU','jobId':job_id},'configuration':config})
        except urllib.error.HTTPError as e:
            if e.code!=409:raise
            job=self.api.request(self.root+'/jobs/'+job_id+'?location=EU')
            if job['configuration']['query'].get('query')!=sql or job['configuration']['query'].get('queryParameters')!=params:raise ValueError('Retry job differs')
        for _ in range(450):
            job=self.api.request(self.root+'/jobs/'+job_id+'?location=EU')
            if job['status']['state']=='DONE':break
            time.sleep(2)
        else:raise RuntimeError('Query still running; reuse this exact raw-run and job ID')
        if job['status'].get('errorResult'):raise RuntimeError(json.dumps(job['status']['errorResult']))
        rows=[];page_token=None;total=None
        for _ in range(200):
            url=self.root+'/queries/'+job_id+'?'+urllib.parse.urlencode({'location':'EU','maxResults':10000,**({'pageToken':page_token} if page_token else {})})
            page=self.api.request(url);total=int(page['totalRows'])
            if total>2000000:raise ValueError('Aggregate result exceeds row bound')
            fields=page.get('schema',{}).get('fields',[])
            for item in page.get('rows',[]):
                row={}
                for f,v in zip(fields,item['f']):
                    value=v['v']
                    if value is not None and f['type']=='TIMESTAMP':value=datetime.fromtimestamp(float(Decimal(value)),timezone.utc).isoformat()
                    row[f['name']]=value
                rows.append(row)
            page_token=page.get('pageToken')
            if not page_token:break
        else:raise ValueError('Pagination bound exceeded; no publication')
        if len(rows)!=total:raise ValueError('Aggregate row count mismatch')
        numeric(rows);data=body(rows)
        if len(data)>768*MIB:raise ValueError('Decoded raw size exceeds bound')
        packed=gzip.compress(data,mtime=0)
        if len(packed)>32*MIB:raise ValueError('Packed raw size exceeds bound')
        ref=self.objects.write(PRIVATE,prefix+'.json.gz',packed,content_type='application/gzip');billed=int(job['statistics']['query'].get('totalBytesBilled',0));self.billed+=billed
        receipt=dict(ref,family=name,signature=signature,snapshot_at=PIN,source_sql_sha256=sha(sql.encode()),loader_sha=self.sha_id,source_web_sha=SOURCE['web_sha'],job_id=job_id,estimated_bytes=estimated,billed_bytes=billed,received_rows=len(rows),accepted_rows=len(rows),rejected_rows=0,deduplicated_rows=0,count_grain='aggregate query output rows, not source leaf observations')
        self.objects.write(PRIVATE,prefix+'.json',body(receipt));self.receipts.append(receipt)
        print(json.dumps({'event':'report_extract','family':name,'rows':len(rows),'billed_bytes':billed}),flush=True)
        return rows

SPOTS={
 'profile':[('CZE',{'reporter_iso3':('STRING','CZE'),'min_date':('DATE','2000-01-01')})],
 'product-partners':[('CZE','27',{'reporter_iso3':('STRING','CZE'),'product_code':('STRING','27'),'min_date':('DATE','2000-01-01')})],
 'russia-aggregate':[('A','TOTAL',{'frequency':('STRING','A'),'product':('STRING','TOTAL')}),('M','854231',{'frequency':('STRING','M'),'product':('STRING','854231')})],
 'russia-bilateral':[('CHN',{'country':('STRING','CHN')})],
 'russia-routes':[('DEU','KAZ','854231',{'exporter':('STRING','DEU'),'via':('STRING','KAZ'),'product':('STRING','854231')})],
 'energy':[('270900','A','2024',{'product_code':('STRING','270900'),'frequency':('STRING','A'),'period':('STRING','2024'),'period_start':('DATE','2024-01-01')})],
}
ORIGINAL={'profile':'TRADE_PROFILE_SQL','product-partners':'TRADE_PRODUCT_PARTNERS_SQL','russia-aggregate':'RUSSIA_AGGREGATE_SQL','russia-bilateral':'RUSSIA_BILATERAL_SQL','russia-routes':'RUSSIA_ROUTES_SQL','energy':'ENERGY_FLOWS_SQL'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--loader-sha',required=True);parser.add_argument('--raw-run');args=parser.parse_args()
    run=os.environ.get('BUILD_ID','')
    if not re.fullmatch(r'[a-f0-9-]{36}',run) or not re.fullmatch(r'[a-f0-9]{40}',args.loader_sha):raise ValueError('Cloud worker and exact loader commit required')
    if args.raw_run and not re.fullmatch(r'[a-f0-9-]{36}',args.raw_run):raise ValueError('Invalid raw run')
    api=Rest();objects=Objects(api);queries=Queries(api,objects,run,args.loader_sha,args.raw_run)
    base='processing-runs/trade-reports/'+run+'/'
    current=objects.meta(SERVING,PREFIX+'current.json');previous_generation=current['generation'] if current else 0
    supplier_pointer=json.loads(objects.read(SERVING,'static-assets/russia-trade-suppliers/current.json'))
    if supplier_pointer['release_id']!='351ee83a-a765-482a-9ca4-a81c7a304dee':raise ValueError('Supplier release changed; repin before exporting')
    supplier_manifest=objects.verified(SERVING,supplier_pointer)
    if supplier_manifest['snapshot_as_of']!=PIN:raise ValueError('Supplier time pin mismatch')
    results={};checks=[];counts={};suppliers={}
    def publish(parts,rows):
        numeric(rows)
        if len(rows)>100000:raise ValueError('Reader row bound exceeded')
        k=key(parts);data=body({'schema_version':'trade-report-rows.v1','release_id':run,'key':k,'rows':rows})
        if len(data)>24*MIB:raise ValueError('Reader object bound exceeded: '+str(parts))
        objects.write(PRIVATE,base+'staging/'+k+'.json',data)
        ref=objects.write(SERVING,PREFIX+'releases/'+run+'/'+k+'.json',data);ref['rows']=len(rows)
        return k,ref
    for family,sql in bulk().items():
        rows=queries.extract(family,sql,{'min_date':('DATE','2019-01-01' if family=='energy-periods' else '2000-01-01')});groups=partition(family,rows);counts[family]={'received_aggregate_rows':len(rows),'accepted_aggregate_rows':len(rows),'rejected':0,'deduplicated':0,'serving_keys':len(groups)}
        for index,spot in enumerate(SPOTS.get(family,[])):
            parts=(family,*spot[:-1]);point=queries.extract('check-'+family+'-'+str(index),pinned(SQL[ORIGINAL[family]]),spot[-1])
            if not equivalent(groups.get(parts,[]),point):raise ValueError('Original reader reconciliation failed: '+str(parts))
            checks.append({'key':list(parts),'rows':len(point),'original_reader_values':'exact equivalent, labels and unordered provenance lists normalized'})
        if not groups:raise ValueError('No serving coverage: '+family)
        if family=='russia-aggregate':
            for parts,report_rows in groups.items():
                product=parts[-1]
                if product not in suppliers:
                    payload=objects.verified(SERVING,supplier_manifest['products'][product])
                    if payload['product']!=product or len(payload['rows'])!=supplier_manifest['products'][product]['rows']:raise ValueError('Supplier payload count mismatch')
                    suppliers[product]=payload['rows']
                # Conservative full API estimate includes reader-added reported numeric token
                # copies, all supplier rows, and a metadata allowance.
                complete={'observations':[dict(r,reported_value_usd=r['value_usd']) for r in report_rows],'suppliers':[dict(r,reported_value_usd=r['value_usd']) for r in suppliers[product]]}
                if len(body(complete))+512*1024>24*MIB:raise ValueError('Complete Russia response exceeds live API bound: '+str(parts))
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for k,ref in pool.map(lambda item:publish(list(item[0]),item[1]),groups.items()):results[k]=ref
        print(json.dumps({'event':'report_staged','family':family,'keys':len(groups)}),flush=True)
        del rows,groups
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for k,ref in pool.map(lambda item:publish(['russia-suppliers',item[0]],item[1]),suppliers.items()):results[k]=ref
    if len(results)>50000:raise ValueError('Manifest key bound exceeded')
    if queries.admitted>2*1024*GIB:raise ValueError('Cumulative restored scan budget exceeded')
    manifest={'schema_version':'trade-reports.v1','release_id':run,'snapshot_as_of':PIN,'results':results,'source_web_sha':SOURCE['web_sha'],'loader_sha':args.loader_sha,'coverage':counts,'supplier_release_id':supplier_pointer['release_id'],'validation':checks,'source_queries':queries.receipts}
    data=body(manifest)
    if len(data)>24*MIB:raise ValueError('Manifest byte bound exceeded')
    manifest_ref=objects.write(SERVING,PREFIX+'releases/'+run+'/manifest.json',data)
    receipt={'schema_version':'trade-report-receipt.v1','run_id':run,'loader_sha':args.loader_sha,'source_web_sha':SOURCE['web_sha'],'region':'europe-west4','service_account':'psd-data-builder@'+PROJECT+'.iam.gserviceaccount.com','started_sources':queries.receipts,'snapshot_as_of':PIN,'supplier_pointer':supplier_pointer,'coverage':counts,'checks':checks,'estimated_admitted_bytes':queries.admitted,'billed_bytes':queries.billed,'manifest':manifest_ref,'processing_status':'validated','publication_status':'prepared','completed_at':datetime.now(timezone.utc).isoformat()}
    objects.write(PRIVATE,base+'prepared.json',body(receipt))
    pointer=dict(manifest_ref,schema_version='1.0.0',bucket=SERVING,release_id=run)
    pointer_ref=objects.write(SERVING,PREFIX+'current.json',body(pointer),previous_generation)
    receipt.update(publication_status='published',pointer=pointer_ref,completed_at=datetime.now(timezone.utc).isoformat());objects.write(PRIVATE,base+'completed.json',body(receipt))
    print(json.dumps({'event':'trade_reports_published','release_id':run,'keys':len(results),'billed_bytes':queries.billed,'receipt':'gs://'+PRIVATE+'/'+base+'completed.json'}),flush=True)
if __name__=='__main__':main()
