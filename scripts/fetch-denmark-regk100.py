#!/usr/bin/env python3
"""Re-extract Denmark's municipal final accounts from statbank REGK100.

The cached extract was missing one side of most of the account plan. Aggregating Copenhagen
2025 by dranst gave 35,746.6m DKK of expenditure against 68,818.5m of income, so the accounts
missed by 33,072.0m and no headline built on them could be right.

Two dimensions explain it. DRANST has seven values and the old extract carried six — 6 Afdrag
på lån, loan repayments, is entirely expenditure and was absent. And ART is the side: UE
(bruttoudgifter) against I (indtægter). Requesting ART=UE,I across all seven dranst closes it —
Copenhagen 2025 comes to 68,818,554 out against 68,818,541 in, thirteen thousand kroner apart
on 68.8 billion, which is rounding.

It also shows the old extract was wrong beyond the missing side: its dranst 1 expenditure was
31,850.3m where the source says 55,925.2m.

Fetched one municipality at a time. The whole cube is 98 x 359 functions x 7 dranst x 2 sides
x 2 years, which no single request returns; per municipality it is about 10,000 cells.

    python3 scripts/fetch-denmark-regk100.py --report
    python3 scripts/fetch-denmark-regk100.py --fetch
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
WORKSPACE = WEB.parent
CACHE = WORKSPACE / "data/source_cache/municipal-expansion/DNK/REGK100"
DIRECTORY = WEB / "data/registry/municipal-entities/DNK.v1.json"
ENDPOINT = "https://api.statbank.dk/v1/data"
YEARS = ["2024", "2025"]
USER_AGENT = "publicspendingdata.org data pipeline (contact: info@hlidacstatu.cz)"


def municipalities() -> list[tuple[str, str]]:
    """The 98 municipalities the site publishes, from the entity directory."""
    payload = json.loads(DIRECTORY.read_text(encoding="utf-8"))
    return [(entry["code"], entry["name"]) for entry in payload["entities"]]


def request(code: str) -> str:
    body = json.dumps({
        "table": "REGK100",
        "format": "CSV",
        "valuePresentation": "Code",
        "delimiter": "Semicolon",
        "variables": [
            {"code": "OMRÅDE", "values": [code]},
            {"code": "FUNKTION", "values": ["*"]},
            {"code": "DRANST", "values": ["*"]},
            # The side. Omitting this is what lost every debit entry in dranst 4, 5 and 7.
            {"code": "ART", "values": ["UE", "I"]},
            {"code": "PRISENHED", "values": ["LOBM"]},
            {"code": "Tid", "values": YEARS},
        ],
    }).encode("utf-8")
    call = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    })
    with urllib.request.urlopen(call, timeout=120) as response:
        return response.read().decode("utf-8-sig")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="download; otherwise report only")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    entities = municipalities()
    if args.limit:
        entities = entities[: args.limit]

    missing = [(code, name) for code, name in entities if not (CACHE / f"{code}.csv.gz").exists()]
    print(f"{len(entities)} municipalities in the directory")
    print(f"{len(missing)} not cached")
    if not args.fetch:
        print("\nReport only. Pass --fetch to download.")
        return 0
    if not missing:
        print("Nothing to fetch.")
        return 0

    CACHE.mkdir(parents=True, exist_ok=True)
    fetched, failed = 0, []
    for index, (code, name) in enumerate(missing, 1):
        try:
            text = request(code)
        except Exception as error:  # noqa: BLE001 — one municipality must not lose the rest
            failed.append((code, name, str(error)))
            continue
        rows = text.count("\n")
        if rows < 2:
            failed.append((code, name, f"empty response ({rows} lines)"))
            continue
        with gzip.open(CACHE / f"{code}.csv.gz", "wt", encoding="utf-8") as handle:
            handle.write(text)
        fetched += 1
        if index % 10 == 0:
            print(f"  {index}/{len(missing)}", flush=True)
        # Statistics Denmark publishes no documented rate limit; one request per second is
        # what the other national fetchers here use and it is well inside anything reasonable.
        time.sleep(1.0)

    print(f"\ncached {fetched} municipalities")
    if failed:
        print(f"{len(failed)} failed:")
        for code, name, error in failed[:10]:
            print(f"  {code} {name}: {error}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
