"""Lossless presentation compaction. Detailed rows remain a separate download."""
from collections import defaultdict
import re

def compact_chart(chart):
    original=chart['rows'];fields=[f['key'] for f in chart['fields']]
    missing=defaultdict(list);retained=[]
    for row in original:
        if fields and all(row.get(k) is None for k in fields) and row.get('country') and 'period' in row and not row.get('label'):
            missing[row['country']].append(row['period']);continue
        retained.append({k:v for k,v in row.items() if k not in {'weighted_n','unweighted_n','valid_share','missing_kind','source_code'}} if chart['id'].startswith('ai-survey-') else dict(row))
    ranges={};other={}
    for country,periods in sorted(missing.items()):
        if len(set(map(str,periods)))!=len(periods):raise ValueError('Duplicate missing country-period cannot be compacted')
        years=sorted(int(v) for v in periods if re.fullmatch(r'[0-9]{4}',str(v)))
        rest=[v for v in periods if not re.fullmatch(r'[0-9]{4}',str(v))]
        groups=[]
        for year in years:
            if groups and year==groups[-1]['end']+1:groups[-1]['end']=year
            else:groups.append(dict(start=year,end=year))
        if groups:ranges[country]=groups
        if rest:other[country]=rest
    if missing:
        chart['missing_periods_by_country']=ranges
        if other:chart['missing_period_values_by_country']=other
        chart['native_coverage']=dict(received_rows=len(original),nonmissing_rows=len(retained),missing_rows=sum(map(len,missing.values())))
    if chart['id'].startswith('ai-survey-'):chart['row_details_download']='chart_details'
    null_count=sum(v is None for r in retained for v in r.values())
    if null_count:
        retained=[{k:v for k,v in r.items() if v is not None} for r in retained]
        chart['explicit_null_keys_omitted']=null_count
    # Calendar-year string→integer is an exact coordinate encoding, not rounding.
    if retained and all('period' in r and re.fullmatch(r'[0-9]{4}',str(r['period'])) for r in retained) and not any('label' in r for r in retained):
        for r in retained:r['year']=int(r.pop('period'))
        chart['annual_period_encoding']='year_integer; original period strings preserved in chart_details'
    defaults={}
    if retained:
        for key in ['country','period','year']:
            if all(key in r and r[key]==retained[0].get(key) for r in retained):
                defaults[key]=retained[0][key]
        if defaults:
            for r in retained:
                for key in defaults:r.pop(key)
            chart['row_defaults']=defaults
    if chart['id'].startswith('hdro-indices-') and retained:
        columns=[k for k in ['country','year','period'] if any(k in r for r in retained)]+[f['key'] for f in chart['fields']]
        if len(columns)!=len(set(columns)):raise ValueError('Duplicate tuple columns')
        if any(set(r)-set(columns) for r in retained):raise ValueError('Undeclared core row key')
        chart['row_columns']=columns
        retained=[[r.get(k) for k in columns] for r in retained]
    chart['rows']=retained
    return original

def expanded_rows(chart):
    """Restore exact explicit null observations; never infer unknown missing years."""
    columns=chart.get('row_columns')
    if columns and (not isinstance(columns,list) or not all(isinstance(k,str) for k in columns) or len(columns)!=len(set(columns)) or not {f['key'] for f in chart['fields']}<=set(columns)):raise ValueError('Invalid tuple columns')
    for row in chart['rows']:
        if columns:
            if not isinstance(row,list) or len(row)!=len(columns):raise ValueError('Tuple row width mismatch')
            row=dict(zip(columns,row))
        restored=dict({f['key']:None for f in chart['fields']},**chart.get('row_defaults',{}));restored.update(row)
        yield restored
    for country,groups in chart.get('missing_periods_by_country',{}).items():
        for group in groups:
            for year in range(group['start'],group['end']+1):
                yield dict(country=country,**({'year':year} if chart.get('annual_period_encoding') else {'period':str(year)}),**{f['key']:None for f in chart['fields']})
    for country,periods in chart.get('missing_period_values_by_country',{}).items():
        for period in periods:yield dict(country=country,period=period,**{f['key']:None for f in chart['fields']})
