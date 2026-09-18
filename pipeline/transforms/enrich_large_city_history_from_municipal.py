#!/usr/bin/env python3
"""Enrich data/large-city-history.v1.json with the full per-year field set.

large-city-history.v1.json is built by prepare_large_city_history.py (2010-2025,
from MONITOR FINM/ROZV zip archives under data/source_cache) and then
prepare_historical_large_city_archive.py (2006-2009 backfill from the MONITOR
ARIS API). Both require network access / a populated data/source_cache that is
not present in every worktree.

Each of the 27 large cities also has a full-detail annual history at
data/municipal-history/<ICO>.json, produced by prepare_municipal_history.py
from the same upstream MONITOR extracts, carrying revenue_approved,
revenue_adjusted, expense_approved, expense_adjusted, tax_revenue,
nontax_revenue, capital_revenue, transfer_revenue, current_expense,
capital_expense, population_mid_year and expense_per_capita in addition to the
fields large-city-history.v1.json already has.

This script merges those extra fields from data/municipal-history/<ICO>.json
onto the matching city/year rows of large-city-history.v1.json, in place,
without touching any of the seven fields large-city-history.v1.json already
carries (revenue_actual, expense_actual, budget_balance, cash_current,
cash_previous, source_kind, comparability) and without inventing values for
years a field is genuinely absent (e.g. population/approved-adjusted figures
before 2010 tend to be missing).

It is called both as a library (`enrich`) from prepare_historical_large_city_archive.py,
so a full network-backed rebuild of large-city-history.v1.json stays enriched
automatically, and as a standalone script for worktrees where the network-backed
generators cannot run but data/municipal-history/*.json is already present.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[2]))
# Other generators in this pipeline address the artifact as ROOT/"website/data/...",
# where ROOT is one level above the checked-out repo (the repo itself is the
# "website" tree). This worktree is a flattened checkout with no website/
# subdirectory -- data/ sits directly at the repo root -- so resolve both
# layouts and use whichever actually exists.
_CANDIDATES = [ROOT / "website/data", ROOT / "data"]
_DATA_DIR = next((path for path in _CANDIDATES if path.is_dir()), _CANDIDATES[0])
HISTORY = _DATA_DIR / "large-city-history.v1.json"
MUNICIPAL_HISTORY_DIR = _DATA_DIR / "municipal-history"

# Fields to bring in from data/municipal-history/<ICO>.json, verbatim, never
# recomputed. `expense_per_capita` is explicitly allowed to be carried across
# as-is per the task's field-integrity rule.
EXTRA_FIELDS = [
    "revenue_approved",
    "revenue_adjusted",
    "expense_approved",
    "expense_adjusted",
    "tax_revenue",
    "nontax_revenue",
    "capital_revenue",
    "transfer_revenue",
    "current_expense",
    "capital_expense",
    "population_mid_year",
    "expense_per_capita",
    # Carried so a charted cash series keeps its break marker: the per-municipality
    # artifact flags years whose reported opening balance does not follow the previous
    # year's close, which makes the year-on-year change not a net movement of money.
    "quality_flags",
]

EXTRA_DEFINITIONS = {
    "budget_plan": (
        "revenue_approved/expense_approved je schválený rozpočet, revenue_adjusted/expense_adjusted "
        "je rozpočet po posledni rozpočtové změně (final assessed), obojí z FIN 2-12M."
    ),
    "budget_structure": (
        "tax_revenue/nontax_revenue/capital_revenue/transfer_revenue jsou třídy 1-4 rozpočtové skladby příjmů; "
        "current_expense/capital_expense jsou třídy 5-6 výdajů; po konsolidaci, stejně jako revenue_actual/expense_actual."
    ),
    "population": (
        "population_mid_year je počet obyvatel k 1. 7. daného roku podle ČSÚ; expense_per_capita je "
        "expense_actual dělené population_mid_year, převzato z data/municipal-history beze změny."
    ),
}


def enrich(history: dict) -> dict:
    """Merge extra fields from data/municipal-history/<ICO>.json into `history` in place."""
    for city in history["cities"]:
        ico = city["national_id"]
        municipal_path = MUNICIPAL_HISTORY_DIR / f"{ico}.json"
        if not municipal_path.is_file():
            continue
        municipal = json.loads(municipal_path.read_text(encoding="utf-8"))
        by_year = {row["year"]: row for row in municipal.get("series", [])}
        for row in city["series"]:
            source_row = by_year.get(row["year"])
            if not source_row:
                continue
            for field in EXTRA_FIELDS:
                if field in source_row and source_row[field] is not None:
                    row[field] = source_row[field]

    definitions = history.setdefault("definitions", {})
    for key, text in EXTRA_DEFINITIONS.items():
        definitions.setdefault(key, text)

    history["generated_at"] = datetime.now(timezone.utc).isoformat()
    return history


def main() -> None:
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    enrich(history)
    HISTORY.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    populated = sum(
        1
        for city in history["cities"]
        for row in city["series"]
        if row.get("population_mid_year") is not None
    )
    print(json.dumps({"cities": len(history["cities"]), "city_years_with_population": populated}, ensure_ascii=False))


if __name__ == "__main__":
    main()
