import unittest

from pipeline.us_municipal_cloud.submit import filtered_registry


class FilteredRegistryTest(unittest.TestCase):
    def setUp(self):
        self.registry = {
            "sources": [
                {"id": "broad", "status": "import_ready"},
                {"id": "ignored-broad", "status": "discovery_only"},
            ],
            "cities": [
                {
                    "city_slug": "one",
                    "broad_source_ids": ["broad"],
                    "sources": [
                        {"id": "one-ready", "status": "import_ready"},
                        {"id": "one-discovery", "status": "discovery_only"},
                    ],
                },
                {
                    "city_slug": "two",
                    "broad_source_ids": ["broad"],
                    "sources": [{"id": "two-ready", "status": "import_ready"}],
                },
            ],
        }

    def test_keeps_only_selected_sources_and_relevant_cities(self):
        result = filtered_registry(self.registry, {"one-ready"})
        self.assertEqual(result["sources"], [])
        self.assertEqual([city["city_slug"] for city in result["cities"]], ["one"])
        self.assertEqual(result["cities"][0]["sources"][0]["id"], "one-ready")
        self.assertEqual(result["cities"][0]["broad_source_ids"], [])

    def test_can_select_shared_broad_source_without_city_duplication(self):
        result = filtered_registry(self.registry, {"broad"})
        self.assertEqual([source["id"] for source in result["sources"]], ["broad"])
        self.assertEqual([city["city_slug"] for city in result["cities"]], ["one", "two"])
        self.assertTrue(all(city["sources"] == [] for city in result["cities"]))
        self.assertTrue(all(city["broad_source_ids"] == ["broad"] for city in result["cities"]))

    def test_rejects_unknown_or_non_import_ready_source(self):
        with self.assertRaisesRegex(ValueError, "one-discovery"):
            filtered_registry(self.registry, {"one-discovery"})


if __name__ == "__main__":
    unittest.main()
