from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build-country-demography.py"
SPEC = importlib.util.spec_from_file_location("build_country_demography", SCRIPT)
demography = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(demography)
FIXTURE = ROOT / "tests" / "fixtures" / "demography" / "wpp-medium-mini.csv"


class CountryDemographyTest(unittest.TestCase):
    def test_default_sovereign_universe_has_195_unique_countries(self):
        universe = demography.load_universe(ROOT / "data" / "country-parity.v1.json")
        self.assertEqual(len(universe), 195)
        self.assertEqual(len(set(universe)), 195)

    def test_wpp_parser_reads_selected_countries_once_and_scales_thousands(self):
        details = demography.un_wpp_countries({"AFG"}, FIXTURE.read_bytes())
        self.assertEqual(set(details), {"AFG"})
        self.assertEqual(details["AFG"]["projection"], "UN World Population Prospects 2024, medium variant")
        self.assertEqual(details["AFG"]["rows"][0], [2025, 0, 0, 1250, 1200, 2450])
        self.assertEqual(details["AFG"]["rows"][-1][2], None)
        aggregate = demography.aggregate(details["AFG"]["rows"], common_years=(2025,))[0]
        self.assertEqual(aggregate["total"], 7550)
        self.assertEqual(aggregate["age_80_plus"], 300)
        self.assertEqual(aggregate["old_age_dependency_per_100_working_age"], 24.3902)

    def test_un_wpp_policy_covers_requested_fixture_countries_and_reports_missing(self):
        details, failures = demography.build_details(
            ["AFG", "CZE", "VAT"], FIXTURE.read_bytes(), source_policy="un-wpp"
        )
        self.assertEqual(set(details), {"AFG", "CZE"})
        self.assertEqual(failures, [])
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "missing.json"
            report = demography.write_missing_report(
                target, ["AFG", "CZE", "VAT"], details, failures, "2026-09-20T00:00:00+00:00"
            )
            self.assertEqual(report["missing_country_count"], 1)
            self.assertEqual(report["missing_countries"][0]["country_code"], "VAT")
            self.assertEqual(json.loads(target.read_text()), report)

    def test_preferred_policy_keeps_configured_overrides(self):
        calls = []

        def preferred(code):
            calls.append(code)
            return {"projection": f"preferred-{code}", "rows": []}

        details, failures = demography.build_details(
            ["AFG", "CZE"], FIXTURE.read_bytes(), source_policy="preferred", preferred_loader=preferred
        )
        self.assertEqual(calls, ["CZE"])
        self.assertEqual(details["CZE"]["projection"], "preferred-CZE")
        self.assertEqual(details["AFG"]["projection"], "UN World Population Prospects 2024, medium variant")
        self.assertEqual(failures, [])

    def test_preferred_source_failure_is_explicit_and_not_silently_replaced(self):
        def broken(_code):
            raise RuntimeError("fixture failure")

        details, failures = demography.build_details(
            ["AFG", "CZE"], FIXTURE.read_bytes(), source_policy="preferred", preferred_loader=broken
        )
        self.assertEqual(set(details), {"AFG"})
        self.assertEqual(failures[0]["country_code"], "CZE")
        self.assertIn("fixture failure", failures[0]["error"])

    def test_country_selection_rejects_codes_outside_the_universe(self):
        self.assertEqual(demography.select_countries("cze, afg,cze", ["AFG", "CZE"]), ["CZE", "AFG"])
        with self.assertRaisesRegex(ValueError, "ZZZ"):
            demography.select_countries("ZZZ", ["AFG", "CZE"])


if __name__ == "__main__":
    unittest.main()
