import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "pipeline/config/latam_million_cities_sources.json"


class LatamMillionCityRegistryTest(unittest.TestCase):
    def setUp(self):
        self.config = json.loads(CONFIG.read_text(encoding="utf-8"))

    def test_reviewed_anchor_count_and_unique_entities(self):
        anchors = self.config["anchor_entities"]
        self.assertEqual(34, len(anchors))
        pairs = {(row["country"], row["entity_code"]) for row in anchors.values()}
        self.assertEqual(34, len(pairs))

    def test_every_anchor_has_a_reviewed_mapping(self):
        for city_code, row in self.config["anchor_entities"].items():
            with self.subTest(city_code=city_code):
                self.assertIn(row["country"], self.config["qualifying_country_layers"])
                self.assertTrue(row["entity_code"])
                self.assertTrue(row["fiscal_boundary"])

    def test_nonqualifying_layers_cannot_be_anchors(self):
        countries = {row["country"] for row in self.config["anchor_entities"].values()}
        self.assertNotIn("COL", countries)
        self.assertNotIn("CRI", countries)
        self.assertEqual(
            "Mexico City is not an entity in the EFIPEM municipal directory; use a dedicated CDMX government source",
            self.config["city_blockers"]["5439"],
        )

    def test_completed_city_warehouse_loads_are_current(self):
        overrides = self.config["warehouse_city_overrides"]
        self.assertEqual(15, len(overrides))
        expected = {
            "7303": (24604, "cb8fc8f7-78fb-457f-81e0-340af0b921b5"),
            "7935": (35101, "4d3995fa-cb99-4d94-93c3-4cbabfff81ca"),
            "1987": (38284, "6bd40cb1-1486-484f-911c-fdd905cf9087"),
            "4459": (140829, "3b196632-b968-4188-ac3d-145bb6957695"),
        }
        for city_code, (rows, run_id) in expected.items():
            with self.subTest(city_code=city_code):
                self.assertEqual("loaded", overrides[city_code]["warehouse_status"])
                self.assertEqual(rows, overrides[city_code]["warehouse_rows"])
                self.assertEqual(run_id, overrides[city_code]["completed_run"])
                self.assertIn(run_id, overrides[city_code]["ingestion_run_id"])

    def test_preload_history_is_preserved(self):
        history = self.config["historical_preload_blockers"]["cities"]
        self.assertIn("7303", history)
        self.assertIn("7935", history)
        self.assertIn("1987", history)


if __name__ == "__main__":
    unittest.main()
