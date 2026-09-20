import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "india_cityfinance_cloud"))

from normalize import fiscal_year_end, normalize_income_statement  # noqa: E402


class IndiaCityFinanceNormalizeTest(unittest.TestCase):
    def test_only_coded_nonderived_rows_are_facts(self):
        data = [
            {"lineItem": "A.Income", "isHeader": True},
            {"code": 110, "lineItem": "Tax Revenue", "202324_u1": 12},
            {"code": "120-150", "lineItem": "Non-Tax Revenue", "reportType": "summary", "calculation": True, "202324_u1": 20},
            {"lineItem": "Total Income (A)", "calculation": True, "202324_u1": 32},
            {"lineItem": "B.Expenditure", "isHeader": True},
            {"code": 210, "lineItem": "Establishment Expenses", "202324_u1": 0},
            {"code": 220, "lineItem": "Administrative Expenses", "202324_u1": None},
        ]
        self.assertEqual(normalize_income_statement(data, "u1", "2023-24"), [
            {"source_row_number": 2, "budget_side": "revenue", "economic_item_code": "110", "line_item": "Tax Revenue", "amount_local": "12", "report_type": None},
            {"source_row_number": 6, "budget_side": "expenditure", "economic_item_code": "210", "line_item": "Establishment Expenses", "amount_local": "0", "report_type": None},
        ])

    def test_fiscal_year_end(self):
        self.assertEqual(fiscal_year_end("2023-24"), 2024)


if __name__ == "__main__":
    unittest.main()
