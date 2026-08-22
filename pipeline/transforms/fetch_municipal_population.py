#!/usr/bin/env python3
"""Fetch the annual CZSO mid-year population series for Czech municipalities."""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import tempfile
import urllib.request
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
OUTPUT = ROOT / "data/source_cache/csu_municipal_population_2010_2025.csv"
API_URL = (
    "https://data.csu.gov.cz/api/dotaz/v1/data/sady/OBY01B01/vlastni"
    "?verzeSady=6&format=CSV&kodZvlast=true"
)
YEARS = [str(year) for year in range(2010, 2026)]
BODY = {
    "sloupce": [
        {"kodDimenze": "IndicatorType", "filtr": [{"zobrazitPolozky": ["9379W"]}]},
        {"kodDimenze": "CasR", "filtr": [{"zobrazitPolozky": YEARS}]},
        {"kodDimenze": "POHL2", "filtr": [{"zobrazitPolozky": ["0"]}]},
        {"kodDimenze": "UZ25", "filtr": []},
    ],
    "radky": [],
    "filtryTabulky": [],
}


def validate(content: bytes) -> dict[str, int]:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    required = {"IndicatorType", "CasR", "POHL2", "UZ25.OBEC", "Hodnota"}
    if not required.issubset(reader.fieldnames or []):
        raise RuntimeError(f"CZSO population CSV is missing columns: {sorted(required - set(reader.fieldnames or []))}")
    counts = {year: 0 for year in YEARS}
    for row in reader:
        if row["IndicatorType"] != "9379W" or row["POHL2"] != "0":
            raise RuntimeError("CZSO population CSV contains an unexpected indicator or sex filter")
        if row["UZ25.OBEC"] and row["Hodnota"] and row["CasR"] in counts:
            counts[row["CasR"]] += 1
    if min(counts.values()) < 6_240:
        raise RuntimeError(f"CZSO municipal population coverage is incomplete: {counts}")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Replace an existing cached extract")
    args = parser.parse_args()
    if OUTPUT.exists() and not args.refresh:
        content = OUTPUT.read_bytes()
    else:
        request = urllib.request.Request(
            API_URL,
            data=json.dumps(BODY, separators=(",", ":")).encode(),
            headers={"Accept-Language": "cs", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            content = response.read()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=OUTPUT.parent, delete=False) as temporary:
            temporary.write(content)
            temporary_path = Path(temporary.name)
        temporary_path.replace(OUTPUT)
    counts = validate(content)
    print(json.dumps({"path": str(OUTPUT), "bytes": len(content), "coverage": counts}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
