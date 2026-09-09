"""Normalize the frozen direct ECB annual exchange-rate response (no network)."""
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'data/sources/ecb/annual-exchange-rates-2005-2025.csv'
URL = 'https://data-api.ecb.europa.eu/service/data/EXR/A..EUR.SP00.A?startPeriod=2005&endPeriod=2025&format=csvdata'

def main():
    observations = []
    for row in csv.DictReader(SOURCE.open()):
        assert row['FREQ'] == 'A' and row['CURRENCY_DENOM'] == 'EUR'
        if not row['OBS_VALUE']:
            continue
        observations.append({'currency': row['CURRENCY'], 'year': int(row['TIME_PERIOD']),
            'value': float(row['OBS_VALUE']), 'unit': 'currency_per_eur',
            'observation_status': row['OBS_STATUS'], 'comment': row['OBS_COM'], 'series_key': row['KEY']})
    assert len({(r['currency'], r['year']) for r in observations}) == len(observations)
    output = {'schema_version': '1.0.0', 'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': {'provider': 'ECB', 'title': 'Annual average euro reference exchange rates', 'url': URL,
            'retrieved_at': '2026-09-09', 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
        'observations': observations}
    (ROOT / 'data/ecb-annual-exchange-rates.v1.json').write_text(json.dumps(output, ensure_ascii=False) + '\n')
    print(f'{len(observations)} ECB observations')

if __name__ == '__main__':
    main()
