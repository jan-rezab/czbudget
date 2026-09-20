import json
import os
import sys
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from worker import api_url, fetch, load_contract, normalize, response_rows  # noqa: E402


class SeoulWorkerTest(unittest.TestCase):
    def setUp(self):
        self.contract = load_contract(ROOT / "config" / "seoul_budget_source.json")
        self.page = json.loads((HERE / "fixtures/page.json").read_text())

    def test_boundary_can_only_be_anchor(self):
        entity = self.contract["entity"]
        self.assertEqual("anchor_legal_government_only", entity["coverage_label"])
        self.assertIn("autonomous district", " ".join(entity["excluded"]))
        self.assertEqual(332, entity["un_city_code"])

    def test_response_and_normalization(self):
        total, rows = response_rows(self.page, "SeoulBudgetService")
        self.assertEqual(1, total)
        facts = normalize(rows[0], self.contract, 1, "2026-09-19T00:00:00Z")
        self.assertEqual(["current_budget", "actual", "unspent_balance"], [row["budget_stage"] for row in facts])
        self.assertEqual(["1250000000", "500000000", "750000000"], [row["amount_local"] for row in facts])
        self.assertTrue(all(row["source_payload"]["사업명"] == "공공건물 에너지효율화" for row in facts))

    def test_url_and_error_handling(self):
        url = api_url(self.contract, "secret", "SeoulBudgetService", 1, 1000)
        self.assertEqual("http://openapi.seoul.go.kr:8088/secret/json/SeoulBudgetService/1/1000", url)
        with self.assertRaisesRegex(ValueError, "Seoul API error"):
            response_rows({"RESULT": {"CODE": "ERROR-301", "MESSAGE": "KEY ERROR"}}, "x")

    def test_real_fetch_refuses_missing_credentials(self):
        key_name = self.contract["source"]["api_key_env"]
        service_name = self.contract["source"]["service_name_env"]
        previous = (os.environ.pop(key_name, None), os.environ.pop(service_name, None))
        try:
            with self.assertRaisesRegex(RuntimeError, "real load blocked"):
                fetch(self.contract, HERE / "never-created")
        finally:
            if previous[0] is not None:
                os.environ[key_name] = previous[0]
            if previous[1] is not None:
                os.environ[service_name] = previous[1]


if __name__ == "__main__":
    unittest.main()
