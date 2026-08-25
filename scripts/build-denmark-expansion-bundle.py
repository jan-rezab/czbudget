#!/usr/bin/env python3
"""Convert the normalized Denmark BUDK100/REGK100 census into web profiles."""

from __future__ import annotations

import gzip
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


WEB = Path(__file__).resolve().parents[1]
WORKSPACE = WEB.parent
SOURCE = WORKSPACE / "outputs/20260825-denmark-detail"
OUTPUT = WORKSPACE / "outputs/municipal-expansion/DNK.json"


def rows(path: Path):
    opener = gzip.open if path.suffix == ".gz" else path.open
    with opener(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def slugify(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-") or "municipality"


def main() -> None:
    entities_path = next(iter(sorted(SOURCE.glob("public_entities.jsonl*"))), None)
    facts_path = next(iter(sorted(SOURCE.glob("municipal_budget_line_facts.jsonl*"))), None)
    if not entities_path or not facts_path:
        raise FileNotFoundError(f"Complete Denmark import not found in {SOURCE}")
    profiles = {}
    for entity in rows(entities_path):
        code = entity["national_entity_code"]
        name = entity["entity_name"]
        profiles[entity["public_entity_id"]] = {
            "code": code, "name": name, "country": "DNK", "currency": "DKK",
            "years": [2025], "history": [{"year": 2025}], "detail": [],
            "url": f"/municipalities/denmark/{slugify(name)}-{code}/",
        }
    totals = defaultdict(lambda: defaultdict(float))
    for fact in rows(facts_path):
        entity_id = fact["public_entity_id"]
        profile = profiles.get(entity_id)
        if not profile:
            continue
        amount = float(fact["amount_local"])
        stage = fact["budget_stage"]
        side = fact["budget_side"]
        totals[entity_id][(stage, side)] += amount
        profile["detail"].append({
            "year": fact["fiscal_year"], "stage": stage, "side": side,
            "code": fact.get("functional_paragraph_code") or "",
            "name": fact.get("economic_item_code") or "", "amount": amount,
        })
    for entity_id, profile in profiles.items():
        history = profile["history"][0]
        # Prefer final accounts for the headline; adopted-budget rows remain in
        # full in the item table for a direct plan-versus-actual comparison.
        for stage in ("actual", "enacted"):
            if any((stage, side) in totals[entity_id] for side in ("revenue", "expenditure")):
                history["stage"] = stage
                # The authorized-account cube contains overlapping account
                # groupings and financing flows. Summing every published detail
                # row would create a misleading headline, so totals remain
                # explicitly absent while all native rows stay available below.
                break
        profile["detail"].sort(key=lambda row: (row["stage"], row["side"], row["code"], row["name"]))
    bundle = {
        "country": "DNK", "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "https://www.statbank.dk/BUDK100", "entities": sorted(profiles.values(), key=lambda row: row["name"].casefold()),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"country": "DNK", "entities": len(bundle["entities"]), "detail_rows": sum(len(row["detail"]) for row in bundle["entities"]), "output": str(OUTPUT)}))


if __name__ == "__main__":
    main()
