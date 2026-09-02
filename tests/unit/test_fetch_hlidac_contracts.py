import importlib.util
import unittest
from datetime import date
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[2] / "pipeline/transforms/fetch_hlidac_contracts.py"
SPEC = importlib.util.spec_from_file_location("fetch_hlidac_contracts", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ContractCompactionTest(unittest.TestCase):
    def test_compacts_api_contract_without_credentials(self):
        item = {
            "id": "abc123",
            "predmet": "Oprava školy",
            "datumUzavreni": "2026-08-31T00:00:00",
            "casZverejneni": "2026-09-01T10:00:00",
            "calculatedPriceWithVATinCZK": 121000,
            "platce": {"nazev": "Statutární město Plzeň", "ico": "00075370"},
            "prijemce": [{"nazev": "Dodavatel s.r.o.", "ico": "12345678"}],
            "navazanyZaznam": "parent-1",
        }
        compact = MODULE.compact_contract(item)
        self.assertEqual(compact["id"], "abc123")
        self.assertEqual(compact["payer"]["ico"], "00075370")
        self.assertEqual(compact["suppliers"][0]["name"], "Dodavatel s.r.o.")
        self.assertEqual(compact["category"]["id"], "construction")
        self.assertEqual(compact["parent_contract_id"], "parent-1")
        self.assertNotIn("token", str(compact).lower())

    def test_keyword_categories_are_deterministic(self):
        self.assertEqual(MODULE.categorize("Licence informačního systému")["id"], "digital")
        self.assertEqual(MODULE.categorize("Bez bližšího popisu")["id"], "other")

    def test_recency_is_relative_to_latest_record(self):
        contracts = [
            {"published_at": "2026-09-01T10:00:00+02:00"},
            {"published_at": "2026-08-20T10:00:00+02:00"},
            {"published_at": "2026-05-01T10:00:00+02:00"},
        ]
        MODULE.add_recency_tags(contracts)
        self.assertEqual([item["recency"]["band"] for item in contracts], ["last_7_days", "last_30_days", "older"])

    def test_budget_match_is_explicitly_inferred(self):
        match = MODULE.infer_budget_match("Oprava střechy základní školy", {"5171", "6121"})
        self.assertEqual(match["codes"], ["5171"])
        self.assertEqual(match["confidence"], "high")
        self.assertEqual(match["status"], "inferred")
        self.assertEqual(MODULE.infer_budget_match("Dokončení stavebních prací", {"6121"})["codes"], ["6121"])
        self.assertEqual(MODULE.infer_budget_match("Projektová dokumentace rekonstrukce školy", {"5166", "5171"})["codes"], ["5166"])
        self.assertEqual(MODULE.infer_budget_match("Servis informačního systému", {"5168", "5171"})["codes"], ["5168"])
        self.assertEqual(MODULE.infer_budget_match("Blíže neurčené plnění")["status"], "unmatched")
        fallback = MODULE.infer_budget_match("Sportovní akce", {"5169"}, "community")
        self.assertEqual(fallback["codes"], ["5169"])
        self.assertEqual(fallback["confidence"], "low")
        self.assertEqual(fallback["method"], "category_to_economic_item_v1")

    def test_full_history_windows_do_not_overlap(self):
        windows = MODULE.yearly_windows(date(2016, 7, 1), date(2018, 2, 3))
        self.assertEqual(windows[0], (date(2016, 7, 1), date(2016, 12, 31)))
        self.assertEqual(windows[-1], (date(2018, 1, 1), date(2018, 2, 3)))
        left, right = MODULE.split_window(date(2020, 1, 1), date(2020, 1, 10))
        self.assertEqual(left[1] + MODULE.timedelta(days=1), right[0])

    def test_budget_match_can_inherit_from_related_contract(self):
        payload = {"contracts": [
            {"id": "parent", "subject": "Oprava střechy", "published_at": "2026-01-01T00:00:00+01:00"},
            {"id": "child", "parent_contract_id": "parent", "subject": "Změna ceny díla", "published_at": "2026-01-02T00:00:00+01:00"},
        ]}
        MODULE.enrich_payload(payload, None)
        child = payload["contracts"][1]["budget_match"]
        self.assertEqual(child["codes"], ["5171"])
        self.assertEqual(child["confidence"], "medium")
        self.assertEqual(child["method"], "related_contract_inheritance_v1")


if __name__ == "__main__":
    unittest.main()
