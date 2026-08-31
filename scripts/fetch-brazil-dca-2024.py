#!/usr/bin/env python3
"""Fetch the 2024 DCA annual accounts for the municipalities that report on them.

44 of Brazil's 5,570 municipalities file no RREO Annex 01, so their profile falls back to the
2024 Declaração de Contas Anuais — annexes I-C for revenue and I-D for expenditure. Those
files were never cached, which is why the warehouse cannot reproduce their published revenue
and why data/municipal-expansion/bra, at 271.7 MB, cannot be retired.

This fetches only the entities that need it. The pacing helper is imported from the importer
rather than reimplemented, so this shares SICONFI's one-request-per-second lock with anything
else running against the same cache instead of racing it.

    python3 scripts/fetch-brazil-dca-2024.py --report
    python3 scripts/fetch-brazil-dca-2024.py --fetch
"""
from __future__ import annotations

import argparse
import gzip
import importlib.util
import json
import sys
import urllib.parse
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
WORKSPACE = WEB.parent
CACHE = WORKSPACE / "data/source_cache/municipal-expansion"
FANOUT = WEB / "data/municipal-expansion/bra"
BASE = "https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt"
ANNEXES = {"I-C": "DCA-Anexo I-C", "I-D": "DCA-Anexo I-D"}


def importer():
    """Load the importer for its paced request helper, hyphenated filename and all."""
    spec = importlib.util.spec_from_file_location("municipal_expansion_importer", WEB / "scripts/import-municipal-expansion.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def entities_on_dca() -> list[str]:
    """Municipalities whose published profile leads with a 2024 figure."""
    codes = []
    for path in sorted(FANOUT.glob("*.json")):
        profile = json.loads(path.read_text(encoding="utf-8"))
        for entry in profile.get("history", []):
            if entry.get("year") == 2024 and (entry.get("revenue") is not None or entry.get("expenditure") is not None):
                codes.append(profile["code"])
                break
    return codes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="download; otherwise only report what is missing")
    parser.add_argument("--report", action="store_true", help="report only (the default)")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    codes = entities_on_dca()
    if args.limit:
        codes = codes[: args.limit]

    missing = []
    for code in codes:
        for key, annex in ANNEXES.items():
            cache = CACHE / f"BRA/DCA-2024-{key}" / f"{code}.json.gz"
            if not cache.exists():
                missing.append((code, key, annex, cache))

    print(f"{len(codes)} municipalities report on the 2024 DCA")
    print(f"{len(missing)} of {len(codes) * len(ANNEXES)} annex files are not cached")
    if not args.fetch:
        print("\nReport only. Pass --fetch to download.")
        return 0
    if not missing:
        print("Nothing to fetch.")
        return 0

    module = importer()
    print(f"fetching at SICONFI's one request per second — about {len(missing)} seconds\n")

    fetched = 0
    failed = []
    for index, (code, key, annex, cache) in enumerate(missing, 1):
        params = urllib.parse.urlencode({"an_exercicio": 2024, "no_anexo": annex, "id_ente": code})
        try:
            payload = module.paced_request_json(f"{BASE}/dca?{params}")
        except Exception as error:  # noqa: BLE001 — one entity failing must not lose the rest
            failed.append((code, key, str(error)))
            continue
        cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(cache, "wt", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
        fetched += 1
        if index % 10 == 0:
            print(f"  {index}/{len(missing)}", flush=True)

    print(f"\ncached {fetched} annex files")
    if failed:
        print(f"{len(failed)} failed:")
        for code, key, error in failed[:10]:
            print(f"  {code} {key}: {error}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
