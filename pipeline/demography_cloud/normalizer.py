#!/usr/bin/env python3
"""Normalize UN WPP 2024 into one comparable 195-country demography contract."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path


ESTIMATE_END = 2023
COMMON_YEARS = tuple(range(2025, 2046))
AGE_BANDS = (
    ("early_childhood_0_4", 0, 4),
    ("school_age_5_14", 5, 14),
    ("youth_15_24", 15, 24),
    ("prime_working_25_54", 25, 54),
    ("mature_working_55_64", 55, 64),
    ("older_65_79", 65, 79),
    ("oldest_80_plus", 80, None),
)
INDICATORS = {
    "population": (("TPopulation1July",), 1000, "people"),
    "population_growth_pct": (("PopGrowthRate",), 1, "percent"),
    "population_density": (("PopDensity",), 1, "people_per_km2"),
    "median_age": (("MedianAgePop",), 1, "years"),
    "total_fertility_rate": (("TFR",), 1, "births_per_woman"),
    "births": (("Births",), 1000, "people"),
    "crude_birth_rate": (("CBR",), 1, "per_1000_people"),
    "deaths": (("Deaths",), 1000, "people"),
    "crude_death_rate": (("CDR",), 1, "per_1000_people"),
    "life_expectancy": (("LEx",), 1, "years"),
    "life_expectancy_male": (("LExMale",), 1, "years"),
    "life_expectancy_female": (("LExFemale",), 1, "years"),
    "net_migration": (("NetMigrations", "NetMigration"), 1000, "people"),
    "net_migration_rate": (("CNMR",), 1, "per_1000_people"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rows(path: Path):
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def number(value: str | None, multiplier: float = 1) -> float | int | None:
    if value is None or not str(value).strip() or str(value).strip() == "..":
        return None
    result = float(str(value).replace(",", "")) * multiplier
    if not math.isfinite(result):
        return None
    return round(result) if multiplier == 1000 else round(result, 6)


def load_universe(path: Path) -> dict[str, dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    countries = payload.get("countries") or []
    result = {}
    for country in countries:
        code = country.get("iso3") or country.get("country_code")
        if not code or code in result:
            raise ValueError(f"Invalid or duplicate sovereign code: {code}")
        result[code] = country
    if len(result) != 195:
        raise ValueError(f"Expected the 195-state universe, found {len(result)}")
    return result


def period_status(year: int) -> str:
    return "estimate" if year <= ESTIMATE_END else "projection"


def parse_age_rows(path: Path, universe: dict[str, dict]) -> tuple[dict[str, list[dict]], dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    seen = {}
    received = accepted = rejected = deduplicated = 0
    for row in rows(path):
        received += 1
        code = row.get("ISO3_code", "").strip()
        if code not in universe:
            rejected += 1
            continue
        try:
            year = int(row["Time"])
            start = int(row["AgeGrpStart"])
            span = int(row["AgeGrpSpan"])
            end = None if span < 0 or "+" in row.get("AgeGrp", "") else start + span - 1
            male = number(row.get("PopMale"), 1000)
            female = number(row.get("PopFemale"), 1000)
            total = number(row.get("PopTotal"), 1000)
        except (KeyError, TypeError, ValueError):
            rejected += 1
            continue
        if None in (male, female, total) or min(male, female, total) < 0:
            rejected += 1
            continue
        if abs(total - (male + female)) > max(2, total * 0.00001):
            raise ValueError(f"Sex totals do not reconcile for {code}/{year}/{start}: {male}+{female}!={total}")
        record = {
            "year": year,
            "age_start": start,
            "age_end": end,
            "male": male,
            "female": female,
            "total": male + female,
            "status": period_status(year),
            "scenario": "historical_estimate" if year <= ESTIMATE_END else "medium",
        }
        key = (code, year, start, end)
        if key in seen:
            if seen[key] != record:
                raise ValueError(f"Conflicting duplicate age row: {key}")
            deduplicated += 1
            continue
        seen[key] = record
        grouped[code].append(record)
        accepted += 1
    for code in grouped:
        grouped[code].sort(key=lambda item: (item["year"], item["age_start"]))
    return grouped, {
        "received": received,
        "accepted": accepted,
        "rejected": rejected,
        "deduplicated": deduplicated,
    }


def parse_indicators(path: Path, universe: dict[str, dict]) -> tuple[dict[str, dict[int, dict]], dict]:
    grouped: dict[str, dict[int, dict]] = defaultdict(dict)
    received = accepted = rejected = deduplicated = 0
    for row in rows(path):
        received += 1
        code = row.get("ISO3_code", "").strip()
        if code not in universe:
            rejected += 1
            continue
        try:
            year = int(row["Time"])
        except (KeyError, TypeError, ValueError):
            rejected += 1
            continue
        record = {
            "year": year,
            "status": period_status(year),
            "scenario": "historical_estimate" if year <= ESTIMATE_END else "medium",
        }
        for name, (candidates, multiplier, _unit) in INDICATORS.items():
            key = next((candidate for candidate in candidates if candidate in row), None)
            record[name] = number(row.get(key), multiplier) if key else None
        if year in grouped[code]:
            if grouped[code][year] != record:
                raise ValueError(f"Conflicting duplicate indicator row: {code}/{year}")
            deduplicated += 1
            continue
        grouped[code][year] = record
        accepted += 1
    return grouped, {
        "received": received,
        "accepted": accepted,
        "rejected": rejected,
        "deduplicated": deduplicated,
    }


def sum_range(age_rows: list[dict], start: int, end: int | None, sex: str = "total") -> int:
    return sum(
        row[sex]
        for row in age_rows
        if row["age_start"] >= start and (end is None or row["age_start"] <= end)
    )


def structural_summary(age_rows: list[dict]) -> dict:
    total = sum(row["total"] for row in age_rows)
    male = sum(row["male"] for row in age_rows)
    female = sum(row["female"] for row in age_rows)
    if not total or male + female != total:
        raise ValueError("Annual population structure does not reconcile")
    bands = {name: sum_range(age_rows, start, end) for name, start, end in AGE_BANDS}
    children = sum_range(age_rows, 0, 14)
    working = sum_range(age_rows, 15, 64)
    older = sum_range(age_rows, 65, None)
    age_0_19 = sum_range(age_rows, 0, 19)
    age_20_64 = sum_range(age_rows, 20, 64)
    age_65_79 = sum_range(age_rows, 65, 79)
    age_80_plus = sum_range(age_rows, 80, None)
    return {
        "total": total,
        "male": male,
        "female": female,
        "bands": bands,
        "shares_pct": {name: round(value / total * 100, 4) for name, value in bands.items()},
        "children_0_14": children,
        "working_age_15_64": working,
        "older_65_plus": older,
        "child_dependency_per_100_working_age": round(children / working * 100, 4),
        "old_age_dependency_per_100_working_age": round(older / working * 100, 4),
        "total_dependency_per_100_working_age": round((children + older) / working * 100, 4),
        "ageing_index_65_plus_per_100_children": round(older / children * 100, 4),
        "sex_ratio_male_per_100_female": round(male / female * 100, 4),
        "age_0_19": age_0_19,
        "age_20_64": age_20_64,
        "age_65_79": age_65_79,
        "age_80_plus": age_80_plus,
        "male_by_age": {
            "age_0_19": sum_range(age_rows, 0, 19, "male"),
            "age_20_64": sum_range(age_rows, 20, 64, "male"),
            "age_65_79": sum_range(age_rows, 65, 79, "male"),
            "age_80_plus": sum_range(age_rows, 80, None, "male"),
        },
        "female_by_age": {
            "age_0_19": sum_range(age_rows, 0, 19, "female"),
            "age_20_64": sum_range(age_rows, 20, 64, "female"),
            "age_65_79": sum_range(age_rows, 65, 79, "female"),
            "age_80_plus": sum_range(age_rows, 80, None, "female"),
        },
    }


def validate_country(code: str, age_rows: list[dict], indicators: dict[int, dict]) -> dict[int, dict]:
    by_year: dict[int, list[dict]] = defaultdict(list)
    for row in age_rows:
        by_year[row["year"]].append(row)
    expected = set(range(1950, 2101))
    if set(by_year) != expected:
        raise ValueError(f"{code}: expected annual age structure 1950-2100")
    if set(indicators) != expected:
        raise ValueError(f"{code}: expected annual indicators 1950-2100")
    summaries = {}
    for year, year_rows in by_year.items():
        summary = structural_summary(year_rows)
        source_total = indicators[year].get("population")
        if source_total and abs(summary["total"] - source_total) / source_total > 0.001:
            raise ValueError(f"{code}/{year}: age structure and indicator population differ by over 0.1%")
        summaries[year] = summary
    return summaries


def write_json(path: Path, payload: dict, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"ensure_ascii": False}
    if compact:
        options["separators"] = (",", ":")
    else:
        options["indent"] = 2
    path.write_text(json.dumps(payload, **options) + "\n", encoding="utf-8")


def build(age_path: Path, indicator_path: Path, universe_path: Path, source_path: Path, output: Path, generated_at: str):
    universe = load_universe(universe_path)
    source_contract = json.loads(source_path.read_text(encoding="utf-8"))
    ages, age_counts = parse_age_rows(age_path, universe)
    indicators, indicator_counts = parse_indicators(indicator_path, universe)
    missing_age = sorted(set(universe) - set(ages))
    missing_indicators = sorted(set(universe) - set(indicators))
    if missing_age or missing_indicators:
        raise ValueError(f"Missing countries: age={missing_age}, indicators={missing_indicators}")

    index_countries = {}
    compatibility_countries = {}
    anchor_years = (1950, 2023, 2024, 2050, 2100)
    source_population_totals = {str(year): 0 for year in anchor_years}
    normalized_population_totals = {str(year): 0 for year in anchor_years}
    indicator_observations = {name: 0 for name in INDICATORS}
    output_files = []
    for code in universe:
        summaries = validate_country(code, ages[code], indicators[code])
        for year in anchor_years:
            source_population_totals[str(year)] += indicators[code][year]["population"]
            normalized_population_totals[str(year)] += summaries[year]["total"]
        for record in indicators[code].values():
            for name in INDICATORS:
                indicator_observations[name] += int(record[name] is not None)
        indicator_series = [indicators[code][year] for year in sorted(indicators[code])]
        structure_series = [{"year": year, **summaries[year]} for year in sorted(summaries)]
        shard = {
            "schema_version": "2.0.0",
            "contract": "country-demography-detail.v2",
            "generated_at": generated_at,
            "country_code": code,
            "period": {"from": 1950, "to": 2100, "frequency": "annual"},
            "estimate_period": {"from": 1950, "to": 2023},
            "projection_period": {"from": 2024, "to": 2100, "scenario": "medium"},
            "reference_date": "1 July",
            "age_resolution": "five-year age groups through 95-99, then 100+",
            "age_sex_rows": ages[code],
            "structure": structure_series,
            "indicators": indicator_series,
            "source_ids": [source["id"] for source in source_contract["sources"]],
        }
        relative = Path("data") / "countries" / code.lower() / "demography.v2.json"
        write_json(output / relative, shard, compact=True)
        output_files.append(relative.as_posix())
        snapshots = {
            str(year): {**summaries[year], **{k: v for k, v in indicators[code][year].items() if k not in {"year", "status", "scenario"}}}
            for year in (1950, 1990, 2023, 2024, 2030, 2050, 2100)
        }
        index_countries[code] = {
            "name_en": universe[code].get("name_en"),
            "name_cs": universe[code].get("name_cs"),
            "detail": "/" + relative.as_posix(),
            "snapshots": snapshots,
        }
        compatibility_years = []
        for year in COMMON_YEARS:
            summary = summaries[year]
            compatibility_years.append({
                "year": year,
                **{key: summary[key] for key in (
                    "total", "male", "female", "age_0_19", "age_20_64", "age_65_79", "age_80_plus",
                    "male_by_age", "female_by_age", "old_age_dependency_per_100_working_age",
                )},
                "shares_pct": {
                    key: round(summary[key] / summary["total"] * 100, 4)
                    for key in ("age_0_19", "age_20_64", "age_65_79", "age_80_plus")
                },
            })
        compatibility_countries[code] = {
            "coverage": "un_wpp_2024_age5_sex_1950_2100",
            "projection": "UN World Population Prospects 2024, medium variant",
            "reference_date": "1 July",
            "period": {"from": 1950, "to": 2100},
            "detail": relative.as_posix(),
            "detail_row_count": len(ages[code]),
            "age_group_count": len({row["age_start"] for row in ages[code]}),
            "years": compatibility_years,
            "source": {
                "publisher": source_contract["sources"][0]["publisher"],
                "dataset": source_contract["revision"],
                "url": source_contract["sources"][0]["url"],
                "period": "1950–2100",
            },
        }

    index = {
        "schema_version": "2.0.0",
        "contract": "country-demography-index.v2",
        "generated_at": generated_at,
        "country_count": len(index_countries),
        "period": {"from": 1950, "to": 2100, "frequency": "annual"},
        "observation_grain": "country × year × five-year age group × sex × estimate/projection status × scenario",
        "standard_age_bands": [
            {"id": name, "from": start, "to": end} for name, start, end in AGE_BANDS
        ],
        "indicator_units": {name: unit for name, (_columns, _multiplier, unit) in INDICATORS.items()},
        "sources": source_contract["sources"],
        "countries": index_countries,
    }
    index_path = Path("data/demography/index.v2.json")
    write_json(output / index_path, index)
    output_files.append(index_path.as_posix())
    compatibility = {
        "schema_version": "2.0.0",
        "contract": "country-demography.v1",
        "generated_at": generated_at,
        "coverage": {"requested_country_count": 195, "loaded_country_count": 195, "missing_country_count": 0},
        "common_period": {"from": 2025, "to": 2045, "frequency": "annual"},
        "common_age_bands": [
            {"id": "age_0_19", "from": 0, "to": 19},
            {"id": "age_20_64", "from": 20, "to": 64},
            {"id": "age_65_79", "from": 65, "to": 79},
            {"id": "age_80_plus", "from": 80, "to": None},
        ],
        "countries": compatibility_countries,
    }
    compatibility_path = Path("data/country-demography.v1.json")
    write_json(output / compatibility_path, compatibility)
    output_files.append(compatibility_path.as_posix())
    coverage = {
        "schema_version": "2.0.0",
        "contract": "country-demography-coverage.v2",
        "generated_at": generated_at,
        "country_count": 195,
        "countries_with_complete_age_structure": len(ages),
        "countries_with_complete_indicators": len(indicators),
        "period": {"from": 1950, "to": 2100},
        "source_rows": {"age_structure": age_counts, "indicators": indicator_counts},
        "source_totals": {"population_by_anchor_year": source_population_totals},
        "normalized": {
            "age_structure_rows": sum(len(value) for value in ages.values()),
            "indicator_rows": sum(len(value) for value in indicators.values()),
            "country_shards": 195,
            "population_by_anchor_year": normalized_population_totals,
            "indicator_observations": indicator_observations,
        },
        "validation": {
            "sovereign_universe": "passed",
            "annual_continuity": "passed",
            "sex_reconciliation": "passed",
            "age_total_reconciliation": "passed",
            "indicator_population_tolerance": "passed",
        },
    }
    coverage_path = Path("data/demography/coverage.v2.json")
    write_json(output / coverage_path, coverage)
    output_files.append(coverage_path.as_posix())
    return {"coverage": coverage, "files": output_files}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--age-source", type=Path, required=True)
    parser.add_argument("--indicator-source", type=Path, required=True)
    parser.add_argument("--universe", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--generated-at", required=True)
    args = parser.parse_args(argv)
    result = build(args.age_source, args.indicator_source, args.universe, args.sources, args.output, args.generated_at)
    print(json.dumps(result["coverage"], sort_keys=True))


if __name__ == "__main__":
    main()
