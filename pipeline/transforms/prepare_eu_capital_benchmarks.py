#!/usr/bin/env python3
"""Add population and tourism benchmarks to the EU-capital budget payload."""

from __future__ import annotations

import os

import argparse
import datetime as dt
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
CONFIG_PATH = ROOT / "data" / "eu_capital_benchmark_sources.json"
BUDGET_PATH = ROOT / "data" / "eu_capital_budgets_2026.json"
METRICS_PATH = ROOT / "data" / "eu_capital_city_metrics.json"
CACHE_DIR = ROOT / "data" / "source_cache" / "eu_capital_benchmarks"
PUBLIC_OUTPUTS = (
    ROOT / "website" / "data" / "eu-capital-budgets.v1.json",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def archive_source(source: dict, refresh: bool) -> tuple[Path, dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / source["archive_filename"]
    downloaded = False
    if refresh or not target.exists() or not target.stat().st_size:
        with tempfile.NamedTemporaryFile(dir=CACHE_DIR, suffix=target.suffix, delete=False) as temp:
            temp_path = Path(temp.name)
        result = subprocess.run(
            [
                "curl", "--location", "--fail", "--silent", "--show-error",
                "--retry", "2", "--connect-timeout", "20", "--max-time", "180",
                "--user-agent", "czbudget-source-archiver/1.0 (+https://czbudget.com)",
                "--output", str(temp_path), source["url"],
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not temp_path.stat().st_size:
            temp_path.unlink(missing_ok=True)
            raise RuntimeError(f"Failed to archive {source['source_id']}: {result.stderr.strip()}")
        temp_path.replace(target)
        downloaded = True
    return target, {
        "file": str(target.relative_to(ROOT)),
        "sha256": sha256(target),
        "bytes": target.stat().st_size,
        "downloaded_from": source["url"],
        "download_status": "downloaded" if downloaded else "cached",
    }


def category_position(dataset: dict, dimension: str, code: str) -> int:
    index = dataset["dimension"][dimension]["category"]["index"]
    if isinstance(index, dict):
        return index[code]
    return index.index(code)


def flat_index(dataset: dict, coordinates: dict[str, str]) -> int:
    result = 0
    for dimension, size in zip(dataset["id"], dataset["size"]):
        category = dataset["dimension"][dimension]["category"]
        if dimension in coordinates:
            position = category_position(dataset, dimension, coordinates[dimension])
        elif len(category["index"]) == 1:
            position = 0
        else:
            raise KeyError(f"Missing coordinate for {dimension}")
        result = result * size + position
    return result


def observation(dataset: dict, coordinates: dict[str, str]) -> tuple[float | None, list[str]]:
    index = flat_index(dataset, coordinates)
    value = dataset.get("value", {}).get(str(index))
    status = dataset.get("status", {}).get(str(index))
    flags = [f"eurostat_status:{flag}" for flag in str(status).split()] if status else []
    return value, flags


def ordered_codes(dataset: dict, dimension: str) -> list[str]:
    index = dataset["dimension"][dimension]["category"]["index"]
    if isinstance(index, dict):
        return [code for code, _ in sorted(index.items(), key=lambda item: item[1])]
    return list(index)


def metric_row(
    city_id: str,
    metric_code: str,
    reference_year: int,
    value: float,
    unit: str,
    geography_code: str | None,
    geography_name: str,
    geography_scope: str,
    comparability_group: str,
    source_method: str,
    source_id: str,
    quality_flags: list[str] | None = None,
) -> dict:
    return {
        "city_id": city_id,
        "metric_code": metric_code,
        "reference_year": reference_year,
        "value": value,
        "unit": unit,
        "geography_code": geography_code,
        "geography_name": geography_name,
        "geography_scope": geography_scope,
        "comparability_group": comparability_group,
        "source_method": source_method,
        "source_id": source_id,
        "quality_flags": sorted(set(quality_flags or [])),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    budget_data = json.loads(BUDGET_PATH.read_text(encoding="utf-8"))
    sources = config["sources"]
    archives = {}
    documents: dict[str, Any] = {}
    for key, source in sources.items():
        path, archive = archive_source(source, args.refresh)
        archives[source["source_id"]] = archive
        if path.suffix == ".json":
            documents[key] = json.loads(path.read_text(encoding="utf-8"))

    population_data = documents["population"]
    tourism_data = documents["tourism"]
    population_source = sources["population"]
    tourism_source = sources["tourism"]
    city_codes = config["city_codes"]
    population_labels = population_data["dimension"]["cities"]["category"]["label"]
    tourism_labels = tourism_data["dimension"]["cities"]["category"]["label"]
    population_years = ordered_codes(population_data, "time")
    current_year = int(config["as_of"][:4])
    rows = []
    city_benchmarks: dict[str, dict] = {}

    for city in budget_data["cities"]:
        city_id = city["city_id"]
        code = city_codes[city_id]
        geography_name = population_labels[code]
        population_value = None
        population_year = None
        population_flags: list[str] = []
        for year in reversed(population_years):
            value, flags = observation(
                population_data,
                {"freq": "A", "indic_ur": "DE1001V", "cities": code, "time": year},
            )
            if value is not None:
                population_value = float(value)
                population_year = int(year)
                population_flags = flags
                break
        if population_value is None or population_year is None:
            raise ValueError(f"No Eurostat population observation for {city_id}")
        if population_year < current_year - 2:
            population_flags.append("stale_source_vintage")
        population_row = metric_row(
            city_id, "population", population_year, population_value, "persons",
            code, geography_name, "eurostat_city_or_greater_city",
            "eurostat_city_statistics", "reported", population_source["source_id"], population_flags,
        )
        rows.append(population_row)

        tourism_year = int(tourism_source["reference_year"])
        tourism_total = None
        tourism_nonresident = None
        tourism_flags: list[str] = []
        tourism_geography_name = tourism_labels.get(code, geography_name)
        tourism_scope = "registered_tourist_accommodation_establishments"
        tourism_group = "eurostat_tour_occ_ninc_I551_I553"
        tourism_source_id = tourism_source["source_id"]

        if code in tourism_labels:
            tourism_total, total_flags = observation(
                tourism_data,
                {"freq": "A", "c_resid": "TOTAL", "unit": "NR", "nace_r2": "I551-I553", "cities": code, "time": str(tourism_year)},
            )
            tourism_nonresident, foreign_flags = observation(
                tourism_data,
                {"freq": "A", "c_resid": "FOR", "unit": "NR", "nace_r2": "I551-I553", "cities": code, "time": str(tourism_year)},
            )
            tourism_flags.extend(total_flags + foreign_flags)
        elif city_id == "dublin-ie":
            fallback = sources["dublin_fallback"]
            visitor = fallback["visitors"]
            nights = fallback["average_nights"]
            tourism_total = sum(visitor[key] * nights[key] for key in visitor)
            tourism_nonresident = visitor["overseas"] * nights["overseas"] + visitor["northern_ireland"] * nights["northern_ireland"]
            tourism_geography_name = fallback["geography_name"]
            tourism_scope = "all_overnight_visitors_survey_estimate"
            tourism_group = "official_local_visitor_survey"
            tourism_source_id = fallback["source_id"]
            tourism_flags.extend(["derived_from_visitors_and_average_stay", "not_directly_comparable_to_eurostat_accommodation_nights"])
        elif city_id == "london-gb":
            fallback = sources["london_fallback"]
            tourism_total = fallback["tourist_nights_total"]
            tourism_nonresident = fallback["tourist_nights_nonresident"]
            tourism_geography_name = fallback["geography_name"]
            tourism_scope = "all_domestic_and_international_visitor_nights"
            tourism_group = "official_local_visitor_survey"
            tourism_source_id = fallback["source_id"]
            tourism_flags.append("not_directly_comparable_to_eurostat_accommodation_nights")

        tourism_payload: dict[str, Any] = {
            "reference_year": tourism_year,
            "geography_code": code,
            "geography_name": tourism_geography_name,
            "geography_scope": tourism_scope,
            "comparability_group": tourism_group,
            "source_id": tourism_source_id,
        }
        if tourism_total is not None:
            total = float(tourism_total)
            total_row = metric_row(
                city_id, "tourist_nights_total", tourism_year, total, "nights", code,
                tourism_geography_name, tourism_scope, tourism_group, "reported" if city_id != "dublin-ie" else "derived",
                tourism_source_id, tourism_flags,
            )
            rows.append(total_row)
            tourism_payload["nights_total"] = total

            intensity_flags = list(tourism_flags)
            if population_year != tourism_year:
                intensity_flags.append("mixed_reference_years")
            intensity = total / population_value
            rows.append(metric_row(
                city_id, "tourist_nights_per_resident", tourism_year, intensity, "nights_per_resident", code,
                tourism_geography_name, tourism_scope, tourism_group, "derived", tourism_source_id, intensity_flags,
            ))
            tourism_payload["nights_per_resident"] = intensity
            tourism_payload["population_reference_year_for_intensity"] = population_year

        if tourism_nonresident is not None and tourism_total:
            nonresident = float(tourism_nonresident)
            rows.append(metric_row(
                city_id, "tourist_nights_nonresident", tourism_year, nonresident, "nights", code,
                tourism_geography_name, tourism_scope, tourism_group, "reported" if city_id != "dublin-ie" else "derived",
                tourism_source_id, tourism_flags,
            ))
            share = 100.0 * nonresident / float(tourism_total)
            rows.append(metric_row(
                city_id, "tourist_nights_nonresident_share_pct", tourism_year, share, "percent", code,
                tourism_geography_name, tourism_scope, tourism_group, "derived", tourism_source_id, tourism_flags,
            ))
            tourism_payload["nights_nonresident"] = nonresident
            tourism_payload["nights_nonresident_share_pct"] = share
        elif tourism_total is not None:
            tourism_payload["nights_nonresident"] = None
            tourism_payload["nights_nonresident_share_pct"] = None
            tourism_payload["quality_flags"] = ["nonresident_breakdown_unavailable"]

        city_benchmarks[city_id] = {
            "population": {
                "value": population_value,
                "unit": "persons",
                "reference_year": population_year,
                "geography_code": code,
                "geography_name": geography_name,
                "geography_scope": "eurostat_city_or_greater_city",
                "source_id": population_source["source_id"],
                "quality_flags": sorted(set(population_flags)),
            },
            "tourism": tourism_payload,
        }

    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    metrics_payload = {
        "schema_version": "1.0.0",
        "dataset_id": "EU_CAPITAL_CITY_METRICS",
        "generated_at": generated_at,
        "coverage": {
            "city_count": len(city_benchmarks),
            "population_observation_count": sum(row["metric_code"] == "population" for row in rows),
            "tourism_observation_count": sum(row["metric_code"] != "population" for row in rows),
        },
        "methodology": config["methodology"],
        "sources": [
            {**source, "source_archive": archives[source["source_id"]]}
            for source in sources.values()
        ],
        "observations": rows,
    }
    METRICS_PATH.write_text(json.dumps(metrics_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    budget_data["generated_at"] = generated_at
    budget_data["benchmark_methodology"] = config["methodology"]
    for city in budget_data["cities"]:
        city["benchmarks"] = city_benchmarks[city["city_id"]]
    BUDGET_PATH.write_text(json.dumps(budget_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for destination in PUBLIC_OUTPUTS:
        shutil.copyfile(BUDGET_PATH, destination)

    print(f"Added {len(rows)} metric observations for {len(city_benchmarks)} cities")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
