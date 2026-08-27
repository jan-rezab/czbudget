#!/usr/bin/env python3
"""Build the Czech regional government accountability contract.

The contract keeps constitutional authority, service responsibility and money
flows separate.  It deliberately does not invent transfer counterparties from
the FIN 2-12 M summary: received-transfer totals are published with an explicit
unknown-counterparty quality flag until programme-level facts are loaded.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


WEB = Path(__file__).resolve().parents[2]
WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", WEB.parent))
CONFIG_PATH = WEB / "pipeline/config/government_accountability_cze.v1.json"
BENCHMARK_PATH = WEB / "data/benchmark.v1.json"
OUTPUT_PATH = WEB / "data/accountability/cze-regions.v1.json"
WAREHOUSE_DIR = WEB / "data/accountability/warehouse"


class ContractError(ValueError):
    """Raised when reviewed accountability data violates the contract."""


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def require_unique(rows: Iterable[dict[str, Any]], key: str, label: str) -> None:
    values = [row.get(key) for row in rows]
    missing = [index for index, value in enumerate(values) if value in (None, "")]
    duplicates = sorted(value for value, count in Counter(values).items() if count > 1)
    if missing or duplicates:
        raise ContractError(f"{label}: missing {key} at {missing}; duplicates={duplicates}")


def source_references(config: dict[str, Any]) -> Iterable[tuple[str, list[str]]]:
    collections = (
        ("tier", config["tiers"]),
        ("tier_relation", config["tier_relations"]),
        ("function", config["functions"]),
        ("revenue_instrument", config["revenue_instruments"]),
        ("accountability_mechanism", config["accountability_mechanisms"]),
    )
    for label, rows in collections:
        for row in rows:
            yield f"{label}:{row.get(next((key for key in row if key.endswith('_id') or key.endswith('_code')), 'unknown'))}", row.get("source_ids", [])


def validate_config(config: dict[str, Any]) -> None:
    if config.get("contract") != "government-accountability-config.v1":
        raise ContractError("Unexpected accountability config contract")
    if config.get("country_code") != "CZE" or config.get("valid_for_fiscal_year") != 2025:
        raise ContractError("The initial reviewed contract must describe CZE fiscal year 2025")

    require_unique(config["sources"], "source_id", "sources")
    require_unique(config["tiers"], "tier_id", "tiers")
    require_unique(config["tier_relations"], "relation_id", "tier relations")
    require_unique(config["actors"], "actor_id", "actors")
    require_unique(config["accountability_mechanisms"], "mechanism_id", "accountability mechanisms")
    require_unique(config["functions"], "function_code", "functions")
    require_unique(config["revenue_instruments"], "instrument_id", "revenue instruments")
    require_unique(config["risk_hypotheses"], "risk_code", "risk hypotheses")
    require_unique(config["international_archetypes"], "archetype_id", "international archetypes")

    source_ids = {row["source_id"] for row in config["sources"]}
    for owner, references in source_references(config):
        if not references:
            raise ContractError(f"{owner} has no source lineage")
        missing = sorted(set(references) - source_ids)
        if missing:
            raise ContractError(f"{owner} references unknown sources {missing}")

    tier_ids = {row["tier_id"] for row in config["tiers"]}
    actor_ids = {row["actor_id"] for row in config["actors"]}
    for relation in config["tier_relations"]:
        if relation["from_tier_id"] not in tier_ids or relation["to_tier_id"] not in tier_ids:
            raise ContractError(f"{relation['relation_id']} references an unknown tier")
    if any(
        relation["from_tier_id"] == "CZE:REGION"
        and relation["to_tier_id"] == "CZE:MUNICIPALITY"
        and relation["is_budget_parent"]
        for relation in config["tier_relations"]
    ):
        raise ContractError("A Czech region must never be modelled as the budget parent of municipalities")

    for function in config["functions"]:
        if not function["assignments"]:
            raise ContractError(f"{function['function_code']} has no responsibility assignments")
        for assignment in function["assignments"]:
            if assignment["actor_id"] not in actor_ids or not assignment.get("roles"):
                raise ContractError(f"Invalid assignment in {function['function_code']}: {assignment}")
    for mechanism in config["accountability_mechanisms"]:
        if mechanism["answerable_actor_id"] not in actor_ids or mechanism["forum_actor_id"] not in actor_ids:
            raise ContractError(f"{mechanism['mechanism_id']} references an unknown actor")
    for instrument in config["revenue_instruments"]:
        if instrument["recipient_tier_id"] not in tier_ids:
            raise ContractError(f"{instrument['instrument_id']} references an unknown recipient tier")
        for actor_key in ("rate_setter_actor_id", "collector_actor_id", "allocator_actor_id"):
            if instrument[actor_key] not in actor_ids:
                raise ContractError(f"{instrument['instrument_id']} references an unknown {actor_key}")


def flatten_assignments(config: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for function in config["functions"]:
        for assignment in function["assignments"]:
            for role in assignment["roles"]:
                rows.append({
                    "assignment_id": f"CZE:2025:{function['function_code']}:{assignment['actor_id'].split(':', 1)[1]}:{role}",
                    "country_code": "CZE",
                    "fiscal_year": 2025,
                    "function_code": function["function_code"],
                    "function_name_cs": function["name_cs"],
                    "function_name_en": function["name_en"],
                    "actor_id": assignment["actor_id"],
                    "responsibility_role": role,
                    "legal_capacity": assignment["capacity"],
                    "source_ids": function["source_ids"],
                })
    require_unique(rows, "assignment_id", "flattened responsibility assignments")
    return rows


def regional_entities(benchmark: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [row for row in benchmark["entities"] if "region" in row["administrative_levels"]]
    if len(rows) != 14:
        raise ContractError(f"Expected 14 Czech regional accounting entities, found {len(rows)}")
    require_unique(rows, "entity_id", "regional benchmark entities")
    if not any(row["entity_id"] == "CZ:00064581" and "municipality" in row["administrative_levels"] for row in rows):
        raise ContractError("Prague must retain its dual municipality/region role")
    return rows


def amount_row(entity: dict[str, Any]) -> dict[str, Any]:
    amounts = entity["amounts"]
    revenue_components = {
        "tax_revenue": amounts["tax_revenue"],
        "transfer_revenue": amounts["transfer_revenue"],
        "nontax_revenue": amounts["nontax_revenue"],
        "capital_revenue": amounts["capital_revenue"],
    }
    component_sum = sum(revenue_components.values())
    revenue = amounts["revenue_actual"]
    difference = component_sum - revenue
    if abs(difference) > 1:
        raise ContractError(f"{entity['entity_id']}: revenue composition differs from total by {difference}")

    shares = {f"{key}_share": value / revenue if revenue else None for key, value in revenue_components.items()}
    own_source_upper_bound = revenue_components["nontax_revenue"] + revenue_components["capital_revenue"]
    return {
        "public_entity_id": entity["entity_id"],
        "national_entity_code": entity["national_id"],
        "entity_name": entity["name"],
        "display_name": entity["short_name"],
        "tier_id": "CZE:REGION",
        "accounting_roles": entity["administrative_levels"],
        "is_prague_dual_role": "municipality" in entity["administrative_levels"],
        "fiscal_year": entity["fiscal_year"],
        "budget_stage": "actual",
        "currency_code": entity["currency_code"],
        "reporting_scope": "regional_accounting_entity_only",
        "revenue_actual": revenue,
        "expense_actual": amounts["expense_actual"],
        "budget_balance": amounts["budget_balance"],
        "financing_actual": amounts["financing_actual"],
        "revenue_composition": revenue_components,
        "revenue_composition_shares": shares,
        "fiscal_autonomy_proxies": {
            "own_source_upper_bound_amount": own_source_upper_bound,
            "own_source_upper_bound_share": own_source_upper_bound / revenue if revenue else None,
            "interpretation": "Upper-bound proxy: non-tax plus capital revenue. It is not a measure of fully discretionary revenue. Tax revenue is predominantly nationally shared tax, not a regionally set tax.",
            "direct_own_tax_amount": None,
            "direct_own_tax_share": None,
            "missing_reason": "FIN 2-12 M summary does not identify regional tax-rate authority because Czech regions generally do not set the rates of the shared taxes recorded here."
        },
        "transfer_observation": {
            "amount_local": amounts["transfer_revenue"],
            "sender_entity_id": None,
            "recipient_entity_id": entity["entity_id"],
            "counterparty_coverage": "not_disaggregated_in_summary",
            "earmarking_coverage": "not_disaggregated_in_summary",
            "quality_flags": ["mixed_transfer_programmes", "sender_not_loaded", "not_matchable_for_consolidation"]
        },
        "source": {
            "source_id": "cze-monitor-fin-2-12m-2025",
            "url": entity["sources"]["budget"]
        }
    }


def aggregate(rows: list[dict[str, Any]], include_prague: bool) -> dict[str, Any]:
    selected = [row for row in rows if include_prague or not row["is_prague_dual_role"]]
    revenue = sum(row["revenue_actual"] for row in selected)
    composition = {
        key: sum(row["revenue_composition"][key] for row in selected)
        for key in ("tax_revenue", "transfer_revenue", "nontax_revenue", "capital_revenue")
    }
    return {
        "scope": "all_regions_including_prague" if include_prague else "thirteen_regions_excluding_prague",
        "entity_count": len(selected),
        "currency_code": "CZK",
        "fiscal_year": 2025,
        "revenue_actual": revenue,
        "expense_actual": sum(row["expense_actual"] for row in selected),
        "budget_balance": sum(row["budget_balance"] for row in selected),
        "revenue_composition": composition,
        "revenue_composition_shares": {f"{key}_share": value / revenue for key, value in composition.items()},
        "non_additivity_warning": "The Prague accounting budget has both municipal and regional roles. Do not add the all-region aggregate to an all-municipality aggregate without eliminating Prague and matched intergovernmental transfers."
    }


def integrity_summary(config: dict[str, Any], entities: list[dict[str, Any]], assignments: list[dict[str, Any]]) -> dict[str, Any]:
    checks = {
        "fourteen_regional_entities_present": len(entities) == 14,
        "prague_dual_role_explicit": sum(row["is_prague_dual_role"] for row in entities) == 1,
        "municipalities_not_region_budget_children": all(not relation["is_budget_parent"] for relation in config["tier_relations"] if relation["to_tier_id"] == "CZE:MUNICIPALITY"),
        "regional_revenue_components_reconcile": all(abs(sum(row["revenue_composition"].values()) - row["revenue_actual"]) <= 1 for row in entities),
        "every_function_has_assignments": all(function["assignments"] for function in config["functions"]),
        "responsibility_assignments_have_lineage": all(row["source_ids"] for row in assignments),
        "transfer_counterparty_gaps_explicit": all("sender_not_loaded" in row["transfer_observation"]["quality_flags"] for row in entities),
        "archetype_budget_coverage_explicit": all(row["budget_data_status"] for row in config["international_archetypes"]),
    }
    limitations_en = [
        "Regional FIN 2-12 M summary totals are loaded, but programme-level transfer counterparties are not yet loaded.",
        "Tax revenue is an accounting category. It must not be interpreted as tax-rate autonomy.",
        "Responsibility assignments describe the 2025 institutional design; they are not service-performance scores.",
        "International archetypes are comparison metadata only. Their regional entity budgets are not loaded in this release.",
        "Provider assets, employment, outputs, quality outcomes, procurement and debt instruments remain separate future fact layers."
    ]
    limitations_cs = [
        "Souhrnné částky FIN 2-12 M jsou načtené, ale protistrany a programy jednotlivých transferů zatím ne.",
        "Daňové příjmy jsou účetní kategorie. Nesmějí být vykládány jako pravomoc kraje určovat sazbu daně.",
        "Přiřazení odpovědností popisuje institucionální uspořádání roku 2025; nejde o hodnocení výkonu služeb.",
        "Mezinárodní archetypy jsou pouze srovnávací metadata. Rozpočty zahraničních regionálních vlád v této verzi načtené nejsou.",
        "Majetek poskytovatelů, zaměstnanost, výstupy, kvalita, zakázky a dluhové nástroje zůstávají samostatnými budoucími vrstvami."
    ]
    return {
        "status": "passed" if all(checks.values()) else "failed",
        "checks": checks,
        "limitations": limitations_en,
        "limitations_cs": limitations_cs,
        "limitations_en": limitations_en,
    }


def build_payload(config: dict[str, Any], benchmark: dict[str, Any]) -> dict[str, Any]:
    validate_config(config)
    assignments = flatten_assignments(config)
    entities = [amount_row(entity) for entity in regional_entities(benchmark)]
    entities.sort(key=lambda row: (-row["revenue_actual"], row["public_entity_id"]))
    integrity = integrity_summary(config, entities, assignments)
    if integrity["status"] != "passed":
        raise ContractError(f"Generated accountability integrity failed: {integrity['checks']}")
    return {
        "contract": "government-accountability.v1",
        "schema_version": "1.0.0",
        "generated_at": benchmark["generated_at"],
        "reviewed_at": config["reviewed_at"],
        "country": {"code": "CZE", "name_cs": config["country_name_cs"], "name_en": config["country_name_en"]},
        "valid_for_fiscal_year": config["valid_for_fiscal_year"],
        "scope": {
            "institutional_scope": "Czech regional self-government and its relationships to central government, municipalities, social insurance and service providers",
            "financial_scope": "Fourteen regional accounting entities, 2025 actual FIN 2-12 M summary",
            "entity_coverage": {"expected": 14, "loaded": len(entities), "status": "complete_for_summary_headlines"},
            "responsibility_coverage": {"function_count": len(config["functions"]), "assignment_count": len(assignments), "status": "reviewed_institutional_baseline"},
            "transfer_coverage": {"received_total_by_region": "loaded", "programme_and_counterparty_detail": "not_loaded"},
            "international_coverage": "archetype_metadata_only",
        },
        "model_notes": config["model_notes"],
        "tiers": config["tiers"],
        "tier_relations": config["tier_relations"],
        "actors": config["actors"],
        "accountability_mechanisms": config["accountability_mechanisms"],
        "functions": config["functions"],
        "responsibility_assignments": assignments,
        "revenue_instruments": config["revenue_instruments"],
        "regional_entities": entities,
        "aggregates": {
            "regions_excluding_prague": aggregate(entities, include_prague=False),
            "all_regional_roles_including_prague": aggregate(entities, include_prague=True),
        },
        "risk_hypotheses": config["risk_hypotheses"],
        "international_archetypes": config["international_archetypes"],
        "sources": config["sources"],
        "integrity": integrity,
    }


def warehouse_exports(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    loaded_at = payload["generated_at"]
    transfer_rows = []
    for entity in payload["regional_entities"]:
        observation = entity["transfer_observation"]
        transfer_rows.append({
            "transfer_fact_id": f"CZE:2025:{entity['public_entity_id']}:RECEIVED_TOTAL",
            "country_code": "CZE",
            "fiscal_year": 2025,
            "budget_stage": "actual",
            "sender_public_entity_id": observation["sender_entity_id"],
            "recipient_public_entity_id": observation["recipient_entity_id"],
            "transfer_program_id": None,
            "transfer_type": "mixed_received_transfer_total",
            "earmarking": "not_disaggregated",
            "amount_local": observation["amount_local"],
            "currency_code": entity["currency_code"],
            "is_consolidation_matchable": False,
            "source_id": entity["source"]["source_id"],
            "quality_flags": observation["quality_flags"],
            "loaded_at": loaded_at,
        })
    entity_tiers = [{
        "public_entity_id": entity["public_entity_id"],
        "tier_id": entity["tier_id"],
        "valid_from": "2001-01-01",
        "valid_to": None,
        "is_dual_role": entity["is_prague_dual_role"],
        "source_id": "cze-regions-act-129-2000",
        "loaded_at": loaded_at,
    } for entity in payload["regional_entities"]]
    coverage = [{
        "coverage_id": "CZE:2025:REGIONAL_ACCOUNTABILITY",
        "country_code": "CZE",
        "fiscal_year": 2025,
        "tier_id": "CZE:REGION",
        "entity_expected_count": payload["scope"]["entity_coverage"]["expected"],
        "entity_loaded_count": payload["scope"]["entity_coverage"]["loaded"],
        "budget_coverage": payload["scope"]["entity_coverage"]["status"],
        "responsibility_coverage": payload["scope"]["responsibility_coverage"]["status"],
        "transfer_counterparty_coverage": payload["scope"]["transfer_coverage"]["programme_and_counterparty_detail"],
        "validation_status": payload["integrity"]["status"],
        "limitations": payload["integrity"]["limitations"],
        "loaded_at": loaded_at,
    }]
    tiers = [{
        **row,
        "country_code": "CZE",
        "valid_from": "2001-01-01" if row["tier_code"] in {"regional_self_government", "municipal_self_government"} else None,
        "valid_to": None,
        "loaded_at": loaded_at,
    } for row in payload["tiers"]]
    tier_relations = [{
        **row,
        "country_code": "CZE",
        "valid_from": "2001-01-01",
        "valid_to": None,
        "loaded_at": loaded_at,
    } for row in payload["tier_relations"]]
    assignments = [{
        **row,
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31",
        "loaded_at": loaded_at,
    } for row in payload["responsibility_assignments"]]
    instruments = [{
        **row,
        "country_code": "CZE",
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31",
        "loaded_at": loaded_at,
    } for row in payload["revenue_instruments"]]
    mechanisms = [{
        **row,
        "country_code": "CZE",
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31",
        "loaded_at": loaded_at,
    } for row in payload["accountability_mechanisms"]]
    sources = [{
        **row,
        "country_code": "CZE",
        "reviewed_at": payload["reviewed_at"],
        "loaded_at": loaded_at,
    } for row in payload["sources"]]
    return {
        "government_accountability_sources.jsonl": sources,
        "government_tiers.jsonl": tiers,
        "government_tier_relations.jsonl": tier_relations,
        "government_entity_tier_assignments.jsonl": entity_tiers,
        "government_responsibility_assignments.jsonl": assignments,
        "government_revenue_instruments.jsonl": instruments,
        "government_accountability_mechanisms.jsonl": mechanisms,
        "intergovernmental_transfer_facts.jsonl": transfer_rows,
        "government_accountability_coverage.jsonl": coverage,
    }


def canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def write_or_check(payload: dict[str, Any], check: bool) -> None:
    expected = canonical_json(payload)
    exports = warehouse_exports(payload)
    if check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf-8") != expected:
            raise ContractError(f"{OUTPUT_PATH} is missing or stale; run the accountability build")
        for filename, rows in exports.items():
            path = WAREHOUSE_DIR / filename
            content = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows)
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise ContractError(f"{path} is missing or stale; run the accountability build")
        return

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    WAREHOUSE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(expected, encoding="utf-8")
    for filename, rows in exports.items():
        content = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows)
        (WAREHOUSE_DIR / filename).write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if generated public and warehouse artifacts are stale")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(read_json(CONFIG_PATH), read_json(BENCHMARK_PATH))
    write_or_check(payload, args.check)
    print(json.dumps({
        "status": payload["integrity"]["status"],
        "mode": "check" if args.check else "build",
        "regional_entities": len(payload["regional_entities"]),
        "responsibility_assignments": len(payload["responsibility_assignments"]),
        "revenue_instruments": len(payload["revenue_instruments"]),
        "warehouse_exports": len(warehouse_exports(payload)),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
