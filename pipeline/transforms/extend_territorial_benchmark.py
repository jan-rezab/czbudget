#!/usr/bin/env python3
"""Extend the web benchmark with Prague and all Czech regions from MF extracts."""

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
DATASET = ROOT / "website/data/benchmark.v1.json"
FINM_ZIP = ROOT / "data/source_cache/2025_12_FINM.zip"
BALANCE_ZIP = ROOT / "data/source_cache/2025_12_ROZV.zip"
SUMMARY_DIR = ROOT / "data/source_cache/summaries_2025"

REGIONS = [
    ("00064581", "Hlavní město Praha", "Praha"),
    ("70891095", "Středočeský kraj", "Středočeský kraj"),
    ("70890650", "Jihočeský kraj", "Jihočeský kraj"),
    ("70890366", "Plzeňský kraj", "Plzeňský kraj"),
    ("70891168", "Karlovarský kraj", "Karlovarský kraj"),
    ("70892156", "Ústecký kraj", "Ústecký kraj"),
    ("70891508", "Liberecký kraj", "Liberecký kraj"),
    ("70889546", "Královéhradecký kraj", "Královéhradecký kraj"),
    ("70892822", "Pardubický kraj", "Pardubický kraj"),
    ("70890749", "Kraj Vysočina", "Kraj Vysočina"),
    ("70888337", "Jihomoravský kraj", "Jihomoravský kraj"),
    ("60609460", "Olomoucký kraj", "Olomoucký kraj"),
    ("70891320", "Zlínský kraj", "Zlínský kraj"),
    ("70890692", "Moravskoslezský kraj", "Moravskoslezský kraj"),
]

CASH_ACCOUNTS = {"068", "231", "236", "241", "244", "261", "262"}


def parse_number(value: str | None) -> float:
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return 0.0
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    result = float(text)
    return -result if negative else result


def zip_rows(path: Path, member: str):
    with zipfile.ZipFile(path) as archive:
        with archive.open(member) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            yield from csv.reader(text, delimiter=";", quotechar='"')


def ratio(numerator: float, denominator: float) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def extract_budget(targets: set[str]):
    budget = defaultdict(lambda: {
        "revenue_approved": 0.0,
        "revenue_adjusted": 0.0,
        "revenue_actual": 0.0,
        "expense_approved": 0.0,
        "expense_adjusted": 0.0,
        "expense_actual": 0.0,
        "tax_revenue": 0.0,
        "nontax_revenue": 0.0,
        "capital_revenue": 0.0,
        "transfer_revenue": 0.0,
        "current_expense": 0.0,
        "capital_expense": 0.0,
    })
    rows = zip_rows(FINM_ZIP, "FINM201_2025012.csv")
    next(rows, None)
    for row in rows:
        if len(row) < 13 or row[4] not in targets:
            continue
        item_class = row[9].strip()[:1]
        if item_class not in {"1", "2", "3", "4", "5", "6"}:
            continue
        approved, adjusted, actual = map(parse_number, row[10:13])
        target = budget[row[4]]
        if item_class in {"1", "2", "3", "4"}:
            target["revenue_approved"] += approved
            target["revenue_adjusted"] += adjusted
            target["revenue_actual"] += actual
            target[{
                "1": "tax_revenue",
                "2": "nontax_revenue",
                "3": "capital_revenue",
                "4": "transfer_revenue",
            }[item_class]] += actual
        else:
            target["expense_approved"] += approved
            target["expense_adjusted"] += adjusted
            target["expense_actual"] += actual
            target["current_expense" if item_class == "5" else "capital_expense"] += actual

    financing = {}
    rows = zip_rows(FINM_ZIP, "FINM202_2025012.csv")
    next(rows, None)
    for row in rows:
        if len(row) >= 11 and row[4] in targets and row[7].strip() == "8000":
            financing[row[4]] = {
                "financing_approved": parse_number(row[8]),
                "financing_adjusted": parse_number(row[9]),
                "financing_actual": parse_number(row[10]),
            }
    return budget, financing


def load_summary_budget(targets: set[str]):
    budget = {}
    for ico in targets:
        summary = json.loads((SUMMARY_DIR / f"{ico}.json").read_text(encoding="utf-8"))
        groups = {group["name"]: group for group in summary.get("children", [])}
        revenue = groups.get("Revenues", {})
        expense = groups.get("Expenditures", {})
        categories = {}
        for group in (revenue, expense):
            for child in group.get("children", []):
                categories[str(child.get("code"))] = child.get("budget", {})
        revenue_total = revenue.get("budget", {})
        expense_total = expense.get("budget", {})
        budget[ico] = {
            "revenue_approved": revenue_total.get("approved", 0.0),
            "revenue_adjusted": revenue_total.get("afterChanges", 0.0),
            "revenue_actual": revenue_total.get("reality", 0.0),
            "expense_approved": expense_total.get("approved", 0.0),
            "expense_adjusted": expense_total.get("afterChanges", 0.0),
            "expense_actual": expense_total.get("reality", 0.0),
            "tax_revenue": categories.get("1", {}).get("reality", 0.0),
            "nontax_revenue": categories.get("2", {}).get("reality", 0.0),
            "capital_revenue": categories.get("3", {}).get("reality", 0.0),
            "transfer_revenue": categories.get("4", {}).get("reality", 0.0),
            "current_expense": categories.get("5", {}).get("reality", 0.0),
            "capital_expense": categories.get("6", {}).get("reality", 0.0),
        }
    return budget


def extract_financing(targets: set[str]):
    financing = {}
    rows = zip_rows(FINM_ZIP, "FINM202_2025012.csv")
    next(rows, None)
    for row in rows:
        if len(row) >= 11 and row[4] in targets and row[7].strip() == "8000":
            financing[row[4]] = {
                "financing_approved": parse_number(row[8]),
                "financing_adjusted": parse_number(row[9]),
                "financing_actual": parse_number(row[10]),
            }
    return financing


def extract_cash(targets: set[str]):
    cash = defaultdict(lambda: {"cash_current": 0.0, "cash_previous": 0.0})
    for member in ("ROZV1_2025012.csv", "ROZV2_2025012.csv"):
        rows = zip_rows(BALANCE_ZIP, member)
        next(rows, None)
        for row in rows:
            if len(row) < 14 or row[4] not in targets or row[9].strip() not in CASH_ACCOUNTS:
                continue
            cash[row[4]]["cash_current"] += parse_number(row[12])
            cash[row[4]]["cash_previous"] += parse_number(row[13])
    return cash


def make_entity(ico: str, name: str, short_name: str, values: dict, levels: list[str], entity_type: str):
    revenue = values["revenue_actual"]
    expense = values["expense_actual"]
    cash = values["cash_current"]
    balance = revenue - expense
    return {
        "entity_id": f"CZ:{ico}",
        "country_code": "CZE",
        "national_id": ico,
        "name": name,
        "short_name": short_name,
        "administrative_levels": levels,
        "entity_type": entity_type,
        "fiscal_year": 2025,
        "currency_code": "CZK",
        "risk": {"rank": None, "grade": None, "score": None},
        "amounts": {
            "revenue_approved": values["revenue_approved"],
            "revenue_adjusted": values["revenue_adjusted"],
            "revenue_actual": revenue,
            "expense_approved": values["expense_approved"],
            "expense_adjusted": values["expense_adjusted"],
            "expense_actual": expense,
            "financing_actual": values["financing_actual"],
            "cash_current": cash,
            "cash_previous": values["cash_previous"],
            "tax_revenue": values["tax_revenue"],
            "nontax_revenue": values["nontax_revenue"],
            "capital_revenue": values["capital_revenue"],
            "transfer_revenue": values["transfer_revenue"],
            "current_expense": values["current_expense"],
            "capital_expense": values["capital_expense"],
            "budget_balance": balance,
        },
        "ratios": {
            "revenue_execution": ratio(revenue, values["revenue_adjusted"]),
            "expense_execution": ratio(expense, values["expense_adjusted"]),
            "cash_to_expense": ratio(cash, expense),
            "capital_expense_share": ratio(values["capital_expense"], expense),
            "transfer_revenue_share": ratio(values["transfer_revenue"], revenue),
            "tax_revenue_share": ratio(values["tax_revenue"], revenue),
            "balance_to_revenue": ratio(balance, revenue),
            "cash_yoy": ratio(cash - values["cash_previous"], values["cash_previous"]),
        },
        "sources": {
            "budget": f"https://monitor.statnipokladna.gov.cz/ucetni-jednotka/{ico}/rozpocet/souhrnny?obdobi=2512&rad=t",
            "entity": f"https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}",
        },
    }


def main():
    source = json.loads(DATASET.read_text(encoding="utf-8"))
    targets = {ico for ico, _, _ in REGIONS}
    budget = load_summary_budget(targets)
    financing = extract_financing(targets)
    cash = extract_cash(targets)

    new_entities = {}
    for ico, name, short_name in REGIONS:
        values = {**budget[ico], **financing.get(ico, {}), **cash[ico]}
        values.setdefault("financing_actual", 0.0)
        levels = ["municipality", "region"] if ico == "00064581" else ["region"]
        entity_type = "capital_city" if ico == "00064581" else "region"
        entity = make_entity(ico, name, short_name, values, levels, entity_type)
        delta = entity["amounts"]["revenue_actual"] - entity["amounts"]["expense_actual"] + entity["amounts"]["financing_actual"]
        if abs(delta) > 1:
            raise ValueError(f"Budget identity failed for {name}: {delta}")
        new_entities[entity["entity_id"]] = entity

    municipal_entities = []
    source_municipalities = source.get("municipalities")
    if source_municipalities is None:
        source_municipalities = [
            entity for entity in source.get("entities", [])
            if "municipality" in entity.get("administrative_levels", [])
            and entity.get("national_id") != "00064581"
        ]
    for city in source_municipalities:
        entity = dict(city)
        entity_id = entity.get("entity_id") or entity.get("municipality_id")
        entity["entity_id"] = entity_id
        entity.pop("municipality_id", None)
        entity["administrative_levels"] = ["municipality"]
        entity["entity_type"] = entity.pop("municipality_type", "statutory_city")
        municipal_entities.append(entity)

    all_entities = municipal_entities + list(new_entities.values())
    municipality_ids = [entity["entity_id"] for entity in municipal_entities] + ["CZ:00064581"]
    region_ids = [f"CZ:{ico}" for ico, _, _ in REGIONS]

    source["schema_version"] = "2.0.0"
    source["generated_at"] = datetime.now(timezone.utc).isoformat()
    source["scope"] = "Samostatné účetní jednotky statutárních měst a krajů; bez příspěvkových organizací a bez samostatných městských částí/obvodů."
    source["entity_levels"] = [
        {"level_code": "municipality", "label_cs": "Statutární města", "entity_count": len(municipality_ids)},
        {"level_code": "region", "label_cs": "Kraje", "entity_count": len(region_ids)},
    ]
    source["cohorts"] = [
        {
            "cohort_id": "CZ_STATUTORY_2025",
            "country_code": "CZE",
            "fiscal_year": 2025,
            "level_code": "municipality",
            "label_cs": "Statutární města ČR včetně Prahy",
            "entity_count": len(municipality_ids),
            "entity_ids": municipality_ids,
        },
        {
            "cohort_id": "CZ_REGIONS_2025",
            "country_code": "CZE",
            "fiscal_year": 2025,
            "level_code": "region",
            "label_cs": "Kraje ČR včetně hlavního města Prahy",
            "entity_count": len(region_ids),
            "entity_ids": region_ids,
        },
    ]
    source["entities"] = all_entities
    source.pop("municipalities", None)
    source["source_registry"] = [
        {
            "source_id": "MF_FINM_2025_12",
            "label_cs": "FIN 2-12M",
            "url": "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/2025_12_Data_CSUIS_FINM.zip",
            "sha256": "3d48d2ea5e273273301b4c28888c03c4c3ae694c0620480d51ac8524a4f9b123",
        },
        {
            "source_id": "MF_ROZV_2025_12",
            "label_cs": "Rozvaha",
            "url": "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/Rozvaha/2025_12_Data_CSUIS_ROZV.zip",
            "sha256": "80658386aff7e4254b5c5c3ba993a3fb409e29b1258f00a592e7aac94f3aa844",
        },
    ]
    DATASET.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "schema_version": source["schema_version"],
        "entities": len(all_entities),
        "municipalities": len(municipality_ids),
        "regions": len(region_ids),
        "output": str(DATASET),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
