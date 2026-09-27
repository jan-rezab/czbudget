"""Pure country-specific history shards; retains every native row and period."""
import copy,hashlib,json,re,uuid
from collections import defaultdict
from datetime import datetime,timezone
MAX_BYTES=2*1024*1024
def dump(value):return json.dumps(value,ensure_ascii=False,separators=(",",":"),allow_nan=False).encode()
def stamp():return datetime.now(timezone.utc).isoformat()

def history_bundle(payload, details, release):
    """Pure lossless sharding; no invented years, country means or source stitching."""
    uuid.UUID(release)
    if details['release_id'] != payload['release_id']: raise ValueError('Details release differs')
    result = copy.deepcopy(payload)
    result['release_id'] = release
    result['generated_at'] = stamp()
    result['parent_review_release'] = payload['release_id']
    detailed = {entry['chart_id']:entry for entry in details['charts']}
    if len(detailed) != len(details['charts']): raise ValueError('Duplicate detailed chart')
    objects = {}
    for chart in result['charts']:
        wid=chart['id'].startswith('provider-wid-top1-latest-')
        component=bool(chart.get('native_history_complete') and re.fullmatch(r'hdro-(?:le|eys|mys|gnipc)-[^ ]+',chart['id']))
        wdi=chart['id'].startswith('provider-wdi-')
        material=chart['id'].startswith('provider-unep-irp-current-mfa-totals-ratios-')
        if not (wid or component or wdi or material): continue
        source = detailed.get(chart['id'])
        if not source or source['unit'] != chart['unit'] or source['source_refs'] != chart['source_refs']: raise ValueError('History definition differs')
        refs = {ref['source_id']:ref for ref in chart['source_refs']}
        countries = defaultdict(list)
        seen = set()
        for native_row in source['rows']:
            row=copy.deepcopy(native_row)
            if not row.get('source_id') and len(refs)==1:row['source_id']=next(iter(refs))
            code, period = row.get('country'), str(row.get('period', row.get('year', '')))
            # Preserve native historical/aggregate geography identifiers such as
            # SRC-SERBIA-AND-MONTENEGRO without truncation or invented aliases.
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', code or '') or not re.fullmatch(r'[0-9]{4}', period): raise ValueError('Invalid native country/period')
            if row.get('source_id') not in refs: raise ValueError('Missing exact row source')
            key=(code, period)
            if key in seen: raise ValueError('Duplicate native country-period')
            seen.add(key); countries[code].append(copy.deepcopy(row))
        chart['history_by_country'] = {}
        for country, rows in sorted(countries.items()):
            rows.sort(key=lambda row:int(row.get('period',row.get('year'))))
            full = {key:copy.deepcopy(value) for key,value in chart.items() if key not in {'rows','history_by_country','row_columns','row_defaults','missing_periods_by_country','missing_period_values_by_country','annual_period_encoding','native_coverage','presentation_scope','explicit_null_keys_omitted'}}
            full['rows']=rows; full['chart_type']='line'
            if not any(row.get(field['key']) is not None for row in rows for field in chart['fields']):full['status']='unavailable'
            full['latest_period']=str(next((r.get('period',r.get('year')) for r in reversed(rows) if any(r.get(f['key']) is not None for f in chart['fields'])),rows[-1].get('period',rows[-1].get('year'))))
            if wid:
                full['title']={'en':'Top 1% pretax national income share — full observed history','cs':'Podíl horního 1 % na příjmu před zdaněním — celá pozorovaná historie'}
                full['method']={'en':'Complete observed native country history from one pinned WID edition: sptincj992, age 992, equal-split adults (j), percentile p99p100. Original values and quality metadata retained. Missing periods are not interpolated; country/region coverage and earliest years differ.','cs':'Úplná pozorovaná historie země z jednoho připnutého vydání WID: sptincj992, věk 992, dospělí s rovným dělením (j), percentil p99p100. Zachovány původní hodnoty i metadata kvality. Chybějící období nejsou interpolována; pokrytí a počáteční roky se liší.'}
            else:
                full['title']={lang:title.split(' — ')[0]+(' — full observed history' if lang=='en' else ' — celá pozorovaná historie') for lang,title in chart['title'].items()}
                full['method']={'en':'Complete native observations from one pinned source edition. Explicit source nulls remain null. No interpolated years, country averages or splicing across source vintages. Source definition and denominator retained.','cs':'Úplná původní pozorování z jednoho připnutého vydání. Původní chybějící hodnoty zůstávají chybějící. Bez interpolace, průměrů zemí nebo spojování různých vydání. Zachována definice i základ zdroje.'}
            ids={row['source_id'] for row in rows}
            full['source_refs']=[ref for ref in chart['source_refs'] if ref['source_id'] in ids]
            full['presentation_scope']='complete_native_history_for_one_country'
            name=f'static-assets/human-development/releases/{release}/history/{chart["id"]}/{country}.json'
            body=dump(full)
            if len(body)>MAX_BYTES: raise ValueError('History shard exceeds API bound')
            objects[name]=body
            chart['history_by_country'][country]=dict(object=name,sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),rows=len(rows),first_period=str(rows[0].get('period',rows[0].get('year'))),last_period=str(rows[-1].get('period',rows[-1].get('year'))))
        if sum(d['rows'] for d in chart['history_by_country'].values()) != len(source['rows']): raise ValueError('History row loss')
        if wdi or material:
            # A bounded index keeps only the actual latest country observation;
            # every earlier row is verified in the descriptor and detailed export.
            chart.pop('row_defaults',None);chart.pop('row_columns',None)
            chart.pop('missing_periods_by_country',None);chart.pop('missing_period_values_by_country',None)
            chart['rows']=[next((row for row in reversed(rows) if any(row.get(f['key']) is not None for f in chart['fields'])),rows[-1]) for rows in countries.values()]
            chart['presentation_scope']='latest_snapshot; full native country history loaded on selection'
    if not objects: raise ValueError('No verified histories found')
    result['coverage']['history_export']=dict(shards=len(objects),rows=sum(len(json.loads(body)['rows']) for body in objects.values()),method='Every native WID/WDI/material-footprint and selected HDRO component history row retained; per-country bounded objects; no interpolation or across-vintage stitching.')
    return result, objects
