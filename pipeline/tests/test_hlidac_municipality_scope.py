import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


def load_builder():
    path = ROOT / "pipeline/transforms/build_hlidac_municipality_scope.py"
    spec = importlib.util.spec_from_file_location("hlidac_scope_builder", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


class HlidacMunicipalityScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scope = load_builder().build_scope(ROOT / "data/municipal-snapshot.v1.json")

    def test_scope_has_100_unique_municipalities_in_population_order(self):
        municipalities = self.scope["municipalities"]
        self.assertEqual(len(municipalities), 100)
        self.assertEqual(len({item["ico"] for item in municipalities}), 100)
        self.assertEqual(
            [item["population"] for item in municipalities],
            sorted((item["population"] for item in municipalities), reverse=True),
        )
        self.assertEqual(municipalities[0]["name"], "Praha")

    def test_plzen_is_the_existing_baseline(self):
        plzen = next(item for item in self.scope["municipalities"] if item["ico"] == "00075370")
        self.assertEqual(plzen["rank"], 4)
        self.assertEqual(plzen["rollout_status"], "existing_baseline")
        self.assertEqual(plzen["existing_contract_data"], "data/contracts/00075370.v1.json")

    def test_policy_forbids_html_scraping(self):
        policy = self.scope["integration_policy"]
        self.assertTrue(policy["api_only"])
        self.assertFalse(policy["html_scraping"])
        self.assertEqual(policy["license"], "CC BY 3.0")


if __name__ == "__main__":
    unittest.main()
