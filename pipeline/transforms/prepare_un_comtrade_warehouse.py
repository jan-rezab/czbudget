#!/usr/bin/env python3
"""Normalize cached UN Comtrade responses into a BigQuery-ready NDJSON bundle."""

from __future__ import annotations

import argparse
import calendar
import contextlib
import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable


REPO = Path(__file__).resolve().parents[2]
WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", REPO.parent))
CONFIG_PATH = REPO / "pipeline/config/un_comtrade_source.v1.json"
SOURCE_URL = "https://comtrade.un.org/"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_json_gz(path: Path) -> dict[str, Any]:
    with gzip.open(path, "rt", encoding="utf-8-sig") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stable_id(*parts: Any) -> str:
    return hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()


def numeric(value: Any) -> str | None:
    if value is None or value == "":
        return None
    try:
        return format(Decimal(str(value)), "f")
    except (InvalidOperation, ValueError):
        return None


def iso_date(value: str | None) -> str | None:
    return value[:10] if value else None


def period_bounds(period: str, frequency: str) -> tuple[str, str, int, int | None]:
    if frequency == "A":
        year = int(period[:4])
        return f"{year:04d}-01-01", f"{year:04d}-12-31", year, 52
    year, month = int(period[:4]), int(period[4:6])
    last_day = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last_day:02d}", year, month


def strip_code_prefix(code: str, text: str) -> str:
    for separator in (" - ", " "):
        prefix = f"{code}{separator}"
        if text.startswith(prefix):
            return text[len(prefix):].strip()
    return text.strip()


def write_jsonl_gz(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=6) as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            count += 1
    path.chmod(0o644)
    return count


def area_rows(references: Path, loaded_at: str) -> tuple[list[dict[str, Any]], dict[int, dict[str, Any]]]:
    merged: dict[int, dict[str, Any]] = {}
    reporter_path = references / "Reporters.json"
    partner_path = references / "partnerAreas.json"
    for role, path in (("reporter", reporter_path), ("partner", partner_path)):
        for source in read_json(path).get("results", []):
            code = int(source.get("reporterCode") if role == "reporter" else source.get("PartnerCode"))
            record = merged.setdefault(code, {
                "area_code": code, "iso2": None, "iso3": None, "name": str(source.get("text") or code),
                "note": None, "is_group": False, "is_reporter": False, "is_partner": False,
                "effective_from": None, "effective_to": None, "loaded_at": loaded_at,
            })
            record["is_reporter" if role == "reporter" else "is_partner"] = True
            record["iso2"] = record["iso2"] or source.get("reporterCodeIsoAlpha2") or source.get("PartnerCodeIsoAlpha2")
            iso3 = source.get("reporterCodeIsoAlpha3") or source.get("PartnerCodeIsoAlpha3")
            record["iso3"] = record["iso3"] or (str(iso3).strip() if iso3 else None)
            record["name"] = source.get("reporterDesc") or source.get("PartnerDesc") or record["name"]
            record["note"] = source.get("reporterNote") or source.get("partnerNote") or record["note"]
            record["is_group"] = bool(record["is_group"] or source.get("isGroup"))
            record["effective_from"] = record["effective_from"] or iso_date(source.get("entryEffectiveDate"))
            record["effective_to"] = record["effective_to"] or iso_date(source.get("entryExpiredDate"))
    merged.setdefault(0, {
        "area_code": 0, "iso2": None, "iso3": "WLD", "name": "World", "note": "UN Comtrade partner total",
        "is_group": True, "is_reporter": False, "is_partner": True, "effective_from": None,
        "effective_to": None, "loaded_at": loaded_at,
    })
    return [merged[code] for code in sorted(merged)], merged


def product_rows(references: Path, loaded_at: str) -> tuple[list[dict[str, Any]], dict[tuple[str, str], dict[str, Any]]]:
    rows = []
    lookup: dict[tuple[str, str], dict[str, Any]] = {}
    for classification in ("H6", "EB", "EB10", "EB10S"):
        path = references / f"{classification}.json"
        if not path.exists():
            continue
        source_rows = read_json(path).get("results", [])
        parents = {str(row.get("parent")) for row in source_rows if row.get("parent") not in {None, "#"}}
        product_type = "C" if classification.startswith("H") else "S"
        for source in source_rows:
            code = str(source.get("id"))
            if classification.startswith("H"):
                level = int(source.get("aggrlevel", 0))
                is_leaf = str(source.get("isLeaf", "0")) == "1"
            else:
                level = 0 if source.get("parent") == "#" else code.count(".") + 1
                is_leaf = code not in parents
            row = {
                "product_type": product_type, "classification_code": classification, "product_code": code,
                "product_name": strip_code_prefix(code, str(source.get("text") or code)),
                "parent_product_code": None if source.get("parent") == "#" else source.get("parent"),
                "aggregation_level": level, "is_leaf": is_leaf,
                "standard_unit_abbr": source.get("standardUnitAbbr"),
                "source_url": f"https://comtradeapi.un.org/files/v1/app/reference/{classification}.json",
                "loaded_at": loaded_at,
            }
            rows.append(row)
            lookup[(classification, code)] = row
    return rows, lookup


def availability_lookup(connection: sqlite3.Connection) -> dict[tuple[str, str, str, int, str], sqlite3.Row]:
    connection.row_factory = sqlite3.Row
    return {
        (row["product_type"], row["frequency"], row["period"], int(row["reporter_code"]), row["classification_code"]): row
        for row in connection.execute("SELECT * FROM availability")
    }


def observation(
    source: dict[str, Any], metadata: dict[str, Any], area_lookup: dict[int, dict[str, Any]],
    product_lookup: dict[tuple[str, str], dict[str, Any]], availability: dict[tuple[str, str, str, int, str], sqlite3.Row],
    ingestion_run_id: str, loaded_at: str, response_hash: str,
) -> dict[str, Any] | None:
    primary_value = numeric(source.get("primaryValue"))
    if primary_value is None:
        return None
    product_type = str(source.get("typeCode") or metadata["product_type"])
    frequency = str(source.get("freqCode") or metadata["frequency"])
    period = str(source.get("period") or metadata["period"])
    reporter_code = int(source.get("reporterCode") or metadata["reporter_code"])
    partner_code = int(source.get("partnerCode") or 0)
    partner2_code = int(source.get("partner2Code") or 0)
    classification = str(source.get("classificationCode") or metadata["classification_code"])
    product_code = str(source.get("cmdCode") or "")
    product = product_lookup.get((classification, product_code))
    period_start, period_end, ref_year, ref_month = period_bounds(period, frequency)
    customs_code = source.get("customsCode")
    mot_code = source.get("motCode")
    natural_key = (
        product_type, frequency, period, reporter_code, source.get("flowCode"), partner_code, partner2_code,
        classification, product_code, customs_code, mot_code, source.get("qtyUnitCode"), source.get("altQtyUnitCode"),
    )
    available = availability.get((product_type, frequency, period, reporter_code, classification))
    reporter = area_lookup.get(reporter_code, {})
    partner = area_lookup.get(partner_code, {})
    partner2 = area_lookup.get(partner2_code, {})
    return {
        "trade_observation_id": stable_id(*natural_key), "period_start": period_start, "period_end": period_end,
        "period": period, "ref_year": int(source.get("refYear") or ref_year),
        "ref_month": int(source.get("refMonth")) if source.get("refMonth") is not None else ref_month,
        "frequency": frequency, "product_type": product_type,
        "reporter_area_code": reporter_code, "reporter_iso3": source.get("reporterISO") or reporter.get("iso3"),
        "reporter_name": source.get("reporterDesc") or reporter.get("name"), "flow_code": source.get("flowCode"),
        "flow_name": source.get("flowDesc") or {"M": "Import", "X": "Export"}.get(source.get("flowCode")),
        "partner_area_code": partner_code, "partner_iso3": source.get("partnerISO") or partner.get("iso3"),
        "partner_name": source.get("partnerDesc") or partner.get("name"), "partner2_area_code": partner2_code,
        "partner2_iso3": source.get("partner2ISO") or partner2.get("iso3"),
        "partner2_name": source.get("partner2Desc") or partner2.get("name"),
        "classification_code": classification, "classification_search_code": source.get("classificationSearchCode"),
        "is_original_classification": source.get("isOriginalClassification"), "product_code": product_code,
        "product_name": source.get("cmdDesc") or (product or {}).get("product_name"),
        "aggregation_level": source.get("aggrLevel") if source.get("aggrLevel") is not None else (product or {}).get("aggregation_level"),
        "is_leaf": source.get("isLeaf") if source.get("isLeaf") is not None else (product or {}).get("is_leaf"),
        "customs_code": customs_code, "customs_name": source.get("customsDesc"),
        "mode_of_transport_code": int(mot_code) if mot_code is not None else None,
        "mode_of_transport_name": source.get("motDesc"), "quantity_unit_code": source.get("qtyUnitCode"),
        "quantity_unit_abbr": source.get("qtyUnitAbbr"), "quantity": numeric(source.get("qty")),
        "quantity_is_estimated": source.get("isQtyEstimated"), "alternate_quantity_unit_code": source.get("altQtyUnitCode"),
        "alternate_quantity_unit_abbr": source.get("altQtyUnitAbbr"), "alternate_quantity": numeric(source.get("altQty")),
        "alternate_quantity_is_estimated": source.get("isAltQtyEstimated"), "net_weight_kg": numeric(source.get("netWgt")),
        "net_weight_is_estimated": source.get("isNetWgtEstimated"), "gross_weight_kg": numeric(source.get("grossWgt")),
        "gross_weight_is_estimated": source.get("isGrossWgtEstimated"), "cif_value_usd": numeric(source.get("cifvalue")),
        "fob_value_usd": numeric(source.get("fobvalue")), "primary_value_usd": primary_value,
        "legacy_estimation_flag": source.get("legacyEstimationFlag"), "is_reported": source.get("isReported"),
        "is_aggregate": source.get("isAggregate"),
        "source_dataset_code": available["dataset_code"] if available else None,
        "source_dataset_checksum": available["dataset_checksum"] if available else None,
        "source_last_released": available["last_released"] if available else None,
        "source_response_sha256": response_hash, "crawl_task_id": metadata["task_id"],
        "ingestion_run_id": ingestion_run_id, "retrieved_at": metadata["retrieved_at"], "loaded_at": loaded_at,
    }


def raw_relative_path(raw_path: str, configured_raw_path: str) -> Path:
    return Path(raw_path).relative_to(Path(configured_raw_path))


@contextlib.contextmanager
def archived_raw_fallback(config: dict[str, Any], connection: sqlite3.Connection) -> Iterable[Path | None]:
    crawl_config = config["warehouse_crawl"]
    configured_raw_path = str(crawl_config["raw_path"])
    rows = connection.execute(
        "SELECT raw_path FROM tasks WHERE status IN ('completed', 'no_data') AND raw_path IS NOT NULL"
    ).fetchall()
    missing = [
        str(row[0]) for row in rows
        if not (WORKSPACE / str(row[0])).exists()
    ]
    if not missing:
        yield None
        return
    archive = crawl_config.get("archive") or {}
    bucket_uri = str(archive.get("bucket_uri") or "").rstrip("/")
    raw_prefix = str(archive.get("raw_prefix") or "raw").strip("/")
    gcloud = shutil.which("gcloud")
    if not bucket_uri or not gcloud:
        raise RuntimeError(f"{len(missing)} raw responses are missing locally and no usable GCS archive is configured")
    for raw_path in missing:
        raw_relative_path(raw_path, configured_raw_path)
    with tempfile.TemporaryDirectory(prefix="un-comtrade-raw-") as directory:
        archive_root = Path(directory) / "raw"
        archive_root.mkdir(parents=True)
        subprocess.run(
            [gcloud, "storage", "rsync", f"{bucket_uri}/{raw_prefix}", str(archive_root),
             "--recursive", "--checksums-only", "--do-not-decompress"],
            check=True,
        )
        still_missing = [
            raw_path for raw_path in missing
            if not (archive_root / raw_relative_path(raw_path, configured_raw_path)).is_file()
        ]
        if still_missing:
            raise RuntimeError(f"GCS archive is missing {len(still_missing)} required raw responses")
        yield archive_root


def raw_payloads(
    connection: sqlite3.Connection,
    include_seed: bool,
    configured_raw_path: str,
    archive_root: Path | None = None,
) -> Iterable[tuple[Path, dict[str, Any], dict[str, Any]]]:
    connection.row_factory = sqlite3.Row
    for task in connection.execute("SELECT * FROM tasks WHERE status IN ('completed', 'no_data') AND raw_path IS NOT NULL ORDER BY task_id"):
        path = WORKSPACE / task["raw_path"]
        if not path.exists() and archive_root is not None:
            path = archive_root / raw_relative_path(str(task["raw_path"]), configured_raw_path)
        if not path.is_file():
            raise FileNotFoundError(f"Missing raw UN Comtrade response: {task['raw_path']}")
        payload = read_json_gz(path)
        metadata = {
            "task_id": task["task_id"], "product_type": task["product_type"], "frequency": task["frequency"],
            "period": task["period"], "reporter_code": task["reporter_code"],
            "classification_code": task["classification_code"],
            "retrieved_at": payload.get("_psd_task", {}).get("retrieved_at") or task["updated_at"],
        }
        yield path, payload, metadata
    if include_seed:
        for path in sorted((WORKSPACE / "data/sources/trade").glob("*/un-comtrade/annual/*/???-?.json")):
            payload = read_json(path)
            request = payload.get("_psd_request", {})
            rows = payload.get("data", [])
            if not rows:
                continue
            first = rows[0]
            metadata = {
                "task_id": f"seed-{stable_id(str(path.relative_to(WORKSPACE)))[:24]}",
                "product_type": first.get("typeCode", "C"), "frequency": first.get("freqCode", "A"),
                "period": str(first.get("period")), "reporter_code": int(first.get("reporterCode")),
                "classification_code": first.get("classificationCode", "H6"),
                "retrieved_at": request.get("retrieved_at") or datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            }
            yield path, payload, metadata


def coverage_rows(connection: sqlite3.Connection, loaded_at: str) -> Iterable[dict[str, Any]]:
    connection.row_factory = sqlite3.Row
    query = """
      SELECT
        a.*,
        COUNT(t.task_id) AS task_count,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN t.status = 'no_data' THEN 1 ELSE 0 END) AS no_data_count,
        SUM(CASE WHEN t.status = 'split' THEN 1 ELSE 0 END) AS split_count,
        SUM(CASE WHEN t.status = 'error' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN t.status IN ('queued', 'running') THEN 1 ELSE 0 END) AS pending_count,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.record_count ELSE 0 END), 0) AS loaded_rows
      FROM availability AS a
      LEFT JOIN tasks AS t
        ON t.product_type = a.product_type
       AND t.frequency = a.frequency
       AND t.period = a.period
       AND t.reporter_code = a.reporter_code
       AND t.classification_code = a.classification_code
      GROUP BY a.availability_id
      ORDER BY a.period, a.product_type, a.frequency, a.reporter_code
    """
    for row in connection.execute(query):
        if row["error_count"]:
            status = "error"
        elif row["pending_count"]:
            status = "partial" if row["completed_count"] or row["no_data_count"] or row["split_count"] else "queued"
        elif row["completed_count"]:
            status = "loaded"
        elif row["no_data_count"]:
            status = "no_data"
        else:
            status = "available"
        start, _, _, _ = period_bounds(row["period"], row["frequency"])
        yield {
            "coverage_id": row["availability_id"], "period_start": start, "period": row["period"],
            "frequency": row["frequency"], "product_type": row["product_type"],
            "reporter_area_code": row["reporter_code"], "reporter_iso3": row["reporter_iso3"],
            "classification_code": row["classification_code"], "source_dataset_code": row["dataset_code"],
            "source_dataset_checksum": row["dataset_checksum"], "source_total_records": row["total_records"],
            "source_first_released": row["first_released"], "source_last_released": row["last_released"],
            "crawl_status": status, "queued_task_count": row["task_count"],
            "completed_task_count": row["completed_count"], "no_data_task_count": row["no_data_count"],
            "split_task_count": row["split_count"], "error_task_count": row["error_count"],
            "loaded_row_count": row["loaded_rows"], "assessed_at": loaded_at, "loaded_at": loaded_at,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--include-seed", action="store_true", help="Include the existing annual HS2 World-partner crawl")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    started_at = now_iso()
    config = read_json(CONFIG_PATH)
    crawl_config = config["warehouse_crawl"]
    output = args.output or (WORKSPACE / crawl_config["output_path"])
    output.mkdir(parents=True, exist_ok=True)
    state = WORKSPACE / crawl_config["state_path"]
    connection = sqlite3.connect(state)
    connection.row_factory = sqlite3.Row
    references = WORKSPACE / "data/sources/trade/crawler/reference"
    areas, area_lookup = area_rows(references, started_at)
    products, product_lookup = product_rows(references, started_at)
    availability = availability_lookup(connection)
    ingestion_run_id = f"un-comtrade-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    counts = {
        "trade_areas": write_jsonl_gz(output / "trade_areas.jsonl.gz", areas),
        "trade_products": write_jsonl_gz(output / "trade_products.jsonl.gz", products),
        "trade_dataset_coverage": write_jsonl_gz(output / "trade_dataset_coverage.jsonl.gz", coverage_rows(connection, started_at)),
    }
    raw_response_count = 0
    observation_count = 0
    with archived_raw_fallback(config, connection) as archive_root:
        with gzip.open(output / "trade_observations.jsonl.gz", "wt", encoding="utf-8", compresslevel=6) as handle:
            for path, payload, metadata in raw_payloads(
                connection, args.include_seed, str(crawl_config["raw_path"]), archive_root
            ):
                raw_response_count += 1
                response_hash = sha256(path)
                for source in payload.get("data", []):
                    row = observation(source, metadata, area_lookup, product_lookup, availability, ingestion_run_id, started_at, response_hash)
                    if row is None:
                        continue
                    handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
                    observation_count += 1
    (output / "trade_observations.jsonl.gz").chmod(0o644)
    counts["trade_observations"] = observation_count

    completed_at = now_iso()
    run = {
        "ingestion_run_id": ingestion_run_id, "started_at": started_at, "completed_at": completed_at,
        "status": "completed", "source_id": config["source_id"], "source_vintage": "live availability + cached responses",
        "queue_database_sha256": sha256(state), "raw_response_count": raw_response_count,
        "rows_read": observation_count, "rows_loaded": observation_count, "warning_count": 0,
        "error_count": connection.execute("SELECT COUNT(*) FROM tasks WHERE status = 'error'").fetchone()[0],
        "loaded_at": completed_at,
    }
    counts["trade_ingestion_runs"] = write_jsonl_gz(output / "trade_ingestion_runs.jsonl.gz", [run])
    files = []
    for path in sorted(output.glob("*.jsonl.gz")):
        files.append({"path": path.name, "bytes": path.stat().st_size, "sha256": sha256(path), "rows": counts[path.name.removesuffix(".jsonl.gz")]})
    manifest = {
        "schema_version": "1.0.0", "dataset_id": "un-comtrade-warehouse", "generated_at": completed_at,
        "source": {"id": config["source_id"], "url": SOURCE_URL, "contract": str(CONFIG_PATH.relative_to(REPO))},
        "ingestion_run_id": ingestion_run_id, "include_seed": args.include_seed,
        "raw_response_count": raw_response_count, "files": files,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    connection.close()
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
