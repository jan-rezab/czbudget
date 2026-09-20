import importlib.util
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MODULE = ROOT / "pipeline" / "israel_tel_aviv_cloud" / "normalize.py"
spec = importlib.util.spec_from_file_location("israel_tel_aviv_normalize", MODULE)
normalize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalize)
normalize_form2 = normalize.normalize_form2


class TelAvivNormalizeTest(unittest.TestCase):
    def test_emits_paired_enacted_and_actual_service_rows(self):
        rows = [
            {"_id": 1, "גליון": "טופס 2", "עמודה": "תשלומים - תקציב - שנה נוכחית", "שורה": "חינוך", "קוד": 8, "ערך": "12.5"},
            {"_id": 2, "גליון": "טופס 2", "עמודה": "תשלומים - ביצוע - שנה נוכחית", "שורה": "חינוך", "קוד": 8, "ערך": "11"},
            {"_id": 3, "גליון": "טופס 2", "עמודה": "תשלומים - תקציב - שנה נוכחית", "שורה": "סהכ תשלומים", "קוד": 0, "ערך": "99"},
        ]
        facts = normalize_form2(rows)
        self.assertEqual([fact["stage"] for fact in facts], ["enacted", "actual"])
        self.assertEqual([fact["amount_ils"] for fact in facts], [Decimal("12500.0"), Decimal("11000")])
        self.assertEqual(facts[0]["functional_code"], facts[1]["functional_code"])

    def test_rejects_incomplete_stage_pair(self):
        with self.assertRaisesRegex(RuntimeError, "incomplete Form 2 stage pairs"):
            normalize_form2([{"_id": 1, "גליון": "טופס 2", "עמודה": "תשלומים - תקציב - שנה נוכחית", "שורה": "חינוך", "קוד": 8, "ערך": 1}])


if __name__ == "__main__":
    unittest.main()
