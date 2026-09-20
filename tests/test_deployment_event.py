import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DeploymentEventTest(unittest.TestCase):
    def test_writer_records_required_deployment_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "event.json"
            pointer = Path(directory) / "current.json"
            pointer.write_text(json.dumps({"release_id": "municipal-release"}))
            env = {**os.environ, "DEPLOYMENT_EVENT_OUTPUT": str(output), "PUBLIC_SNAPSHOT_POINTER": str(pointer)}
            subprocess.run(
                ["python3", "scripts/write-deployment-event.py", "skipped", "sha256:" + "b" * 64, "a" * 40, "build-1", "22"],
                cwd=ROOT, env=env, check=True, capture_output=True, text=True,
            )
            event = json.loads(output.read_text())
            self.assertEqual(event["event_type"], "deployment")
            self.assertEqual(event["outcome"], "skipped")
            self.assertEqual(event["pr_number"], 22)
            self.assertEqual(event["image_digest"], "sha256:" + "b" * 64)
            self.assertIn("municipal-release", event["data_release_ids"])


if __name__ == "__main__":
    unittest.main()
