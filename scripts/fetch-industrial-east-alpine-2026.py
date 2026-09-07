#!/usr/bin/env python3
"""Download national Swiss and Ukrainian industrial production, reference year 2026."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET

import openpyxl


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    out = args.output.resolve()
    (out / 'raw').mkdir(parents=True, exist_ok=True)
    manifest, observations, missing = [], [], []

    def fetch(name, url, payload=None):
        headers = {'User-Agent': 'IndustrialResearch/1.0', 'Accept-Language': 'en'}
        if payload is not None:
            headers.update({'Content-Type': 'application/json', 'Accept': 'application/vnd.sdmx.data+json;version=2.0.0'})
        req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None, headers=headers)
        with urllib.request.urlopen(req, timeout=90) as response:
            raw = response.read()
        path = out / 'raw' / name
        path.write_bytes(raw)
        entry = dict(source_url=url, retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(), raw_file=str(path),
                     sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), method='POST' if payload else 'GET')
        if payload:
            entry['request_body'] = payload
        manifest.append(entry)
        return raw, entry

    for adjustment, asset in [('NSA', '36815387'), ('CA', '36815399'), ('SA', '36815393')]:
        _, source = fetch(f'che-{adjustment.lower()}.xlsx', f'https://dam-api.bfs.admin.ch/hub/api/dam/assets/{asset}/master')
        book = openpyxl.load_workbook(source['raw_file'], read_only=True, data_only=True)
        for sheet in book:
            rows = list(sheet.values)
            subtitle = str(rows[1][0])
            if '2021 = 100' in subtitle:
                measure, base, unit = 'index', '2021', 'index (2021=100)'
            elif 'year-on-year' in subtitle:
                measure, base, unit = 'yoy_pct', None, 'percent'
            elif 'previous month' in subtitle or 'month-on-month' in subtitle:
                measure, base, unit = 'mom_pct', None, 'percent'
            else:
                raise ValueError(f'Unknown Swiss measure: {subtitle}')
            periods = {i: f'2026-{v[:2]}' for i, v in enumerate(rows[2]) if isinstance(v, str) and re.fullmatch(r'\d{2}\.2026', v)}
            assert periods, 'Swiss file has no 2026 columns'
            for row in rows[4:]:
                label = str(row[2] or '').strip()
                if label.startswith('Turnover'):
                    break
                if not label:
                    continue
                # Destination aggregates have no NOGA code in the source.
                code = str(row[0] or row[1] or 'destination:' + label)
                for column, period in periods.items():
                    value = row[column]
                    if not isinstance(value, (int, float)):
                        missing.append(dict(country='CHE', industry_code=code, period=period, measure=measure, adjustment=adjustment, marker=value))
                        continue
                    observations.append(dict(country='CHE', publisher='Swiss Federal Statistical Office', dataset='INDPAU monthly production, release 2026-0246',
                        series_id=f'INDPAU.{code}.{adjustment}.{measure}', industry_code=code, industry_label=label,
                        frequency='M', period=period, measure=measure, adjustment=adjustment, unit=unit, base_period=base,
                        value=value, status='provisional', source_url=source['source_url'], retrieved_at=source['retrieved_at'], raw_file=source['raw_file'],
                        source_sheet=sheet.title, release_date='2026-08-19'))
        book.close()

    api = 'https://stat.gov.ua/sdmx/workspaces/default:integration/registry/sdmx/'
    raw, _ = fetch('ukr-structure.xml', api + '2.1/dataflow/SSSU/DF_IND_SHORT_STAT_INDUSTR_PROD/latest?references=all')
    root = ET.fromstring(raw)
    labels = {}
    version = None
    for node in root.iter():
        if node.tag.endswith('Dataflow') and node.get('id') == 'DF_IND_SHORT_STAT_INDUSTR_PROD':
            version = node.get('version')
        if node.tag.endswith('Codelist'):
            codes = {}
            for code in node:
                names = {n.get('{http://www.w3.org/XML/1998/namespace}lang'): n.text for n in code if n.tag.endswith('Name')}
                if code.get('id'):
                    codes[code.get('id')] = names.get('en') or names.get('uk') or code.get('id')
            labels[node.get('id')] = codes
    assert version
    payload = dict(_type='SdmxDataQueryV3', includeHistory='false', messageVersion='2.0.0', agencyID='SSSU',
                   resourceID='DF_IND_SHORT_STAT_INDUSTR_PROD', version=version, detail='full', attributes='all', limit=200000,
                   filters=[dict(componentCode='REGION', operator='eq', value='UA00000000000000000'),
                            dict(componentCode='TIME_PERIOD', operator='ge', value='2026-01'),
                            dict(componentCode='TIME_PERIOD', operator='le', value='2026-12')])
    raw, source = fetch('ukr-2026.json', api + '3.0/dataflow', payload)
    data = json.loads(raw)['data']
    structure = data['structures'][0]
    dimensions = structure['dimensions']['series']
    times = structure['dimensions']['observation'][0]['values']
    bases = {
        'ADJ_AVG_M_VAL_SEAS_CALEN': ('SCA', 'index', '2016'),
        'ADJ_CALEN_M_VAL_EFFECT_DAY': ('CA', 'index', '2016'),
        'UNADJ_AVG_M_VAL_DYM_R': ('NSA', 'index', '2016'),
        'UNADJ_CORR_MON_PREV_Y': ('NSA', 'yoy_index', 'same month previous year=100'),
        'UNADJ_CORR_PER_PREV_Y': ('NSA', 'ytd_yoy_index', 'same cumulative period previous year=100'),
        'UNADJ_PREV_MONTH': ('NSA', 'mom_index', 'previous month=100'),
    }
    for key, series in data['dataSets'][0]['series'].items():
        dims = {d['id']: d['values'][int(i)]['id'] for d, i in zip(dimensions, key.split(':'))}
        assert dims['REGION'] == 'UA00000000000000000'
        adjustment, measure, base = bases[dims['BASE']]
        note = series.get('attributes', [])[-1]
        for time_key, values in series['observations'].items():
            period = times[int(time_key)]['value'].replace('-M', '-')
            assert re.fullmatch(r'2026-\d{2}', period)
            try:
                value = float(values[0])
                assert math.isfinite(value)
            except (ValueError, TypeError, AssertionError):
                missing.append(dict(country='UKR', series_id=key, period=period, marker=values))
                continue
            observations.append(dict(country='UKR', publisher='State Statistics Service of Ukraine', dataset=f'DF_IND_SHORT_STAT_INDUSTR_PROD({version})',
                series_id='.'.join(dims.values()), industry_code=dims['BREAKDOWN'], industry_label=labels['CL_IND_SHORT_STAT_INDUSTR_PROD_BREAKDOWN'][dims['BREAKDOWN']],
                frequency='M', period=period, measure=measure, adjustment=adjustment, unit='index (comparison base=100)', base_period=base,
                value=value, status='unknown', source_url=source['source_url'], retrieved_at=source['retrieved_at'], raw_file=source['raw_file'],
                source_base_label=labels['CL_BASE'][dims['BASE']], source_notes=note))
    coverage = []
    for country in ['CHE', 'UKR']:
        subset = [r for r in observations if r['country'] == country]
        assert subset, country + ' returned no observations'
        coverage.append(dict(country=country, rows=len(subset), periods=sorted({r['period'] for r in subset}),
                             industries=len({r['industry_code'] for r in subset}), series=len({r['series_id'] for r in subset}),
                             limitations=['Monthly observations released quarterly; water/waste industry suppressed.'] if country == 'CHE' else
                             ['Territorial coverage excludes occupied territories and some areas affected by combat; see raw dataset notes.',
                              'Year-on-year and previous-month ratios remain indices with comparison=100, not percent changes.']))
    (out / 'observations.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in observations))
    for name, obj in [('manifest.json', manifest), ('coverage.json', coverage), ('missing.json', missing)]:
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(coverage, ensure_ascii=False))


if __name__ == '__main__':
    main()
