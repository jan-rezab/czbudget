#!/usr/bin/env python3
"""Build the Czech public-employment observatory from source-scoped observations."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "pipeline" / "source_data" / "cze_public_employment_observations.csv"
STRATEGIC = ROOT / "data" / "cz-state-enterprises-2024.json"
COVERAGE = ROOT / "data" / "public-entity-coverage.v1.json"
OUTPUT = ROOT / "data" / "cz-public-employment.v1.json"

SOURCES = [
    {
        "id": "czso_public_sector_satellite_account_2024",
        "publisher": "Český statistický úřad",
        "title_cs": "Satelitní účet veřejného sektoru",
        "title_en": "Public Sector Satellite Account",
        "url": "https://csu.gov.cz/public-sector-satellite-account",
        "period": "2015–2024",
    },
    {
        "id": "mf_state_final_account_2024",
        "publisher": "Ministerstvo financí ČR",
        "title_cs": "Zpráva o výsledcích hospodaření státního rozpočtu 2024, tabulka 54",
        "title_en": "State budget final account 2024, table 54",
        "url": "https://www.mfcr.cz/assets/attachments/2025-04-28_C-Zprava-o-vysledcich-hospodareni-statniho-rozpoctu.pdf",
        "period": "2024",
    },
    {
        "id": "msmt_regional_education_workforce_2024",
        "publisher": "Ministerstvo školství, mládeže a tělovýchovy",
        "title_cs": "Zaměstnanci a mzdové prostředky v regionálním školství 2024",
        "title_en": "Employees and payroll in regional education 2024",
        "url": "https://msmt.gov.cz/file/64520_1_1/download/",
        "period": "2024",
    },
    {
        "id": "msmt_regional_education_workforce_history_2019",
        "publisher": "Ministerstvo školství, mládeže a tělovýchovy",
        "title_cs": "Pracovníci v regionálním školství 2015–2019",
        "title_en": "Regional education workforce 2015–2019",
        "url": "https://msmt.gov.cz/file/53494/download/",
        "period": "2015–2019",
    },
    {
        "id": "czso_general_government_compensation_2024",
        "publisher": "Český statistický úřad",
        "title_cs": "Vládní instituce — časová řada D.1, D.11 a D.12",
        "title_en": "General government time series — D.1, D.11 and D.12",
        "url": "https://apl.czso.cz/pll/rocenka/rocenkavyber.sat_vs_cas?mylang=EN",
        "period": "2015–2024",
    },
    {
        "id": "czso_general_government_cofog_2024",
        "publisher": "Český statistický úřad",
        "title_cs": "Výdaje vládních institucí podle funkcí (COFOG)",
        "title_en": "Government expenditure by function (COFOG)",
        "url": "https://apl.czso.cz/pll/rocenka/rocenkavyber.gov_c?mylang=EN",
        "period": "2015, 2024",
    },
    {
        "id": "czso_consumer_price_index_2024",
        "publisher": "Český statistický úřad",
        "title_cs": "Míra inflace — průměrné roční indexy",
        "title_en": "Inflation rate — annual averages",
        "url": "https://csu.gov.cz/statistika/inflation_rate",
        "period": "2015–2024",
    },
    {
        "id": "mv_local_government_employment_2024",
        "publisher": "Ministerstvo vnitra ČR",
        "title_cs": "Veřejná správa v České republice 2024",
        "title_en": "Public administration in the Czech Republic 2024",
        "url": "https://mv.gov.cz/migration/ViewFile.aspx?docid=22544701",
        "period": "2024",
    },
    {
        "id": "mf_strategic_entities_2024",
        "publisher": "Ministerstvo financí ČR",
        "title_cs": "Strategické společnosti a organizace 2024",
        "title_en": "Strategic companies and organisations 2024",
        "url": "https://www.mfcr.cz/assets/attachments/2024-12-31_Zprava-o-cinnosti-strategickych-subjektu-za-rok-2024.pdf",
        "period": "2024",
    },
    {
        "id": "mf_consolidation_units_2026",
        "publisher": "Ministerstvo financí ČR",
        "title_cs": "Výčet konsolidovaných jednotek státu 2026",
        "title_en": "State consolidation units register 2026",
        "url": "https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d",
        "period": "2026",
    },
]


def load_rows() -> list[dict]:
    with SOURCE.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["year"] = int(row["year"])
        row["value"] = int(row["value"])
    return rows


def main() -> None:
    observations = load_rows()
    observation = {(row["source_id"], row["series_id"], row["year"]): row["value"] for row in observations}
    by_year: dict[int, dict[str, int]] = defaultdict(dict)
    for row in observations:
        if row["source_id"] == "czso_public_sector_satellite_account_2024":
            by_year[row["year"]][row["series_id"]] = row["value"]

    history = []
    for year in sorted(by_year):
        values = by_year[year]
        public = values["public_sector_fte"]
        government = values["general_government_fte"]
        nonfinancial = values.get("public_nonfinancial_corporations_fte")
        financial = values.get("public_financial_corporations_fte")
        combined = public - government
        if nonfinancial is not None and financial is not None and nonfinancial + financial != combined:
            raise ValueError(f"{year}: public-sector components do not reconcile")
        history.append({
            "year": year,
            "total_economy_fte": values["total_economy_fte"],
            "public_sector_fte": public,
            "general_government_fte": government,
            "public_nonfinancial_corporations_fte": nonfinancial,
            "public_financial_corporations_fte": financial,
            "public_corporations_combined_fte": combined,
            "public_corporations_combined_status": "official_components" if nonfinancial is not None else "derived_residual",
            "public_sector_share_pct": round(public / values["total_economy_fte"] * 100, 1),
        })

    first = history[0]
    latest = history[-1]

    compensation_history = []
    cpi_index = 100.0
    for row in history:
        year = row["year"]
        compensation = observation[("czso_general_government_compensation_2024", "compensation_employees_czk_m", year)]
        wages = observation[("czso_general_government_compensation_2024", "wages_salaries_czk_m", year)]
        contributions = observation[("czso_general_government_compensation_2024", "employer_social_contributions_czk_m", year)]
        inflation = observation[("czso_consumer_price_index_2024", "annual_inflation_tenths_pct", year)] / 10
        if wages + contributions != compensation:
            raise ValueError(f"{year}: D.11 and D.12 do not reconcile to D.1")
        if year != first["year"]:
            cpi_index *= 1 + inflation / 100
        monthly_cost = compensation * 1_000_000 / row["general_government_fte"] / 12
        compensation_history.append({
            "year": year,
            "general_government_fte": row["general_government_fte"],
            "compensation_employees_czk_m": compensation,
            "wages_salaries_czk_m": wages,
            "employer_social_contributions_czk_m": contributions,
            "annual_inflation_pct": inflation,
            "cpi_index_2015_100": round(cpi_index, 1),
            "average_monthly_employer_compensation_per_fte_czk": round(monthly_cost),
            "average_monthly_employer_compensation_per_fte_2015_czk": round(monthly_cost / (cpi_index / 100)),
        })

    cofog_specs = [
        ("education", "Vzdělávání", "Education", "cofog_09_education_compensation_czk_m"),
        ("health", "Zdraví", "Health", "cofog_07_health_compensation_czk_m"),
        ("general_public_services", "Všeobecné veřejné služby", "General public services", "cofog_01_general_public_services_compensation_czk_m"),
        ("public_order", "Veřejný pořádek a bezpečnost", "Public order and safety", "cofog_03_public_order_compensation_czk_m"),
        ("social_protection", "Sociální ochrana", "Social protection", "cofog_10_social_protection_compensation_czk_m"),
        ("economic_affairs", "Ekonomické záležitosti", "Economic affairs", "cofog_04_economic_affairs_compensation_czk_m"),
        ("defence", "Obrana", "Defence", "cofog_02_defence_compensation_czk_m"),
        ("recreation_culture", "Rekreace, kultura a náboženství", "Recreation, culture and religion", "cofog_08_recreation_compensation_czk_m"),
        ("environment", "Ochrana životního prostředí", "Environmental protection", "cofog_05_environment_compensation_czk_m"),
        ("housing", "Bydlení a komunální služby", "Housing and community amenities", "cofog_06_housing_compensation_czk_m"),
    ]
    function_cost_growth = []
    total_cost_change = compensation_history[-1]["compensation_employees_czk_m"] - compensation_history[0]["compensation_employees_czk_m"]
    for function_id, label_cs, label_en, series_id in cofog_specs:
        value_2015 = observation[("czso_general_government_cofog_2024", series_id, 2015)]
        value_2024 = observation[("czso_general_government_cofog_2024", series_id, 2024)]
        change = value_2024 - value_2015
        function_cost_growth.append({
            "id": function_id,
            "label_cs": label_cs,
            "label_en": label_en,
            "compensation_2015_czk_m": value_2015,
            "compensation_2024_czk_m": value_2024,
            "change_czk_m": change,
            "share_of_total_change_pct": round(change / total_cost_change * 100, 1),
        })
    if sum(row["compensation_2015_czk_m"] for row in function_cost_growth) != compensation_history[0]["compensation_employees_czk_m"]:
        raise ValueError("2015 COFOG compensation does not reconcile to D.1")
    if sum(row["compensation_2024_czk_m"] for row in function_cost_growth) != compensation_history[-1]["compensation_employees_czk_m"]:
        raise ValueError("2024 COFOG compensation does not reconcile to D.1")

    government_change = latest["general_government_fte"] - first["general_government_fte"]
    corporation_change = latest["public_corporations_combined_fte"] - first["public_corporations_combined_fte"]
    education_2015 = {
        "total": observation[("msmt_regional_education_workforce_history_2019", "regional_education_total", 2015)],
        "pedagogical": observation[("msmt_regional_education_workforce_history_2019", "regional_education_pedagogical", 2015)],
        "nonpedagogical": observation[("msmt_regional_education_workforce_history_2019", "regional_education_nonpedagogical", 2015)],
    }
    education_2024 = {
        "total": observation[("msmt_regional_education_workforce_2024", "regional_education_total", 2024)],
        "pedagogical": observation[("msmt_regional_education_workforce_2024", "regional_education_pedagogical", 2024)],
        "nonpedagogical": observation[("msmt_regional_education_workforce_2024", "regional_education_nonpedagogical", 2024)],
    }
    regional_education_growth = {
        "year_from": 2015,
        "year_to": 2024,
        "total_fte_from": education_2015["total"],
        "total_fte_to": education_2024["total"],
        "change_fte": education_2024["total"] - education_2015["total"],
        "pedagogical_change_fte": education_2024["pedagogical"] - education_2015["pedagogical"],
        "nonpedagogical_change_fte": education_2024["nonpedagogical"] - education_2015["nonpedagogical"],
        "scope": "All founders and funding sources, including public, private and church schools; evidence of a major driver, not an additive slice of S.13.",
        "source_ids": ["msmt_regional_education_workforce_history_2019", "msmt_regional_education_workforce_2024"],
    }
    if regional_education_growth["pedagogical_change_fte"] + regional_education_growth["nonpedagogical_change_fte"] != regional_education_growth["change_fte"]:
        raise ValueError("Regional-education growth components do not reconcile")

    strategic = json.loads(STRATEGIC.read_text(encoding="utf-8"))
    coverage = json.loads(COVERAGE.read_text(encoding="utf-8"))["countries"]["CZE"]
    evidence_specs = [
        ("state_budget_regulated", "Státní organizační a příspěvkové organizace", "State organisational and contributory organisations", observation[("mf_state_final_account_2024", "state_organisational_units", 2024)] + observation[("mf_state_final_account_2024", "state_contributory_organisations", 2024)], "average_employees", "mf_state_final_account_2024", "official", "Overlaps regional education and other general-government units."),
        ("regional_education", "Regionální školství", "Regional education", observation[("msmt_regional_education_workforce_2024", "regional_education_total", 2024)], "FTE", "msmt_regional_education_workforce_2024", "official", "All founders and funding sources; overlaps the state-budget-regulated layer."),
        ("local_administration", "Správa obcí a krajů", "Municipal and regional administration", observation[("mv_local_government_employment_2024", "local_government_administration", 2024)], "FTE", "mv_local_government_employment_2024", "partial", "Incomplete reporting: 3,741 of 6,254 municipalities."),
        ("strategic_entities", "38 strategických subjektů", "38 strategic entities", strategic["summary"]["employees_portfolio_reported"], "persons", "mf_strategic_entities_2024", "official", "Persons, not FTE; some entities may be classified inside general government."),
    ]
    evidence_layers = [{
        "id": item_id,
        "label_cs": label_cs,
        "label_en": label_en,
        "year": 2024,
        "value": value,
        "unit": unit,
        "source_id": source_id,
        "coverage_status": status,
        "share_of_public_sector_pct": round(value / latest["public_sector_fte"] * 100, 1),
        "additive_to_public_sector_total": False,
        "boundary_note": note,
    } for item_id, label_cs, label_en, value, unit, source_id, status, note in evidence_specs]

    first_cost = compensation_history[0]
    latest_cost = compensation_history[-1]
    payload = {
        "schema_version": "1.1.0",
        "dataset_id": "CZE_PUBLIC_EMPLOYMENT_OBSERVATORY",
        "country_code": "CZE",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "period": {"from": first["year"], "to": latest["year"], "years": len(history)},
        "canonical_measure": "full_time_equivalent_jobs",
        "headline": {
            "year": latest["year"],
            "public_sector_fte": latest["public_sector_fte"],
            "general_government_fte": latest["general_government_fte"],
            "public_corporations_combined_fte": latest["public_corporations_combined_fte"],
            "total_economy_fte": latest["total_economy_fte"],
            "public_sector_share_pct": latest["public_sector_share_pct"],
            "change_since_first_fte": latest["public_sector_fte"] - first["public_sector_fte"],
            "change_since_first_pct": round((latest["public_sector_fte"] / first["public_sector_fte"] - 1) * 100, 1),
        },
        "history": history,
        "growth": {
            "year_from": first["year"],
            "year_to": latest["year"],
            "public_sector_change_fte": latest["public_sector_fte"] - first["public_sector_fte"],
            "general_government_change_fte": government_change,
            "public_corporations_change_fte": corporation_change,
            "general_government_share_of_public_growth_pct": round(government_change / (latest["public_sector_fte"] - first["public_sector_fte"]) * 100, 1),
            "public_corporations_share_of_public_growth_pct": round(corporation_change / (latest["public_sector_fte"] - first["public_sector_fte"]) * 100, 1),
            "regional_education_evidence": regional_education_growth,
        },
        "compensation": {
            "definition": "D.1 compensation of employees: wages and salaries plus employers' social contributions. It is an employer cost, not take-home pay.",
            "price_basis": "Nominal CZK; real series deflated with CZSO annual-average CPI and expressed in 2015 CZK.",
            "source_id": "czso_general_government_compensation_2024",
            "cpi_source_id": "czso_consumer_price_index_2024",
            "cofog_source_id": "czso_general_government_cofog_2024",
            "headline": {
                "compensation_2015_czk_m": first_cost["compensation_employees_czk_m"],
                "compensation_2024_czk_m": latest_cost["compensation_employees_czk_m"],
                "change_czk_m": total_cost_change,
                "change_pct": round((latest_cost["compensation_employees_czk_m"] / first_cost["compensation_employees_czk_m"] - 1) * 100, 1),
                "average_monthly_cost_2015_czk": first_cost["average_monthly_employer_compensation_per_fte_czk"],
                "average_monthly_cost_2024_czk": latest_cost["average_monthly_employer_compensation_per_fte_czk"],
                "average_monthly_cost_change_pct": round((latest_cost["average_monthly_employer_compensation_per_fte_czk"] / first_cost["average_monthly_employer_compensation_per_fte_czk"] - 1) * 100, 1),
                "average_monthly_real_cost_2024_2015_czk": latest_cost["average_monthly_employer_compensation_per_fte_2015_czk"],
                "average_monthly_real_cost_change_pct": round((latest_cost["average_monthly_employer_compensation_per_fte_2015_czk"] / first_cost["average_monthly_employer_compensation_per_fte_2015_czk"] - 1) * 100, 1),
            },
            "history": compensation_history,
            "change_by_function": function_cost_growth,
        },
        "evidence_layers": evidence_layers,
        "entity_resolution": {
            "public_entity_register_period": coverage["sources"][0]["period"],
            "registered_entities": coverage["registry_record_count"],
            "entities_with_employee_observation": strategic["summary"]["entity_count"],
            "employee_field_status": "not_available_in_consolidation_register",
            "join_key": "ICO where published",
        },
        "reconciliation": {
            "control_total_source_id": "czso_public_sector_satellite_account_2024",
            "rule": "Detailed evidence layers explain the control total but are never summed because their perimeters overlap and their units differ.",
            "latest_identity": "public_sector_fte = general_government_fte + public_corporations_combined_fte",
            "latest_identity_difference": latest["public_sector_fte"] - latest["general_government_fte"] - latest["public_corporations_combined_fte"],
        },
        "definitions": {
            "public_sector": "All institutional units controlled by government: general government plus public non-financial and financial corporations.",
            "general_government": "ESA 2010 sector S.13: central and local government and social-security funds, including controlled non-market units.",
            "public_corporations": "Government-controlled market producers and public financial corporations, including the central bank.",
            "fte": "Full-time-equivalent jobs. Persons, positions and budgeted posts are retained as different units and never silently converted.",
        },
        "sources": SOURCES,
    }
    if payload["reconciliation"]["latest_identity_difference"] != 0:
        raise ValueError("Latest public-sector identity does not reconcile")
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(history)} years and {len(evidence_layers)} evidence layers")


if __name__ == "__main__":
    main()
