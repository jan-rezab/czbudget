from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parents[1]


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


worker = load("demography_cloud_worker", "worker.py")
submit = load("demography_cloud_submit", "submit.py")


class CloudPackageTest(unittest.TestCase):
    def test_worker_refuses_non_cloud_execution(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "Cloud Build only"):
                worker.require_cloud("run-1")

    def test_worker_requires_exact_build_id(self):
        with mock.patch.dict(os.environ, {"BUILD_ID": "run-1"}, clear=True):
            worker.require_cloud("run-1")
            with self.assertRaisesRegex(RuntimeError, "BUILD_ID"):
                worker.require_cloud("run-2")

    def test_submit_command_uses_private_staging_and_async_cloud_build(self):
        with tempfile.TemporaryDirectory() as temporary:
            command = submit.build_command(Path(temporary), "user@example.test")
        self.assertIn("--region=europe-west1", command)
        self.assertIn("--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source", command)
        self.assertIn("--async", command)
        self.assertIn("--account=user@example.test", command)


if __name__ == "__main__":
    unittest.main()
