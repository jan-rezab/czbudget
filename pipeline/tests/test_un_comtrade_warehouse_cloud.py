from __future__ import annotations

import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
TRANSFORMS = ROOT / "pipeline/transforms"
sys.path.insert(0, str(TRANSFORMS))


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


CRAWLER = load("crawl_un_comtrade_cloud_test", TRANSFORMS / "crawl_un_comtrade.py")
WORKER = load("run_un_comtrade_warehouse_test", TRANSFORMS / "run_un_comtrade_warehouse.py")


class WarehouseCloudTest(unittest.TestCase):
    def connection(self, directory: str) -> sqlite3.Connection:
        connection = CRAWLER.connect(Path(directory) / "crawl.sqlite3")
        connection.row_factory = sqlite3.Row
        return connection

    def add_availability(self, connection: sqlite3.Connection, period: str, frequency: str = "M") -> None:
        connection.execute(
            """INSERT INTO availability (
              availability_id, product_type, frequency, period, reporter_code,
              reporter_iso3, reporter_name, classification_code,
              classification_search_code, dataset_code, dataset_checksum,
              total_records, first_released, last_released, raw_path, discovered_at
            ) VALUES (?, 'C', ?, ?, 203, 'CZE', 'Czechia', 'H6', 'HS',
              'dataset', 1, 2, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z',
              'availability.json.gz', '2026-01-02T00:00:00Z')""",
            (f"availability-{frequency}-{period}", frequency, period),
        )
        connection.commit()

    def add_task(self, connection: sqlite3.Connection, period: str, frequency: str = "M") -> sqlite3.Row:
        CRAWLER.insert_task(connection, {
            "profile_id": "goods", "product_type": "C", "frequency": frequency,
            "period": period, "reporter_code": 203, "reporter_iso3": "CZE",
            "classification_code": "H6", "flow_code": "M", "partner_codes": [0],
            "product_selector": "AG6", "priority": 1,
        })
        task = connection.execute(
            "SELECT * FROM tasks WHERE frequency=? AND period=?", (frequency, period)
        ).fetchone()
        connection.execute(
            """UPDATE tasks SET status='completed', raw_path=?, record_count=2,
               response_sha256='abc', updated_at='2026-01-03T00:00:00Z'
               WHERE task_id=?""",
            (f"data/sources/trade/crawler/raw/C/{frequency}/{period}/CZE/raw.json.gz", task["task_id"]),
        )
        connection.commit()
        return connection.execute("SELECT * FROM tasks WHERE task_id=?", (task["task_id"],)).fetchone()

    def test_automatic_order_prioritizes_latest_monthly_then_annual(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = self.connection(directory)
            for frequency, period in (("A", "2025"), ("M", "202501"), ("M", "202502")):
                self.add_task(connection, period, frequency)
            self.assertEqual(
                WORKER.candidate_periods(connection, None, None),
                [("M", "202502"), ("M", "202501"), ("A", "2025")],
            )

    def test_coverage_counts_only_transactionally_committed_response(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = self.connection(directory)
            self.add_availability(connection, "202601")
            task = self.add_task(connection, "202601")
            before = WORKER.coverage_for_period(connection, "202601", "M", {}, "2026-01-04T00:00:00Z")
            self.assertEqual(before[0]["crawl_status"], "queued")
            self.assertEqual(before[0]["loaded_row_count"], 0)
            committed = {(task["task_id"], "abc"): {"normalized_row_count": 2, "source_status": "completed"}}
            after = WORKER.coverage_for_period(
                connection, "202601", "M", committed, "2026-01-04T00:00:00Z"
            )
            self.assertEqual(after[0]["crawl_status"], "loaded")
            self.assertEqual(after[0]["completed_task_count"], 1)
            self.assertEqual(after[0]["loaded_row_count"], 2)

    def test_period_transaction_prunes_and_acknowledges_after_validation(self):
        stages = {key: f"stage_{key}" for key in ("observations", "coverage", "runs", "responses")}
        sql = WORKER.period_transaction_sql(stages, "2026-01-01", "2026-01-04")
        self.assertIn("DECLARE load_period DATE DEFAULT DATE '2026-01-01'", sql)
        self.assertIn("WHERE period_start = load_period", sql)
        self.assertIn("WHERE DATE(started_at) = run_date", sql)
        self.assertIn("trade_source_responses", sql)
        self.assertIn("ASSERT", sql)
        self.assertLess(sql.index("trade_observations`"), sql.index("trade_source_responses`"))
        self.assertLess(sql.index("ASSERT"), sql.index("COMMIT TRANSACTION"))

    def test_schema_exposes_monthly_rows_to_business_views(self):
        schema = (ROOT / "pipeline/warehouse/un_comtrade_schema.sql").read_text()
        self.assertIn("trade_source_responses", schema)
        self.assertNotIn("AND edge.frequency = 'A'", schema)


if __name__ == "__main__":
    unittest.main()
