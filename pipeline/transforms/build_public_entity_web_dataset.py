#!/usr/bin/env python3
"""Build the compact 2024 web registry of Czech publicly controlled entities."""

from __future__ import annotations

import os

import json
from collections import Counter
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
INVENTORY_PATH = ROOT / "data" / "public_entity_revenues_2006_2025.json"
STRATEGIC_PATH = ROOT / "website" / "data" / "cz-state-enterprises-2024.json"
OUTPUT_PATH = ROOT / "website" / "data" / "cz-public-entities-2024.json"
HISTORY_OUTPUT_PATH = ROOT / "website" / "data" / "cz-public-entity-history.v1.json"


def mczk(value: float | None) -> float | None:
    return None if value is None else round(value / 1_000_000, 3)


def main() -> None:
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    strategic = json.loads(STRATEGIC_PATH.read_text(encoding="utf-8"))
    master = {row["ico"]: row for row in inventory["entities"]}
    rows_2024 = {row["ico"]: row for row in inventory["annual"] if row["year"] == 2024}
    strategic_by_ico = {row["ico"]: row for row in strategic["entities"]}

    entities = []
    for ico in sorted(set(rows_2024) | set(strategic_by_ico)):
        public = rows_2024.get(ico)
        strategic_row = strategic_by_ico.get(ico)
        historic = master.get(ico, {})
        if public:
            revenue = mczk(public.get("revenue"))
            cost = mczk(public.get("cost"))
            net_result = None if revenue is None or cost is None else round(revenue - cost, 3)
            entity = {
                "ico": ico,
                "name": public["name"],
                "category": public["category"],
                "owner_level": public["owner_level"],
                "legal_form": public["legal_form"],
                "first_year": historic.get("first_year"),
                "last_year": historic.get("last_year"),
                "revenue_mczk": revenue,
                "cost_mczk": cost,
                "net_result_mczk": net_result,
                "assets_mczk": None,
                "financial_source_kind": "ČSÚIS VZZ" if revenue is not None else None,
            }
        else:
            entity = {
                "ico": ico,
                "name": strategic_row["name"],
                "category": "Firma",
                "owner_level": "Stát",
                "legal_form": "Strategický subjekt státu",
                "first_year": 2024,
                "last_year": 2024,
                "revenue_mczk": None,
                "cost_mczk": None,
                "net_result_mczk": None,
                "assets_mczk": None,
                "financial_source_kind": None,
            }

        if strategic_row:
            metrics = strategic_row["metrics"]
            entity.update({
                "name": strategic_row["name"],
                "category": "Firma",
                "revenue_mczk": metrics["turnover"],
                "cost_mczk": None,
                "net_result_mczk": metrics["net_result"],
                "assets_mczk": metrics["total_assets"],
                "financial_source_kind": "MF strategické subjekty",
                "strategic_highlight": True,
                "classification": strategic_row["classification"],
                "fair_metrics": strategic_row["fair_metrics"],
            })
        else:
            entity["strategic_highlight"] = False
        entity["top_line"] = {
            "value_mczk": entity["revenue_mczk"],
            "definition": "obrat" if strategic_row else ("výnosy" if entity["revenue_mczk"] is not None else None),
            "net_result_mczk": entity["net_result_mczk"],
            "net_margin_pct": (
                None
                if entity["revenue_mczk"] in {None, 0} or entity["net_result_mczk"] is None
                else round(entity["net_result_mczk"] / entity["revenue_mczk"] * 100, 3)
            ),
            "year": 2024,
            "scope": "individual_entity",
        }
        entities.append(entity)

    documented = [row for row in entities if row["net_result_mczk"] is not None]
    with_revenue = [row for row in entities if row["revenue_mczk"] is not None]
    positive = sum(row["net_result_mczk"] for row in documented if row["net_result_mczk"] > 0)
    negative = sum(row["net_result_mczk"] for row in documented if row["net_result_mczk"] < 0)
    category_counts = Counter(row["category"] for row in entities)
    owner_counts = Counter(row["owner_level"] for row in entities)

    def group_summary(rows: list[dict]) -> dict:
        financial = [row for row in rows if row["net_result_mczk"] is not None]
        revenue_rows = [row for row in rows if row["revenue_mczk"] is not None]
        group_positive = sum(row["net_result_mczk"] for row in financial if row["net_result_mczk"] > 0)
        group_negative = sum(row["net_result_mczk"] for row in financial if row["net_result_mczk"] < 0)
        return {
            "entity_count": len(rows),
            "financial_result_count": len(financial),
            "revenue_count": len(revenue_rows),
            "positive_net_result_sum_mczk": round(group_positive, 3),
            "negative_net_result_absolute_sum_mczk": round(abs(group_negative), 3),
            "net_result_sum_mczk": round(group_positive + group_negative, 3),
            "revenue_sum_mczk": round(sum(row["revenue_mczk"] for row in revenue_rows), 3),
        }

    groups = {"all": group_summary(entities)}
    for category in ("Firma", "Vysoká škola", "Nemocnice", "Zdravotní pojišťovna"):
        groups[category] = group_summary([row for row in entities if row["category"] == category])

    payload = {
        "schema_version": "1.1.0",
        "country_code": "CZE",
        "year": 2024,
        "currency_code": "CZK",
        "units": "mil. Kč",
        "scope": "Vybrané kategorie veřejných subjektů evidované pro rok 2024: veřejně ovládané firmy, veřejné vysoké školy, nemocnice a zdravotní pojišťovny. Přímé rozpočty obcí a krajů nejsou subjekty této tabulky.",
        "coverage_note": "Účetní součty zahrnují pouze subjekty s doloženými částkami v otevřeném VZZ nebo ve zprávě MF o strategických subjektech. Zdravotní pojišťovny používají speciální výkazy; jejich pojistné a úhrady nejsou zaměňovány za firemní obrat a náklady.",
        "summary": {
            "entity_count": len(entities),
            "strategic_highlight_count": len(strategic_by_ico),
            "financial_result_count": len(documented),
            "revenue_count": len(with_revenue),
            "positive_net_result_sum_mczk": round(positive, 3),
            "negative_net_result_sum_mczk": round(negative, 3),
            "negative_net_result_absolute_sum_mczk": round(abs(negative), 3),
            "net_result_sum_mczk": round(positive + negative, 3),
            "revenue_sum_mczk": round(sum(row["revenue_mczk"] for row in with_revenue), 3),
            "category_counts": dict(sorted(category_counts.items())),
            "owner_counts": dict(sorted(owner_counts.items())),
            "groups": groups,
        },
        "entities": sorted(entities, key=lambda row: (row["category"], row["name"].casefold())),
        "sources": inventory["sources"] + strategic["sources"],
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    financial_series: dict[str, list[dict]] = {}
    for row in inventory["annual"]:
        if row.get("revenue") is None and row.get("cost") is None:
            continue
        revenue = mczk(row.get("revenue"))
        cost = mczk(row.get("cost"))
        financial_series.setdefault(row["ico"], []).append({
            "year": row["year"],
            "revenue_mczk": revenue,
            "cost_mczk": cost,
            "net_result_mczk": None if revenue is None or cost is None else round(revenue - cost, 3),
            "financial_status": row.get("financial_status"),
            "source_financial": row.get("source_financial"),
        })

    history_entities = []
    for ico, series in sorted(financial_series.items()):
        master_row = master.get(ico, {})
        series.sort(key=lambda row: row["year"])
        history_entities.append({
            "ico": ico,
            "name": master_row.get("name") or series[-1].get("name") or ico,
            "category": master_row.get("category"),
            "owner_level": master_row.get("owner_level"),
            "first_financial_year": series[0]["year"],
            "last_financial_year": series[-1]["year"],
            "series": series,
        })

    history_payload = {
        "schema_version": "1.0.0",
        "country_code": "CZE",
        "period": inventory["metadata"]["period"],
        "currency_code": "CZK",
        "units": "mil. Kč",
        "prepared_on": inventory["metadata"]["prepared_on"],
        "scope": inventory["metadata"]["scope"],
        "status": inventory["metadata"]["status"],
        "interpretation": inventory["metadata"]["interpretation"],
        "summary": {
            "entity_count": len(inventory["entities"]),
            "entities_with_financial_series": len(history_entities),
            "financial_rows": sum(len(row["series"]) for row in history_entities),
            "first_year": min(row["year"] for row in inventory["annual"]),
            "last_year": max(row["year"] for row in inventory["annual"]),
        },
        "coverage": inventory["coverage"],
        "entities": history_entities,
        "sources": inventory["sources"],
    }
    HISTORY_OUTPUT_PATH.write_text(json.dumps(history_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
