from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
WAREHOUSE = ROOT / "pipeline" / "warehouse"


class UsCityBudgetWarehouseContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = (WAREHOUSE / "us_city_budget_contract.sql").read_text()
        cls.promote = (WAREHOUSE / "promote_us_city_budget_run.sql").read_text()
        cls.validate = (WAREHOUSE / "validate_us_city_budget_run.sql").read_text()
        cls.census_promote = (WAREHOUSE / "promote_us_census_finance_run.sql").read_text()
        cls.census_loader = (WAREHOUSE / "load_us_census_finance_run.sh").read_text()

    def test_contract_is_additive_and_keeps_existing_tables_untouched(self):
        self.assertNotIn("DROP TABLE", self.schema.upper())
        self.assertNotIn("TRUNCATE TABLE", self.schema.upper())
        self.assertNotIn("ALTER TABLE", self.schema.upper())
        self.assertIn("municipal_native_budget_facts", self.schema)
        self.assertIn("municipal_budget_line_facts", self.schema)

    def test_native_grain_keeps_required_identity_and_lineage(self):
        for field in (
            "fact_id", "fact_identity", "native_dimensions", "native_dimension_signature", "measure_type",
            "view_id", "additive_group_id", "is_additive", "snapshot_id",
            "source_line_locator", "source_line_sha256",
        ):
            self.assertIn(field, self.schema)

    def test_entity_crosswalk_requires_source_evidence(self):
        aliases = self.schema.split("public_entity_aliases", 1)[1].split(";", 1)[0]
        for field in ("alias_system", "alias_value", "public_entity_id", "source_id", "evidence_url"):
            self.assertIn(field, aliases)

    def test_promotion_is_exact_run_scoped_and_non_destructive(self):
        self.assertIn("@source_id", self.promote)
        self.assertIn("@ingestion_run_id", self.promote)
        self.assertIn("source_id = promote_source_id", self.promote)
        self.assertIn("ingestion_run_id = promote_run_id", self.promote)
        self.assertNotIn("DELETE FROM", self.promote.upper())
        self.assertNotIn("WHEN NOT MATCHED BY SOURCE", self.promote.upper())
        self.assertIn("Every staged fact must reference its exact source snapshot", self.promote)
        self.assertIn("SHA256(TO_JSON_STRING(fact_identity))", self.promote)

    def test_validation_never_mutates_data(self):
        upper = self.validate.upper()
        for token in ("MERGE ", "INSERT ", "UPDATE ", "DELETE ", "DROP ", "TRUNCATE "):
            self.assertNotIn(token, upper)
        self.assertIn("COUNT(DISTINCT fact_id)", self.validate)
        self.assertIn("source_line_sha256", self.validate)

    def test_census_promotion_requires_exact_run_year_and_entity_count(self):
        for parameter in ("@source_id", "@ingestion_run_id", "@expected_year", "@expected_entities"):
            self.assertIn(parameter, self.census_promote)
        self.assertIn("COUNT(DISTINCT public_entity_id)", self.census_promote)
        self.assertIn("US_CENSUS_GOV_ID", self.census_promote)
        self.assertIn("municipal_budget_line_facts", self.census_promote)

    def test_census_loader_requires_cloud_completion_marker(self):
        self.assertIn("completed.json", self.census_loader)
        self.assertIn("--replace", self.census_loader)
        self.assertIn("expected_entities:INT64:39", self.census_loader)


if __name__ == "__main__":
    unittest.main()
