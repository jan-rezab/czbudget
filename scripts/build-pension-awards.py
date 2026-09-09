#!/usr/bin/env python3
"""Append official award-year distributions without inventing current cohort payments."""
import csv
import hashlib
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'pipeline/source_data/pensions'

def build(data):
    bands = list(csv.DictReader((BASE / 'cssz-new-awards-bands.csv').open()))
    means = list(csv.DictReader((BASE / 'cssz-new-awards-means.csv').open()))
    result = {}
    for year in sorted({r['referencni_obdobi'] for r in bands}):
        result[year] = {}
        for sex, code in [('total', 'T'), ('male', 'M'), ('female', 'F')]:
            result[year][sex] = {}
            for kind, pension in [('all', 'PK_OLDAGE_S4' if int(year) < 2010 else 'PK_OLDAGE_S3'), ('regular', 'PK_S'), ('early', 'PK_ST')]:
                rows = [r for r in bands if (r['referencni_obdobi'], r['pohlavi_kod'], r['druh_duchodu_kod']) == (year, code, pension)]
                assert rows, (year, sex, kind)
                values = []
                count = unknown = 0
                for r in rows:
                    n = int(float(r['pocet_nove_priznanych_duchodu']))
                    label = r['vyse_duchodu']
                    if label == 'Celkem': count = n
                    elif label == 'Neudáno': unknown = n
                    else:
                        nums = [int(v) for v in re.findall(r'\d+', label)]
                        assert nums, label
                        values.append(dict(lower=nums[0], upper=None if '+' in label else nums[-1], count=n))
                values.sort(key=lambda b: b['lower'])
                assert sum(b['count'] for b in values) + unknown == count
                cumulative = 0
                median = None
                for b in values:
                    cumulative += b['count']
                    if median is None and cumulative >= (count - unknown) / 2:
                        median = {k: b[k] for k in ['lower', 'upper']}
                m = [r for r in means if (r['referencni_obdobi'], r['pohlavi_kod'], r['druh_duchodu_kod']) == (year, code, pension)]
                assert len(m) == 1
                result[year][sex][kind] = dict(count=count, unknown_count=unknown, mean=float(m[0]['prumerna_vyse_duchodu_u_nove_priznanych_duchodu']), median_band=median, bands=values)
    data['countries']['CZE']['national']['awards_by_year'] = result
    for key, file, dataset in [('cssz_awards', 'cssz-new-awards-bands.csv', 'nove-priznane-duchody-dle-vyse-duchodu'), ('cssz_award_means', 'cssz-new-awards-means.csv', 'prum-vyse-duchodu-u-nove-priznanych-duchodu-podle-druhu-duchodu')]:
        data['sources'][key] = dict(url='https://data.cssz.cz/dataset/' + dataset, table=dataset, extracted_at='2026-09-09', year=2025, vintage='outturn', file=file, sha256=hashlib.sha256((BASE/file).read_bytes()).hexdigest())
    return data

if __name__ == '__main__':
    path = ROOT / 'data/pensions-today.v1.json'
    path.write_text(json.dumps(build(json.loads(path.read_text())), ensure_ascii=False, indent=2) + '\n')
