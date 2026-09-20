import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "pipeline" / "india_cityfinance_cloud" / "discover_deeper.py"
spec = importlib.util.spec_from_file_location("india_depth", MODULE)
india_depth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(india_depth)


class IndiaCityFinanceDepthAuditTest(unittest.TestCase):
    def test_scoped_probes_cover_priority_cities(self):
        self.assertEqual(india_depth.PROBES, [("MH", "2022-23", "incomeStatement"), ("KA", "2023-24", "incomeStatement"), ("WB", "2022-23", "incomeStatement")])
        self.assertTrue(india_depth.BASE.startswith("https://www.cityfinance.in/api/v1/"))


if __name__ == "__main__":
    unittest.main()
