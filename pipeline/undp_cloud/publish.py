"""Verify cloud-pinned UNDP sources, stage, validate and publish one atomic bundle."""
import argparse
from collections import Counter, defaultdict
import csv
from decimal import Decimal, InvalidOperation, getcontext
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile
import time
import unicodedata
import urllib.request
from google.cloud import bigquery, storage
import openpyxl
import pandas as pd
import pyreadstat
from acquire import BUCKET, PROJECT, upload

getcontext().prec=80
DATASET='undp_human_development'
TABLES=['metric_observations','source_records','workbook_cells','table_observations',
        'survey_respondents','survey_answers','variable_metadata']
MISSING={'','..','...','NA','N/A','NaN','nan','None','—','–','.'}


def stamp():return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def dump(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'),default=str)
def text(x):
    if x is None:return None
    if isinstance(x,float) and math.isnan(x):return None
    if isinstance(x,(pd.Timestamp,)):return x.isoformat()
    return str(x)
def number(x):
    value=text(x)
    if value is None or value.strip() in MISSING:return None
    try:
        d=Decimal(value.strip().replace(',',''))
        if not d.is_finite():return None
        if abs(d)>=Decimal('5.78960446186580977117e38') or d.as_tuple().exponent < -38:
            raise ValueError('Source numeric value outside lossless BIGNUMERIC range')
        return str(d)
    except InvalidOperation:return None

def canonical(name):
    return ' '.join(unicodedata.normalize('NFKC',str(name)).strip().split()).casefold()

def code_unit(metric,label):
    match=re.search(r'\(([^()]*)\)',label or '')
    if metric.endswith('rank') or 'rankdiff' in metric or metric=='gdi_group':return 'rank' if metric!='gdi_group' else 'group'
    if match:return 'index' if match.group(1).lower()=='value' else match.group(1)
    if metric in {'hdi','ihdi','gdi','gii','phdi'} or metric.startswith('hdi_'):return 'index'
    return None


def main():
    p=argparse.ArgumentParser();p.add_argument('--loader-sha',required=True)
    p.add_argument('--raw-manifest',required=True);p.add_argument('--manifest-generation',required=True)
    p.add_argument('--manifest-sha',required=True);args=p.parse_args()
    release=os.environ['BUILD_ID'];token=release.replace('-','_');prefix=f'processing-runs/undp/{release}'
    store=storage.Client(project=PROJECT);bucket=store.bucket(BUCKET)
    bq=bigquery.Client(project=PROJECT,location='EU');started=stamp()
    def query(sql):return list(bq.query(sql,location='EU').result(timeout=600))
    def pinned(uri,generation,sha):
        name=uri.split('/',3)[3];blob=bucket.blob(name,generation=int(generation))
        data=blob.download_as_bytes(checksum='auto')
        if hashlib.sha256(data).hexdigest()!=sha:raise ValueError(f'Source SHA mismatch: {name}')
        return data
    manifest=json.loads(pinned(args.raw_manifest,args.manifest_generation,args.manifest_sha))
    if len(manifest['sources'])!=10:raise ValueError('Expected all ten acquired UNDP sources')
    with tempfile.TemporaryDirectory() as directory:
        temp=Path(directory);paths={};sources={x['id']:x for x in manifest['sources']}
        for source in sources.values():
            path=temp/f"{source['id']}.{source['kind']}"
            path.write_bytes(pinned(source['uri'],source['generation'],source['sha256']));paths[source['id']]=path
        # The all-tables HDR workbook omits Table 6. Preserve its source-era MPI
        # workbook separately from the newer October 2025 update.
        mpi=dict(id='mpi2024_tables',kind='xlsx',vintage='MPI2024_report_source_edition',
                 url='https://hdr.undp.org/sites/default/files/publications/additional-files/2024-10/2024_gMPI_Table1and2.xlsx')
        req=urllib.request.Request(mpi['url'],headers={'User-Agent':'PublicSpendingData/1.0'})
        with urllib.request.urlopen(req,timeout=120) as response:data=response.read(5_000_001)
        if len(data)>5_000_000:raise ValueError('MPI workbook exceeds bound')
        mpi.update(upload(bucket,f"{prefix}/raw/mpi2024_tables.xlsx",data));sources[mpi['id']]=mpi
        paths[mpi['id']]=temp/'mpi2024_tables.xlsx';paths[mpi['id']].write_bytes(data)
        handles={t:gzip.open(temp/f'{t}.jsonl.gz','wt',encoding='utf-8',compresslevel=1) for t in TABLES}
        counts=Counter();totals=defaultdict(Decimal);coverage={};countries={};labels={};meta_units={}
        def write(table,row):
            row['release_id']=release;handles[table].write(dump(row)+'\n');counts[table]+=1
            if row.get('value') is not None:totals[table]+=Decimal(row['value'])
        wb=openpyxl.load_workbook(paths['hdr25_metadata'],data_only=True)
        for row in wb['codebook'].iter_rows(min_row=2,values_only=True):
            label,code,period=row
            if code:
                labels[code]=label;meta_units[code]=code_unit(code,label)
                write('variable_metadata',dict(source_id='hdr25_timeseries',variable=code,label=label,
                      unit=meta_units[code],metadata_json=dump({'time_series':period})))
        wb.close()
        source=sources['hdr25_timeseries']
        raw=list(csv.DictReader(io.StringIO(paths[source['id']].read_bytes().decode(source['encoding']),newline='')))
        if len(raw)!=206:raise ValueError('HDR2025 source-geography count changed')
        columns=[c for c in raw[0] if re.fullmatch(r'.+_\d{4}',c)]
        seen=set();metric_nonmissing=Counter();row_codes=set()
        for index,row in enumerate(raw,1):
            code=row['iso3'];name=row['country'];kind='aggregate' if code.startswith('ZZ') else 'country_or_area'
            if code in row_codes:raise ValueError('Duplicate HDR geography')
            row_codes.add(code);countries[canonical(name)]=(code,kind)
            write('source_records',dict(source_id=source['id'],row_number=index,country_code=code,
                  country_name=name,source_record_json=dump(row),source_url=source['url'],source_sha256=source['sha256']))
            for column in columns:
                metric,year=column.rsplit('_',1);value=number(row[column]);year=int(year)
                if (code,metric,year) in seen:raise ValueError('Duplicate HDR metric key')
                seen.add((code,metric,year))
                if row[column].strip() not in MISSING and value is None:raise ValueError(f'Unrecognized metric: {column}')
                if value is not None:
                    metric_nonmissing[metric]+=1
                    if metric in {'hdi','ihdi','gii','phdi'} and not Decimal(0)<=Decimal(value)<=Decimal(1):raise ValueError('Invalid index bounds')
                write('metric_observations',dict(source_id=source['id'],source_vintage=source['vintage'],
                      country_code=code,country_name=name,geography_kind=kind,year=year,metric=metric,
                      sex='female' if metric.endswith('_f') else 'male' if metric.endswith('_m') else 'both_or_not_applicable',
                      source_value=row[column],value=value,unit=meta_units.get(metric),source_column=column,
                      source_url=source['url'],source_sha256=source['sha256']))
        if any(metric_nonmissing[x]==0 for x in ['hdi','ihdi','gdi','gii','phdi','eys','mys','gnipc']):raise ValueError('Required HD metrics missing')
        coverage['hdr25']=dict(source_geographies=len(raw),country_or_area_rows=sum(not x.startswith('ZZ') for x in row_codes),
                              first_year=1990,last_year=2023,metric_cells=len(raw)*len(columns),
                              nonmissing_by_metric=dict(metric_nonmissing))
        # All workbook cells remain queryable, including labels, footnotes,
        # formulas and noncountry rows. Observations carry literal header periods.
        alias={'korea (republic of)':'republic of korea','russian federation':'russia',
               'türkiye':'turkey','viet nam':'vietnam','iran (islamic republic of)':'iran',
               'moldova (republic of)':'moldova','tanzania (united republic of)':'tanzania',
               'bolivia (plurinational state of)':'bolivia','venezuela (bolivarian republic of)':'venezuela'}
        def lookup(name):
            key=canonical(name)
            if key in countries:return countries[key]
            for a,b in alias.items():
                if key==a and canonical(b) in countries:return countries[canonical(b)]
                if key==b and canonical(a) in countries:return countries[canonical(a)]
            return None,'source_named_geography'
        for sid,source in sources.items():
            if source['kind']!='xlsx':continue
            book=openpyxl.load_workbook(paths[sid],data_only=True);formula=openpyxl.load_workbook(paths[sid],data_only=False)
            source_coverage={}
            for sheet in book:
                numeric_country_rows=0;country_col=2 if sid=='hdr25_tables' else 1
                data_start=None
                if sid=='hdr25_tables' or sid.startswith('mpi'):
                    for row in sheet.iter_rows():
                        name=row[country_col-1].value
                        if name and (canonical(name) in countries or canonical(name) in alias):
                            data_start=row[0].row;break
                headers={}
                if data_start:
                    merged={}
                    for area in formula[sheet.title].merged_cells.ranges:
                        if area.min_row<data_start:
                            anchor=sheet.cell(area.min_row,area.min_col).value
                            for r in range(area.min_row,min(area.max_row+1,data_start)):
                                for c in range(area.min_col,area.max_col+1):merged[r,c]=anchor
                    for c in range(1,sheet.max_column+1):
                        parts=[]
                        for r in range(2,data_start):
                            item=sheet.cell(r,c).value or merged.get((r,c))
                            if item is not None:
                                item=str(item).strip()
                                if len(item)>1 and item.lower() not in {'very high human development','high human development','medium human development','low human development'} and item not in parts:parts.append(item)
                        headers[c]=parts
                for cells in sheet.iter_rows():
                    row=cells[0].row;name=cells[country_col-1].value if len(cells)>=country_col else None
                    code,kind=lookup(name) if name is not None else (None,'metadata')
                    is_data=bool(data_start and row>=data_start and name and
                                 (code or any(number(c.value) is not None for c in cells[country_col+1:])))
                    # Exclude prose/notes and column headers even if they contain years.
                    is_data=is_data and (code is not None or len(str(name))<90) and not str(name).lower().startswith(('note','definition','column','source'))
                    if is_data:numeric_country_rows+=1
                    for cell in cells:
                        f=formula[sheet.title].cell(row,cell.column);value=text(cell.value)
                        if value is None and f.value is None:continue
                        num=number(cell.value);parts=headers.get(cell.column,[])
                        write('workbook_cells',dict(source_id=sid,source_vintage=source['vintage'],sheet=sheet.title,
                              row_number=row,column_number=cell.column,cell_address=cell.coordinate,
                              country_code=code if is_data else None,country_name=str(name) if is_data else None,
                              row_kind=kind if is_data else 'metadata_or_note',source_value=value,
                              source_formula=str(f.value) if f.data_type=='f' else None,value=num,
                              column_context=dump(parts),number_format=cell.number_format,
                              source_url=source['url'],source_sha256=source['sha256']))
                        if is_data and cell.column>country_col and num is not None:
                            period=next((x for x in reversed(parts) if re.fullmatch(r'\d{4}(?:[–/-]\d{4})?',x.strip())),None)
                            if sid.startswith('mpi'):
                                # Survey year strings are in B for Table 1, C for Table 2.
                                period=str(sheet.cell(row,2 if 'Table1' in sheet.title else 3).value)
                            unit=next((x.strip('()') for x in parts if x.startswith('(')),None)
                            write('table_observations',dict(source_id=sid,source_vintage=source['vintage'],sheet=sheet.title,
                                  row_number=row,column_number=cell.column,country_code=code,country_name=str(name),
                                  geography_kind=kind,metric=' | '.join(parts) or f'column_{cell.column}',
                                  period=period,sex=next((x.lower() for x in parts if x in {'Female','Male'}),None),
                                  unit=unit,source_value=value,value=num,
                                  source_notes=dump([text(x.value) for x in cells]),source_url=source['url'],source_sha256=source['sha256']))
                source_coverage[sheet.title]={'source_rows':sheet.max_row,'source_columns':sheet.max_column,'data_rows':numeric_country_rows}
            coverage[sid]=source_coverage;book.close();formula.close()
        source=sources['ai2025_survey']
        frame,meta=pyreadstat.read_dta(str(paths[source['id']]),apply_value_formats=False,user_missing=True,disable_datetime_conversion=True)
        if len(frame)!=21214:raise ValueError('AI survey respondent count changed')
        required=['SurveyId','Country','Weight_none_resp1']
        if any(x not in frame for x in required):raise ValueError('Missing survey design columns')
        survey_ids=set();survey_countries=Counter();weight_total=Decimal(0)
        for variable in meta.column_names:
            write('variable_metadata',dict(source_id=source['id'],variable=variable,label=meta.column_names_to_labels.get(variable),
                  unit='survey response or design variable',metadata_json=dump({
                  'value_labels':meta.variable_value_labels.get(variable,{}),
                  'original_type':meta.original_variable_types.get(variable),
                  'missing_user_values':meta.missing_user_values.get(variable,[]),
                  'stata_readstat_type':meta.readstat_variable_types.get(variable)})))
        for index,values in enumerate(frame.itertuples(index=False,name=None),1):
            record=dict(zip(meta.column_names,values));country_value=record['Country'];country=meta.variable_value_labels['Country'].get(country_value,str(country_value))
            respondent=str(record['SurveyId']);key=(country,respondent)
            if key in survey_ids:raise ValueError('Duplicate survey country/respondent ID')
            survey_ids.add(key);survey_countries[country]+=1
            respondent_id=f'{country}:{respondent}'
            weight=number(record['Weight_none_resp1'])
            if weight is not None and Decimal(weight)<0:raise ValueError('Negative survey weight')
            if weight is not None:weight_total+=Decimal(weight)
            write('survey_respondents',dict(source_id=source['id'],respondent_id=respondent_id,country=country,
                  survey_weight=weight,source_record_json=dump({k:text(v) for k,v in record.items()}),
                  source_url=source['url'],source_sha256=source['sha256']))
            for variable,value in record.items():
                missing=text(value) is None;numeric=number(value)
                label=meta.variable_value_labels.get(variable,{}).get(value)
                extended=str(value) in meta.missing_user_values.get(variable,[])
                write('survey_answers',dict(source_id=source['id'],respondent_id=respondent_id,country=country,
                      survey_weight=weight,variable=variable,source_value=text(value),value=None if extended else numeric,
                      value_label=label,missing_kind='system_missing' if missing else 'stata_extended_missing' if extended else
                      'explicit_nonresponse' if label and re.search(r"prefer not|don't know|dont know|refus",label,re.I) else None))
        if len(survey_countries)!=21:raise ValueError('Expected 21 AI survey countries')
        coverage['ai2025']=dict(respondents=len(frame),variables=len(meta.column_names),countries=dict(survey_countries),
                               survey_weight_total=str(weight_total),czechia_in_sample=False)
        for h in handles.values():h.close()
        if counts['metric_observations']!=len(raw)*len(columns):raise ValueError('Missing metric cells')
        if counts['survey_answers']!=len(frame)*len(meta.column_names):raise ValueError('Missing survey cells')
        query(Path('pipeline/undp_cloud/schema.sql').read_text().split('\n',1)[1])
        files=[];stages={};controls=[]
        for table in TABLES:
            data=(temp/f'{table}.jsonl.gz').read_bytes()
            saved=upload(bucket,f'{prefix}/staging/{table}.jsonl.gz',data);saved['rows']=counts[table];files.append(saved)
            stage=f'{PROJECT}.{DATASET}._{table}_{token}';target=f'{PROJECT}.{DATASET}.{table}';stages[table]=stage
            query(f'CREATE TABLE `{stage}` LIKE `{target}`; ALTER TABLE `{stage}` SET OPTIONS(expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(),INTERVAL 2 DAY));')
            config=bigquery.LoadJobConfig(source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,write_disposition='WRITE_TRUNCATE',max_bad_records=0)
            job=bq.load_table_from_uri(saved['uri'],stage,job_config=config,location='EU');job.result(timeout=600)
            controls.append(f"ASSERT (SELECT COUNT(*) FROM `{stage}`)={counts[table]} AS '{table} complete';")
            if table in totals:controls.append(f"ASSERT (SELECT SUM(value) FROM `{stage}`)=BIGNUMERIC '{totals[table]}' AS '{table} exact numeric checksum';")
            print(dump({'event':'staged','table':table,'rows':counts[table]}),flush=True)
        unique={'metric_observations':'country_code,year,metric,source_id','source_records':'source_id,row_number',
                'workbook_cells':'source_id,sheet,row_number,column_number','table_observations':'source_id,sheet,row_number,column_number',
                'survey_respondents':'respondent_id','survey_answers':'respondent_id,variable','variable_metadata':'source_id,variable'}
        for table,key in unique.items():controls.append(f"ASSERT NOT EXISTS(SELECT 1 FROM `{stages[table]}` GROUP BY {key} HAVING COUNT(*)>1) AS '{table} unique';")
        controls.append(f"ASSERT (SELECT SUM(survey_weight) FROM `{stages['survey_respondents']}`)=BIGNUMERIC '{weight_total}' AS 'survey weights retained';")
        query('\n'.join(controls))
        summary=dict(schema_version='1.0.0',release_id=release,build_id=release,loader_git_sha=args.loader_sha,
                     region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',
                     raw_manifest=dict(uri=args.raw_manifest,generation=args.manifest_generation,sha256=args.manifest_sha),
                     raw_acquisition_git_sha='bd6cdd02486f0bcad507c8d3d463dae4ff696718',raw_acquisition_recorded_ref=manifest['loader_git_sha'],
                     raw_sources=list(sources.values()),started_at=started,completed_at=stamp(),
                     received_source_rows={'hdr_csv':len(raw),'ai_survey':len(frame),'workbooks':{k:v for k,v in coverage.items() if k not in {'hdr25','ai2025'}}},
                     accepted_rows=dict(counts),rejected_rows=0,deduplicated_rows=0,
                     normalized_checksum_totals={k:str(v) for k,v in totals.items()},
                     checksum_note='Checksums across heterogeneous metrics are validation controls, not economic observations.',
                     coverage=coverage,validation=['generation_and_sha256','source_counts','all_metric_and_survey_cells','unique_natural_keys',
                     'index_bounds','exact_numeric_control_sums','positive_survey_weights','all_21_survey_countries'],
                     processing_status='validated',publication_status='published',
                     publication_pointer=f'{PROJECT}.{DATASET}.release_pointer',
                     website_destinations=['Future country comparisons and human-development reports; no current website consumer'],files=files)
        receipt=(json.dumps(summary,indent=2,ensure_ascii=False)+'\n').encode();receipt_name=f'{prefix}/completed.json';receipt_sha=hashlib.sha256(receipt).hexdigest()
        statements=['BEGIN TRANSACTION;']
        for table in TABLES:
            target=f'{PROJECT}.{DATASET}.{table}'
            statements.extend([f"DELETE FROM `{target}` WHERE release_id='{release}';",f'INSERT INTO `{target}` SELECT * FROM `{stages[table]}`;'])
        statements.extend([f"DELETE FROM `{PROJECT}.{DATASET}.ingestion_runs` WHERE release_id='{release}';",
           f"INSERT INTO `{PROJECT}.{DATASET}.ingestion_runs` VALUES('{release}','{args.loader_sha}',CURRENT_TIMESTAMP(),'gs://{BUCKET}/{receipt_name}','{receipt_sha}',{json.dumps(dump(dict(rows=dict(counts),coverage=coverage)))});",
           f"DELETE FROM `{PROJECT}.{DATASET}.release_pointer` WHERE dataset_id='undp_bundle_2025';",
           f"INSERT INTO `{PROJECT}.{DATASET}.release_pointer` VALUES('undp_bundle_2025','{release}',CURRENT_TIMESTAMP());",'COMMIT TRANSACTION;'])
        for table in TABLES:
            view=f'{PROJECT}.{DATASET}.current_{table}'
            query(f"CREATE OR REPLACE VIEW `{view}` AS SELECT t.* FROM `{PROJECT}.{DATASET}.{table}` t JOIN `{PROJECT}.{DATASET}.release_pointer` p USING(release_id) WHERE p.dataset_id='undp_bundle_2025';")
        query(f"CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.current_country_metrics` AS SELECT * FROM `{PROJECT}.{DATASET}.current_metric_observations` WHERE geography_kind='country_or_area';")
        # ASSERTs guard the single atomic publication. Any failure keeps the previous release.
        query('\n'.join(controls+statements))
        completed=upload(bucket,receipt_name,receipt)
        print(dump({'event':'undp_published','receipt':completed,'rows':dict(counts),'coverage':coverage}),flush=True)
        for stage in stages.values():bq.delete_table(stage,not_found_ok=True)

if __name__=='__main__':main()
