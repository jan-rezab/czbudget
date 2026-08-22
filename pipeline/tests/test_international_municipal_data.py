import importlib.util
import io
import json
import struct
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "transforms/prepare_international_municipal_data.py"
SPEC = importlib.util.spec_from_file_location("international_municipal", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def dbf_bytes():
    fields = [("CODE", "C", 4, 0), ("AMOUNT", "N", 8, 2)]
    header_length = 32 + 32 * len(fields) + 1
    record_length = 1 + sum(field[2] for field in fields)
    header = bytearray(32)
    header[0] = 3
    header[4:8] = struct.pack("<I", 1)
    header[8:10] = struct.pack("<H", header_length)
    header[10:12] = struct.pack("<H", record_length)
    descriptors = bytearray()
    for name, kind, length, decimals in fields:
        descriptor = bytearray(32)
        descriptor[:len(name)] = name.encode("ascii")
        descriptor[11] = ord(kind)
        descriptor[16] = length
        descriptor[17] = decimals
        descriptors.extend(descriptor)
    record = b" " + b"A123" + b"   12.50"
    return bytes(header) + bytes(descriptors) + b"\r" + record + b"\x1a"


class InternationalMunicipalHelpersTest(unittest.TestCase):
    def test_dbf_reader_preserves_text_and_decimal(self):
        rows = list(MODULE.iter_dbf(io.BytesIO(dbf_bytes()), encoding="ascii"))
        self.assertEqual(rows, [(1, {"CODE": "A123", "AMOUNT": Decimal("12.50")})])

    def test_jsonstat_rows_respect_dimension_order(self):
        dataset = {
            "id": ["Region", "Item"],
            "dimension": {
                "Region": {"category": {"index": {"01": 0}, "label": {"01": "Town"}}},
                "Item": {"category": {"index": {"A": 0, "B": 1}, "label": {"A": "Alpha", "B": "Beta"}}},
            },
            "value": [10, 20],
        }
        self.assertEqual(list(MODULE.jsonstat_rows(dataset)), [
            {"Region": "01", "Item": "A", "Region_label": "Town", "Item_label": "Alpha", "value": 10},
            {"Region": "01", "Item": "B", "Region_label": "Town", "Item_label": "Beta", "value": 20},
        ])

    def test_french_insee_keeps_two_digit_department_padding(self):
        self.assertEqual(MODULE.french_insee({"NDEPT": "002", "INSEE": "123"}), "02123")
        self.assertEqual(MODULE.french_insee({"NDEPT": "034", "INSEE": "172"}), "34172")
        self.assertEqual(MODULE.french_insee({"NDEPT": "971", "INSEE": "05"}), "971005")

    def test_english_variable_side_is_deterministic(self):
        self.assertEqual(MODULE.uk_side("RO1_sales_fees_income"), "revenue")
        self.assertEqual(MODULE.uk_side("RO6_reserves_total"), "financing")
        self.assertEqual(MODULE.uk_side("RO2_highways_total_exp"), "expenditure")

    def test_nested_api_record_detection(self):
        rows = [{"budget_code": "1"}]
        self.assertIs(MODULE.find_record_list({"data": {"results": rows}}), rows)

    def test_ukraine_directory_selects_communities_and_kyiv(self):
        rows = [
            {"codebudg": "100", "details": 1, "beginDate": "2024-01-01", "endDate": None, "namebudg": "Бюджет Test територіальної громади"},
            {"codebudg": "2600000000", "details": 1, "beginDate": "2024-01-01", "endDate": None, "namebudg": "Бюджет міста Києва"},
            {"codebudg": "200", "details": 1, "beginDate": "2024-01-01", "endDate": None, "namebudg": "Обласний бюджет"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "budgets.json"
            path.write_text(json.dumps(rows), encoding="utf-8")
            self.assertEqual([row["codebudg"] for row in MODULE._ukraine_budget_directory(path, 2025)], ["100", "2600000000"])


if __name__ == "__main__":
    unittest.main()
