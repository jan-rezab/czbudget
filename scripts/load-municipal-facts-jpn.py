#!/usr/bin/env python3
"""Load Japan's municipal line items into the BigQuery fact table.

Japan needed its own script because its e-Stat filings carry no budget_side and span
sixteen tables that are not all the same kind of thing. Three distinctions decide what can
be loaded and how:

  * The main budget. Table 4 is the revenue breakdown; tables 7 to 13 are the expenditure
    breakdown, a nature-by-purpose matrix. Side comes from the table, not from a field.
  * Separate statutory accounts. The long-term-care and late-elderly medical insurance
    accounts (63, 64, 94, 95) are real budget flows but belong to their own accounting
    units, so they load under a different reporting scope rather than being mixed into the
    municipality's own budget. Their side is written into the row name as 歳入 or 歳出.
  * Stocks. Outstanding local-bond balances (33) and fund balances (29) are positions at a
    date, not money moving in a period. A flow fact table is the wrong home for them, and
    summing them alongside flows would be meaningless, so they are not loaded here.

Table 14 (性質別経費, expenditure by nature) is deliberately excluded: it re-classifies the
same expenditure that tables 7 to 13 already carry, so loading both would double-count every
yen. It needs the dimension model France uses, not a second pass.

`code` is a positional cell reference — 01.001 means the same item within a table but
something else across tables — so the stored code is namespaced by its table.

BLOCKED — this script deliberately refuses to write.

The main budget tables carry a parent-child hierarchy that the uniform layer does not
express. Table 4 lists 地方譲与税 alongside its own child 地方揮発油譲与税 with nothing
distinguishing them; tables 7-13 pair a 総額 row with the components it totals, and carry an
うち ("of which") column that is a subset of the column beside it. Summing what is present
therefore double-counts, and the size of the error is not small:

    leaf revenue      2.47x the municipality's published headline revenue
    leaf expenditure  0.50x its published headline expenditure

Marking 総額 / 合計 / うち as summaries does not fix it, because table 4's hierarchy has no
marker at all. Publishing 66bn of revenue for a municipality whose actual revenue is 26.7bn
would be a worse outcome than showing nothing, so nothing is written.

What would unblock it: the e-Stat table definitions state each row's parent, and that
structure is published separately from the values. With it, is_summary_row becomes a lookup
rather than a guess. Everything else here — the side rules, the stock and headcount
exclusions, the financing classification — is settled and reusable.

    python3 scripts/load-municipal-facts-jpn.py            # the analysis, and the blocker
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from collections import Counter
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]
SOURCE = WORKSPACE / "outputs" / "municipal-expansion" / "JPN.json"

ENTITY_PREFIX = "JP"
CURRENCY = "JPY"
SOURCE_ID = "jpn-estat-municipal-2024"

MAIN_BUDGET_SCOPE = "standalone_municipality"
INSURANCE_SCOPE = "standalone_accounting_unit"

# table -> (side, reporting scope). Side is a property of the table for the main budget.
TABLE_RULES = {
    "4": ("revenue", MAIN_BUDGET_SCOPE),
    "7": ("expenditure", MAIN_BUDGET_SCOPE),
    "8": ("expenditure", MAIN_BUDGET_SCOPE),
    "9": ("expenditure", MAIN_BUDGET_SCOPE),
    "10": ("expenditure", MAIN_BUDGET_SCOPE),
    "11": ("expenditure", MAIN_BUDGET_SCOPE),
    "12": ("expenditure", MAIN_BUDGET_SCOPE),
    "13": ("expenditure", MAIN_BUDGET_SCOPE),
}

# Statutory insurance accounts. Side is carried in the row name rather than the table.
INSURANCE_TABLES = {"63", "64", "94", "95"}

# Published totals rather than leaves.
SUMMARY_TABLES = {"2"}

EXCLUDED_TABLES = {
    "14": "性質別経費 re-classifies the same expenditure tables 7-13 already carry. Loading "
          "both would double-count every yen; it needs a dimension, not a second pass.",
    "29": "基金の状況 is a fund balance — a position at a date, not money moving in a period.",
    "33": "地方債現在高 is outstanding local-bond debt — a stock, not a flow.",
}

# 歳入 marks a receipt, 歳出 a payment, within the insurance-account rows.
REVENUE_MARK = "歳入"
EXPENDITURE_MARK = "歳出"
# （人）marks a count of people — staff numbers, insured persons. A money fact table is the
# wrong place for a headcount, and an amount_local of 47 meaning "47 people" would corrupt
# every sum that touched it.
HEADCOUNT_MARK = "（人）"
# 収支 is a balance: revenue minus expenditure, derived from rows already stored.
BALANCE_MARK = "収支"
# 人件費 is personnel cost — money, and an expenditure, even where the row sits in a memo
# section rather than under the 歳出 heading.
PERSONNEL_MARK = "人件費"
# Reserve movements, carried-over funding and early debt repayment reconcile the balance;
# they are neither operating revenue nor operating expenditure. The schema already carries a
# `financing` side for this, so they are recorded rather than discarded.
FINANCING_MARKS = ("積立金", "繰り越すべき財源", "繰上償還")


def classify_row(name: str) -> tuple[str | None, str | None]:
    """Return (side, rejection reason). Exactly one of the two is set."""
    text = name or ""
    if HEADCOUNT_MARK in text:
        return None, "non_monetary_headcount"
    if REVENUE_MARK in text:
        return "revenue", None
    if EXPENDITURE_MARK in text:
        return "expenditure", None
    if BALANCE_MARK in text:
        return None, "derived_balance"
    if PERSONNEL_MARK in text:
        return "expenditure", None
    if any(mark in text for mark in FINANCING_MARKS):
        return "financing", None
    return None, "unclassified_row_name"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", type=Path,
                        help="Refused while the hierarchy is unresolved — see the module docstring")
    parser.add_argument("--i-have-resolved-the-hierarchy", action="store_true",
                        help="Only pass this once is_summary_row comes from the e-Stat table definitions")
    parser.add_argument("--run-id", default="jpn-initial-load")
    args = parser.parse_args()
    if args.write and not args.i_have_resolved_the_hierarchy:
        parser.error(
            "Refusing to write. Japan's parent-child hierarchy is not expressed in the uniform "
            "layer, so leaf sums come to 2.47x published revenue and 0.50x published "
            "expenditure. See the module docstring."
        )
    loaded_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    entities = payload["entities"]

    by_table = Counter()
    loaded_by_scope = Counter()
    skipped = Counter()
    entities_loaded = set()
    loaded = 0
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    for entity in entities:
        code = str(entity.get("code") or "").strip()
        if not code:
            skipped["entity_without_code"] += 1
            continue
        entity_id = f"{ENTITY_PREFIX}:{code}"

        for row in entity.get("detail", []):
            table = str(row.get("table") or "")
            by_table[table] += 1

            if table in EXCLUDED_TABLES:
                skipped[f"excluded_table_{table}"] += 1
                continue

            name = str(row.get("name") or "")
            summary = table in SUMMARY_TABLES

            if table in TABLE_RULES:
                side, scope = TABLE_RULES[table]
            elif table in INSURANCE_TABLES or summary:
                side, reason = classify_row(name)
                scope = INSURANCE_SCOPE if table in INSURANCE_TABLES else MAIN_BUDGET_SCOPE
                if side is None:
                    skipped[reason] += 1
                    continue
            else:
                skipped[f"unmapped_table_{table}"] += 1
                continue

            amount = row.get("amount")
            if amount is None:
                skipped["null_amount"] += 1
                continue
            item = str(row.get("code") or "").strip()
            if not item:
                skipped["missing_item_code"] += 1
                continue

            fact = {
                "public_entity_id": entity_id,
                "fiscal_year": int(row["year"]),
                "fiscal_period": "FY",
                "reporting_scope": scope,
                "budget_stage": "actual",
                "budget_side": side,
                # 01.001 identifies a cell within its own table and something different in
                # the next one, so the stored code carries the table it belongs to.
                "economic_item_code": f"{table}.{item}",
                "amount_local": f"{float(amount):.6f}",
                "currency_code": CURRENCY,
                "is_consolidation_item": False,
                "is_financing": side == "financing",
                "is_summary_row": summary,
                "source_id": SOURCE_ID,
                "ingestion_run_id": args.run_id,
                "coverage_type": "census",
                "quality_flags": ["side_from_source_table" if table in TABLE_RULES else "side_from_row_name"],
                "loaded_at": loaded_at,
            }
            if handle:
                handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
            loaded += 1
            loaded_by_scope[scope] += 1
            entities_loaded.add(entity_id)

    if handle:
        handle.close()

    total = sum(by_table.values())
    print(f"source rows: {total:,} across {len(entities):,} entities\n")
    print(f"loaded:  {loaded:,} rows across {len(entities_loaded):,} entities")
    for scope, count in loaded_by_scope.most_common():
        print(f"  {scope:<30} {count:>9,}")
    print(f"\nnot loaded: {sum(skipped.values()):,}")
    for reason, count in skipped.most_common():
        note = EXCLUDED_TABLES.get(reason.replace("excluded_table_", ""), "")
        print(f"  {reason:<28} {count:>9,}  {note}")
    if args.write:
        print(f"\nWrote {args.write}")


if __name__ == "__main__":
    main()
