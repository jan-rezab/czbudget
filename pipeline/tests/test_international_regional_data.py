import importlib.util
import json
import sys
import unittest
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "pipeline/transforms/prepare_international_regional_data.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("prepare_international_regional_data", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)

REGOFI_MODULE_PATH = ROOT / "pipeline/transforms/prepare_oecd_regofi.py"
REGOFI_SPEC = importlib.util.spec_from_file_location("prepare_oecd_regofi", REGOFI_MODULE_PATH)
REGOFI_MODULE = importlib.util.module_from_spec(REGOFI_SPEC)
assert REGOFI_SPEC.loader
REGOFI_SPEC.loader.exec_module(REGOFI_MODULE)


class InternationalRegionalDataTest(unittest.TestCase):
    def test_source_contract_has_implemented_and_queued_countries(self):
        config = json.loads((ROOT / "pipeline/config/international_regional_sources.v1.json").read_text())
        self.assertEqual(set(config["countries"]), {"FRA", "POL", "SWE", "DNK"})
        self.assertTrue({"ESP", "DEU", "CHE", "USA", "SVK"}.issubset({row["country_code"] for row in config["queued_sources"]}))

    def test_regional_fact_is_not_a_municipal_fact(self):
        source = {"id": "test", "kind": "actual"}
        row = MODULE.fact_row(
            "PL:0200000", "voivodeship", 2025, "actual", "expenditure",
            "851.85111", "4300", Decimal("12.34"), "PLN", source, "test-run",
            "2026-08-28T00:00:00+00:00", "PL_FUNCTION", "PL_ECONOMIC",
        )
        self.assertEqual(row["country_code"], "POL")
        self.assertEqual(row["regional_tier_code"], "voivodeship")
        self.assertNotIn("functional_paragraph_code", row)

    def test_coverage_never_calls_a_partial_expected_tier_complete(self):
        tier = {"tier_code": "region", "expected_count": 5}
        row = MODULE.coverage_row("DNK", 2025, tier, ["REGR55"], 1, 100, {"actual"}, {"revenue", "expenditure"}, "2026-08-28T00:00:00+00:00")
        self.assertEqual(row["validation_status"], "partial")
        self.assertEqual(row["entity_loaded_count"], 1)

    def test_bigquery_schema_keeps_regional_facts_separate(self):
        schema = (ROOT / "pipeline/warehouse/schema.sql").read_text()
        self.assertIn("regional_budget_line_facts", schema)
        self.assertIn("regional_budget_coverage", schema)
        self.assertIn("regional_source_entities", schema)
        self.assertIn("regional_comparable_finance_observations", schema)
        self.assertIn("require_partition_filter = TRUE", schema)

    def test_regofi_country_map_separates_oecd_prefixes_from_iso_codes(self):
        config = json.loads((ROOT / "pipeline/config/oecd_regofi_country_map.v1.json").read_text())
        self.assertEqual(config["countries"]["ME"]["country_code"], "MEX")
        self.assertEqual(config["countries"]["CZ"]["country_code"], "CZE")
        self.assertEqual(config["countries"]["BE"]["system_type"], "federal_overlapping_region_community")

    def test_regofi_source_entity_identity_is_not_assumed_canonical(self):
        self.assertEqual(REGOFI_MODULE.source_prefix("CZ010"), "CZ")
        schema = (ROOT / "pipeline/warehouse/schema.sql").read_text()
        self.assertIn("canonical_regional_government_id STRING", schema)
        self.assertIn("crosswalk_status STRING", schema)


if __name__ == "__main__":
    unittest.main()
