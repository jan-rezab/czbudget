"""Pure identity checks; no network calls and no replacement respondent load."""
RUN='83c540f4-1b3a-408b-9f72-a2dc14054d02'
JOB='e04e63ee-493d-48e3-9010-2381875af683'
SOURCE='oecd_pisa2022_1'
PARSER_SHA='bb09ff1ba356efa6e45906f4fbc68da177acb175'
STAGE='gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/'+RUN+'/staging/1790472465967860737/oecd_pisa2022_1.jsonl.gz'
STAGE_GENERATION='1790472497895342'
STAGE_SHA='a8eb3c6803d2b8c5c26e244451902c37713ea281dc11654a73c7bfdfbf4075da'
STAGE_BYTES=3152627132
LOAD_INPUT_BYTES=15647027956  # BigQuery reports expanded input bytes, not gzip bytes.
CATALOG='gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/'+RUN+'/staging/1790472501449015320/catalog.jsonl'
CATALOG_GENERATION='1790472501519716'
CATALOG_SHA='4d66154d808e7cfcdd91b8cd7a0679fee304de44d28fd7a9737eda0ed0af47a0'
DESTINATION=dict(projectId='czbudget-janrezab',datasetId='undp_human_development',tableId='stage_report_records_'+RUN.replace('-','_'))
SCHEMA=[('release_id','STRING'),('source_id','STRING'),('member','STRING'),('row_number','INTEGER'),('record_json','STRING'),('source_url','STRING'),('source_sha256','STRING')]

def validate_job_binding(job):
 ref=job['jobReference']
 if (ref['jobId'],ref['projectId'],ref['location'])!=(JOB,'czbudget-janrezab','EU'):raise ValueError('Wrong existing load identity')
 config=job['configuration'];load=config['load']
 if config.get('jobType')!='LOAD' or load['destinationTable']!=DESTINATION:raise ValueError('Wrong load destination')
 if load['sourceUris']!=[STAGE]:raise ValueError('Wrong immutable stage URI')
 if load.get('writeDisposition')!='WRITE_TRUNCATE' or int(load.get('maxBadRecords',0))!=0:raise ValueError('Unsafe load disposition or rejected-row allowance')
 if load.get('sourceFormat')!='NEWLINE_DELIMITED_JSON':raise ValueError('Wrong source format')
 fields=load['schema']['fields']
 if [(f['name'],f['type']) for f in fields]!=SCHEMA or any(f.get('mode','NULLABLE')!='NULLABLE' for f in fields):raise ValueError('Native record schema changed')
 return job['status']['state']

def validate_successful_load(job):
 if validate_job_binding(job)!='DONE':raise ValueError('Existing warehouse load not terminal')
 if job['status'].get('errorResult') or job['status'].get('errors'):raise ValueError('Existing warehouse load failed')
 stats=job['statistics']['load']
 if int(stats['outputRows'])!=613745 or int(stats.get('badRecords',0))!=0:raise ValueError('Native source count failed')
 if int(stats['inputFiles'])!=1 or int(stats['inputFileBytes'])!=LOAD_INPUT_BYTES:raise ValueError('Source stage input size failed')
 return 613745

def validate_stage_metadata(checkpoint, generation, size, digest):
 expected=(SOURCE,STAGE,STAGE_GENERATION,STAGE_SHA,613745,PARSER_SHA)
 actual=tuple(checkpoint[k] for k in ('source_id','stage_uri','stage_generation','stage_sha256','accepted_records','parser_git_sha'))
 if actual!=expected or str(generation)!=STAGE_GENERATION or int(size)!=STAGE_BYTES or digest!=STAGE_SHA:raise ValueError('Processed checkpoint or exact stage changed')
