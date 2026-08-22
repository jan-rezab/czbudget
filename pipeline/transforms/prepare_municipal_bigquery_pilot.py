#!/usr/bin/env python3
"""Prepare reproducible municipal BigQuery data from Czech 2025 extracts."""

from __future__ import annotations

import os

import argparse
import csv
import hashlib
import io
import json
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
FINM = ROOT / "data/source_cache/2025_12_FINM.zip"
ROZV = ROOT / "data/source_cache/2025_12_ROZV.zip"
ARES = ROOT / "data/source_cache/ares_finm_entities_2025.json"
SNAPSHOT = ROOT / "website/data/municipal-snapshot.v1.json"
PARAGRAPHS = Path("/tmp/CIS_PARAGRAF.CSV")
ITEMS = Path("/tmp/CIS_POLOZKA.CSV")

FINM_URL = "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/2025_12_Data_CSUIS_FINM.zip"
ROZV_URL = "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/Rozvaha/2025_12_Data_CSUIS_ROZV.zip"
ARES_URL = "https://ares.gov.cz/swagger-ui/"
CLASSIFICATION_URL = "https://monitor.statnipokladna.gov.cz/datovy-katalog/ciselniky"

CONSOLIDATION_REVENUE_ITEMS = {"4133", "4134", "4137", "4138", "4139", "4251"}
CONSOLIDATION_EXPENDITURE_ITEMS = {"5342", "5344", "5345", "5347", "5348", "5349", "6363"}
CONSOLIDATION_ITEMS = CONSOLIDATION_REVENUE_ITEMS | CONSOLIDATION_EXPENDITURE_ITEMS
CASH_ACCOUNTS = {
    "068": "Termínované vklady dlouhodobé",
    "231": "Základní běžný účet územních samosprávných celků",
    "236": "Běžné účty fondů územních samosprávných celků",
    "241": "Běžný účet",
    "244": "Termínované vklady krátkodobé",
    "261": "Pokladna",
    "262": "Peníze na cestě",
}
STAGES = (("enacted", 10), ("revised", 11), ("actual", 12))
FINANCING_STAGES = (("enacted", 8), ("revised", 9), ("actual", 10))
BALANCE_MEASURES = (
    ("current_gross", 10, "2025-12-31"),
    ("current_correction", 11, "2025-12-31"),
    ("current_net", 12, "2025-12-31"),
    ("prior_net", 13, "2024-12-31"),
)


def decimal_value(value: str | None) -> Decimal:
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return Decimal(0)
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    result = Decimal(text)
    return -result if negative else result


def numeric_json(value: Decimal) -> str:
    return format(value, "f")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def entity_id(ico: str) -> str:
    return "prague-cz" if ico == "00064581" else f"CZ:{ico}"


def clean_name(value: str) -> str:
    prefixes = ("STATUTÁRNÍ MĚSTO ", "HLAVNÍ MĚSTO ", "MĚSTO ", "MĚSTYS ", "OBEC ")
    name = value.strip()
    upper = name.upper()
    for prefix in prefixes:
        if upper.startswith(prefix):
            return name[len(prefix):].strip()
    return name


def json_default(value):
    if isinstance(value, Decimal):
        return numeric_json(value)
    raise TypeError(type(value).__name__)


class JsonlWriter:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.handle = path.open("w", encoding="utf-8")
        self.rows = 0

    def write(self, row: dict) -> None:
        self.handle.write(json.dumps(row, ensure_ascii=False, default=json_default, separators=(",", ":")) + "\n")
        self.rows += 1

    def close(self) -> None:
        self.handle.close()


def iter_zip_csv(path: Path, member: str):
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")
        next(reader, None)
        for line_number, row in enumerate(reader, 2):
            yield line_number, row


def choose_sample(snapshot: dict, count: int) -> list[dict]:
    municipalities = snapshot["municipalities"]
    by_ico = {item["national_id"]: item for item in municipalities}
    mandatory = ["00075370", "00256358"]
    selected: list[str] = []

    def add(ico: str) -> None:
        if ico in by_ico and ico not in selected and len(selected) < count:
            selected.append(ico)

    for ico in mandatory:
        add(ico)

    regions: dict[str, list[dict]] = defaultdict(list)
    for item in municipalities:
        regions[item["territory"].get("region_name") or "Nezařazeno"].append(item)
    for items in regions.values():
        items.sort(key=lambda x: x["amounts"]["revenue_actual"], reverse=True)

    for selector in (lambda rows: 0, lambda rows: len(rows) // 2):
        for region in sorted(regions):
            rows = regions[region]
            add(rows[selector(rows)]["national_id"])

    ranked = sorted(municipalities, key=lambda x: x["amounts"]["revenue_actual"], reverse=True)
    if len(selected) < count:
        for index in range(count * 4):
            position = round(index * (len(ranked) - 1) / max(1, count * 4 - 1))
            add(ranked[position]["national_id"])
            if len(selected) == count:
                break
    return [by_ico[ico] for ico in selected]


def load_active_labels(path: Path, code_index: int, start_index: int, end_index: int, name_index: int) -> dict[str, str]:
    labels: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=";", quotechar='"')
        next(reader, None)
        for row in reader:
            if len(row) <= max(code_index, start_index, end_index, name_index):
                continue
            start = row[start_index].strip()
            end = row[end_index].strip()
            if (not start or start <= "20251231") and (not end or "20251231" <= end):
                labels[row[code_index].strip().zfill(4)] = row[name_index].strip()
    return labels


def write_reference_rows(
    output: Path,
    loaded_at: str,
    selected: list[dict],
    ares_by_ico: dict[str, dict],
    source_note: str,
) -> dict[str, int]:
    counts: dict[str, int] = {}
    entities = JsonlWriter(output / "public_entities.jsonl")
    for item in selected:
        ico = item["national_id"]
        record = ares_by_ico[ico]
        address = record.get("sidlo") or {}
        entities.write({
            "public_entity_id": entity_id(ico),
            "entity_name": clean_name(record.get("obchodniJmeno") or item["short_name"]),
            "entity_type": "capital_city_authority" if ico == "00064581" else "municipality",
            "country_code_alpha2": "CZ",
            "country_code_alpha3": "CZE",
            "national_entity_code": ico,
            "national_entity_code_type": "CZ_ICO",
            "is_eu_capital": ico == "00064581",
            "is_extra_city": False,
            "default_currency_code": "CZK",
            "eurostat_city_code": None,
            "eurostat_geography_name": None,
            "administrative_region_code": str(address.get("kodKraje")) if address.get("kodKraje") is not None else None,
            "administrative_region_name": address.get("nazevKraje"),
            "administrative_district_code": str(address.get("kodOkresu")) if address.get("kodOkresu") is not None else None,
            "administrative_district_name": address.get("nazevOkresu"),
            "national_geography_code": str(address.get("kodObce")) if address.get("kodObce") is not None else None,
            "national_geography_code_type": "CZ_MUNICIPALITY_CODE",
            "valid_from": None,
            "valid_to": None,
            "loaded_at": loaded_at,
        })
    entities.close()
    counts["public_entities"] = entities.rows

    sources = JsonlWriter(output / "public_entity_sources.jsonl")
    source_rows = [
        ("cz-monitor-finm-2025-12", "budget_detail", "Monitor MF ČR — FIN 2-12 M", FINM_URL, FINM, "FINM 051"),
        ("cz-monitor-rozv-2025-12", "balance_sheet", "Monitor MF ČR — rozvaha", ROZV_URL, ROZV, "ROZV 001"),
        ("cz-ares-2025", "entity", "ARES — identita účetních jednotek", ARES_URL, ARES, "ARES"),
        ("cz-monitor-classifications-2025", "methodology", "Monitor MF ČR — rozpočtové číselníky", CLASSIFICATION_URL, None, "CIS_PARAGRAF + CIS_POLOZKA"),
    ]
    for source_id, source_type, name, url, archive, dataset_code in source_rows:
        sources.write({
            "source_id": source_id,
            "public_entity_id": None,
            "source_type": source_type,
            "source_name": name,
            "source_url": url,
            "dataset_code": dataset_code,
            "archive_file": str(archive.relative_to(ROOT)) if archive else None,
            "archive_sha256": sha256(archive) if archive else None,
            "retrieved_at": loaded_at,
            "notes": source_note,
            "loaded_at": loaded_at,
        })
    sources.close()
    counts["public_entity_sources"] = sources.rows
    return counts


def write_classifications(output: Path, loaded_at: str) -> dict[str, int]:
    paragraph_labels = load_active_labels(PARAGRAPHS, 0, 4, 5, 6)
    item_labels = load_active_labels(ITEMS, 0, 1, 2, 6)
    versions = JsonlWriter(output / "classification_versions.jsonl")
    for classification_id, name in (
        ("CZ_RS_PARAGRAPH_2025", "České rozpočtové paragrafy 2025"),
        ("CZ_RS_ITEM_2025", "České rozpočtové položky 2025"),
    ):
        versions.write({
            "classification_id": classification_id,
            "country_code": "CZE",
            "budget_side": "mixed",
            "government_scope": "municipal",
            "valid_from_year": 2025,
            "valid_to_year": None,
            "classification_name": name,
            "legal_basis": "Rozpočtová skladba ČR",
            "source_url": CLASSIFICATION_URL,
            "notes": None,
            "loaded_at": loaded_at,
        })
    versions.close()

    nodes = JsonlWriter(output / "budget_nodes.jsonl")
    for code, name in sorted(paragraph_labels.items()):
        nodes.write({
            "budget_node_id": f"CZ:RS2025:PAR:{code}",
            "classification_id": "CZ_RS_PARAGRAPH_2025",
            "country_code": "CZE",
            "budget_side": "mixed",
            "government_scope": "municipal",
            "node_code": code,
            "node_name_native": name,
            "node_name_en": None,
            "node_name_cs": name,
            "parent_budget_node_id": None,
            "hierarchy_level": 1,
            "hierarchy_path": [],
            "is_chapter": False,
            "effective_from_year": 2025,
            "effective_to_year": None,
            "loaded_at": loaded_at,
        })
    for code, name in sorted(item_labels.items()):
        side = "revenue" if code[:1] in "1234" else ("expenditure" if code[:1] in "56" else "financing")
        nodes.write({
            "budget_node_id": f"CZ:RS2025:ITEM:{code}",
            "classification_id": "CZ_RS_ITEM_2025",
            "country_code": "CZE",
            "budget_side": side,
            "government_scope": "municipal",
            "node_code": code,
            "node_name_native": name,
            "node_name_en": None,
            "node_name_cs": name,
            "parent_budget_node_id": None,
            "hierarchy_level": 1,
            "hierarchy_path": [],
            "is_chapter": False,
            "effective_from_year": 2025,
            "effective_to_year": None,
            "loaded_at": loaded_at,
        })
    nodes.close()
    return {"classification_versions": versions.rows, "budget_nodes": nodes.rows}


def finm201_payload(row: list[str]) -> dict:
    keys = ("statement_code", "table_code", "fiscal_period", "accounting_unit_id", "ico", "region_code", "nuts_code", "budget_item_type", "paragraph_code", "item_code", "budget_approved", "budget_revised", "actual", "copied_flag")
    return dict(zip(keys, row))


def finm202_payload(row: list[str]) -> dict:
    keys = ("statement_code", "table_code", "fiscal_period", "accounting_unit_id", "ico", "region_code", "nuts_code", "financing_item_code", "budget_approved", "budget_revised", "actual", "copied_flag")
    return dict(zip(keys, row))


def rozv_payload(row: list[str]) -> dict:
    keys = ("statement_code", "table_code", "fiscal_period", "accounting_unit_id", "ico", "fund_area", "region_code", "nuts_code", "statement_line_code", "synthetic_account_code", "current_gross", "current_correction", "current_net", "prior_net")
    return dict(zip(keys, row))


def write_pilot_facts(
    output: Path,
    loaded_at: str,
    selected_icos: set[str],
    finm_run_id: str,
    rozv_run_id: str,
) -> tuple[dict[str, int], dict[str, int]]:
    raw = JsonlWriter(output / "raw_budget_lines.jsonl")
    budget = JsonlWriter(output / "municipal_budget_line_facts.jsonl")
    balance = JsonlWriter(output / "public_entity_balance_sheet_facts.jsonl")
    cash = JsonlWriter(output / "public_entity_cash_facts.jsonl")
    source_rows = Counter()

    for line_number, row in iter_zip_csv(FINM, "FINM201_2025012.csv"):
        if len(row) < 13 or row[4] not in selected_icos:
            continue
        source_rows["FINM201_2025012.csv"] += 1
        raw.write({
            "country_code": "CZE", "fiscal_year": 2025, "source_id": "cz-monitor-finm-2025-12",
            "ingestion_run_id": finm_run_id, "source_row_number": line_number,
            "source_sheet": "FINM201_2025012.csv", "source_payload": finm201_payload(row),
            "source_url": FINM_URL, "loaded_at": loaded_at,
        })
        item = row[9].strip().zfill(4)
        paragraph = row[8].strip().zfill(4)
        item_class = item[:1]
        if item_class not in "123456":
            continue
        side = "revenue" if item_class in "1234" else "expenditure"
        for stage, index in STAGES:
            amount = decimal_value(row[index])
            if not amount:
                continue
            budget.write({
                "public_entity_id": entity_id(row[4]), "fiscal_year": 2025, "fiscal_period": "2025-12",
                "reporting_scope": "standalone_accounting_unit", "budget_stage": stage, "budget_side": side,
                "source_budget_item_type_code": row[7].strip() or None,
                "functional_paragraph_code": paragraph, "economic_item_code": item,
                "functional_classification_id": "CZ_RS_PARAGRAPH_2025",
                "economic_classification_id": "CZ_RS_ITEM_2025",
                "amount_local": numeric_json(amount), "currency_code": "CZK", "amount_eur": None, "fx_date": None,
                "is_consolidation_item": item in CONSOLIDATION_ITEMS, "is_financing": False, "is_summary_row": False,
                "source_row_number": line_number, "source_sheet": "FINM201_2025012.csv",
                "source_id": "cz-monitor-finm-2025-12", "ingestion_run_id": finm_run_id,
                "coverage_type": "census", "is_imputed": False,
                "quality_flags": [], "loaded_at": loaded_at,
            })

    for line_number, row in iter_zip_csv(FINM, "FINM202_2025012.csv"):
        if len(row) < 11 or row[4] not in selected_icos:
            continue
        source_rows["FINM202_2025012.csv"] += 1
        raw.write({
            "country_code": "CZE", "fiscal_year": 2025, "source_id": "cz-monitor-finm-2025-12",
            "ingestion_run_id": finm_run_id, "source_row_number": line_number,
            "source_sheet": "FINM202_2025012.csv", "source_payload": finm202_payload(row),
            "source_url": FINM_URL, "loaded_at": loaded_at,
        })
        item = row[7].strip().zfill(4)
        summary = item == "8000"
        for stage, index in FINANCING_STAGES:
            amount = decimal_value(row[index])
            if not amount:
                continue
            budget.write({
                "public_entity_id": entity_id(row[4]), "fiscal_year": 2025, "fiscal_period": "2025-12",
                "reporting_scope": "standalone_accounting_unit", "budget_stage": stage, "budget_side": "financing",
                "source_budget_item_type_code": None, "functional_paragraph_code": None, "economic_item_code": item,
                "functional_classification_id": None, "economic_classification_id": "CZ_RS_ITEM_2025",
                "amount_local": numeric_json(amount), "currency_code": "CZK", "amount_eur": None, "fx_date": None,
                "is_consolidation_item": False, "is_financing": True, "is_summary_row": summary,
                "source_row_number": line_number, "source_sheet": "FINM202_2025012.csv",
                "source_id": "cz-monitor-finm-2025-12", "ingestion_run_id": finm_run_id,
                "coverage_type": "census", "is_imputed": False,
                "quality_flags": ["reported_financing_total"] if summary else [], "loaded_at": loaded_at,
            })

    for member in ("ROZV1_2025012.csv", "ROZV2_2025012.csv"):
        for line_number, row in iter_zip_csv(ROZV, member):
            if len(row) < 14 or row[4] not in selected_icos:
                continue
            source_rows[member] += 1
            raw.write({
                "country_code": "CZE", "fiscal_year": 2025, "source_id": "cz-monitor-rozv-2025-12",
                "ingestion_run_id": rozv_run_id, "source_row_number": line_number,
                "source_sheet": member, "source_payload": rozv_payload(row),
                "source_url": ROZV_URL, "loaded_at": loaded_at,
            })
            statement_line = row[8].strip() or "-"
            account = row[9].strip() or "-"
            for measure, index, statement_date in BALANCE_MEASURES:
                amount = decimal_value(row[index])
                if not amount:
                    continue
                balance.write({
                    "public_entity_id": entity_id(row[4]), "statement_date": statement_date,
                    "reporting_scope": "standalone_accounting_unit", "statement_line_code": statement_line,
                    "account_code": account, "account_name": CASH_ACCOUNTS.get(account), "balance_measure": measure,
                    "amount_local": numeric_json(amount), "currency_code": "CZK", "amount_eur": None, "fx_date": None,
                    "source_id": "cz-monitor-rozv-2025-12", "ingestion_run_id": rozv_run_id,
                    "source_row_number": line_number, "source_sheet": member, "quality_flags": [], "loaded_at": loaded_at,
                    "coverage_type": "census", "is_imputed": False,
                })
            if account in CASH_ACCOUNTS:
                for index, statement_date in ((12, "2025-12-31"), (13, "2024-12-31")):
                    amount = decimal_value(row[index])
                    if not amount:
                        continue
                    cash.write({
                        "public_entity_id": entity_id(row[4]), "statement_date": statement_date,
                        "reporting_scope": "standalone_accounting_unit", "cash_category_code": account,
                        "cash_category_name": CASH_ACCOUNTS[account], "amount_local": numeric_json(amount),
                        "currency_code": "CZK", "amount_eur": None, "fx_date": None,
                        "source_id": "cz-monitor-rozv-2025-12", "ingestion_run_id": rozv_run_id,
                        "source_row_number": line_number, "source_sheet": member, "quality_flags": [], "loaded_at": loaded_at,
                        "coverage_type": "census", "is_imputed": False,
                    })

    for writer in (raw, budget, balance, cash):
        writer.close()
    return {
        "raw_budget_lines": raw.rows,
        "municipal_budget_line_facts": budget.rows,
        "public_entity_balance_sheet_facts": balance.rows,
        "public_entity_cash_facts": cash.rows,
    }, dict(source_rows)


def count_national_volume(municipal_icos: set[str]) -> dict:
    source_rows: dict[str, int] = {}
    normalized = Counter()
    for archive_path in (FINM, ROZV):
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.namelist():
                count = 0
                with archive.open(member) as raw:
                    reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")
                    next(reader, None)
                    for row in reader:
                        if len(row) < 5 or row[4] not in municipal_icos:
                            continue
                        count += 1
                        if member == "FINM201_2025012.csv":
                            normalized["municipal_budget_line_facts"] += sum(bool(decimal_value(row[i])) for _, i in STAGES)
                        elif member == "FINM202_2025012.csv":
                            normalized["municipal_budget_line_facts"] += sum(bool(decimal_value(row[i])) for _, i in FINANCING_STAGES)
                        elif member.startswith("ROZV"):
                            normalized["public_entity_balance_sheet_facts"] += sum(bool(decimal_value(row[i])) for _, i, _ in BALANCE_MEASURES)
                            if row[9].strip() in CASH_ACCOUNTS:
                                normalized["public_entity_cash_facts"] += int(bool(decimal_value(row[12]))) + int(bool(decimal_value(row[13])))
                source_rows[member] = count
    return {
        "municipality_count": len(municipal_icos),
        "raw_source_rows_all_finm_and_balance_members": sum(source_rows.values()),
        "raw_source_rows_core_pilot_members": sum(source_rows[name] for name in ("FINM201_2025012.csv", "FINM202_2025012.csv", "ROZV1_2025012.csv", "ROZV2_2025012.csv")),
        "source_rows_by_member": source_rows,
        "normalized_nonzero_facts_core": dict(normalized),
        "normalized_nonzero_facts_core_total": sum(normalized.values()),
        "official_archives": {
            "finm_zip_bytes": FINM.stat().st_size,
            "finm_uncompressed_bytes": sum(item.file_size for item in zipfile.ZipFile(FINM).infolist()),
            "rozv_zip_bytes": ROZV.stat().st_size,
            "rozv_uncompressed_bytes": sum(item.file_size for item in zipfile.ZipFile(ROZV).infolist()),
        },
    }


def write_ingestion_runs(
    output: Path,
    loaded_at: str,
    source_rows: dict[str, int],
    fact_counts: dict[str, int],
    finm_run_id: str,
    rozv_run_id: str,
) -> int:
    writer = JsonlWriter(output / "ingestion_runs.jsonl")
    writer.write({
        "ingestion_run_id": finm_run_id, "source_id": "cz-monitor-finm-2025-12",
        "started_at": loaded_at, "completed_at": loaded_at, "status": "completed", "source_vintage": "2025-12",
        "source_sha256": sha256(FINM), "rows_read": source_rows.get("FINM201_2025012.csv", 0) + source_rows.get("FINM202_2025012.csv", 0),
        "rows_loaded": fact_counts["municipal_budget_line_facts"], "warning_count": 0, "error_message": None,
    })
    writer.write({
        "ingestion_run_id": rozv_run_id, "source_id": "cz-monitor-rozv-2025-12",
        "started_at": loaded_at, "completed_at": loaded_at, "status": "completed", "source_vintage": "2025-12",
        "source_sha256": sha256(ROZV), "rows_read": source_rows.get("ROZV1_2025012.csv", 0) + source_rows.get("ROZV2_2025012.csv", 0),
        "rows_loaded": fact_counts["public_entity_balance_sheet_facts"] + fact_counts["public_entity_cash_facts"],
        "warning_count": 0, "error_message": None,
    })
    writer.close()
    return writer.rows


def add_byte_projection(output: Path, volume: dict, fact_counts: dict[str, int]) -> None:
    projection = {}
    for table in ("municipal_budget_line_facts", "public_entity_balance_sheet_facts", "public_entity_cash_facts"):
        sample_rows = fact_counts[table]
        sample_bytes = (output / f"{table}.jsonl").stat().st_size
        national_rows = volume["normalized_nonzero_facts_core"].get(table, 0)
        avg = sample_bytes / sample_rows if sample_rows else 0
        projection[table] = {
            "sample_rows": sample_rows,
            "sample_jsonl_bytes": sample_bytes,
            "average_jsonl_bytes_per_row": round(avg, 1),
            "national_rows": national_rows,
            "projected_national_jsonl_bytes": round(avg * national_rows),
        }
    volume["projected_normalized_jsonl"] = projection
    volume["projected_normalized_jsonl_bytes_total"] = sum(item["projected_national_jsonl_bytes"] for item in projection.values())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--all", action="store_true", help="Prepare all Czech municipalities in the snapshot")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs/20260820-municipal-bigquery-pilot")
    args = parser.parse_args()
    if not args.all and args.count < 2:
        raise SystemExit("Sample count must be at least 2 so Plzeň and Železná Ruda are included.")
    for required in (FINM, ROZV, ARES, SNAPSHOT, PARAGRAPHS, ITEMS):
        if not required.exists():
            raise FileNotFoundError(required)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    loaded_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    ares_rows = json.loads(ARES.read_text(encoding="utf-8"))
    ares_by_ico = {row["ico"]: row for row in ares_rows}
    municipal_icos = {
        row["ico"] for row in ares_rows
        if (row.get("pravniFormaRos") or row.get("pravniForma")) == "801" or row.get("ico") == "00064581"
    }
    if args.all:
        selected = sorted(snapshot["municipalities"], key=lambda item: item["national_id"])
        finm_run_id = "cz-finm-2025-all-municipalities-v1"
        rozv_run_id = "cz-rozv-2025-all-municipalities-v1"
        source_note = f"Celostátní rozsah {len(selected):,} českých obcí za rok 2025.".replace(",", " ")
        selection_method = "All Czech municipalities in the 2025 national FINM cohort"
    else:
        selected = choose_sample(snapshot, args.count)
        finm_run_id = "cz-finm-2025-pilot30-v1"
        rozv_run_id = "cz-rozv-2025-pilot30-v1"
        source_note = f"Pilotní výběr {len(selected)} obcí; zdrojový archiv je celostátní."
        selection_method = "Plzeň + Železná Ruda, then largest and median-revenue municipalities by region, with national quantile fill"
    selected_icos = {item["national_id"] for item in selected}

    counts = write_reference_rows(args.output_dir, loaded_at, selected, ares_by_ico, source_note)
    counts.update(write_classifications(args.output_dir, loaded_at))
    fact_counts, pilot_source_rows = write_pilot_facts(
        args.output_dir, loaded_at, selected_icos, finm_run_id, rozv_run_id
    )
    counts.update(fact_counts)
    counts["ingestion_runs"] = write_ingestion_runs(
        args.output_dir, loaded_at, pilot_source_rows, fact_counts, finm_run_id, rozv_run_id
    )
    volume = count_national_volume(municipal_icos)
    add_byte_projection(args.output_dir, volume, fact_counts)

    selected_manifest = []
    for item in selected:
        ico = item["national_id"]
        selected_manifest.append({
            "public_entity_id": entity_id(ico), "ico": ico, "name": item["short_name"],
            "region": item["territory"].get("region_name"), "district": item["territory"].get("district_name"),
            "revenue_actual": item["amounts"]["revenue_actual"], "expense_actual": item["amounts"]["expense_actual"],
        })
    manifest = {
        "schema_version": "1.0.0", "generated_at": loaded_at, "fiscal_year": 2025,
        "sample_method": selection_method,
        "scope": "all_municipalities" if args.all else "pilot_sample",
        "finm_ingestion_run_id": finm_run_id,
        "rozv_ingestion_run_id": rozv_run_id,
        "sample_count": len(selected_manifest), "cities": selected_manifest,
        "pilot_source_rows": pilot_source_rows, "output_rows": counts, "national_volume": volume,
        "plzen_note": "FINM contains Statutární město Plzeň under IČO 00075370 as one accounting unit; its city districts are not separate entities in this municipality FINM cohort.",
    }
    (args.output_dir / "pilot_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output_dir": str(args.output_dir), "sample_count": len(selected), "output_rows": counts, "national_volume": volume}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
