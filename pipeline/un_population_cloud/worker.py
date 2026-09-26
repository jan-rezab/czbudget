#!/usr/bin/env python3
"""Publish held WPP source rows and clearly labelled serving extracts in EU BQ."""
import argparse
from collections import defaultdict
import csv
from decimal import Decimal
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'transforms'))
from run_un_comtrade_warehouse import Cloud, bq_query, now_iso, run

PROJECT = 'czbudget-janrezab'
DATASET = 'un_population'
ARCHIVE_URI = 'gs://czbudget-janrezab-data-layers/workspace-backups/2026-09-12-disk-review/payloads/source-cache-other.tar.gz'
ARCHIVE_GENERATION = '1789235645114224'
ARCHIVE_SHA = '5941a0ac0e2e26bb5262b1a1a1aa8e0122345a192cc5395bda7460a3aa78c8e4'
MEMBER = 'data/source_cache/demography/WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz'
MEMBER_SHA = '31804a296b663716236cd26c46415271cc9386fb3b2be56aff6467ad32283dc8'
SOURCE_URL = 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz'
METRICS = {
 'population_thousands': ('thousand persons', 'persons', Decimal(1000)),
 'median_age': ('years', 'years', Decimal(1)),
 'births_thousands': ('thousand births', 'births', Decimal(1000)),
 'total_fertility_rate': ('children per woman', 'children per woman', Decimal(1)),
 'natural_change_thousands': ('thousand persons', 'persons', Decimal(1000)),
 'natural_change_per_1000': ('per 1000 persons', 'per 1000 persons', Decimal(1)),
 'net_migration_thousands': ('thousand persons', 'persons', Decimal(1000)),
 'net_migration_per_1000': ('per 1000 persons', 'per 1000 persons', Decimal(1)),
 'life_expectancy': ('years', 'years', Decimal(1)),
}


def sha_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def age_row(source, release_id):
    year = int(source['Time'])
    male, female, total = (Decimal(source[x]) for x in ['PopMale','PopFemale','PopTotal'])
    if not (2024 <= year <= 2100) or min(male, female, total) < 0:
        raise ValueError('Invalid WPP year or negative population')
    # WPP values are independently reported to 0.001 thousand persons.
    if abs(male + female - total) > Decimal('0.002'):
        raise ValueError('Male/female populations do not reconcile at reported precision')
    start, span = int(source['AgeGrpStart']), int(source['AgeGrpSpan'])
    if not 0 <= start <= 100:
        raise ValueError('Unexpected single-age group')
    return dict(release_id=release_id, location_id=int(source['LocID']),
                location_name=source['Location'], location_type=source.get('LocTypeName'),
                country_code=source.get('ISO3_code') or None, year=year,
                variant_id=int(source['VarID']), variant=source['Variant'],
                reference_date='1 July', observation_kind='projection_medium',
                age_start=start, age_end=None if '+' in source['AgeGrp'] or span < 0 else start+span-1,
                age_label=source['AgeGrp'], source_unit='thousand persons', unit='persons',
                source_male=source['PopMale'], source_female=source['PopFemale'], source_total=source['PopTotal'],
                male=str(male*1000), female=str(female*1000), total=str(total*1000),
                source_record_json=json.dumps(source, ensure_ascii=False, separators=(',',':')),
                source_url=SOURCE_URL, source_sha256=MEMBER_SHA)


def indicator_rows(payload, release_id):
    url=payload['sources']['un_wpp']['download_url']
    for country, data in payload['countries'].items():
        years=[int(x['year']) for x in data['wpp']]
        if sorted(years) != list(range(1950,2101)):
            raise ValueError(f'Incomplete or duplicate WPP indicator years: {country}')
        for item in data['wpp']:
            year=int(item['year'])
            expected='estimate' if year <= 2023 else 'projection_medium'
            if item['kind'] != expected:
                raise ValueError('Estimate/projection boundary mismatch')
            for metric,(source_unit,unit,factor) in METRICS.items():
                value=item[metric]
                if value is None:
                    continue
                yield dict(release_id=release_id,country_code=country,year=year,metric=metric,
                           observation_kind=expected,source_value=str(value),source_unit=source_unit,
                           value=str(Decimal(str(value))*factor),unit=unit,source_url=url,
                           value_origin='existing_serving_extract',
                           precision_note='Exact existing serving value retained; upstream CSV precision is unavailable in this extract.')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--loader-sha',required=True)
    parser.add_argument('--extract-sha',required=True)
    args=parser.parse_args()
    release=os.environ['BUILD_ID']
    token=release.replace('-','_')
    prefix=f'gs://czbudget-janrezab-data-layers/processing-runs/un-population/{release}'
    cloud=Cloud()
    started=now_iso()
    files=[]
    counts=defaultdict(int)
    with tempfile.TemporaryDirectory() as directory:
        temp=Path(directory)
        archive=temp/'archive.tar.gz'
        run(['gcloud','storage','cp',f'{ARCHIVE_URI}#{ARCHIVE_GENERATION}',str(archive)])
        if sha_file(archive) != ARCHIVE_SHA:
            raise RuntimeError('Archived source bundle hash mismatch')
        source=temp/'wpp.csv.gz'
        with tarfile.open(archive,'r:gz') as tar:
            member=tar.getmember(MEMBER)
            if not member.isfile():
                raise RuntimeError('WPP archive member is not a regular file')
            with tar.extractfile(member) as inp,source.open('wb') as out:
                import shutil
                shutil.copyfileobj(inp,out)
        if sha_file(source) != MEMBER_SHA:
            raise RuntimeError('WPP raw member hash mismatch')
        files.append(cloud.put(f'{prefix}/raw/{source.name}',source.read_bytes()))
        extract=Path('europe-demographic-pressure.v1.json')
        if sha_file(extract) != args.extract_sha:
            raise RuntimeError('Held serving extract hash mismatch')
        files.append(cloud.put(f'{prefix}/raw/{extract.name}',extract.read_bytes()))
        bq_query((Path(__file__).parent/'schema.sql').read_text())
        age_uris=[]
        chunk_rows=0
        index=0
        output=temp/'age.jsonl.gz'
        handle=gzip.open(output,'wt',encoding='utf-8',compresslevel=1)
        total_control=Decimal(0)
        with gzip.open(source,'rt',encoding='utf-8-sig') as inp:
            reader=csv.DictReader(inp)
            for raw in reader:
                row=age_row(raw,release)
                handle.write(json.dumps(row,ensure_ascii=False,separators=(',',':'))+'\n')
                counts['age_rows']+=1
                counts[(row['location_id'],row['year'])]+=1
                total_control+=Decimal(row['total'])
                chunk_rows+=1
                if chunk_rows==250000:
                    handle.close()
                    receipt=cloud.put(f'{prefix}/staging/age-{index:03}.jsonl.gz',output.read_bytes())
                    receipt['rows']=chunk_rows; files.append(receipt); age_uris.append(receipt['uri'])
                    index+=1;chunk_rows=0
                    handle=gzip.open(output,'wt',encoding='utf-8',compresslevel=1)
                    print(json.dumps(dict(event='wpp_normalize_progress',rows=counts['age_rows'])),flush=True)
        handle.close()
        if chunk_rows:
            receipt=cloud.put(f'{prefix}/staging/age-{index:03}.jsonl.gz',output.read_bytes())
            receipt['rows']=chunk_rows; files.append(receipt); age_uris.append(receipt['uri'])
        if not counts['age_rows'] or any(n != 101 for key,n in counts.items() if isinstance(key,tuple)):
            raise RuntimeError('Each location/year must contain exactly 101 single-age groups')
        payload=json.loads(extract.read_text(),parse_float=Decimal)
        counts['serving_source_records']=sum(len(c['wpp']) for c in payload['countries'].values())
        metricfile=temp/'metrics.jsonl.gz'
        with gzip.open(metricfile,'wt',encoding='utf-8',compresslevel=1) as out:
            for row in indicator_rows(payload,release):
                out.write(json.dumps(row,ensure_ascii=False,separators=(',',':'))+'\n')
                counts['metric_rows']+=1
        receipt=cloud.put(f'{prefix}/staging/metrics.jsonl.gz',metricfile.read_bytes())
        receipt['rows']=counts['metric_rows'];files.append(receipt)
        stages={'population_age_sex':f'_age_{token}','demographic_indicators':f'_metrics_{token}'}
        for target,stage in stages.items():
            bq_query(f'CREATE TABLE `czbudget-janrezab.{DATASET}.{stage}` LIKE `czbudget-janrezab.{DATASET}.{target}`; ALTER TABLE `czbudget-janrezab.{DATASET}.{stage}` SET OPTIONS(expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(),INTERVAL 2 DAY));')
            uris=age_uris if target=='population_age_sex' else [receipt['uri']]
            run(['bq','load',f'--project_id={PROJECT}','--location=EU','--source_format=NEWLINE_DELIMITED_JSON',f'{DATASET}.{stage}',','.join(uris)])
        age=f'`{PROJECT}.{DATASET}.{stages["population_age_sex"]}`'
        metric=f'`{PROJECT}.{DATASET}.{stages["demographic_indicators"]}`'
        result=dict(schema_version='1.0.0',release_id=release,build_id=release,loader_git_sha=args.loader_sha,
                    region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',
                    source_archive=dict(uri=ARCHIVE_URI,generation=ARCHIVE_GENERATION,sha256=ARCHIVE_SHA),
                    source_member=dict(path=MEMBER,sha256=MEMBER_SHA,url=SOURCE_URL),
                    serving_extract=dict(path=extract.name,sha256=args.extract_sha,origin='existing_serving_extract'),
                    started_at=started,received_rows=counts['age_rows']+counts['serving_source_records'],
                    received_source_csv_rows=counts['age_rows'],
                    received_serving_country_year_records=counts['serving_source_records'],
                    normalized_observation_rows=counts['age_rows']+counts['metric_rows'],
                    accepted_rows=counts['age_rows']+counts['metric_rows'],rejected_rows=0,deduplicated_rows=0,
                    population_age_sex_rows=counts['age_rows'],demographic_indicator_rows=counts['metric_rows'],
                    population_control_sum_persons=str(total_control),
                    control_sum_note='Validation checksum across all location/age/year cells, including regional aggregates; not a world population observation.',
                    estimate_projection_boundary='1950–2023 estimates; 2024–2100 medium-variant projections',
                    validation=['archive_sha256','member_sha256','extract_sha256','sex_reconciliation_at_source_precision',
                                'unique_natural_keys','complete_location_year_age_grid','row_counts','normalized_control_sum'],
                    processing_status='validated',publication_status='published',
                    publication_pointer=f'{PROJECT}.{DATASET}.release_pointer',
                    website_destinations=['country-demography','deep-dives/europe-demographic-pressure'],
                    website_runtime_status='BQ views ready; existing pages still read their serving JSON',files=files,
                    completed_at=now_iso())
        receipt_bytes=(json.dumps(result,indent=2)+'\n').encode()
        receipt_uri=f'{prefix}/completed.json'
        receipt_sha=hashlib.sha256(receipt_bytes).hexdigest()
        bq_query(f'''
ASSERT (SELECT COUNT(*) FROM {age})={counts['age_rows']} AS 'All age rows staged';
ASSERT (SELECT COUNT(*) FROM {metric})={counts['metric_rows']} AS 'All held indicator values staged';
ASSERT NOT EXISTS(SELECT 1 FROM {age} GROUP BY location_id,variant_id,year,age_start HAVING COUNT(*)!=1) AS 'Unique population natural keys';
ASSERT NOT EXISTS(SELECT 1 FROM {metric} GROUP BY country_code,year,metric HAVING COUNT(*)!=1) AS 'Unique indicator natural keys';
ASSERT NOT EXISTS(SELECT 1 FROM {age} GROUP BY location_id HAVING COUNT(DISTINCT year)!=77 OR MIN(year)!=2024 OR MAX(year)!=2100) AS 'Complete projection years';
ASSERT NOT EXISTS(SELECT 1 FROM {age} GROUP BY location_id,year HAVING COUNT(DISTINCT age_start)!=101 OR MIN(age_start)!=0 OR MAX(age_start)!=100) AS 'Complete age grid';
ASSERT (SELECT SUM(total) FROM {age})=NUMERIC '{total_control}' AS 'Normalized control sum';
BEGIN TRANSACTION;
DELETE FROM `{PROJECT}.{DATASET}.population_age_sex` WHERE release_id='{release}';
INSERT INTO `{PROJECT}.{DATASET}.population_age_sex` SELECT * FROM {age};
DELETE FROM `{PROJECT}.{DATASET}.demographic_indicators` WHERE release_id='{release}';
INSERT INTO `{PROJECT}.{DATASET}.demographic_indicators` SELECT * FROM {metric};
DELETE FROM `{PROJECT}.{DATASET}.ingestion_runs` WHERE release_id='{release}';
INSERT INTO `{PROJECT}.{DATASET}.ingestion_runs` VALUES('{release}','{args.loader_sha}',CURRENT_TIMESTAMP(),{counts['age_rows']},{counts['metric_rows']},'{receipt_uri}','{receipt_sha}');
DELETE FROM `{PROJECT}.{DATASET}.release_pointer` WHERE dataset_id='un_wpp_2024';
INSERT INTO `{PROJECT}.{DATASET}.release_pointer` VALUES('un_wpp_2024','{release}',CURRENT_TIMESTAMP());
COMMIT TRANSACTION;
''')
        completed=cloud.put(receipt_uri,receipt_bytes)
        for stage in stages.values():
            run(['bq','rm',f'--project_id={PROJECT}','--force','--table',f'{DATASET}.{stage}'])
    print(json.dumps(dict(event='un_population_completed',receipt=completed,**result),indent=2),flush=True)


if __name__=='__main__':
    main()
