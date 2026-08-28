#!/usr/bin/env python3
"""Normalise national hospital registers into one owner-class dimension.

Reads the per-country provider registers already published under
website/data/countries/<cc>/providers.v1.json and maps each facility's native
legal-form string onto a controlled `owner_class` vocabulary.

The mapping is deliberately conservative: a legal form that does not reveal the
beneficial owner resolves to `unknown`, never to a guess. Countries where a
large share lands in `unknown` are reporting a real gap, not a bug.
"""
from __future__ import annotations

import json
import pathlib
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
COUNTRIES = ROOT / "data" / "countries"
OUT = ROOT / "data"

# owner_class vocabulary, ordered from most to least public
CLASSES = [
    "state",                    # central / federal government
    "regional",                 # region, county, state, canton, województwo, kraj
    "municipal",                # city, gmina, obec, local special district
    "subnational_unspecified",  # a subnational founder the source does not resolve
    "public_autonomous",        # autonomous public-law entity (FR EPS, NHS trust)
    "private_nonprofit",        # foundation, association, church, ESPIC
    "private_forprofit",        # company, proprietary, physician-owned
    "unknown",                  # legal form does not reveal the owner
]

MAP: dict[str, dict[str, str]] = {
    "USA": {
        "Government - Federal": "state",
        "Veterans Health Administration": "state",
        "Department of Defense": "state",
        "Tribal": "state",
        "Government - State": "regional",
        "Government - Local": "municipal",
        "Government - Hospital District or Authority": "municipal",
        "Voluntary non-profit - Private": "private_nonprofit",
        "Voluntary non-profit - Other": "private_nonprofit",
        "Voluntary non-profit - Church": "private_nonprofit",
        "Proprietary": "private_forprofit",
        "Physician": "private_forprofit",
    },
    "CZE": {
        "Státní příspěvková organizace": "state",
        "Státní podnik": "state",
        "Příspěvková organizace zřízená územním samosprávným celkem": "subnational_unspecified",
        "Evidované církevní právnické osoby": "private_nonprofit",
        "Církve a náboženské společnosti": "private_nonprofit",
        "Spolek": "private_nonprofit",
        "Pobočný spolek": "private_nonprofit",
        "Ústav": "private_nonprofit",
        "Obecně prospěšná společnost": "private_nonprofit",
        # A joint-stock or limited company may be wholly region-owned. The legal
        # form alone cannot tell; resolving it needs the ARES ownership chain.
        "Akciová společnost": "unknown",
        "Společnost s ručením omezeným": "unknown",
        "Evropská společnost": "unknown",
    },
    "FRA": {
        "Etablissement public de santé": "public_autonomous",
        "Etablissement de santé privé d'intérêt collectif": "private_nonprofit",
        "Etab de santé privé non lucratif, non déclar intérêt collect": "private_nonprofit",
        "Président du Conseil Départemental": "regional",
    },
    "GBR": {
        "NHS": "public_autonomous",
    },
}

# Native strings that are a financing or tariff mode rather than a legal form.
NOT_A_LEGAL_FORM = {
    "FRA": ("Non concerné", "indéterminé", "Indéterminé", "Etablissement Tarif Libre",
            "ARS", "DGS", "DGS ARS", "Tarifs conventionnels", "DG dotation"),
}


def classify(country: str, legal_form: str | None) -> str:
    if not legal_form:
        return "unknown"
    form = legal_form.strip()
    table = MAP.get(country, {})
    if form in table:
        return table[form]
    return "unknown"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    countries: dict[str, dict] = {}

    for path in sorted(COUNTRIES.glob("*/providers.v1.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        code = payload["country_code"]
        facilities = payload.get("facilities", [])

        counts: Counter[str] = Counter()
        unresolved: Counter[str] = Counter()
        for facility in facilities:
            form = facility.get("legal_form")
            owner = classify(code, form)
            counts[owner] += 1
            if owner == "unknown":
                unresolved[(form or "—").strip()] += 1

        total = len(facilities)
        resolved = total - counts["unknown"]
        countries[code] = {
            "coverage": payload.get("coverage"),
            "facility_count": total,
            "resolved_count": resolved,
            "resolved_share_pct": round(100 * resolved / total, 1) if total else 0.0,
            "owner_class": {k: counts[k] for k in CLASSES if counts[k]},
            "owner_class_pct": {
                k: round(100 * counts[k] / total, 1) for k in CLASSES if counts[k]
            },
            "unresolved_forms": [
                {"legal_form": form, "count": n}
                for form, n in unresolved.most_common(12)
            ],
        }

    # Czech accounting view: publicly controlled hospitals with a founder level.
    cz_health = json.loads(
        (ROOT / "data" / "cz-health-budget.v1.json").read_text(encoding="utf-8")
    )
    bench = cz_health["hospital_benchmark_2024"]
    level_map = {"Stát": "state", "Kraj": "regional", "Obec": "municipal"}
    by_level: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "revenue_mczk": 0.0})
    for hospital in bench["hospitals"]:
        key = level_map.get(hospital["owner_level"], "unknown")
        by_level[key]["count"] += 1
        by_level[key]["revenue_mczk"] += hospital["revenue_mczk"]
    revenue_total = sum(v["revenue_mczk"] for v in by_level.values())
    countries.setdefault("CZE", {})["accounting_view_2024"] = {
        "scope": bench["coverage"],
        "entity_count": bench["comparable_count"],
        "registered_count": bench["registered_count"],
        "revenue_total_mczk": round(revenue_total, 1),
        "by_owner_class": {
            k: {
                "count": v["count"],
                "revenue_mczk": round(v["revenue_mczk"], 1),
                "revenue_pct": round(100 * v["revenue_mczk"] / revenue_total, 1),
            }
            for k, v in sorted(by_level.items(), key=lambda kv: -kv[1]["revenue_mczk"])
        },
        "caveat_en": (
            "Contributory organisations only. Regional hospitals incorporated as "
            "joint-stock companies are excluded, which overstates the state share."
        ),
        "caveat_cs": (
            "Pouze příspěvkové organizace. Krajské nemocnice ve formě akciové "
            "společnosti chybí, což nadhodnocuje podíl státu."
        ),
    }

    doc = {
        "schema_version": "1.0.0",
        "generated_at": "2026-08-26",
        "dataset_id": "HOSPITAL_OWNERSHIP_V1",
        "vocabulary": CLASSES,
        "methodology": {
            "en": (
                "Each facility's native legal-form string is mapped onto one owner "
                "class. Forms that do not reveal the beneficial owner resolve to "
                "unknown rather than to a guess. Facility counts are not bed counts "
                "and not spending; they answer who operates, not who pays."
            ),
            "cs": (
                "Původní právní forma každého zařízení je namapována na jednu třídu "
                "vlastníka. Formy, které skutečného vlastníka neprozrazují, končí "
                "jako neznámé, nikoli jako odhad. Počty zařízení nejsou počty lůžek "
                "ani výdaje; odpovídají na otázku kdo provozuje, ne kdo platí."
            ),
        },
        "countries": countries,
    }
    (OUT / "hospital-ownership.v1.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    for code, entry in countries.items():
        if "facility_count" not in entry:
            continue
        print(f"{code}  n={entry['facility_count']:>6}  resolved={entry['resolved_share_pct']:>5.1f}%")
        for k, v in entry["owner_class"].items():
            print(f"      {k:<24} {v:>6}  {entry['owner_class_pct'][k]:>5.1f}%")


if __name__ == "__main__":
    main()
