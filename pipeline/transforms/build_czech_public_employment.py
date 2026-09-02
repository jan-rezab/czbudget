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

    strategic = json.loads(STRATEGIC.read_text(encoding="utf-8"))
    coverage = json.loads(COVERAGE.read_text(encoding="utf-8"))["countries"]["CZE"]
    latest = history[-1]
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

    first = history[0]
    payload = {
        "schema_version": "1.0.0",
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
