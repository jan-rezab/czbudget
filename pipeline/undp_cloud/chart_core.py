"""Pure reviewed chart transforms; cloud CLI writes an unpublished review artifact.

Every observation carries its exact release/source key. Never replace an original
report value with a current source, fill a coverage gap, or infer workbook units.
"""
import argparse
from collections import defaultdict
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re

D = 'czbudget-janrezab.undp_human_development'
INDEX_METRICS = {'hdi', 'ihdi', 'gdi', 'gii', 'phdi'}
MISSING = {'', '..', 'NA', 'N/A', 'nan', 'None', 'null'}
# Questionnaire topics, excluding recruitment, location and interview design fields.
SURVEY_TOPICS = {'Q8', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q21'}


def numeric(value):
    if value is None or str(value).strip() in MISSING:
        return None
    try:
        value = Decimal(str(value))
        return value if value.is_finite() else None
    except InvalidOperation:
        return None


def context(row):
    """Do not lose retrieval vintage or provenance when reducing to a chart row."""
    return {k: row.get(k) for k in ('release_id', 'source_id', 'source_vintage',
            'source_url', 'source_sha256', 'relation')}


def record(row):
    value = row.get('record_json', row.get('source_record_json'))
    return json.loads(value, parse_float=Decimal) if isinstance(value, str) else value or row


def metric_charts(rows):
    """HDRO indices/dimensions with same-vintage trends and common-year rankings."""
    groups = defaultdict(list)
    for raw in rows:
        row = dict(raw)
        if row.get('geography_kind') != 'country_or_area':
            continue
        value = numeric(row.get('value'))
        if value is None:
            continue
        row['value'] = str(value)
        key = (row['release_id'], row['source_id'], row.get('source_vintage'), row['metric'])
        groups[key].append(row)
    charts = []
    for key, values in sorted(groups.items(), key=lambda x: str(x[0])):
        years = sorted({int(r['year']) for r in values})
        metric = key[3]
        latest = years[-1]
        current = [r for r in values if int(r['year']) == latest]
        if metric in INDEX_METRICS:
            # Rank only an explicitly common year and publish denominator/coverage.
            # GDI is parity-sensitive: neither descending nor ascending is a welfare ranking.
            if metric != 'gdi':
                reverse = metric != 'gii'
                ordered = sorted(current, key=lambda r: numeric(r['value']), reverse=reverse)
                rank = 0
                previous = None
                ranked = []
                for ordinal, r in enumerate(ordered, 1):
                    if numeric(r['value']) != previous:
                        rank = ordinal
                        previous = numeric(r['value'])
                    ranked.append(dict(r, calculated_rank=rank))
                charts.append({'chart_id': 'ranking_' + metric, 'kind': 'ranking',
                    'metric': metric, 'period': latest, 'source_key': list(key[:3]),
                    'direction': 'lower is better' if metric == 'gii' else 'higher is better',
                    'denominator': len(current), 'coverage': 'countries/areas with a nonmissing value in this exact source vintage and year',
                    'rank_kind': 'calculated competition rank; may differ from official annex ranks',
                    'observations': ranked})
        charts.append({'chart_id': 'trend_' + metric, 'kind': 'time_series' if len(years) > 1 else 'country_comparison',
            'metric': metric, 'source_key': list(key[:3]), 'periods': years,
            'coverage_by_year': {str(y): sum(int(r['year']) == y for r in values) for y in years},
            'unit': sorted({r.get('unit') or 'unresolved' for r in values}),
            'observations': values,
            'notes': 'Consistent HDRO source vintage. Missing country-years excluded and coverage visible. No across-vintage trend stitching.'})
    return charts


def survey_distributions(answers, metadata):
    """Weighted distributions that keep nonresponse and weight exclusion visible.

    Source labels are not deduplicated: distinct source codes stay distinct. No
    variance/CI is invented without strata/PSU/design metadata.
    """
    meta = {(r['source_id'], r['variable']): dict(r) for r in metadata}
    groups = defaultdict(list)
    seen = set()
    for raw in answers:
        row = dict(raw)
        key = (row['release_id'], row['source_id'], row['respondent_id'], row['variable'])
        if key in seen:
            raise ValueError('Duplicate survey answer key')
        seen.add(key)
        groups[(row['release_id'], row['source_id'], row['variable'], row['country'])].append(row)
        groups[(row['release_id'], row['source_id'], row['variable'], '__pooled_survey_countries__')].append(row)
    output = []
    for key, values in sorted(groups.items()):
        md = meta.get((key[1], key[2]))
        if md is None:
            raise ValueError('Missing survey variable metadata')
        bins = defaultdict(lambda: {'unweighted_n': 0, 'weighted_n': Decimal(0)})
        total = valid = Decimal(0)
        accepted = excluded = 0
        for row in values:
            weight = numeric(row.get('survey_weight'))
            if weight is None or weight < 0:
                excluded += 1
                continue
            accepted += 1
            total += weight
            missing = row.get('missing_kind') or None
            code = row.get('source_value')
            # Null/system missing remains explicit even if old warehouse flag is absent.
            if code is None and missing is None:
                missing = 'system_missing'
            if missing is None:
                valid += weight
            b = bins[(code, row.get('value_label'), missing)]
            b['unweighted_n'] += 1
            b['weighted_n'] += weight
        categories = []
        for (code, label, missing), b in sorted(bins.items(), key=lambda x: str(x[0])):
            categories.append({'source_code': code, 'source_label': label, 'missing_kind': missing,
                'unweighted_n': b['unweighted_n'], 'weighted_n': str(b['weighted_n']),
                'share_all_weighted_percent': str(100*b['weighted_n']/total) if total else None,
                'share_valid_weighted_percent': str(100*b['weighted_n']/valid) if valid and missing is None else None})
        output.append({'chart_id': 'survey_' + key[2], 'kind': 'weighted_distribution',
            'release_id': key[0], 'source_id': key[1], 'variable': key[2],
            'geography': key[3], 'metadata': md, 'respondents_received': len(values),
            'unweighted_n_with_usable_weight': accepted, 'excluded_invalid_weight_n': excluded,
            'weighted_denominator_all': str(total), 'weighted_denominator_valid': str(valid),
            'categories': categories, 'country_coverage': sorted({r['country'] for r in values}),
            'source_provenance': [dict(release_id=key[0], source_id=key[1], source_url=u, source_sha256=h) for u,h in sorted({(r.get('source_url') or '', r.get('source_sha256') or '') for r in values})],
            'notes': 'Pooled geography means the surveyed countries using original respondent weights; it is not a world population estimate. Explicit nonresponse and Stata missing codes remain categories; valid denominator excludes them. No standard error/CI claimed.'})
    return output


def source_csv_observations(rows, source_id_prefix, metrics):
    """Normalize reviewed UNEP wide CSV shape into its native source units."""
    for raw in rows:
        if not raw['source_id'].startswith(source_id_prefix):
            continue
        item = record(raw)
        if item.get('kind') != 'data':
            continue
        columns, values = item['columns'], item['values']
        if len(columns) != len(values) or len(columns) != len(set(columns)):
            raise ValueError('CSV shape changed')
        r = dict(zip(columns, values))
        required = {'Country', 'Flow name', 'Flow code', 'Flow unit'}
        if not required.issubset(r):
            raise ValueError('Unexpected material footprint CSV header')
        if r['Flow code'] not in metrics:
            continue
        for year in (c for c in columns if re.fullmatch(r'\d{4}', c)):
            value = numeric(r[year])
            yield dict(context(raw), metric=r['Flow code'], metric_label=r['Flow name'],
                country_name=r['Country'], country_code=None, geography_kind='unresolved_provider_name',
                category=r.get('Category'), period=year, source_value=r[year],
                value=str(value) if value is not None else None, unit=r['Flow unit'],
                source_row_number=raw['row_number'], source_member=raw['member'],
                modeled_status='annual estimated/material-account series; individual year estimation flag unresolved')


def wid_observations(rows):
    for raw in rows:
        if not raw['source_id'].startswith('wid_current_') or raw['member'].endswith('::coverage'):
            continue
        r = record(raw)
        if r.get('variable') != 'sptinc992j' or r.get('percentile') != 'p99p100':
            continue
        value = numeric(r.get('value'))
        if value is not None and not Decimal(0) <= value <= Decimal(1):
            raise ValueError('Invalid WID income share')
        yield dict(context(raw), metric='sptinc992j', percentile='p99p100',
            country_code=r['country'], geography_kind='wid_country_or_region', period=str(r['year']),
            source_value=r.get('value'), value=str(value) if value is not None else None,
            unit='proportion', age=r.get('age'), population=r.get('pop'),
            data_quality=r.get('data_quality'), source_record_json=raw.get('record_json'),
            denominator='pretax national income, equal-split adults; distinct from WB household income/consumption')


def wdi_inequality(rows):
    """Keep WDI native welfare measures; matched quintile sum is a calculation."""
    grouped = defaultdict(dict)
    output = []
    wanted = {'SI.DST.FRST.20', 'SI.DST.02ND.20', 'SI.DST.10TH.10', 'SI.POV.GINI'}
    for raw in rows:
        row = dict(raw)
        if row.get('metric') not in wanted:
            continue
        row['unit'] = 'percent' if row['metric'] != 'SI.POV.GINI' else 'Gini index (0–100)'
        row['welfare_definition'] = 'household income or consumption; country/survey source metadata controls comparability'
        row['value'] = str(numeric(row.get('value'))) if numeric(row.get('value')) is not None else None
        output.append(row)
        if row['metric'] in {'SI.DST.FRST.20', 'SI.DST.02ND.20'}:
            key = (row['release_id'], row['country_code'], row['period'])
            if row['metric'] in grouped[key]:
                raise ValueError('Duplicate WDI quintile country-year')
            grouped[key][row['metric']] = row
    # WDI API has no survey-id field: matched country/year alone does not establish
    # identical welfare/survey. Emit candidate sum held from canonical publication.
    candidates = []
    for key, inputs in grouped.items():
        if len(inputs) != 2 or any(numeric(r['value']) is None for r in inputs.values()):
            continue
        candidates.append({'metric': 'bottom40_candidate_sum', 'country_code': key[1], 'period': key[2],
            'release_id': key[0], 'value': str(sum(numeric(r['value']) for r in inputs.values())),
            'unit': 'percent', 'calculation': 'lowest20 + second20', 'inputs': list(inputs.values()),
            'status': 'held_pending_same_survey_welfare_verification'})
    return output, candidates


def gcp_territorial(rows, contract):
    """Strict wide workbook adapter: contract must come from cloud source preview.

    Layout specifies exact cached sheet, header row, year-column ordinal (zero
    based), country-column map, native unit and native country/aggregate type.
    Returns native units; per-capita/44/12 conversion is not silently performed.
    """
    required = {'source_id', 'source_sha256', 'sheet', 'header_row', 'year_column', 'country_columns', 'unit'}
    if not required.issubset(contract) or not contract['unit']:
        raise ValueError('Unverified GCP layout contract')
    header_verified = False
    observations = []
    for raw in rows:
        if raw['source_id'] != contract['source_id'] or raw['source_sha256'] != contract['source_sha256']:
            continue
        r = record(raw)
        if r.get('sheet') != contract['sheet'] or r.get('representation') != 'cached_values':
            continue
        values = r['values']
        if raw['row_number'] == contract['header_row']:
            for country in contract['country_columns']:
                col = country['column']
                if col >= len(values) or values[col] != country['expected_header']:
                    raise ValueError('GCP country header changed')
            header_verified = True
            continue
        ycol = contract['year_column']
        year = numeric(values[ycol]) if len(values) > ycol else None
        if year is None or year != int(year) or not 1750 <= year <= 2100:
            continue
        for country in contract['country_columns']:
            col = country['column']
            source_value = values[col] if len(values) > col else None
            value = numeric(source_value)
            observations.append(dict(context(raw), metric='territorial_fossil_co2',
                country_name=country['expected_header'], country_code=country.get('country_code'),
                geography_kind=country['geography_kind'], period=str(int(year)),
                unit=contract['unit'], source_value=source_value,
                value=str(value) if value is not None else None, source_sheet=contract['sheet'],
                source_row_number=raw['row_number'], source_column_number=col+1,
                period_status=contract.get('period_status', {}).get(str(int(year)), 'unresolved_estimate_status')))
    if not header_verified:
        raise ValueError('GCP declared header not found')
    return observations


def comparable_series(observations, chart_id):
    groups = defaultdict(list)
    for row in observations:
        groups[(row.get('release_id'), row.get('source_id'), row.get('source_vintage'), row['metric'], row['unit'])].append(row)
    return [{'chart_id': chart_id+'_'+str(key[3]), 'kind': 'time_series',
        'source_key': list(key[:3]), 'metric': key[3], 'unit': key[4],
        'observations': rows, 'period_coverage': sorted({r['period'] for r in rows}),
        'notes': 'Original/newer/related vintages remain separate. Missing values retained; native source units. Source country/aggregate definitions must be resolved before welfare rankings.'}
        for key, rows in sorted(groups.items(), key=lambda x: str(x[0]))]


def survey_aggregated_distributions(bins, metadata):
    """Render BQ-aggregated bins; respondent-level rows never enter worker RAM."""
    meta = {(r['source_id'], r['variable']): dict(r) for r in metadata}
    groups = defaultdict(list)
    for row in bins:
        groups[(row['release_id'], row['source_id'], row['variable'], row['geography'])].append(dict(row))
    result = []
    for key, values in sorted(groups.items()):
        total = sum(numeric(r['weighted_n']) or Decimal(0) for r in values)
        valid = sum(numeric(r['weighted_n']) or Decimal(0) for r in values if r['missing_kind'] is None)
        categories = []
        for row in values:
            weighted = numeric(row['weighted_n']) or Decimal(0)
            categories.append({'source_code': row['source_value'], 'source_label': row['value_label'],
                'missing_kind': row['missing_kind'], 'unweighted_n': int(row['usable_weight_n']),
                'weighted_n': str(weighted), 'share_all_weighted_percent': str(100*weighted/total) if total else None,
                'share_valid_weighted_percent': str(100*weighted/valid) if valid and row['missing_kind'] is None else None})
        result.append({'chart_id': 'survey_'+key[2], 'kind': 'weighted_distribution',
            'release_id': key[0], 'source_id': key[1], 'variable': key[2], 'geography': key[3],
            'metadata': meta[(key[1], key[2])], 'respondents_received': sum(int(r['received_n']) for r in values),
            'unweighted_n_with_usable_weight': sum(int(r['usable_weight_n']) for r in values),
            'excluded_invalid_weight_n': sum(int(r['invalid_weight_n']) for r in values),
            'weighted_denominator_all': str(total), 'weighted_denominator_valid': str(valid), 'categories': categories,
            'country_coverage': sorted({c for r in values for c in r['countries']}),
            'source_provenance': [dict(release_id=key[0], source_id=key[1], source_url=u, source_sha256=h) for u,h in sorted({(r['source_url'], r['source_sha256']) for r in values})],
            'notes': 'BQ aggregation from pinned release. Pooled survey countries are not world population. Nonresponse retained, native weights; no design CI claimed.'})
    return result


def main():
    if not os.environ.get('BUILD_ID'):
        raise RuntimeError('Cloud Build execution only; no local bulk warehouse export')
    p = argparse.ArgumentParser()
    p.add_argument('--undp-release', required=True)
    p.add_argument('--report-release', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--gcp-contracts')
    args = p.parse_args()
    from google.cloud import bigquery
    client = bigquery.Client(project='czbudget-janrezab', location='EU')
    def query(table, release):
        config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter('release', 'STRING', release)])
        return [dict(r) for r in client.query(f'SELECT * FROM `{D}.{table}` WHERE release_id=@release', job_config=config, location='EU').result()]
    metrics = query('metric_observations', args.undp_release)
    metadata = query('variable_metadata', args.undp_release)
    survey_variables = sorted({r['variable'] for r in metadata if json.loads(r['metadata_json']).get('value_labels')
        and r['variable'].split('_', 1)[0] in SURVEY_TOPICS})
    config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter('release', 'STRING', args.undp_release),
        bigquery.ArrayQueryParameter('variables', 'STRING', survey_variables)])
    survey_sql = f"""WITH base AS (
      SELECT a.*,r.source_url,r.source_sha256,
        CASE WHEN a.missing_kind IS NOT NULL THEN a.missing_kind
             WHEN a.source_value IS NULL THEN 'system_missing' ELSE NULL END AS chart_missing
      FROM `{D}.survey_answers` a JOIN `{D}.survey_respondents` r
      USING(release_id,source_id,respondent_id)
      WHERE a.release_id=@release AND a.variable IN UNNEST(@variables)
    ), geographies AS (
      SELECT *,country AS geography FROM base
      UNION ALL SELECT *,'__pooled_survey_countries__' AS geography FROM base
    ) SELECT release_id,source_id,variable,geography,source_value,value_label,
      chart_missing AS missing_kind,source_url,source_sha256,
      COUNT(*) received_n,
      COUNTIF(survey_weight IS NOT NULL AND survey_weight>=0) usable_weight_n,
      COUNTIF(survey_weight IS NULL OR survey_weight<0) invalid_weight_n,
      SUM(IF(survey_weight IS NOT NULL AND survey_weight>=0,survey_weight,0)) weighted_n,
      ARRAY_AGG(DISTINCT country IGNORE NULLS) countries
      FROM geographies GROUP BY release_id,source_id,variable,geography,source_value,
        value_label,chart_missing,source_url,source_sha256"""
    survey_bins = client.query(survey_sql, job_config=config, location='EU').result()
    provider_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter('release', 'STRING', args.report_release)])
    provider_sql = f"""SELECT * FROM `{D}.report_source_records` WHERE release_id=@release
      AND (STARTS_WITH(source_id,'unep_irp_current_mfa_totals_ratios')
       OR STARTS_WITH(source_id,'wid_current_') OR STARTS_WITH(source_id,'gcp_national_fossil_'))"""
    # This subset excludes UIS, PISA, CDC and every unrelated provider entirely.
    # Each adapter consumes the cursor afresh, without materializing provider rows.
    def provider_rows():
        for item in client.query(provider_sql, job_config=provider_config, location='EU').result():
            row = dict(item)
            c = context_map.get(row['source_id'], {})
            row.update(source_vintage=c.get('vintage'), relation=c.get('relation'))
            yield row
    catalog = query('report_source_catalog', args.report_release)
    context_map = {r['source_id']: json.loads(r['source_metadata_json']) for r in catalog}
    charts = metric_charts(metrics)
    charts += survey_aggregated_distributions(survey_bins, metadata)
    charts += comparable_series(source_csv_observations(provider_rows(), 'unep_irp_current_mfa_totals_ratios', {'MF/cap', 'MF', 'Population'}), 'material_footprint')
    charts += comparable_series(wid_observations(provider_rows()), 'wid_top1')
    # Pin the physical source table, including metadata joins. A current view can
    # move to another release while a review build is running.
    wdi_sql = f"""WITH pinned AS (
      SELECT * FROM `{D}.report_source_records` WHERE release_id=@release
      AND STARTS_WITH(source_id,'wdi_') AND NOT ENDS_WITH(member,'::metadata')
    ), country_meta AS (SELECT JSON_VALUE(record_json,'$.id') iso3,
      JSON_VALUE(record_json,'$.region.id') region_id FROM pinned WHERE source_id='wdi_country_metadata'),
    indicator_meta AS (SELECT JSON_VALUE(record_json,'$.id') metric,
      JSON_VALUE(record_json,'$.sourceNote') source_definition,
      JSON_VALUE(record_json,'$.sourceOrganization') source_organizations FROM pinned WHERE STARTS_WITH(source_id,'wdi_meta_'))
    SELECT r.release_id,r.source_id,JSON_VALUE(r.record_json,'$.indicator.id') metric,
      JSON_VALUE(r.record_json,'$.indicator.value') metric_label,
      JSON_VALUE(r.record_json,'$.countryiso3code') country_code,
      JSON_VALUE(r.record_json,'$.country.value') country_name,
      CASE WHEN c.region_id='NA' THEN 'aggregate' WHEN c.region_id IS NOT NULL THEN 'country_or_area' ELSE 'unresolved' END geography_kind,
      JSON_VALUE(r.record_json,'$.date') period,JSON_VALUE(r.record_json,'$.value') source_value,
      SAFE_CAST(JSON_VALUE(r.record_json,'$.value') AS BIGNUMERIC) value,
      JSON_VALUE(r.record_json,'$.unit') provider_unit_field,
      JSON_VALUE(r.record_json,'$.obs_status') provider_observation_status,
      d.source_definition,d.source_organizations,r.source_url,r.source_sha256
    FROM pinned r LEFT JOIN country_meta c ON JSON_VALUE(r.record_json,'$.countryiso3code')=c.iso3
    LEFT JOIN indicator_meta d ON JSON_VALUE(r.record_json,'$.indicator.id')=d.metric
    WHERE JSON_VALUE(r.record_json,'$.indicator.id') IN ('SI.DST.FRST.20','SI.DST.02ND.20','SI.DST.10TH.10','SI.POV.GINI')"""
    def wdi_rows():
        for item in client.query(wdi_sql, job_config=provider_config, location='EU').result():
            row = dict(item)
            c = context_map.get(row['source_id'], {})
            row.update(source_vintage=c.get('vintage'), relation=c.get('relation'))
            yield row
    wdi, held = wdi_inequality(wdi_rows())
    charts += comparable_series(wdi, 'wdi_inequality')
    if args.gcp_contracts:
        for contract in json.loads(Path(args.gcp_contracts).read_text()):
            charts += comparable_series(gcp_territorial(provider_rows(), contract), 'gcp_territorial')
    artifact = {'schema_version': '1.0', 'undp_release': args.undp_release,
        'provider_release': args.report_release, 'processing_status': 'review_artifact',
        'publication_status': 'not_published', 'charts': charts, 'held_calculations': held,
        'limitations': ['No report figure identity claimed for updated charts.', 'Survey figure-specific recodes need reviewed questionnaire mappings.', 'GCP absent unless explicit verified workbook contracts supplied.', 'Current sources are not Jan2025 frozen report snapshots.']}
    Path(args.out).write_text(json.dumps(artifact, ensure_ascii=False, default=str)+'\n')

if __name__ == '__main__':
    main()
