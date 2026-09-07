"""Checks on the serving contract and the original Czech chart's source values."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/build-industrial-explorer.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class ExplorerTests(unittest.TestCase):
    def test_naics_codes_are_not_nace_divisions(self):
        self.assertEqual(builder.classify(dict(country='USA', industry_code='G311')), ('division', False))
        self.assertEqual(builder.classify(dict(country='USA', industry_code='B51111')), ('detail', False))
        self.assertEqual(builder.classify(dict(country='USA', industry_code='B50001')), ('total', True))

    def test_detailed_nace_not_mixed_with_divisions(self):
        self.assertEqual(builder.classify(dict(country='DEU', industry_code='C241')), ('detail', False))
        self.assertEqual(builder.classify(dict(country='DEU', industry_code='C24')), ('division', False))

    def test_real_serving_contract(self):
        index = json.loads((ROOT / 'data/industry/index.json').read_text())
        self.assertGreaterEqual(index['counts']['monthly_countries'], 38)
        count = 0
        for country in index['countries']:
            data = json.loads((ROOT / country['file'].lstrip('/')).read_text())
            keys = set()
            for series in data['series']:
                self.assertNotIn(series['id'], keys)
                keys.add(series['id'])
                periods = [p['period'] for p in series['points']]
                self.assertEqual(len(periods), len(set(periods)))
                self.assertEqual(periods, sorted(periods))
                if series['frequency'] == 'A':
                    self.assertTrue(all('2010' <= p <= '2025' and len(p) == 4 for p in periods))
                    self.assertEqual(series['channel'], 'eurostat')
                self.assertTrue(series['source_url'].startswith('https://'))
                count += len(periods)
        self.assertEqual(count, index['counts']['observations'])

    def test_eu27_complete_total_history(self):
        eu = 'AUT BEL BGR CYP CZE DEU DNK EST GRC ESP FIN FRA HRV HUN IRL ITA LTU LUX LVA MLT NLD POL PRT ROU SWE SVN SVK'.split()
        for code in eu:
            data = json.loads((ROOT / f'data/industry/{code}.json').read_text())
            for freq in ['M', 'A']:
                series = next(s for s in data['series'] if s['channel'] == 'eurostat' and s['industry_code'] == 'B-D'
                              and s['frequency'] == freq and s['measure'] == 'index' and s['adjustment'] == 'CA')
                periods = {p['period'] for p in series['points']}
                expected = {str(y) + (f'-{m:02}' if freq == 'M' else '') for y in range(2010, 2026)
                            for m in (range(1, 13) if freq == 'M' else [1])}
                self.assertTrue(expected <= periods, f'{code} {freq}: {sorted(expected - periods)}')

    def test_original_czech_july_chart_headline(self):
        data = json.loads((ROOT / 'data/industry/CZE.json').read_text())
        rows = [p for s in data['series'] if s['channel'] == 'national' and s['industry_code'] == 'BCD'
                and s['frequency'] == 'M' and s['measure'] == 'yoy_pct' and s['adjustment'] == 'CA'
                for p in s['points'] if p['period'] == '2026-07']
        self.assertEqual(len(rows), 1)
        self.assertEqual(round(rows[0]['value'], 1), 3.1)

    def test_polish_monthly_provenance_is_preserved(self):
        data = json.loads((ROOT / 'data/industry/POL.json').read_text())
        row = next(s for s in data['series'] if s['channel'] == 'national' and s['industry_code'] == 'B-E' and s['measure'] == 'yoy_pct')
        urls = {p.get('source_url', row['source_url']) for p in row['points']}
        self.assertEqual(len(urls), 7)


if __name__ == '__main__':
    unittest.main()
