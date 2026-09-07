#!/usr/bin/env python3
"""Append a new, immutable Eurostat STS_INPR_M snapshot beside national data."""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

GEOS = {'CZE': 'CZ', 'UKR': 'UA', 'POL': 'PL', 'DEU': 'DE', 'GBR': 'UK',
        'FRA': 'FR', 'USA': 'US', 'CHE': 'CH', 'SWE': 'SE', 'DNK': 'DK'}
BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_inpr_m'


def decode(data, country, meta):
    """Decode sparse JSON-stat positions without assuming dimension order."""
    ids, sizes = data['id'], data['size']
    categories = {}
    for dimension in ids:
        index = data['dimension'][dimension]['category']['index']
        categories[dimension] = {v: k for k, v in index.items()} if isinstance(index, dict) else dict(enumerate(index))
    values = data.get('value', {})
    items = enumerate(values) if isinstance(values, list) else values.items()
    statuses = data.get('status', {})
    for position, value in items:
        if value is None:
            continue
        assert isinstance(value, (int, float)) and math.isfinite(value)
        offset, key = int(position), {}
        for dimension, size in reversed(list(zip(ids, sizes))):
            offset, index = divmod(offset, size)
            key[dimension] = categories[dimension][index]
        assert offset == 0
        if not key['time'].startswith('2026-'):
            continue
        assert key['freq'] == 'M' and key['indic_bt'] == 'PRD'
        unit = key['unit']
        measure = {'PCH_PRE': 'mom_pct', 'PCH_SM': 'yoy_pct'}.get(unit, 'index' if unit in ['I21', 'I15', 'I10'] else None)
        assert measure, f'Unrecognized unit: {unit}'
        flag = statuses[int(position)] if isinstance(statuses, list) else statuses.get(str(position))
        row = dict(country=country, publisher='Eurostat', disseminator='Eurostat', source_channel='eurostat',
                   dataset='sts_inpr_m', series_id='.'.join(key[k] for k in ids if k != 'time'),
                   industry_code=key['nace_r2'], industry_label=data['dimension']['nace_r2']['category']['label'][key['nace_r2']],
                   frequency='M', period=key['time'], measure=measure, adjustment=key['s_adj'],
                   unit='percent' if measure != 'index' else 'index', base_period={'I21': '2021', 'I15': '2015', 'I10': '2010'}.get(unit),
                   value=value, status='provisional' if flag and 'p' in flag.split() else 'unknown', source_status=flag,
                   classification='NACE Rev.2', source_dimensions=key, source_dataset_updated_at=data.get('updated'),
                   publication_at=None, vintage_at=None, method_version='industrial-federation/1.0.0',
                   **{k: meta[k] for k in ['source_url', 'retrieved_at', 'raw_file']})
        row['observation_id'] = hashlib.sha256(json.dumps([row['series_id'], row['period'], meta['sha256']], separators=(',', ':')).encode()).hexdigest()
        yield row


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    out = args.output.resolve()
    if out.exists() and any(out.iterdir()):
        p.error('Output must be new or empty; existing snapshots are never overwritten')
    (out / 'raw').mkdir(parents=True, exist_ok=True)
    manifests, rows, coverage = [], [], {}

    def fetch(name, params):
        url = BASE + '?' + urllib.parse.urlencode(dict(lang='EN', **params))
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    raw = response.read()
                break
            except urllib.error.HTTPError as exc:
                if exc.code not in (413, 429, 500, 502, 503, 504) or attempt == 2:
                    raise
                # Statistics API uses 413 to signal asynchronous preparation.
                retry = exc.headers.get('Retry-After', '')
                time.sleep(min(30, int(retry)) if retry.isdigit() else 5 * (attempt + 1))
            except (urllib.error.URLError, TimeoutError):
                if attempt == 2:
                    raise
                time.sleep(1 + attempt)
        path = out / 'raw' / name
        path.write_bytes(raw)
        meta = dict(source_url=url, retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(), raw_file=str(path),
                    sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), method='GET')
        manifests.append(meta)
        return json.loads(raw), meta

    catalogue, _ = fetch('geography-catalogue.json', dict(nace_r2='B-D', unit='I21', s_adj='NSA', lastTimePeriod='1'))
    geos = catalogue['dimension']['geo']['category']['index']
    for country, geo in GEOS.items():
        try:
            # Query all requested codes, even if absent from the aggregate catalogue:
            # aggregate absence alone cannot establish absence in every detail series.
            data, meta = fetch(country + '.json', dict(geo=geo, freq='M', sinceTimePeriod='2026-01', untilTimePeriod='2026-12'))
            if data.get('error'):
                raise ValueError(data['error'])
            subset = list(decode(data, country, meta))
            rows.extend(subset)
            coverage[country] = dict(status='downloaded' if subset else 'no_observations_for_2026', observations=len(subset),
                                     periods=sorted({r['period'] for r in subset}), series=len({r['series_id'] for r in subset}),
                                     source_url=meta['source_url'], dataset_updated_at=data.get('updated'))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode('utf-8', 'replace')
            coverage[country] = dict(status='request_error', observations=0, http_status=exc.code, error=body,
                                     listed_in_aggregate_geography_catalogue=geo in geos)
        except Exception as exc:
            coverage[country] = dict(status='request_error', observations=0, error=str(exc))
        print(country, coverage[country]['status'], coverage[country]['observations'], flush=True)
    keys = [(r['series_id'], r['period']) for r in rows]
    assert len(keys) == len(set(keys))
    blob = ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows).encode()
    (out / 'observations.jsonl').write_bytes(blob)
    (out / 'observations.jsonl.gz').write_bytes(gzip.compress(blob, mtime=0))
    for name, value in [('manifest.json', manifests), ('coverage.json', coverage)]:
        (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    if any(v['status'] == 'request_error' for v in coverage.values()):
        raise SystemExit('Snapshot saved with explicit request errors; inspect coverage.json')


if __name__ == '__main__':
    main()
