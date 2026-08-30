#!/usr/bin/env python3
"""Load Brazil's municipal line items into the BigQuery fact table.

This is the convergence step: Brazil currently ships as 5,570 committed JSON files plus
5,571 committed HTML pages, while France — six times larger — lives in the warehouse and
costs the repository nothing. This loads Brazil the way France is already loaded, so both
countries answer from one grain through one public endpoint.

Source is the uniform layer (outputs/municipal-expansion/BRA.json), not the committed
fan-out, because the fan-out is a derived serving view of exactly this data.

    python3 scripts/load-municipal-facts-bra.py --report
    python3 scripts/load-municipal-facts-bra.py --write out.ndjson

Writes NDJSON only. Loading it is a separate, explicit `bq load` so the mapping can be
reviewed before anything reaches the warehouse.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from collections import Counter
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]
SOURCE = WORKSPACE / "outputs" / "municipal-expansion" / "BRA.json"

# The warehouse's established conventions, read from the loaded countries rather than
# invented here: entity ids are "<alpha2>:<national code>" and stages are a closed set.
ENTITY_PREFIX = "BR"
CURRENCY = "BRL"
SOURCE_ID = "br-siconfi-rreo-2025"
REPORTING_SCOPE = "standalone_municipality"
COVERAGE_TYPE = "census"

# Brazil records expenditure through three official execution phases — empenhada
# (committed), liquidada (accrued) and paga (paid) — where the warehouse vocabulary stopped
# at proposal / enacted / revised / actual. These are lifecycle phases, not a different kind
# of thing, so the vocabulary is extended rather than an existing value distorted:
#
#   proposal -> enacted -> revised -> committed -> actual (accrued) -> paid
#
# `actual` stays the accrual measure, because that is what is comparable with the other
# countries already loaded. A caller wanting the cash view asks for `paid`.
STAGE_MAP = {"enacted": "enacted", "revised": "revised", "actual": "actual"}

# Rows whose stage is decided by the source's own column heading rather than its stage label.
# Brazil files several distinct measures under the single label `execution`.
COLUMN_RULES = (
    # (matcher, budget_stage, fiscal_period)
    ("DESPESAS EMPENHADAS NO BIMESTRE", "committed", "B6"),
    ("DESPESAS EMPENHADAS", "committed", "FY"),
    ("Despesas Empenhadas", "committed", "FY"),
    ("DESPESAS PAGAS", "paid", "FY"),
    ("Despesas Pagas", "paid", "FY"),
    ("RESTOS A PAGAR", "carried_over", "FY"),
    ("Restos a Pagar", "carried_over", "FY"),
    # A revenue flow realised within the bimester. It belongs to the accrual measure, but it
    # is a slice of the year rather than the year, so the period keeps it from summing with
    # the full-year row.
    ("No Bimestre (b)", "actual", "B6"),
)

# Derived values, not reported facts. SALDO is forecast minus realised — reconstructable
# from rows already stored, and storing it would break "parts sum to their published total".
DERIVED_PREFIXES = ("SALDO",)

DEFERRED = {}

SUMMARY_PREFIX = re.compile(r"^(Total|Subtotal)", re.IGNORECASE)
ROMAN_MARKER = re.compile(r"\((?:I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|XI{0,3}|XIV)\)")


def is_summary(code: str, name: str | None) -> bool:
    """A published total, not a leaf. Loading these as leaves corrupts every aggregation."""
    if SUMMARY_PREFIX.match(code or ""):
        return True
    text = name or ""
    return "= (" in text or bool(ROMAN_MARKER.search(text))


def is_consolidation(code: str, name: str | None) -> bool:
    """Intra-orçamentárias are internal transactions — exactly what consolidation removes.

    Careful with the negation: `DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS)` is the line that
    *excludes* them, so matching the word alone flags the opposite of what is meant.
    """
    text = (name or "").upper()
    code_text = (code or "").lower()
    if "exceto" in code_text or "EXCETO" in text:
        return False
    return "intra" in code_text or "INTRA-OR" in text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", type=Path, help="Write NDJSON to this path")
    parser.add_argument("--run-id", default="bra-initial-load")
    parser.add_argument("--loaded-at", default=None,
                        help="ISO timestamp stamped on every row; defaults to now")
    args = parser.parse_args()
    loaded_at = args.loaded_at or dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    entities = payload["entities"]

    stages = Counter()
    loaded = 0
    skipped = Counter()
    entities_loaded = set()
    total_by_stage = Counter()
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    for entity in entities:
        entity_id = f"{ENTITY_PREFIX}:{entity['code']}"
        for row in entity.get("detail", []):
            source_stage = row.get("stage")
            stages[source_stage] += 1
            column = str(row.get("column") or "")

            if column.strip().upper().startswith(DERIVED_PREFIXES):
                skipped["derived_residual (SALDO)"] += 1
                continue

            stage = STAGE_MAP.get(source_stage)
            period = "FY"
            if stage is None:
                for matcher, mapped_stage, mapped_period in COLUMN_RULES:
                    if matcher in column:
                        stage, period = mapped_stage, mapped_period
                        break
            elif source_stage == "actual":
                for matcher, mapped_stage, mapped_period in COLUMN_RULES:
                    if matcher in column and mapped_stage == "actual":
                        period = mapped_period
                        break
            if stage is None:
                skipped[f"unmapped: {source_stage} / {column[:32]}"] += 1
                continue
            amount = row.get("amount")
            if amount is None:
                skipped["null_amount"] += 1
                continue
            code = row.get("code") or ""
            if not code:
                skipped["missing_code"] += 1
                continue

            fact = {
                "public_entity_id": entity_id,
                "fiscal_year": int(row["year"]),
                "fiscal_period": period,
                "reporting_scope": REPORTING_SCOPE,
                "budget_stage": stage,
                "budget_side": row.get("side"),
                "economic_item_code": code,
                "source_budget_item_type_code": row.get("column"),
                "amount_local": float(amount),
                "currency_code": CURRENCY,
                "is_consolidation_item": is_consolidation(code, row.get("name")),
                "is_financing": False,
                "is_summary_row": is_summary(code, row.get("name")),
                "source_id": SOURCE_ID,
                "ingestion_run_id": args.run_id,
                "coverage_type": COVERAGE_TYPE,
                "quality_flags": ["financing_split_unavailable"],
                "loaded_at": loaded_at,
            }
            if handle:
                handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
            loaded += 1
            entities_loaded.add(entity_id)
            total_by_stage[stage] += 1

    if handle:
        handle.close()

    total = sum(stages.values())
    print(f"source:   {SOURCE.relative_to(WORKSPACE)}")
    print(f"entities: {len(entities):,}")
    print(f"rows:     {total:,}\n")
    print("source stage labels (Brazil files several measures under `execution`):")
    for stage, count in stages.most_common():
        print(f"  {str(stage):<12} {count:>10,}")
    print(f"\nloaded:   {loaded:,} rows across {len(entities_loaded):,} entities")
    print("by stage:")
    for stage, count in total_by_stage.most_common():
        print(f"  {stage:<14} {count:>10,}")
    print(f"\nnot loaded: {sum(skipped.values()):,} rows")
    for reason, count in skipped.most_common(8):
        print(f"  {reason:<52} {count:>9,}")
    if args.write:
        print(f"\nWrote {args.write}")


if __name__ == "__main__":
    main()
