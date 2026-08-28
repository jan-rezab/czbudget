#!/usr/bin/env python3
"""Publish current French commune summaries from OFGL's official aggregate base.

The raw DGFiP balances contain overlapping accounting flows and are deliberately not
summed into headline budgets. OFGL publishes the defensible commune aggregates used
here. Rows for predecessor communes are summed when OFGL maps several of them to one
current INSEE code after a merger.
"""

from __future__ import annotations

import argparse
import csv
import json
import tempfile
import urllib.request
from collections import defaultdict
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "data/international-municipalities.v1.json"
PROFILE_DIR = ROOT / "data/france-municipal-profiles"
SOURCE_PAGE = "https://data.ofgl.fr/explore/dataset/ofgl-base-communes/"
REGION_SOURCE = "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-regions-/"
EXPORT_URL = (
    "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/"
    "ofgl-base-communes/exports/csv?select=exer%2Ccom_code%2Ccom_name%2Creg_code%2C"
    "reg_name%2Cdep_code%2Cdep_name%2Cptot%2Cpresence_budget%2Cagregat%2Cmontant&"
    "where=year%28exer%29%3E%3D2024%20and%20cbudg%3D%221%22%20and%20agregat%20in%20"
    "%28%22Recettes%20totales%22%2C%22D%C3%A9penses%20totales%22%2C%22Recettes%20de%20"
    "fonctionnement%22%2C%22D%C3%A9penses%20de%20fonctionnement%22%2C%22Encours%20de%20"
    "dette%22%2C%22Epargne%20brute%22%29&use_labels=false"
)

AGGREGATES = {
    "Recettes totales": "revenue",
    "Dépenses totales": "expenditure",
    "Recettes de fonctionnement": "operating_revenue",
    "Dépenses de fonctionnement": "operating_expenditure",
    "Encours de dette": "debt",
    "Epargne brute": "gross_savings",
}


def number(value: Decimal | None):
    if value is None:
        return None
    value = value.quantize(Decimal("0.01"))
    return int(value) if value == value.to_integral() else float(value)


def department_for(code: str) -> str:
    if code.startswith(("971", "972", "973", "974", "976")):
        return code[:3]
    return code[:2]


def approved_budgets() -> dict[str, dict]:
    config = json.loads((ROOT / "pipeline/config/international_municipal_sources.json").read_text())
    result = {}
    for source in config["countries"]["FRA"]["sources"]:
        if source.get("collection") != "budget" or not source.get("city_code"):
            continue
        result[str(source["city_code"])] = {
            "approved_budget_year": int(source["year"]),
            "approved_budget_url": source["url"],
        }
    return result


def download() -> Path:
    handle = tempfile.NamedTemporaryFile(prefix="ofgl-france-", suffix=".csv", delete=False)
    path = Path(handle.name)
    handle.close()
    request = urllib.request.Request(EXPORT_URL, headers={"User-Agent": "PublicSpendingData/1.0"})
    with urllib.request.urlopen(request, timeout=300) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-file", type=Path, help="Previously downloaded OFGL CSV export")
    args = parser.parse_args()
    source = args.source_file or download()

    totals: dict[tuple[int, str], dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    identities: dict[tuple[int, str], dict] = {}
    with source.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        required = {"exer", "com_code", "com_name", "reg_name", "dep_code", "dep_name", "ptot", "agregat", "montant"}
        if not required.issubset(reader.fieldnames or []):
            raise SystemExit(f"Unexpected OFGL columns: {reader.fieldnames}")
        for row in reader:
            aggregate = AGGREGATES.get(row["agregat"])
            code = row["com_code"].strip()
            if not aggregate or not code or not row["montant"]:
                continue
            year = int(row["exer"][:4])
            key = (year, code)
            totals[key][aggregate] += Decimal(row["montant"])
            identity = identities.setdefault(key, {
                "code": code, "name": row["com_name"].strip(), "region": row["reg_name"].strip(),
                "department": row["dep_name"].strip(), "department_code": row["dep_code"].strip(),
                "population": Decimal(0),
            })
            # Each predecessor contributes six aggregate rows; count its population once.
            if row["agregat"] == "Recettes totales":
                identity["population"] += Decimal(row["ptot"] or "0")

    approved = approved_budgets()
    codes = sorted({code for _, code in totals})
    years_by_code = defaultdict(list)
    for year, code in totals:
        years_by_code[code].append(year)
    profiles = {}
    for code in codes:
        history = []
        years = sorted(years_by_code[code])
        identity = identities[(years[-1], code)]
        for year in years:
            values = totals[(year, code)]
            if not {"revenue", "expenditure"}.issubset(values):
                continue
            row = {"year": year}
            for field in AGGREGATES.values():
                if field in values:
                    row[field] = number(values[field])
            row["balance"] = number(values["revenue"] - values["expenditure"])
            history.append(row)
        if not history:
            continue
        latest = history[-1]
        source_url = f"{SOURCE_PAGE}?refine.com_code={code}"
        profile = {
            "code": code, "name": identity["name"], "region": identity["region"],
            "department": identity["department"], "department_code": identity["department_code"],
            "currency": "EUR", "population": int(identity["population"]),
            "years": [row["year"] for row in history], "history": history,
            "source_url": source_url, "region_source_url": REGION_SOURCE,
        }
        profile.update(approved.get(code, {}))
        profiles[code] = profile

    if len(profiles) < 34_000:
        raise SystemExit(f"OFGL export produced only {len(profiles)} commune profiles")

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    for stale in PROFILE_DIR.glob("*.v1.json"):
        stale.unlink()
    shards = defaultdict(dict)
    for code, profile in profiles.items():
        shards[department_for(code)][code] = profile
    for department, rows in sorted(shards.items()):
        payload = {
            "schema_version": "1.0.0", "generated_at": "2026-08-28",
            "country": {"code": "FRA", "currency": "EUR"},
            "source": SOURCE_PAGE, "profiles": rows,
        }
        (PROFILE_DIR / f"{department}.v1.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )

    directory = json.loads(DIRECTORY.read_text(encoding="utf-8"))
    directory["entities"] = [row for row in directory["entities"] if row["country"] != "FRA"]
    entities = []
    for code, profile in profiles.items():
        latest = profile["history"][-1]
        entities.append({
            "id": f"FR:{code}", "country": "FRA", "code": code, "name": profile["name"],
            "region": profile["region"], "currency": "EUR", "years": profile["years"],
            "revenue": latest["revenue"], "expenditure": latest["expenditure"],
            "balance": latest["balance"], "population": profile["population"],
        })
    directory["entities"].extend(entities)
    order = {country["code"]: index for index, country in enumerate(directory["countries"])}
    directory["entities"].sort(key=lambda row: (order.get(row["country"], 999), row["name"].casefold(), row["code"]))
    coverage = next(country for country in directory["countries"] if country["code"] == "FRA")
    counts = {str(year): sum(year in profile["years"] for profile in profiles.values()) for year in (2024, 2025)}
    coverage.update({
        "years": [2024, 2025], "counts": counts, "stages": ["actual"],
        "measures": ["revenue", "expenditure", "balance", "debt"],
        "coverage_cs": "Všech 34 875 současných obcí; hlavní rozpočet, oficiální souhrny OFGL; 2025 je předběžný a u 97 obcí zatím chybí",
        "coverage_en": "All 34,875 current communes; main-budget official OFGL aggregates; 2025 is provisional and not yet available for 97 communes",
        "status": "complete", "source": SOURCE_PAGE, "regional_source": REGION_SOURCE,
        "entity_source_url_prefix": f"{SOURCE_PAGE}?refine.com_code=",
        "source_detail": {"publisher": "Observatoire des Finances et de la Gestion publique Locales (OFGL)", "dataset": "OFGL - Base communes", "scope": "Main-budget executed-account aggregates", "period": "2024–2025; 2025 provisional"},
        "directory_count": len(entities), "provisional_year": 2025,
        "latest_year_missing_count": len(entities) - counts["2025"],
    })
    coverage.pop("missing_dimensions", None)
    coverage.pop("coverage_note_en", None)
    coverage.pop("coverage_note_cs", None)
    DIRECTORY.write_text(json.dumps(directory, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(profiles):,} commune profiles in {len(shards)} department shards; {counts['2025']:,} include 2025")


if __name__ == "__main__":
    main()
