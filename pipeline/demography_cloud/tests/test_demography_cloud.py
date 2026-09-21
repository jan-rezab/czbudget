from __future__ import annotations

import csv
import gzip
import importlib.util
import io
import json
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


normalizer = load("demography_normalizer", "normalizer.py")
worker = load("demography_worker", "worker.py")
submit = load("demography_submit", "submit.py")


def gzip_csv(path: Path, fieldnames: list[str], records: list[dict]) -> None:
    with gzip.open(path, "wt", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


class DemographyCloudTest(unittest.TestCase):
    def test_submission_is_pinned_to_data_plane(self):
        with tempfile.TemporaryDirectory() as temporary:
            command = submit.build_command(Path(temporary), "user@example.test", "a" * 40, "2026-09-20T00:00:00Z")
        self.assertIn("--region=europe-west4", command)
        self.assertIn("psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com", " ".join(command))
        cloudbuild = (HERE / "cloudbuild.yaml").read_text(encoding="utf-8")
        self.assertIn("tags: [plane-data, country-demography]", cloudbuild)

    def test_worker_rejects_non_cloud_or_wrong_plane(self):
        valid = {
            "BUILD_ID": "run-1",
            "PROJECT_ID": worker.PROJECT,
            "DATA_REGION": worker.REGION,
            "DATA_SERVICE_ACCOUNT": worker.SERVICE_ACCOUNT,
            "LOADER_GIT_SHA": "a" * 40,
        }
        with mock.patch.dict(os.environ, valid, clear=True):
            worker.require_cloud("run-1")
        with mock.patch.dict(os.environ, {**valid, "DATA_REGION": "europe-west1"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "DATA_REGION"):
                worker.require_cloud("run-1")

    def test_age_parser_and_common_structure_reconcile(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "age.csv.gz"
            fields = ["ISO3_code", "Time", "AgeGrp", "AgeGrpStart", "AgeGrpSpan", "PopMale", "PopFemale", "PopTotal"]
            records = [
                {"ISO3_code": "CZE", "Time": "2023", "AgeGrp": "0-4", "AgeGrpStart": "0", "AgeGrpSpan": "5", "PopMale": "2", "PopFemale": "2", "PopTotal": "4"},
                {"ISO3_code": "CZE", "Time": "2023", "AgeGrp": "15-19", "AgeGrpStart": "15", "AgeGrpSpan": "5", "PopMale": "3", "PopFemale": "3", "PopTotal": "6"},
                {"ISO3_code": "CZE", "Time": "2023", "AgeGrp": "65-69", "AgeGrpStart": "65", "AgeGrpSpan": "5", "PopMale": "1", "PopFemale": "2", "PopTotal": "3"},
                {"ISO3_code": "CZE", "Time": "2023", "AgeGrp": "80+", "AgeGrpStart": "80", "AgeGrpSpan": "-1", "PopMale": "0.5", "PopFemale": "1.5", "PopTotal": "2"},
                {"ISO3_code": "AAA", "Time": "2023", "AgeGrp": "0-4", "AgeGrpStart": "0", "AgeGrpSpan": "5", "PopMale": "1", "PopFemale": "1", "PopTotal": "2"},
            ]
            gzip_csv(path, fields, records)
            parsed, counts = normalizer.parse_age_rows(path, {"CZE": {}})
        self.assertEqual(counts, {"received": 5, "accepted": 4, "rejected": 1, "deduplicated": 0})
        summary = normalizer.structural_summary(parsed["CZE"])
        self.assertEqual(summary["total"], 15000)
        self.assertEqual(summary["children_0_14"], 4000)
        self.assertEqual(summary["working_age_15_64"], 6000)
        self.assertEqual(summary["older_65_plus"], 5000)
        self.assertEqual(summary["old_age_dependency_per_100_working_age"], 83.3333)

    def test_source_registry_and_publication_destinations_are_explicit(self):
        registry = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))
        self.assertEqual(len(registry["sources"]), 2)
        self.assertTrue(all(source["url"].startswith("https://population.un.org/") for source in registry["sources"]))
        self.assertIn("/data/demography/index.v2.json", registry["website_destinations"])
        self.assertEqual(worker.POINTER, "gs://czbudget-janrezab-data-layers/published/country-demography/current.json")

    def test_completion_exists_before_atomic_pointer_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            (work / "staging").mkdir()
            (work / "receipts").mkdir()
            (work / "staging" / "output.json").write_text("{}", encoding="utf-8")
            (work / "receipts" / "raw-sources.json").write_text(
                json.dumps({"sources": []}), encoding="utf-8"
            )
            (work / "receipts" / "processed.json").write_text(json.dumps({
                "files": {"output.json": {"bytes": 2, "sha256": worker.sha256(work / "staging" / "output.json")}},
                "coverage": {
                    "source_rows": {"age": {"received": 1, "accepted": 1, "rejected": 0, "deduplicated": 0}},
                    "source_totals": {}, "normalized": {}, "country_count": 195,
                    "period": {"start": 1950, "end": 2100}, "validation": {"status": "passed"},
                },
            }), encoding="utf-8")
            sources = work / "sources.json"
            sources.write_text(json.dumps({
                "dataset": "country-demography", "revision": "test", "website_destinations": [],
            }), encoding="utf-8")
            events = []
            def upload(path, uri):
                events.append(("upload", uri))
            def command(*args, **kwargs):
                self.assertTrue((work / "completed.json").is_file())
                events.append(("pointer", args[-4]))
            with mock.patch.dict(os.environ, {"LOADER_GIT_SHA": "a" * 40}, clear=True), \
                 mock.patch.object(worker, "require_cloud"), \
                 mock.patch.object(worker, "upload_create_only", side_effect=upload), \
                 mock.patch.object(worker, "pointer_generation", return_value="0"), \
                 mock.patch.object(worker, "command", side_effect=command):
                worker.publish(work, "run-1", sources)
            self.assertEqual(events[-2], ("upload", f"{worker.RUNS}/run-1/completed.json"))
            self.assertEqual(events[-1][0], "pointer")
            pointer = json.loads((work / "current.json").read_text(encoding="utf-8"))
            self.assertEqual(pointer["completed_receipt_sha256"], worker.sha256(work / "completed.json"))
            self.assertEqual(pointer["publication_status"], "published_data_plane")

if __name__ == "__main__":
    unittest.main()
