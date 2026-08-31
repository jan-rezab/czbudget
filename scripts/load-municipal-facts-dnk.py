#!/usr/bin/env python3
"""Load Denmark's municipal final accounts into the warehouse fact shape.

Reads the REGK100 re-extraction, which unlike the cached one carries both sides of every
dranst. Copenhagen 2025 comes to 68,818,554 thousand kroner out against 68,818,541 in — the
accounts close, which the previous extract's did not by 33,072,000.

Two things this decides, both recorded rather than assumed.

The side is ART: UE (bruttoudgifter) is expenditure, I (indtægter) is revenue. Denmark records
revenue as a credit, so those arrive negative in the source; they are stored with the sign the
source gives them, and a consumer wanting a positive revenue figure takes the absolute value,
exactly as it must for the raw filing.

Financing is marked, not dropped. Dranst 4 (renter), 5 (finansforskydninger) and 6 (afdrag på
lån), plus borrowing under function 8.55, are flows that fund the budget rather than being it.
Left in a headline they make every municipality balance to zero, because the whole account plan
balances by construction. Marked as financing, the remaining gross revenue and expenditure
differ by the year's actual result: 67.57bn against 67.13bn for Copenhagen, a 0.45bn surplus.

Writes NDJSON only. The `bq load` is a separate, explicit step.

    python3 scripts/load-municipal-facts-dnk.py --report
    python3 scripts/load-municipal-facts-dnk.py --write out.ndjson
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
WORKSPACE = WEB.parent
CACHE = WORKSPACE / "data/source_cache/municipal-expansion/DNK/REGK100"

SOURCE_ID = "dk-statbank-regk100"
CURRENCY = "DKK"
REPORTING_SCOPE = "municipal_general_budget"
COVERAGE_TYPE = "full_budget"
# REGK100 is the final accounts — regnskab, not budget.
BUDGET_STAGE = "actual"
# The table is published in thousands of kroner; the warehouse holds units.
UNIT_MULTIPLIER = 1000

SIDE = {"UE": "expenditure", "I": "revenue"}

# Flows that fund the budget rather than being it. Interest, balance shifts and loan repayments
# are their own dranst; borrowing hides under dranst 7 at function 8.55, beside the taxes.
FINANCING_DRANST = {"4", "5", "6"}
FINANCING_FUNCTION_PREFIX = "855"

DRANST_NAME = {
    "1": "Driftskonti", "2": "Statsrefusion", "3": "Anlægskonti", "4": "Renter",
    "5": "Finansforskydninger", "6": "Afdrag på lån", "7": "Finansiering",
}


def dotted(function: str) -> str:
    """5-digit function codes are a 1.23.45 hierarchy; store them the way Denmark writes them."""
    return f"{function[0]}.{function[1:3]}.{function[3:5]}" if len(function) == 5 else function


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write NDJSON to this path")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--run-id", default=f"dnk-regk100-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}")
    args = parser.parse_args()

    files = sorted(CACHE.glob("*.csv.gz"))
    if not files:
        print(f"No extraction under {CACHE}. Run scripts/fetch-denmark-regk100.py --fetch first.")
        return 1

    loaded_at = datetime.now(timezone.utc).isoformat()
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    rows_written = 0
    entities = set()
    by_dranst = Counter()
    skipped = Counter()
    # Both sides per entity-year, so the load can state whether the accounts still close.
    balance: dict[tuple[str, str], dict[str, int]] = {}

    for path in files:
        with gzip.open(path, "rt", encoding="utf-8") as source:
            lines = source.read().strip().split("\n")
        for line in lines[1:]:
            parts = line.split(";")
            if len(parts) != 7:
                skipped["malformed"] += 1
                continue
            area, function, dranst, art, _price, year, value = parts
            try:
                amount = int(value)
            except ValueError:
                skipped["non_numeric"] += 1
                continue
            if amount == 0:
                # The cube is mostly empty; storing 350,000 zeros per municipality would say
                # nothing a missing row does not already say.
                skipped["zero"] += 1
                continue
            side = SIDE.get(art)
            if side is None:
                skipped[f"unmapped_art:{art}"] += 1
                continue

            entity_id = f"DK:{area}"
            key = (entity_id, year)
            cell = balance.setdefault(key, {"expenditure": 0, "revenue": 0, "operating": 0})
            cell[side] += amount

            is_financing = dranst in FINANCING_DRANST or function.startswith(FINANCING_FUNCTION_PREFIX)
            if not is_financing:
                cell["operating"] += amount

            fact = {
                "public_entity_id": entity_id,
                "fiscal_year": int(year),
                "fiscal_period": "FY",
                "reporting_scope": REPORTING_SCOPE,
                "budget_stage": BUDGET_STAGE,
                "budget_side": side,
                "economic_item_code": dotted(function),
                # Dranst is the account class, and it is what separates an operating cost from
                # a loan repayment. Losing it is how the previous extract became unbalanced.
                "source_budget_item_type_code": f"{dranst} {DRANST_NAME.get(dranst, '')}".strip(),
                "amount_local": f"{amount * UNIT_MULTIPLIER:.6f}",
                "currency_code": CURRENCY,
                "is_consolidation_item": False,
                "is_financing": is_financing,
                # Every row is one function at one dranst — the leaf of this table.
                "is_summary_row": False,
                "source_id": SOURCE_ID,
                "ingestion_run_id": args.run_id,
                "coverage_type": COVERAGE_TYPE,
                "quality_flags": ["revenue_recorded_as_credit"],
                "loaded_at": loaded_at,
            }
            if handle:
                handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
            rows_written += 1
            entities.add(entity_id)
            by_dranst[dranst] += 1

    if handle:
        handle.close()

    print(f"entities: {len(entities)}  rows: {rows_written:,}")
    for dranst, count in sorted(by_dranst.items()):
        print(f"  dranst {dranst} {DRANST_NAME.get(dranst,''):<22} {count:>8,}")
    print("skipped: " + ", ".join(f"{k}={v:,}" for k, v in skipped.most_common(4)))

    closes = sum(1 for cell in balance.values()
                 if abs(cell["expenditure"] + cell["revenue"]) <= max(1000, abs(cell["expenditure"]) * 1e-6))
    print(f"\naccounts that close (all dranst, both sides): {closes}/{len(balance)}")
    surplus = [cell["operating"] for cell in balance.values()]
    negative = sum(1 for value in surplus if value < 0)
    print(f"excluding financing, {negative}/{len(surplus)} entity-years show revenue above expenditure")

    if args.write:
        print(f"\nWrote {args.write}")
        print("Load it explicitly, replacing the previous extract's rows first:")
        print("  bq query --use_legacy_sql=false 'DELETE FROM `czbudget-janrezab.budget_detail."
              "municipal_budget_line_facts` WHERE fiscal_year BETWEEN 2024 AND 2025 AND "
              "STARTS_WITH(public_entity_id, \"DK:\")'")
        print(f"  bq load --source_format=NEWLINE_DELIMITED_JSON czbudget-janrezab:budget_detail."
              f"municipal_budget_line_facts {args.write}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
