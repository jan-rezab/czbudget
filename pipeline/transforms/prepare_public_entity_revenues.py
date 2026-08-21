#!/usr/bin/env python3
"""Build an auditable 2006-2025 public-entity revenue inventory.

The inventory intentionally separates entity coverage from financial-statement
coverage.  Missing values are never converted to zero.
"""

from __future__ import annotations

import os

import csv
import io
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path


WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
SOURCE_DIR = WORKSPACE / "outputs" / "20260820-public-entity-revenues" / "sources"
OUTPUT_PATH = WORKSPACE / "data" / "public_entity_revenues_2006_2025.json"
YEARS = list(range(2006, 2026))

COMPANY_LEGAL_FORMS = {
    "Akciová společnost",
    "Společnost s ručením omezeným",
    "Státní podnik",
    "Národní podnik",
    "Družstvo",
    "Společnost komanditní",
    "Komanditní společnost",
    "Státní organizace Správa železnic",
    "Správa železniční dopravní cesty, státní organizace",
}
COMPANY_FORM_CODES = {
    "111", "112", "113", "114", "115", "121", "131", "201", "205",
    "211", "231", "232", "233", "234", "241", "242", "301", "302",
    "341", "343", "351", "352", "411", "431", "435", "436", "437", "438",
}


def norm_ico(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits.zfill(8)[-8:] if digits else ""


def parse_amount(value: str | None) -> float:
    text = (value or "").strip().replace(" ", "").replace("\u00a0", "").replace(",", ".")
    if not text:
        return 0.0
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    number = float(text)
    return -number if negative else number


def load_form_labels() -> dict[str, str]:
    result: dict[str, str] = {}
    with (SOURCE_DIR / "CIS_FORMA.CSV").open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=";")
        next(reader, None)
        for row in reader:
            if len(row) >= 2:
                result[row[0].strip()] = row[1].strip()
    return result


def load_accounting_units() -> dict[int, dict[str, dict]]:
    """Return year -> IČO -> accounting-unit attributes valid at year end."""
    by_year: dict[int, dict[str, dict]] = {year: {} for year in YEARS}
    path = SOURCE_DIR / "CIS_UCJED.CSV"
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=";")
        next(reader, None)
        rows = list(reader)

    for year in YEARS:
        ref = f"{year}1231"
        selected: dict[str, tuple[str, dict]] = {}
        for row in rows:
            if len(row) < 35:
                continue
            valid_to, valid_from = row[1].strip(), row[2].strip()
            if not (valid_from <= ref <= valid_to):
                continue
            ico = norm_ico(row[3])
            if not ico:
                continue
            item = {
                "ico": ico,
                "name": row[34].strip(),
                "valid_from": valid_from,
                "valid_to": valid_to,
                "founder_unit": row[9].strip(),
                "nace": row[10].strip(),
                "nuts": row[11].strip(),
                "cofog": row[12].strip(),
                "sector": row[14].strip(),
                "chapter": row[15].strip(),
                "unit_type": row[16].strip(),
                "unit_subtype": row[17].strip(),
                "legal_form_code": row[18].strip(),
            }
            previous = selected.get(ico)
            if previous is None or valid_from > previous[0]:
                selected[ico] = (valid_from, item)
        by_year[year] = {ico: item for ico, (_, item) in selected.items()}
    return by_year


def load_registry_year(year: int) -> list[dict]:
    path = SOURCE_DIR / f"konsolidovane_jednotky_{year}.csv"
    lines = path.read_bytes().decode("cp1250", errors="replace").splitlines()
    header_index = next(i for i, line in enumerate(lines) if "IČO" in line and "Název" in line)
    reader = csv.DictReader(io.StringIO("\n".join(lines[header_index:])), delimiter=";")
    result = []
    for raw in reader:
        row = {str(key).strip(): (value or "").strip() for key, value in raw.items() if key is not None}
        ico = norm_ico(row.get("IČO"))
        if not ico:
            continue
        result.append({
            "year": year,
            "ico": ico,
            "name": row.get("Název", ""),
            "legal_form": row.get("Právní forma", "") or row.get("Druh ÚJ", ""),
            # Despite its CSV heading, this field contains the IČO of the managing/controlling unit.
            "parent_ico": norm_ico(row.get("Informační povinnost")),
            "pkp": bool(row.get("PKP")) and row.get("PKP") not in {"0", "-"},
            "valid_from": row.get("Platnost od", ""),
            "valid_to": row.get("Platnost do", ""),
            "nuts": row.get("NUTS", ""),
        })
    return result


def is_hospital(unit: dict) -> bool:
    return unit.get("nace", "").startswith("861")


def is_university(unit: dict) -> bool:
    return unit.get("unit_type") == "30" and unit.get("unit_subtype") == "10" and unit.get("nace") == "85420"


def is_partial_public_company(unit: dict) -> bool:
    return unit.get("legal_form_code") in COMPANY_FORM_CODES and unit.get("sector") in {"13110", "13130"}


def classify_owner(parent_form: str, entity_form: str, sector: str, category: str) -> str:
    p = parent_form.lower()
    if "kraj" in p:
        return "Kraj"
    if "obec" in p or "městská část" in p:
        return "Obec"
    if "svazek obcí" in p or p == "dso":
        return "DSO"
    if "organizační složka státu" in p or p == "oss" or "ministerstvo" in p:
        return "Stát"
    if entity_form in {"Státní podnik", "Národní podnik", "Státní organizace Správa železnic"}:
        return "Stát"
    if sector == "13110" or category == "Vysoká škola":
        return "Stát / ústřední úroveň"
    if sector == "13130":
        return "Územní veřejná úroveň"
    return "Jiný veřejný vlastník"


def load_profit_and_loss(selected_icos: set[str]) -> dict[tuple[int, str], dict]:
    result: dict[tuple[int, str], dict] = {}
    for year in range(2010, 2026):
        path = SOURCE_DIR / f"vykzz_{year}.zip"
        with zipfile.ZipFile(path) as archive:
            member = archive.namelist()[0]
            with archive.open(member) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                reader = csv.reader(text, delimiter=";")
                next(reader, None)
                for row in reader:
                    if len(row) < 14:
                        continue
                    ico = norm_ico(row[4])
                    if ico not in selected_icos or row[8] not in {"A.", "B."}:
                        continue
                    current = parse_amount(row[10]) + parse_amount(row[11])
                    record = result.setdefault((year, ico), {
                        "revenue": None,
                        "cost": None,
                        "source_url": f"https://monitor.statnipokladna.gov.cz/data/extrakty/csv/ZiskZtraty/{year}_12_Data_CSUIS_VYKZZ.zip",
                    })
                    if row[8] == "A.":
                        record["cost"] = current
                    else:
                        record["revenue"] = current
    return result


def main() -> None:
    form_labels = load_form_labels()
    accounting_units = load_accounting_units()
    registries = {year: load_registry_year(year) for year in range(2015, 2026)}
    registry_by_year_ico = {
        year: defaultdict(list) for year in range(2015, 2026)
    }
    for year, rows in registries.items():
        for row in rows:
            registry_by_year_ico[year][row["ico"]].append(row)

    entity_years: dict[tuple[int, str], dict] = {}

    # Universities and hospitals are identified from the official accounting-unit master data.
    for year in YEARS:
        for ico, unit in accounting_units[year].items():
            category = None
            if is_university(unit):
                category = "Vysoká škola"
            elif is_hospital(unit):
                registry_hit = bool(registry_by_year_ico.get(year, {}).get(ico))
                if unit["sector"] in {"13110", "13130"} or registry_hit:
                    category = "Nemocnice"
            elif is_partial_public_company(unit) and year < 2016:
                category = "Firma"
            if not category:
                continue
            registry_rows = registry_by_year_ico.get(year, {}).get(ico, [])
            reg = registry_rows[0] if registry_rows else {}
            legal_form = reg.get("legal_form") or form_labels.get(unit["legal_form_code"], "")
            parent_ico = reg.get("parent_ico", "")
            parent_form = ""
            if parent_ico and registry_by_year_ico.get(year, {}).get(parent_ico):
                parent_form = registry_by_year_ico[year][parent_ico][0].get("legal_form", "")
            entity_years[(year, ico)] = {
                "year": year,
                "ico": ico,
                "name": reg.get("name") or unit["name"],
                "category": category,
                "legal_form": legal_form,
                "legal_form_code": unit["legal_form_code"],
                "owner_level": classify_owner(parent_form, legal_form, unit["sector"], category),
                "parent_ico": parent_ico,
                "sector": unit["sector"],
                "nace": unit["nace"],
                "nuts": reg.get("nuts") or unit["nuts"],
                "registry_status": "Konsolidační výčet" if registry_rows else (
                    "ČSÚIS – veřejný sektor" if year >= 2010 else "Historická kmenová data ČSÚIS"
                ),
                "pkp": any(item.get("pkp") for item in registry_rows),
                "source_registry": (
                    f"https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d"
                    if registry_rows else "https://monitor.statnipokladna.gov.cz/data/csv/CIS_UCJED.CSV"
                ),
            }

    # From 2016 onward the consolidation register supplies the complete in-scope company universe.
    for year in range(2016, 2026):
        type_map = {row["ico"]: row["legal_form"] for row in registries[year]}
        unit_map = accounting_units[year]
        for row in registries[year]:
            if row["legal_form"] not in COMPANY_LEGAL_FORMS:
                continue
            ico = row["ico"]
            unit = unit_map.get(ico, {})
            category = "Nemocnice" if is_hospital(unit) else "Firma"
            parent_form = type_map.get(row["parent_ico"], "")
            entity_years[(year, ico)] = {
                "year": year,
                "ico": ico,
                "name": row["name"] or unit.get("name", ""),
                "category": category,
                "legal_form": row["legal_form"],
                "legal_form_code": unit.get("legal_form_code", ""),
                "owner_level": classify_owner(parent_form, row["legal_form"], unit.get("sector", ""), category),
                "parent_ico": row["parent_ico"],
                "sector": unit.get("sector", ""),
                "nace": unit.get("nace", ""),
                "nuts": row["nuts"] or unit.get("nuts", ""),
                "registry_status": "Konsolidační výčet",
                "pkp": row["pkp"],
                "source_registry": "https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d",
            }

    selected_icos = {ico for _, ico in entity_years}
    financials = load_profit_and_loss(selected_icos)

    annual_rows = []
    for key in sorted(entity_years):
        item = dict(entity_years[key])
        fin = financials.get(key)
        if fin and fin.get("revenue") is not None and fin.get("cost") is not None:
            item.update({
                "revenue": fin["revenue"],
                "cost": fin["cost"],
                "financial_status": "VZZ dostupný",
                "source_financial": fin["source_url"],
            })
        elif item["category"] == "Firma" or item["pkp"]:
            item.update({
                "revenue": None,
                "cost": None,
                "financial_status": "PKP / výroční zpráva – jednotlivý VZZ není v otevřeném CSV",
                "source_financial": "",
            })
        elif item["year"] < 2010:
            item.update({
                "revenue": None,
                "cost": None,
                "financial_status": "2006–2009 – jednotný otevřený VZZ není dostupný",
                "source_financial": "",
            })
        else:
            item.update({
                "revenue": None,
                "cost": None,
                "financial_status": "VZZ nenalezen / neúplné podání",
                "source_financial": "",
            })
        annual_rows.append(item)

    # Build one master row per entity from the latest observed attributes.
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in annual_rows:
        grouped[row["ico"]].append(row)
    entities = []
    for ico, rows in grouped.items():
        rows.sort(key=lambda x: x["year"])
        latest = rows[-1]
        categories = sorted({row["category"] for row in rows})
        financial_years = [row["year"] for row in rows if row["revenue"] is not None]
        entities.append({
            "ico": ico,
            "name": latest["name"],
            "category": "Nemocnice" if "Nemocnice" in categories else latest["category"],
            "legal_form": latest["legal_form"],
            "legal_form_code": latest["legal_form_code"],
            "owner_level": latest["owner_level"],
            "parent_ico": latest["parent_ico"],
            "first_year": min(row["year"] for row in rows),
            "last_year": max(row["year"] for row in rows),
            "years_in_inventory": len({row["year"] for row in rows}),
            "financial_years": len(financial_years),
            "first_financial_year": min(financial_years) if financial_years else None,
            "last_financial_year": max(financial_years) if financial_years else None,
            "pkp": any(row["pkp"] for row in rows),
            "nace": latest["nace"],
            "sector": latest["sector"],
            "nuts": latest["nuts"],
        })
    entities.sort(key=lambda x: (x["category"], x["name"], x["ico"]))

    coverage = []
    for year in YEARS:
        rows = [row for row in annual_rows if row["year"] == year]
        for category in ["Firma", "Vysoká škola", "Nemocnice"]:
            subset = [row for row in rows if row["category"] == category]
            available = [row for row in subset if row["revenue"] is not None]
            if category == "Firma" and year < 2016:
                universe = "Částečný – pouze jednotky veřejného sektoru v kmeni ČSÚIS"
            elif category == "Firma":
                universe = "Úplný dle konsolidačního výčtu pro daný rok"
            else:
                universe = "Účetní jednotky identifikované dle kmenových dat ČSÚIS"
            coverage.append({
                "year": year,
                "category": category,
                "entity_count": len(subset),
                "financial_count": len(available),
                "coverage_rate": (len(available) / len(subset)) if subset else None,
                "universe_status": universe,
                "financial_source_status": (
                    "Jednotný otevřený VZZ není dostupný" if year < 2010 else "VZZ ČSÚIS; firmy převážně pouze PKP"
                ),
            })

    sources = [
        {
            "item": "Konsolidační výčet veřejných subjektů",
            "period": "2015–2025 (firmy systematicky od 2016)",
            "url": "https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d",
            "note": "Identifikace státem, kraji, obcemi a dalšími veřejnými jednotkami ovládaných subjektů.",
        },
        {
            "item": "Kmen účetních jednotek ČSÚIS",
            "period": "historické intervaly včetně 2006–2025",
            "url": "https://monitor.statnipokladna.gov.cz/data/csv/CIS_UCJED.CSV",
            "note": "Název, IČO, NACE, sektor, právní forma a typ účetní jednotky.",
        },
        {
            "item": "Výkaz zisku a ztráty ČSÚIS",
            "period": "2010–2025",
            "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data",
            "note": "Celkové výnosy a náklady za hlavní i hospodářskou činnost; bez jednotné eliminace přijatých transferů.",
        },
        {
            "item": "Metodika MONITOR",
            "period": "aktuální",
            "url": "https://monitor.statnipokladna.gov.cz/metodika",
            "note": "Vymezení VZZ, PKP a konsolidačních zdrojů.",
        },
        {
            "item": "Sbírka listin / výroční zprávy",
            "period": "2006–2025",
            "url": "https://or.justice.cz/ias/ui/rejstrik",
            "note": "Navazující zdroj pro jednotlivé obchodní společnosti a roky bez otevřeného VZZ; čísla v této verzi nejsou hromadně vytěžena.",
        },
    ]

    output = {
        "metadata": {
            "title": "Vedlejší veřejné příjmy – firmy, veřejné vysoké školy a nemocnice",
            "period": "2006–2025",
            "units": "Kč",
            "prepared_on": "2026-08-20",
            "scope": "Obce a kraje jako samostatné rozpočtové jednotky jsou vyloučeny; jejich ovládané firmy a nemocnice zůstávají zahrnuty.",
            "interpretation": "Výnosy subjektů nejsou automaticky příjmem státního rozpočtu. Hrubé výnosy mohou obsahovat veřejné transfery a nesmějí být bez konsolidace přičteny k příjmům veřejných rozpočtů.",
            "status": "PARTIAL – registr firem je systematický od 2016; jednotlivé firemní výkazy a roky 2006–2009 vyžadují doplnění z výročních zpráv.",
            "financial_rows": sum(1 for row in annual_rows if row["revenue"] is not None),
        },
        "entities": entities,
        "annual": annual_rows,
        "coverage": coverage,
        "sources": sources,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT_PATH),
        "entities": len(entities),
        "annual_rows": len(annual_rows),
        "by_category": {category: sum(1 for row in entities if row["category"] == category) for category in ["Firma", "Vysoká škola", "Nemocnice"]},
        "financial_rows": sum(1 for row in annual_rows if row["revenue"] is not None),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
