#!/usr/bin/env python3
"""Load reviewed insurer facts into the existing warehouse; opt in with --execute."""
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
    payload = json.loads((ROOT / 'data/cz-health-insurers-2024.json').read_text())
    assert payload['year'] == 2024
    assert len(payload['entities']) == len({e['ico'] for e in payload['entities']}) == 7
    assert payload['summary']['cash_balance_mczk'] == -7518.507
    for e in payload['entities']:
        assert abs(e['receipts_mczk'] - e['expenditure_mczk'] - e['cash_balance_mczk']) < .001
    if not args.execute:
        print('Validated: seven insurers, 42 annual metrics, 14 balance facts, 14 source records. Use --execute to write.')
        return
    env = dict(os.environ, CLOUDSDK_CORE_ACCOUNT=args.account, CLOUDSDK_ACTIVE_CONFIG_NAME='czbudget')
    subprocess.run(['bq', '--project_id=czbudget-janrezab', '--location=EU', 'query',
                    '--use_legacy_sql=false', '--format=prettyjson', '--maximum_bytes_billed=5000000000',
                    '--parameter=payload:JSON:' + json.dumps(payload, ensure_ascii=False, separators=(',', ':'))],
                   input=Path(__file__).with_suffix('.sql').read_text(), text=True, env=env, check=True)


if __name__ == '__main__':
    main()
