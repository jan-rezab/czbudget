import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "transforms"))

from build_asia_africa_oceania_million_city_registry import build  # noqa: E402,F401


class AsiaAfricaOceaniaMillionCityRegistryTest(unittest.TestCase):
    def setUp(self):
        self.config = json.loads(
            (ROOT / "pipeline/config/asia_africa_oceania_million_cities_sources.json").read_text()
        )

    def test_every_anchor_is_a_real_itemized_public_profile(self):
        anchors = self.config["anchor_entities"]
        self.assertEqual(8, len(anchors))
        self.assertEqual(8, len({(row["country"], row["entity_code"]) for row in anchors.values()}))
        for row in anchors.values():
            path = ROOT / "data/municipal-expansion" / row["country"].lower() / f"{row['entity_code']}.json"
            payload = json.loads(path.read_text())
            self.assertEqual(payload["name"], row["entity_name"])
            self.assertGreater(len(payload["detail"]), 0)

    def test_priority_sources_preserve_provenance_and_boundary(self):
        for source in self.config["priority_official_sources"]:
            self.assertTrue(source["source_url"].startswith("https://"))
            self.assertTrue(source["boundary"])
            self.assertTrue(source["fiscal_year"])
            self.assertTrue(source["stage"])
            self.assertTrue(source["retrieved_at"].endswith("Z"))

    def test_generated_bundle_contract(self):
        path = ROOT / "data/major-cities/asia-africa-oceania-million-plus.v1.json"
        payload = json.loads(path.read_text())
        self.assertEqual(payload["counts"], {
            "in_scope_un_cities": 378,
            "anchor_only": 8,
            "no_published_itemized_anchor": 370,
            "full_agglomeration": 0,
        })
        self.assertTrue(all(
            row["fiscal_scope"] is not None
            for row in payload["cities"]
            if row["coverage_status"] == "anchor_only"
        ))
        self.assertTrue(all(
            len(row["profile_sha256"]) == 64
            for row in payload["cities"]
            if row["coverage_status"] == "anchor_only"
        ))


if __name__ == "__main__":
    unittest.main()
