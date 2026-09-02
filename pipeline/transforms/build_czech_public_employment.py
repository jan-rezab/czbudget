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
        "title_cs": "Zpráva o výsledcích hospodaření státního rozpočtu 2024, tabulky 54–55",
        "title_en": "State budget final account 2024, tables 54–55",
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
        "id": "msmt_education_statistics_2024",
        "publisher": "Ministerstvo školství, mládeže a tělovýchovy",
        "title_cs": "Vzdělávání v roce 2024 v datech, tabulka 21",
        "title_en": "Education in 2024 in data, table 21",
        "url": "https://msmt.gov.cz/file/65307/download/",
        "period": "2020–2024",
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
        numeric_value = float(row["value"])
        row["value"] = int(numeric_value) if numeric_value.is_integer() else numeric_value
    return rows


def employment_node(
    node_id: str,
    label_cs: str,
    label_en: str,
    value: float,
    unit: str,
    source_id: str,
    *,
    children: list[dict] | None = None,
    status: str = "official",
    details: dict | None = None,
    note_cs: str | None = None,
    note_en: str | None = None,
) -> dict:
    node = {
        "id": node_id,
        "label_cs": label_cs,
        "label_en": label_en,
        "value": value,
        "unit": unit,
        "source_id": source_id,
        "status": status,
    }
    if children:
        node["children"] = children
    if details:
        node["details"] = details
    if note_cs:
        node["note_cs"] = note_cs
    if note_en:
        node["note_en"] = note_en
    return node


def validate_employment_tree(node: dict, tolerance: float = 0.11) -> None:
    children = node.get("children", [])
    if children:
        difference = abs(sum(child["value"] for child in children) - node["value"])
        if difference > tolerance:
            raise ValueError(f"{node['id']}: children differ from parent by {difference}")
        for child in children:
            validate_employment_tree(child, tolerance)


def main() -> None:
    observations = load_rows()
    observation = {(row["source_id"], row["series_id"], row["year"]): row["value"] for row in observations}
    def obs(source_id: str, series_id: str, year: int = 2024) -> float:
        return observation[(source_id, series_id, year)]
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

    state_source = "mf_state_final_account_2024"
    state_labour = employment_node(
        "state_labour_service", "Zaměstnanci podle zákoníku práce a služebního zákona", "Labour Code and civil-service employees",
        obs(state_source, "state_employees_labour_service"), "average_employees", state_source,
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_employees_labour_service", 2023), "average_monthly_gross_czk": obs(state_source, "state_labour_service_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_labour_service_avg_salary_czk", 2023)},
    )
    state_uniformed = employment_node(
        "state_uniformed", "Příslušníci bezpečnostních sborů a vojáci", "Security-force members and soldiers",
        obs(state_source, "state_uniformed_and_soldiers"), "average_employees", state_source,
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_uniformed_and_soldiers", 2023), "average_monthly_gross_czk": obs(state_source, "state_uniformed_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_uniformed_avg_salary_czk", 2023)},
    )
    state_prosecutors = employment_node(
        "state_prosecutors", "Státní zástupci a odvozené funkce", "Prosecutors and derived offices",
        obs(state_source, "state_prosecutors_and_derived"), "average_employees", state_source,
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_prosecutors_and_derived", 2023), "average_monthly_gross_czk": obs(state_source, "state_prosecutors_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_prosecutors_avg_salary_czk", 2023)},
    )
    state_organisational = employment_node(
        "state_organisational", "Organizační složky státu", "State organisational units",
        obs(state_source, "state_organisational_units"), "average_employees", state_source,
        children=[state_labour, state_uniformed, state_prosecutors],
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_organisational_units", 2023), "average_monthly_gross_czk": obs(state_source, "state_organisational_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_organisational_avg_salary_czk", 2023)},
    )
    state_regional_education = employment_node(
        "state_regional_education", "Regionální školství v regulované sféře", "Regional education in the regulated sphere",
        obs(state_source, "state_regional_education_budget"), "average_employees", state_source,
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_regional_education_budget", 2023), "average_monthly_gross_czk": obs(state_source, "state_regional_education_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_regional_education_avg_salary_czk", 2023)},
    )
    other_contributory_2024 = obs(state_source, "state_contributory_organisations") - state_regional_education["value"]
    other_contributory_2023 = obs(state_source, "state_contributory_organisations", 2023) - obs(state_source, "state_regional_education_budget", 2023)
    state_other_contributory = employment_node(
        "state_other_contributory", "Ostatní příspěvkové organizace", "Other contributory organisations",
        other_contributory_2024, "average_employees", state_source, status="derived",
        details={"previous_year": 2023, "previous_value": other_contributory_2023},
        note_cs="Dopočet: všechny příspěvkové organizace minus regionální školství.",
        note_en="Derived as all contributory organisations minus regional education.",
    )
    state_contributory = employment_node(
        "state_contributory", "Příspěvkové organizace", "Contributory organisations",
        obs(state_source, "state_contributory_organisations"), "average_employees", state_source,
        children=[state_regional_education, state_other_contributory],
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_contributory_organisations", 2023), "average_monthly_gross_czk": obs(state_source, "state_contributory_avg_salary_czk"), "previous_average_monthly_gross_czk": obs(state_source, "state_contributory_avg_salary_czk", 2023)},
    )
    state_root = employment_node(
        "state_regulated", "Vládou regulovaná sféra", "State-regulated sphere",
        state_organisational["value"] + state_contributory["value"], "average_employees", state_source,
        children=[state_organisational, state_contributory],
        details={"previous_year": 2023, "previous_value": obs(state_source, "state_organisational_units", 2023) + obs(state_source, "state_contributory_organisations", 2023)},
    )

    education_source = "msmt_education_statistics_2024"
    education_role_specs = [
        ("teachers", "Učitelé", "Teachers"),
        ("educators", "Vychovatelé", "Educators"),
        ("vocational", "Učitelé odborného výcviku", "Vocational-training teachers"),
        ("assistants", "Asistenti pedagoga", "Teaching assistants"),
        ("special", "Speciální pedagogové", "Special pedagogues"),
        ("speech", "Školští logopedi", "School speech therapists"),
        ("psychologists", "Psychologové", "Psychologists"),
        ("coaches", "Trenéři", "Coaches"),
        ("other", "Ostatní pedagogové", "Other pedagogical workers"),
    ]
    education_role_nodes = []
    for role_id, label_cs, label_en in education_role_specs:
        details = {"average_monthly_gross_czk": obs(education_source, f"education_profession_{role_id}_wage")}
        previous_key = (education_source, f"education_profession_{role_id}", 2020)
        if previous_key in observation:
            details.update({"previous_year": 2020, "previous_value": observation[previous_key]})
        education_role_nodes.append(employment_node(
            f"education_{role_id}", label_cs, label_en,
            obs(education_source, f"education_profession_{role_id}"), "FTE", education_source,
            details=details,
        ))
    education_pedagogical = employment_node(
        "education_pedagogical", "Pedagogičtí pracovníci", "Pedagogical workers",
        obs(education_source, "education_profession_pedagogical"), "FTE", education_source,
        children=education_role_nodes,
        details={"previous_year": 2020, "previous_value": obs(education_source, "education_profession_pedagogical", 2020), "average_monthly_gross_czk": obs(education_source, "education_profession_pedagogical_wage")},
        note_cs="Součet profesí se kvůli zaokrouhlení zdroje liší od celku o 0,1 FTE.",
        note_en="Published profession rows differ from the total by 0.1 FTE because of rounding.",
    )
    education_nonpedagogical = employment_node(
        "education_nonpedagogical", "Nepedagogičtí zaměstnanci", "Non-pedagogical workers",
        obs(education_source, "education_profession_nonpedagogical"), "FTE", education_source,
        details={"previous_year": 2020, "previous_value": obs(education_source, "education_profession_nonpedagogical", 2020), "average_monthly_gross_czk": obs(education_source, "education_profession_nonpedagogical_wage")},
    )
    education_professions_root = employment_node(
        "education_professions", "Regionální školství podle profesí", "Regional education by profession",
        education_pedagogical["value"] + education_nonpedagogical["value"], "FTE", education_source,
        children=[education_pedagogical, education_nonpedagogical],
        details={"previous_year": 2020, "previous_value": education_pedagogical["details"]["previous_value"] + education_nonpedagogical["details"]["previous_value"]},
    )

    school_source = "msmt_regional_education_workforce_2024"
    school_type_specs = [
        ("nursery", "Mateřské školy", "Nursery schools"),
        ("primary", "Základní školy", "Primary schools"),
        ("secondary", "Střední školy", "Secondary schools"),
        ("conservatory", "Konzervatoře", "Conservatories"),
        ("vocational", "Vyšší odborné školy", "Higher vocational schools"),
    ]
    school_type_nodes = []
    school_pedagogical_known = 0
    school_nonpedagogical_known = 0
    for school_id, label_cs, label_en in school_type_specs:
        pedagogical = obs(school_source, f"education_school_{school_id}_pedagogical")
        nonpedagogical = obs(school_source, f"education_school_{school_id}_nonpedagogical")
        school_pedagogical_known += pedagogical
        school_nonpedagogical_known += nonpedagogical
        school_type_nodes.append(employment_node(
            f"school_{school_id}", label_cs, label_en, pedagogical + nonpedagogical, "FTE", school_source,
            children=[
                employment_node(f"school_{school_id}_pedagogical", "Pedagogičtí", "Pedagogical", pedagogical, "FTE", school_source),
                employment_node(f"school_{school_id}_nonpedagogical", "Nepedagogičtí", "Non-pedagogical", nonpedagogical, "FTE", school_source),
            ],
        ))
    school_other_pedagogical = education_2024["pedagogical"] - school_pedagogical_known
    school_other_nonpedagogical = education_2024["nonpedagogical"] - school_nonpedagogical_known
    school_type_nodes.append(employment_node(
        "school_other", "Ostatní školy a školská zařízení", "Other schools and school facilities",
        school_other_pedagogical + school_other_nonpedagogical, "FTE", school_source, status="derived",
        children=[
            employment_node("school_other_pedagogical", "Pedagogičtí", "Pedagogical", school_other_pedagogical, "FTE", school_source, status="derived"),
            employment_node("school_other_nonpedagogical", "Nepedagogičtí", "Non-pedagogical", school_other_nonpedagogical, "FTE", school_source, status="derived"),
        ],
        note_cs="Dopočet do celku zahrnuje zejména školská zařízení a další druhy škol neuvedené samostatně v tomto zjednodušeném řezu.",
        note_en="Residual to the published total, covering mainly school facilities and school types not shown separately in this simplified cut.",
    ))
    education_school_types_root = employment_node(
        "education_school_types", "Regionální školství podle druhu školy", "Regional education by school type",
        education_2024["total"], "FTE", school_source, children=school_type_nodes,
    )

    local_source = "mv_local_government_employment_2024"
    local_specs = [
        ("extended_authority", "Obce s rozšířenou působností", "Municipalities with extended competence"),
        ("delegated_authority", "Obce s pověřeným obecním úřadem", "Municipalities with an authorised office"),
        ("basic_authority", "Obce se základní působností", "Municipalities with basic competence"),
        ("prague", "Hlavní město Praha", "Capital City of Prague"),
        ("regions", "Kraje", "Regional authorities"),
    ]
    local_nodes = []
    for local_id, label_cs, label_en in local_specs:
        persons = obs(local_source, f"local_{local_id}_persons")
        men = obs(local_source, f"local_{local_id}_men")
        women = obs(local_source, f"local_{local_id}_women")
        if men + women != persons:
            raise ValueError(f"{local_id}: gender counts do not reconcile to persons")
        local_nodes.append(employment_node(
            f"local_{local_id}", label_cs, label_en, obs(local_source, f"local_{local_id}_fte"), "FTE", local_source,
            status="partial",
            details={"persons_during_year": persons, "men_persons": men, "women_persons": women, "payroll_czk_m": obs(local_source, f"local_{local_id}_payroll_czk_m"), "leaders": obs(local_source, f"local_{local_id}_leaders")},
        ))
    local_root = employment_node(
        "local_administration", "Správa obcí, Prahy a krajů", "Municipal, Prague and regional administration",
        obs(local_source, "local_government_administration"), "FTE", local_source, children=local_nodes, status="partial",
        details={"persons_during_year": sum(node["details"]["persons_during_year"] for node in local_nodes), "men_persons": sum(node["details"]["men_persons"] for node in local_nodes), "women_persons": sum(node["details"]["women_persons"] for node in local_nodes), "payroll_czk_m": sum(node["details"]["payroll_czk_m"] for node in local_nodes), "leaders": sum(node["details"]["leaders"] for node in local_nodes)},
        note_cs="Částečné pokrytí: do přehledu o obcích vstoupilo 3 741 z 6 254 obcí; Praha a kraje jsou uvedeny zvlášť.",
        note_en="Partial coverage: the municipal return covers 3,741 of 6,254 municipalities; Prague and regional authorities are shown separately.",
    )

    strategic_source = "mf_strategic_entities_2024"
    strategic_sector_labels = {
        "agriculture_food": "Agriculture and food", "defence": "Defence and strategic industry", "energy": "Energy",
        "finance": "Finance and development", "natural_resources": "Natural resources and remediation",
        "public_services": "Digital and public services", "real_estate_tourism": "Real estate and tourism",
        "transport": "Transport and infrastructure", "water": "Water management",
    }
    strategic_groups: dict[str, list[dict]] = defaultdict(list)
    for entity in strategic["entities"]:
        metrics = entity["metrics"]
        strategic_groups[entity["classification"]["sector_code"]].append(employment_node(
            f"entity_{entity['ico']}", entity["name"], entity["name"], metrics["employees"], "persons", strategic_source,
            details={
                "ico": entity["ico"], "turnover_czk_m": metrics.get("turnover"), "assets_czk_m": metrics.get("total_assets"),
                "net_result_czk_m": metrics.get("net_result"), "owner_transfer_czk_m": metrics.get("owner_transfer"),
                "women_persons": metrics.get("women_employees"),
            },
        ))
    strategic_sector_nodes = []
    for sector_code, entities in sorted(strategic_groups.items(), key=lambda item: -sum(node["value"] for node in item[1])):
        strategic_sector_nodes.append(employment_node(
            f"strategic_{sector_code}", strategic["entities"][next(index for index, entity in enumerate(strategic["entities"]) if entity["classification"]["sector_code"] == sector_code)]["classification"]["sector_name"],
            strategic_sector_labels[sector_code], sum(node["value"] for node in entities), "persons", strategic_source,
            children=sorted(entities, key=lambda node: node["value"], reverse=True), status="working_classification",
        ))
    strategic_observed = sum(node["value"] for node in strategic_sector_nodes)
    strategic_residual = strategic["summary"]["employees_portfolio_reported"] - strategic_observed
    if strategic_residual:
        strategic_sector_nodes.append(employment_node(
            "strategic_portfolio_residual", "Rozdíl proti portfoliovému součtu MF", "Difference from MF portfolio total",
            strategic_residual, "persons", strategic_source, status="derived",
            note_cs="MF zveřejňuje portfoliový součet o 1 191 zaměstnanců vyšší než součet 38 individuálních karet.",
            note_en="The MF portfolio total is 1,191 employees above the sum of the 38 individual cards.",
        ))
    strategic_root = employment_node(
        "strategic_entities", "Strategické společnosti a organizace", "Strategic companies and organisations",
        strategic["summary"]["employees_portfolio_reported"], "persons", strategic_source,
        children=strategic_sector_nodes,
        note_cs="Jde o fyzické osoby v portfoliu 38 subjektů, nikoli FTE. Odvětvové skupiny jsou pracovní klasifikace PSD; některé subjekty mohou být uvnitř vládních institucí.",
        note_en="These are persons in a 38-entity portfolio, not FTE. Sector groups are a PSD working classification; some entities may be classified inside general government.",
    )

    public_sector_root = employment_node(
        "public_sector", "Veřejný sektor", "Public sector", latest["public_sector_fte"], "FTE", "czso_public_sector_satellite_account_2024",
        children=[
            employment_node("general_government", "Vládní instituce", "General government", latest["general_government_fte"], "FTE", "czso_public_sector_satellite_account_2024", details={"previous_year": 2015, "previous_value": first["general_government_fte"]}, note_cs="Detailnější zdrojové řezy se překrývají; otevřete další pohledy místo jejich sčítání.", note_en="Deeper source views overlap; open the other views instead of adding them."),
            employment_node("public_corporations", "Veřejné korporace", "Public corporations", latest["public_corporations_combined_fte"], "FTE", "czso_public_sector_satellite_account_2024", status="derived", details={"previous_year": 2015, "previous_value": first["public_corporations_combined_fte"], "reference_year": 2023, "public_nonfinancial_fte": history[-2]["public_nonfinancial_corporations_fte"], "public_financial_fte": history[-2]["public_financial_corporations_fte"]}, note_cs="Rok 2024 je přesný reziduál. Samostatné složky jsou naposledy oficiálně dostupné za 2023.", note_en="The 2024 figure is the exact residual. Separate components were last published for 2023."),
        ],
        details={"previous_year": 2015, "previous_value": first["public_sector_fte"]},
    )

    employment_explorer = {
        "default_scope_id": "state_regulated",
        "rule": "Values add only inside the currently selected tree. The six trees overlap and must never be summed together.",
        "scopes": [
            {"id": "public_sector", "label_cs": "Celý veřejný sektor", "label_en": "Whole public sector", "coverage_status": "control_total", "source_ids": ["czso_public_sector_satellite_account_2024"], "root": public_sector_root},
            {"id": "state_regulated", "label_cs": "Státní sféra", "label_en": "State-regulated sphere", "coverage_status": "official", "source_ids": [state_source], "root": state_root},
            {"id": "education_professions", "label_cs": "Školství · profese", "label_en": "Education · professions", "coverage_status": "official", "source_ids": [education_source], "root": education_professions_root},
            {"id": "education_school_types", "label_cs": "Školství · typ školy", "label_en": "Education · school type", "coverage_status": "official", "source_ids": [school_source], "root": education_school_types_root},
            {"id": "local_administration", "label_cs": "Samospráva", "label_en": "Local administration", "coverage_status": "partial", "source_ids": [local_source], "root": local_root},
            {"id": "strategic_entities", "label_cs": "Veřejné podniky", "label_en": "Public corporations", "coverage_status": "portfolio", "source_ids": [strategic_source], "root": strategic_root},
        ],
    }
    for scope in employment_explorer["scopes"]:
        validate_employment_tree(scope["root"])

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
        "schema_version": "1.2.0",
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
        "employment_explorer": employment_explorer,
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
