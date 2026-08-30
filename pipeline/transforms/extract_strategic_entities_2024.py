#!/usr/bin/env python3
"""Extract comparable 2024 metrics for strategic Czech state entities from the MF report."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


SOURCE_URL = "https://mf.gov.cz/assets/attachments/2024-12-31_Zprava-o-cinnosti-strategickych-subjektu-za-rok-2024.pdf"
METRICS = {
    "EBITDA": "ebitda",
    "Výsledek hospodaření po zdanění": "net_result",
    "Aktiva celkem": "total_assets",
    "Dlouhodobý majetek": "fixed_assets",
    "Vlastní kapitál": "equity",
    "Základní kapitál": "registered_capital",
    "Investice": "investment",
    "Cizí zdroje (zadlužení)": "debt",
    "Obrat": "turnover",
    "Dividenda": "owner_transfer",
    "Příjem rezortu": "owner_transfer",
    "Vklad do fondu zakladatele": "owner_transfer",
    "Počet zaměstnanců": "employees",
    "Z toho žen": "women_employees",
}

CLASSIFICATION = {
    "ČEZ, a. s.": ("energy", "Energetika", "commercial", "integrated_electric_utility"),
    "Letiště Praha, a. s.": ("transport", "Doprava a infrastruktura", "commercial", "airport_operator"),
    "MERO ČR, a.s.": ("energy", "Energetika", "network_operator", "oil_pipeline_operator"),
    "Exportní garanční a pojišťovací společnost, a.s.": ("finance", "Finance a rozvoj", "policy_finance", "export_credit_agency"),
    "ČEPRO, a.s.": ("energy", "Energetika", "commercial", "fuel_storage_and_distribution"),
    "Česká exportní banka, a.s.": ("finance", "Finance a rozvoj", "policy_finance", "export_import_bank"),
    "Kongresové centrum Praha, a.s.": ("real_estate_tourism", "Reality a cestovní ruch", "commercial", "convention_venue_operator"),
    "PRISKO a.s.": ("finance", "Finance a rozvoj", "asset_management", "state_asset_holding"),
    "Státní tiskárna cenin, s. p.": ("public_services", "Digitální a veřejné služby", "strategic_security", "secure_document_producer"),
    "Státní pokladna Centrum sdílených služeb, s. p.": ("public_services", "Digitální a veřejné služby", "public_service", "government_shared_it_services"),
    "VZLU AEROSPACE, a.s.": ("defence", "Obrana a strategický průmysl", "strategic_security", "aerospace_research_and_testing"),
    "THERMAL-F, a.s.": ("real_estate_tourism", "Reality a cestovní ruch", "commercial", "spa_hotel_operator"),
    "Správa železnic, státní organizace": ("transport", "Doprava a infrastruktura", "network_operator", "rail_infrastructure_manager"),
    "Řízení letového provozu České republiky, státní podnik": ("transport", "Doprava a infrastruktura", "network_operator", "air_navigation_service_provider"),
    "České dráhy, a.s.": ("transport", "Doprava a infrastruktura", "public_service", "passenger_rail_operator"),
    "Ředitelství silnic a dálnic s. p.": ("transport", "Doprava a infrastruktura", "network_operator", "road_infrastructure_manager"),
    "LOM PRAHA s.p.": ("defence", "Obrana a strategický průmysl", "strategic_security", "military_aviation_mro"),
    "Vojenské lesy a statky ČR, s.p.": ("natural_resources", "Přírodní zdroje a sanace", "strategic_security", "defence_forestry_and_estate"),
    "Vojenský technický ústav, s.p.": ("defence", "Obrana a strategický průmysl", "strategic_security", "defence_research_and_engineering"),
    "Vojenský výzkumný ústav, s. p.": ("defence", "Obrana a strategický průmysl", "strategic_security", "defence_research_institute"),
    "VOP CZ, s.p.": ("defence", "Obrana a strategický průmysl", "strategic_security", "land_systems_mro_and_manufacturing"),
    "Národní rozvojová banka, a.s.": ("finance", "Finance a rozvoj", "policy_finance", "national_development_bank"),
    "OTE, a.s.": ("energy", "Energetika", "network_operator", "electricity_market_operator"),
    "ČEPS, a.s.": ("energy", "Energetika", "network_operator", "electricity_transmission_system_operator"),
    "DIAMO, státní podnik": ("natural_resources", "Přírodní zdroje a sanace", "remediation", "mining_remediation_agency"),
    "Explosia a.s.": ("defence", "Obrana a strategický průmysl", "commercial", "explosives_manufacturer"),
    "Státní investiční a rozvojová společnost, a.s.": ("real_estate_tourism", "Reality a cestovní ruch", "asset_development", "industrial_site_developer"),
    "Národní agentura pro komunikační a informační technologie, s. p.": ("public_services", "Digitální a veřejné služby", "public_service", "government_digital_services"),
    "Česká pošta, s.p.": ("public_services", "Digitální a veřejné služby", "public_service", "universal_postal_operator"),
    "Budějovický Budvar, národní podnik": ("agriculture_food", "Zemědělství a potraviny", "commercial", "brewery"),
    "Lesy České republiky, s.p.": ("natural_resources", "Přírodní zdroje a sanace", "commercial", "state_forestry"),
    "Povodí Vltavy, státní podnik": ("water", "Vodní hospodářství", "network_operator", "river_basin_manager"),
    "Povodí Labe, státní podnik": ("water", "Vodní hospodářství", "network_operator", "river_basin_manager"),
    "Povodí Ohře, státní podnik": ("water", "Vodní hospodářství", "network_operator", "river_basin_manager"),
    "Povodí Moravy, s.p.": ("water", "Vodní hospodářství", "network_operator", "river_basin_manager"),
    "Povodí Odry, státní podnik": ("water", "Vodní hospodářství", "network_operator", "river_basin_manager"),
    "Podpůrný a garanční rolnický a lesnický fond, a.s.": ("finance", "Finance a rozvoj", "policy_finance", "agricultural_guarantee_fund"),
    "Českomoravská společnost chovatelů, a.s.": ("agriculture_food", "Zemědělství a potraviny", "public_service", "livestock_data_and_breeding_services"),
}


def ratio(numerator: int | None, denominator: int | None, multiplier: int = 100) -> float | None:
    if numerator is None or not denominator:
        return None
    return round(numerator / denominator * multiplier, 3)


def add_comparison_fields(entity: dict) -> None:
    if entity["name"] not in CLASSIFICATION:
        raise RuntimeError(f"Missing classification for {entity['name']}")
    sector_code, sector_name, role_code, peer_group = CLASSIFICATION[entity["name"]]
    entity["classification"] = {
        "sector_code": sector_code,
        "sector_name": sector_name,
        "role_code": role_code,
        "international_peer_group": peer_group,
        "status": "working_classification",
    }
    metrics = entity["metrics"]
    entity["fair_metrics"] = {
        "return_on_assets_pct": ratio(metrics["net_result"], metrics["total_assets"]),
        "net_margin_pct": ratio(metrics["net_result"], metrics["turnover"]),
        "ebitda_margin_pct": ratio(metrics["ebitda"], metrics["turnover"]),
        "debt_to_assets_pct": ratio(metrics["debt"], metrics["total_assets"]),
        "investment_to_assets_pct": ratio(metrics["investment"], metrics["total_assets"]),
        "asset_turnover": ratio(metrics["turnover"], metrics["total_assets"], 1),
        "turnover_per_employee_mczk": ratio(metrics["turnover"], metrics["employees"], 1),
        "net_result_per_employee_mczk": ratio(metrics["net_result"], metrics["employees"], 1),
    }


def integer(value: str) -> int | None:
    compact = value.replace(" ", "").replace("−", "-")
    if compact == "-":
        return None
    return int(compact)


def parse_entity(page_number: int, text: str) -> dict | None:
    if not all(marker in text for marker in ("Založení", "Podíl rezortu", "Ukazatel (v mil. Kč)")):
        return None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    entity = {
        "name": lines[0],
        "source_page": page_number,
        "metrics": {field: None for field in set(METRICS.values())},
    }

    ico_match = re.search(r"IČO\s*(?:\n\s*)?([0-9][0-9 ]{6,10})", text)
    if not ico_match:
        ico_index = text.find("IČO")
        ico_window = text[max(0, ico_index - 160) : ico_index + 160]
        ico_match = re.search(r"\b([0-9]{3}\s[0-9]{2}\s[0-9]{3})\b", ico_window)
    entity["ico"] = re.sub(r"\s", "", ico_match.group(1)) if ico_match else None

    for line in text.splitlines():
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 2 or parts[0] not in METRICS:
            continue
        try:
            entity["metrics"][METRICS[parts[0]]] = integer(parts[-1])
        except ValueError:
            continue

    return entity


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    extracted = subprocess.run(
        ["pdftotext", "-layout", str(args.pdf), "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    entities = []
    for page_number, page_text in enumerate(extracted.split("\f"), 1):
        entity = parse_entity(page_number, page_text)
        if entity:
            entities.append(entity)

    if len(entities) != 38:
        raise RuntimeError(f"Expected 38 strategic entities, extracted {len(entities)}")

    for entity in entities:
        add_comparison_fields(entity)

    positive_result = sum(item["metrics"]["net_result"] for item in entities if item["metrics"]["net_result"] > 0)
    negative_result = sum(item["metrics"]["net_result"] for item in entities if item["metrics"]["net_result"] < 0)

    payload = {
        "schema_version": "3.0.0",
        "country_code": "CZE",
        "currency_code": "CZK",
        "year": 2024,
        "units": {"financial": "mil. Kč", "employees": "persons"},
        "scope": "38 strategických společností a organizací ovládaných státem podle Ministerstva financí ČR",
        "ranking_definition": {
            "all_entities": "všech 38 individuálních karet seřazených podle výsledku hospodaření po zdanění",
            "most_profitable": "20 nejvyšších individuálních výsledků hospodaření po zdanění",
            "weakest_result": "20 nejnižších individuálních výsledků hospodaření; pouze záporné hodnoty jsou ztráty",
            "largest": "20 nejvyšších hodnot aktiv celkem",
        },
        "summary": {
            "entity_count": 38,
            "loss_making_count": sum(item["metrics"]["net_result"] < 0 for item in entities),
            "positive_net_result_sum": positive_result,
            "negative_net_result_sum": negative_result,
            "negative_net_result_absolute_sum": abs(negative_result),
            "turnover_ranked_entities_sum": sum(item["metrics"]["turnover"] for item in entities),
            "assets_ranked_entities_sum": sum(item["metrics"]["total_assets"] for item in entities),
            "net_result_portfolio_reported": 46551,
            "net_result_ranked_entities_sum": sum(item["metrics"]["net_result"] for item in entities),
            "budget_transfers_total": 29867,
            "employees_portfolio_reported": 84308,
            "employees_ranked_entities_sum": sum(item["metrics"]["employees"] for item in entities),
            "reconciliation_note": "Součet 38 individuálních karet se liší od souhrnného portfolia MF o 490 mil. Kč výsledku a 1 191 zaměstnanců; obě hodnoty jsou proto zveřejněny odděleně.",
        },
        "comparison_framework": {
            "primary_peer_key": "classification.international_peer_group",
            "classification_status": "working_classification",
            "principle": "Porovnávat pouze subjekty se stejnou ekonomickou funkcí a oddělit komerční výkon od veřejné služby.",
            "fair_metrics": [
                "return_on_assets_pct",
                "net_margin_pct",
                "ebitda_margin_pct",
                "debt_to_assets_pct",
                "investment_to_assets_pct",
                "asset_turnover",
                "turnover_per_employee_mczk",
                "net_result_per_employee_mczk"
            ]
        },
        "entities": entities,
        "budget_transfers": [
            {"rank": 1, "name": "ČEZ", "value": 19521},
            {"rank": 2, "name": "Lesy České republiky", "value": 3500},
            {"rank": 3, "name": "ČEPS", "value": 2000},
            {"rank": 4, "name": "PRISKO", "value": 1826},
            {"rank": 5, "name": "MERO ČR", "value": 1330},
            {"rank": 6, "name": "ČEPRO", "value": 832},
            {"rank": 7, "name": "Budějovický Budvar", "value": 550},
            {"rank": 8, "name": "Letiště Praha", "value": 305},
            {"rank": 9, "name": "OTE", "value": 3},
        ],
        "sources": [
            {
                "title": "Zpráva o činnosti a výsledcích strategických společností a organizací za rok 2024",
                "publisher": "Ministerstvo financí ČR",
                "url": SOURCE_URL,
            }
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
