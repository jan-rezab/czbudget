from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from pipeline.czech_hlidac_cloud import full_worker


class FullPublicationOrderTest(unittest.TestCase):
    def test_completion_is_immutable_before_pointer_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            pointer = {"release_id": "run-1", "required_completion_uri": "gs://bucket/completed.json"}
            receipt = {"processing_status": "complete", "publication_status": "validated_not_yet_current"}
            events = []

            def upload(path, uri):
                self.assertEqual(path.name, "completed.json")
                events.append("completed")
                return {"uri": uri, "generation": "12", "sha256": full_worker.sha256_file(path)}

            def run(command):
                self.assertEqual(command[:3], ["gcloud", "storage", "cp"])
                self.assertEqual(events, ["completed"])
                events.append("pointer")
                return ""

            with mock.patch.object(full_worker, "upload_immutable", side_effect=upload), \
                 mock.patch.object(full_worker, "run", side_effect=run):
                completed = full_worker.commit_validated_release(
                    work, pointer, receipt, {"generation": "11"}, "0",
                    "gs://bucket/completed.json", "gs://bucket/current.json",
                )

            self.assertEqual(events, ["completed", "pointer"])
            self.assertEqual(completed["sha256"], pointer["required_completion_sha256"])
            self.assertEqual(pointer["required_completion_generation"], "12")
            self.assertEqual(pointer["publication_status"], "published_data_plane")
            saved_receipt = json.loads((work / "completed.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_receipt["publication_status"], "validated_not_yet_current")


if __name__ == "__main__":
    unittest.main()
