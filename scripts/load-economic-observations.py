#!/usr/bin/env python3
"""Populate the sovereign fact store — the first real slice of B3.

The municipal side of this site moved from committed files to a warehouse and back out again as
generated artifacts. The sovereign side did not: 58 published artifacts are still bespoke
documents, each with its own shape, and `budget_detail.economic_observations` — a table designed
for exactly this, with country, indicator, period, value, unit and observation status — has been
sitting empty.

This loads the IMF World Economic Outlook series behind sovereign-benchmark.v1.json into it:
195 countries, 15 metrics, twenty years each. That artifact is the one most of the site's
comparative charts read, and it is one of only two sources anywhere on the site that names its
own edition — "World Economic Outlook, April 2026" — so it is the right thing to move first.

Two details the schema already has room for and the artifact carries:

  observation_status  Each value says whether it is an actual, an estimate or a projection.
                      Charting a projection as though it were an outturn is the single most
                      common way a fiscal chart misleads, and the distinction is in the data.
  source_series       The IMF's own indicator code — GGR_NGDP and the rest — kept beside our
                      metric_code so a figure can be traced back to the publisher's series.

Writes NDJSON only; `bq load` is a separate explicit step.

    python3 scripts/load-economic-observations.py --report
    python3 scripts/load-economic-observations.py --write out.ndjson
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
SOURCE = WEB / "lib/data/sovereign-benchmark.v1.json"

SOURCE_ID = "imf-weo-2026-04"
FREQUENCY = "annual"
TOPIC = "government_finance"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write NDJSON to this path")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--run-id", default=f"imf-weo-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}")
    args = parser.parse_args()

    if not SOURCE.exists():
        print(f"Missing {SOURCE}")
        return 1

    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    # The metric definitions carry the IMF's own indicator code and the unit; without them a
    # loaded value is a number with no stated meaning.
    metrics = {m["metric_code"]: m for m in payload.get("metrics", [])}
    source = payload.get("source") or {}
    edition = source.get("dataset")
    source_url = source.get("url") or ""
    # The table was designed with a vintage column, which is more than most of this site's
    # artifacts carry. The artifact names its edition, so it is recorded rather than left null.
    retrieved = source.get("extracted") or (payload.get("generated_at") or "")[:10] or "1970-01-01"

    loaded_at = datetime.now(timezone.utc).isoformat()
    handle = args.write.open("w", encoding="utf-8") if args.write else None

    written = 0
    countries: set[str] = set()
    per_status = Counter()
    per_metric = Counter()
    skipped = Counter()
    years: set[int] = set()

    for entry in payload.get("series", []):
        country = entry.get("country_code")
        if not country:
            skipped["no_country"] += 1
            continue
        for metric_code, block in (entry.get("metrics") or {}).items():
            definition = metrics.get(metric_code)
            if definition is None:
                skipped[f"unknown_metric:{metric_code}"] += 1
                continue
            for point in block.get("values") or []:
                year, value = point.get("year"), point.get("value")
                if year is None or value is None:
                    skipped["missing_year_or_value"] += 1
                    continue
                status = point.get("status") or "unknown"

                countries.add(country)
                per_status[status] += 1
                per_metric[metric_code] += 1
                years.add(int(year))

                observation = {
                    # An annual observation is dated at the year end it reports on, which keeps
                    # the partition column meaningful without inventing a finer date than exists.
                    "observation_date": f"{int(year)}-12-31",
                    "period": str(int(year)),
                    "frequency": FREQUENCY,
                    "country_code": country,
                    "indicator_code": metric_code,
                    "source_series": definition.get("imf_indicator"),
                    "source_key": f"{definition.get('imf_indicator')}.{country}.{int(year)}",
                    "topic": TOPIC,
                    "value": float(value),
                    "unit": definition.get("unit"),
                    "seasonal_adjustment": "not_applicable",
                    "transformation": "none",
                    # Actual, estimate or projection — the distinction that stops a forecast
                    # being read as an outturn.
                    "observation_status": status,
                    "source_id": SOURCE_ID,
                    "source_url": source_url,
                    "source_vintage": edition,
                    "retrieved_at": f"{retrieved}T00:00:00Z" if len(retrieved) == 10 else retrieved,
                    "quality_flags": [],
                    "loaded_at": loaded_at,
                }
                if handle:
                    handle.write(json.dumps(observation, ensure_ascii=False) + "\n")
                written += 1

    if handle:
        handle.close()

    print(f"edition: {edition}")
    print(f"observations: {written:,} across {len(countries)} countries and {len(per_metric)} metrics")
    print(f"years: {min(years)}–{max(years)}" if years else "years: none")
    print("by status:")
    for status, count in per_status.most_common():
        print(f"  {status:<14} {count:>8,}")
    if skipped:
        print("skipped: " + ", ".join(f"{k}={v:,}" for k, v in skipped.most_common(4)))

    if args.write:
        print(f"\nWrote {args.write}")
        print("Load it explicitly:")
        print(f"  bq load --source_format=NEWLINE_DELIMITED_JSON czbudget-janrezab:budget_detail."
              f"economic_observations {args.write}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
