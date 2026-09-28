"""Cloud-only annual supplier serving release; no website/data-plane coupling."""
import argparse
from datetime import date, datetime, timezone
from decimal import Decimal, localcontext
import hashlib
import gzip
import json
import os
from pathlib import Path
import re
import sys
import uuid

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'undp_cloud'))
from query_costs import BudgetedQueries, GIB

PROJECT='czbudget-janrezab'
PRIVATE=PROJECT+'-data-layers'
PUBLIC=PROJECT+'-public-snapshots'
PREFIX='static-assets/russia-trade-suppliers/'
PRODUCTS=['TOTAL']+[f'{n:02}' for n in range(1,100)]+['854231','847130','845710','848210']
ROW_FIELDS=['period','reporter_iso3','reporter_name','partner_iso3','value_usd','product_count',
            'release_ids','source_last_released','retrieved_at']

def dump(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False,
        default=lambda x:x.isoformat() if isinstance(x,(date,datetime)) else str(x)).encode()

def payloads(rows,release,snapshot):
    uuid.UUID(release)
    as_of=datetime.fromisoformat(snapshot.replace('Z','+00:00'))
    if as_of.tzinfo is None: raise ValueError('Snapshot must have a time zone')
    groups={p:[] for p in PRODUCTS}; seen=set(); controls={}
    for row in rows:
        product=row['product']; period=str(row['period'])
        key=(period,row['reporter_iso3'],row['partner_iso3'])
        if product not in groups or (product,*key) in seen: raise ValueError('Invalid/duplicate basket key')
        seen.add((product,*key))
        if not re.fullmatch(r'\d{4}',period) or not 2019<=int(period)<=as_of.year: raise ValueError('Invalid annual period')
        if not re.fullmatch(r'[A-Z]{3}',row['reporter_iso3']) or row['partner_iso3'] not in {'RUS','KAZ','KGZ'}: raise ValueError('Invalid geography')
        money=Decimal(str(row['value_usd']))
        if not money.is_finite() or not re.fullmatch(r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)',str(row['value_usd'])): raise ValueError('Invalid exact money value')
        accepted=int(row['accepted_source_rows']); received=int(row['received_source_rows']); count=int(row['product_count'])
        if int(row['missing_money_rows']) or not 0<count<=accepted<=received: raise ValueError('Missing money or inconsistent source count')
        if not row.get('release_ids') or not row.get('retrieved_at'): raise ValueError('Missing provenance')
        normalized={k:row.get(k) for k in ROW_FIELDS};normalized.update(period=period,value_usd=str(row['value_usd']),product_count=count)
        groups[product].append(normalized)
        controls[(product,*key)]=(money,count,accepted,received)
    totals=[(key[1:],value) for key,value in controls.items() if key[0]=='TOTAL']
    if not totals: raise ValueError('No observed supplier coverage; publication held')
    with localcontext() as context:
        context.prec=100
        for key,total in totals:
            chapters=[value for identity,value in controls.items() if identity[1:]==key and len(identity[0])==2]
            if tuple(sum(v[i] for v in chapters) for i in range(4))!=total: raise ValueError('HS2 baskets do not reconcile to TOTAL')
        if any(('TOTAL',*key[1:]) not in controls for key in controls): raise ValueError('Basket without TOTAL control')
    bodies={}
    for product,items in groups.items():
        body=dump(dict(schema_version='russia-trade-suppliers.product.v1',release_id=release,product=product,rows=items))
        if len(body)>4*1024*1024 or len(items)>20000: raise ValueError('Serving file exceeds reader bounds')
        bodies[product]=body
    return bodies,dict(received_source_rows=sum(v[3] for _,v in totals),accepted_source_rows=sum(v[2] for _,v in totals),
        deduplicated_source_rows=sum(v[3]-v[2] for _,v in totals),rejected_rows=0,aggregate_rows=len(rows),
        coverage=[dict(period=key[0],reporter_iso3=key[1],partner_iso3=key[2],unit='USD',value_usd=str(value[0]),product_count=value[1],accepted_source_rows=value[2],received_source_rows=value[3]) for key,value in totals])

def main():
    if not os.environ.get('BUILD_ID'): raise RuntimeError('Cloud Build only; never run a local export')
    parser=argparse.ArgumentParser();parser.add_argument('--loader-sha',required=True);args=parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}',args.loader_sha): raise ValueError('Exact committed loader SHA required')
    from cloud_clients import bigquery,storage
    release=os.environ['BUILD_ID'];uuid.UUID(release)
    gcs=storage.Client(project=PROJECT);private=gcs.bucket(PRIVATE);public=gcs.bucket(PUBLIC)
    prefix='processing-runs/russia-trade-suppliers/'+release
    def immutable(bucket,key,body,content_type='application/json'):
        blob=bucket.blob(key)
        if blob.exists():
            blob.reload();existing=bucket.blob(key,generation=int(blob.generation)).download_as_bytes(checksum='auto')
            if existing!=body: raise ValueError('Immutable artifact differs: '+key)
        else: blob.upload_from_string(body,content_type=content_type,if_generation_match=0,checksum='auto');blob.reload()
        if bucket.blob(key,generation=int(blob.generation)).download_as_bytes(checksum='auto')!=body: raise ValueError('Artifact roundtrip differs')
        return dict(bucket=bucket.name,object=key,generation=str(blob.generation),sha256=hashlib.sha256(body).hexdigest(),bytes=len(body))
    complete=private.blob(prefix+'/completed.json')
    if complete.exists():
        receipt=json.loads(complete.download_as_bytes(checksum='auto'))
        for ref in [receipt['serving_manifest'],*receipt['serving_files'].values()]:
            body=public.blob(ref['object'],generation=int(ref['generation'])).download_as_bytes(checksum='auto')
            if len(body)!=ref['bytes'] or hashlib.sha256(body).hexdigest()!=ref['sha256']: raise ValueError('Completed retry object differs')
        print(json.dumps(dict(event='supplier_release_already_published',release_id=release)),flush=True);return
    sql=Path(__file__).with_name('suppliers.sql').read_text();sql_sha=hashlib.sha256(sql.encode()).hexdigest()
    raw_blob=private.blob(prefix+'/raw/warehouse-extract.json.gz')
    pointer=public.blob(PREFIX+'current.json')
    if raw_blob.exists():
        envelope=json.loads(gzip.decompress(raw_blob.download_as_bytes(checksum='auto')))
        if envelope['loader_git_sha']!=args.loader_sha or envelope['query_sha256']!=sql_sha: raise ValueError('Retry source pin differs')
    else:
        if pointer.exists(): pointer.reload();expected=str(pointer.generation)
        else: expected='0'
        client=bigquery.Client(project=PROJECT,location='EU')
        queries=BudgetedQueries(client,bigquery,run_id=release,
            loader_sha=args.loader_sha,max_query_bytes=96*GIB,max_run_bytes=96*GIB)
        queries.labels.update(dataset='comtrade',purpose='russia-suppliers')
        source_job=os.environ.get('SOURCE_QUERY_JOB','')
        source_labels=None
        if source_job:
            job,pin,source_labels=client.reuse(source_job,sql)
            snapshot=datetime.fromisoformat(pin.replace('Z','+00:00'))
            rows=[dict(r) for r in job.result()]
            queries.billed_bytes=queries.admitted_bytes=int(job.total_bytes_billed or 0)
            if queries.billed_bytes>queries.max_run_bytes: raise ValueError('Reused job exceeded this run allowance')
            queries.jobs=[dict(job_id=source_job,billed_bytes=queries.billed_bytes,reused_completed_result=True,source_labels=source_labels)]
        else:
            snapshot=next(iter(queries.query('SELECT TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MINUTE) snapshot_at')))['snapshot_at']
            snapshot=datetime.fromisoformat(snapshot.replace('Z','+00:00'))
            rows=[dict(r) for r in queries.query(sql,[bigquery.ScalarQueryParameter('snapshot_at','TIMESTAMP',snapshot.isoformat())])]
        envelope=dict(schema_version='1.0.0',loader_git_sha=args.loader_sha,query_sha256=sql_sha,snapshot_as_of=snapshot.isoformat(),
            started_at=datetime.now(timezone.utc).isoformat(),previous_pointer_generation=expected,rows=rows,query_usage=queries.receipt())
    raw_body=dump(envelope)
    if len(raw_body)>128*1024*1024: raise ValueError('Raw extract exceeds 128 MiB uncompressed')
    compressed=gzip.compress(raw_body,mtime=0)
    if len(compressed)>32*1024*1024: raise ValueError('Compressed raw extract exceeds 32 MiB')
    raw=immutable(private,raw_blob.name,compressed,'application/gzip');query_ref=immutable(private,prefix+'/raw/query.sql',sql.encode(),'text/plain')
    bodies,controls=payloads(json.loads(raw_body)['rows'],release,envelope['snapshot_as_of'])
    refs={};staged={}
    for product,body in bodies.items():
        staged[product]=immutable(private,prefix+'/staging/'+product+'.json',body)
        refs[product]=immutable(public,PREFIX+'releases/'+release+'/'+product+'.json',body)
        refs[product]['rows']=len(json.loads(body)['rows'])
    manifest=dict(schema_version='russia-trade-suppliers.v1',release_id=release,snapshot_as_of=envelope['snapshot_as_of'],products=refs,
        note='Calculated annual exporter-reported HS6 baskets. Excludes groups and World rows. Missing coverage is not zero; HS2 and TOTAL overlap and must not be added.')
    manifest_body=dump(manifest)
    if len(manifest_body)>512*1024: raise ValueError('Manifest exceeds reader bounds')
    staged_manifest=immutable(private,prefix+'/staging/manifest.json',manifest_body)
    target=immutable(public,PREFIX+'releases/'+release+'/manifest.json',manifest_body)
    value=dict(schema_version='1.0.0',release_id=release,**target)
    prepared=dict(schema_version='1.0.0',release_id=release,loader_git_sha=args.loader_sha,build_id=release,region='europe-west4',
        service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=envelope['started_at'],snapshot_as_of=envelope['snapshot_as_of'],
        source_tables=['budget_detail.trade_observations','budget_detail.trade_areas'],source_urls=['https://comtradeapi.un.org'],source_query=query_ref,
        raw_destination=raw,private_staging=staged,private_staging_manifest=staged_manifest,serving_files=refs,serving_manifest=target,
        publication_pointer='gs://'+PUBLIC+'/'+PREFIX+'current.json',
        previous_pointer_generation=envelope['previous_pointer_generation'],query_usage=envelope['query_usage'],controls=controls,
        coverage_note='Annual observed exporter declarations from 2019, partners RUS/KAZ/KGZ. No assertion of complete checkpoint/country coverage.',
        processing_status='validated',publication_status='prepared',website_destinations=['/api/v1/trade/russia-aggregate'],
        validation=dict(unique_keys='passed',exact_money='preserved',hs2_total_reconciliation='passed',source_row_reconciliation='passed',
            annual_monthly_separation='annual only',world_groups='excluded',raw_staging_serving_generation_hash_readbacks='passed',all_104_products='passed'))
    immutable(private,prefix+'/prepared.json',dump(prepared))
    # A retry after a successful CAS but before the completion receipt must
    # recognize its pointer, never overwrite a newer competing publication.
    if pointer.exists():
        pointer.reload();current=json.loads(pointer.download_as_bytes(if_generation_match=int(pointer.generation),checksum='auto'))
    else: current=None
    if current!=value:
        pointer.upload_from_string(dump(value),content_type='application/json',if_generation_match=int(envelope['previous_pointer_generation']),checksum='auto')
    if json.loads(pointer.download_as_bytes(checksum='auto'))!=value: raise ValueError('Pointer roundtrip differs')
    prepared.update(publication_status='published')
    receipt=immutable(private,complete.name,dump(prepared))
    print(json.dumps(dict(event='supplier_release_published',release_id=release,receipt=receipt,query_usage=envelope['query_usage'],aggregate_rows=controls['aggregate_rows'])),flush=True)

if __name__=='__main__': main()
