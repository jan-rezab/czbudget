"""Cloud-only private history augmentation of one pinned validated review.

No source queries, respondent records, public objects, or website deployment.
Every history retains its exact native rows and country-specific provenance.
"""
import argparse, copy, hashlib, json, os, re, uuid
from collections import defaultdict
from pathlib import Path
from publish_reports import PRIVATE, PUBLIC, PROJECT, MAX_BYTES, validate, dump, stamp

ORIGINAL = '369c3550-0253-40c7-9cf8-8b1acf944b17'
SHA = '5b0ade36aa00f69a7c9336bc73bcd0f3f7d51ed08ed8b7830b2a8b105b25e7ef'
GENERATION = '1790471900799071'

from history_shards import history_bundle

def main():
    if not os.environ.get('BUILD_ID'): raise RuntimeError('Cloud Build only')
    p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True);a=p.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}',a.loader_sha): raise ValueError('Exact loader SHA required')
    from google.cloud import storage
    gcs=storage.Client(project=PROJECT);bucket=gcs.bucket(PRIVATE)
    old=f'processing-runs/hdr-report-review/{ORIGINAL}'
    prefix=f'processing-runs/hdr-report-review/{os.environ["BUILD_ID"]}'
    def read(name,generation,sha):
        body=bucket.blob(name,generation=int(generation)).download_as_bytes(if_generation_match=int(generation),checksum='auto')
        if hashlib.sha256(body).hexdigest()!=sha: raise ValueError('Pinned artifact hash differs')
        return body
    original=read(old+'/reports.json',GENERATION,SHA)
    receipt_body=bucket.blob(old+'/review-receipt.json').download_as_bytes(checksum='auto')
    receipt=json.loads(receipt_body)
    if receipt['release_id']!=ORIGINAL or receipt['publication_status']!='not_published' or receipt['staging_destination']['sha256']!=SHA: raise ValueError('Not the verified parent review')
    artifacts={item['uri'].rsplit('/',1)[1]:item for item in receipt['downloads']}
    detail=artifacts['chart-details.json'];details=json.loads(read(old+'/chart-details.json',detail['generation'],detail['sha256']))
    payload,histories=history_bundle(json.loads(original),details,os.environ['BUILD_ID'])
    def immutable(name,body,ctype='application/json'):
        blob=bucket.blob(name)
        if blob.exists():
            if blob.download_as_bytes(checksum='auto')!=body: raise ValueError('Immutable artifact differs')
        else: blob.upload_from_string(body,content_type=ctype,if_generation_match=0,checksum='auto')
        blob.reload()
        if read(name,blob.generation,hashlib.sha256(body).hexdigest())!=body: raise ValueError('Roundtrip differs')
        return dict(uri=f'gs://{PRIVATE}/{name}',generation=str(blob.generation),sha256=hashlib.sha256(body).hexdigest(),bytes=len(body))
    outputs=[];history_receipts=[]
    for public_name,body in histories.items():
        relative=public_name.split('/history/',1)[1]
        history_receipts.append(immutable(prefix+'/history/'+relative,body))
    # Existing bulk exports are copied within the private bucket, never downloaded to this Mac.
    for filename in ['observations.csv','core-observations.csv','annex-observations.csv']:
        source=artifacts[filename];src=bucket.blob(old+'/'+filename,generation=int(source['generation']));dst=bucket.blob(prefix+'/'+filename)
        if not dst.exists(): bucket.copy_blob(src,bucket,dst.name,source_generation=int(source['generation']),if_source_generation_match=int(source['generation']),if_generation_match=0)
        dst.reload();digest=hashlib.sha256()
        with bucket.blob(dst.name,generation=int(dst.generation)).open('rb') as stream:
            while chunk:=stream.read(1024*1024):digest.update(chunk)
        if digest.hexdigest()!=source['sha256'] or dst.size!=source['bytes']: raise ValueError('Private export copy differs')
        outputs.append(dict(source,uri=f'gs://{PRIVATE}/{dst.name}',generation=str(dst.generation),parent_export_release=ORIGINAL))
    details['parent_review_release']=ORIGINAL;details['release_id']=payload['release_id']
    details_body=dump(details);outputs.append(immutable(prefix+'/chart-details.json',details_body))
    payload['coverage']['presentation_compaction']['details_sha256']=hashlib.sha256(details_body).hexdigest()
    payload['coverage']['presentation_compaction']['details_bytes']=len(details_body)
    for key,url in payload['downloads'].items():
        if url: payload['downloads'][key]=url.replace('/'+ORIGINAL+'/', '/'+payload['release_id']+'/')
    report=immutable(prefix+'/reports.json',validate(payload));outputs.insert(0,report)
    new=copy.deepcopy(receipt)
    new.update(release_id=payload['release_id'],build_id=os.environ['BUILD_ID'],loader_git_sha=a.loader_sha,started_at=stamp(),validated_at=stamp(),staging_destination=report,downloads=outputs,history_objects=history_receipts,parent_review_release=ORIGINAL,parent_report_sha256=SHA,publication_pointer=None,publication_status='not_published',processing_status='validated',history_coverage=payload['coverage']['history_export'])
    new['validation']['complete_native_history_row_preservation']='passed'
    immutable(prefix+'/review-receipt.json',dump(new))
    manifest=dict(schema_version='1.0.0',release_id=payload['release_id'],bucket=PRIVATE,object=prefix+'/reports.json',sha256=report['sha256'],bytes=report['bytes'],generation=report['generation'],processing_status='validated',publication_status='not_published',source_releases=payload['source_releases'])
    immutable(prefix+'/validated-report-manifest.json',dump(manifest))
    print(dump(dict(event='private_full_history_bundle_validated',manifest=f'gs://{PRIVATE}/{prefix}/validated-report-manifest.json',history_coverage=new['history_coverage'],report=report)).decode(),flush=True)

if __name__=='__main__':main()
