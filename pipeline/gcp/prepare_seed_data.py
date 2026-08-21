#!/usr/bin/env python3
"""Convert the reviewed source registry into BigQuery newline-delimited JSON."""

from __future__ import annotations

import os

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
REGISTRY_PATH = ROOT / "data/international_fiscal_source_registry.json"
OUTPUT_DIR = ROOT / "gcp/seed"
WEB_CATALOG_PATH = ROOT / "website/data/catalog.v1.json"


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
    return f"{normalized[:48]}-{digest}"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
loaded_at = datetime.now(timezone.utc).isoformat()
countries = []
sources = []

for country in registry["countries"]:
    countries.append(
        {
            "country_code": country["country_code"],
            "name_cs": country["name_cs"],
            "name_en": country["name_en"],
            "currency_code": country["currency_code"],
            "role": country["role"],
            "national_scope": country.get("national_scope"),
            "benchmark_reason": country.get("benchmark_reason"),
            "benchmark_evidence_url": country.get("benchmark_evidence_url"),
            "loaded_at": loaded_at,
        }
    )
    for source in country["sources"]:
        sources.append(
            {
                "source_id": f"{country['country_code'].lower()}-{slug(source['name'])}",
                "country_code": country["country_code"],
                "source_name": source["name"],
                "source_url": source["url"],
                "coverage": source.get("coverage"),
                "formats": source.get("formats", []),
                "purpose": source.get("purpose"),
                "active": True,
                "loaded_at": loaded_at,
            }
        )

write_jsonl(OUTPUT_DIR / "countries.jsonl", countries)
write_jsonl(OUTPUT_DIR / "source_registry.jsonl", sources)
catalog_payload = {
            "schema_version": "1.0.0",
            "generated_at": loaded_at,
            "dataset": "czbudget-janrezab.budget_detail",
            "detail_status": "source_verified",
            "detail_rows_loaded": 0,
            "countries": [
                {
                    **country,
                    "sources": [source for source in sources if source["country_code"] == country["country_code"]],
                    "ingestion_status": "source_verified",
                }
                for country in countries
            ],
            "tables": [
                "raw_budget_lines",
                "classification_versions",
                "budget_nodes",
                "budget_amounts",
                "canonical_categories",
                "budget_mappings",
                "ingestion_runs",
                "public_entities",
                "public_entity_sources",
                "public_entity_budget_headlines",
                "municipal_budget_line_facts",
                "public_entity_balance_sheet_facts",
                "public_entity_cash_facts",
                "public_entity_metric_observations",
            ],
            "stages": ["proposal", "enacted", "revised", "actual"],
            "sides": ["revenue", "expenditure"],
}
for catalog_path in (WEB_CATALOG_PATH,):
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(
        json.dumps(catalog_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
print(f"Prepared {len(countries)} countries and {len(sources)} sources")
