"""Reviewed, source-faithful chart adapters; no network, publication, or proxies.

Run --self-test for tiny fixtures. Cloud caller supplies decoded source rows and
verified column mappings. Every adapter returns observations and coverage; a
blocked adapter cannot be labelled a recreated HDR figure.
"""
import argparse
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
import json


def number(value):
    if value is None or str(value).strip() in {'', '..', 'NA', 'nan'}:
        return None
    try:
        n = Decimal(str(value).strip())
    except InvalidOperation:
        raise ValueError('Invalid source number')
    if not n.is_finite():
        raise ValueError('Nonfinite source number')
    return n


def observation(row, metadata, **fields):
    required = {'source_id', 'source_sha256', 'source_url', 'source_vintage', 'relation'}
    if required - metadata.keys():
        raise ValueError('Missing immutable source provenance')
    return dict(metadata, source_record=row, **fields)


def mapped(rows, columns):
    for row in rows:
        if set(columns.values()) - row.keys():
            raise ValueError('Verified source columns missing')
        yield row, {k: row[v] for k, v in columns.items()}


def hadcrut(rows, columns, metadata, grain):
    """Native anomalies only: never silently substitute a preindustrial baseline."""
    if grain not in {'annual', 'monthly'}:
        raise ValueError('Invalid temporal grain')
    if set(columns) != {'period', 'anomaly', 'lower', 'upper'}:
        raise ValueError('Need verified time, anomaly and uncertainty columns')
    out = []; missing = 0; periods = set()
    for raw, r in mapped(rows, columns):
        period = str(r['period'])
        if grain == 'annual':
            if not (len(period) == 4 and period.isdigit()):
                raise ValueError('Invalid annual period')
        else:
            date.fromisoformat(period + '-01')
        if period in periods:
            raise ValueError('Duplicate period')
        periods.add(period)
        values = {k: number(r[k]) for k in ['anomaly', 'lower', 'upper']}
        if any(v is None for v in values.values()):
            missing += 1; continue
        if not values['lower'] <= values['anomaly'] <= values['upper']:
            raise ValueError('Invalid uncertainty bounds')
        out.append(observation(raw, metadata, metric='global_temperature_anomaly',
            geography='World', period=period, grain=grain, unit='degrees Celsius',
            value=values['anomaly'], lower=values['lower'], upper=values['upper'],
            baseline='1961–1990', uncertainty='source lower and upper uncertainty bounds',
            figure_status='source_series; HDR1850–1900 rebasing not yet reproduced'))
    return out, {'accepted_observations': len(out), 'missing_rows': missing,
                 'rebase_status': 'not_applied', 'figure': 'S6.1.1'}


def rupp(lines, metadata, value_column=None):
    """Keep header/comment context; position requires verified source mapping."""
    if value_column is None:
        return [], {'status': 'blocked', 'reason': 'Transistor column position unverified'}
    out = []; comments = []; missing = 0
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith('#'):
            comments.append(raw); continue
        fields = line.split()
        if len(fields) <= value_column:
            raise ValueError('Missing source transistor column')
        year = fields[0]
        if len(year) != 4 or not year.isdigit():
            raise ValueError('Invalid source year')
        value = number(fields[value_column])
        if value is None:
            missing += 1; continue
        if value <= 0:
            raise ValueError('Transistor count must be positive')
        out.append(observation({'source_line': raw}, metadata, metric='microprocessor_transistors',
             period=year, unit='transistors', value=value, geography=None,
             denominator='individual source microprocessor observation; no annual aggregation'))
    return out, {'accepted_observations': len(out), 'missing_rows': missing,
                 'source_comments': comments, 'figure_status': 'source_observations; no HDR match claimed'}


def epoch(rows, columns, metadata, threshold='1e23', multi_hq_rule=None):
    """Explicit scenario count, retaining uncertain/missing/excluded model records.

    Multi-HQ policy is caller-verified, not guessed from separators in country names.
    country must be a verified list of developer-HQ countries, never training locale.
    """
    expected = {'id', 'date', 'compute', 'compute_lower', 'compute_upper', 'countries', 'estimated'}
    if set(columns) != expected or multi_hq_rule != 'multinational_if_multiple_distinct_hq_countries':
        return [], {'status': 'blocked', 'reason': 'Verified field mapping and multi-HQ rule required'}
    threshold = number(threshold)
    if threshold is None or threshold <= 0:
        raise ValueError('Invalid compute threshold')
    counts = defaultdict(Counter); details = []; seen = set()
    for raw, r in mapped(rows, columns):
        if r['id'] in seen:
            raise ValueError('Duplicate model identifier')
        seen.add(r['id'])
        countries = r['countries']
        if not isinstance(countries, list):
            raise ValueError('HQ countries must be source-verified list')
        countries = sorted(set(c for c in countries if c))
        central = number(r['compute']); lower = number(r['compute_lower']); upper = number(r['compute_upper'])
        if any(x is not None and x <= 0 for x in (central, lower, upper)):
            raise ValueError('Training compute must be positive')
        if lower is not None and upper is not None and lower > upper:
            raise ValueError('Invalid training-compute bounds')
        if central is not None and ((lower is not None and central < lower) or (upper is not None and central > upper)):
            raise ValueError('Central training compute outside supplied bounds')
        status = 'missing_compute' if central is None else 'included_central_estimate' if central > threshold else 'excluded_central_estimate'
        if not countries:
            status = 'missing_hq'
        if not r['date']:
            status = 'missing_release_date'
        year = date.fromisoformat(str(r['date'])).year if r['date'] else None
        country = 'Multinational' if len(countries) > 1 else countries[0] if countries else None
        if status == 'included_central_estimate':
            counts[year][country] += 1
        details.append(observation(raw, metadata, model_id=r['id'], year=year, country_category=country,
            hq_countries=countries, compute_flop=central, compute_lower=lower, compute_upper=upper,
            estimate_flag=r['estimated'], selection_status=status,
            threshold_flop=threshold, threshold_operator='strictly greater than',
            uncertainty_crosses_threshold=(lower is not None and upper is not None and lower <= threshold < upper)))
    annual = []; cumulative = Counter()
    categories = sorted({country for c in counts.values() for country in c})
    # Fill internal calendar gaps only; no observations inferred past latest included release.
    for year in range(min(counts), max(counts) + 1) if counts else []:
        cumulative.update(counts[year])
        for country in categories:
            annual.append(dict(year=year, country_category=country, annual_models=counts[year][country],
                cumulative_models=cumulative[country], unit='curated models', threshold_flop=threshold,
                method='central training-compute estimate; multiple distinct developer HQ countries -> Multinational'))
    return {'model_selection': details, 'series': annual}, {'status': 'derived_scenario',
        'received_models': len(seen), 'selection_statuses': dict(Counter(x['selection_status'] for x in details)),
        'figure_status': 'HDR5.5 match unverified; explicit updated scenario',
        'coverage': 'Epoch curated database, not all AI models; estimates and unknown dates/HQ visible'}


def park(rows, columns, metadata, verification=None):
    """Original source workbook cells; requires checked field/year/CD5 layout."""
    if verification != 'source_fig2_header_and_units_reviewed' or set(columns) != {'year', 'field', 'cd5'}:
        return [], {'status': 'blocked', 'reason': 'Original Fig2 sheet headers/units not yet reviewed'}
    out = []; keys = set()
    for raw, r in mapped(rows, columns):
        year = str(r['year']); field = str(r['field']); value = number(r['cd5'])
        if not year.isdigit() or len(year) != 4 or not field:
            raise ValueError('Invalid field/year')
        if (year, field) in keys:
            raise ValueError('Duplicate source field/year')
        keys.add((year, field))
        if value is not None:
            if not -1 <= value <= 1:
                raise ValueError('CD5 outside source index bounds')
            out.append(observation(raw, metadata, metric='mean_cd5', value=value,
                period=year, field=field, unit='CD5 index', geography=None,
                denominator='original field/year paper sample; five-year forward citation window',
                figure_status='original source aggregate; HDR6.6 transformations pending comparison'))
    return out, {'accepted_observations': len(out), 'method': 'no CD5 recalculation',
                 'newer_status': 'No comparable updated original series verified'}


def ilo_risks(rows, columns, metadata, verification=None):
    """Source risk taxonomy only; cannot produce employment-exposure percentages."""
    if verification != 'author_2023_leaf_schema_reviewed' or set(columns) != {'isco', 'risk'}:
        return [], {'status': 'blocked', 'reason': 'Author JSON leaf fields not yet reviewed'}
    out = []; seen = set()
    for raw, r in mapped(rows, columns):
        code = str(r['isco'])
        if len(code) != 4 or not code.isdigit() or code in seen:
            raise ValueError('ISCO4 must retain exactly four digits and unique source codes')
        seen.add(code)
        if not r['risk']:
            raise ValueError('Missing original risk label')
        out.append(observation(raw, metadata, isco08=code, risk_classification=r['risk'],
            metric='source_occupational_risk_classification', unit='categorical',
            figure_status='taxonomy only; HDR6.1 employment shares require original labour microdata',
            denominator='occupation classification, not people, jobs or FTE'))
    return out, {'accepted_occupations': len(out), 'employment_shares_status': 'blocked_missing_original_microdata'}


def self_test():
    m = dict(source_id='fixture', source_sha256='synthetic', source_url='synthetic', source_vintage='fixture', relation='synthetic')
    rows, coverage = hadcrut([{'p':'2020','a':'1.2','l':'1.1','u':'1.3'}],
        dict(period='p',anomaly='a',lower='l',upper='u'), m, 'annual')
    assert rows[0]['baseline'] == '1961–1990' and rows[0]['value'] == Decimal('1.2')
    rows, _ = rupp(['# synthetic header','2020 100000'], m, 1)
    assert rows[0]['value'] == Decimal('100000')
    columns = {k:k for k in ['id','date','compute','compute_lower','compute_upper','countries','estimated']}
    rows, c = epoch([dict(id='m',date='2024-01-01',compute='2e23',compute_lower='9e22',compute_upper='3e23',countries=['A','B'],estimated=True),
                     dict(id='n',date='2024-02-01',compute='1e23',compute_lower=None,compute_upper=None,countries=['A'],estimated=False)],columns,m,
                     multi_hq_rule='multinational_if_multiple_distinct_hq_countries')
    assert rows['series'][0]['cumulative_models'] == 1
    assert rows['model_selection'][0]['uncertainty_crosses_threshold']
    assert c['selection_statuses']['excluded_central_estimate'] == 1
    assert park([],{},m)[1]['status'] == 'blocked'
    assert ilo_risks([],{},m)[1]['status'] == 'blocked'
    print('chapter5–6 synthetic fidelity checks passed')


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--self-test', action='store_true'); a = p.parse_args()
    if a.self_test:
        self_test()
    else:
        p.error('Cloud caller must provide source rows and verified column mappings; no implicit fetch or publication')
