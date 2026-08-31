#!/usr/bin/env python3
"""Load Japan's municipal settlement into the warehouse fact shape.

The previous loader refused to write, because leaf sums came to 2.47x published revenue and
0.50x published expenditure and the hierarchy looked unrecoverable without e-Stat's table
definitions. Both figures were measured against the importer's output, which caps detail at
360 rows per municipality — an over-count from the hierarchy mixed with an under-count from
truncation. Read from the raw survey the structure is plain, and every total ties:

  table 02 row 01 (令和6年度)   歳入総額 and 歳出総額 — what the profile publishes
  table 05 rows 01-25, 29       revenue by category; row 33 （歳入合計）is their total
  table 13 rows 01-37           expenditure by nature; row 38 歳出合計 is their total

Row 33 equals table 02's 歳入総額 for 3,063 of 3,063 municipalities, and row 38 equals its
歳出総額 for 3,063 of 3,063. The revenue leaves sum to their total exactly. The expenditure
leaves do so for 2,825 of 3,063; the remaining 238 exceed it by about 0.01%, which is recorded
rather than absorbed, and does not touch the published figure because that comes from row 38.

`is_summary_row` marks everything outside the verified leaf set — the totals, the partitioned
parents whose children are stored, and the うち subsets that are a slice of a sibling rather
than a share of the whole. Summing the non-summary rows therefore reproduces the total.

Writes NDJSON only; the `bq load` is a separate, explicit step.

    python3 scripts/load-municipal-facts-jpn-estat.py --report
    python3 scripts/load-municipal-facts-jpn-estat.py --write out.ndjson
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
CACHE = WEB.parent / "data/source_cache/municipal-expansion/JPN"

SOURCE_ID = "jpn-estat-municipal-settlement-2024"
CURRENCY = "JPY"
REPORTING_SCOPE = "municipal_general_budget"
COVERAGE_TYPE = "full_budget"
FISCAL_YEAR = 2024
# e-Stat publishes this survey in thousands of yen; the warehouse holds units.
UNIT_MULTIPLIER = 1000

SETTLEMENT = "000040375636.csv"                       # 02 決算収支の状況
REVENUE = ("000040375639.csv", "000040375640.csv")    # 05 収入の状況 _1 and _2
EXPENDITURE = ("000040375656.csv", "000040375657.csv")  # 13 歳出内訳及び財源内訳（その7）

# The rows that sum to their table's own total, established arithmetically against it.
REVENUE_LEAVES = {f"{n:02d}" for n in range(1, 26)} | {"29"}
EXPENDITURE_LEAVES = {"01", "03", "04", "05", "06", "12", "18", "21", "29", "32", "33", "34", "35", "36", "37"}
REVENUE_TOTAL_ROW = "33"
EXPENDITURE_TOTAL_ROW = "38"


def read(name: str):
    with (CACHE / name).open(encoding="cp932", errors="replace") as handle:
        reader = csv.reader(handle)
        header = [column.strip() for column in next(reader)]
        return header, list(reader)


def number(value: str) -> int:
    text = str(value).replace(",", "").strip()
    try:
        return int(text) if text else 0
    except ValueError:
        return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write NDJSON to this path")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--run-id", default=f"jpn-estat-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}")
    args = parser.parse_args()

    # What the profile publishes, and what every other table has to agree with.
    header, rows = read(SETTLEMENT)
    at = header.index
    revenue_at = next(i for i, c in enumerate(header) if "歳入総額" in c)
    expenditure_at = next(i for i, c in enumerate(header) if "歳出総額" in c)
    published = {
        row[at("団体コード")]: (number(row[revenue_at]), number(row[expenditure_at]))
        for row in rows if row[at("行番号")] == "01"
    }

    loaded_at = datetime.now(timezone.utc).isoformat()
    handle = args.write.open("w", encoding="utf-8") if args.write else None
    labels: dict[str, str] = {}
    written = 0
    entities: set[str] = set()
    leaf_sum: dict[tuple[str, str], int] = defaultdict(int)
    totals: dict[tuple[str, str], int] = {}
    skipped = Counter()

    def emit(table: str, side: str, files, leaves: set[str], total_row: str):
        nonlocal written
        for name in files:
            head, body = read(name)
            index = {key: head.index(key) for key in ("団体コード", "行番号", "行名称", "県名", "団体名")}
            value_at = next(i for i, c in enumerate(head) if c.startswith("001:"))
            for row in body:
                entity, line = row[index["団体コード"]], row[index["行番号"]]
                amount = number(row[value_at])
                if not entity or not line:
                    skipped["malformed"] += 1
                    continue
                if entity not in published:
                    skipped["not_in_settlement"] += 1
                    continue
                code = f"T{table}.{line}"
                labels.setdefault(code, row[index["行名称"]].strip())
                if line == total_row:
                    totals[(entity, side)] = amount
                if line in leaves:
                    leaf_sum[(entity, side)] += amount
                if amount == 0:
                    skipped["zero"] += 1
                    continue
                fact = {
                    "public_entity_id": f"JP:{entity}",
                    "fiscal_year": FISCAL_YEAR,
                    "fiscal_period": "FY",
                    "reporting_scope": REPORTING_SCOPE,
                    "budget_stage": "actual",
                    "budget_side": side,
                    "economic_item_code": code,
                    "source_budget_item_type_code": f"表{table} {row[index['行名称']].strip()}",
                    "amount_local": f"{amount * UNIT_MULTIPLIER:.6f}",
                    "currency_code": CURRENCY,
                    "is_consolidation_item": False,
                    "is_financing": False,
                    # Everything outside the verified leaf set: the totals, the parents whose
                    # children are stored beside them, and the うち rows that are a slice of a
                    # sibling rather than a share of the whole.
                    "is_summary_row": line not in leaves,
                    "source_id": SOURCE_ID,
                    "ingestion_run_id": args.run_id,
                    "coverage_type": COVERAGE_TYPE,
                    "quality_flags": [],
                    "loaded_at": loaded_at,
                }
                if handle:
                    handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
                written += 1
                entities.add(entity)

    emit("05", "revenue", REVENUE, REVENUE_LEAVES, REVENUE_TOTAL_ROW)
    emit("13", "expenditure", EXPENDITURE, EXPENDITURE_LEAVES, EXPENDITURE_TOTAL_ROW)

    if handle:
        handle.close()

    print(f"entities: {len(entities)}  rows: {written:,}")
    print("skipped: " + ", ".join(f"{k}={v:,}" for k, v in skipped.most_common(4)))

    for side, position in (("revenue", 0), ("expenditure", 1)):
        exact = checked = leaves_ok = 0
        for entity, (pub_revenue, pub_expenditure) in published.items():
            target = (pub_revenue, pub_expenditure)[position]
            if (entity, side) not in totals:
                continue
            checked += 1
            if totals[(entity, side)] == target:
                exact += 1
            if leaf_sum[(entity, side)] == totals[(entity, side)]:
                leaves_ok += 1
        print(f"{side:<12} total row == published: {exact}/{checked}   leaves == total row: {leaves_ok}/{checked}")

    if args.write:
        registry = WEB / "data/registry/municipal-item-labels.v1.json"
        payload = json.loads(registry.read_text(encoding="utf-8"))
        payload["countries"]["JPN"] = dict(sorted(labels.items()))
        payload["country_count"] = len(payload["countries"])
        payload["code_count"] = sum(len(v) for v in payload["countries"].values())
        registry.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nWrote {args.write} and {len(labels)} JPN item labels")
        print("Load it explicitly:")
        print(f"  bq load --source_format=NEWLINE_DELIMITED_JSON czbudget-janrezab:budget_detail."
              f"municipal_budget_line_facts {args.write}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
