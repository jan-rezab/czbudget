#!/usr/bin/env python3
"""Resume a public DataPAQ snapshot: every catalogued variant and native geography."""
import argparse, collections, concurrent.futures, gzip, hashlib, json, time, urllib.request
from pathlib import Path

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()

def fetch(url, body=None):
    for attempt in range(5):
        try:
            request = urllib.request.Request('https://datapaq.cz/api/' + url,
                data=encode(body) if body is not None else None,
                headers={'Accept-Encoding': 'gzip', 'Content-Type': 'application/json', 'User-Agent': 'PublicSpendingData research snapshot/1.0'})
            with urllib.request.urlopen(request, timeout=180) as response:
                data = response.read()
                result = json.loads(gzip.decompress(data) if response.headers.get('Content-Encoding') == 'gzip' else data)
            time.sleep(.15)
            return result
        except Exception:
            if attempt == 4: raise
            time.sleep(2 ** attempt)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    root = Path(args.output); root.mkdir(parents=True, exist_ok=True)
    for name in ['metadata', 'responses', 'requests']: (root/name).mkdir(exist_ok=True)
    bootstrap = root/'bootstrap.json'
    if not bootstrap.exists(): bootstrap.write_bytes(encode(fetch('bootstrap')))
    catalog = json.loads(bootstrap.read_bytes())
    variables = catalog['catalogue_variables']
    for i, variable in enumerate(variables):
        target = root/'metadata'/f"{variable['id']}.json"
        if not target.exists(): target.write_bytes(encode(fetch(f"variables/{variable['id']}")))
        if i % 25 == 0: print(f'Metadata {i+1}/{len(variables)}', flush=True)
    jobs = []
    for variable in variables:
        groups = collections.defaultdict(list)
        for variant in variable['variants']:
            for granularity in variant['available_granularities']:
                groups[(granularity, variant['values_type_key'])].append(variant['period_key'])
        for (granularity, value_type), periods in groups.items():
            # Small independent requests make retries exact and avoid API response limits.
            for offset in range(0, len(periods), 12):
                jobs.append((variable['key'], granularity, value_type, sorted(set(periods[offset:offset+12]))))
    batches = []
    for gran in ['obec', 'orp', 'okres', 'kraj', 'stat']:
        pending = []; size = 0
        for key, level, value_type, periods in jobs:
            if level != gran: continue
            if pending and size + len(periods) > 24:
                batches.append((gran, pending)); pending = []; size = 0
            pending.append({'variableKey': key, 'valuesTypeKey': value_type, 'periodKeys': periods}); size += len(periods)
        if pending: batches.append((gran, pending))
    jobs = batches
    manifest = {'source': 'https://datapaq.cz', 'license': 'CC-BY-NC-4.0',
        'license_url': 'https://creativecommons.org/licenses/by-nc/4.0/',
        'attribution': 'PAQ Research / DataPAQ; individual original sources in metadata and measures',
        'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'variables': len(variables), 'requested_jobs': len(jobs), 'responses': [], 'errors': []}
    def download(job):
        gran, measures = job
        key = ','.join(m['variableKey'] for m in measures)
        body = {'granularity': gran, 'measures': measures,
            'visualization': 'table', 'regionFilter': {'type': gran, 'codes': []},
            'totals': {k: False for k in ['countrySum','countryAverage','krajSum','krajAverage','okresSum','okresAverage','orpSum','orpAverage','orpLikeMineAverage']},
            'measuresOptions': {'prepareValueMeasures': True, 'preparePeriodsAbsDiffMeasures': False, 'preparePeriodsRelDiffMeasures': False},
            'periods': {'showAbsoluteChanges': False, 'showRelativeChanges': False},
            'table': {'sortBy': 'region', 'sortDirection': 'asc'}, 'map': {},
            'barchart': {'limit': 0, 'sortBy': '', 'sortDirection': 'desc'}, 'title': ''}
        digest = hashlib.sha256(encode(body)).hexdigest()[:24]
        target = root/'responses'/f'{digest}.json.gz'
        (root/'requests'/f'{digest}.json').write_bytes(encode(body))
        try:
            if target.exists(): result = json.loads(gzip.decompress(target.read_bytes()))
            else:
                result = fetch('compute', body)
                if not isinstance(result.get('rows'), list) or not result.get('measures'): raise ValueError('Invalid compute response')
                target.write_bytes(gzip.compress(encode(result), mtime=0))
            return {'response': {'id': digest, 'variable': key, 'granularity': gran,
                'requested_measures': measures, 'rows': len(result['rows']),
                'measures': len(result['measures']), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}}
        except Exception as error:
            return {'error': {'id': digest, 'variable': key, 'granularity': gran, 'error': str(error)}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
      for i, outcome in enumerate(executor.map(download, jobs)):
        if 'error' in outcome: manifest['errors'].append(outcome['error']); print(outcome, flush=True)
        else: manifest['responses'].append(outcome['response'])
        if i % 10 == 0 or i == len(jobs)-1:
            (root/'manifest.json').write_bytes(encode(manifest))
            print(f'Data {i+1}/{len(jobs)}; errors={len(manifest["errors"])}', flush=True)
    manifest['completed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (root/'manifest.json').write_bytes(encode(manifest))
    if manifest['errors']: raise SystemExit(1)

if __name__ == '__main__': main()
