import json
from types import SimpleNamespace
import unittest

from pipeline.build_admission import assert_data_plane_idle


class BuildAdmissionTest(unittest.TestCase):
    def test_allows_idle_region_and_uses_submitting_account(self):
        calls = []
        def run(command, **kwargs):
            calls.append((command, kwargs))
            return SimpleNamespace(stdout="[]")
        assert_data_plane_idle("project", "europe-west4", account="user@example.test", run=run)
        self.assertIn("--region=europe-west4", calls[0][0])
        self.assertIn("--account=user@example.test", calls[0][0])
        self.assertIn("--ongoing", calls[0][0])
        self.assertTrue(calls[0][1]["check"])

    def test_rejects_any_queued_or_running_data_build(self):
        def run(command, **kwargs):
            return SimpleNamespace(stdout=json.dumps([
                {"id": "data-1", "status": "WORKING", "tags": ["plane-data", "one"]},
                {"id": "data-2", "status": "QUEUED", "serviceAccount": "comtrade-builder@example.test"},
            ]))
        with self.assertRaisesRegex(RuntimeError, r"data-1 \(WORKING\).+data-2 \(QUEUED\)"):
            assert_data_plane_idle("project", "europe-west4", run=run)

    def test_rejects_wrong_region_before_querying(self):
        with self.assertRaisesRegex(ValueError, "europe-west4"):
            assert_data_plane_idle("project", "europe-west1", run=lambda *_args, **_kwargs: None)


if __name__ == "__main__":
    unittest.main()
