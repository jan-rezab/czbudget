"""Promote one reviewed immutable private bundle; no warehouse/source rereads."""
import argparse,copy,csv,hashlib,io,json,os,re,tempfile,uuid
from collections import Counter
from pathlib import Path
import urllib.request,urllib.error
from publish_reports import PRIVATE,PUBLIC,POINTER,PROJECT,validate,dump,stamp
KEYS={'json':'reports.json','core_csv':'core-observations.csv','annex_csv':'annex-observations.csv','chart_csv':'observations.csv','chart_details':'chart-details.json'}

def promotion_payload(payload,release,access):
    result=copy.deepcopy(payload)
    if result['release_id']!=release or result.get('publication_status')!='not_published' or result.get('processing_status')!='validated_review_bundle':raise ValueError('Not a validated private review')
    for key,filename in KEYS.items():
        expected=f'gs://{PRIVATE}/processing-runs/hdr-report-review/{release}/{filename}'
        if result['downloads'].get(key)!=expected:raise ValueError('Unexpected private download object')
        result['downloads'][key]=f'https://storage.googleapis.com/{PUBLIC}/static-assets/human-development/releases/{release}/{filename}' if access[key]=='verified_anonymous_head_200' or key=='json' else None
    result['download_access']=access;result['publication_status']='published';result['processing_status']='validated'
    validate(result)
    if result['charts']!=payload['charts'] or result['source_releases']!=payload['source_releases']:raise ValueError('Promotion changed reviewed observations')
    return result

def rewrite_chart_csv(source,destination,charts):
    """Only replace ambiguous row provenance; every data cell remains identical."""
    refs={c['id']:{r.get('source_id'):r for r in c['source_refs']} for c in charts}
    reader=csv.DictReader(source);writer=csv.DictWriter(destination,fieldnames=reader.fieldnames);writer.writeheader()
    before=hashlib.sha256();after=hashlib.sha256();counts=Counter();changed=0
    for row in reader:
        unchanged={k:v for k,v in row.items() if k not in {'source_release','source_url'}}
        before.update(dump(unchanged)+b'\n');original=json.loads(row['original_row_json']);sid=original.get('source_id')
        if row['chart_id'].startswith('provider-wid-top1-latest-'):
            if not sid or sid not in refs[row['chart_id']]:raise ValueError('WID history CSV lacks its exact source binding')
            ref=refs[row['chart_id']][sid];row['source_release']=ref['release_id'];row['source_url']=ref['url'];changed+=1
        after.update(dump({k:v for k,v in row.items() if k not in {'source_release','source_url'}})+b'\n')
        counts[row['chart_id']]+=1;writer.writerow(row)
    if before.digest()!=after.digest():raise ValueError('CSV correction changed a data cell')
    return dict(rows_by_chart=dict(counts),data_cells_before_sha256=before.hexdigest(),data_cells_after_sha256=after.hexdigest(),corrected_wid_rows=changed,method='Only WID source_release/source_url fields selected from exact row source_id; all other cells, source precision and rows unchanged.')

def checked_read(bucket,name,generation,sha,max_bytes=None):
    blob=bucket.blob(name,generation=int(generation));body=blob.download_as_bytes(if_generation_match=int(generation),checksum='auto')
    if max_bytes and len(body)>max_bytes:raise ValueError('Object exceeds declared size bound')
    if hashlib.sha256(body).hexdigest()!=sha:raise ValueError('Pinned object SHA mismatch')
    return body

def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Cloud Build only')
    p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--reviewed-report-sha',required=True);p.add_argument('--loader-sha',required=True);p.add_argument('--qa-receipt',required=True);a=p.parse_args()
    m=re.fullmatch(r'gs://'+PRIVATE+r'/processing-runs/hdr-report-review/([0-9a-f-]{36})/validated-report-manifest.json',a.manifest)
    if not m:raise ValueError('Invalid review manifest path')
    rid=m[1];uuid.UUID(rid);qa=json.loads(Path(a.qa_receipt).read_text())
    if qa.get('report_sha256')!=a.reviewed_report_sha or qa.get('api_validation')!='passed' or qa.get('visual_validation')!='passed':raise ValueError('Exact reviewed artifact lacks successful API/visual QA')
    from google.cloud import storage
    gcs=storage.Client(project=PROJECT);private=gcs.bucket(PRIVATE);public=gcs.bucket(PUBLIC)
    manifest_blob=private.blob(a.manifest.split('/',3)[3]);manifest_blob.reload();manifest_generation=int(manifest_blob.generation)
    manifest_body=manifest_blob.download_as_bytes(if_generation_match=manifest_generation,checksum='auto');manifest=json.loads(manifest_body)
    if manifest.get('release_id')!=rid or manifest.get('sha256')!=a.reviewed_report_sha or manifest.get('bucket')!=PRIVATE or manifest.get('object')!=f'processing-runs/hdr-report-review/{rid}/reports.json' or manifest.get('processing_status')!='validated' or manifest.get('publication_status')!='not_published':raise ValueError('Review manifest mismatch')
    original=checked_read(private,manifest['object'],manifest['generation'],manifest['sha256'],2*1024*1024);payload=json.loads(original);validate(payload)
    if payload['source_releases']!=manifest['source_releases']:raise ValueError('Source release pin mismatch')
    review_blob=private.blob(f'processing-runs/hdr-report-review/{rid}/review-receipt.json');review_blob.reload();review_generation=int(review_blob.generation)
    review_body=review_blob.download_as_bytes(if_generation_match=review_generation,checksum='auto');review=json.loads(review_body)
    artifacts={r['uri']:r for r in review['downloads']}
    if review['publication_status']!='not_published' or review['source_releases']!=payload['source_releases']:raise ValueError('Review receipt mismatch')
    pointer=public.blob(POINTER);expected=0
    if pointer.exists():pointer.reload();expected=int(pointer.generation)
    promoted=[];access={'json':'not_yet_verified_direct_access; authenticated_report_store_contract'}
    histories={item['uri']:item for item in review.get('history_objects',[])}
    for chart in payload['charts']:
        for country,descriptor in chart.get('history_by_country',{}).items():
            expected=f'static-assets/human-development/releases/{rid}/history/{chart["id"]}/{country}.json'
            if descriptor['object']!=expected:raise ValueError('History is outside reviewed release')
            private_name=f'processing-runs/hdr-report-review/{rid}/history/{chart["id"]}/{country}.json'
            artifact=histories.get(f'gs://{PRIVATE}/{private_name}')
            if not artifact or artifact['sha256']!=descriptor['sha256'] or artifact['bytes']!=descriptor['bytes']:raise ValueError('History lacks exact validated receipt')
            body=checked_read(private,private_name,artifact['generation'],artifact['sha256'],2*1024*1024)
            full=json.loads(body)
            if full['id']!=chart['id'] or len(full['rows'])!=descriptor['rows'] or any(row.get('country')!=country for row in full['rows']):raise ValueError('History coverage mismatch')
            target=public.blob(expected)
            if not target.exists():private.copy_blob(private.blob(private_name,generation=int(artifact['generation'])),public,expected,source_generation=int(artifact['generation']),if_source_generation_match=int(artifact['generation']),if_generation_match=0)
            target.reload();checked_read(public,expected,target.generation,descriptor['sha256'],2*1024*1024)
            promoted.append(dict(artifact,uri=f'gs://{PUBLIC}/{expected}',generation=str(target.generation)))
    for key,filename in KEYS.items():
        if key=='json':continue
        uri=f'gs://{PRIVATE}/processing-runs/hdr-report-review/{rid}/{filename}';r=artifacts[uri];src=private.blob(uri.split('/',3)[3],generation=int(r['generation']));dest=f'static-assets/human-development/releases/{rid}/{filename}';blob=public.blob(dest)
        digest=hashlib.sha256()
        with src.open('rb') as stream:
            while chunk:=stream.read(1024*1024):digest.update(chunk)
        if digest.hexdigest()!=r['sha256']:raise ValueError('Private downloadable object hash mismatch')
        if key=='chart_csv':
            file=tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='',suffix='.csv',delete=False)
            with src.open('rb') as binary,file as output:
                proof=rewrite_chart_csv(io.TextIOWrapper(binary,encoding='utf-8',newline=''),output,payload['charts'])
            transformed=hashlib.sha256()
            with open(file.name,'rb') as stream:
                while chunk:=stream.read(1024*1024):transformed.update(chunk)
            expected_sha=transformed.hexdigest()
            if not blob.exists():blob.upload_from_filename(file.name,content_type='text/csv; charset=utf-8',if_generation_match=0,checksum='auto')
            derivation=dict(original_private_artifact=r,validation=proof)
            r=dict(r,sha256=expected_sha,bytes=os.path.getsize(file.name),derivation=derivation)
            os.unlink(file.name)
        elif not blob.exists():private.copy_blob(src,public,dest,source_generation=int(r['generation']),if_source_generation_match=int(r['generation']),if_generation_match=0)
        blob.reload();digest=hashlib.sha256()
        with public.blob(dest,generation=int(blob.generation)).open('rb') as stream:
            while chunk:=stream.read(1024*1024):digest.update(chunk)
        if digest.hexdigest()!=r['sha256']:raise ValueError('Promoted downloadable hash mismatch')
        promoted.append(dict(r,uri=f'gs://{PUBLIC}/{dest}',generation=str(blob.generation)))
        try:
            with urllib.request.urlopen(urllib.request.Request(f'https://storage.googleapis.com/{PUBLIC}/{dest}',method='HEAD'),timeout=20) as response:access[key]='verified_anonymous_head_200' if response.status==200 else 'not_available_http_'+str(response.status)
        except (urllib.error.URLError,TimeoutError) as e:access[key]='not_verified_'+str(getattr(e,'code','network_error'))
    result=promotion_payload(payload,rid,access);body=validate(result);sha=hashlib.sha256(body).hexdigest();name=f'static-assets/human-development/releases/{rid}/reports.json';blob=public.blob(name)
    if blob.exists():
        if blob.download_as_bytes(checksum='auto')!=body:raise ValueError('Immutable promoted report differs')
    else:blob.upload_from_string(body,content_type='application/json',if_generation_match=0,checksum='auto')
    blob.reload();checked_read(public,name,blob.generation,sha,2*1024*1024)
    receipt=dict(schema_version='1.0.0',release_id=rid,report_object=dict(uri=f'gs://{PUBLIC}/{name}',generation=str(blob.generation),sha256=sha,bytes=len(body)),publication_pointer=f'gs://{PUBLIC}/{POINTER}',coverage=payload.get('coverage'),rows=review['rows'],ready_charts=review['ready_charts'],original_figures_recreated=review['original_figures_recreated'],build_id=os.environ['BUILD_ID'],loader_git_sha=a.loader_sha,source_report_manifest=a.manifest,source_manifest_generation=str(manifest_generation),source_manifest_sha256=hashlib.sha256(manifest_body).hexdigest(),source_review_receipt_generation=str(review_generation),source_review_receipt_sha256=hashlib.sha256(review_body).hexdigest(),source_report_generation=manifest['generation'],source_report_sha256=manifest['sha256'],public_report_sha256=sha,source_releases=payload['source_releases'],qa=qa,downloads=promoted,previous_pointer_generation=str(expected),processing_status='validated',publication_status='prepared',region='europe-west4',service_account=os.environ.get('DATA_SERVICE_ACCOUNT'),created_at=stamp())
    prefix=f'processing-runs/hdr-report-promotion/{os.environ["BUILD_ID"]}';private.blob(prefix+'/prepared-receipt.json').upload_from_string(dump(receipt),content_type='application/json',if_generation_match=0,checksum='auto')
    pointer.upload_from_string(dump(dict(schema_version='1.0.0',bucket=PUBLIC,release_id=rid,object=name,sha256=sha,bytes=len(body),generated_at=result['generated_at'],downloads={key:f'static-assets/human-development/releases/{rid}/{filename}' for key,filename in KEYS.items()})),content_type='application/json',if_generation_match=expected,checksum='auto')
    receipt.update(publication_status='published',published_at=stamp());private.blob(prefix+'/completed-receipt.json').upload_from_string(dump(receipt),content_type='application/json',if_generation_match=0,checksum='auto');print(dump(receipt).decode(),flush=True)
if __name__=='__main__':main()
