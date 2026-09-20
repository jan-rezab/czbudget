import json
from types import SimpleNamespace
import unittest

from pipeline.build_admission import assert_data_plane_idle


class BuildAdmissionTest(unittest.TestCase):
    def test_allows_idle_or_non_data_builds(self):
        for builds in ([], [{"id": "web", "status": "WORKING", "tags": ["plane-web"]}]):
            calls = []
            def run(command, **kwargs):
                calls.append((command, kwargs))
                return SimpleNamespace(stdout=json.dumps(builds))
            assert_data_plane_idle("project", "europe-west4", run=run)
            self.assertIn("--region=europe-west4", calls[0][0])
            self.assertTrue(calls[0][1]["check"])

    def test_rejects_any_queued_or_running_data_build(self):
        def run(command, **kwargs):
            return SimpleNamespace(stdout=json.dumps([
                {"id": "data-1", "status": "WORKING", "tags": ["plane-data", "one"]},
                {"id": "data-2", "status": "QUEUED", "tags": ["plane-data", "two"]},
            ]))
        with self.assertRaisesRegex(RuntimeError, r"data-1 \(WORKING\).+data-2 \(QUEUED\)"):
            assert_data_plane_idle("project", "europe-west4", run=run)


if __name__ == "__main__":
    unittest.main()
