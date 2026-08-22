#!/usr/bin/env python3
"""Prepare the 2025 snapshot of all Czech municipal accounting units."""

from __future__ import annotations

import csv
import io
import json
import os
import unicodedata
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
FINM = ROOT / "data/source_cache/2025_12_FINM.zip"
ROZV = ROOT / "data/source_cache/2025_12_ROZV.zip"
ARES = ROOT / "data/source_cache/ares_finm_entities_2025.json"
BENCHMARK = ROOT / "website/data/benchmark.v1.json"
OUTPUT = ROOT / "website/data/municipal-snapshot.v1.json"
POPULATION = ROOT / "data/source_cache/csu_municipal_population_2010_2025.csv"

CASH_ACCOUNTS = {"068", "231", "236", "241", "244", "261", "262"}
CONSOLIDATED_REVENUE_ITEMS = {"4133", "4134", "4137", "4138", "4139", "4251"}
CONSOLIDATED_EXPENSE_ITEMS = {"5342", "5344", "5345", "5347", "5348", "5349", "6363"}
MUNICIPALITY_CODE_OVERRIDES = {"04498682": 500101, "00640506": 571512, "01265741": 500071}


def number(value: str | None) -> float:
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return 0.0
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    result = float(text)
    return -result if negative else result


def rows(path: Path, member: str):
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")
        next(reader, None)
        yield from reader


def ratio(a: float, b: float) -> float | None:
    return round(a / b, 8) if b else None


def clean_name(value: str) -> str:
    prefixes = (
        "STATUTÁRNÍ MĚSTO ", "HLAVNÍ MĚSTO ", "MĚSTSKÁ ČÁST ",
        "MĚSTSKÝ OBVOD ", "MĚSTO ", "MĚSTYS ", "OBEC ",
    )
    name = value.strip()
    upper = name.upper()
    for prefix in prefixes:
        if upper.startswith(prefix):
            return name[len(prefix):].strip()
    return name


def aggregate(items: list[dict]) -> dict:
    keys = ("revenue_actual", "expense_actual", "budget_balance", "cash_current", "cash_previous")
    return {
        key: round(sum(item["amounts"][key] for item in items if item["amounts"][key] is not None), 2)
        for key in keys
    }


def best_address(record: dict) -> dict:
    """Return the most complete standardized ARES address available."""
    candidates = [record.get("sidlo") or {}]
    for source in record.get("dalsiUdaje") or []:
        for address_record in source.get("sidlo") or []:
            candidates.append(address_record.get("sidlo") or {})
    return max(
        candidates,
        key=lambda address: sum(bool(address.get(key)) for key in ("nazevKraje", "nazevOkresu", "kodObce")),
    )


def main() -> None:
    ares = json.loads(ARES.read_text(encoding="utf-8"))
    municipality_records = {
        item["ico"]: item for item in ares
        if (item.get("pravniFormaRos") or item.get("pravniForma")) == "801" or item.get("ico") == "00064581"
    }
    targets = set(municipality_records)
    budget = defaultdict(lambda: defaultdict(float))
    for row in rows(FINM, "FINM201_2025012.csv"):
        if len(row) < 13 or row[4] not in targets:
            continue
        item, item_class = row[9].strip(), row[9].strip()[:1]
        if item_class not in {"1", "2", "3", "4", "5", "6"}:
            continue
        approved, adjusted, actual = map(number, row[10:13])
        values = budget[row[4]]
        if item_class in {"1", "2", "3", "4"}:
            if item in CONSOLIDATED_REVENUE_ITEMS:
                continue
            values["revenue_approved"] += approved
            values["revenue_adjusted"] += adjusted
            values["revenue_actual"] += actual
            values[{"1":"tax_revenue", "2":"nontax_revenue", "3":"capital_revenue", "4":"transfer_revenue"}[item_class]] += actual
        else:
            if item in CONSOLIDATED_EXPENSE_ITEMS:
                continue
            values["expense_approved"] += approved
            values["expense_adjusted"] += adjusted
            values["expense_actual"] += actual
            values["current_expense" if item_class == "5" else "capital_expense"] += actual

    cash = defaultdict(lambda: defaultdict(float))
    for member in ("ROZV1_2025012.csv", "ROZV2_2025012.csv"):
        for row in rows(ROZV, member):
            if len(row) < 14 or row[4] not in targets or row[9].strip() not in CASH_ACCOUNTS:
                continue
            cash[row[4]]["cash_current"] += number(row[12])
            cash[row[4]]["cash_previous"] += number(row[13])

    benchmark = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    large_city_names = {
        entity["national_id"]: entity["short_name"] for entity in benchmark["entities"]
        if "municipality" in entity.get("administrative_levels", [])
    }
    large_city_ids = set(large_city_names)
    municipalities = []
    for ico, record in municipality_records.items():
        values = budget[ico]
        cash_available = ico in cash
        bank = cash[ico] if cash_available else {}
        revenue, expense = values["revenue_actual"], values["expense_actual"]
        balance = revenue - expense
        address = best_address(record)
        name = large_city_names.get(ico) or clean_name(record.get("obchodniJmeno") or ico)
        municipalities.append({
            "entity_id": f"CZ:{ico}",
            "country_code": "CZ",
            "currency_code": "CZK",
            "fiscal_year": 2025,
            "national_id": ico,
            "name": record.get("obchodniJmeno") or name,
            "short_name": name,
            "entity_type": "capital_city" if ico == "00064581" else ("statutory_city" if ico in large_city_ids else "municipality"),
            "administrative_levels": ["municipality", "region"] if ico == "00064581" else ["municipality"],
            "territory": {
                "region_name": address.get("nazevKraje"),
                "district_name": address.get("nazevOkresu"),
                "municipality_code": MUNICIPALITY_CODE_OVERRIDES.get(ico, address.get("kodObce")),
            },
            "amounts": {
                "revenue_approved": round(values["revenue_approved"], 2),
                "revenue_adjusted": round(values["revenue_adjusted"], 2),
                "revenue_actual": round(revenue, 2),
                "expense_approved": round(values["expense_approved"], 2),
                "expense_adjusted": round(values["expense_adjusted"], 2),
                "expense_actual": round(expense, 2),
                "tax_revenue": round(values["tax_revenue"], 2),
                "nontax_revenue": round(values["nontax_revenue"], 2),
                "capital_revenue": round(values["capital_revenue"], 2),
                "transfer_revenue": round(values["transfer_revenue"], 2),
                "current_expense": round(values["current_expense"], 2),
                "capital_expense": round(values["capital_expense"], 2),
                "budget_balance": round(balance, 2),
                "cash_current": round(bank["cash_current"], 2) if cash_available else None,
                "cash_previous": round(bank["cash_previous"], 2) if cash_available else None,
            },
            "ratios": {
                "revenue_execution": ratio(revenue, values["revenue_adjusted"]),
                "expense_execution": ratio(expense, values["expense_adjusted"]),
                "balance_to_revenue": ratio(balance, revenue),
                "cash_to_expense": ratio(bank["cash_current"], expense) if cash_available else None,
                "cash_yoy": ratio(bank["cash_current"] - bank["cash_previous"], bank["cash_previous"]) if cash_available else None,
                "capital_expense_share": ratio(values["capital_expense"], expense),
                "transfer_revenue_share": ratio(values["transfer_revenue"], revenue),
            },
            "sources": {
                "budget": f"https://monitor.statnipokladna.gov.cz/ucetni-jednotka/{ico}/rozpocet/souhrnny?obdobi=2512&rad=t",
                "entity": f"https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}",
            },
            **({"quality": {
                "cash_data_available": False,
                "flags": ["cash_balance_sheet_rows_missing"],
            }} if not cash_available else {}),
        })

    municipalities.sort(key=lambda item: (item["short_name"].casefold(), item["national_id"]))
    if not POPULATION.exists():
        raise RuntimeError(f"Missing CZSO population extract: run {ROOT / 'website/pipeline/transforms/fetch_municipal_population.py'}")
    population_2025 = {}
    with POPULATION.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if row["CasR"] == "2025" and row.get("UZ25.OBEC") and row.get("Hodnota"):
                population_2025[int(row["UZ25.OBEC"])] = int(float(row["Hodnota"].replace(" ", "").replace(",", ".")))
    for entity in municipalities:
        value = population_2025.get(entity["territory"]["municipality_code"])
        if value is None:
            raise RuntimeError(f"Missing 2025 CZSO population for {entity['national_id']} / {entity['short_name']}")
        entity["population"] = {"value": value, "reference_date": "2025-07-01", "source_id": "CZSO_DATASTAT_OBY01B01_9379W"}
    regions = [
        entity for entity in benchmark["entities"]
        if "region" in entity.get("administrative_levels", []) and entity["national_id"] != "00064581"
    ]
    municipal_summary = aggregate(municipalities)
    region_summary = aggregate(regions)
    combined_summary = {key: round(municipal_summary[key] + region_summary[key], 2) for key in municipal_summary}
    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_MUNICIPAL_SNAPSHOT_2025",
        "generated_at": os.environ.get("CZBUDGET_GENERATED_AT") or datetime.now(timezone.utc).isoformat(),
        "period": {"fiscal_year": 2025, "period_code": "2512", "as_of": "2025-12-31"},
        "scope": {
            "municipality_count": len(municipalities),
            "region_count_excluding_prague": len(regions),
            "combined_unique_entity_count": len(municipalities) + len(regions),
            "prague_deduplicated": True,
            "combined_is_consolidated": False,
            "note_cs": "Součet obcí a krajů nezapočítává Prahu podruhé, ale neeliminuje vzájemné transfery mezi ostatními účetními jednotkami.",
        },
        "definitions": {
            "budget_result": "Skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci.",
            "cash": "Součet syntetických účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze účetní jednotky; bez samostatných příspěvkových organizací.",
            "population": "Počet obyvatel k 1. 7. 2025 podle ČSÚ DataStat, ukazatel 9379W, pohlaví celkem.",
        },
        "summary": {
            "municipalities": {"entity_count": len(municipalities), **municipal_summary},
            "regions_excluding_prague": {"entity_count": len(regions), **region_summary},
            "combined_deduplicated_prague": {"entity_count": len(municipalities) + len(regions), **combined_summary},
        },
        "municipalities": municipalities,
        "sources": benchmark["source_registry"] + [{
            "source_id": "ARES_2025",
            "label_cs": "ARES — identita účetních jednotek",
            "url": "https://ares.gov.cz/swagger-ui/",
        }, {
            "source_id": "CZSO_DATASTAT_OBY01B01_9379W",
            "label_cs": "ČSÚ DataStat — počet obyvatel k 1. 7.",
            "url": "https://data.csu.gov.cz/datastat/info/SADA/OBY01B01",
        }],
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "municipalities": len(municipalities),
        "regions_excluding_prague": len(regions),
        "unique_combined_entities": len(municipalities) + len(regions),
        "municipal_revenue": municipal_summary["revenue_actual"],
        "municipal_expense": municipal_summary["expense_actual"],
        "municipal_balance": municipal_summary["budget_balance"],
        "municipal_cash": municipal_summary["cash_current"],
        "combined_revenue": combined_summary["revenue_actual"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
