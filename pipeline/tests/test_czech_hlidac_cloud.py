import ast
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class CzechHlidacCloudTests(unittest.TestCase):
    def test_worker_is_cloud_only_and_uses_api(self):
        source = (ROOT / "pipeline/czech_hlidac_cloud/worker.py").read_text()
        ast.parse(source)
        self.assertIn("Cloud Build only", source)
        self.assertIn("https://api.hlidacstatu.cz/api/v2/smlouvy/hledat", source)
        self.assertNotIn("www.hlidacstatu.cz/Detail", source)

    def test_completion_is_published_after_warehouse_load(self):
        source = (ROOT / "pipeline/czech_hlidac_cloud/worker.py").read_text()
        self.assertLess(source.index('"bq", "--project_id=" + PROJECT, "load"'), source.index('f"{prefix}/completed.json"'))

    def test_checked_in_scope_has_exactly_100_entries(self):
        scope = json.loads(
            (ROOT / "pipeline/config/czech-hlidac-municipalities.v1.json").read_text()
        )
        self.assertEqual(len(scope["municipalities"]), 100)
        self.assertTrue(scope["integration_policy"]["api_only"])

    def test_inventory_submitter_uses_isolated_data_plane(self):
        submitter = (
            ROOT / "pipeline/czech_hlidac_cloud/submit.py"
        ).read_text(encoding="utf-8")
        config = (
            ROOT / "pipeline/czech_hlidac_cloud/cloudbuild.yaml"
        ).read_text(encoding="utf-8")
        self.assertIn('REGION = "europe-west4"', submitter)
        self.assertIn("psd-data-builder@", submitter)
        self.assertIn("assert_data_plane_idle(PROJECT, REGION)", submitter)
        self.assertIn("plane-data", config)


if __name__ == "__main__":
    unittest.main()
