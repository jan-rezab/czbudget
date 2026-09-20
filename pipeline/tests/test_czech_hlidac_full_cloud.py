import ast
from datetime import date
import pathlib
import tempfile
import unittest
from unittest import mock

from pipeline.transforms import fetch_hlidac_contracts


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

    def test_each_municipality_preserves_raw_before_completion(self):
        self.assertLess(
            self.source.index('f"{attempt_prefix}/raw-pages.jsonl.gz"'),
            self.source.index('f"{attempt_prefix}/completed.json"'),
        )
        self.assertIn('"sha256": digest', self.source)
        self.assertIn('"generation": generation', self.source)

    def test_rerun_skips_only_completed_attempts(self):
        self.assertIn('f"{prefix}/attempts/*/completed.json"', self.source)
        self.assertIn("if previous:", self.source)

    def test_full_worker_reuses_reviewed_windowed_fetcher(self):
        self.assertIn("sys.path.insert(0, str(ROOT))", self.source)
        self.assertIn("fetch_full_history(", self.source)
        fetcher = (
            ROOT / "pipeline/transforms/fetch_hlidac_contracts.py"
        ).read_text(encoding="utf-8")
        self.assertIn("if pages > API_MAX_PAGES:", fetcher)
        self.assertIn("time.sleep(MIN_INTERVAL_SECONDS)", fetcher)
        self.assertIn("page_observer", fetcher)

    def test_windowed_fetcher_observes_each_persisted_raw_page(self):
        pages = [
            {"total": 3, "results": [{"id": "a"}, {"id": "b"}]},
            {"total": 3, "results": [{"id": "c"}]},
        ]
        observed = []
        with tempfile.TemporaryDirectory() as temporary, mock.patch.object(
            fetch_hlidac_contracts, "fetch_page", side_effect=pages
        ), mock.patch.object(fetch_hlidac_contracts.time, "sleep"):
            contracts, requests, windows = fetch_hlidac_contracts.fetch_full_history(
                "token",
                "00000001",
                date(2026, 1, 1),
                date(2026, 1, 31),
                pathlib.Path(temporary) / "checkpoint.jsonl",
                page_observer=lambda start, end, page, payload: observed.append(
                    (start, end, page, payload)
                ),
            )
        self.assertEqual([item[2] for item in observed], [1, 2])
        self.assertEqual({item["id"] for item in contracts}, {"a", "b", "c"})
        self.assertEqual((requests, windows), (2, 1))

    def test_release_is_staged_validated_and_atomically_published(self):
        self.assertIn("hlidac_top100_stage_", self.source)
        self.assertIn("hlidac_top100_release_", self.source)
        self.assertIn("per-municipality staging reconciliation failed", self.source)
        self.assertIn("--if-generation-match=", self.source)
        self.assertLess(
            self.source.index('f"{release_prefix}/validated.json"'),
            self.source.index("completed_object = upload_immutable"),
        )
        self.assertIn('"website_destinations": []', self.source)

    def test_receipt_has_build_identity_and_row_accounting(self):
        for field in (
            '"loader_git_sha"',
            '"cloud_build_id"',
            '"service_account"',
            '"region"',
            '"rows_received"',
            '"rows_rejected"',
            '"rows_deduplicated"',
        ):
            self.assertIn(field, self.source)

    def test_submitter_uses_isolated_data_plane(self):
        submitter = (
            ROOT / "pipeline/czech_hlidac_cloud/submit_full.py"
        ).read_text(encoding="utf-8")
        config = (
            ROOT / "pipeline/czech_hlidac_cloud/full_cloudbuild.yaml"
        ).read_text(encoding="utf-8")
        self.assertIn('REGION = "europe-west4"', submitter)
        self.assertIn("psd-data-builder@", submitter)
        self.assertIn("assert_data_plane_idle(PROJECT, REGION)", submitter)
        self.assertIn("assert_bundle_matches_head()", submitter)
        self.assertIn("TemporaryDirectory", submitter)
        self.assertIn('"git", "rev-parse", "HEAD"', submitter)
        self.assertIn("_LOADER_GIT_SHA", config)
        self.assertIn("plane-data", config)


if __name__ == "__main__":
    unittest.main()
