import json
import unittest
from pathlib import Path
from urllib.parse import urlparse


REGISTRY_PATH = (
    Path(__file__).resolve().parents[1]
    / "config"
    / "us_major_cities_sources.json"
)


def load_registry():
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def fetchable_sources(city):
    """The cloud loader contract: no truthy-URL shortcut is permitted."""
    return [source for source in city["sources"] if source["status"] == "import_ready"]


def validate_registry(registry):
    errors = []
    selection = registry.get("selection", {})
    cities = registry.get("cities", [])
    policy = registry.get("source_policy", {})
    broad_sources = registry.get("sources", [])

    if selection.get("population_vintage") != 2025:
        errors.append("selection must use Census Vintage 2025")
    if selection.get("operator") != ">" or selection.get("cutoff") != 500000:
        errors.append("selection must be population > 500000")
    if selection.get("entity_count") != 39 or len(cities) != 39:
        errors.append("registry must contain exactly 39 entities")
    if not selection.get("source_url"):
        errors.append("population selection provenance is required")

    slugs = [city.get("city_slug") for city in cities]
    government_ids = [
        city.get("census_government_id_crosswalk", {}).get("government_id")
        for city in cities
    ]
    if len(slugs) != len(set(slugs)):
        errors.append("city_slug values must be unique")
    if len(government_ids) != len(set(government_ids)):
        errors.append("Census government IDs must be unique")

    required_layers = set(policy.get("layers_required", []))
    if required_layers != {"national_standardized_actual", "native_granular_budget"}:
        errors.append("exactly the broad actual and native granular layers are required")
    if policy.get("fetchable_status") != "import_ready":
        errors.append("only import_ready may be fetchable")
    if len(broad_sources) != 3:
        errors.append("exactly three top-level broad Census sources are required")
    broad_source_ids = {source.get("id") for source in broad_sources}
    if len(broad_source_ids) != 3:
        errors.append("top-level broad source IDs must be unique")
    for source in broad_sources:
        if source.get("layer") != "national_standardized_actual":
            errors.append("top-level sources must be standardized national actuals")
        if source.get("source_kind") != "broad" or source.get("status") != "import_ready":
            errors.append("top-level Census sources must be broad and import_ready")

    allowed_statuses = {"import_ready", "discovery_only"}
    for city in cities:
        label = city.get("city_slug", "<missing slug>")
        if not isinstance(city.get("population_2025"), int) or city.get("population_2025", 0) <= 500000:
            errors.append(f"{label}: population does not clear cutoff")
        if city.get("population_provenance") != selection.get("source_id"):
            errors.append(f"{label}: population provenance is absent or inconsistent")

        crosswalk = city.get("census_government_id_crosswalk", {})
        crosswalk_status = crosswalk.get("status")
        if crosswalk_status not in {"confirmed", "unresolved"}:
            errors.append(f"{label}: crosswalk status must be explicit")
        if crosswalk_status == "confirmed":
            government_id = crosswalk.get("government_id")
            if not isinstance(government_id, str) or len(government_id) != 12 or not government_id.isdigit():
                errors.append(f"{label}: confirmed government ID must be a 12-digit string")
            if not crosswalk.get("evidence"):
                errors.append(f"{label}: confirmed crosswalk requires evidence")
        elif crosswalk.get("government_id") is not None:
            errors.append(f"{label}: unresolved crosswalk cannot claim a government ID")

        sources = city.get("sources", [])
        city_broad_refs = set(city.get("broad_source_ids", []))
        layers = {source.get("layer") for source in sources}
        if city_broad_refs:
            layers.add("national_standardized_actual")
        if city_broad_refs != broad_source_ids:
            errors.append(f"{label}: must reference both top-level broad sources")
        if not required_layers.issubset(layers):
            errors.append(f"{label}: both data layers must be declared")
        for source in sources:
            source_label = f"{label}/{source.get('id', '<missing source id>')}"
            if source.get("status") not in allowed_statuses:
                errors.append(f"{source_label}: invalid source status")
            if source.get("source_kind") not in {"broad", "granular"}:
                errors.append(f"{source_label}: source_kind is required")
            if not source.get("format") or not source.get("coverage"):
                errors.append(f"{source_label}: format and coverage provenance are required")
            if source.get("status") == "import_ready":
                parsed = urlparse(source.get("url") or "")
                if parsed.scheme != "https" or not parsed.netloc:
                    errors.append(f"{source_label}: import_ready requires a direct HTTPS URL")
            if source.get("status") == "discovery_only" and source in fetchable_sources(city):
                errors.append(f"{source_label}: discovery URL was treated as fetchable")

    all_sources = broad_sources + [
        source for city in cities for source in city.get("sources", [])
    ]
    import_ready_ids = [
        source["id"] for source in all_sources
        if source.get("status") == "import_ready"
    ]
    if len(import_ready_ids) != len(set(import_ready_ids)):
        errors.append("import_ready source IDs must be globally unique")

    return errors


class UsMajorCitiesSourceRegistryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = load_registry()

    def test_registry_invariants(self):
        self.assertEqual(validate_registry(self.registry), [])

    def test_population_roster_boundary_is_documented(self):
        selection = self.registry["selection"]
        self.assertEqual(selection["first_excluded"], {
            "name": "Colorado Springs",
            "state": "CO",
            "population_2025": 494743,
        })
        populations = [city["population_2025"] for city in self.registry["cities"]]
        self.assertEqual(min(populations), 506306)
        self.assertEqual(max(populations), 8584629)

    def test_discovery_landings_are_never_fetchable(self):
        discoveries = []
        for city in self.registry["cities"]:
            discoveries.extend(
                source for source in city["sources"]
                if source["status"] == "discovery_only"
            )
            self.assertTrue(all(
                source["status"] == "import_ready"
                for source in fetchable_sources(city)
            ))
        self.assertTrue(discoveries)
        self.assertTrue(any(source["url"] for source in discoveries))
        self.assertTrue(any(source["url"] is None for source in discoveries))

    def test_nyc_has_object_and_capital_detail(self):
        nyc = next(city for city in self.registry["cities"] if city["city_slug"] == "new-york-ny")
        source_ids = {source["id"] for source in fetchable_sources(nyc)}
        self.assertIn("nyc-expense-budget-object-code", source_ids)
        self.assertIn("nyc-capital-budget-lines", source_ids)

    def test_broad_sources_are_declared_once_and_referenced(self):
        broad = self.registry["sources"]
        self.assertEqual(len(broad), 3)
        expected = {source["id"] for source in broad}
        self.assertEqual(len(expected), 3)
        for city in self.registry["cities"]:
            self.assertEqual(set(city["broad_source_ids"]), expected)
            self.assertFalse(any(
                source["layer"] == "national_standardized_actual"
                for source in city["sources"]
            ))

    def test_import_ready_source_ids_are_globally_unique(self):
        sources = self.registry["sources"] + [
            source
            for city in self.registry["cities"]
            for source in city["sources"]
        ]
        ids = [source["id"] for source in sources if source["status"] == "import_ready"]
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
