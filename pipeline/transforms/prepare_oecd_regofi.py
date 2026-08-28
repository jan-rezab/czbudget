#!/usr/bin/env python3
"""Download and normalize OECD/EU disaggregated REGOFI observations."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import shutil
import tempfile
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
WEBSITE_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = WEBSITE_ROOT / "pipeline/config/oecd_regofi_country_map.v1.json"
DEFAULT_CACHE = REPO_ROOT / "data/source_cache/international_regional/OECD/regofi_disaggregated.csv.gz"
DEFAULT_OUTPUT = REPO_ROOT / "outputs/oecd-regofi"
DATA_URL = (
    "https://sdmx.oecd.org/public/rest/data/"
    "OECD.CFE.RDG,DSD_SNGF_DISAGG@DF_REGOFI,1.0/"
    "?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_cache(path: Path, offline: bool) -> None:
    if path.exists() and path.stat().st_size:
        return
    if offline:
        raise FileNotFoundError(f"Missing offline REGOFI cache: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(DATA_URL, headers={"User-Agent": "czbudget-regional-pipeline/1.0"})
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            with temporary_path.open("wb") as raw_output:
                with gzip.GzipFile(fileobj=raw_output, mode="wb", mtime=0) as compressed:
                    shutil.copyfileobj(response, compressed, length=1024 * 1024)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def parse_codes(value: str | None) -> set[str] | None:
    if not value:
        return None
    return {item.strip().upper() for item in value.split(",") if item.strip()}


def parse_years(value: str | None) -> set[int] | None:
    if not value:
        return None
    return {int(item.strip()) for item in value.split(",") if item.strip()}


def write_json_line(handle: Any, row: dict[str, Any]) -> None:
    handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
    handle.write("\n")


def gzip_json_writer(path: Path):
    return gzip.open(path, "wt", encoding="utf-8", newline="")


def source_prefix(source_entity_code: str) -> str:
    return source_entity_code[:2]


def normalize(
    cache_path: Path,
    output_dir: Path,
    country_filter: set[str] | None,
    year_filter: set[int] | None,
) -> dict[str, Any]:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    country_map = config["countries"]
    source_id = config["source_id"]
    generated_at = utc_now()
    archive_sha256 = sha256_file(cache_path)
    ingestion_run_id = f"oecd-regofi-{archive_sha256[:20]}"

    output_dir.mkdir(parents=True, exist_ok=True)
    observation_path = output_dir / "regional_comparable_finance_observations.jsonl.gz"
    source_entity_path = output_dir / "regional_source_entities.jsonl.gz"
    coverage_path = output_dir / "regional_comparable_finance_coverage.jsonl.gz"
    run_path = output_dir / "ingestion_runs.jsonl.gz"
    source_path = output_dir / "public_entity_sources.jsonl.gz"

    entities: dict[str, dict[str, Any]] = {}
    coverage: dict[tuple[str, int, str], dict[str, Any]] = {}
    prefixes_seen: set[str] = set()
    row_count = 0
    non_null_count = 0

    with gzip.open(cache_path, "rt", encoding="utf-8-sig", newline="") as source_handle:
        reader = csv.DictReader(source_handle)
        required = {
            "REF_AREA", "Reference area", "MEASURE", "Measure", "SECTOR",
            "Institutional sector", "COFOG", "Function of government", "UNIT_MEASURE",
            "Unit of measure", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "UNIT_MULT",
            "CONF_STATUS", "DECIMALS",
        }
        missing = required.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(f"REGOFI response is missing columns: {sorted(missing)}")

        with gzip_json_writer(observation_path) as observation_handle:
            for source_row_number, row in enumerate(reader, start=2):
                source_code = row["REF_AREA"].strip()
                prefix = source_prefix(source_code)
                country = country_map.get(prefix)
                if not country:
                    raise ValueError(f"Unmapped REGOFI reference-area prefix {prefix!r} at row {source_row_number}")
                country_code = country["country_code"]
                year = int(row["TIME_PERIOD"])
                if country_filter and country_code not in country_filter:
                    continue
                if year_filter and year not in year_filter:
                    continue

                prefixes_seen.add(prefix)
                source_entity_id = f"oecd-regofi:{source_code}"
                entity = entities.setdefault(
                    source_entity_id,
                    {
                        "source_entity_id": source_entity_id,
                        "source_id": source_id,
                        "source_entity_code": source_code,
                        "entity_name": row["Reference area"].strip(),
                        "country_code": country_code,
                        "regional_tier_code": country["tier_code"],
                        "institutional_sectors": set(),
                        "institutional_sector_names": set(),
                        "years": set(),
                    },
                )
                entity["years"].add(year)
                entity["institutional_sectors"].add(row["SECTOR"].strip())
                entity["institutional_sector_names"].add(row["Institutional sector"].strip())

                value_text = row["OBS_VALUE"].strip()
                observation_value = float(value_text) if value_text else None
                if observation_value is not None:
                    non_null_count += 1
                observation = {
                    "source_entity_id": source_entity_id,
                    "country_code": country_code,
                    "fiscal_year": year,
                    "measure_code": row["MEASURE"].strip(),
                    "measure_name": row["Measure"].strip(),
                    "institutional_sector_code": row["SECTOR"].strip(),
                    "institutional_sector_name": row["Institutional sector"].strip() or None,
                    "function_code": row["COFOG"].strip(),
                    "function_name": row["Function of government"].strip() or None,
                    "unit_code": row["UNIT_MEASURE"].strip(),
                    "unit_name": row["Unit of measure"].strip() or None,
                    "observation_value": observation_value,
                    "observation_status": row["OBS_STATUS"].strip() or None,
                    "unit_multiplier_code": row["UNIT_MULT"].strip() or None,
                    "confidentiality_status": row["CONF_STATUS"].strip() or None,
                    "decimals_code": row["DECIMALS"].strip() or None,
                    "source_id": source_id,
                    "ingestion_run_id": ingestion_run_id,
                    "loaded_at": generated_at,
                }
                write_json_line(observation_handle, observation)
                row_count += 1

                coverage_key = (country_code, year, country["tier_code"])
                item = coverage.setdefault(
                    coverage_key,
                    {
                        "entities": set(),
                        "observations": 0,
                        "non_null": 0,
                        "measures": set(),
                        "functions": set(),
                        "notes": list(country.get("notes", [])),
                    },
                )
                item["entities"].add(source_entity_id)
                item["observations"] += 1
                item["non_null"] += int(observation_value is not None)
                item["measures"].add(row["MEASURE"].strip())
                item["functions"].add(row["COFOG"].strip())

    if not row_count:
        raise ValueError("REGOFI filters produced no observations")

    with gzip_json_writer(source_entity_path) as handle:
        for source_entity_id in sorted(entities):
            entity = entities[source_entity_id]
            if len(entity["institutional_sectors"]) != 1:
                raise ValueError(f"Entity {source_entity_id} spans multiple institutional sectors")
            write_json_line(
                handle,
                {
                    "source_entity_id": source_entity_id,
                    "source_id": source_id,
                    "source_entity_code": entity["source_entity_code"],
                    "entity_name": entity["entity_name"],
                    "country_code": entity["country_code"],
                    "regional_tier_code": entity["regional_tier_code"],
                    "institutional_sector_code": next(iter(entity["institutional_sectors"])),
                    "institutional_sector_name": next(iter(entity["institutional_sector_names"])),
                    "first_observation_year": min(entity["years"]),
                    "last_observation_year": max(entity["years"]),
                    "canonical_regional_government_id": None,
                    "crosswalk_status": "unmatched",
                    "source_id_namespace": "OECD territorial reference-area code",
                    "loaded_at": generated_at,
                },
            )

    with gzip_json_writer(coverage_path) as handle:
        for (country_code, year, tier_code), item in sorted(coverage.items()):
            limitations = [
                "REGOFI source coverage is measured, not assumed to be a legal census of every current regional government.",
                "Historical boundary vintages remain separate source entities until a reviewed crosswalk is available.",
                *item["notes"],
            ]
            write_json_line(
                handle,
                {
                    "coverage_id": f"{source_id}:{country_code}:{tier_code}:{year}",
                    "source_id": source_id,
                    "country_code": country_code,
                    "fiscal_year": year,
                    "regional_tier_code": tier_code,
                    "entity_source_count": len(item["entities"]),
                    "observation_count": item["observations"],
                    "non_null_observation_count": item["non_null"],
                    "measure_count": len(item["measures"]),
                    "function_count": len(item["functions"]),
                    "coverage_type": "harmonised_source_collection",
                    "validation_status": "source_count_unreviewed",
                    "limitations": limitations,
                    "assessed_at": generated_at,
                },
            )

    with gzip_json_writer(run_path) as handle:
        write_json_line(
            handle,
            {
                "ingestion_run_id": ingestion_run_id,
                "source_id": source_id,
                "started_at": generated_at,
                "completed_at": generated_at,
                "status": "success",
                "source_vintage": "2010-2022",
                "source_sha256": archive_sha256,
                "rows_read": row_count,
                "rows_loaded": row_count,
                "warning_count": sum(bool(item.get("notes")) for item in country_map.values()),
                "error_message": None,
            },
        )

    with gzip_json_writer(source_path) as handle:
        write_json_line(
            handle,
            {
                "source_id": source_id,
                "public_entity_id": None,
                "source_type": "regional_comparable_finance",
                "source_name": "OECD/EU Disaggregated Regional Government Finance (REGOFI)",
                "source_url": DATA_URL,
                "dataset_code": "DSD_SNGF_DISAGG@DF_REGOFI",
                "archive_file": str(cache_path.relative_to(REPO_ROOT)),
                "archive_sha256": archive_sha256,
                "retrieved_at": generated_at,
                "notes": "Harmonised statistical observations; canonical regional identity crosswalks are reviewed separately.",
                "loaded_at": generated_at,
            },
        )

    manifest = {
        "schema_version": "1.0.0",
        "generated_at": generated_at,
        "source_id": source_id,
        "source_url": DATA_URL,
        "archive_file": str(cache_path.relative_to(REPO_ROOT)),
        "archive_sha256": archive_sha256,
        "countries": sorted({entity["country_code"] for entity in entities.values()}),
        "source_prefixes": sorted(prefixes_seen),
        "first_year": min(year for _, year, _ in coverage),
        "last_year": max(year for _, year, _ in coverage),
        "output_rows": {
            "regional_source_entities": len(entities),
            "regional_comparable_finance_observations": row_count,
            "non_null_observations": non_null_count,
            "regional_comparable_finance_coverage": len(coverage),
            "ingestion_runs": 1,
            "public_entity_sources": 1,
        },
        "validation": {
            "status": "passed",
            "unmapped_prefixes": [],
            "canonical_crosswalk_status": "pending_review",
        },
    }
    (output_dir / "oecd_regofi_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-path", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--countries", help="Comma-separated ISO alpha-3 country filter")
    parser.add_argument("--years", help="Comma-separated fiscal-year filter")
    parser.add_argument("--offline", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    download_cache(args.cache_path, args.offline)
    manifest = normalize(
        args.cache_path,
        args.output_dir,
        parse_codes(args.countries),
        parse_years(args.years),
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
