import ast
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class CzechHlidacFullCloudTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (
            ROOT / "pipeline/czech_hlidac_cloud/full_worker.py"
        ).read_text(encoding="utf-8")
        ast.parse(cls.source)

    def test_worker_is_cloud_only_and_requires_exact_scope(self):
        self.assertIn("Cloud Build only", self.source)
        self.assertIn("expected 100 municipalities", self.source)
        self.assertIn("HISTORY_START = date(2016, 7, 1)", self.source)

    def test_each_municipality_is_loaded_before_completion(self):
        self.assertLess(
            self.source.index("warehouse = load_municipality"),
            self.source.index('f"{attempt_prefix}/completed.json"'),
        )

    def test_rerun_skips_only_completed_attempts(self):
        self.assertIn('f"{prefix}/attempts/*/completed.json"', self.source)
        self.assertIn("if previous:", self.source)

    def test_full_worker_reuses_reviewed_windowed_fetcher(self):
        self.assertIn("fetch_full_history(", self.source)
        fetcher = (
            ROOT / "pipeline/transforms/fetch_hlidac_contracts.py"
        ).read_text(encoding="utf-8")
        self.assertIn("if pages > API_MAX_PAGES:", fetcher)
        self.assertIn("time.sleep(MIN_INTERVAL_SECONDS)", fetcher)


if __name__ == "__main__":
    unittest.main()
