#!/usr/bin/env python3
"""Load the OFGL commune aggregates that France's published headline actually comes from.

France has 10.4 million DGFiP balance facts in the warehouse and its profiles are published,
but the two never agreed: summing the balance accounts for FR:01001 gives revenue 995,320.87
and expenditure 2,366,440.01 against a published 914,157.60 and 2,285,276.74. Both sides
differed by exactly 81,163.27, which looks like the signature of *opérations d'ordre* — and is
not. No subset of that commune's accounts summed to it, because the published figures are not a
balance sum at all. They are OFGL's own aggregates:

    Recettes totales   914,157.60
    Dépenses totales 2,285,276.74

OFGL — the Observatoire des Finances et de la Gestion publique Locales — publishes six
aggregates per commune per year, for all 34,875 communes. Loading them alongside the balances
lets France's headline be a lookup rather than a reconstruction, and keeps the balance detail
exactly as it is.

The aggregates are stored as summary rows. They are totals of the balance facts beside them,
computed by the publisher on its own definition, so a consumer summing line items must not add
them in.

Writes NDJSON only; `bq load` is a separate explicit step.

    python3 scripts/load-municipal-facts-fra-ofgl.py --report
    python3 scripts/load-municipal-facts-fra-ofgl.py --write out.ndjson
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
SOURCE = WEB.parent / "data/source_cache/international_municipal/FRA/ofgl-base-communes-2024-2025.csv"

SOURCE_ID = "fr-ofgl-base-communes"
CURRENCY = "EUR"
REPORTING_SCOPE = "municipal_general_budget"
COVERAGE_TYPE = "headline_aggregate"

# What each aggregate is, and whether it belongs on a budget side at all. Debt is a stock and
# gross saving is a derived balance; neither is a flow in or out, so neither is given a side.
AGGREGATES = {
    "Recettes totales": ("revenue", "OFGL.RecettesTotales", False),
    "Dépenses totales": ("expenditure", "OFGL.DepensesTotales", False),
    "Recettes de fonctionnement": ("revenue", "OFGL.RecettesFonctionnement", False),
    "Dépenses de fonctionnement": ("expenditure", "OFGL.DepensesFonctionnement", False),
    # Kept, marked, and given no side: a stock and a derived result are not budget flows.
    "Encours de dette": (None, "OFGL.EncoursDette", True),
    "Epargne brute": (None, "OFGL.EpargneBrute", True),
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write NDJSON to this path")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--run-id", default=f"fr-ofgl-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}")
    args = parser.parse_args()

    if not SOURCE.exists():
        print(f"Missing {SOURCE}")
        return 1

    loaded_at = datetime.now(timezone.utc).isoformat()
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    written = 0
    entities: set[str] = set()
    per_aggregate = Counter()
    skipped = Counter()
    headline: dict[tuple[str, str], dict[str, float]] = {}

    with SOURCE.open(encoding="utf-8-sig") as source:
        for row in csv.DictReader(source, delimiter=";"):
            code = (row.get("com_code") or "").strip()
            year = (row.get("exer") or "").strip()
            label = (row.get("agregat") or "").strip()
            raw = (row.get("montant") or "").strip()
            if not code or not year or label not in AGGREGATES:
                skipped["unmapped_or_incomplete"] += 1
                continue
            try:
                amount = float(raw)
            except ValueError:
                skipped["non_numeric"] += 1
                continue

            side, item_code, side_less = AGGREGATES[label]
            if side_less:
                # Stored for completeness, but a stock and a derived balance are not flows and
                # the schema requires a side, so they are filed as financing rather than
                # pretending to be revenue or expenditure.
                side = "financing"

            entity = f"FR:{code}"
            entities.add(entity)
            per_aggregate[label] += 1
            if item_code in ("OFGL.RecettesTotales", "OFGL.DepensesTotales"):
                key = (code, year)
                headline.setdefault(key, {})["revenue" if side == "revenue" else "expenditure"] = amount

            fact = {
                "public_entity_id": entity,
                "fiscal_year": int(year),
                "fiscal_period": "FY",
                "reporting_scope": REPORTING_SCOPE,
                "budget_stage": "actual",
                "budget_side": side,
                "economic_item_code": item_code,
                "source_budget_item_type_code": label,
                "amount_local": f"{amount:.6f}",
                "currency_code": CURRENCY,
                "is_consolidation_item": False,
                "is_financing": side_less,
                # These are the publisher's own totals of the balance facts beside them. A
                # consumer summing line items must not add them in as well.
                "is_summary_row": True,
                "source_id": SOURCE_ID,
                "ingestion_run_id": args.run_id,
                "coverage_type": COVERAGE_TYPE,
                "quality_flags": ["publisher_defined_aggregate"],
                "loaded_at": loaded_at,
            }
            if handle:
                handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
            written += 1

    if handle:
        handle.close()

    print(f"entities: {len(entities):,}  rows: {written:,}")
    for label, count in per_aggregate.most_common():
        print(f"  {label:<32} {count:>7,}")
    if skipped:
        print("skipped: " + ", ".join(f"{k}={v:,}" for k, v in skipped.most_common(3)))

    both = [v for v in headline.values() if "revenue" in v and "expenditure" in v]
    print(f"\nentity-years carrying both totals: {len(both):,} of {len(headline):,}")

    if args.write:
        print(f"\nWrote {args.write}")
        print("Load it explicitly:")
        print(f"  bq load --source_format=NEWLINE_DELIMITED_JSON czbudget-janrezab:budget_detail."
              f"municipal_budget_line_facts {args.write}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
