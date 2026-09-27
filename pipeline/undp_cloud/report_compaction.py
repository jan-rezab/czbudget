"""Lossless presentation compaction. Detailed rows remain a separate download."""
from collections import defaultdict
import re

def compact_chart(chart):
    original=chart['rows'];fields=[f['key'] for f in chart['fields']]
    missing=defaultdict(list);retained=[]
    for row in original:
        if fields and all(row.get(k) is None for k in fields) and row.get('country') and 'period' in row and not row.get('label'):
            missing[row['country']].append(row['period']);continue
        retained.append({k:v for k,v in row.items() if k not in {'weighted_n','unweighted_n','valid_share','missing_kind','source_code'}} if chart['id'].startswith('ai-survey-') else row)
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
    chart['rows']=retained
    return original

def expanded_rows(chart):
    """Restore exact explicit null observations; never infer unknown missing years."""
    yield from chart['rows']
    for country,groups in chart.get('missing_periods_by_country',{}).items():
        for group in groups:
            for year in range(group['start'],group['end']+1):
                yield dict(country=country,period=str(year),**{f['key']:None for f in chart['fields']})
    for country,periods in chart.get('missing_period_values_by_country',{}).items():
        for period in periods:yield dict(country=country,period=period,**{f['key']:None for f in chart['fields']})
