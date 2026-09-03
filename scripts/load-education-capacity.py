#!/usr/bin/env python3
"""Load comparable education-capacity observations for the site's core countries.

Eurostat UOE supplies harmonised learner and teaching measures. Official
institution-register counts are joined from education-institutions.v1.json.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WEB = Path(os.environ.get("CZBUDGET_WEBSITE_ROOT", Path(__file__).resolve().parents[1])).resolve()
OUTPUT = WEB / "data/education-capacity-international.v1.json"
INSTITUTIONS = WEB / "data/education-institutions.v1.json"
EUROSTAT_API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"
REFERENCE_YEAR = "2024"
USER_AGENT = "PublicSpendingData/1.0 education-capacity-loader"

COUNTRIES = [
    ("CZE", "CZ", "Česko", "Czechia"),
    ("CHE", "CH", "Švýcarsko", "Switzerland"),
    ("SWE", "SE", "Švédsko", "Sweden"),
    ("DNK", "DK", "Dánsko", "Denmark"),
    ("FIN", "FI", "Finsko", "Finland"),
    ("NOR", "NO", "Norsko", "Norway"),
]

LEVELS = [
    ("preprimary", "Předškolní", "Pre-primary", "ISCED 02", ("ED02",)),
    ("primary", "Primární", "Primary", "ISCED 1", ("ED1",)),
    ("lower_secondary", "Nižší sekundární", "Lower secondary", "ISCED 2", ("ED2",)),
    ("upper_secondary", "Vyšší sekundární", "Upper secondary", "ISCED 3", ("ED3",)),
    ("tertiary", "Terciární", "Tertiary", "ISCED 5–8", ("ED5", "ED6", "ED7", "ED8")),
]


def fetch(dataset: str, parameters: dict[str, Any]) -> tuple[dict[str, Any], str]:
    query = urllib.parse.urlencode(parameters, doseq=True)
    url = f"{EUROSTAT_API}/{dataset}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response), url
        except Exception as error:  # pragma: no cover - retry path depends on network
            last_error = error
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError(last_error)


def category_position(payload: dict[str, Any], dimension: str, code: str) -> int | None:
    index = payload["dimension"][dimension]["category"]["index"]
    if isinstance(index, dict):
        return index.get(code)
    try:
        return index.index(code)
    except ValueError:
        return None


def observation(payload: dict[str, Any], coordinates: dict[str, str]) -> tuple[float | None, str | None]:
    """Return one value and its Eurostat observation-status flag from JSON-stat."""
    flat_index = 0
    stride = 1
    for dimension, size in zip(reversed(payload["id"]), reversed(payload["size"])):
        categories = payload["dimension"][dimension]["category"]["index"]
        default = next(iter(categories)) if isinstance(categories, dict) else categories[0]
        position = category_position(payload, dimension, coordinates.get(dimension, default))
        if position is None:
            return None, None
        flat_index += position * stride
        stride *= size
    key = str(flat_index)
    value = payload.get("value", {}).get(key)
    status = payload.get("status", {}).get(key)
    return (float(value) if value is not None else None), status


def sum_components(payload: dict[str, Any], coordinates: dict[str, str], codes: tuple[str, ...]) -> tuple[float | None, list[str]]:
    values: list[float] = []
    flags: list[str] = []
    for code in codes:
        value, status = observation(payload, {**coordinates, "isced11": code})
        if value is not None:
            values.append(value)
        if status:
            flags.append(f"{code}:{status}")
    return (sum(values) if values else None), flags


def rounded(value: float | None) -> float | int | None:
    if value is None:
        return None
    if abs(value - round(value)) < 1e-9:
        return int(round(value))
    return round(value, 2)


def atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(content)
    temporary.replace(path)
    path.chmod(0o644)


def main() -> None:
    institution_data = json.loads(INSTITUTIONS.read_text(encoding="utf-8"))
    institutions_by_country = {country["code"]: country for country in institution_data["countries"]}
    if set(institutions_by_country) != {country[0] for country in COUNTRIES}:
        raise RuntimeError("Institution source must cover all six core countries")
    geos = [country[1] for country in COUNTRIES]
    common = {"lang": "en", "time": REFERENCE_YEAR, "geo": geos, "sector": "TOT_SEC", "sex": "T"}
    early_headcount, early_headcount_url = fetch("educ_uoe_enrp01", {**common, "worktime": "TOTAL"})
    early_fte, early_fte_url = fetch("educ_uoe_enrp01", {**common, "worktime": "TOT_FTE"})
    enrolment_headcount, enrolment_headcount_url = fetch("educ_uoe_enra01", {**common, "worktime": "TOTAL"})
    enrolment_fte, enrolment_fte_url = fetch("educ_uoe_enra01", {**common, "worktime": "TOT_FTE"})
    teacher_fte, teacher_fte_url = fetch("educ_uoe_perp02", {**common, "worktime": "TOT_FTE"})
    ratios, ratio_url = fetch("educ_uoe_perp04", {"lang": "en", "time": REFERENCE_YEAR, "geo": geos})

    country_rows = []
    for code, geo, name_cs, name_en in COUNTRIES:
        level_rows = []
        for level_id, label_cs, label_en, isced, components in LEVELS:
            coordinates = {"geo": geo}
            if level_id == "preprimary":
                learner_headcount, headcount_flags = sum_components(early_headcount, coordinates, components)
                learner_fte, learner_fte_flags = sum_components(early_fte, coordinates, components)
            else:
                learner_headcount, headcount_flags = sum_components(enrolment_headcount, coordinates, components)
                learner_fte, learner_fte_flags = sum_components(enrolment_fte, coordinates, components)
            teacher_code = "ED5-8" if level_id == "tertiary" else components[0]
            teachers, teacher_status = observation(teacher_fte, {**coordinates, "isced11": teacher_code})
            ratio, ratio_status = observation(ratios, {**coordinates, "isced11": teacher_code})
            ratio_provenance = "published"
            if ratio is None and learner_fte is not None and teachers is not None and teachers > 0:
                ratio = learner_fte / teachers
                ratio_provenance = "derived_from_eurostat_fte"
            flags = headcount_flags + learner_fte_flags
            if teacher_status:
                flags.append(f"teacher_fte:{teacher_status}")
            if ratio_status:
                flags.append(f"ratio:{ratio_status}")
            level_rows.append({
                "id": level_id,
                "label_cs": label_cs,
                "label_en": label_en,
                "isced": isced,
                "learners_headcount": rounded(learner_headcount),
                "learners_fte": rounded(learner_fte),
                "teaching_fte": rounded(teachers),
                "learners_per_teaching_fte": rounded(ratio),
                "ratio_provenance": ratio_provenance,
                "schools_or_institutions": institutions_by_country[code]["counts"][level_id],
                "institutions_period": institutions_by_country[code]["period"],
                "observation_flags": sorted(set(flags)),
            })
        metric_counts = {
            metric: sum(row[metric] is not None for row in level_rows)
            for metric in ("learners_headcount", "learners_fte", "teaching_fte", "learners_per_teaching_fte", "schools_or_institutions")
        }
        country_rows.append({
            "code": code,
            "eurostat_geo": geo,
            "name_cs": name_cs,
            "name_en": name_en,
            "period": REFERENCE_YEAR,
            "levels": level_rows,
            "coverage": metric_counts,
            "institution_source": {
                key: institutions_by_country[code][key]
                for key in ("period", "source_title", "source_url", "definition")
            },
        })

    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "education-capacity-international",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": REFERENCE_YEAR,
        "country_count": len(country_rows),
        "level_count": len(LEVELS),
        "countries": country_rows,
        "methodology": {
            "classification": "ISCED 2011",
            "institution_scope": "All public and private institutions (Eurostat sector TOT_SEC)",
            "learner_headcount": "Students with working-time category TOTAL; tertiary is the sum of ISCED 5, 6, 7 and 8.",
            "learner_fte": "Students with working-time category TOT_FTE; tertiary is the sum of ISCED 5, 6, 7 and 8.",
            "teaching_fte": "Classroom teachers at ISCED 02–3 and academic staff at ISCED 5–8, working-time category TOT_FTE.",
            "ratio": "Eurostat's published ratio where available. When withheld, the ratio is derived from the same Eurostat learner-FTE and teaching-FTE observations and explicitly marked.",
            "school_counts": "Official register counts joined by ISCED level. They are not a harmonised UOE indicator; definitions, periods and cross-level double-counting are preserved per source.",
        },
        "sources": [
            {"dataset": "educ_uoe_enrp01", "title": "Pupils enrolled in early childhood education", "requests": [early_headcount_url, early_fte_url]},
            {"dataset": "educ_uoe_enra01", "title": "Pupils and students enrolled by education level", "requests": [enrolment_headcount_url, enrolment_fte_url]},
            {"dataset": "educ_uoe_perp02", "title": "Classroom teachers and academic staff by employment status", "requests": [teacher_fte_url]},
            {"dataset": "educ_uoe_perp04", "title": "Ratio of pupils and students to teachers and academic staff", "requests": [ratio_url]},
            {"dataset": "education-institutions", "title": "Official national and GISCO institution registers", "requests": [country["source_url"] for country in institution_data["countries"]]},
        ],
    }
    atomic_json(OUTPUT, payload)
    print(f"Wrote {OUTPUT} with {len(country_rows)} countries × {len(LEVELS)} levels")
    for country in country_rows:
        coverage = country["coverage"]
        print(
            f"  {country['code']}: learners {coverage['learners_headcount']}/5, "
            f"teacher FTE {coverage['teaching_fte']}/5, ratios {coverage['learners_per_teaching_fte']}/5, "
            f"institutions {coverage['schools_or_institutions']}/5"
        )


if __name__ == "__main__":
    main()
