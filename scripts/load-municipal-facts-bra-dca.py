#!/usr/bin/env python3
"""Load Brazil's 2024 DCA annual accounts into the warehouse fact shape.

44 of Brazil's 5,570 municipalities file no RREO Annex 01. Their profile falls back to the
Declaração de Contas Anuais, and the warehouse's copy of that fallback came second-hand: the
RREO loader reads the importer's output, whose per-municipality detail array is capped at 360
rows, and whose DCA rows had already lost the distinction between a gross revenue and the
deduction taken from it. Both arrive as `actual` at period `FY` under the same account code,
so any sum over that grain adds them together. For BR:1302405 that turns a published
103,540,289.40 into 110,805,556.30, the gross plus a 7,265,266.90 FUNDEB deduction.

This reads the raw annexes instead, and keeps the source's own column heading — which the
schema has always had room for in source_budget_item_type_code, and which is the only thing
distinguishing the two rows.

Writes NDJSON only, like the RREO loader. Loading it is a separate, explicit `bq load`, so
the mapping can be read before anything is written to the warehouse.

    python3 scripts/load-municipal-facts-bra-dca.py --report
    python3 scripts/load-municipal-facts-bra-dca.py --write out.ndjson
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
CACHE = WORKSPACE / "data/source_cache/municipal-expansion/BRA"
FANOUT = WEB / "data/municipal-expansion/bra"

SOURCE_ID = "br-siconfi-dca-2024"
CURRENCY = "BRL"
REPORTING_SCOPE = "municipal_general_budget"
COVERAGE_TYPE = "full_budget"
FISCAL_YEAR = 2024

# The DCA files its measures in named columns. Revenue reports what was realised gross and,
# separately, what FUNDEB took out of it; expenditure reports the three execution phases.
# A deduction is a real reported fact rather than a derived one, so it is loaded — but it is
# marked as a consolidation item, because adding it to the gross it was taken from would
# double-count the same money.
COLUMN_RULES = (
    # (matcher on the column heading, budget_stage, is_consolidation_item)
    ("Receitas Brutas Realizadas", "actual", False),
    ("Deduções", "actual", True),
    ("Deducoes", "actual", True),
    ("Despesas Empenhadas", "committed", False),
    ("Despesas Liquidadas", "actual", False),
    ("Despesas Pagas", "paid", False),
    ("Restos a Pagar", "carried_over", False),
)

# Totals a source publishes alongside its parts. Kept, because the headline reads one of them,
# but marked so a caller summing the parts does not add their own total back in.
SUMMARY_CODES = {
    "TotalReceitas", "SubtotalDasReceitas", "ReceitasExcetoIntraOrcamentarias",
    "TotalReceitasComDeficit", "TotalDespesas", "SubtotalDasDespesas",
    "DespesasExcetoIntraOrcamentarias", "TotalDespesasComSuperavit",
}


def classify(column: str):
    text = (column or "").strip()
    for matcher, stage, consolidation in COLUMN_RULES:
        if matcher.lower() in text.lower():
            return stage, consolidation
    return None, False


def read(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle).get("items", [])


def published_headline(code: str) -> dict:
    try:
        profile = json.loads((FANOUT / f"{code}.json").read_text(encoding="utf-8"))
    except OSError:
        return {}
    for entry in profile.get("history", []):
        if entry.get("year") == FISCAL_YEAR:
            return entry
    return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write NDJSON to this path")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--run-id", default=f"dca2024-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}")
    args = parser.parse_args()

    loaded_at = datetime.now(timezone.utc).isoformat()
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    codes = sorted(path.name.split(".")[0] for path in (CACHE / "DCA-2024-I-C").glob("*.json.gz"))
    stages = Counter()
    skipped = Counter()
    rows_written = 0
    entities = set()

    # Every municipality's published headline is recomputed from these rows as they are built,
    # so the load cannot silently change a figure the site already shows.
    revenue_ok = expenditure_ok = revenue_seen = expenditure_seen = 0
    drift = []

    for code in codes:
        entity_id = f"BR:{code}"
        headline = published_headline(code)
        rebuilt = {"revenue": None, "expenditure": None}

        for side, annex in (("revenue", "I-C"), ("expenditure", "I-D")):
            for item in read(CACHE / f"DCA-2024-{annex}" / f"{code}.json.gz"):
                amount = item.get("valor")
                account = (item.get("cod_conta") or "").strip()
                column = (item.get("coluna") or "").strip()
                if amount is None or not account:
                    skipped["missing_amount_or_account"] += 1
                    continue
                stage, consolidation = classify(column)
                if stage is None:
                    skipped[f"unmapped_column:{column}"] += 1
                    continue

                if side == "revenue" and not consolidation and account == "ReceitasExcetoIntraOrcamentarias":
                    rebuilt["revenue"] = float(amount)
                if side == "expenditure" and stage == "actual" and account == "TotalDespesas":
                    rebuilt["expenditure"] = float(amount)

                fact = {
                    "public_entity_id": entity_id,
                    "fiscal_year": FISCAL_YEAR,
                    "fiscal_period": "FY",
                    "reporting_scope": REPORTING_SCOPE,
                    "budget_stage": stage,
                    "budget_side": side,
                    "economic_item_code": account,
                    # The column heading is what separates a gross revenue from the deduction
                    # taken out of it. Dropping it is what made the two indistinguishable.
                    "source_budget_item_type_code": column,
                    "amount_local": f"{float(amount):.6f}",
                    "currency_code": CURRENCY,
                    "is_consolidation_item": consolidation,
                    "is_financing": False,
                    "is_summary_row": account in SUMMARY_CODES,
                    "source_id": SOURCE_ID,
                    "ingestion_run_id": args.run_id,
                    "coverage_type": COVERAGE_TYPE,
                    "quality_flags": ["financing_split_unavailable"],
                    "loaded_at": loaded_at,
                }
                if handle:
                    handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
                rows_written += 1
                stages[stage] += 1
                entities.add(entity_id)

        for side in ("revenue", "expenditure"):
            target = headline.get(side)
            if target is None:
                continue
            if side == "revenue":
                revenue_seen += 1
            else:
                expenditure_seen += 1
            built = rebuilt[side]
            if built is not None and abs(built - target) <= max(0.01, abs(target) * 1e-9):
                if side == "revenue":
                    revenue_ok += 1
                else:
                    expenditure_ok += 1
            elif len(drift) < 5:
                drift.append(f"{code} {side}: published {target}, rebuilt {built}")

    if handle:
        handle.close()

    print(f"entities: {len(entities)} of {len(codes)} with rows")
    print(f"rows:     {rows_written}")
    for stage, count in stages.most_common():
        print(f"  {stage:<14} {count}")
    if skipped:
        print("skipped:")
        for reason, count in skipped.most_common(6):
            print(f"  {reason}: {count}")

    print(f"\nheadline check against what the site publishes today:")
    print(f"  revenue     {revenue_ok}/{revenue_seen}")
    print(f"  expenditure {expenditure_ok}/{expenditure_seen}")
    for line in drift:
        print(f"    {line}")

    if args.write:
        print(f"\nWrote {args.write}")
        print("Load it explicitly, and delete the second-hand 2024 rows first:")
        print("  bq query --use_legacy_sql=false 'DELETE FROM `czbudget-janrezab.budget_detail."
              "municipal_budget_line_facts` WHERE fiscal_year = 2024 AND STARTS_WITH(public_entity_id, \"BR:\")'")
        print(f"  bq load --source_format=NEWLINE_DELIMITED_JSON czbudget-janrezab:budget_detail."
              f"municipal_budget_line_facts {args.write}")

    return 0 if revenue_ok == revenue_seen and expenditure_ok == expenditure_seen else 1


if __name__ == "__main__":
    sys.exit(main())
