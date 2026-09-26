"""Cloud-only pinned warehouse -> validated immutable bilingual public reports.

Only this report pointer is changed. Source acquisition and website releases are
independent. Public output contains chart aggregates, never survey respondents.
"""
import argparse
from collections import defaultdict
import csv
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile
import uuid
import urllib.request
import urllib.error

from publish_ch5_6_panels import provider_panels
from chart_core import numeric, survey_aggregated_distributions, SURVEY_TOPICS, source_csv_observations, wid_observations, wdi_inequality, gcp_territorial

PROJECT = 'czbudget-janrezab'
D = PROJECT+'.undp_human_development'
PUBLIC = 'czbudget-janrezab-public-snapshots'
PRIVATE = 'czbudget-janrezab-data-layers'
POINTER = 'static-assets/human-development/current.json'
MAX_BYTES = 2*1024*1024
INDEX = {'hdi': ('Human Development Index', 'Index lidského rozvoje'), 'ihdi': ('Inequality-adjusted HDI', 'HDI upravený o nerovnost'), 'gdi': ('Gender Development Index', 'Index genderového rozvoje'), 'gii': ('Gender Inequality Index', 'Index genderové nerovnosti'), 'phdi': ('Planetary pressures-adjusted HDI', 'HDI upravený o tlak na planetu')}
DIMENSIONS = {'le': ('Life expectancy', 'Očekávaná délka života'), 'eys': ('Expected years of schooling','Očekávané roky vzdělávání'), 'mys': ('Mean years of schooling','Průměrné roky vzdělávání'), 'gnipc': ('GNI per capita','HND na obyvatele')}
CS_TOPICS={'Q8':'Znalost umělé inteligence','Q10':'Četnost používání nástrojů AI','Q11':'Setkávání s AI v jednotlivých službách','Q12':'Účely používání AI','Q13':'Interakce s nástroji AI','Q14':'Svoboda volby a kontrola nad vlastním životem','Q15':'Očekávaná svoboda volby za pět let','Q16':'Kontrola nad interakcemi a míra vystavení AI','Q17':'Důvěra v ostatní lidi','Q18':'Důvěra ve využití AI vládou','Q19':'Důvěra v současné systémy AI','Q21':'Dopady AI na práci a pracovní příležitosti'}
SURVEY_CODES = dict(zip(['Australia','Bangladesh','Brazil','China','Comoros','Egypt','Fiji','Germany','Greece','India','Indonesia','Japan','Kyrgyzstan','Nigeria','Pakistan','Republic of Korea','Russia','South Africa','Tunisia','Turkey','United States'],['AUS','BGD','BRA','CHN','COM','EGY','FJI','DEU','GRC','IND','IDN','JPN','KGZ','NGA','PAK','KOR','RUS','ZAF','TUN','TUR','USA']))

def bi(en, cs): return {'en':en,'cs':cs}
def stamp(): return datetime.now(timezone.utc).isoformat()
def number(v):
    n=numeric(v)
    if n is None:return None
    f=float(n)
    if not math.isfinite(f):raise ValueError('Nonfinite public observation')
    return f

def slug(v): return re.sub('[^a-z0-9]+','-',str(v).lower()).strip('-')
def dump(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def ref(row, table, vintage=None):
    return dict(url=row['source_url'],vintage=str(vintage or row.get('source_vintage') or 'retrieved immutable source snapshot'),table=table,release_id=row['release_id'],source_id=row['source_id'],sha256=row['source_sha256'])

def chart(cid, chapter, title, unit, rows, fields, refs, method, denominator, original=(), status='ready', kind='line'):
    periods=[str(r.get('year',r.get('period'))) for r in rows if any(r.get(f['key']) is not None for f in fields)]
    return dict(id=slug(cid),chapter=chapter,title=title,unit=unit,chart_type=kind,rows=rows,fields=fields,source_refs=refs,method=method,denominator=denominator,original_refs=list(original),status=status,latest_period=max(periods,default=None))

def core_charts(metrics):
    groups=defaultdict(list); countries={}; result=[]; index_panels=defaultdict(lambda:dict(rows={},fields=[],refs=[],coverage={}))
    for r in metrics:
        if r['geography_kind']!='country_or_area':continue
        countries[r['country_code']]=r['country_name']
        if r['metric'] in INDEX or r['metric'] in DIMENSIONS:
            groups[(r['source_id'],r['source_vintage'],r['metric'])].append(r)
    for (sid,vintage,metric), values in sorted(groups.items()):
        en,cs=(INDEX|DIMENSIONS)[metric]
        rows=[dict(country=r['country_code'],year=r['year'],value=number(r['value'])) for r in values if r['value'] is not None]
        if metric in DIMENSIONS:
            common=max(r['year'] for r in rows) if rows else None
            rows=[r for r in rows if r['year']==common]
        rows.sort(key=lambda r:(r['country'],r['year']))
        periods=[r['year'] for r in rows if r['value'] is not None]
        if not periods:continue
        source=ref(values[0],metric,vintage);unit=values[0]['unit'] or 'source unit unresolved'
        original=['Statistical annex Table '+({'hdi':'1','ihdi':'3','gdi':'4','gii':'5','phdi':'7'}.get(metric,'1'))]
        if metric in INDEX:
            panel=index_panels[(sid,vintage)]
            panel['fields'].append(dict(key=metric,label=bi(en,cs)))
            panel['refs'].append(source);panel['coverage'][metric]=len(rows)
            for r in rows:
                cell=panel['rows'].setdefault((r['country'],r['year']),dict(country=r['country'],year=r['year']))
                cell[metric]=r['value']
        else:
            result.append(chart('hdro-'+metric+'-'+vintage,'annex',bi(en+(' — latest comparable year' if metric in DIMENSIONS else ' over time'),cs+(' — poslední společný rok' if metric in DIMENSIONS else ' v čase')),unit,rows,[dict(key='value',label=bi(en,cs))],[source],bi('Same HDRO edition throughout; missing country-years omitted, never zero. Updated source series; exact original figure reproduction is not claimed.','Celá řada pochází ze stejného vydání HDRO. Chybějící roky jsou vynechány, nikdy nejsou nulou. Zdrojová řada; přesná reprodukce původního grafu se netvrdí.'),bi('Countries and areas covered by this source; sparse rows omit missing observations, which are never zero. Component comparisons use one common latest year.','Země a území pokrytá zdrojem; chybějící pozorování se vynechávají, nejsou nulou. Srovnání složek používá jeden společný poslední rok.'),original))
        if metric not in INDEX:continue
        latest=max(periods);current=[r for r in rows if r['year']==latest and r['value'] is not None]
        # GDI is parity, never a descending welfare ranking.
        if metric=='gdi':continue
        ordered=sorted(current,key=lambda r:r['value'],reverse=metric!='gii');prev=None;rank=0;ranking=[]
        for i,r in enumerate(ordered,1):
            if r['value']!=prev:rank=i;prev=r['value']
            ranking.append(dict(r,rank=rank))
        result.append(chart('hdro-'+metric+'-rank-'+vintage,'annex',bi(en+' — comparable year rank',cs+' — pořadí ve stejném roce'), 'calculated rank',ranking,[dict(key='rank',label=bi('Rank','Pořadí'))],[source],bi('Calculated competition ranks at one common year; ties share rank. GII ranks lower values first, other indices higher values first. These may differ from official annex ranks.','Vypočtené pořadí pro jeden společný rok; shodné hodnoty mají stejné pořadí. U GII je nižší hodnota lepší, u ostatních vyšší. Pořadí se může lišit od oficiální přílohy.'),bi(f'{len(current)} countries/areas with a nonmissing value in {latest}.',f'{len(current)} zemí/území s hodnotou v roce {latest}.'),original,kind='bar'))
    for (sid,vintage),panel in index_panels.items():
        result.append(chart('hdro-indices-'+sid+'-'+vintage,'annex',bi('Human development indices over time','Indexy lidského rozvoje v čase'),'dimensionless source indices',list(panel['rows'].values()),panel['fields'],panel['refs'],bi('Five distinct HDRO measures from one edition. Higher HDI/IHDI/PHDI indicates higher development; lower GII indicates less gender inequality; GDI measures parity around 1. Values are not interchangeable or combined into a score. Missing years are omitted, never zero.','Pět odlišných ukazatelů z jednoho vydání HDRO. Vyšší HDI/IHDI/PHDI znamená vyšší rozvoj; nižší GII menší genderovou nerovnost; GDI měří paritu kolem 1. Hodnoty se nezaměňují ani neslučují do skóre. Chybějící roky nejsou nulou.'),bi('Countries/areas and source observation years; each field retains its own definition and missing coverage.','Země/území a roky zdroje; každé pole zachovává vlastní definici a chybějící pokrytí.'),['Statistical annex Tables 1,3,4,5,7']))
        result[-1]['nonmissing_by_metric']=panel['coverage']
    return result,countries

def survey_charts(bins, metadata):
    grouped=survey_aggregated_distributions(bins,metadata);questions=defaultdict(list)
    for r in grouped:questions[r['variable']].append(r)
    out=[]
    for variable, values in sorted(questions.items()):
        rows=[];denominators=[];sources={}
        for r in values:
            country='SURVEY21' if r['geography']=='__pooled_survey_countries__' else SURVEY_CODES.get(r['geography'])
            if not country:raise ValueError('Unmapped survey geography '+r['geography'])
            for c in r['categories']:
                rows.append(dict(country=country,period='2025',label=str(c['source_label'] or c['source_code'] or 'System missing'),source_code=c['source_code'],missing_kind=c['missing_kind'],value=number(c['share_all_weighted_percent']),valid_share=number(c['share_valid_weighted_percent']),unweighted_n=c['unweighted_n']))
            denominators.append(dict(country=country,received_n=r['respondents_received'],usable_weight_n=r['unweighted_n_with_usable_weight'],excluded_weight_n=r['excluded_invalid_weight_n'],weighted_all=r['weighted_denominator_all'],weighted_valid=r['weighted_denominator_valid']))
            for p in r['source_provenance']:sources[(p['source_url'],p['source_sha256'])]=ref(p,variable,'AIHDS2025; fieldwork November2024–January2025')
        title=values[0]['metadata']['label'] or variable
        c=chart('ai-survey-'+variable,'survey',bi(title,CS_TOPICS[variable.split('_',1)[0]]+' — '+variable),'percent',rows,[dict(key='value',label=bi('Share of all usable respondent weights','Podíl všech použitelných vah respondentů'))],list(sources.values()),bi('Exact source question codes and response labels. Original respondent weights; explicit nonresponse/system missing included in displayed denominator. Valid-only percentages and exact denominators remain in downloadable JSON. These question distributions do not claim the report’s figure-specific recodes.','Původní kódy otázek, odpovědi a váhy respondentů. Zobrazený základ zahrnuje neodpovědi i chybějící odpovědi. Podíly platných odpovědí a přesné základy jsou v JSON. Rozdělení otázek netvrdí reprodukci překódování původních grafů.'),bi('21 surveyed countries; pooled sample uses original weights and is not world population. Czechia was not surveyed.','21 zemí průzkumu; společný vzorek používá původní váhy a nepředstavuje světovou populaci. Česko v průzkumu nebylo.'),['UNDP AI and Human Development Survey 2025'],kind='bar')
        c['question_variable']=variable;c['source_question_label']=title;c['denominators']=denominators;c['question_metadata']=values[0]['metadata']['metadata_json'];out.append(c)
    return out

def audit_ledger(root):
    inventory=root/'report_chart_inventory.json'
    if inventory.exists():
        data=json.loads(inventory.read_text())
        return [dict(id=e['id'],title=e.get('caption_first_line') or e.get('topic') or e['id'],source_ids=e.get('source_ids',[]),kind=e.get('kind'),pdf_page=(e.get('pdf_pages') or [None])[0],classification=e.get('classification'),source_note=e.get('source_note'),source_urls=e.get('source_urls',[]),status='unavailable' if e.get('source_kind')=='conceptual' or e.get('classification')=='conceptual' else 'needs_definition',reason='Conceptual diagram; no measured observation series.' if e.get('classification')=='conceptual' else 'Full-PDF caption census; exact source-specific figure transformations remain unverified. Source loading and available topic series do not imply recreation.',recreation=e.get('recreation',{})) for e in data.get('entries',[])]
    records={}
    def add(label,title,sources,kind,page=None):
        key=str(label).replace('Figure ','').replace('Table ','Table')
        records[key]=dict(id=key,title=title,source_ids=sources,kind=kind,pdf_page=page,status='needs_definition' if kind not in {'conceptual','illustration'} else 'unavailable',reason='Exact source-specific figure transformations remain unverified; source availability is tracked separately.' if kind not in {'conceptual','illustration'} else 'Conceptual diagram; no measured data series.')
    a=json.loads((root/'ch1_2_sources.json').read_text())
    for s in a['sources']:
        for i,label in enumerate(s['report_refs']):
            if 'note' in label or label.startswith('related_'):continue
            pages=s.get('pdf_pages',[])
            add(label,s.get('title',label),[s['source_id']], 'conceptual' if s['source_id'].startswith('conceptual') else 'numeric',pages[i] if i<len(pages) else None)
    a=json.loads((root/'ch3_4_sources.json').read_text())
    for f in a['figures']:add(f['label'],f.get('title',f['label']),[f.get('source_id')],f.get('kind'),f.get('pdf_page'))
    a=json.loads((root/'ch5_6_sources.json').read_text())
    for f in a['objects']:add(f['object_id'],f['title'],f.get('dataset_ids',[]),f.get('kind'),f.get('pdf_page'))
    for n in range(1,8):add('Statistical annex Table '+str(n),'Statistical annex Table '+str(n),['hdr25_tables' if n!=6 else 'mpi2024_tables'],'numeric')
    return list(records.values())

def validate(payload):
    uuid.UUID(payload['release_id']);datetime.fromisoformat(payload['generated_at'])
    if payload['schema_version']!='1.0.0':raise ValueError('Wrong schema')
    codes={g['code'] for g in payload['geographies']};chapters={c['id'] for c in payload['chapters']}
    if len(codes)!=len(payload['geographies']) or 'CZE' not in codes or 'WLD' not in codes:raise ValueError('Incomplete/duplicate geography registry')
    ids=set()
    for c in payload['charts']:
        if c['id'] in ids or not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',c['id']):raise ValueError('Duplicate/invalid chart id')
        ids.add(c['id'])
        if c['chapter'] not in chapters:raise ValueError('Unknown chapter')
        for field in ['title','method','denominator']:
            if not isinstance(c[field],dict) or not all(isinstance(c[field].get(k),str) and c[field][k] for k in ['en','cs']):raise ValueError('Missing bilingual '+field)
        if not c['unit'] or c['status'] not in {'ready','historical','unavailable','needs_definition','withdrawn'}:raise ValueError('Invalid chart unit/status')
        if c['status'] in {'ready','historical'} and (not c['fields'] or not c['source_refs'] or not any(r.get(f['key']) is not None for r in c['rows'] for f in c['fields'])):raise ValueError('Ready chart without observations')
        for source in c['source_refs']:
            if not source['url'].startswith('https://') or not source['vintage'] or not source['table'] or not source.get('release_id') or not re.fullmatch('[0-9a-f]{64}',source.get('sha256','')):raise ValueError('Incomplete immutable source reference')
        for r in c['rows']:
            if r.get('country') is not None and r['country'] not in codes:raise ValueError('Unregistered chart geography')
            if not any(k in r for k in ['year','period','label']):raise ValueError('No observation period/category')
            for f in c['fields']:
                if r.get(f['key']) is not None and (isinstance(r[f['key']],bool) or not isinstance(r[f['key']],(int,float)) or not math.isfinite(r[f['key']])):raise ValueError('Invalid numeric chart value')
    body=dump(payload)
    if len(body)>MAX_BYTES:raise ValueError(f'Report payload {len(body)} exceeds 2MB; publication held, no data silently truncated')
    return body

def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Cloud Build only; no local bulk export')
    parser=argparse.ArgumentParser();parser.add_argument('--loader-sha',required=True);parser.add_argument('--release-id',default=os.environ['BUILD_ID']);parser.add_argument('--undp-release');parser.add_argument('--gcp-contracts');args=parser.parse_args()
    from google.cloud import bigquery,storage
    bq=bigquery.Client(project=PROJECT,location='EU');gcs=storage.Client(project=PROJECT);started=stamp()
    pub=gcs.bucket(PUBLIC);private=gcs.bucket(PRIVATE);pointer=pub.blob(POINTER)
    pointer.reload() if pointer.exists() else None;expected_generation=int(pointer.generation or 0)
    prefix='processing-runs/undp-human-development-reports/'+args.release_id
    previous=private.blob(prefix+'/prepared-receipt.json')
    if previous.exists():
        prepared=json.loads(previous.download_as_bytes(checksum='auto'))
        current=json.loads(pointer.download_as_bytes()) if expected_generation else {}
        report=prepared['downloads'][0];report_name=report['uri'].split('/',3)[3]
        saved=pub.blob(report_name).download_as_bytes(checksum='auto')
        if hashlib.sha256(saved).hexdigest()!=report['sha256']:raise ValueError('Retry artifact hash mismatch')
        validate(json.loads(saved))
        value=dict(schema_version='1.0.0',bucket=PUBLIC,release_id=args.release_id,object=report_name,sha256=report['sha256'],bytes=report['bytes'],generated_at=json.loads(saved)['generated_at'])
        if current.get('release_id')!=args.release_id:
            if expected_generation!=int(prepared['previous_pointer_generation']):raise ValueError('Pointer changed since preparation; retry publication held')
            pointer.upload_from_string(dump(value),content_type='application/json',if_generation_match=expected_generation,checksum='auto')
        elif current.get('sha256')!=report['sha256']:raise ValueError('Retry pointer hash mismatch')
        completed=private.blob(prefix+'/completed-receipt.json')
        if not completed.exists():completed.upload_from_string(dump(dict(prepared,publication_status='published',published_at=prepared['validated_at'])),content_type='application/json',if_generation_match=0)
        print(dump(dict(event='human_development_reports_retry_confirmed',release_id=args.release_id)).decode(),flush=True);return
    # All provider-group pointers are read together once. Every later query uses physical tables and exact release parameters.
    pointers=[dict(r) for r in bq.query(f'SELECT dataset_id,release_id FROM `{D}.release_pointer`',location='EU').result()]
    pinned={r['dataset_id']:r['release_id'] for r in pointers}
    core=args.undp_release or pinned.get('undp_bundle_2025')
    if not core or core!=pinned.get('undp_bundle_2025'):raise ValueError('Requested core release is not the verified publication pointer')
    def query(sql,release,parameters=()):
        cfg=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter('release','STRING',release),*parameters])
        return bq.query(sql,job_config=cfg,location='EU').result()
    metrics=query(f"SELECT * FROM `{D}.metric_observations` WHERE release_id=@release AND geography_kind='country_or_area' AND metric IN ('hdi','ihdi','gdi','gii','phdi','le','eys','mys','gnipc')",core)
    charts,countries=core_charts(metrics)
    if not charts or 'CZE' not in countries:raise ValueError('Core country/index observations absent')
    metadata=[dict(r) for r in query(f"SELECT * FROM `{D}.variable_metadata` WHERE release_id=@release AND source_id='ai2025_survey'",core)]
    variables=[r['variable'] for r in metadata if r['variable'].split('_',1)[0] in SURVEY_TOPICS and json.loads(r['metadata_json']).get('value_labels')]
    sql=f"""WITH base AS (SELECT a.*,r.source_url,r.source_sha256,\n       COALESCE(a.missing_kind,IF(a.source_value IS NULL,'system_missing',NULL)) chart_missing\n       FROM `{D}.survey_answers` a JOIN `{D}.survey_respondents` r USING(release_id,source_id,respondent_id)\n       WHERE a.release_id=@release AND a.variable IN UNNEST(@variables)),\n       geo AS (SELECT *,country geography FROM base UNION ALL SELECT *,'__pooled_survey_countries__' geography FROM base)\n       SELECT release_id,source_id,variable,geography,source_value,value_label,chart_missing missing_kind,source_url,source_sha256,\n       COUNT(*) received_n,COUNTIF(survey_weight IS NOT NULL AND survey_weight>=0) usable_weight_n,\n       COUNTIF(survey_weight IS NULL OR survey_weight<0) invalid_weight_n,\n       SUM(IF(survey_weight IS NOT NULL AND survey_weight>=0,survey_weight,0)) weighted_n,ARRAY_AGG(DISTINCT country IGNORE NULLS) countries\n       FROM geo GROUP BY release_id,source_id,variable,geography,source_value,value_label,chart_missing,source_url,source_sha256"""
    charts+=survey_charts(query(sql,core,[bigquery.ArrayQueryParameter('variables','STRING',variables)]),metadata)
    country_names={v:k for k,v in countries.items()};country_names.update(SURVEY_CODES)
    catalog=[]
    provider_releases=sorted({v for k,v in pinned.items() if k.startswith('hdr_report_sources_2025')})
    if provider_releases:
        for release in provider_releases:
            catalog.extend(dict(r) for r in query(f'SELECT * FROM `{D}.report_source_catalog` WHERE release_id=@release',release))
    # Different source groups may contain the same source. Latest pointer group order is not a vintage decision: reject conflicting duplicates.
    by_source={}
    for c in catalog:
        m=json.loads(c['source_metadata_json']);m['release_id']=c['release_id'];sid=c['source_id']
        if sid in by_source and by_source[sid].get('sha256')!=m.get('sha256'):raise ValueError('Conflicting pinned source groups '+sid)
        by_source[sid]=m
    def source_rows(sid):
        m=by_source[sid]
        for row in query(f'SELECT * FROM `{D}.report_source_records` WHERE release_id=@release AND source_id=@sid',m['release_id'],[bigquery.ScalarQueryParameter('sid','STRING',sid)]):
            r=dict(row);r.update(source_vintage=m.get('vintage'),relation=m.get('relation'));yield r
    iso2_codes={'CZ':'CZE'}
    country_names.update({'Czech Republic':'CZE','Türkiye':'TUR','Korea, Rep.':'KOR','Russian Federation':'RUS'})
    if 'wdi_country_metadata' in by_source and by_source['wdi_country_metadata'].get('accepted_records'):
        for raw in source_rows('wdi_country_metadata'):
            r=json.loads(raw['record_json'])
            if isinstance(r,dict) and r.get('id'):
                iso2_codes[r.get('iso2Code')]=r['id']
                country_names[r.get('name')]=r['id']
    def admit_observations(sid,observations,name,unit=None):
        groups=defaultdict(list)
        for r in observations:
            code=r.get('country_code')
            if sid.startswith('wid_current_'):code=iso2_codes.get(code,'WID-'+str(code))
            if not code:code=country_names.get(r.get('country_name'))
            if not code:code='SRC-'+slug(r.get('country_name') or r.get('country_code') or 'unresolved').upper()
            if code not in countries:countries[code]=r.get('country_name') or code
            groups[(r['metric'],r['unit'])].append(dict(country=code,period=r['period'],value=number(r['value'])))
        m=by_source[sid]
        for (metric,unit),rows in groups.items():
            source=ref(dict(source_url=m['url'],source_sha256=m['sha256'],release_id=m['release_id'],source_id=sid),metric,m.get('vintage'))
            charts.append(chart('provider-'+sid+'-'+metric,'annex',bi(name+' — '+metric,name+' — '+metric),unit,rows,[dict(key='value',label=bi(metric,metric))],[source],bi('Source-native annual values, separate original/newer source editions. Source aggregates and historical entities remain explicitly named; no proxy values.','Roční hodnoty v původních jednotkách; původní a novější vydání zůstávají oddělená. Agregáty i historická území jsou pojmenovány; bez náhradních hodnot.'),bi('Provider geography and population/welfare definitions; consult linked source.','Geografie a definice populace či příjmu podle poskytovatele; viz zdroj.'),m.get('report_refs',[])))
            if sid.startswith('wid_current_'):
                charts[-1]['denominator']=bi('Top 1% share of pretax national income among equal-split adults (sptinc992j/p99p100), native proportion; distinct from World Bank household income or consumption.','Podíl horního 1% na národním příjmu před zdaněním mezi dospělými s rovným rozdělením (sptinc992j/p99p100), původní podíl; odlišný od příjmu či spotřeby domácností Světové banky.')
            elif sid.startswith('wdi_'):
                charts[-1]['denominator']=bi('Household income or consumption; welfare concept and survey year vary by country. WDI source observations, not WID pretax national income.','Příjem nebo spotřeba domácností; pojetí a rok šetření se liší mezi zeměmi. Pozorování WDI, ne národní příjem WID před zdaněním.')
    for sid,m in by_source.items():
        if not m.get('accepted_records'):continue
        if sid.startswith('unep_irp_current_mfa_totals_ratios'):admit_observations(sid,source_csv_observations(source_rows(sid),sid,{'MF/cap'}),'Material footprint / Materiálová stopa')
        elif sid.startswith('wid_current_'):admit_observations(sid,wid_observations(source_rows(sid)),'Top 1% pretax national income share / Podíl příjmů horního 1%')
        elif sid in {'wdi_si_dst_10th_10','wdi_si_pov_gini','wdi_si_dst_frst_20','wdi_si_dst_02nd_20'}:
            def wdi_values():
                for raw in source_rows(sid):
                    r=json.loads(raw['record_json'])
                    if not isinstance(r,dict) or not isinstance(r.get('indicator'),dict):continue
                    yield dict(raw,metric=r['indicator']['id'],metric_label=r['indicator'].get('value'),country_code=r.get('countryiso3code'),country_name=r.get('country',{}).get('value'),period=r.get('date'),source_value=r.get('value'),value=r.get('value'))
            native,held=wdi_inequality(wdi_values())
            admit_observations(sid,native,'World Bank household income/consumption inequality / Nerovnost příjmu či spotřeby domácností')
    if args.gcp_contracts:
        for contract in json.loads(Path(args.gcp_contracts).read_text()):
            sid=contract['source_id']
            if sid not in by_source:raise ValueError('GCP contract source not published')
            admit_observations(sid,gcp_territorial(source_rows(sid),contract),'Territorial fossil CO2 / Teritoriální emise fosilního CO2')
    added_charts,added_gaps=provider_panels(source_rows,by_source)
    charts+=added_charts
    ledger=audit_ledger(Path('pipeline/undp_cloud/audit'))
    gaps=[dict(source_id=sid,name=sid,reason=m.get('error') or 'Source records have no verified chart binding; raw loading is not figure reproduction.') for sid,m in by_source.items() if not m.get('accepted_records')]
    gaps+=added_gaps
    if not provider_releases:gaps.append(dict(source_id='provider-bundle',reason='No provider-group publication pointer available at report build start.'))
    for entry in ledger:
        object_id=entry['id'].replace('Figure ','').replace('Table ','')
        chapter='overview' if object_id.startswith('O.') else 'annex' if 'annex' in object_id.lower() else 'chapter'+object_id[0] if object_id[0] in '123456' else 'overview'
        charts.append(chart('original-'+entry['id'],chapter,bi('Original report '+entry['id']+': '+entry['title'],'Původní zpráva '+entry['id']+': '+entry['title']), 'not applicable',[],[],[],bi(entry['reason'],'Přesná reprodukce původního grafu není ověřena; dostupnost zdrojových dat se sleduje samostatně.'),bi('Original report population, period and categories require figure-specific source binding.','Populace, období a kategorie původního grafu vyžadují ověřené přiřazení ke zdroji.'),[dict(id=entry['id'],page=entry['pdf_page'])],status=entry['status']))
    countries.update({code:name for name,code in SURVEY_CODES.items()});countries['CZE']=countries.get('CZE','Czechia')
    geographies=[dict(code='WLD',name=bi('World / global source series','Svět / globální zdrojové řady')),dict(code='SURVEY21',name=bi('21-country survey sample (not world)','Vzorek průzkumu v 21 zemích (není svět)'))]+[dict(code=c,name=bi(n,'Česko' if c=='CZE' else n)) for c,n in sorted(countries.items()) if c not in {'WLD','SURVEY21'}]
    chapters=[dict(id='annex',title=bi('Human development and statistical annex','Lidský rozvoj a statistická příloha')),dict(id='survey',title=bi('AI and human development survey','Průzkum AI a lidského rozvoje')),dict(id='overview',title=bi('Original report overview: coverage','Původní přehled zprávy: pokrytí'))]+[dict(id='chapter'+str(i),title=bi('Original chapter '+str(i)+': coverage','Původní kapitola '+str(i)+': pokrytí')) for i in range(1,7)]
    payload=dict(schema_version='1.0.0',release_id=args.release_id,generated_at=stamp(),source_releases=dict(undp_bundle_2025=core,**{k:v for k,v in pinned.items() if k.startswith('hdr_report_sources_2025')}),geographies=geographies,chapters=chapters,charts=charts,coverage=dict(source_count=11+sum(bool(m.get('accepted_records')) or m.get('processing_status')=='raw_document_preserved' for m in by_source.values()),attempted_source_count=11+len(by_source),unavailable_sources=gaps,original_figures=ledger,survey_countries=sorted(SURVEY_CODES.values()),czechia_survey_available=False,scope=bi('All audited named objects are listed. Numerical narrative citations remain candidate evidence, not loaded observations. Ready charts are source series; exact original figures are not claimed recreated.','Všechny auditované pojmenované objekty jsou uvedeny. Číselné citace v textu zůstávají kandidáty důkazů, ne načtenými pozorováními. Dostupné grafy jsou zdrojové řady; přesná reprodukce původních grafů se netvrdí.')))
    name=f'static-assets/human-development/releases/{args.release_id}/reports.json'
    core_download=f'static-assets/human-development/releases/{args.release_id}/core-observations.csv'
    # Complete pinned core metric cells, including missing values, aggregates and
    # raw source units. Stream to cloud temporary disk, never a dataset-wide list.
    core_meta={r['variable']:dict(r) for r in query(f"SELECT * FROM `{D}.variable_metadata` WHERE release_id=@release AND source_id='hdr25_timeseries'",core)}
    temporary=tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='',suffix='.csv',delete=False)
    received=accepted=missing=0;metric_counts=defaultdict(int);source_totals=defaultdict(Decimal);normalized_totals=defaultdict(Decimal)
    with temporary as out:
        export=csv.writer(out);export.writerow(['release_id','source_id','source_vintage','country_code','country_name','geography_kind','year','metric','metric_label','sex','source_value','normalized_value','source_unit','unit_definition_status','source_column','source_url','source_sha256'])
        for item in query(f'SELECT * FROM `{D}.metric_observations` WHERE release_id=@release',core):
            r=dict(item);received+=1;metric_counts[r['metric']]+=1
            if not r['source_url'].startswith('https://') or not re.fullmatch('[a-f0-9]{64}',r['source_sha256']):raise ValueError('Core CSV source provenance invalid')
            if r['value'] is None:missing+=1
            else:
                accepted+=1
                if numeric(r['source_value'])!=numeric(r['value']):raise ValueError('Core export source/normalized numeric mismatch')
                source_totals[r['metric']]+=numeric(r['source_value']);normalized_totals[r['metric']]+=numeric(r['value'])
            export.writerow([r['release_id'],r['source_id'],r['source_vintage'],r['country_code'],r['country_name'],r['geography_kind'],r['year'],r['metric'],core_meta.get(r['metric'],{}).get('label'),r['sex'],r['source_value'],r['value'],r['unit'],'definition_reviewed_for_chart' if r['metric'] in INDEX or r['metric'] in DIMENSIONS else 'reported_source_unit_definition_not_reviewed_for_chart',r['source_column'],r['source_url'],r['source_sha256']])
    payload['coverage']['core_export']=dict(received_cells=received,nonmissing_cells=accepted,missing_cells=missing,metric_cells=dict(metric_counts),coverage='All pinned HDRO time-series metric cells, including nulls and aggregate geographies; 9 metrics charted. Workbook-only annex cells remain in the pinned warehouse and are not claimed exported here.')
    annex_download=f'static-assets/human-development/releases/{args.release_id}/annex-observations.csv'
    annex_file=tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='',suffix='.csv',delete=False)
    annex_columns=['release_id','source_id','source_vintage','sheet','row_number','column_number','country_code','country_name','geography_kind','metric','period','sex','unit','source_value','value','source_notes','source_url','source_sha256']
    annex_n=0;annex_totals=defaultdict(lambda:dict(count=0,source=Decimal(0),normalized=Decimal(0)));annex_vintages=set()
    with annex_file as out:
        export=csv.writer(out);export.writerow(annex_columns+['unit_definition_status'])
        for item in query(f'SELECT * FROM `{D}.table_observations` WHERE release_id=@release',core):
            r=dict(item);annex_n+=1
            if not r['source_url'].startswith('https://') or not re.fullmatch('[a-f0-9]{64}',r['source_sha256']):raise ValueError('Annex source provenance invalid')
            if numeric(r['source_value'])!=numeric(r['value']):raise ValueError('Annex source/normalized decimal mismatch')
            key=(r['source_id'],r['metric'],r['unit']);annex_totals[key]['count']+=1
            if r['value'] is not None:
                annex_totals[key]['source']+=numeric(r['source_value']);annex_totals[key]['normalized']+=numeric(r['value'])
            annex_vintages.add((r['source_id'],r['source_vintage']))
            export.writerow([r.get(c) for c in annex_columns]+['source_header_unit_preserved; definition_not_reviewed_for_chart'])
    if not annex_n:raise ValueError('Pinned numeric annex cells absent')
    payload['coverage']['annex_export']=dict(numeric_cells=annex_n,source_vintages=sorted(annex_vintages),scope='All pinned table_observations numeric cells. Source column headers, units, notes and exact cell coordinates preserved; unit interpretation remains unresolved where source headers are ambiguous. Original HDR all-tables workbook omits Table6; original MPI2024 and newer MPI2025 workbooks remain separate source vintages.')
    payload['downloads']=dict(annex_csv='https://storage.googleapis.com/'+PUBLIC+'/'+annex_download,json='https://storage.googleapis.com/'+PUBLIC+'/'+name,core_csv='https://storage.googleapis.com/'+PUBLIC+'/'+core_download,chart_csv='https://storage.googleapis.com/'+PUBLIC+f'/static-assets/human-development/releases/{args.release_id}/observations.csv')
    body=validate(payload);sha=hashlib.sha256(body).hexdigest()
    # Full row export stays a separate download; report response must remain <=2MB.
    stream=io.StringIO();writer=csv.writer(stream);writer.writerow(['chart_id','country','period','label','field','value','unit','source_release','source_url'])
    for c in charts:
        for r in c['rows']:
            for f in c['fields']:writer.writerow([c['id'],r.get('country'),r.get('year',r.get('period')),r.get('label'),f['key'],r.get(f['key']),c['unit'],';'.join(s['release_id'] for s in c['source_refs']),';'.join(s['url'] for s in c['source_refs'])])
    csv_body=stream.getvalue().encode();downloads=f'static-assets/human-development/releases/{args.release_id}/observations.csv'
    def immutable(bucket,key,data,ctype):
        blob=bucket.blob(key)
        if blob.exists():
            if blob.download_as_bytes()!=data:raise ValueError('Immutable object differs '+key)
        else:blob.upload_from_string(data,content_type=ctype,if_generation_match=0,checksum='auto')
        blob.reload();received=blob.download_as_bytes(checksum='auto')
        if hashlib.sha256(received).digest()!=hashlib.sha256(data).digest():raise ValueError('Roundtrip hash mismatch')
        return dict(uri='gs://'+bucket.name+'/'+key,generation=str(blob.generation),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data))
    csv_object=immutable(pub,downloads,csv_body,'text/csv; charset=utf-8')
    core_blob=pub.blob(core_download);core_digest=hashlib.sha256()
    with open(temporary.name,'rb') as f:
        while chunk:=f.read(1024*1024):core_digest.update(chunk)
    core_sha=core_digest.hexdigest();core_bytes=os.path.getsize(temporary.name)
    if core_blob.exists():
        verified=hashlib.sha256()
        with core_blob.open('rb') as f:
            while chunk:=f.read(1024*1024):verified.update(chunk)
        if verified.hexdigest()!=core_sha:raise ValueError('Immutable core CSV differs')
    else:core_blob.upload_from_filename(temporary.name,content_type='text/csv; charset=utf-8',if_generation_match=0,checksum='auto')
    core_blob.reload();verified=hashlib.sha256()
    with core_blob.open('rb') as f:
        while chunk:=f.read(1024*1024):verified.update(chunk)
    if verified.hexdigest()!=core_sha:raise ValueError('Core CSV roundtrip mismatch')
    os.unlink(temporary.name)
    core_object=dict(uri='gs://'+PUBLIC+'/'+core_download,generation=str(core_blob.generation),sha256=core_sha,bytes=core_bytes,received_rows=received,accepted_nonmissing_rows=accepted,missing_rows=missing,rejected_rows=0,deduplicated_rows=0,source_totals_by_metric={k:str(v) for k,v in source_totals.items()},normalized_totals_by_metric={k:str(v) for k,v in normalized_totals.items()},numeric_totals_status='Exact source and normalized decimal values checked per cell; sums preserved per metric, never combined across units.')
    annex_blob=pub.blob(annex_download);annex_digest=hashlib.sha256()
    with open(annex_file.name,'rb') as f:
        while chunk:=f.read(1024*1024):annex_digest.update(chunk)
    annex_sha=annex_digest.hexdigest();annex_bytes=os.path.getsize(annex_file.name)
    if annex_blob.exists():
        check=hashlib.sha256()
        with annex_blob.open('rb') as f:
            while chunk:=f.read(1024*1024):check.update(chunk)
        if check.hexdigest()!=annex_sha:raise ValueError('Immutable annex CSV differs')
    else:annex_blob.upload_from_filename(annex_file.name,content_type='text/csv; charset=utf-8',if_generation_match=0,checksum='auto')
    annex_blob.reload();check=hashlib.sha256()
    with annex_blob.open('rb') as f:
        while chunk:=f.read(1024*1024):check.update(chunk)
    if check.hexdigest()!=annex_sha:raise ValueError('Annex CSV roundtrip mismatch')
    os.unlink(annex_file.name)
    annex_object=dict(uri='gs://'+PUBLIC+'/'+annex_download,generation=str(annex_blob.generation),sha256=annex_sha,bytes=annex_bytes,received_rows=annex_n,accepted_rows=annex_n,rejected_rows=0,deduplicated_rows=0,totals_by_source_metric_unit=[dict(source_id=k[0],metric=k[1],unit=k[2],count=v['count'],source_total=str(v['source']),normalized_total=str(v['normalized'])) for k,v in annex_totals.items()],unit_status='No sums combine different source/metric/unit groups; unresolved source units retained literally.')
    def anonymous_head(key):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://storage.googleapis.com/'+PUBLIC+'/'+key,method='HEAD'),timeout=20) as r:
                return 'verified_anonymous_head_200' if r.status==200 else 'not_available_http_'+str(r.status)
        except urllib.error.HTTPError as e:return 'not_available_http_'+str(e.code)
        except (urllib.error.URLError,TimeoutError):return 'not_verified_network_error'
    accesses=dict(annex_csv=anonymous_head(annex_download),core_csv=anonymous_head(core_download),chart_csv=anonymous_head(downloads),json='not_yet_verified_direct_access; authenticated_report_store_contract')
    payload['download_access']=accesses
    for key in ['core_csv','chart_csv','annex_csv']:
        if accesses[key]!='verified_anonymous_head_200':payload['downloads'][key]=None
    body=validate(payload);sha=hashlib.sha256(body).hexdigest()
    report_object=immutable(pub,name,body,'application/json; charset=utf-8')
    accesses=dict(accesses,json=anonymous_head(name))
    prepared=dict(schema_version='1.0.0',release_id=args.release_id,loader_git_sha=args.loader_sha,build_id=os.environ['BUILD_ID'],region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',started_at=started,validated_at=stamp(),source_releases=payload['source_releases'],raw_destination='Pinned immutable original source objects recorded by each source release receipt',staging_destination=report_object,publication_pointer='gs://'+PUBLIC+'/'+POINTER,processing_status='validated',publication_status='prepared',previous_pointer_generation=str(expected_generation),validation=dict(bilingual_schema='passed',exact_source_provenance='passed',country_registry='passed',finite_numeric_values='passed',max_2mb='passed',source_records_bulk_materialization='excluded',roundtrip_hash='passed'),rows=sum(len(c['rows']) for c in charts),ready_charts=sum(c['status']=='ready' for c in charts),original_figures_recreated=0,downloads=[report_object,csv_object,core_object,annex_object],download_access=accesses,unavailable_sources=gaps)
    immutable(private,prefix+'/prepared-receipt.json',dump(prepared),'application/json')
    pointer_value=dict(schema_version='1.0.0',bucket=PUBLIC,release_id=args.release_id,object=name,sha256=sha,bytes=len(body),generated_at=payload['generated_at'],downloads=dict(json=name,csv=downloads,core_csv=core_download,annex_csv=annex_download))
    pointer.upload_from_string(dump(pointer_value),content_type='application/json',if_generation_match=expected_generation,checksum='auto')
    completed=dict(prepared,publication_status='published',published_at=stamp(),previous_pointer_generation=str(expected_generation))
    immutable(private,prefix+'/completed-receipt.json',dump(completed),'application/json')
    print(dump(dict(event='human_development_reports_published',release_id=args.release_id,bytes=len(body),charts=len(charts),ready=prepared['ready_charts'],receipt='gs://'+PRIVATE+'/'+prefix+'/completed-receipt.json')).decode(),flush=True)

if __name__=='__main__':main()
