#!/usr/bin/env python3
"""Build the European fertility, demographic-pressure and migration dataset.

The comparable demographic backbone is UN WPP 2024. Eurostat series are kept
as separate administrative measures because registered immigration, residence
permits and immigration-law enforcement do not describe the same population.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WPP = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz"
)
EUROSTAT_API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
EUROPE = {
    "CZE": "CZ", "POL": "PL", "DEU": "DE", "FRA": "FR", "CHE": "CH",
    "SWE": "SE", "DNK": "DK", "GBR": "UK", "UKR": "UA",
    "GRC": "EL",
}


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "PublicSpendingData/1.0"})
    with urllib.request.urlopen(request, timeout=240) as response:
        return response.read()


def number(value, digits=4):
    if value in (None, "", ".."):
        return None
    return round(float(value), digits)


def jsonstat_series(dataset: str, filters: dict[str, str], digits: int = 0) -> list[dict]:
    url = EUROSTAT_API + dataset + "?" + urllib.parse.urlencode({"lang": "en", **filters})
    payload = json.loads(download(url))
    if "time" not in payload.get("id", []):
        return []
    times = payload["dimension"]["time"]["category"]["index"]
    positions = times if isinstance(times, dict) else {key: index for index, key in enumerate(times)}
    values = payload.get("value", {})
    status = payload.get("status", {})
    rows = []
    for year, position in sorted(positions.items(), key=lambda item: int(item[0])):
        raw = values.get(str(position))
        if raw is None:
            continue
        row = {"year": int(year), "value": round(float(raw), digits)}
        flag = status.get(str(position))
        if flag:
            row["status"] = flag
        rows.append(row)
    return rows


def eurostat_migration(geo: str) -> dict:
    common = {"geo": geo, "citizen": "TOTAL"}
    recorded = {
        "agedef": "REACH", "age": "TOTAL", "unit": "NR", "sex": "T", **common,
    }
    permits = {
        "reason": "TOTAL", "duration": "TOTAL", "unit": "PER", **common,
    }
    enforcement = {
        "reason": "TOTAL", "apprehen": "TOTAL", "sex": "T", "age": "TOTAL",
        "unit": "PER", **common,
    }
    return {
        "recorded_immigration": jsonstat_series("migr_imm1ctz", recorded),
        "recorded_emigration": jsonstat_series("migr_emi1ctz", recorded),
        "first_residence_permits_non_eu": jsonstat_series("migr_resfirst", permits),
        "irregular_presence_enforcement": jsonstat_series("migr_eipre", enforcement),
    }


def eurostat_fertility(geo: str) -> list[dict]:
    return jsonstat_series("demo_find", {"geo": geo, "indic_de": "TOTFERRT"}, 4)


def load_wpp() -> dict[str, list[dict]]:
    selected = {code: [] for code in EUROPE}
    content = io.BytesIO(download(WPP))
    with gzip.GzipFile(fileobj=content) as archive:
        records = csv.DictReader(io.TextIOWrapper(archive, encoding="utf-8-sig"))
        for record in records:
            code = record["ISO3_code"]
            if code not in selected:
                continue
            year = int(record["Time"])
            if year > 2100:
                continue
            selected[code].append({
                "year": year,
                "kind": "estimate" if year <= 2023 else "projection_medium",
                "population_thousands": number(record["TPopulation1July"], 3),
                "median_age": number(record["MedianAgePop"]),
                "births_thousands": number(record["Births"], 3),
                "total_fertility_rate": number(record["TFR"]),
                "natural_change_thousands": number(record["NatChange"], 3),
                "natural_change_per_1000": number(record["NatChangeRT"]),
                "net_migration_thousands": number(record["NetMigrations"], 3),
                "net_migration_per_1000": number(record["CNMR"]),
                "life_expectancy": number(record["LEx"]),
            })
    for code, rows in selected.items():
        if len(rows) != 151 or rows[0]["year"] != 1950 or rows[-1]["year"] != 2100:
            raise ValueError(f"Unexpected WPP coverage for {code}: {len(rows)} rows")
    return selected


def latest(series: list[dict], year: int) -> dict | None:
    matches = [row for row in series if row["year"] <= year]
    return matches[-1] if matches else None


def fiscal_pressure(code: str, functional: dict, demography: dict) -> dict:
    categories = functional["countries"][code]["categories"]
    social = categories["social"][-1]
    health = categories["health"][-1]
    years = demography["countries"][code]["years"]
    first = next(row for row in years if row["year"] == 2025)
    last = next(row for row in years if row["year"] == 2045)
    working_change = (last["age_20_64"] / first["age_20_64"] - 1) * 100
    return {
        "spending_year": min(social["year"], health["year"]),
        "social_protection_pct_gdp": number(social["pct_gdp"], 3),
        "health_pct_gdp": number(health["pct_gdp"], 3),
        "combined_social_health_pct_gdp": number(social["pct_gdp"] + health["pct_gdp"], 3),
        "old_age_dependency_2025": number(first["old_age_dependency_per_100_working_age"], 2),
        "old_age_dependency_2045": number(last["old_age_dependency_per_100_working_age"], 2),
        "working_age_change_2025_2045_pct": number(working_change, 2),
    }


def add_rates(migration: dict, wpp_rows: list[dict]) -> dict:
    populations = {row["year"]: row["population_thousands"] for row in wpp_rows}
    for series in migration.values():
        for row in series:
            population = populations.get(row["year"])
            row["per_1000_population"] = number(row["value"] / population, 4) if population else None
    immigration = {row["year"]: row["value"] for row in migration["recorded_immigration"]}
    emigration = {row["year"]: row["value"] for row in migration["recorded_emigration"]}
    migration["recorded_net_migration"] = [
        {
            "year": year,
            "value": immigration[year] - emigration[year],
            "per_1000_population": number((immigration[year] - emigration[year]) / populations[year], 4),
        }
        for year in sorted(immigration.keys() & emigration.keys() & populations.keys())
    ]
    return migration


def main() -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    functional = json.loads((ROOT / "data/country-functional-budgets.v1.json").read_text())
    demography = json.loads((ROOT / "data/country-demography.v1.json").read_text())
    benchmark = json.loads((ROOT / "lib/data/sovereign-benchmark.v1.json").read_text())
    names = {row["country_code"]: row for row in benchmark["countries"]}
    wpp = load_wpp()
    countries = {}
    for code, geo in EUROPE.items():
        migration = add_rates(eurostat_migration(geo), wpp[code])
        observed_fertility = eurostat_fertility(geo)
        snapshot_year = 2024
        countries[code] = {
            "name_cs": names[code]["name_cs"],
            "name_en": names[code]["name_en"],
            "wpp": wpp[code],
            "official_observed_fertility": observed_fertility,
            "fiscal_pressure": fiscal_pressure(code, functional, demography),
            "migration": migration,
            "snapshot": {
                "year": snapshot_year,
                "fertility_2023": latest(wpp[code], 2023)["total_fertility_rate"],
                "fertility_2050_medium": latest(wpp[code], 2050)["total_fertility_rate"],
                "latest_official_fertility_through_2024": latest(observed_fertility, 2024),
                "natural_change_per_1000_2023": latest(wpp[code], 2023)["natural_change_per_1000"],
                "net_migration_per_1000_2023": latest(wpp[code], 2023)["net_migration_per_1000"],
                "recorded_immigration_2024": latest(migration["recorded_immigration"], snapshot_year),
                "first_residence_permits_2024": latest(migration["first_residence_permits_non_eu"], snapshot_year),
                "irregular_presence_enforcement_2024": latest(migration["irregular_presence_enforcement"], snapshot_year),
            },
        }

    payload = {
        "schema_version": "1.0.0",
        "contract": "europe-demographic-pressure.v1",
        "generated_at": generated_at,
        "scope": {"country_codes": list(EUROPE), "country_count": len(EUROPE)},
        "reference_levels": {"replacement_fertility_births_per_woman": 2.1},
        "methodology": {
            "cs": (
                "Plodnost, přirozená změna a čistá migrace používají jednotnou řadu UN WPP 2024. "
                "Registrované přistěhování a vystěhování, první povolení k pobytu občanů mimo EU a "
                "správní záchyty neoprávněného pobytu zůstávají oddělenými řadami Eurostatu. Výdaje na "
                "sociální ochranu plus zdraví jsou pouze ukazatelem dnešní fiskální expozice, nikoli "
                "odhadem nákladů migrace nebo nízké plodnosti."
            ),
            "en": (
                "Fertility, natural change and net migration use the common UN WPP 2024 series. "
                "Recorded immigration and emigration, first permits issued to non-EU citizens, and "
                "administrative detections of irregular presence remain separate Eurostat series. "
                "Social-protection plus health spending is only a measure of current fiscal exposure, "
                "not an estimate of the cost of migration or low fertility."
            ),
            "irregular_migration_warning_cs": (
                "Záchyty zahrnují jen osoby, které přišly do kontaktu s úřady. Nejde o odhad počtu "
                "lidí pobývajících v zemi bez oprávnění a čísla odrážejí i intenzitu vymáhání práva."
            ),
            "irregular_migration_warning_en": (
                "Detections include only people who came to the attention of authorities. They are not "
                "an estimate of the unauthorised resident population and also reflect enforcement intensity."
            ),
        },
        "sources": {
            "un_wpp": {
                "publisher": "United Nations, Population Division",
                "dataset": "World Population Prospects 2024 — Demographic Indicators, Medium variant",
                "url": WPP,
                "download_url": WPP,
                "coverage": "1950–2100; estimates through 2023 and medium-variant projections from 2024",
            },
            "eurostat_migration": {
                "publisher": "Eurostat",
                "datasets": ["migr_imm1ctz", "migr_emi1ctz", "migr_resfirst", "migr_eipre"],
                "url": "https://ec.europa.eu/eurostat/web/migration-asylum/",
                "api": EUROSTAT_API,
            },
            "eurostat_fertility": {
                "publisher": "Eurostat",
                "dataset": "Fertility indicators (demo_find; TOTFERRT)",
                "url": "https://ec.europa.eu/eurostat/databrowser/view/demo_find/default/table",
                "api": EUROSTAT_API + "demo_find",
            },
            "fiscal_exposure": {
                "dataset": "data/country-functional-budgets.v1.json",
                "categories": ["social", "health"],
                "scope": "general government spending by function",
            },
            "dependency_projection": {
                "dataset": "data/country-demography.v1.json",
                "note": "Official national/principal projections with harmonised 20–64 and 65+ age bands",
            },
        },
        "countries": countries,
    }
    target = ROOT / "data/europe-demographic-pressure.v1.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Stored fertility, burden and migration series for {len(countries)} European countries")


if __name__ == "__main__":
    main()
