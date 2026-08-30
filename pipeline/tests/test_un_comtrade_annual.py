from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[2] / "scripts/import_un_comtrade_annual.py"
SPEC = importlib.util.spec_from_file_location("import_un_comtrade_annual", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class UnComtradeAnnualTest(unittest.TestCase):
    def test_ranked_countries_puts_missing_gdp_last(self):
        original = MODULE.gdp_for_country
        values = {"USA": (29000.0, 2024), "CHN": (18000.0, 2024), "VAT": (None, None)}
        MODULE.gdp_for_country = lambda code, year: values[code]
        try:
            result = MODULE.ranked_countries([
                {"iso3": "VAT", "name_en": "Vatican City"},
                {"iso3": "CHN", "name_en": "China"},
                {"iso3": "USA", "name_en": "United States"},
            ], 2024)
        finally:
            MODULE.gdp_for_country = original
        self.assertEqual([row["iso3"] for row in result], ["USA", "CHN", "VAT"])
        self.assertEqual([row["gdp_rank"] for row in result], [1, 2, None])

    def test_normalized_flow_sorts_and_sums_hs2_rows(self):
        payload = {"data": [
            {"cmdCode": "02", "primaryValue": 20, "classificationCode": "H6", "isAggregate": True, "netWgt": 5},
            {"cmdCode": "01", "primaryValue": 30, "classificationCode": "H6", "isAggregate": True},
            {"cmdCode": "TOTAL", "primaryValue": 999, "classificationCode": "H6"},
        ]}
        rows, summary = MODULE.normalized_flow(payload, {"01": "Animals", "02": "Meat"})
        self.assertEqual([row["product_code"] for row in rows], ["01", "02"])
        self.assertEqual(summary["total_value_usd"], 50)
        self.assertEqual(summary["classification_codes"], ["H6"])

    def test_api_key_is_not_in_safe_url(self):
        config = {
            "api_base": "https://example.test",
            "access": {"authenticated_endpoint": "/data", "anonymous_endpoint": "/public", "anonymous_record_limit_per_call": 500},
            "request": {"type_code": "C", "frequency_code": "A", "classification_code": "HS", "partner_code": 0, "second_partner_code": 0, "customs_code": "C00", "mode_of_transport_code": 0, "commodity_code": "AG2"},
        }
        url, safe = MODULE.safe_api_url(config, 2024, 842, "X", "secret")
        self.assertIn("secret", url)
        self.assertNotIn("secret", safe)


if __name__ == "__main__":
    unittest.main()
