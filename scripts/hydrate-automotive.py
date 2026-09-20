#!/usr/bin/env python3
"""Load the pinned automotive serving asset on Cloud Build, never raw data locally."""
import collections,hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def validate(data):
    assert data['schema_version']=='automotive-monthly.v1'
    assert len(data['eu27'])==27 and len(set(data['eu27']))==27
    assert len(data['panel'])==len(set(data['panel'])) and len(data['panel'])>=20
    assert data['periods']==sorted(set(data['periods'])) and len(data['periods'])>=2
    assert len(data['rows'])==len(data['panel'])*len(data['periods'])*3
    seen=set()
    for row in data['rows']:
        key=(row['period'],row['market'],row['segment'])
        assert key not in seen and key[0] in data['periods'] and key[1] in data['panel'] and key[2] in {'vehicles','trucks','parts'}
        seen.add(key)
        assert set(row['values'])==set(row['values_all'])=={'USA','EU27','CHN','ROW'}
        assert all(isinstance(v,(int,float)) and 0<=v<1e15 for values in (row['values'],row['values_all']) for v in values.values())
        assert all(row['values'][region]==row['values_all'][region] for region in {'USA','CHN','ROW'})
        assert row['values']['EU27']==(0 if row['market'] in data['eu27'] else row['values_all']['EU27'])
    origins={o['code']:o for o in data['origins']}
    assert len(origins)==len(data['origins']) and all(o['region'] in {'USA','EU27','CHN','ROW'} for o in origins.values())
    route_keys=set();totals=collections.defaultdict(float);external=collections.defaultdict(float)
    for route in data['routes']:
        key=(route['period'],route['market'],route['segment'])
        assert key in seen and route['origin'] in origins
        route_key=(*key,route['origin'])
        assert route_key not in route_keys
        route_keys.add(route_key)
        assert isinstance(route['value'],(int,float)) and 0<route['value']<1e15
        totals[(*key,origins[route['origin']]['region'])]+=route['value']
        if not (origins[route['origin']]['region']=='EU27' and route['market'] in data['eu27']):
            external[(*key,origins[route['origin']]['region'])]+=route['value']
    for row in data['rows']:
        for field,route_totals in [('values',external),('values_all',totals)]:
            for region,value in row[field].items():
                assert abs(route_totals[(row['period'],row['market'],row['segment'],region)]-value)<=max(.05,value*1e-9),f'Routes do not reconcile with {field}'
    return data

def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Hydration is cloud-only. Use a synthetic fixture for local tests.')
    receipt=json.loads((ROOT/'data/trade/automotive-release.v1.json').read_text())
    prefix='gs://czbudget-janrezab-data-layers/processing-runs/automotive/'
    assert receipt['uri'].startswith(prefix) and receipt['completed_receipt'].startswith(prefix)
    def cat(uri):return subprocess.check_output(['gcloud','storage','cat',uri])
    completed=json.loads(cat(receipt['completed_receipt']))
    assert completed['status']=='complete' and completed['files']['automotive-monthly.v1.json']==receipt['sha256']
    raw=cat(receipt['uri']+'#'+receipt['generation'])
    assert len(raw)==receipt['bytes'] and hashlib.sha256(raw).hexdigest()==receipt['sha256']
    data=validate(json.loads(raw))
    target=ROOT/'data/trade/automotive-monthly.v1.json';target.write_bytes(raw)
    missing=[(p,m,s) for p in data['periods'] for m in data['panel'] for s in ['vehicles','trucks','parts'] if not any((r['period'],r['market'],r['segment'])==(p,m,s) for r in data['rows'])]
    print('Automotive snapshot verified:',len(raw),'bytes;',len(data['panel']),'markets;',len(data['periods']),'months; missing observations:',missing)
if __name__=='__main__':main()
