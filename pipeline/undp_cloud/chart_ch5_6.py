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
import re


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
        year = number(fields[0])
        if year is None or not Decimal('1900') <= year < Decimal('2200'):
            raise ValueError('Invalid fractional source year')
        value = number(fields[value_column])
        if value is None:
            missing += 1; continue
        if value <= 0:
            raise ValueError('Transistor count must be positive')
        out.append(observation({'source_line': raw}, metadata, metric='microprocessor_transistors',
             period=str(year), calendar_year=int(year), unit='thousand transistors', value=value, geography=None,
             fractional_year=year, period_definition='source decimal year; no month/date interpolation',
             denominator='individual source microprocessor observation; no annual aggregation'))
    return out, {'accepted_observations': len(out), 'missing_rows': missing,
                 'source_comments': comments, 'figure_status': 'source_observations; no HDR match claimed'}


def epoch(rows, columns, metadata, threshold='1e23', multi_hq_rule=None):
    """Explicit scenario count, retaining uncertain/missing/excluded model records.

    Multi-HQ policy is caller-verified, not guessed from separators in country names.
    country is an explicitly supplied scenario list, never training locale.
    Native Epoch categorical countries are handled separately by epoch_source.
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


HADCRUT_COLUMNS = {'period':'Time', 'anomaly':'Anomaly (deg C)',
    'lower':'Lower confidence limit (2.5%)', 'upper':'Upper confidence limit (97.5%)'}


def hadcrut_source(rows, metadata, grain):
    """Exact reviewed HadCRUT5 diagnostics CSV headers, native baseline."""
    return hadcrut(rows, HADCRUT_COLUMNS, metadata, grain)


def epoch_source(rows, metadata, threshold='1e23'):
    """Native country categorical strings retained without guessed multi-select splitting.

    This is a central-estimate scenario, not a recreation of HDR country grouping.
    Epoch country means organization association; it does not uniquely identify HQ.
    """
    required = {'Model','Publication date','Training compute (FLOP)',
        'Training compute lower bound','Training compute upper bound',
        'Country (of organization)','Confidence','Training compute estimation method'}
    limit = number(threshold)
    if limit is None or limit <= 0:
        raise ValueError('Invalid threshold')
    details = []; seen = set(); counts = defaultdict(Counter)
    for raw in rows:
        if required - raw.keys():
            raise ValueError('Reviewed Epoch columns missing')
        model = raw['Model']
        if not model or model in seen:
            raise ValueError('Missing or duplicate Epoch primary Model key')
        seen.add(model)
        central = number(raw['Training compute (FLOP)'])
        lower = number(raw['Training compute lower bound']); upper = number(raw['Training compute upper bound'])
        source_issues=[]
        if any(v is not None and v <= 0 for v in (central,lower,upper)):
            source_issues.append('nonpositive_source_compute')
        if lower is not None and upper is not None and lower > upper:
            source_issues.append('reversed_source_compute_bounds')
        if central is not None and ((lower is not None and central < lower) or (upper is not None and central > upper)):
            source_issues.append('central_compute_outside_source_bounds')
        # Inconsistent native observations stay in the ledger but can never
        # contribute to the derived scenario. Preserve decimals; never clamp.

        country = str(raw['Country (of organization)'] or '').strip()
        period = str(raw['Publication date'] or '').strip()
        year = date.fromisoformat(period).year if period else None
        status = ('excluded_inconsistent_source_compute' if source_issues else
            'excluded_source_wrong' if raw['Confidence'] == 'Wrong' else
            'missing_compute' if central is None else 'missing_country_category' if not country else
            'missing_publication_date' if year is None else
            'included_central_estimate' if central > limit else 'excluded_central_estimate')
        if status == 'included_central_estimate':
            counts[year][country] += 1
        details.append(observation(raw,metadata,model_id=model,year=year,country_category=country or None,
            compute_flop=central,compute_lower=lower,compute_upper=upper,confidence=raw['Confidence'],
            estimation_method=raw['Training compute estimation method'],selection_status=status,source_issues=source_issues,
            threshold_flop=limit,threshold_operator='strictly greater than',
            uncertainty_crosses_threshold=(not source_issues and lower is not None and upper is not None and lower <= limit < upper)))
    series = []; cumulative = Counter(); categories = sorted({k for v in counts.values() for k in v})
    for year in range(min(counts),max(counts)+1) if counts else []:
        cumulative.update(counts[year])
        for country in categories:
            series.append(dict(year=year,country_category=country,annual_models=counts[year][country],
                cumulative_models=cumulative[country],unit='curated models',threshold_flop=limit,
                method='central compute > threshold; literal source country categorical string; Wrong excluded'))
    return {'model_selection':details,'series':series}, {'status':'derived_scenario',
        'selection_statuses':dict(Counter(d['selection_status'] for d in details)),
        'source_issue_counts':dict(Counter(issue for d in details for issue in d['source_issues'])),
        'inconsistent_source_records':[dict(model_id=d['model_id'],selection_status=d['selection_status'],reasons=d['source_issues'],central_source=d['source_record']['Training compute (FLOP)'],lower_source=d['source_record']['Training compute lower bound'],upper_source=d['source_record']['Training compute upper bound']) for d in details if d['source_issues']],
        'figure_status':'HDR5.5 grouping and original snapshot unverified',
        'country_rule':'source category string preserved; multiple select syntax not guessed',
        'coverage':'Curated models; organizations association is not uniquely HQ; source documentation differs on > versus >=1e23'}


def ilo_tree(tree, metadata):
    """Reviewed 2023 author JSON tree: ISCO-08 nested children, name/risk leaves."""
    if tree.get('name') != 'ISCO-08':
        raise ValueError('Unexpected original tree root')
    rows = []
    def walk(node,path):
        name = node.get('name')
        if not isinstance(name,str):
            raise ValueError('Missing tree name')
        path = path + [name]
        if 'children' in node:
            if not isinstance(node['children'],list) or 'risk' in node:
                raise ValueError('Unexpected branch schema')
            for child in node['children']:
                walk(child,path)
        else:
            match = re.fullmatch(r'(\d{4}) - (.+)',name)
            if not match or not node.get('risk'):
                raise ValueError('Unexpected original leaf schema')
            rows.append(dict(isco=match.group(1),risk=node['risk'],name=name,source_tree_path=path))
    walk(tree,[])
    return ilo_risks(rows,dict(isco='isco',risk='risk'),metadata,'author_2023_leaf_schema_reviewed')


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
    rows, _ = rupp(['# synthetic header','2020.25 100000'], m, 1)
    assert rows[0]['value'] == Decimal('100000') and rows[0]['unit'] == 'thousand transistors' and rows[0]['fractional_year'] == Decimal('2020.25')
    columns = {k:k for k in ['id','date','compute','compute_lower','compute_upper','countries','estimated']}
    rows, c = epoch([dict(id='m',date='2024-01-01',compute='2e23',compute_lower='9e22',compute_upper='3e23',countries=['A','B'],estimated=True),
                     dict(id='n',date='2024-02-01',compute='1e23',compute_lower=None,compute_upper=None,countries=['A'],estimated=False)],columns,m,
                     multi_hq_rule='multinational_if_multiple_distinct_hq_countries')
    assert rows['series'][0]['cumulative_models'] == 1
    assert rows['model_selection'][0]['uncertainty_crosses_threshold']
    assert c['selection_statuses']['excluded_central_estimate'] == 1
    assert park([],{},m)[1]['status'] == 'blocked'
    assert ilo_risks([],{},m)[1]['status'] == 'blocked'
    tree = {'name':'ISCO-08','children':[{'name':'0','children':[{'name':'0110 - Example','risk':'Not Affected'}]}]}
    rows,c = ilo_tree(tree,m)
    assert rows[0]['isco08'] == '0110' and c['employment_shares_status'].startswith('blocked')
    native = {'Model':'fixture','Publication date':'2024-01-01','Training compute (FLOP)':'2e23',
        'Training compute lower bound':'9e22','Training compute upper bound':'3e23',
        'Country (of organization)':'Multinational','Confidence':'Likely','Training compute estimation method':'Estimated'}
    rows,c = epoch_source([native,dict(native,Model='wrong',Confidence='Wrong')],m)
    assert rows['series'][0]['cumulative_models'] == 1 and c['selection_statuses']['excluded_source_wrong'] == 1
    print('chapter5–6 synthetic fidelity checks passed')


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--self-test', action='store_true'); a = p.parse_args()
    if a.self_test:
        self_test()
    else:
        p.error('Cloud caller must provide source rows and verified column mappings; no implicit fetch or publication')
