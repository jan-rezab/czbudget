import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('balance', ROOT / 'pipeline/transforms/prepare_state_enterprise_balance_sheets.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BalanceSheetTests(unittest.TestCase):
    def setUp(self):
        self.portfolio = json.loads(module.PORTFOLIO.read_text())
        self.config = json.loads(module.CONFIG.read_text())

    def test_source_units_and_complete_reconciliation(self):
        data = module.build(self.portfolio, self.config)
        rows = {r['ico']: r for r in data['entities']}
        self.assertEqual(rows['46355901']['cash_czk'], 2459000)  # PRISKO, thousands
        self.assertEqual(rows['45274649']['cash_czk'], 32868000000)  # CEZ, millions
        self.assertEqual(data['summary']['gross_portfolio']['cash_czk'], 129545428000)
        self.assertEqual(data['coverage'], {'expected': 38, 'available': 38})
        for row in rows.values():
            self.assertEqual(row['equity_czk'] + row['non_equity_funding_czk'], row['total_assets_czk'])

    def test_missing_duplicate_and_missing_value_fail(self):
        for change in ('missing', 'duplicate', 'null'):
            config = copy.deepcopy(self.config)
            if change == 'missing': config['observations'].pop()
            if change == 'duplicate': config['observations'].append(config['observations'][0])
            if change == 'null': config['observations'][0]['cash'] = None
            with self.assertRaises((ValueError, TypeError)):
                module.build(self.portfolio, config)

    def test_attachment_preserves_original_card_metrics(self):
        before = copy.deepcopy([e['metrics'] for e in self.portfolio['entities']])
        module.attach(self.portfolio, module.build(self.portfolio, self.config))
        self.assertEqual(before, [e['metrics'] for e in self.portfolio['entities']])

if __name__ == '__main__': unittest.main()
