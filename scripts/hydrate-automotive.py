#!/usr/bin/env python3
"""Load the pinned automotive serving asset on Cloud Build, never raw data locally."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def validate(data):
    assert data['schema_version']=='automotive-monthly.v1'
    assert len(data['panel'])==len(set(data['panel'])) and len(data['panel'])>=20
    assert data['periods']==sorted(set(data['periods'])) and len(data['periods'])>=2
    seen=set()
    for row in data['rows']:
        key=(row['period'],row['market'],row['segment'])
        assert key not in seen and key[0] in data['periods'] and key[1] in data['panel'] and key[2] in {'vehicles','trucks','parts'}
        seen.add(key)
        assert set(row['values'])=={'USA','EU27','CHN','ROW'}
        assert all(isinstance(v,(int,float)) and 0<=v<1e15 for v in row['values'].values())
    return data

def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Hydration is cloud-only. Use a synthetic fixture for local tests.')
    receipt=json.loads((ROOT/'data/trade/automotive-release.v1.json').read_text())
    prefix='gs://czbudget-janrezab-data-layers/processing-runs/automotive/'
    assert receipt['uri'].startswith(prefix) and receipt['completed_receipt'].startswith(prefix)
    def cat(uri):return subprocess.check_output(['gcloud','storage','cat',uri])
    completed=cat(receipt['completed_receipt']).decode().splitlines()
    assert f"{receipt['sha256']}  automotive-monthly.v1.json" in completed
    raw=cat(receipt['uri']+'#'+receipt['generation'])
    assert len(raw)==receipt['bytes'] and hashlib.sha256(raw).hexdigest()==receipt['sha256']
    data=validate(json.loads(raw))
    target=ROOT/'data/trade/automotive-monthly.v1.json';target.write_bytes(raw)
    missing=[(p,m,s) for p in data['periods'] for m in data['panel'] for s in ['vehicles','trucks','parts'] if not any((r['period'],r['market'],r['segment'])==(p,m,s) for r in data['rows'])]
    print('Automotive snapshot verified:',len(raw),'bytes;',len(data['panel']),'markets;',len(data['periods']),'months; missing observations:',missing)
if __name__=='__main__':main()
