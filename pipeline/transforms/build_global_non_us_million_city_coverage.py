#!/usr/bin/env python3
"""Merge regional audits into the exact 487-city non-US UN WUP universe."""
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"data/major-cities/global-non-us-million-plus-coverage.v1.json"
def read(path): return json.loads((ROOT/path).read_text())

def asia_rows():
    return [{**row,"region":"Asia/Africa/Oceania"} for row in read("data/major-cities/asia-africa-oceania-million-plus-coverage.v1.json")["cities"]]

def latam_rows():
    rows=[]
    for city in read("data/major-cities/latam-million-plus.v1.json")["cities"]:
        loaded=city["coverage_status"]=="anchor_only"
        rows.append({"un_city_code":city["un_city_code"],"un_city_name":city["un_city_name"],"country":city.get("country_code"),"iso3":city["country_code"],"population_2025":int(round(city["population_2025_thousands"]*1000)),"region":"Latin America/Caribbean","classification":"production_loaded" if loaded else "hard_blocked","anchor_only":True,"government_boundary":city.get("fiscal_scope") or "No reviewed legal-government anchor","coverage_domain":"served official municipal line items" if loaded else "no reviewed production-qualifying itemized anchor","official_source_url":city.get("source_url"),"profile_url":city.get("profile_url"),"published_detail_rows":city.get("published_detail_rows"),"warehouse_rows":city.get("warehouse_rows"),"warehouse_entity_id":city.get("warehouse_entity_id"),"source_id":city.get("source_id"),"verified_build_id":city.get("completed_run"),"ingestion_run_id":city.get("ingestion_run_id"),"blocker":city["blocker"],"date_checked":"2026-09-20"})
    assert len(rows)==60
    return rows

def europe_rows():
    additions={
        5576:{"entity":"DE:11000000","source_ids":["de-berlin-double-budget-2024-2025"],"warehouse_rows":47723,"ingestion_run_id":"de-berlin-double-budget-2024-2025-v1","official_source_url":"https://www.berlin.de/sen/finanzen/service/daten/csv-opendata_doppelhaushalt_2024_2025.csv"},
        1054:{"entity":"AT:90001","source_ids":["at-vienna-municipality-account-2025-ehh","at-vienna-municipality-account-2025-fhh"],"warehouse_rows":10659,"ingestion_run_id":"at-vienna-account-2025-v2","official_source_url":"https://www.offenerhaushalt.at/gemeinde/wien/downloads"},
        217:{"entity":"PT:1106","source_ids":["pt-dgal-municipal-expense-execution-2024","pt-dgal-municipal-revenue-execution-2024"],"warehouse_rows":197,"ingestion_run_id":"pt-lisbon-dgal-2024-v1","official_source_url":"https://portalautarquico.dgal.gov.pt/pt-PT/financas-locais/dados-financeiros/contas-de-gerencia/","immutable_receipt":"gs://czbudget-janrezab-data-layers/processing-runs/portugal-city/dfd7045d-de60-48f7-8280-80e4346c3e05/completed.json"},
        942:{"entity":"HU:13578","source_ids":["hu-budapest-approved-budget-2025-detail"],"warehouse_rows":918,"ingestion_run_id":"hu-budapest-budget-2025-v1","official_source_url":"https://einfoszab.budapest.hu/session/DvdItem/125496?key=fovarosi-kozgyules-nyilvanos-ulesei&organizationtype=2&parentid=18407&parenttype=2&sessionType=1&type=5"},
        100:{"entity":"BG:68134","source_ids":["bg-sofia-approved-revenue-2025","bg-sofia-approved-expenditure-2025"],"warehouse_rows":425,"ingestion_run_id":"bg-sofia-budget-2024-2025-v2","official_source_url":"https://svc.sofia.bg/documents/d/guest/2-prilozenie-2-za-razhodite-po-budzeta-na-stolicna-obsina-za-2025-g"},
        833:{"entity":"GR:ATHENS","source_ids":["gr-moi-municipal-execution-revenue-2024","gr-moi-municipal-execution-expenditure-2024"],"warehouse_rows":261,"ingestion_run_id":"gr-athens-municipal-execution-2024-v1","official_source_url":"https://data.gov.gr/dataset/oikonomika-stoicheia-ota-etos-2024-komvos-parakoloythisis-epidoseon-topikis-aytodi","immutable_receipt":"gs://czbudget-janrezab-data-layers/processing-runs/athens-city/647bb4da-028a-4b0f-b538-6ff0cae3e8a7/completed.json"},
        675:{"entity":"DE:05113000","source_ids":["de-essen-budget-2025-2026"],"warehouse_rows":3706,"ingestion_run_id":"de-essen-budget-2025-2026-v2","official_source_url":"https://opendata.essen.de/dataset/haushaltsplan"},
    }
    rows=[]
    for city in read("data/europe-million-city-budget-targets.v1.json")["cities"]:
        status=city["status"]
        classification="production_loaded" if status in {"warehouse_lines","published_lines"} else "partial" if status=="configured_source" else "hard_blocked"
        evidence=city.get("warehouse_verification") or {}
        extra=additions.get(city["un_city_code"])
        if extra: classification="production_loaded"; status="warehouse_lines"
        row={"un_city_code":city["un_city_code"],"un_city_name":city["un_city_name"],"country":city["country"],"iso3":city["iso3"],"population_2025":city["population_2025"],"region":"Europe","classification":classification,"anchor_only":True,"government_boundary":city.get("anchor_entity_name") or (extra and extra["entity"]) or "No reviewed legal-government anchor","coverage_domain":status,"official_source_url":city.get("profile_url"),"profile_url":city.get("profile_url"),"published_detail_rows":city.get("public_line_count"),"source_ids":city.get("source_ids",[]),"warehouse_verification":evidence or None,"blocker":city.get("scope_note") or ("Named legal-government anchor only; not the complete UN built-up area." if extra else "Configured official source is not yet production verified." if classification=="partial" else "No production adapter is configured."),"date_checked":"2026-09-20"}
        if extra: row.update(extra)
        rows.append(row)
    assert len(rows)==45
    return rows

CANADA_UN={"Toronto":2925,"Montreal":3645,"Vancouver":341,"Calgary":1126}
CANADA_NAMES={}
CANADA_POP={"Toronto":5494431,"Montreal":2668723,"Vancouver":1707865,"Calgary":1197110}
CANADA_ROWS={"Toronto":18958,"Montreal":20,"Vancouver":528,"Calgary":277}
def canada_rows():
    rows=[]
    for source in read("pipeline/config/canada_million_city_sources.json")["sources"]:
        city=source["city"]; un_name=CANADA_NAMES.get(city,city)
        rows.append({"un_city_code":CANADA_UN[un_name],"un_city_name":un_name,"country":"Canada","iso3":"CAN","population_2025":CANADA_POP[un_name],"region":"Canada","classification":"production_loaded","anchor_only":True,"government_boundary":source["entity_id"],"coverage_domain":source["coverage"],"official_source_url":source["official_url"],"source_id":source["source_id"],"fiscal_year":source.get("fiscal_year") or source.get("fiscal_years"),"budget_stage":source["budget_stage"],"source_sha256":source["sha256"],"warehouse_rows":CANADA_ROWS[city],"immutable_receipt":source.get("receipt"),"blocker":"Named legal municipality only; not a consolidation of the full UN built-up area.","date_checked":"2026-09-20"})
    assert len(rows)==4
    return rows

def main():
    rows=asia_rows()+latam_rows()+europe_rows()+canada_rows()
    codes=[r["un_city_code"] for r in rows]; assert len(rows)==487 and len(set(codes))==487
    counts=Counter(r["classification"] for r in rows); regions=Counter(r["region"] for r in rows)
    payload={"schema_version":"1.0.0","dataset_id":"global-non-us-million-plus-coverage-v1","scope":"UN WUP 2025 Degree-of-Urbanization built-up areas with population >=1,000,000, excluding the United States; fiscal coverage is always the named legal-government anchor unless explicitly stated.","date_checked":"2026-09-20","counts":{"total":487,**dict(counts)},"region_counts":dict(regions),"cities":sorted(rows,key=lambda r:(-r["population_2025"],r["un_city_name"]))}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(payload["counts"],sort_keys=True),json.dumps(payload["region_counts"],sort_keys=True))
if __name__=="__main__": main()
