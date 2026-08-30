#!/usr/bin/env python3
"""Load the remaining expansion countries into the BigQuery municipal fact table.

Brazil went first and needed a bespoke script because it files several distinct measures
under one stage label. Every other country is simpler: the stage label is the whole story
and the column heading is absent, so one config-driven loader covers them all.

    python3 scripts/load-municipal-facts.py --report
    python3 scripts/load-municipal-facts.py --country ESP --write out.ndjson
    python3 scripts/load-municipal-facts.py --all --write-dir /tmp/facts

Writes NDJSON. Loading it is a separate, explicit `bq load` so the mapping can be reviewed
before anything reaches the warehouse.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from collections import Counter
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]
UNIFORM = WORKSPACE / "outputs" / "municipal-expansion"
REGISTRY = Path(__file__).resolve().parents[1] / "data" / "registry" / "countries.v1.json"

# The warehouse's stage vocabulary, extended for Brazil's execution lifecycle. `cash` is the
# payment measure everywhere it appears — Italy's SIOPE receipts and payments, Spain's and
# Peru's cash columns — so it maps to `paid` for the same reason it did for Brazil.
STAGE_MAP = {
    "enacted": "enacted",
    "revised": "revised",
    "actual": "actual",
    "cash": "paid",
    "proposal": "proposal",
}

# Countries whose rows carry an explicit hierarchy level. Parent levels are aggregates of
# their children, so loading them as leaves would double-count every total they contain.
LEAF_LEVELS = {"CHL": {"N3"}}

# Not loaded here, each for a stated reason rather than by omission.
EXCLUDED = {
    "BRA": "Loaded by scripts/load-municipal-facts-bra.py — it files committed, accrued and "
           "paid measures under one `execution` label and needs column-level rules.",
    "DNK": "Already in the warehouse from Statistics Denmark StatBank (BUDK100/REGK100, "
           "303,760 line facts). The expansion files are a second extract of the same "
           "municipalities; loading them would duplicate Denmark.",
    "JPN": "e-Stat filings carry no budget_side and span 15 tables that are not all budget "
           "flows — separate long-term-care and late-elderly insurance accounts, and "
           "outstanding local-bond STOCKS. Deriving a side per table, and deciding whether "
           "a stock belongs in a flow table at all, is a modelling decision of its own.",
}


def alpha2_for(alpha3: str) -> str:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for country in registry["countries"]:
        if country["canonical"] == alpha3:
            code = country["aliases"].get("alpha2")
            if code:
                return code
    raise SystemExit(f"{alpha3}: no alpha-2 alias in the country registry")


def uniform_path(alpha3: str) -> Path:
    return UNIFORM / f"{alpha3}.json"


def convert(alpha3: str, run_id: str, loaded_at: str, handle=None) -> dict:
    payload = json.loads(uniform_path(alpha3).read_text(encoding="utf-8"))
    entities = payload.get("entities", [])
    prefix = alpha2_for(alpha3)
    source_id = f"{alpha3.lower()}-municipal-expansion"
    leaf_levels = LEAF_LEVELS.get(alpha3)

    stats = Counter()
    skipped = Counter()
    loaded_entities = set()

    for entity in entities:
        code = str(entity.get("code") or "").strip()
        if not code:
            skipped["entity_without_code"] += 1
            continue
        entity_id = f"{prefix}:{code}"
        currency = entity.get("currency")

        for row in entity.get("detail", []):
            stage = STAGE_MAP.get(row.get("stage"))
            if stage is None:
                skipped[f"unmapped_stage:{row.get('stage')}"] += 1
                continue
            side = row.get("side")
            if side not in ("revenue", "expenditure"):
                skipped[f"unmapped_side:{side}"] += 1
                continue
            amount = row.get("amount")
            if amount is None:
                skipped["null_amount"] += 1
                continue
            item = str(row.get("code") or "").strip()
            derived_code = False
            if not item:
                # Guatemala publishes SERVICIOS PERSONALES with no code. The item is real
                # money and is identified by its official name, so the name becomes the key
                # and a flag records that the source gave no code — rather than dropping it.
                item = str(row.get("name") or "").strip()
                derived_code = bool(item)
                if not item:
                    skipped["no_code_and_no_name"] += 1
                    continue

            # An explicit level says whether this row is a leaf. Without one, the source
            # publishes a flat list and every row is a leaf.
            level = row.get("level")
            is_summary = bool(leaf_levels) and level is not None and level not in leaf_levels

            fact = {
                "public_entity_id": entity_id,
                "fiscal_year": int(row["year"]),
                "fiscal_period": "FY",
                "reporting_scope": "standalone_municipality",
                "budget_stage": stage,
                "budget_side": side,
                "economic_item_code": item,
                # BigQuery NUMERIC allows 9 decimal places. Python float repr can exceed
                # that (713807.8499999999 for a value the source publishes as 713807.85), so
                # amounts are emitted as fixed-precision strings, which BQ parses exactly.
                "amount_local": f"{float(amount):.6f}",
                "currency_code": currency,
                "is_consolidation_item": False,
                "is_financing": False,
                "is_summary_row": is_summary,
                "source_id": source_id,
                "ingestion_run_id": run_id,
                "coverage_type": "census",
                "quality_flags": ([] if leaf_levels else ["leaf_rule_flat_source"])
                                 + (["item_code_derived_from_name"] if derived_code else []),
                "loaded_at": loaded_at,
            }
            if handle:
                handle.write(json.dumps(fact, ensure_ascii=False) + "\n")
            stats[stage] += 1
            stats["_total"] += 1
            if is_summary:
                stats["_summary"] += 1
            if derived_code:
                stats["_derived_code"] += 1
            loaded_entities.add(entity_id)

    return {
        "country": alpha3,
        "prefix": prefix,
        "entities_in_source": len(entities),
        "entities_loaded": len(loaded_entities),
        "loaded": stats["_total"],
        "summary_rows": stats["_summary"],
        "derived_codes": stats["_derived_code"],
        "by_stage": {k: v for k, v in stats.items() if not k.startswith("_")},
        "skipped": dict(skipped),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", help="One ISO alpha-3 code")
    parser.add_argument("--all", action="store_true", help="Every loadable country")
    parser.add_argument("--report", action="store_true", help="Measure without writing")
    parser.add_argument("--write", type=Path, help="NDJSON path for a single country")
    parser.add_argument("--write-dir", type=Path, help="Directory for per-country NDJSON")
    parser.add_argument("--run-id", default="expansion-initial-load")
    args = parser.parse_args()

    available = sorted(p.stem for p in UNIFORM.glob("*.json") if "-shard-" not in p.name)
    if args.country:
        countries = [args.country.upper()]
    elif args.all or args.report:
        countries = [c for c in available if c not in EXCLUDED]
    else:
        parser.error("Pass --country, --all or --report")

    loaded_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    if args.write_dir:
        args.write_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    print(f"{'cc':<5}{'entities':>10}{'rows':>12}{'summary':>9}  stages")
    for alpha3 in countries:
        if alpha3 in EXCLUDED and args.country:
            print(f"{alpha3}: excluded — {EXCLUDED[alpha3]}")
            continue
        if not uniform_path(alpha3).exists():
            print(f"{alpha3:<5} (no uniform file)")
            continue

        handle = None
        if args.write:
            handle = args.write.open("w", encoding="utf-8")
        elif args.write_dir:
            handle = (args.write_dir / f"{alpha3}.ndjson").open("w", encoding="utf-8")

        result = convert(alpha3, args.run_id, loaded_at, handle)
        if handle:
            handle.close()

        stages = ", ".join(f"{k}:{v:,}" for k, v in sorted(result["by_stage"].items()))
        derived = f"  ({result['derived_codes']:,} code(s) derived from name)" if result["derived_codes"] else ""
        print(f"{alpha3:<5}{result['entities_loaded']:>10,}{result['loaded']:>12,}"
              f"{result['summary_rows']:>9,}  {stages}{derived}")
        if result["skipped"]:
            for reason, count in sorted(result["skipped"].items()):
                print(f"{'':<5}  skipped {reason}: {count:,}")
        total += result["loaded"]

    print(f"\ntotal rows: {total:,} across {len(countries)} country(ies)")
    if not args.country:
        print("\nexcluded, with reasons:")
        for code, reason in sorted(EXCLUDED.items()):
            print(f"  {code}: {reason}")


if __name__ == "__main__":
    main()
