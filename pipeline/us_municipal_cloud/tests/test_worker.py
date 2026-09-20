import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest import mock
import urllib.error


WORKER = Path(__file__).resolve().parents[1] / "worker.py"
SPEC = importlib.util.spec_from_file_location("us_municipal_worker", WORKER)
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class RegistryTests(unittest.TestCase):
    def test_only_explicit_import_ready_sources_are_selected(self):
        registry = {
            "sources": [
                {"id": "national", "status": "import_ready", "url": "https://example.gov/a.csv",
                 "source_kind": "broad", "format": "csv"},
                {"id": "notes", "status": "discovered", "url": "https://example.gov/no.csv",
                 "source_kind": "broad", "format": "csv"},
            ],
            "cities": [{
                "slug": "sample-city", "name": "Sample City", "status": "import_ready",
                "sources": [
                    {"id": "sample-lines", "status": "import_ready",
                     "url": "https://data.example.gov/lines.csv", "source_kind": "granular", "format": "csv"},
                    {"id": "sample-pdf", "status": "discovered",
                     "url": "https://data.example.gov/book.pdf", "source_kind": "granular", "format": "csv"},
                ],
            }],
        }
        sources = worker.import_ready_sources(registry)
        self.assertEqual([source["id"] for source in sources], ["national", "sample-lines"])
        self.assertEqual(sources[1]["city_slug"], "sample-city")

    def test_invalid_or_non_https_source_is_rejected(self):
        with self.assertRaises(ValueError):
            worker.import_ready_sources({"sources": [{
                "id": "bad", "status": "import_ready", "url": "http://example.gov/a.csv",
                "source_kind": "broad", "format": "csv",
            }]})

    def test_repeated_national_source_is_downloaded_once(self):
        shared = {"id": "census", "status": "import_ready", "url": "https://census.gov/a.zip",
                  "source_kind": "broad", "format": "zip_fixed_width"}
        registry = {"cities": [
            {"city_slug": "alpha", "sources": [dict(shared)]},
            {"city_slug": "beta", "sources": [dict(shared)]},
        ]}
        sources = worker.import_ready_sources(registry)
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["target_city_slugs"], ["alpha", "beta"])

    def test_csv_rows_and_sha_are_deterministic(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "fixture.csv"
            path.write_text("Department,Amount\nParks,12\n", encoding="utf-8")
            rows = list(worker.source_rows({"id": "fixture", "format": "csv"}, path))
            self.assertEqual(rows, [{"Department": "Parks", "Amount": "12"}])
            self.assertEqual(worker.sha256_file(path), hashlib.sha256(path.read_bytes()).hexdigest())

    def test_nested_json_records(self):
        value = {"response": {"rows": [{"name": "Parks"}]}}
        self.assertEqual(worker.nested_records(value, "response.rows"), [{"name": "Parks"}])

    def test_socrata_page_url_has_stable_order_and_offsets(self):
        url = worker.socrata_page_url("https://data.example.gov/resource/abcd.json?kind=x", 50000, 100000)
        self.assertIn("%24limit=50000", url)
        self.assertIn("%24offset=100000", url)
        self.assertIn("%24order=%3Aid", url)
        self.assertIn("kind=x", url)

    def test_xlsx_is_a_reviewed_format(self):
        worker.validate_source({"id": "workbook", "status": "import_ready",
                                "url": "https://example.gov/budget.xlsx",
                                "source_kind": "granular", "format": "xlsx"})

    def test_arcgis_page_url_is_complete_and_stable(self):
        url = worker.arcgis_page_url(
            "https://example.gov/arcgis/rest/services/Budget/FeatureServer/0", 2000, 4000, "OBJECTID"
        )
        self.assertIn("%2A", url)
        self.assertIn("resultOffset=4000", url)
        self.assertIn("resultRecordCount=2000", url)
        self.assertIn("orderByFields=OBJECTID", url)
        self.assertIn("where=1%3D1", url)

    def test_arcgis_response_preserves_attributes_and_rejects_errors(self):
        rows, exceeded = worker.arcgis_response(
            {"features": [{"attributes": {"OBJECTID": 1, "amount": 12}}],
             "exceededTransferLimit": True}, "fixture"
        )
        self.assertEqual(rows, [{"OBJECTID": 1, "amount": 12}])
        self.assertTrue(exceeded)
        with self.assertRaisesRegex(ValueError, "service error"):
            worker.arcgis_response({"error": {"code": 400, "message": "bad query"}}, "fixture")

    def test_fixed_width_zip_preserves_native_line(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "fixture.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("finance.txt", "NYC  00123\n")
            source = {"id": "fixture", "format": "zip_fixed_width", "fixed_width_fields": [
                {"name": "city", "start": 0, "end": 5},
                {"name": "amount", "start": 5, "end": 10},
            ]}
            self.assertEqual(list(worker.source_rows(source, path))[0]["amount"], "00123")

    def test_census_budget_side_matches_published_2022_method(self):
        self.assertEqual(worker.census_budget_side("T01"), "revenue")
        self.assertEqual(worker.census_budget_side("E01"), "expenditure")
        self.assertIsNone(worker.census_budget_side("19U"))

    def test_retry_only_retries_transient_http_failures(self):
        response = mock.MagicMock()
        with mock.patch.object(
            worker.urllib.request,
            "urlopen",
            side_effect=[urllib.error.HTTPError("x", 503, "busy", {}, None), response],
        ) as opened:
            self.assertIs(worker.urlopen_with_retry("request", sleep=lambda _: None), response)
            self.assertEqual(opened.call_count, 2)
        with mock.patch.object(
            worker.urllib.request,
            "urlopen",
            side_effect=urllib.error.HTTPError("x", 403, "forbidden", {}, None),
        ) as opened:
            with self.assertRaises(urllib.error.HTTPError):
                worker.urlopen_with_retry("request", sleep=lambda _: None)
            self.assertEqual(opened.call_count, 1)

    def test_census_fixed_width_line_scales_thousands_and_flags_imputation(self):
        line = "362061194805" + "T01" + "        1234" + "2024" + "I "
        row = worker.parse_census_finance_line(line, 33)
        self.assertEqual(row["government_id"], "362061194805")
        self.assertEqual(row["amount_local"], 1_234_000)
        self.assertEqual(row["budget_side"], "revenue")
        self.assertEqual(row["imputation_flag"], "I")
        without_optional_trailing_blank = line[:-1]
        self.assertEqual(
            worker.parse_census_finance_line(without_optional_trailing_blank, 33)["imputation_flag"],
            "I",
        )
        with self.assertRaisesRegex(ValueError, "expected 33 or 32"):
            worker.parse_census_finance_line(line[:-2], 33)

    @unittest.skipUnless(importlib.util.find_spec("pyarrow"), "pyarrow is installed in the cloud worker")
    def test_census_decoder_filters_targets_and_scales_thousands(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive_path = root / "fixture.zip"
            government_id = "362061194805"
            pid = (
                government_id + "NEW YORK CITY".ljust(64) + "NEW YORK".ljust(35)
                + "51000" + "008584629" + "25" + "0000000" + "00" + "  " + "  "
                + "0630" + "24"
            )
            finance = government_id + "T01" + "        1234" + "2024" + "I "
            other = "062037100001" + "T01" + "           9" + "2024" + "R "
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("Fin_PID_2024.txt", pid + "\n")
                archive.writestr("2024FinEstDAT.txt", finance + "\n" + other + "\n")
            source = {
                "id": "census", "fiscal_year": 2024, "coverage_type": "survey",
                "census_finance_layout": {
                    "record_length": 33,
                    "pid_member_pattern": r"Fin_PID_2024\\.txt$",
                    "data_member_pattern": r"2024FinEstDAT.*\\.txt$",
                },
            }
            registry = {"cities": [{
                "city_slug": "new-york-ny", "name": "New York", "state": "NY",
                "broad_source_ids": ["census"],
                "census_government_id_crosswalk": {"government_id": government_id},
            }]}
            receipt = {"sha256": "abc", "requested_url": "https://census.gov/x.zip",
                       "retrieved_at": "2026-01-01T00:00:00+00:00"}
            output = root / "facts.parquet"
            result = worker.process_census_finance(source, archive_path, receipt, registry, output)
            self.assertEqual((result["rows"], result["entities"]), (1, 1))
            import pyarrow.parquet as pq
            row = pq.read_table(output).to_pylist()[0]
            self.assertEqual(row["amount_local"], 1_234_000)
            self.assertTrue(row["is_imputed"])
            self.assertEqual(row["public_entity_id"], "US:" + government_id)


if __name__ == "__main__":
    unittest.main()
