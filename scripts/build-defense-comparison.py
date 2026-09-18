#!/usr/bin/env python3
"""Build the cross-country military-spending comparison from the frozen SIPRI workbook.

One source, five measures, every current NATO member plus Ukraine, Russia, China and
the partner countries the defence deep dive already profiles. The workbook is pinned
by SHA-256: a changed hash stops the build rather than silently shipping a new vintage.

SIPRI marks its own estimates by font colour, so the flags travel with the numbers
instead of being flattened away. Aggregates apply today's NATO membership backwards
and record how many members actually reported in each year.
"""

from __future__ import annotations

import hashlib
import json
import urllib.request
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "data" / "sources" / "defense" / "SIPRI-Milex-data-1949-2025_v1.2.xlsx"
SOURCE_URL = "https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx"
SOURCE_SHA256 = "6cc3a30b1064f9f02e60236667eef82e08cad42910ce630909d004ad2c398a9d"
OUT = ROOT / "data" / "defense-comparison.v1.json"

FIRST_YEAR = 1990
LAST_YEAR = 2025

# SIPRI sheet name -> (measure id, rounding)
MEASURES = {
    "Constant (2024) US$": ("constant_usd", 1),
    "Current US$": ("current_usd", 1),
    "Share of GDP": ("gdp_share", 3),
    "Share of Govt. spending": ("govt_share", 3),
    "Per capita": ("per_capita", 1),
}
SHARE_MEASURES = {"gdp_share", "govt_share"}  # stored as fractions in the workbook

# SIPRI legend: blue font = SIPRI estimate, red font = highly uncertain.
COLOUR_STATUS = {"12": "estimate", "10": "uncertain"}
STATUS_CODE = {"estimate": "e", "uncertain": "u"}

# (SIPRI name, ISO3, flag, Czech, English, NATO accession year or None)
COUNTRIES = [
    ("United States of America", "USA", "us", "Spojené státy", "United States", 1949),
    ("Belgium", "BEL", "be", "Belgie", "Belgium", 1949),
    ("Canada", "CAN", "ca", "Kanada", "Canada", 1949),
    ("Denmark", "DNK", "dk", "Dánsko", "Denmark", 1949),
    ("France", "FRA", "fr", "Francie", "France", 1949),
    ("Iceland", "ISL", "is", "Island", "Iceland", 1949),
    ("Italy", "ITA", "it", "Itálie", "Italy", 1949),
    ("Luxembourg", "LUX", "lu", "Lucembursko", "Luxembourg", 1949),
    ("Netherlands", "NLD", "nl", "Nizozemsko", "Netherlands", 1949),
    ("Norway", "NOR", "no", "Norsko", "Norway", 1949),
    ("Portugal", "PRT", "pt", "Portugalsko", "Portugal", 1949),
    ("United Kingdom", "GBR", "gb", "Spojené království", "United Kingdom", 1949),
    ("Greece", "GRC", "gr", "Řecko", "Greece", 1952),
    ("Türkiye", "TUR", "tr", "Turecko", "Türkiye", 1952),
    ("Germany", "DEU", "de", "Německo", "Germany", 1955),
    ("Spain", "ESP", "es", "Španělsko", "Spain", 1982),
    ("Czechia", "CZE", "cz", "Česko", "Czechia", 1999),
    ("Hungary", "HUN", "hu", "Maďarsko", "Hungary", 1999),
    ("Poland", "POL", "pl", "Polsko", "Poland", 1999),
    ("Bulgaria", "BGR", "bg", "Bulharsko", "Bulgaria", 2004),
    ("Estonia", "EST", "ee", "Estonsko", "Estonia", 2004),
    ("Latvia", "LVA", "lv", "Lotyšsko", "Latvia", 2004),
    ("Lithuania", "LTU", "lt", "Litva", "Lithuania", 2004),
    ("Romania", "ROU", "ro", "Rumunsko", "Romania", 2004),
    ("Slovakia", "SVK", "sk", "Slovensko", "Slovakia", 2004),
    ("Slovenia", "SVN", "si", "Slovinsko", "Slovenia", 2004),
    ("Albania", "ALB", "al", "Albánie", "Albania", 2009),
    ("Croatia", "HRV", "hr", "Chorvatsko", "Croatia", 2009),
    ("Montenegro", "MNE", "me", "Černá Hora", "Montenegro", 2017),
    ("North Macedonia", "MKD", "mk", "Severní Makedonie", "North Macedonia", 2020),
    ("Finland", "FIN", "fi", "Finsko", "Finland", 2023),
    ("Sweden", "SWE", "se", "Švédsko", "Sweden", 2024),
    ("Russia", "RUS", "ru", "Rusko", "Russia", None),
    ("China", "CHN", "cn", "Čína", "China", None),
    ("Ukraine", "UKR", "ua", "Ukrajina", "Ukraine", None),
    ("Japan", "JPN", "jp", "Japonsko", "Japan", None),
    ("Brazil", "BRA", "br", "Brazílie", "Brazil", None),
    ("Switzerland", "CHE", "ch", "Švýcarsko", "Switzerland", None),
]

NORTH_AMERICA = {"USA", "CAN"}

AGGREGATES = [
    ("nato_total", "NATO celkem", "NATO total", lambda c: c["nato_member"]),
    ("nato_europe_canada", "NATO bez USA", "NATO without the US",
     lambda c: c["nato_member"] and c["code"] != "USA"),
    ("nato_europe", "Evropské státy NATO", "NATO's European members",
     lambda c: c["nato_member"] and c["code"] not in NORTH_AMERICA),
]


def ensure_source() -> bytes:
    """Return the pinned workbook bytes, downloading the frozen vintage once if absent."""
    if not SOURCE.exists():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "publicspendingdata.org data build"})
        with urllib.request.urlopen(request, timeout=120) as response:
            SOURCE.write_bytes(response.read())
    payload = SOURCE.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != SOURCE_SHA256:
        raise SystemExit(
            f"SIPRI workbook hash changed: {digest}.\n"
            "Review the new vintage and its terms before updating SOURCE_SHA256."
        )
    return payload


def read_sheet(book, sheet_name: str) -> tuple[dict[str, dict[int, float]], dict[str, dict[int, str]]]:
    """Return {country: {year: value}} and {country: {year: status}} for one SIPRI sheet."""
    sheet = book[sheet_name]
    rows = list(sheet.iter_rows())
    header = next(row for row in rows if row[0].value == "Country")
    year_columns = {cell.value: index for index, cell in enumerate(header) if isinstance(cell.value, int)}
    values: dict[str, dict[int, float]] = {}
    statuses: dict[str, dict[int, str]] = {}
    for row in rows:
        name = row[0].value
        if not isinstance(name, str):
            continue
        by_year, by_status = {}, {}
        for year in range(FIRST_YEAR, LAST_YEAR + 1):
            column = year_columns.get(year)
            if column is None:
                continue
            cell = row[column]
            if not isinstance(cell.value, (int, float)):
                continue  # "..." unavailable, "xxx" country did not exist
            by_year[year] = float(cell.value)
            colour = cell.font.color
            if colour and colour.type == "indexed":
                status = COLOUR_STATUS.get(str(colour.value))
                if status:
                    by_status[year] = status
        if by_year:
            values[name] = by_year
            statuses[name] = by_status
    return values, statuses


def country_notes(book) -> dict[str, str]:
    """The per-country note markers SIPRI prints beside each row (e.g. '§4')."""
    sheet = book["Constant (2024) US$"]
    rows = list(sheet.iter_rows(values_only=True))
    header = next(row for row in rows if row[0] == "Country")
    column = header.index("Notes")
    return {row[0]: str(row[column]).strip() for row in rows
            if isinstance(row[0], str) and row[column]}


def footnotes(book, names: set[str], markers: dict[str, str]) -> dict:
    """Keep the SIPRI symbol legend and the numbered notes our countries actually carry."""
    rows = list(book["Footnotes"].iter_rows(values_only=True))
    symbols = {str(row[0]): str(row[1]).strip() for row in rows
               if isinstance(row[0], str) and len(str(row[0])) == 1 and row[1]}
    used_numbers = set()
    for name, marker in markers.items():
        if name in names:
            used_numbers.update(part for part in "".join(
                char if char.isdigit() else " " for char in marker).split())
    numbered = {str(int(row[0])): str(row[2]).strip() for row in rows
                if isinstance(row[0], (int, float)) and row[2]
                and str(int(row[0])) in used_numbers}
    return {"symbols": symbols, "numbered": numbered}


def main() -> None:
    payload = ensure_source()
    book = load_workbook(SOURCE, data_only=True)
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    markers = country_notes(book)

    sheets = {}
    for sheet_name, (measure, _) in MEASURES.items():
        sheets[measure] = read_sheet(book, sheet_name)

    countries = []
    for sipri_name, code, flag, name_cs, name_en, nato_since in COUNTRIES:
        series, flags = {}, {}
        for sheet_name, (measure, digits) in MEASURES.items():
            values, statuses = sheets[measure]
            if sipri_name not in values:
                raise SystemExit(f"{sipri_name} missing from {sheet_name}")
            row, flag_row = values[sipri_name], statuses[sipri_name]
            scale = 100 if measure in SHARE_MEASURES else 1
            series[measure] = [
                round(row[year] * scale, digits) if year in row else None for year in years
            ]
            flags[measure] = "".join(
                STATUS_CODE.get(flag_row.get(year), "-") if year in row else "."
                for year in years
            )
        latest_year = next(
            (year for year in reversed(years) if series["constant_usd"][years.index(year)] is not None),
            None,
        )
        countries.append({
            "code": code, "name_cs": name_cs, "name_en": name_en, "flag": flag,
            "source_note": markers.get(sipri_name),
            "nato_member": nato_since is not None, "nato_since": nato_since,
            "bloc": ("nato_north_america" if code in NORTH_AMERICA else "nato_europe")
                    if nato_since is not None else "other",
            "latest_year": latest_year,
            "series": series,
            "flags": {measure: value for measure, value in flags.items() if set(value) - {"-", "."}},
        })

    by_code = {country["code"]: country for country in countries}
    aggregates = []
    for aggregate_id, label_cs, label_en, predicate in AGGREGATES:
        members = [country["code"] for country in countries if predicate(country)]
        totals = {measure: [] for measure in ("constant_usd", "current_usd", "gdp_share", "govt_share")}
        reporting = []
        for index in range(len(years)):
            present = [code for code in members if by_code[code]["series"]["constant_usd"][index] is not None]
            reporting.append(len(present))
            for measure in ("constant_usd", "current_usd"):
                values = [by_code[code]["series"][measure][index] for code in present]
                values = [value for value in values if value is not None]
                totals[measure].append(round(sum(values), 1) if values else None)
            # Combined share = combined spending over combined GDP, both at current prices.
            # GDP is implied by each country's own two SIPRI series, so the ratio stays internally
            # consistent. Countries reporting zero spending carry no implied GDP and drop out of
            # the denominator; only Iceland does so, at roughly 0.06% of NATO GDP.
            spending, product = 0.0, 0.0
            for code in present:
                current = by_code[code]["series"]["current_usd"][index]
                share = by_code[code]["series"]["gdp_share"][index]
                if not current or not share:
                    continue
                spending += current
                product += current / (share / 100)
            totals["gdp_share"].append(round(spending / product * 100, 3) if product else None)
            government = 0.0
            for code in present:
                current = by_code[code]["series"]["current_usd"][index]
                share = by_code[code]["series"]["govt_share"][index]
                if not current or not share:
                    continue
                government += current / (share / 100)
            totals["govt_share"].append(
                round(spending / government * 100, 3) if government else None
            )
        aggregates.append({
            "id": aggregate_id, "label_cs": label_cs, "label_en": label_en,
            "members": members, "member_count": len(members),
            "members_reporting": reporting,
            "complete_from": next(
                (years[index] for index in range(len(years)) if reporting[index] == len(members)), None
            ),
            "series": totals,
        })

    source = {
        "provider": "SIPRI",
        "title": "SIPRI Military Expenditure Database, April 2026 revision",
        "url": SOURCE_URL,
        "edition": "1949–2025 v1.2; revised 27 April 2026",
        "retrieved_at": date.today().isoformat(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "attribution": "© SIPRI 2026. Direct-source terms apply; the World Bank redistribution licence is not inherited.",
    }

    output = {
        "schema_version": "1.0.0",
        "dataset_id": "DEFENSE_COMPARISON_V1",
        "generated_at": date.today().isoformat(),
        "source": source,
        "years": years,
        "measures": {
            "constant_usd": {
                "unit": "million_usd_constant_2024", "scale": "millions",
                "label_cs": "Výdaje ve stálých cenách", "label_en": "Spending at constant prices",
                "note_cs": "Miliony USD ve stálých cenách a kurzech roku 2024. Vhodné pro srovnání v čase.",
                "note_en": "US$ millions at constant 2024 prices and exchange rates. Use this to compare across years.",
            },
            "current_usd": {
                "unit": "million_usd_current", "scale": "millions",
                "label_cs": "Výdaje v běžných cenách", "label_en": "Spending at current prices",
                "note_cs": "Miliony USD v běžných cenách a tržních kurzech daného roku.",
                "note_en": "US$ millions at the prices and market exchange rates of each year.",
            },
            "gdp_share": {
                "unit": "pct_gdp", "scale": "percent",
                "label_cs": "Podíl na HDP", "label_en": "Share of GDP",
                "note_cs": "Vojenské výdaje jako procento HDP.",
                "note_en": "Military expenditure as a percentage of GDP.",
            },
            "govt_share": {
                "unit": "pct_government_spending", "scale": "percent",
                "label_cs": "Podíl na výdajích státu", "label_en": "Share of government spending",
                "note_cs": "Vojenské výdaje jako procento celkových vládních výdajů.",
                "note_en": "Military expenditure as a percentage of total government spending.",
            },
            "per_capita": {
                "unit": "usd_constant_2024_per_person", "scale": "units",
                "label_cs": "Výdaje na obyvatele", "label_en": "Spending per person",
                "note_cs": "USD ve stálých cenách roku 2024 na obyvatele.",
                "note_en": "US$ at constant 2024 prices per inhabitant.",
            },
        },
        "commitments": {
            "nato_core_pct_gdp_2035": 3.5,
            "nato_broader_security_pct_gdp_2035": 1.5,
            "nato_total_pct_gdp_2035": 5.0,
            "legacy_nato_floor_pct_gdp": 2.0,
            "source_url": "https://www.nato.int/en/about-us/official-texts-and-resources/official-texts/2025/06/25/the-hague-summit-declaration",
        },
        "flag_legend": {
            "e": "SIPRI estimate (blue in the source workbook)",
            "u": "highly uncertain (red in the source workbook)",
            "-": "reported figure",
            ".": "no observation",
        },
        "countries": countries,
        "aggregates": aggregates,
        "footnotes": footnotes(book, {name for name, *_ in COUNTRIES}, markers),
    }

    OUT.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    latest = len(years) - 1
    total = next(a for a in aggregates if a["id"] == "nato_total")["series"]["current_usd"][latest]
    print(
        f"Wrote {OUT.relative_to(ROOT)}: {len(countries)} countries, {len(years)} years, "
        f"{OUT.stat().st_size / 1024:.0f} kB; NATO {years[latest]} = {total / 1000:.0f} bn USD"
    )


if __name__ == "__main__":
    main()
