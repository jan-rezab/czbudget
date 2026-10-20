"""Small synthetic checks for the four-country source audit."""

import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

from openpyxl import Workbook

try:
    from google.cloud import storage  # noqa: F401
except ImportError:
    google = types.ModuleType("google")
    cloud = types.ModuleType("google.cloud")
    cloud.storage = types.ModuleType("google.cloud.storage")
    google.cloud = cloud
    sys.modules.update({"google": google, "google.cloud": cloud, "google.cloud.storage": cloud.storage})

spec = importlib.util.spec_from_file_location("worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class SourceAuditTests(unittest.TestCase):
    def test_oecd_rows_keep_year_and_missing_status(self):
        data = ("REF_AREA,TIME_PERIOD,OBS_VALUE,OBS_STATUS\n"
                "JPN,2023,12.5,\nJPN,2024,,M\nNOR,2024,99,\n").encode()
        counts, candidate = worker.parse_oecd(data, "JPN", "hospitals")
        self.assertEqual(counts, {"source_rows": 3, "accepted_rows": 1, "rejected_rows": 2, "deduplicated_rows": 0})
        self.assertEqual(candidate["observations"], [{"year": 2023, "value": 12.5, "status": None}])

    def test_who_workbook_country_presence(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Financing"
        for code, name in worker.COUNTRIES.items():
            sheet.append([code, name, 2023, 1.0])
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "who.xlsx"
            workbook.save(path)
            audit = worker.inspect_who(path)
        self.assertEqual(audit["country_row_counts"], {code: 1 for code in worker.COUNTRIES})


if __name__ == "__main__":
    unittest.main()
