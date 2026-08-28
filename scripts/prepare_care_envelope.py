#!/usr/bin/env python3
"""Split municipal care spending into the classes SHA 2011 actually distinguishes.

A municipal line called "health" mixes three different things: medical care,
long-term/personal care, and cash benefits. SHA 2011 keeps them apart — HC.3
(long-term care, health) sits inside current health expenditure, HCR.1
(long-term care, social) is reported outside it, and income transfers are not
health at all. This script applies that split to the native ledgers we hold,
and reconciles the result against each country's own published aggregate.
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BENCH = ROOT / "data" / "municipal-benchmarks"
OUT = ROOT / "data"

# Indicative SHA classes. Official mapping is the national statistical office's
# job in the Joint Health Accounts Questionnaire; this is a reading aid.
NOR_GROUPS = [
    ("medical_care",   "HC.1–HC.2, HC.6", ["241", "232", "233", "256"]),
    ("long_term_care", "HC.3 / HCR.1",    ["253", "257", "258", "234", "261"]),
    ("other_care",     "HCR.1 / social",  ["242", "243", "244", "251", "252", "283"]),
    ("cash_and_labour", "not health",     ["281", "273", "275", "276"]),
]

NLD_GROUPS = [
    ("medical_care",   "HC.6 prevention", ["7.1"]),
    ("long_term_care", "HCR.1 / HC.3",    ["6.811", "6.711", "6.712", "6.60",
                                            "6.21", "6.91", "6.791", "6.714"]),
    ("other_care",     "HCR.1 / social",  ["6.1", "6.23", "6.812", "6.751", "6.752",
                                            "6.761", "6.762", "6.92", "6.22", "6.792",
                                            "6.821", "6.822"]),
    ("cash_and_labour", "not health",     ["6.3", "6.4", "6.5"]),
]


def load(code: str) -> dict:
    return json.loads((BENCH / f"{code}.json").read_text(encoding="utf-8"))


def amounts_nor(entity: dict) -> dict[str, float]:
    return {
        b["code"].split(":")[0]: b["amount"]
        for b in entity["breakdown"]
        if b["code"].endswith(":AGD10")
    }


def amounts_nld(entity: dict) -> dict[str, float]:
    return {
        b["code"]: b["expenditure"]
        for b in entity["breakdown"]
        if b.get("expenditure")
    }


def split(entity: dict, amounts: dict[str, float], groups) -> dict:
    total = entity["latest"]["expenditure"]
    out = {"total_expenditure": total, "groups": {}}
    care = 0.0
    for key, sha, codes in groups:
        value = sum(amounts.get(c, 0.0) for c in codes)
        if key != "cash_and_labour":
            care += value
        out["groups"][key] = {
            "sha_class": sha,
            "codes": codes,
            "amount": round(value, 2),
            "pct_of_budget": round(100 * value / total, 2),
        }
    out["care_in_kind"] = {
        "amount": round(care, 2),
        "pct_of_budget": round(100 * care / total, 2),
    }
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    nor = load("nor")
    halden = nor["entities"][0]
    nor_amt = amounts_nor(halden)
    nor_split = split(halden, nor_amt, NOR_GROUPS)
    # Reconcile against the country's own published health aggregate.
    published = nor_amt.get("FGK9", 0.0)
    derived = (nor_split["groups"]["medical_care"]["amount"]
               + nor_split["groups"]["long_term_care"]["amount"])
    nor_split["reconciliation"] = {
        "published_aggregate": "FGK9 Health care, nursing and care services",
        "published_amount": round(published, 2),
        "derived_amount": round(derived, 2),
        "difference": round(derived - published, 2),
    }

    nld = load("nld")
    groningen = nld["entities"][0]
    nld_split = split(groningen, amounts_nld(groningen), NLD_GROUPS)

    doc = {
        "schema_version": "1.0.0",
        "generated_at": "2026-08-27",
        "dataset_id": "CARE_ENVELOPE_V1",
        "methodology": {
            "en": (
                "Municipal ledgers are split into medical care, long-term care, other "
                "care in kind, and cash benefits. Only the first three are care; income "
                "support and labour-market programmes are not. Comparing whole social "
                "domains without removing cash transfers overstates care spending in "
                "countries that pay benefits through the municipality."
            ),
            "cs": (
                "Obecní výkazy jsou rozděleny na zdravotní péči, dlouhodobou péči, "
                "ostatní věcnou péči a peněžité dávky. Péčí jsou jen první tři; dávky "
                "a programy trhu práce nikoli. Srovnání celých sociálních domén bez "
                "odečtení dávek nadhodnocuje výdaje na péči tam, kde dávky vyplácí obec."
            ),
        },
        "entities": {
            "NOR:3101": {"name": halden["name"], "currency": halden["currency"],
                         "year": halden["latest"]["year"], **nor_split},
            "NLD:0014": {"name": groningen["name"], "currency": groningen["currency"],
                         "year": groningen["latest"]["year"], **nld_split},
        },
    }

    cz = json.loads((ROOT / "data" / "cz-health-budget.v1.json")
                    .read_text(encoding="utf-8"))
    system = cz["system_2023"]
    total = system["total_bn"]
    doc["czech_flow_2023"] = {
        "currency": "CZK",
        "unit": "billion",
        "total": total,
        "sources": [
            {**s, "pct": round(100 * s["value_bn"] / total, 2)}
            for s in sorted(system["sources"], key=lambda x: -x["value_bn"])
        ],
        "destinations": [
            {**d, "pct": round(100 * d["value_bn"] / total, 2)}
            for d in sorted(system["destinations"], key=lambda x: -x["value_bn"])
        ],
        "note_en": (
            "Marginals only. The source-by-destination crosstab is not published, so "
            "any ribbon diagram connecting the two sides would be invented."
        ),
    }

    (OUT / "care-envelope.v1.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    for eid, e in doc["entities"].items():
        print(f"{eid}  {e['name']}  total {e['total_expenditure']/1e6:,.1f}mn")
        for k, g in e["groups"].items():
            print(f"    {k:<16} {g['pct_of_budget']:>6.2f}%   {g['sha_class']}")
        print(f"    {'CARE IN KIND':<16} {e['care_in_kind']['pct_of_budget']:>6.2f}%")
    r = doc["entities"]["NOR:3101"]["reconciliation"]
    print(f"\nreconciliation vs {r['published_aggregate']}: diff {r['difference']:,.2f}")


if __name__ == "__main__":
    main()
