"""Homogeneous WID snapshots; complete native histories are separate exports."""
from copy import deepcopy
from collections import defaultdict
import re

def merge_wid_snapshots(charts):
    kept=[];groups=defaultdict(list);exports={}
    for c in charts:
        if c['id'].startswith('provider-wid-current-'):
            refs=c['source_refs']
            if len(refs)!=1 or refs[0]['table']!='sptincj992' or c['unit']!='proportion':raise ValueError('WID native definition mismatch')
            groups[(refs[0]['vintage'],c['unit'],refs[0]['table'])].append(c)
        else:kept.append(c)
    for (vintage,unit,metric),members in groups.items():
        base=deepcopy(members[0]);history=[];sources={};latest={};seen={}
        for c in members:
            if c['denominator']!=base['denominator']:raise ValueError('Different WID denominators cannot merge')
            source=c['source_refs'][0];sources[source['source_id']]=source
            for row in c['rows']:
                r=dict(row,source_id=source['source_id'])
                if not re.fullmatch(r'[0-9]{4}',str(r['period'])):raise ValueError('Nonannual WID period')
                history.append(r)
                if r['value'] is None:continue
                key=(r['country'],r['period'])
                if key in seen and seen[key]!=r['value']:raise ValueError('Conflicting WID country-year source values')
                seen[key]=r['value']
                if r['country'] not in latest or int(r['period'])>int(latest[r['country']]['period']):latest[r['country']]={k:v for k,v in r.items() if k!='source_record_json'}
        if not latest:continue
        base['id']='provider-wid-top1-latest-'+re.sub(r'[^a-z0-9]+','-',vintage.lower()).strip('-')
        base['title']={'en':'Top 1% pretax national income share — latest available per country','cs':'Podíl horního 1% na příjmu před zdaněním — poslední dostupný rok za zemi'}
        base['rows']=sorted(latest.values(),key=lambda r:r['country']);base['source_refs']=list(sources.values());base['chart_type']='bar'
        base['method']={'en':'Latest nonmissing native observation for each country/region; observation years differ and are shown for every row. One native variable (sptincj992), age 992, population j, percentile p99p100 and source edition throughout. Full country histories and exact per-source provenance remain in observations.csv and chart-details.json. No common-year ranking or historical trend is implied.','cs':'Poslední neprázdné původní pozorování za zemi/region; roky se liší a jsou uvedeny u každého řádku. Jedna původní proměnná sptincj992, věk 992, populace j, percentil p99p100 a vydání zdroje. Celé historie a přesný původ zůstávají v observations.csv a chart-details.json. Nejde o pořadí ve společném roce ani historický trend.'}
        base['latest_period']=max(r['period'] for r in base['rows']);base['native_history_rows']=len(history);base['row_details_download']='chart_details';base['presentation_scope']='latest_available_per_country; full native history separately exported'
        exports[base['id']]=history;kept.append(base)
    return kept,exports
