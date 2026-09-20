import tempfile
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import submit


class SubmitTests(unittest.TestCase):
    def test_bundle_contains_only_reviewed_runtime_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            submit.build_bundle(root)
            relative = {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}
            self.assertEqual(
                relative,
                set(submit.SOURCE_FILES) | {"cloudbuild.yaml", ".gcloudignore"},
            )
            build = (root / "cloudbuild.yaml").read_text()
            self.assertIn("UN_COMTRADE_API_KEY_01", build)
            self.assertIn("UN_COMTRADE_API_KEY_19", build)
            self.assertIn("UN_COMTRADE_API_KEY_25", build)
            self.assertIn("UN_COMTRADE_API_KEY_26", build)
            self.assertIn("UN_COMTRADE_API_KEY_27", build)
            self.assertIn("UN_COMTRADE_API_KEY_28", build)
            self.assertIn("UN_COMTRADE_API_KEY_29", build)
            self.assertIn("run_un_comtrade_direct.py", build)
            self.assertIn("_MAX_CALLS: '500'", build)
            self.assertNotIn("machineType:", build)
            self.assertIn("--checkpoint-seconds", build)
            self.assertIn("--history-periods", build)
            self.assertIn("--monthly-prior-months", build)
            self.assertIn("--monthly-focus-share", build)

    def test_scheduler_request_pins_proven_cloud_source(self):
        request = json.loads((submit.HERE / "scheduler-build.json").read_text())
        source = request["source"]["storageSource"]
        self.assertEqual(source["bucket"], "czbudget-janrezab-un-comtrade-raw")
        self.assertTrue(source["generation"].isdigit())
        self.assertEqual(request["steps"][0]["args"][1], "--max-calls-per-account")
        # Keep this payload compatible with its pinned proven source. The v2
        # flags are promoted only after a successful candidate build supplies
        # a new immutable source object and generation.
        self.assertEqual(request["steps"][0]["args"][2], "480")
        self.assertIn("--max-batches", request["steps"][0]["args"])
        self.assertNotIn("--checkpoint-seconds", request["steps"][0]["args"])
        self.assertEqual(len(request["availableSecrets"]["secretManager"]), 19)
        self.assertEqual(request["availableSecrets"]["secretManager"][0]["env"], "UN_COMTRADE_API_KEY_01")
        self.assertEqual(request["availableSecrets"]["secretManager"][-1]["env"], "UN_COMTRADE_API_KEY_19")
        self.assertIn("comtrade-builder@", request["serviceAccount"])
        self.assertNotIn("jan@ravineo.com", json.dumps(request))

    def test_manual_submit_uses_dedicated_builder(self):
        self.assertIn("comtrade-builder@", submit.SERVICE_ACCOUNT)
        self.assertNotIn("compute@developer", submit.SERVICE_ACCOUNT)


if __name__ == "__main__":
    unittest.main()
