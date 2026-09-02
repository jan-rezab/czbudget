#!/usr/bin/env python3
"""Build the Czech education deep-dive dataset from official 2025 outturns."""

from __future__ import annotations

import csv
import io
import json
import os
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


WEB = Path(os.environ.get("CZBUDGET_WEBSITE_ROOT", Path(__file__).resolve().parents[1])).resolve()
ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", WEB.parent)).resolve()
FINM = ROOT / "data/source_cache/2025_12_FINM.zip"
FINOSS = ROOT / "data/sources/ministries/CZE/fin-1-12-oss-2025-12.zip"
MUNICIPAL_SNAPSHOT = WEB / "data/municipal-snapshot.v1.json"
INTERNATIONAL_CAPACITY = WEB / "data/education-capacity-international.v1.json"
OUTPUT = WEB / "data/education-deep-dive.v1.json"

REGIONS = [
    ("00064581", "Praha", "Prague"),
    ("70891095", "Středočeský kraj", "Central Bohemia"),
    ("70890650", "Jihočeský kraj", "South Bohemia"),
    ("70890366", "Plzeňský kraj", "Plzeň"),
    ("70891168", "Karlovarský kraj", "Karlovy Vary"),
    ("70892156", "Ústecký kraj", "Ústí nad Labem"),
    ("70891508", "Liberecký kraj", "Liberec"),
    ("70889546", "Královéhradecký kraj", "Hradec Králové"),
    ("70892822", "Pardubický kraj", "Pardubice"),
    ("70890749", "Kraj Vysočina", "Vysočina"),
    ("70888337", "Jihomoravský kraj", "South Moravia"),
    ("60609460", "Olomoucký kraj", "Olomouc"),
    ("70891320", "Zlínský kraj", "Zlín"),
    ("70890692", "Moravskoslezský kraj", "Moravian-Silesian"),
]
REGION_IDS = {row[0] for row in REGIONS}
TRANSFER_ITEMS = {"5321", "5323", "5329", "6341", "6342", "6349"}

LEVELS = [
    ("preschool", "Mateřské školy", "Preschool", {"3111", "3112", "3115"}),
    ("primary", "Základní školy", "Primary schools", {"3113", "3114", "3117", "3118", "3119"}),
    ("secondary", "Střední školy", "Secondary schools", None),
    ("institutional", "Ústavní a ochranná výchova", "Institutional and protective care", None),
    ("services", "Školské služby", "School services", None),
    ("vocational", "Vyšší odborné školy", "Higher vocational schools", None),
    ("higher", "Vysoké školy", "Higher education", None),
    ("arts", "Základní umělecké školy", "Primary arts schools", {"3231"}),
    ("other", "Ostatní vzdělávání", "Other education", None),
]


def number(value: str | None) -> float:
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    parsed = float(text or 0)
    return -parsed if negative else parsed


def level_for(paragraph: str) -> str:
    p = paragraph.zfill(4)[:4]
    if p in {"3111", "3112", "3115"}:
        return "preschool"
    if p in {"3113", "3114", "3117", "3118", "3119"}:
        return "primary"
    if p.startswith("312"):
        return "secondary"
    if p.startswith("313"):
        return "institutional"
    if p.startswith("314"):
        return "services"
    if p.startswith("315"):
        return "vocational"
    if p.startswith(("321", "322")):
        return "higher"
    if p == "3231":
        return "arts"
    return "other"


def bilingual_levels(amounts: dict[str, float]) -> list[dict]:
    total = sum(amounts.values())
    result = []
    for key, cs, en, _ in LEVELS:
        value = amounts.get(key, 0.0)
        if value or key != "higher":
            result.append({
                "id": key,
                "label_cs": cs,
                "label_en": en,
                "amount_czk_bn": round(value / 1e9, 6),
                "share_pct": round(value / total * 100, 4) if total else 0,
            })
    return result


def local_data() -> dict:
    snapshot = json.loads(MUNICIPAL_SNAPSHOT.read_text(encoding="utf-8"))
    municipal_ids = {row["national_id"] for row in snapshot["municipalities"]}
    allowed = municipal_ids | REGION_IDS
    region_amounts = defaultdict(lambda: defaultdict(float))
    tier_amounts = defaultdict(lambda: defaultdict(float))
    all_amounts = defaultdict(float)
    all_transfers = 0.0
    research_gross = 0.0
    research_transfers = 0.0
    region_items = defaultdict(float)

    with zipfile.ZipFile(FINM) as archive, archive.open("FINM201_2025012.csv") as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";", quotechar='"')
        next(reader, None)
        for row in reader:
            if len(row) < 13:
                continue
            ico, paragraph, item = row[4].strip(), row[8].strip().zfill(4), row[9].strip()
            if ico not in allowed or not item or item[0] not in {"5", "6"}:
                continue
            value = number(row[12])
            if paragraph[:2] == "38":
                research_gross += value
                if item in TRANSFER_ITEMS:
                    research_transfers += value
                continue
            if paragraph[:2] not in {"31", "32"}:
                continue
            level = level_for(paragraph)
            all_amounts[level] += value
            if item in TRANSFER_ITEMS:
                all_transfers += value
            if ico in REGION_IDS:
                region_amounts[ico][level] += value
                region_items[item] += value
            if ico == "00064581":
                tier = "prague"
            elif ico in REGION_IDS:
                tier = "regions"
            else:
                tier = "municipalities"
            tier_amounts[tier][level] += value

    regions = []
    for ico, name_cs, name_en in REGIONS:
        amounts = region_amounts[ico]
        total = sum(amounts.values())
        regions.append({
            "id": ico,
            "name_cs": name_cs,
            "name_en": name_en,
            "total_czk_bn": round(total / 1e9, 6),
            "levels": {key: round(value / 1e9, 6) for key, value in amounts.items()},
        })

    tiers = []
    tier_names = {
        "municipalities": ("Obce bez Prahy", "Municipalities excl. Prague"),
        "regions": ("13 krajů bez Prahy", "13 regions excl. Prague"),
        "prague": ("Praha", "Prague"),
    }
    for key in ("municipalities", "regions", "prague"):
        cs, en = tier_names[key]
        amounts = tier_amounts[key]
        tiers.append({
            "id": key,
            "label_cs": cs,
            "label_en": en,
            "total_czk_bn": round(sum(amounts.values()) / 1e9, 6),
            "levels": {level: round(value / 1e9, 6) for level, value in amounts.items()},
        })

    gross = sum(all_amounts.values())
    return {
        "gross_czk_bn": round(gross / 1e9, 6),
        "internal_transfers_czk_bn": round(all_transfers / 1e9, 6),
        "net_czk_bn": round((gross - all_transfers) / 1e9, 6),
        "research_net_czk_bn": round((research_gross - research_transfers) / 1e9, 6),
        "levels": bilingual_levels(all_amounts),
        "government_tiers": tiers,
        "regions": regions,
        "regional_routing": {
            "to_non_owned_organisations_czk_bn": round(region_items["5339"] / 1e9, 6),
            "transfers_to_owned_organisations_czk_bn": round(region_items["5336"] / 1e9, 6),
            "contributions_to_owned_organisations_czk_bn": round(region_items["5331"] / 1e9, 6),
        },
    }


def ministry_data() -> dict:
    totals = defaultdict(float)
    levels = defaultdict(float)
    level_transfers = defaultdict(float)
    items = defaultdict(float)

    with zipfile.ZipFile(FINOSS) as archive, archive.open("MIS-RIS_2025012.csv") as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")
        next(reader, None)
        for row in reader:
            if len(row) < 20 or row[3].strip().lstrip("0") != "333":
                continue
            item = row[5].strip()
            if not item or item[0] not in {"5", "6"}:
                continue
            paragraph = row[6].strip()[:4]
            value = number(row[19])
            totals["chapter"] += value
            items[item] += value
            if paragraph[:2] in {"31", "32"}:
                totals["education"] += value
                level = level_for(paragraph)
                levels[level] += value
                if item in TRANSFER_ITEMS:
                    totals["education_local_transfers"] += value
                    level_transfers[level] += value
            elif paragraph[:2] == "38":
                totals["research"] += value
                if item in TRANSFER_ITEMS:
                    totals["research_local_transfers"] += value
            elif paragraph[:2] == "34":
                totals["sport_youth"] += value
            if item in TRANSFER_ITEMS:
                totals["local_transfers_all"] += value

    level_rows = bilingual_levels(levels)
    for row in level_rows:
        row["local_transfer_czk_bn"] = round(level_transfers[row["id"]] / 1e9, 6)
        row["direct_czk_bn"] = round(row["amount_czk_bn"] - row["local_transfer_czk_bn"], 6)

    return {
        "chapter_actual_czk_bn": round(totals["chapter"] / 1e9, 6),
        "education_actual_czk_bn": round(totals["education"] / 1e9, 6),
        "research_actual_czk_bn": round(totals["research"] / 1e9, 6),
        "sport_youth_actual_czk_bn": round(totals["sport_youth"] / 1e9, 6),
        "education_local_transfers_czk_bn": round(totals["education_local_transfers"] / 1e9, 6),
        "local_transfers_all_czk_bn": round(totals["local_transfers_all"] / 1e9, 6),
        "research_local_transfers_czk_bn": round(totals["research_local_transfers"] / 1e9, 6),
        "higher_education_direct_czk_bn": round((levels["higher"] - level_transfers["higher"]) / 1e9, 6),
        "other_direct_education_czk_bn": round((totals["education"] - totals["education_local_transfers"] - levels["higher"] + level_transfers["higher"]) / 1e9, 6),
        "levels": level_rows,
        "largest_items": {
            "transfers_to_regions_czk_bn": round(items["5323"] / 1e9, 6),
            "transfers_to_municipalities_czk_bn": round(items["5321"] / 1e9, 6),
            "university_operating_transfers_czk_bn": round(items["5332"] / 1e9, 6),
            "university_investment_transfers_czk_bn": round(items["6352"] / 1e9, 6),
        },
    }


def coverage() -> dict:
    countries = [
        ("CZE", "Česko", "Czechia", "ready", "Kompletní státní a místní skutečnost; typ školy, položka a transferová cesta.", "Complete central and local outturn; school type, item and transfer path.", "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data"),
        ("CHE", "Švýcarsko", "Switzerland", "download", "Kantony a obce podle stupně vzdělání a druhu výdaje; doplnit federaci.", "Cantons and municipalities by education level and expense nature; federal layer to join.", "https://www.pxweb.bfs.admin.ch/pxweb/fr/px-x-1506010000_106/px-x-1506010000_106/px-x-1506010000_106.px/"),
        ("DNK", "Dánsko", "Denmark", "download", "StatBank: celkové školství i obecní účty po funkcích, druhu a protistraně.", "StatBank: total education and municipal accounts by function, nature and counterparty.", "https://www.statbank.dk/UOE1"),
        ("FIN", "Finsko", "Finland", "download", "StatFin API: celý systém podle stupně, nákladů a sektoru vlády.", "StatFin API: whole system by education level, cost and government sector.", "https://stat.fi/en/statistics/kotal"),
        ("FRA", "Francie", "France", "download", "Celostátní místní účetní zůstatky funkce × ekonomická položka; spojit se státem.", "Nationwide local accounts by function × economic item; central layer to join.", "https://www.data.gouv.fr/datasets/balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2024"),
        ("GBR", "Spojené království", "United Kingdom", "download", "Detail škol a samospráv je výborný pro Anglii; ostatní země UK vyžadují samostatné pipeline.", "School and local-authority detail is strong for England; other UK nations need separate pipelines.", "https://explore-education-statistics.service.gov.uk/find-statistics/la-and-school-expenditure/2024-25"),
        ("NLD", "Nizozemsko", "Netherlands", "download", "DUO zveřejňuje platby i XBRL výkazy školských zřizovatelů.", "DUO publishes payments and XBRL accounts for school boards.", "https://duo.nl/open_onderwijsdata/onderwijs-algemeen/financiele-overzichten/"),
        ("NOR", "Norsko", "Norway", "download", "KOSTRA API: obecní a krajské účty po školských funkcích.", "KOSTRA API: municipal and county accounts by education function.", "https://www.ssb.no/en/statbank1/list/kostrahoved"),
        ("POL", "Polsko", "Poland", "download", "Rb-28S a Local Data Bank: všechny samosprávy, kapitola i ekonomická položka.", "Rb-28S and Local Data Bank: all local governments, chapter and economic item.", "https://finansejst.mf.gov.pl/"),
        ("SWE", "Švédsko", "Sweden", "download", "SCB PxWeb: obce, regiony, typ školy, vlastník a nákladový druh.", "SCB PxWeb: municipalities, regions, school type, ownership and cost nature.", "https://www.scb.se/oe0107-en"),
        ("USA", "Spojené státy", "United States", "download", "Census F-33 po školských distriktech; vysoké školy doplní IPEDS.", "Census F-33 by school district; IPEDS adds higher education.", "https://www.census.gov/programs-surveys/school-finances.html"),
        ("DEU", "Německo", "Germany", "online", "Silná data Bund/Länder a školní stupně, ale místní vrstva není jedním celostátním souborem.", "Strong federal/Länder and school-level data, but no single nationwide local file.", "https://genesis.destatis.de/datenbank/online/statistic/21711/details"),
        ("ESP", "Španělsko", "Spain", "online", "Oficiální statistika podle autonomních oblastí; účetní spojení je roztříštěné.", "Official statistics by autonomous community; accounting joins are fragmented.", "https://www.ine.es/dyngs/IOE/en/operacion.htm?numinv=41012"),
        ("JPN", "Japonsko", "Japan", "online", "e-Stat má obce a prefektury podle typu školy; zbývá sjednotit význam účtů a transferů.", "e-Stat has municipalities and prefectures by school type; account and transfer semantics need harmonisation.", "https://www.e-stat.go.jp/index.php/en/stat-search/database?statdisp_id=0000010204"),
        ("BRA", "Brazílie", "Brazil", "online", "Federální a školské portály existují, ale úplná konsolidace závisí na více registrech.", "Federal and education portals exist, but full consolidation spans several registries.", "https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope"),
        ("GRC", "Řecko", "Greece", "online", "Národní rozpočet a statistiky jsou online; místní školní účetnictví není jednotný otevřený tok.", "National budget and statistics are online; local school accounting is not one open flow.", "https://www.statistics.gr/en/statistics/-/publication/SEL03/-"),
        ("UKR", "Ukrajina", "Ukraine", "online", "Otevřené výdaje jsou detailní, ale válečné změny a územní pokrytí vyžadují zvláštní audit.", "Open spending is detailed, but wartime changes and territorial coverage require a separate audit.", "https://openbudget.gov.ua/"),
    ]
    rows = [
        {"code": code, "name_cs": cs, "name_en": en, "status": status, "note_cs": note_cs, "note_en": note_en, "source_url": url}
        for code, cs, en, status, note_cs, note_en, url in countries
    ]
    return {
        "benchmark_countries": 48,
        "audit_universe": len(rows),
        "counts": {status: sum(row["status"] == status for row in rows) for status in ("ready", "download", "online")},
        "countries": rows,
        "benchmark_source": "https://data-explorer.oecd.org/?bp=true&fc=Topic&fs%5B0%5D=Topic%2C0%7CEducation+and+skills%23EDU%23",
    }


def capacity() -> dict:
    """Current Czech capacity plus a like-for-like Eurostat staffing benchmark."""
    categories = [
        ("kindergarten", "Mateřské školy", "Kindergartens", "2025/26", 347_798, 5_409, 35_745.77),
        ("primary", "Základní školy", "Primary schools", "2025/26", 1_002_916, 4_320, 76_683.39),
        ("secondary", "Střední školy", "Secondary schools", "2025/26", 514_881, 1_328, 46_370.62),
        ("conservatory", "Konzervatoře", "Conservatories", "2025/26", 3_839, 18, 1_106.79),
        ("higher_vocational", "Vyšší odborné školy", "Higher vocational schools", "2025/26", 22_900, 153, 1_392.53),
        ("universities", "Veřejné a soukromé vysoké školy", "Public and private universities", "2025", 330_547, 53, 20_119.0),
        ("state_universities", "Státní vysoké školy", "State universities", "2025", 4_052, 2, None),
    ]
    rows = []
    for category_id, label_cs, label_en, period, learners, institutions, teaching_fte in categories:
        rows.append({
            "id": category_id,
            "label_cs": label_cs,
            "label_en": label_en,
            "period": period,
            "learners": learners,
            "schools_or_institutions": institutions,
            "teaching_fte": teaching_fte,
            "learners_per_teaching_fte": round(learners / teaching_fte, 1) if teaching_fte else None,
        })

    international = json.loads(INTERNATIONAL_CAPACITY.read_text(encoding="utf-8"))
    country_profiles = international["countries"]
    level_ids = [level["id"] for level in country_profiles[0]["levels"]]
    levels = []
    for level_id in level_ids:
        rows_by_country = {
            country["code"]: next(level for level in country["levels"] if level["id"] == level_id)
            for country in country_profiles
        }
        reported_peer_values = [
            row["learners_per_teaching_fte"]
            for code, row in rows_by_country.items()
            if code != "CZE" and row["learners_per_teaching_fte"] is not None
        ]
        ordered = sorted(reported_peer_values)
        midpoint = len(ordered) // 2
        peer_median = (ordered[midpoint - 1] + ordered[midpoint]) / 2 if len(ordered) % 2 == 0 else ordered[midpoint]
        czech_row = rows_by_country["CZE"]
        levels.append({
            "id": level_id,
            "label_cs": czech_row["label_cs"],
            "label_en": czech_row["label_en"],
            "isced": czech_row["isced"],
            "czech_value": czech_row["learners_per_teaching_fte"],
            "reported_peer_median": round(peer_median, 1),
            "observations": [
                {
                    "code": country["code"],
                    "name_cs": country["name_cs"],
                    "name_en": country["name_en"],
                    "value": rows_by_country[country["code"]]["learners_per_teaching_fte"],
                }
                for country in country_profiles
            ],
        })
    return {
        "domestic_period": "2025/26",
        "headline_enrolments": sum(row[4] for row in categories),
        "measured_teaching_fte": round(sum(row[6] or 0 for row in categories), 2),
        "category_units": sum(row[5] for row in categories),
        "categories": rows,
        "benchmark": {
            "period": international["period"],
            "unit": "full-time-equivalent pupils or students per full-time-equivalent teacher or academic staff member",
            "core_peer_definition": "Site core: Czechia plus countries tagged anchor or responsible_benchmark in the sovereign benchmark; Switzerland has no comparable observation in this Eurostat table.",
            "levels": levels,
            "source_url": "https://ec.europa.eu/eurostat/databrowser/view/educ_uoe_perp04/default/table?lang=en",
        },
        "international": {
            "period": international["period"],
            "country_count": international["country_count"],
            "level_count": international["level_count"],
            "countries": country_profiles,
            "methodology": international["methodology"],
            "sources": international["sources"],
        },
    }


def main() -> None:
    local = local_data()
    ministry = ministry_data()
    consolidated = local["net_czk_bn"] + ministry["education_actual_czk_bn"] - ministry["education_local_transfers_czk_bn"]
    research_net = ministry["research_actual_czk_bn"] - ministry["research_local_transfers_czk_bn"] + local["research_net_czk_bn"]
    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "education-deep-dive",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "country": "CZE",
        "period": {"year": 2025, "status": "actual", "currency": "CZK"},
        "headline": {
            "approved_state_education_czk_bn": 289.9,
            "consolidated_education_czk_bn": round(consolidated, 6),
            "consolidated_including_research_czk_bn": round(consolidated + research_net, 6),
        },
        "local": local,
        "ministry": ministry,
        "capacity": capacity(),
        "coverage": coverage(),
        "sources": [
            {"title": "FIN 1-12 OSS 2025", "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data", "scope": "Ministry chapter 333 actual expenditure"},
            {"title": "FIN 2-12 M 2025", "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data", "scope": "Municipal and regional actual expenditure"},
            {"title": "State budget in the context of performance", "url": "https://www.mfcr.cz/assets/attachments/2025-10-01_Statni-rozpocet-v-kontextu-vykonnosti.pdf", "scope": "Approved state-funded education envelope"},
            {"title": "OECD Education Finance", "url": coverage()["benchmark_source"], "scope": "International benchmark coverage"},
            {"title": "CZSO / MŠMT — Schools and school facilities 2025/26", "url": "https://csu.gov.cz/produkty/skoly-a-skolska-zarizeni-skolni-rok-202526", "scope": "Learners, school-type units and teaching FTE from kindergarten through higher vocational education"},
            {"title": "CZSO — Universities 2025", "url": "https://csu.gov.cz/vysoke-a-vyssi-odborne-skoly", "scope": "University students and institutions"},
            {"title": "CZSO — Education staff and wages", "url": "https://csu.gov.cz/pracovnici-a-mzdy-ve-vzdelavani", "scope": "University academic staff FTE"},
            {"title": "Eurostat — pupils and students per teacher", "url": capacity()["benchmark"]["source_url"], "scope": "Harmonised 2023 UOE ratios by ISCED level"},
        ],
        "methodology": {
            "education_scope": "Czech budget paragraphs 31 and 32",
            "local_consolidation": "Prague city districts excluded; transfers among local governments removed once",
            "national_consolidation": "Local net expenditure plus Ministry education expenditure excluding transfers to local governments",
            "warning": "The consolidated total is a derived cash-outturn estimate, not a single official published aggregate.",
        },
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
