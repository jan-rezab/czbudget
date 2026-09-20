import ast
import csv
import gzip
import importlib.util
import pathlib
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class CzechHealthCloudTests(unittest.TestCase):
    def test_worker_is_cloud_only_and_preserves_completion_order(self):
        path = ROOT / "pipeline/czech_health_cloud/worker.py"
        source = path.read_text()
        ast.parse(source)
        self.assertIn('if not build_id:', source)
        self.assertIn('Cloud Build only', source)
        self.assertLess(
            source.index("upload(local_source, raw_uri)"),
            source.index('upload(Path("completed.json")'),
        )

    def test_validator_accepts_a_small_structurally_valid_fixture(self):
        path = ROOT / "pipeline/czech_health_cloud/worker.py"
        spec = importlib.util.spec_from_file_location("czech_health_worker", path)
        worker = importlib.util.module_from_spec(spec)
        assert spec.loader
        spec.loader.exec_module(worker)
        with tempfile.TemporaryDirectory() as directory:
            fixture = pathlib.Path(directory) / "fixture.csv.gz"
            with gzip.open(fixture, "wt", encoding="utf-8", newline="") as target:
                writer = csv.writer(target)
                writer.writerow(worker.EXPECTED_HEADER)
                writer.writerow([2019, "1234567", "09543", "I10", "2.5", 1, 2])
                writer.writerow([2024, "1234567", "09543", "", "1", 1, 1])
            result = worker.validate(fixture, minimum_rows=2)
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["provider_count"], 1)
        self.assertEqual(result["first_year"], 2019)
        self.assertEqual(result["last_year"], 2024)

    def test_schema_retains_non_additive_patient_measure(self):
        schema = (ROOT / "pipeline/czech_health_cloud/schema.sql").read_text()
        self.assertIn("unique_patients INT64 NOT NULL", schema)
        self.assertIn("provider_ico STRING NOT NULL", schema)
        self.assertIn("require_partition_filter = TRUE", schema)


if __name__ == "__main__":
    unittest.main()
