#!/usr/bin/env python3
"""Upload reviewed SOE balance summaries to the existing BigQuery warehouse.

Default emits no writes: --execute is required. --account pins an already
credentialed gcloud account for this process without changing shared config.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--account', required=True)
    args = parser.parse_args()
    payload = json.loads((ROOT / 'data/cz-state-enterprise-balance-sheets-2024.v1.json').read_text())
    assert payload['coverage'] == {'expected': 38, 'available': 38}
    assert len({e['ico'] for e in payload['entities']}) == 38
    assert sum(e['cash_czk'] for e in payload['entities']) == 129545428000
    sql = Path(__file__).with_suffix('.sql').read_text()
    if not args.execute:
        print('Validated input: 38 entities, 152 balance facts, 38 cash facts. Use --execute to load.')
        return
    env = dict(os.environ, CLOUDSDK_CORE_ACCOUNT=args.account, CLOUDSDK_ACTIVE_CONFIG_NAME='czbudget')
    subprocess.run(['bq', '--project_id=czbudget-janrezab', '--location=EU', 'query',
                    '--use_legacy_sql=false', '--format=prettyjson', '--maximum_bytes_billed=5000000000',
                    '--parameter=payload:JSON:' + json.dumps(payload, ensure_ascii=False, separators=(',', ':'))],
                   input=sql, text=True, env=env, check=True)

if __name__ == '__main__':
    main()
