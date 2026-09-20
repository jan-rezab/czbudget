from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SUBMIT_PATH = Path(__file__).resolve().parents[1] / "submit.py"
SPEC = importlib.util.spec_from_file_location("comtrade_warehouse_submit", SUBMIT_PATH)
submit = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(submit)


class SubmitTests(unittest.TestCase):
    def test_bundle_contains_only_reviewed_loader_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            submit.build_bundle(root)
            files = {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}
            self.assertEqual(files, set(submit.SOURCE_FILES) | {"cloudbuild.yaml", ".gcloudignore"})
            build = (root / "cloudbuild.yaml").read_text()
            self.assertIn("run_un_comtrade_warehouse.py", build)
            self.assertIn("E2_HIGHCPU_8", build)
            self.assertIn("BUILD_ID=$BUILD_ID", build)
            self.assertNotIn("UN_COMTRADE_API_KEY", build)

    def test_dedicated_builder_service_account_is_used(self):
        self.assertIn("comtrade-builder@", submit.SERVICE_ACCOUNT)
        self.assertNotIn("jan@ravineo.com", submit.SERVICE_ACCOUNT)

    def test_backfills_are_restricted_to_eu_build_regions(self):
        self.assertEqual(
            submit.ALLOWED_REGIONS,
            ("europe-west1", "europe-west3", "europe-west4", "europe-north1"),
        )

    def test_scheduler_payload_pins_proven_source_generation(self):
        payload = json.loads((SUBMIT_PATH.parent / "scheduler-build.json").read_text())
        source = payload["source"]["storageSource"]
        self.assertTrue(source["object"].startswith("build-source-warehouse/"))
        self.assertTrue(source["generation"].isdigit())
        self.assertEqual(payload["queueTtl"], "43200s")
        self.assertEqual(
            payload["serviceAccount"],
            "projects/czbudget-janrezab/serviceAccounts/"
            "comtrade-builder@czbudget-janrezab.iam.gserviceaccount.com",
        )


if __name__ == "__main__":
    unittest.main()
