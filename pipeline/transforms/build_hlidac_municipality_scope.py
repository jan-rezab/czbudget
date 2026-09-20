#!/usr/bin/env python3
"""Build the governed Hlídač státu scope for the 100 largest Czech municipalities."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data/municipal-snapshot.v1.json"
DEFAULT_OUTPUT = ROOT / "pipeline/config/czech-hlidac-municipalities.v1.json"
PLZEN_ICO = "00075370"


def build_scope(snapshot_path: Path, limit: int = 100) -> dict:
    source_bytes = snapshot_path.read_bytes()
    snapshot = json.loads(source_bytes)
    eligible = [
        municipality
        for municipality in snapshot["municipalities"]
        if municipality.get("national_id")
        and municipality.get("population", {}).get("value") is not None
    ]
    ranked = sorted(
        eligible,
        key=lambda municipality: (
            -int(municipality["population"]["value"]),
            municipality["national_id"],
        ),
    )[:limit]
    reference_dates = {
        municipality["population"].get("reference_date") for municipality in ranked
    }
    source_ids = {municipality["population"].get("source_id") for municipality in ranked}
    if len(reference_dates) != 1 or None in reference_dates:
        raise ValueError(f"top municipalities do not share one population date: {reference_dates}")
    if len(source_ids) != 1 or None in source_ids:
        raise ValueError(f"top municipalities do not share one population source: {source_ids}")

    municipalities = []
    for rank, municipality in enumerate(ranked, 1):
        ico = str(municipality["national_id"]).zfill(8)
        municipalities.append(
            {
                "rank": rank,
                "ico": ico,
                "name": municipality["short_name"],
                "legal_name": municipality["name"],
                "population": int(municipality["population"]["value"]),
                "municipality_code": municipality["territory"]["municipality_code"],
                "region_name": municipality["territory"]["region_name"],
                "psd_path": municipality["seo"]["path"],
                "hlidac_query": f"icoPlatce:{ico}",
                "rollout_status": "existing_baseline" if ico == PLZEN_ICO else "queued",
                "existing_contract_data": (
                    "data/contracts/00075370.v1.json" if ico == PLZEN_ICO else None
                ),
            }
        )

    return {
        "schema_version": "1.0.0",
        "selection": {
            "method": "top_100_by_population_desc_then_ico",
            "count": limit,
            "population_reference_date": next(iter(reference_dates)),
            "population_source_id": next(iter(source_ids)),
            "source_path": "data/municipal-snapshot.v1.json",
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        },
        "integration_policy": {
            "role": "thin_source_adapter",
            "api_only": True,
            "html_scraping": False,
            "endpoint": "https://api.hlidacstatu.cz/api/v2/smlouvy/hledat",
            "documentation": "https://www.hlidacstatu.cz/api/v1/doc",
            "authentication_environment_variable": "HLIDACSTATU_API_TOKEN",
            "minimum_request_interval_seconds": 0.5,
            "refresh": "incremental_publication_date_windows_with_checkpoints",
            "license": "CC BY 3.0",
            "attribution": "Zdroj: Hlídač státu (hlidacstatu.cz)",
            "product_boundary": "PSD adds budget context, comparisons and analysis; it does not reproduce Hlídač státu as a general-purpose search product.",
        },
        "municipalities": municipalities,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")
    payload = build_scope(args.input, args.limit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "count": len(payload["municipalities"]),
                "population_reference_date": payload["selection"]["population_reference_date"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
