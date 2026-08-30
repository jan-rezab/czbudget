#!/usr/bin/env python3
"""Build annual revenue, expense, result and cash series for large Czech cities."""

from __future__ import annotations

import os

import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
ANNUAL = ROOT / "data/source_cache/annual"
BENCHMARK = ROOT / "website/data/benchmark.v1.json"
OUTPUT = ROOT / "website/data/large-city-history.v1.json"

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


def zip_path(year: int, report: str) -> Path:
    if year == 2025:
        return ROOT / f"data/source_cache/2025_12_{report}.zip"
    return ANNUAL / f"{year}_12_{report}.zip"


def members(path: Path, prefix: str) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        return [name for name in archive.namelist() if Path(name).name.upper().startswith(prefix)]


def archive_rows(path: Path, member: str):
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""), delimiter=";")
        next(reader, None)
        yield from reader


def main() -> None:
    benchmark = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    city_entities = [
        entity for entity in benchmark["entities"]
        if "municipality" in entity.get("administrative_levels", [])
    ]
    targets = {entity["national_id"] for entity in city_entities}
    series: dict[str, dict[int, dict[str, float]]] = {
        ico: {year: defaultdict(float) for year in range(2010, 2026)} for ico in targets
    }

    for year in range(2010, 2026):
        finm = zip_path(year, "FINM")
        rozv = zip_path(year, "ROZV")
        finm_members = members(finm, "FINM201")
        if not finm_members:
            raise RuntimeError(f"FINM201 was not found in {finm}")
        for row in archive_rows(finm, finm_members[0]):
            if len(row) < 13:
                continue
            ico = normalize_ico(row[4])
            if ico not in targets:
                continue
            item = row[9].strip()
            item_class = item[:1]
            actual = number(row[12])
            values = series[ico][year]
            if item_class in {"1", "2", "3", "4"} and item not in CONSOLIDATED_REVENUE_ITEMS:
                values["revenue_actual"] += actual
            elif item_class in {"5", "6"} and item not in CONSOLIDATED_EXPENSE_ITEMS:
                values["expense_actual"] += actual

        if year <= 2011:
            bank_members = members(finm, "FINM204")
            if not bank_members:
                raise RuntimeError(f"FINM204 was not found in {finm}")
            for row in archive_rows(finm, bank_members[0]):
                if len(row) < 10:
                    continue
                ico = normalize_ico(row[4])
                if ico not in targets or row[7].strip() != "6030":
                    continue
                series[ico][year]["cash_previous"] += number(row[8])
                series[ico][year]["cash_current"] += number(row[9])

        for member in members(rozv, "ROZV"):
            for row in archive_rows(rozv, member):
                if len(row) < 14:
                    continue
                ico = normalize_ico(row[4])
                if ico not in targets or row[9].strip() not in CASH_ACCOUNTS:
                    continue
                values = series[ico][year]
                values["cash_current"] += number(row[12])
                values["cash_previous"] += number(row[13])
        print(f"processed {year}", flush=True)

    cities = []
    for entity in sorted(city_entities, key=lambda item: item["short_name"].casefold()):
        ico = entity["national_id"]
        annual = []
        for year in range(2010, 2026):
            values = series[ico][year]
            revenue = round(values["revenue_actual"], 2)
            expense = round(values["expense_actual"], 2)
            annual.append({
                "year": year,
                "revenue_actual": revenue,
                "expense_actual": expense,
                "budget_balance": round(revenue - expense, 2),
                "cash_current": round(values["cash_current"], 2),
                "cash_previous": round(values["cash_previous"], 2),
                "source_kind": "Monitor CSV extract",
                "comparability": "historical_budget_cash_break_2012" if year <= 2011 else "consistent_2012_plus",
            })
        cities.append({
            "entity_id": entity["entity_id"],
            "national_id": ico,
            "name": entity["short_name"],
            "country_code": "CZE",
            "currency_code": "CZK",
            "series": annual,
        })

    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_LARGE_CITY_HISTORY_2010_2025",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {"from": 2010, "to": 2025, "years": 16},
        "coverage": {"city_count": len(cities), "nominal_czk": True},
        "definitions": {
            "budget_result": "Skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci.",
            "cash": "Součet syntetických účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze účetní jednotky; bez samostatných příspěvkových organizací.",
            "comparability": "Rozpočtový výsledek je srovnatelný v celé řadě. Hotovost 2010–2011 je stav běžných účtů z FIN 2-12M; od 2012 jde o širší součet vymezených účtů z rozvahy.",
        },
        "cities": cities,
        "sources": [
            {"label_cs": "Monitor státní pokladny — datové extrakty", "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/"},
            {"label_cs": "Monitor — historický archiv", "url": "https://monitor.statnipokladna.gov.cz/datovy-archiv/"},
        ],
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False))


if __name__ == "__main__":
    main()
