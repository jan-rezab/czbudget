#!/usr/bin/env python3
"""Build the compact browser dataset for the international municipality section."""

import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
MAIN = WORKSPACE / "outputs/20260822-international-municipal-2024-2025-full"
CORRECTIONS = WORKSPACE / "outputs/20260822-international-municipal-2024-2025-corrections"
FRANCE = WORKSPACE / "outputs/20260822-international-municipal-france-complete"
UA_DIRECTORY = WORKSPACE / "data/source_cache/international_municipal/UKR/local_budget_directory_2025.json"
OUTPUT = ROOT / "data/international-municipalities.v1.json"

COUNTRIES = {
    "CZE": {"alpha2":"CZ","name_cs":"Česko","name_en":"Czechia","currency":"CZK","years":[2025],"counts":{"2025":6254},"stages":["enacted","revised","actual"],"measures":["revenue","expenditure","balance","cash"],"coverage_cs":"Všech 6 254 obcí","coverage_en":"All 6,254 municipalities","status":"complete","source":"https://monitor.statnipokladna.gov.cz/"},
    "POL": {"alpha2":"PL","name_cs":"Polsko","name_en":"Poland","currency":"PLN","years":[2024,2025],"counts":{"2024":2477,"2025":2479},"stages":["revised","actual"],"measures":["revenue","expenditure"],"coverage_cs":"Všechny gminy v ročních výkazech Rb-27S a Rb-28S","coverage_en":"All gminas in annual Rb-27S and Rb-28S returns","status":"complete","source":"https://www.gov.pl/web/finanse/bazy-danych8"},
    "DNK": {"alpha2":"DK","name_cs":"Dánsko","name_en":"Denmark","currency":"DKK","years":[2024,2025],"counts":{"2024":98,"2025":98},"stages":["enacted","actual"],"measures":["revenue","expenditure","financing"],"coverage_cs":"Všech 98 obcí; rozpočty i závěrečné účty","coverage_en":"All 98 municipalities; budgets and final accounts","status":"complete","source":"https://www.statbank.dk/BUDK100"},
    "FRA": {"alpha2":"FR","name_cs":"Francie","name_en":"France","currency":"EUR","years":[2024,2025],"counts":{"2024":35031,"2025":34877},"stages":["actual"],"measures":["revenue","expenditure","balance"],"coverage_cs":"Všechny obce; funkční detail tam, kde jej obec vykazuje; hlavní i vedlejší rozpočty","coverage_en":"All communes; functional detail where reported; main and supplementary budgets","status":"complete","source":"https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2025/"},
    "SWE": {"alpha2":"SE","name_cs":"Švédsko","name_en":"Sweden","currency":"SEK","years":[2024,2025],"counts":{"2024":290,"2025":290},"stages":["actual"],"measures":["revenue","expenditure","balance"],"coverage_cs":"Všech 290 obcí; náklady, výnosy a rozvaha","coverage_en":"All 290 municipalities; costs, income and balance sheet","status":"complete","source":"https://www.scb.se/en/OE0107"},
    "GBR": {"alpha2":"GB","name_cs":"Anglie","name_en":"England","currency":"GBP","years":[2024,2025],"counts":{"2024":318,"2025":317},"stages":["actual"],"measures":["revenue","expenditure","financing"],"coverage_cs":"Odevzdané výkazy anglických obcí a GLA; bez policie a hasičů","coverage_en":"Submitted English council and GLA returns; excludes police and fire","status":"complete","source":"https://www.gov.uk/government/statistics/local-authority-revenue-expenditure-and-financing-england-revenue-outturn-multi-year-data-set"},
    "UKR": {"alpha2":"UA","name_cs":"Ukrajina","name_en":"Ukraine","currency":"UAH","years":[2024,2025],"counts":{"2024":1467,"2025":1467},"stages":["enacted","revised","actual"],"measures":["revenue","expenditure"],"coverage_cs":"Všech 1 467 aktivních rozpočtů územních komunit včetně Kyjeva; bez oblastí a rajónů","coverage_en":"All 1,467 active territorial-community budgets including Kyiv; excludes oblast and district budgets","status":"complete","source":"https://api.openbudget.gov.ua/swagger-ui.html"},
}

def read_jsonl(path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)

def ukraine_entities():
    rows = json.loads(UA_DIRECTORY.read_text(encoding="utf-8"))
    latest = {}
    for year in (2024, 2025):
        annual = {}
        start, end = f"{year}-01-01", f"{year}-12-31"
        for row in rows:
            code = str(row.get("codebudg") or "")
            if not code or row.get("details") != 1 or str(row.get("beginDate") or "") > end or (row.get("endDate") and str(row["endDate"]) < start):
                continue
            if not ("територіальної громади" in str(row.get("namebudg") or "").lower() or code == "2600000000"):
                continue
            if code not in annual or str(row.get("beginDate") or "") > str(annual[code].get("beginDate") or ""):
                annual[code] = row
        latest.update(annual)
    for code, row in sorted(latest.items()):
        yield {"id":f"UA:{code}","country":"UKR","code":code,"name":row.get("namebudg") or code,"region":row.get("codeRegion"),"currency":"UAH","years":[2024,2025]}

def main():
    snapshot = json.loads((ROOT / "data/municipal-snapshot.v1.json").read_text(encoding="utf-8"))
    entities = [{
        "id": row["entity_id"], "country":"CZE", "code":row["national_id"], "name":row["short_name"],
        "region":row["territory"].get("region_name"), "currency":"CZK", "years":[2025],
        "revenue":row["amounts"].get("revenue_actual"), "expenditure":row["amounts"].get("expense_actual"),
        "balance":row["amounts"].get("budget_balance"), "population":row.get("population",{}).get("value"),
        "url":row.get("seo",{}).get("path"),
    } for row in snapshot["municipalities"]]
    sources = [(MAIN,"POL"),(FRANCE,"FRA"),(MAIN,"SWE"),(CORRECTIONS,"DNK"),(CORRECTIONS,"GBR")]
    seen = {row["id"] for row in entities}
    for bundle, country in sources:
        for row in read_jsonl(bundle / "public_entities.jsonl.gz"):
            if row["country_code_alpha3"] != country or row["public_entity_id"] in seen:
                continue
            seen.add(row["public_entity_id"])
            entities.append({"id":row["public_entity_id"],"country":country,"code":row["national_entity_code"],"name":row["entity_name"],"region":row.get("administrative_region_name") or row.get("administrative_region_code"),"currency":row["default_currency_code"],"years":[2024,2025]})
    for row in ukraine_entities():
        if row["id"] not in seen:
            entities.append(row); seen.add(row["id"])
    entities.sort(key=lambda row:(list(COUNTRIES).index(row["country"]),str(row["name"]).casefold(),row["code"]))
    countries = []
    for code, data in COUNTRIES.items():
        country_entities = [row for row in entities if row["country"] == code]
        country = {"code": code, **data, "directory_count": len(country_entities)}
        if {"revenue", "expenditure"}.issubset(country.get("measures", [])) and any(
            row.get("revenue") is None or row.get("expenditure") is None for row in country_entities
        ):
            country["status"] = "aggregate_only"
            country["missing_dimensions"] = ["entity-level revenue", "entity-level expenditure", "entity-level balance"]
            country["coverage_note_en"] = "The official directory and detailed source collection are retained, but the public headline artifact does not publish a complete revenue/expenditure pair for every directory entity. No overlapping national account lines are summed into a synthetic headline."
            country["coverage_note_cs"] = "Oficiální adresář a detailní zdrojová kolekce zůstávají zachovány, veřejný souhrnný artefakt však neobsahuje úplnou dvojici příjmů a výdajů pro každou jednotku. Překrývající se národní účetní řádky se nesčítají do umělého souhrnu."
        countries.append(country)
    payload = {"schema_version":"1.0.0","generated_at":"2026-08-28","scope":"municipality_comparison_tier","countries":countries,"entities":entities,"notes":{"comparability_cs":"Částky zůstávají v národní měně a národní klasifikaci. Rozpočtovou fázi a účetní rozsah vždy porovnávejte společně.","comparability_en":"Amounts remain in national currency and national classifications. Always compare budget stage and accounting scope together."}}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",",":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(entities)} municipalities to {OUTPUT}")

if __name__ == "__main__":
    main()
