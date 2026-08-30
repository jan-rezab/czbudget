from __future__ import annotations

import importlib.util
import json
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


CRAWLER = load("crawl_un_comtrade", ROOT / "pipeline/transforms/crawl_un_comtrade.py")
PREPARE = load("prepare_un_comtrade_warehouse", ROOT / "pipeline/transforms/prepare_un_comtrade_warehouse.py")


class UnComtradeWarehouseTest(unittest.TestCase):
    def test_recent_months_cross_year_boundary(self):
        self.assertEqual(CRAWLER.recent_complete_months(3, date(2026, 2, 10)), ["202601", "202512", "202511"])

    def test_detailed_goods_url_uses_search_classification(self):
        config = {"api_base": "https://example.test"}
        task = {
            "product_type": "C", "frequency": "A", "classification_code": "H6", "period": "2025",
            "reporter_code": 842, "flow_code": "X", "partner_codes": "[0]", "product_selector": "AG6",
        }
        url, safe = CRAWLER.safe_task_url(config, task, "secret", 100000)
        self.assertIn("/C/A/HS?", url)
        self.assertIn("cmdCode=AG6", url)
        self.assertIn("secret", url)
        self.assertNotIn("secret", safe)

    def test_capped_hs6_task_splits_into_exact_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = CRAWLER.connect(Path(directory) / "queue.sqlite3")
            CRAWLER.insert_task(connection, {
                "profile_id": "goods", "product_type": "C", "frequency": "A", "period": "2025",
                "reporter_code": 842, "reporter_iso3": "USA", "classification_code": "H6",
                "flow_code": "M", "partner_codes": [0], "product_selector": "AG6", "priority": 1,
            })
            connection.commit()
            task = connection.execute("SELECT * FROM tasks").fetchone()
            reference = {"results": [
                {"id": f"{number:06d}", "aggrlevel": 6} for number in range(45)
            ]}
            children = CRAWLER.split_task(connection, task, {"H6": reference}, 20)
            self.assertEqual(children, 3)
            selectors = [row[0] for row in connection.execute("SELECT product_selector FROM tasks WHERE parent_task_id IS NOT NULL ORDER BY product_selector")]
            self.assertEqual(sorted(len(value.split(",")) for value in selectors), [5, 20, 20])
            self.assertEqual(connection.execute("SELECT status FROM tasks WHERE task_id = ?", (task["task_id"],)).fetchone()[0], "split")
            connection.close()

    def test_period_bounds_are_bigquery_partition_dates(self):
        self.assertEqual(PREPARE.period_bounds("2025", "A"), ("2025-01-01", "2025-12-31", 2025, 52))
        self.assertEqual(PREPARE.period_bounds("202602", "M"), ("2026-02-01", "2026-02-28", 2026, 2))

    def test_bigquery_sql_has_partitioning_clustering_and_dedup(self):
        schema = (ROOT / "pipeline/warehouse/un_comtrade_schema.sql").read_text()
        merge = (ROOT / "pipeline/warehouse/merge_un_comtrade.sql").read_text()
        self.assertIn("PARTITION BY period_start", schema)
        self.assertIn("CLUSTER BY reporter_iso3, partner_iso3, classification_code, product_code", schema)
        self.assertIn("require_partition_filter = TRUE", schema)
        self.assertIn("QUALIFY ROW_NUMBER()", merge)
        self.assertIn("target.period_start BETWEEN min_observation_date AND max_observation_date", merge)
        self.assertNotIn("SELECT *", merge.upper())


if __name__ == "__main__":
    unittest.main()
