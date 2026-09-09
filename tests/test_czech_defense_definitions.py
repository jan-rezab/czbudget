import importlib.util
import json
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('defense', ROOT / 'scripts/build-czech-defense-definitions.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class DefenseTests(unittest.TestCase):
    def test_money_keeps_decimal_precision_and_wrapped_labels(self):
        page = 'Presidential support\n   1 234,56   0,00   9 876,54\nOther row 99,99'
        self.assertEqual(m.row_values(page, 'Presidential support', 3), [Decimal('1234.56'), Decimal('0.00'), Decimal('9876.54')])
        with self.assertRaises(ValueError):
            m.row_values('First 1,00\nOther row 2,00 3,00', 'First', 3)

    def test_source_transcription_categories_and_estimates(self):
        fixture = json.loads((ROOT / 'pipeline/config/defense/nato-czech-2026-transcription.json').read_text())
        self.assertEqual(fixture['estimate_years'], [2025, 2026])
        for i, year in enumerate(fixture['years']):
            self.assertAlmostEqual(sum(row['values'][i] for row in fixture['categories'].values()), 100, delta=.025, msg=str(year))
        self.assertEqual(fixture['categories']['equipment']['values'][-1], 25.09)

    def test_generated_measures_stay_distinct_and_reconcile(self):
        data = json.loads((ROOT / 'data/czech-defense-definitions.v1.json').read_text())
        self.assertEqual(data['nato_core']['observations'][-1]['status'], 'estimate')
        chapter = data['chapter_307']
        self.assertEqual(chapter['observations'][-1]['year'], 2025)
        self.assertEqual(chapter['observations'][-1]['status'], 'reported_outturn')
        self.assertEqual(chapter['observations'][-1]['unit'], 'thousand_CZK')
        for row in chapter['observations']:
            self.assertAlmostEqual(sum(row['components'].values()), row['total'], delta=.04)
        self.assertEqual(chapter['budget_stages_2025']['approved']['total'], 154395235.25)
        self.assertEqual(chapter['budget_stages_2025']['reported_outturn']['total'], 155952215.73)

if __name__ == '__main__':
    unittest.main()
