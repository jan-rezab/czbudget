import copy
import importlib.util
import json
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "transforms/build_government_accountability.py"
SPEC = importlib.util.spec_from_file_location("government_accountability", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class GovernmentAccountabilityContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = MODULE.read_json(MODULE.CONFIG_PATH)
        cls.benchmark = MODULE.read_json(MODULE.BENCHMARK_PATH)
        cls.payload = MODULE.build_payload(cls.config, cls.benchmark)

    def test_all_czech_regional_roles_are_loaded_once(self):
        entities = self.payload["regional_entities"]
        self.assertEqual(len(entities), 14)
        self.assertEqual(len({row["public_entity_id"] for row in entities}), 14)
        prague = [row for row in entities if row["is_prague_dual_role"]]
        self.assertEqual([row["public_entity_id"] for row in prague], ["CZ:00064581"])

    def test_regions_are_not_budget_parents_of_municipalities(self):
        relation = next(row for row in self.payload["tier_relations"] if row["to_tier_id"] == "CZE:MUNICIPALITY")
        self.assertTrue(relation["is_geographic_parent"])
        self.assertFalse(relation["is_budget_parent"])

    def test_each_entity_revenue_composition_reconciles(self):
        for entity in self.payload["regional_entities"]:
            self.assertAlmostEqual(sum(entity["revenue_composition"].values()), entity["revenue_actual"], delta=1)
        aggregate = self.payload["aggregates"]["regions_excluding_prague"]
        self.assertEqual(aggregate["entity_count"], 13)
        self.assertAlmostEqual(aggregate["revenue_actual"], 367_780_817_541.91, delta=1)
        self.assertAlmostEqual(aggregate["revenue_composition_shares"]["transfer_revenue_share"], 0.6531304449866457, places=10)

    def test_transfer_totals_do_not_pretend_to_have_counterparties(self):
        for entity in self.payload["regional_entities"]:
            transfer = entity["transfer_observation"]
            self.assertIsNone(transfer["sender_entity_id"])
            self.assertIn("not_matchable_for_consolidation", transfer["quality_flags"])
        exported = MODULE.warehouse_exports(self.payload)["intergovernmental_transfer_facts.jsonl"]
        self.assertTrue(all(not row["is_consolidation_matchable"] for row in exported))

    def test_responsibility_assignments_are_atomic_unique_and_sourced(self):
        assignments = self.payload["responsibility_assignments"]
        self.assertEqual(len(assignments), 93)
        self.assertEqual(len({row["assignment_id"] for row in assignments}), len(assignments))
        self.assertTrue(all(row["source_ids"] and row["responsibility_role"] for row in assignments))

    def test_unknown_source_reference_fails(self):
        config = copy.deepcopy(self.config)
        config["functions"][0]["source_ids"].append("missing-source")
        with self.assertRaises(MODULE.ContractError):
            MODULE.validate_config(config)

    def test_municipality_budget_parent_regression_fails(self):
        config = copy.deepcopy(self.config)
        relation = next(row for row in config["tier_relations"] if row["to_tier_id"] == "CZE:MUNICIPALITY")
        relation["is_budget_parent"] = True
        with self.assertRaises(MODULE.ContractError):
            MODULE.validate_config(config)

    def test_published_payload_and_warehouse_exports_are_current(self):
        MODULE.write_or_check(self.payload, check=True)
        published = json.loads(MODULE.OUTPUT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(published["integrity"]["status"], "passed")


if __name__ == "__main__":
    unittest.main()
