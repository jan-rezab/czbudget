#!/usr/bin/env python3
"""Build compact, country-scoped browser shards from the normalized registries."""

from __future__ import annotations

import csv
import gzip
import json
import statistics
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "public-entities"
OUT = ROOT / "data" / "public-entity-directory"
GENERATED = "2026-08-23T20:12:23+02:00"
COUNTRIES = ["CZE", "POL", "DEU", "GBR", "FRA", "USA", "CHE", "SWE", "DNK", "UKR"]
FIELDS = [
    "record_id", "national_id", "name", "perimeter", "source_id", "period",
    "entity_class", "legal_form_native", "ownership_level", "ownership_share_pct",
    "controlling_authority", "status", "sector", "region", "body_count", "revenue",
    "operating_result", "net_result", "assets", "equity", "liabilities", "employees",
    "currency", "monetary_unit", "financial_period", "source_url", "notes",
]
DICTIONARY_FIELDS = {
    "perimeter", "source_id", "period", "entity_class", "legal_form_native",
    "ownership_level", "controlling_authority", "status", "sector", "region",
    "currency", "monetary_unit", "financial_period", "source_url",
}
NUMERIC_FIELDS = {
    "ownership_share_pct", "body_count", "revenue", "operating_result", "net_result",
    "assets", "equity", "liabilities", "employees",
}


def number(value):
    if value == "" or value is None:
        return None
    result = float(value)
    return int(result) if result.is_integer() else result


def ratio(values, numerator, denominator, scale=1):
    output = []
    for row in values:
        a, b = number(row[numerator]), number(row[denominator])
        if a is not None and b not in (None, 0):
            output.append(a / b * scale)
    return {
        "value": statistics.median(output) if output else None,
        "record_count": len(output),
    }


def build_country(code):
    with gzip.open(SOURCE / f"{code}.v1.csv.gz", "rt", encoding="utf-8", newline="") as handle:
        records = list(csv.DictReader(handle))

    dictionaries = {}
    indexes = {}
    for field in FIELDS:
        if field not in DICTIONARY_FIELDS:
            continue
        values = sorted({row[field] for row in records})
        dictionaries[field] = values
        indexes[field] = {value: index for index, value in enumerate(values)}

    packed = []
    for source_row in records:
        values = []
        for field in FIELDS:
            value = source_row[field]
            if field in DICTIONARY_FIELDS:
                values.append(indexes[field][value])
            elif field in NUMERIC_FIELDS:
                values.append(number(value))
            else:
                values.append(value or None)
        packed.append(values)

    financial = [
        row for row in records
        if any(row[field] != "" for field in ("revenue", "operating_result", "net_result", "assets", "employees"))
    ]
    diagnostics = {
        "net_margin_pct": ratio(financial, "net_result", "revenue", 100),
        "operating_margin_pct": ratio(financial, "operating_result", "revenue", 100),
        "return_on_assets_pct": ratio(financial, "net_result", "assets", 100),
        "revenue_per_employee": ratio(financial, "revenue", "employees"),
    }
    payload = {
        "schema_version": "1.0.0",
        "contract": "public-entity-directory.v1",
        "generated_at": GENERATED,
        "country_code": code,
        "fields": FIELDS,
        "dictionary_fields": sorted(DICTIONARY_FIELDS),
        "dictionaries": dictionaries,
        "records": packed,
        "summary": {
            "record_count": len(records),
            "represented_entity_count": sum(number(row["body_count"]) or 1 for row in records),
            "financial_record_count": len(financial),
            "perimeters": dict(sorted(Counter(row["perimeter"] for row in records).items())),
            "entity_classes": dict(Counter(row["entity_class"] for row in records).most_common()),
            "diagnostics": diagnostics,
        },
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{code}.v1.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {
        "country_code": code,
        "file": str(target.relative_to(ROOT)),
        "bytes": target.stat().st_size,
        **payload["summary"],
    }


def main():
    countries = [build_country(code) for code in COUNTRIES]
    manifest = {
        "schema_version": "1.0.0",
        "contract": "public-entity-directory-manifest.v1",
        "generated_at": GENERATED,
        "total_record_count": sum(item["record_count"] for item in countries),
        "countries": countries,
    }
    (OUT / "manifest.v1.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": manifest["total_record_count"], "bytes": sum(item["bytes"] for item in countries)}))


if __name__ == "__main__":
    main()
