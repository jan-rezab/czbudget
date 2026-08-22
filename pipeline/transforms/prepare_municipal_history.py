#!/usr/bin/env python3
"""Build 2010-2025 annual budget snapshots for every current Czech municipality."""

from __future__ import annotations

import csv
import io
import json
import os
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
WEB = ROOT / "website"
ANNUAL = ROOT / "data/source_cache/annual"
SNAPSHOT = WEB / "data/municipal-snapshot.v1.json"
OUTPUT = WEB / "data/municipal-history"
DIRECTORY_OUTPUT = WEB / "data/municipal-history-directory.v1.json"

YEARS = range(2010, 2026)
CASH_ACCOUNTS = {"068", "231", "236", "241", "244", "261", "262"}
CONSOLIDATED_REVENUE_ITEMS = {"4133", "4134", "4137", "4138", "4139", "4251"}
CONSOLIDATED_EXPENSE_ITEMS = {"5342", "5344", "5345", "5347", "5348", "5349", "6363"}


def number(value: str | None) -> float:
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return 0.0
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    result = float(text)
    return -result if negative else result


def normalize_ico(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    return str(int(digits or "0")).zfill(8)[-8:]


def archive_path(year: int, report: str) -> Path:
    if year == 2025:
        return ROOT / f"data/source_cache/2025_12_{report}.zip"
    return ANNUAL / f"{year}_12_{report}.zip"


def members(path: Path, prefix: str) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        return [name for name in archive.namelist() if Path(name).name.upper().startswith(prefix)]


def rows(path: Path, member: str):
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        reader = csv.reader(
            io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""),
            delimiter=";",
        )
        next(reader, None)
        yield from reader


def rounded(values: dict[str, float], key: str) -> float:
    return round(values.get(key, 0.0), 2)


def main() -> None:
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    municipalities = {item["national_id"]: item for item in snapshot["municipalities"]}
    targets = set(municipalities)
    history: dict[str, dict[int, dict[str, float | bool]]] = {
        ico: {year: defaultdict(float) for year in YEARS} for ico in targets
    }

    for year in YEARS:
        finm = archive_path(year, "FINM")
        rozv = archive_path(year, "ROZV")
        budget_members = members(finm, "FINM201")
        if not budget_members:
            raise RuntimeError(f"FINM201 was not found in {finm}")

        for row in rows(finm, budget_members[0]):
            if len(row) < 13:
                continue
            ico = normalize_ico(row[4])
            if ico not in targets:
                continue
            item = row[9].strip()
            item_class = item[:1]
            if item_class not in {"1", "2", "3", "4", "5", "6"}:
                continue
            approved, adjusted, actual = map(number, row[10:13])
            values = history[ico][year]
            values["budget_available"] = True
            if item_class in {"1", "2", "3", "4"}:
                if item in CONSOLIDATED_REVENUE_ITEMS:
                    continue
                values["revenue_approved"] += approved
                values["revenue_adjusted"] += adjusted
                values["revenue_actual"] += actual
                values[{"1": "tax_revenue", "2": "nontax_revenue", "3": "capital_revenue", "4": "transfer_revenue"}[item_class]] += actual
            else:
                if item in CONSOLIDATED_EXPENSE_ITEMS:
                    continue
                values["expense_approved"] += approved
                values["expense_adjusted"] += adjusted
                values["expense_actual"] += actual
                values["current_expense" if item_class == "5" else "capital_expense"] += actual

        if year <= 2011:
            bank_members = members(finm, "FINM204")
            if not bank_members:
                raise RuntimeError(f"FINM204 was not found in {finm}")
            for row in rows(finm, bank_members[0]):
                if len(row) < 10:
                    continue
                ico = normalize_ico(row[4])
                if ico not in targets or row[7].strip() != "6030":
                    continue
                values = history[ico][year]
                values["cash_available"] = True
                values["cash_previous"] += number(row[8])
                values["cash_current"] += number(row[9])
        else:
            balance_members = members(rozv, "ROZV")
            if not balance_members:
                raise RuntimeError(f"ROZV was not found in {rozv}")
            for member in balance_members:
                for row in rows(rozv, member):
                    if len(row) < 14:
                        continue
                    ico = normalize_ico(row[4])
                    if ico not in targets or row[9].strip() not in CASH_ACCOUNTS:
                        continue
                    values = history[ico][year]
                    values["cash_available"] = True
                    values["cash_current"] += number(row[12])
                    values["cash_previous"] += number(row[13])
        print(f"processed {year}", flush=True)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated_at = os.environ.get("CZBUDGET_GENERATED_AT") or datetime.now(timezone.utc).isoformat()
    coverage_by_year = {year: {"budget": 0, "cash": 0} for year in YEARS}
    complete_series = 0
    total_rows = 0
    directory_rows = []
    annual_summary = {
        year: defaultdict(float, {"entity_count": 0, "cash_entity_count": 0, "surplus_count": 0, "deficit_count": 0})
        for year in YEARS
    }

    for ico, entity in municipalities.items():
        series = []
        for year in YEARS:
            values = history[ico][year]
            if not values.get("budget_available"):
                continue
            revenue = rounded(values, "revenue_actual")
            expense = rounded(values, "expense_actual")
            cash_available = bool(values.get("cash_available"))
            row = {
                "year": year,
                "revenue_approved": rounded(values, "revenue_approved"),
                "revenue_adjusted": rounded(values, "revenue_adjusted"),
                "revenue_actual": revenue,
                "expense_approved": rounded(values, "expense_approved"),
                "expense_adjusted": rounded(values, "expense_adjusted"),
                "expense_actual": expense,
                "tax_revenue": rounded(values, "tax_revenue"),
                "nontax_revenue": rounded(values, "nontax_revenue"),
                "capital_revenue": rounded(values, "capital_revenue"),
                "transfer_revenue": rounded(values, "transfer_revenue"),
                "current_expense": rounded(values, "current_expense"),
                "capital_expense": rounded(values, "capital_expense"),
                "budget_balance": round(revenue - expense, 2),
                "cash_current": rounded(values, "cash_current") if cash_available else None,
                "cash_previous": rounded(values, "cash_previous") if cash_available else None,
                "source_kind": "Monitor CSV extract",
                "comparability": "historical_budget_cash_break_2012" if year <= 2011 else "consistent_2012_plus",
            }
            series.append(row)
            directory_rows.append([
                ico,
                year,
                revenue,
                expense,
                row["budget_balance"],
                row["cash_current"],
            ])
            annual = annual_summary[year]
            annual["entity_count"] += 1
            annual["revenue_actual"] += revenue
            annual["expense_actual"] += expense
            annual["budget_balance"] += row["budget_balance"]
            if cash_available:
                annual["cash_entity_count"] += 1
                annual["cash_current"] += row["cash_current"]
            if row["budget_balance"] >= 0:
                annual["surplus_count"] += 1
                annual["surplus_revenue"] += revenue
                annual["surplus_balance"] += row["budget_balance"]
            else:
                annual["deficit_count"] += 1
                annual["deficit_revenue"] += revenue
                annual["deficit_balance"] += row["budget_balance"]
            coverage_by_year[year]["budget"] += 1
            if cash_available:
                coverage_by_year[year]["cash"] += 1
        total_rows += len(series)
        if len(series) == len(YEARS):
            complete_series += 1
        payload = {
            "schema_version": "1.0.0",
            "dataset_id": "CZ_MUNICIPAL_HISTORY_2010_2025",
            "generated_at": generated_at,
            "period": {"from": 2010, "to": 2025, "years": 16},
            "definitions": {
                "budget_result": "Skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci.",
                "cash": "2010–2011: stav běžných účtů ve FIN 2-12 M; od 2012: součet účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze účetní jednotky.",
                "missing_year": "Chybějící rok znamená, že pro současné IČO nebyly ve zdrojovém FIN 2-12 M nalezeny rozpočtové řádky; nejde o nulový rozpočet.",
            },
            "municipality": {
                "entity_id": entity["entity_id"],
                "national_id": ico,
                "name": entity["short_name"],
                "currency_code": "CZK",
                "history_path": f"/data/municipal-history/{ico}.json",
            },
            "series": series,
        }
        (OUTPUT / f"{ico}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    summary = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_MUNICIPAL_HISTORY_INDEX_2010_2025",
        "generated_at": generated_at,
        "period": {"from": 2010, "to": 2025, "years": 16},
        "municipality_count": len(municipalities),
        "complete_series_count": complete_series,
        "annual_record_count": total_rows,
        "coverage_by_year": [{"year": year, **coverage_by_year[year]} for year in YEARS],
        "files": len(municipalities),
        "path_template": "/data/municipal-history/{national_id}.json",
        "sources": [
            {"label_cs": "Monitor státní pokladny — datové extrakty", "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/"},
            {"label_cs": "Monitor — historický archiv", "url": "https://monitor.statnipokladna.gov.cz/datovy-archiv/"},
        ],
    }
    (OUTPUT / "index.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    directory_payload = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_MUNICIPAL_HISTORY_DIRECTORY_2010_2025",
        "generated_at": generated_at,
        "period": {"from": 2010, "to": 2025, "years": 16},
        "currency_code": "CZK",
        "columns": ["national_id", "year", "revenue_actual", "expense_actual", "budget_balance", "cash_current"],
        "rows": directory_rows,
        "annual": [
            {
                "year": year,
                "entity_count": int(annual_summary[year]["entity_count"]),
                "cash_entity_count": int(annual_summary[year]["cash_entity_count"]),
                "surplus_count": int(annual_summary[year]["surplus_count"]),
                "deficit_count": int(annual_summary[year]["deficit_count"]),
                **{
                    key: round(annual_summary[year][key], 2)
                    for key in (
                        "revenue_actual", "expense_actual", "budget_balance", "cash_current",
                        "surplus_revenue", "surplus_balance", "deficit_revenue", "deficit_balance",
                    )
                },
            }
            for year in YEARS
        ],
        "definitions": {
            "coverage": "Řádky obsahují dnešní obecní IČO dostupná v daném ročním extraktu; chybějící obec není nulová hodnota.",
            "cash": "Součet stavu účtů pouze za obce s dostupnými řádky: 2010–2011 FIN 2-12 M, od 2012 rozvaha.",
        },
    }
    DIRECTORY_OUTPUT.write_text(
        json.dumps(directory_payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
