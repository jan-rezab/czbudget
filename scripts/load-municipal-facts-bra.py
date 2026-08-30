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

# Stages that map one-to-one onto the warehouse vocabulary (actual, revised, enacted,
# proposal). Brazil also emits `execution` and `cash`, which do not — see DEFERRED below.
STAGE_MAP = {"enacted": "enacted", "revised": "revised", "actual": "actual"}

DEFERRED = {
    "execution": (
        "Conflates two different things under one label: `No Bimestre (b)` is a period flow "
        "that belongs in `actual` with the bimester carried in fiscal_period, while "
        "`SALDO (a-c)` is a derived residual (forecast minus realised) that should not be a "
        "stored fact at all — it is reconstructable, and storing it would break a "
        "parts-sum-to-total invariant. Needs a period-flow decision before loading."
    ),
    "cash": (
        "No matching scope in the warehouse vocabulary. Needs a reporting_scope decision "
        "before loading."
    ),
}

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
            stage = STAGE_MAP.get(source_stage)
            if stage is None:
                skipped[source_stage] += 1
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
                "fiscal_period": "FY",
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
    print("stage mapping:")
    for stage, count in stages.most_common():
        target = STAGE_MAP.get(stage)
        verdict = f"-> {target}" if target else "DEFERRED"
        print(f"  {str(stage):<12} {count:>10,}  {verdict}")
    print(f"\nloaded:   {loaded:,} rows across {len(entities_loaded):,} entities")
    print(f"deferred: {sum(skipped.values()):,} rows")
    for stage, reason in DEFERRED.items():
        if skipped.get(stage):
            print(f"\n  {stage} ({skipped[stage]:,} rows)\n    {reason}")
    if args.write:
        print(f"\nWrote {args.write}")


if __name__ == "__main__":
    main()
