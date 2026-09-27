"""Cloud-only, bounded energy period serving export with atomic publication."""
import argparse
from datetime import date, datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'undp_cloud'))
from query_costs import BudgetedQueries, GIB

PROJECT = 'czbudget-janrezab'
PRIVATE = PROJECT + '-data-layers'
PUBLIC = PROJECT + '-public-snapshots'
POINTER = 'static-assets/energy-trade-periods/current.json'
PRODUCTS = {'petroleum':('270900','Crude petroleum'), 'lng':('271111','Liquefied natural gas'), 'gas':('271121','Natural gas in gaseous state')}


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False,
                      default=lambda x: x.isoformat() if isinstance(x, (date, datetime)) else str(x)).encode()


def payload_from_rows(rows, release, snapshot_at):
    uuid.UUID(release)
    as_of = datetime.fromisoformat(snapshot_at.replace('Z','+00:00'))
    products = {code:dict(id=pid,code=code,name=name,periods=[]) for pid,(code,name) in PRODUCTS.items()}
    seen = set()
    for raw in rows:
        code, frequency, period = raw['product_code'], raw['frequency'], str(raw['period'])
        if code not in products or frequency not in {'A','M'}: raise ValueError('Unexpected energy product or frequency')
        if len(period) != (4 if frequency=='A' else 6) or not period.isdigit(): raise ValueError('Invalid native period')
        year = int(period[:4]); month = 1 if frequency=='A' else int(period[4:])
        expected = date(year, month, 1).isoformat()
        if not '2019-01-01' <= expected <= as_of.date().isoformat() or str(raw['period_start']) != expected: raise ValueError('Period/date mismatch')
        key = (code,frequency,period)
        if key in seen: raise ValueError('Duplicate serving key')
        seen.add(key)
        item = {k:raw.get(k) for k in ['source_last_released','retrieved_at']}
        item.update(frequency=frequency,period=period,period_start=expected)
        for field in ['reporting_markets','reported_origins']:
            n = int(raw[field])
            if n <= 0 or n > int(raw['source_record_count']): raise ValueError('Invalid coverage denominator')
            item[field] = n
        for field in ['observed_value_usd','observed_net_weight_kg']:
            value = raw.get(field)
            if value is None:
                if field=='observed_value_usd': raise ValueError('Missing money total; publication held')
                item[field] = None; item[field+'_source'] = None
            else:
                number = float(value)
                if not math.isfinite(number): raise ValueError('Nonfinite aggregate')
                item[field] = number
                item[field+'_source'] = str(value)
        item['source_record_count'] = int(raw['source_record_count'])
        products[code]['periods'].append(item)
    if any(not product['periods'] for product in products.values()): raise ValueError('Missing product coverage; publication held')
    for product in products.values(): product['periods'].sort(key=lambda row:(row['frequency'],row['period']))
    payload = dict(schema_version='energy-trade-periods.v1',release_id=release,snapshot_as_of=snapshot_at,
        products=list(products.values()),source=dict(title='United Nations Comtrade Database',url='https://comtrade.un.org/',table='budget_detail.trade_observations'),
        note='Calculated importer-reported bilateral totals at original HS classification. Groups and World totals are excluded. Annual and monthly grains are separate; reporting coverage varies and the latest period may be partial.')
    body = dump(payload)
    if len(body)>2*1024*1024: raise ValueError('Serving payload exceeds 2 MiB')
    return payload, body


def main():
    if not os.environ.get('BUILD_ID'): raise RuntimeError('Cloud Build only; never export from a local or website process')
    parser=argparse.ArgumentParser();parser.add_argument('--loader-sha',required=True);args=parser.parse_args()
    if len(args.loader_sha)!=40 or any(c not in '0123456789abcdef' for c in args.loader_sha): raise ValueError('Exact Git SHA required')
    from google.cloud import bigquery, storage
    release=os.environ['BUILD_ID'];uuid.UUID(release)
    started=datetime.now(timezone.utc).isoformat()
    gcs=storage.Client(project=PROJECT);private=gcs.bucket(PRIVATE);public=gcs.bucket(PUBLIC)
    prefix='processing-runs/energy-trade-periods/'+release
    complete=private.blob(prefix+'/completed.json')
    if complete.exists():
        previous=json.loads(complete.download_as_bytes(checksum='auto'))
        target=previous['staging_destination'];body=public.blob(target['object'],generation=int(target['generation'])).download_as_bytes(checksum='auto')
        if hashlib.sha256(body).hexdigest()!=target['sha256']: raise ValueError('Published retry artifact failed verification')
        print(json.dumps(dict(event='energy_periods_already_published',release_id=release)),flush=True);return
    pointer=public.blob(POINTER)
    if pointer.exists():
        pointer.reload();expected=int(pointer.generation)
        pointer.download_as_bytes(if_generation_match=expected,checksum='auto')
    else: expected=0
    def immutable(bucket,key,body,content_type='application/json'):
        blob=bucket.blob(key)
        if blob.exists():
            if blob.download_as_bytes(checksum='auto')!=body: raise ValueError('Immutable artifact differs: '+key)
        else: blob.upload_from_string(body,content_type=content_type,if_generation_match=0,checksum='auto')
        blob.reload();received=bucket.blob(key,generation=int(blob.generation)).download_as_bytes(checksum='auto')
        if received!=body: raise ValueError('Artifact roundtrip differs')
        return dict(bucket=bucket.name,object=key,uri='gs://'+bucket.name+'/'+key,generation=str(blob.generation),sha256=hashlib.sha256(body).hexdigest(),bytes=len(body))
    sql=Path(__file__).with_name('periods.sql').read_text()
    sql_sha=hashlib.sha256(sql.encode()).hexdigest()
    raw_blob=private.blob(prefix+'/raw/warehouse-extract.json')
    if raw_blob.exists():
        envelope=json.loads(raw_blob.download_as_bytes(checksum='auto'))
        if envelope['loader_git_sha']!=args.loader_sha or envelope['query_sha256']!=sql_sha: raise ValueError('Retry source pin differs')
    else:
        snapshot=datetime.now(timezone.utc)
        client=bigquery.Client(project=PROJECT,location='EU')
        queries=BudgetedQueries(client,bigquery,run_id=release,loader_sha=args.loader_sha,max_query_bytes=64*GIB,max_run_bytes=64*GIB)
        queries.labels.update(dataset='comtrade',purpose='energy-periods')
        rows=[dict(r) for r in queries.query(sql,[bigquery.ScalarQueryParameter('snapshot_at','TIMESTAMP',snapshot),bigquery.ScalarQueryParameter('min_date','DATE','2019-01-01'),bigquery.ScalarQueryParameter('max_date','DATE',snapshot.date())])]
        envelope=dict(schema_version='1.0.0',loader_git_sha=args.loader_sha,query_sha256=sql_sha,snapshot_as_of=snapshot.isoformat(),rows=rows,query_usage=queries.receipt())
    raw_body=dump(envelope)
    if len(raw_body)>32*1024*1024: raise ValueError('Raw extract exceeds 32 MiB')
    raw=immutable(private,raw_blob.name,raw_body)
    query_object=immutable(private,prefix+'/raw/query.sql',sql.encode(),'text/plain')
    rows=json.loads(raw_body)['rows']
    payload,body=payload_from_rows(rows,release,envelope['snapshot_as_of'])
    staged=immutable(private,prefix+'/staging/periods.json',body)
    target=immutable(public,'static-assets/energy-trade-periods/releases/'+release+'/periods.json',body)
    prepared=dict(schema_version='1.0.0',release_id=release,loader_git_sha=args.loader_sha,build_id=release,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=started,snapshot_as_of=envelope['snapshot_as_of'],source_urls=['https://comtradeapi.un.org'],source_tables=['budget_detail.trade_observations','budget_detail.trade_areas'],raw_destination=raw,source_query=query_object,staging_destination=target,private_staging_destination=staged,publication_pointer='gs://'+PUBLIC+'/'+POINTER,website_destinations=['/api/v1/trade/energy/periods'],processing_status='validated',publication_status='prepared',received_source_records=sum(int(r['source_record_count']) for r in rows),accepted_source_records=sum(int(r['source_record_count']) for r in rows),received_aggregate_rows=len(rows),accepted_aggregate_rows=len(rows),rejected_rows=0,deduplicated_aggregate_rows=0,query_usage=envelope['query_usage'],coverage='Global observed reporting markets and origins per product/frequency/period, not complete checkpoint reconciliation or worldwide trade coverage',validation=dict(exact_source_decimal_text='preserved',unique_keys='passed',annual_monthly_separation='passed',world_and_groups='excluded by identical serving SQL',period_dates='passed',finite_values='passed',all_three_products='passed',raw_and_staging_hash_roundtrip='passed'),totals_by_product_frequency_period=[dict(product_code=r['product_code'],frequency=r['frequency'],period=str(r['period']),geography='observed importer-reported bilateral markets',money_unit='USD',weight_unit='kg',source_value_usd=str(r['observed_value_usd']),source_net_weight_kg=None if r['observed_net_weight_kg'] is None else str(r['observed_net_weight_kg'])) for r in rows])
    immutable(private,prefix+'/prepared.json',dump(prepared))
    pointer_value=dict(schema_version='1.0.0',release_id=release,bucket=PUBLIC,object=target['object'],sha256=target['sha256'],bytes=target['bytes'],generation=target['generation'],snapshot_as_of=envelope['snapshot_as_of'])
    pointer.upload_from_string(dump(pointer_value),content_type='application/json',if_generation_match=expected,checksum='auto')
    if json.loads(pointer.download_as_bytes(checksum='auto'))!=pointer_value: raise ValueError('Pointer roundtrip differs')
    prepared.update(publication_status='published',published_at=datetime.now(timezone.utc).isoformat(),previous_pointer_generation=str(expected))
    receipt=immutable(private,complete.name,dump(prepared))
    print(json.dumps(dict(event='energy_periods_published',release_id=release,aggregate_rows=len(rows),query_usage=envelope['query_usage'],receipt=receipt)),flush=True)


if __name__=='__main__': main()
