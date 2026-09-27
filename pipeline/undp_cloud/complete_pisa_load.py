"""Complete the exact existing private PISA load; never reload respondent data."""
import argparse, hashlib, json, os, re
from google.cloud import bigquery, storage
from report_sources import D, PROJECT, BUCKET, dump, stamp, transaction_with_retry, upload
from pisa_completion_contract import *


def main():
    p=argparse.ArgumentParser();p.add_argument('--validator-sha',required=True);a=p.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}',a.validator_sha):raise ValueError('Pin full validator Git SHA')
    rid=os.environ['BUILD_ID']
    if not re.fullmatch(r'[0-9a-f-]{36}',rid) or rid==RUN:raise ValueError('New completion build UUID required')
    prefix='processing-runs/hdr-report-sources/'+rid
    bq=bigquery.Client(project=PROJECT,location='EU');bucket=storage.Client(project=PROJECT).bucket(BUCKET)
    started=stamp()
    def query(sql):return list(bq.query(sql,location='EU').result(timeout=600))
    def q(x):return dump(x)
    existing=query(f'SELECT loader_git_sha,receipt_sha256 FROM `{D}.ingestion_runs` WHERE release_id={q(rid)}')
    if existing:
        prepared=bucket.blob(prefix+'/prepared-receipt.json').download_as_bytes()
        if len(existing)!=1 or existing[0].loader_git_sha!=a.validator_sha or hashlib.sha256(prepared).hexdigest()!=existing[0].receipt_sha256:raise ValueError('Committed continuation identity mismatch')
        upload(bucket,prefix+'/completed.json',prepared);return
    # Await precisely the existing LOAD. No load_table_from_uri call exists here.
    job=bq.get_job(JOB,project=PROJECT,location='EU');validate_job_binding(job.to_api_repr())
    job.result(timeout=900);job.reload();validate_successful_load(job.to_api_repr())
    print(dump(dict(event='existing_load_validated',job_id=JOB,rows=613745)),flush=True)
    checkpoint=json.loads(bucket.blob('processing-runs/hdr-report-sources/'+RUN+'/processed/'+SOURCE+'.json').download_as_bytes())
    name=STAGE.split('/',3)[3];latest=bucket.blob(name);latest.reload()
    if str(latest.generation)!=STAGE_GENERATION:raise ValueError('Latest stage generation changed')
    stage=bucket.blob(name,generation=int(STAGE_GENERATION));stage.reload();h=hashlib.sha256()
    with stage.open('rb') as stream:
        for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
    validate_stage_metadata(checkpoint,stage.generation,stage.size,h.hexdigest())
    latest.reload()
    if str(latest.generation)!=STAGE_GENERATION:raise ValueError('Stage changed during verification')
    catname=CATALOG.split('/',3)[3];catlatest=bucket.blob(catname);catlatest.reload()
    if str(catlatest.generation)!=CATALOG_GENERATION or catlatest.size!=2574:raise ValueError('Catalog generation or size changed')
    catbytes=bucket.blob(catname,generation=int(CATALOG_GENERATION)).download_as_bytes()
    if hashlib.sha256(catbytes).hexdigest()!=CATALOG_SHA:raise ValueError('Catalog hash changed')
    catalog=[json.loads(line) for line in catbytes.splitlines()]
    if len(catalog)!=1 or catalog[0]['release_id']!=RUN or catalog[0]['source_id']!=SOURCE or catalog[0]['processing_status']!='source_records_validated':raise ValueError('Native catalog identity changed')
    source=json.loads(catalog[0]['source_metadata_json'])
    for key in ('source_id','url','sha256','stage_uri','stage_generation','stage_sha256','accepted_records','parser_git_sha'):
        if source[key]!=checkpoint[key]:raise ValueError('Catalog/checkpoint mismatch: '+key)
    rt=D+'.'+DESTINATION['tableId']
    checks=query(f'''SELECT COUNT(*) n,COUNT(DISTINCT TO_JSON_STRING(STRUCT(source_id,member,row_number))) unique_n,
        COUNTIF(source_id!={q(SOURCE)} OR release_id!={q(RUN)} OR source_url!={q(source['url'])} OR source_sha256!={q(source['sha256'])}) wrong_identity,
        COUNTIF(ENDS_WITH(member,'::metadata')) metadata_n,
        COUNTIF(ENDS_WITH(member,'::metadata') AND JSON_VALUE(record_json,'$.expected_source_row_count')='613744') expected_count_n
        FROM `{rt}`''')[0]
    if (checks.n,checks.unique_n,checks.wrong_identity,checks.metadata_n,checks.expected_count_n)!=(613745,613745,0,1,1):raise ValueError('Native fullsource warehouse validation failed')
    # These existing private views must already exist; this continuation changes no serving contract.
    for name in ('current_report_source_records','current_report_source_catalog'):
        if bq.get_table(D+'.'+name).table_type!='VIEW':raise ValueError('Missing existing source view')
    ct=D+'.stage_pisa_completion_catalog_'+rid.replace('-','_')
    fields=[bigquery.SchemaField(n,'STRING') for n in ('release_id','source_id','processing_status','source_metadata_json')]
    catalog_job=bq.load_table_from_json(catalog,ct,job_id='pisa_completion_catalog_'+rid.replace('-','_'),location='EU',job_config=bigquery.LoadJobConfig(schema=fields,write_disposition='WRITE_TRUNCATE',max_bad_records=0))
    catalog_job.result(timeout=120)
    if bq.get_table(ct).num_rows!=1:raise ValueError('Tiny catalog row count failed')
    pointer='hdr_report_sources_2025:pisa'
    owners=query(f'SELECT release_id FROM `{D}.release_pointer` WHERE dataset_id={q(pointer)}')
    if len(owners)>1:raise ValueError('Multiple PISA release owners')
    previous=owners[0].release_id if owners else None
    source=dict(source,publication_status='published_source_records')
    receipt=dict(release_id=rid,build_id=rid,loader_git_sha=a.validator_sha,completion_validator_git_sha=a.validator_sha,original_parser_git_sha=PARSER_SHA,original_processing_build_id=RUN,existing_load_job_id=JOB,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=started,completed_at=stamp(),source_group='pisa',accepted_source_records=613745,native_cases=613744,metadata_records=1,received_sources=1,accepted_sources=1,unavailable_sources=0,processing_status='validated_available_source_bundle',publication_status='published',sources=[source],stage_source_release_id=RUN,source_stage_generation=STAGE_GENERATION,source_stage_sha256=STAGE_SHA,catalog_generation=CATALOG_GENERATION,catalog_sha256=CATALOG_SHA,validation=dict(existing_load_identity='passed',warehouse_full_native_count='passed',unique_source_member_row_keys='passed',native_metadata_case_count='passed',stage_generation_and_sha256='passed',catalog_generation_and_sha256='passed',max_bad_records=0,semantic_metric_normalization='not_claimed'),publication_pointer=D+'.release_pointer['+pointer+']',destinations=[D+'.current_report_source_records',D+'.current_report_source_catalog'],website_destinations=[],public_microdata_writes=0,coverage='One complete original PISA2022 student questionnaire file; report-specific transformations remain separate.')
    receipt_bytes=(dump(receipt)+'\n').encode();prepared=bucket.blob(prefix+'/prepared-receipt.json')
    if prepared.exists():
        receipt_bytes=prepared.download_as_bytes();old=json.loads(receipt_bytes)
        if any(old.get(k)!=receipt.get(k) for k in ('release_id','loader_git_sha','original_parser_git_sha','existing_load_job_id','accepted_source_records','source_stage_sha256')):raise ValueError('Prepared continuation identity changed')
    else:upload(bucket,prepared.name,receipt_bytes)
    digest=hashlib.sha256(receipt_bytes).hexdigest();uri='gs://'+BUCKET+'/'+prefix+'/completed.json'
    # Same checked transaction helper as the original worker; confirmation handles uncertain commits.
    def committed():
        rows=query(f'SELECT loader_git_sha,receipt_sha256 FROM `{D}.ingestion_runs` WHERE release_id={q(rid)}')
        if rows and (len(rows)!=1 or rows[0].loader_git_sha!=a.validator_sha or rows[0].receipt_sha256!=digest):raise ValueError('Conflicting committed continuation')
        return bool(rows)
    owner_check=f'(SELECT COUNT(*) FROM `{D}.release_pointer` WHERE dataset_id={q(pointer)})=0' if previous is None else f'(SELECT COUNT(*) FROM `{D}.release_pointer` WHERE dataset_id={q(pointer)} AND release_id={q(previous)})=1'
    sql=f'''BEGIN TRANSACTION;
      ASSERT (SELECT COUNT(*) FROM `{D}.report_source_records` WHERE release_id={q(rid)})=0 AS 'release already committed';
      ASSERT {owner_check} AS 'PISA pointer changed during completion';
      INSERT INTO `{D}.report_source_records` SELECT * REPLACE({q(rid)} AS release_id) FROM `{rt}`;
      INSERT INTO `{D}.report_source_catalog` SELECT * REPLACE({q(rid)} AS release_id) FROM `{ct}`;
      DELETE FROM `{D}.release_pointer` WHERE dataset_id={q(pointer)};
      INSERT INTO `{D}.release_pointer` VALUES({q(pointer)},{q(rid)},CURRENT_TIMESTAMP());
      INSERT INTO `{D}.ingestion_runs` VALUES({q(rid)},{q(a.validator_sha)},CURRENT_TIMESTAMP(),{q(uri)},{q(digest)},{q(dump(dict(source_records=613745,sources=1)))});
      COMMIT TRANSACTION;'''
    transaction_with_retry(lambda:query(sql),committed)
    upload(bucket,prefix+'/completed.json',receipt_bytes)
    print(dump(dict(event='published',release_id=rid,receipt_uri=uri,sha256=digest,source_records=613745)),flush=True)
    # Original load/stage remain preserved for audit; only this worker's tiny catalog table can be retired.
    bq.delete_table(ct)

if __name__=='__main__':main()
