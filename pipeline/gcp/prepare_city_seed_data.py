#!/usr/bin/env python3
"""Build BigQuery JSONL seeds for EU-capital budgets and city benchmarks."""

from __future__ import annotations

import os

import json
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
BUDGET_PATH = ROOT / "data" / "eu_capital_budgets_2026.json"
METRICS_PATH = ROOT / "data" / "eu_capital_city_metrics.json"
OUTPUT_DIR = ROOT / "gcp" / "seed"

ISO3 = {
    "AT": "AUT", "BE": "BEL", "BG": "BGR", "CY": "CYP", "CZ": "CZE", "DE": "DEU",
    "DK": "DNK", "EE": "EST", "ES": "ESP", "FI": "FIN", "FR": "FRA", "GB": "GBR",
    "GR": "GRC", "HR": "HRV", "HU": "HUN", "IE": "IRL", "IT": "ITA", "LT": "LTU",
    "LU": "LUX", "LV": "LVA", "MT": "MLT", "NL": "NLD", "PL": "POL", "PT": "PRT",
    "RO": "ROU", "SE": "SWE", "SI": "SVN", "SK": "SVK",
}


def write_jsonl(name: str, rows: list[dict]) -> None:
    path = OUTPUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")


budget_data = json.loads(BUDGET_PATH.read_text(encoding="utf-8"))
metrics_data = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
loaded_at = budget_data["generated_at"]
fx_date = budget_data["methodology"]["fx"]["date"]

public_entities = []
budget_facts = []
sources = []
for city in budget_data["cities"]:
    benchmark = city["benchmarks"]
    alpha2 = city["country_code"]
    entity_type = "capital_city_authority"
    if city["city_id"] in {"berlin-de", "vienna-at"}:
        entity_type = "city_state"
    elif city["city_id"] == "london-gb":
        entity_type = "metropolitan_authority"
    public_entities.append({
        "public_entity_id": city["city_id"],
        "entity_name": city["city"],
        "entity_type": entity_type,
        "country_code_alpha2": alpha2,
        "country_code_alpha3": ISO3[alpha2],
        "national_entity_code": "00064581" if city["city_id"] == "prague-cz" else None,
        "national_entity_code_type": "CZ_ICO" if city["city_id"] == "prague-cz" else None,
        "is_eu_capital": city["eu_capital"],
        "is_extra_city": bool(city.get("extra_city")),
        "default_currency_code": city["currency_code"],
        "eurostat_city_code": benchmark["population"]["geography_code"],
        "eurostat_geography_name": benchmark["population"]["geography_name"],
        "valid_from": None,
        "valid_to": None,
        "loaded_at": loaded_at,
    })
    source_id = f"budget-{city['city_id']}-{city['period']}"
    sources.append({
        "source_id": source_id,
        "public_entity_id": city["city_id"],
        "source_type": "budget_headline",
        "source_name": city["source_name"],
        "source_url": city["download_url"],
        "dataset_code": None,
        "archive_file": city.get("source_archive", {}).get("file"),
        "archive_sha256": city.get("source_archive", {}).get("sha256"),
        "retrieved_at": loaded_at,
        "notes": city["notes"],
        "loaded_at": loaded_at,
    })
    budget_facts.append({
        "public_entity_id": city["city_id"],
        "fiscal_year": int(city["period"][:4]),
        "fiscal_period": "FY",
        "period_label": city["period"],
        "period_type": city["period_type"],
        "budget_stage": "provisional" if "interim" in city["status"] or "provisional" in city["status"] else "enacted",
        "status": city["status"],
        "measure_code": city["measure"],
        "reporting_scope": city["scope"],
        "amount_local": city["budget"]["local_amount"],
        "currency_code": city["budget"]["local_currency"],
        "amount_eur": city["budget"]["eur_amount"],
        "local_currency_units_per_eur": city["budget"]["eur_conversion_rate"],
        "fx_date": fx_date,
        "amount_precision": city["amount_precision"],
        "components": city.get("components"),
        "is_provisional": "interim" in city["status"] or "provisional" in city["status"],
        "comparability_notes": city["notes"],
        "source_id": source_id,
        "ingestion_run_id": None,
        "loaded_at": loaded_at,
    })

for source in metrics_data["sources"]:
    sources.append({
        "source_id": source["source_id"],
        "public_entity_id": None,
        "source_type": "population" if source["source_id"] == "eurostat-urb-cpop1" else "tourism",
        "source_name": source["source_name"],
        "source_url": source["url"],
        "dataset_code": source.get("dataset_code"),
        "archive_file": source["source_archive"]["file"],
        "archive_sha256": source["source_archive"]["sha256"],
        "retrieved_at": loaded_at,
        "notes": None,
        "loaded_at": loaded_at,
    })

metric_rows = [
    {**{key: value for key, value in row.items() if key != "city_id"}, "public_entity_id": row["city_id"], "loaded_at": loaded_at}
    for row in metrics_data["observations"]
]
write_jsonl("public_entities.jsonl", public_entities)
write_jsonl("public_entity_sources.jsonl", sources)
write_jsonl("public_entity_budget_headlines.jsonl", budget_facts)
write_jsonl("public_entity_metric_observations.jsonl", metric_rows)
print(f"Prepared {len(public_entities)} entities, {len(budget_facts)} budgets, {len(metric_rows)} metrics and {len(sources)} sources")
