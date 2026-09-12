import importlib.util
import json
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "transforms/build_prague_accountability.py"
SPEC = importlib.util.spec_from_file_location("prague_accountability", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class PragueAccountabilityContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = MODULE.read_json(MODULE.CONFIG_PATH)
        cls.payload = MODULE.build_payload(cls.config)

    def test_committed_artifact_matches_inputs_and_config(self):
        self.assertEqual(MODULE.OUTPUT_PATH.read_text(encoding="utf-8"), MODULE.canonical_json(self.payload))

    def test_integrity_checks_all_pass(self):
        self.assertEqual(self.payload["integrity"]["status"], "passed")
        self.assertTrue(all(self.payload["integrity"]["checks"].values()))

    def test_stuck_projects_follow_the_published_rule(self):
        rule = self.payload["rules"]["stuck_rule"]
        band = self.payload["rules"]["band_czk"]
        for project in self.payload["stuck_projects"]:
            trusted = [t for t in project["trajectory"] if t["trusted"]]
            self.assertGreaterEqual(len(trusted), rule["min_trusted_years"], project["name"])
            self.assertLessEqual(project["cum_actual_czk"], rule["max_actual_share"] * project["cum_budget_czk"] + 0.01, project["name"])
            self.assertTrue(band["min"] <= project["peak_annual_budget_czk"] <= band["max"], project["name"])
            self.assertEqual(round(sum(t["budget_czk"] for t in trusted), 2), project["cum_budget_czk"])

    def test_broken_feed_years_never_count_as_spend(self):
        broken = {(row["entity"], row["year"]) for row in self.payload["broken_feeds"]}
        self.assertIn(("Hlavní město Praha", 2025), broken)
        for project in self.payload["stuck_projects"]:
            for point in project["trajectory"]:
                self.assertEqual(point["trusted"], (project["entity"], point["year"]) not in broken)

    def test_city_baseline_excludes_2025_and_marks_2026_partial(self):
        by_year = {row["year"]: row for row in self.payload["execution_baseline"]}
        self.assertFalse(by_year[2025]["trusted"])
        self.assertTrue(by_year[2026]["partial_year"])
        for year in range(2018, 2025):
            self.assertTrue(0.7 <= by_year[year]["execution_share"] <= 0.95, year)

    def test_every_trace_carries_verdict_confidence_and_matches_a_project(self):
        keys = {(p["entity"], p["event_id"]) for p in self.payload["stuck_projects"]}
        for trace in self.config["traces"]:
            self.assertIn(trace["confidence"], ("high", "medium", "low"))
            self.assertTrue(trace["verdict_cs"] and trace["verdict_en"])
            for resolution in trace["resolutions"]:
                self.assertTrue(resolution["date"] and resolution["number"] and resolution["url"])
        traced = [p for p in self.payload["stuck_projects"] if p["trace"]]
        self.assertGreaterEqual(len(traced), 10)
        self.assertTrue(all((p["entity"], p["event_id"]) in keys for p in traced))

    def test_provisions_and_rollups_are_excluded_not_hidden(self):
        excluded = self.payload["stuck_summary"]["excluded"]
        self.assertIn("provision", excluded)
        self.assertGreater(excluded["provision"]["count"], 0)
        self.assertFalse(any(MODULE.re.search(p, project["name"], MODULE.re.IGNORECASE) for project in self.payload["stuck_projects"] for p in self.config["provision_patterns"]))

    def test_pinned_input_digest_mismatch_is_rejected(self):
        config = json.loads(json.dumps(self.config))
        config["inputs"][0]["sha256"] = "0" * 64
        with self.assertRaises(MODULE.ContractError):
            MODULE.build_payload(config)


if __name__ == "__main__":
    unittest.main()
