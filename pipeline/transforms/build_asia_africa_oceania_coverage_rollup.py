#!/usr/bin/env python3
"""Build the exact 378-anchor regional coverage state from audited/load contracts."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/major-cities/asia-africa-oceania-million-plus.v1.json"
OUT = ROOT / "data/major-cities/asia-africa-oceania-million-plus-coverage.v1.json"

def read(path): return json.loads((ROOT / path).read_text())

def city_codes(path):
    return {int(city["un_city_code"]) for city in read(path)["cities"]}

def main():
    base = read("data/major-cities/asia-africa-oceania-million-plus.v1.json")
    loaded = {}
    for path, source, build, receipt in [
        ("pipeline/config/india_cityfinance_sources.json", "India City Finance", "b2bbea52-51f8-4504-bd1c-178c8fb0947c", "gs://czbudget-janrezab-data-layers/processing-runs/india-cityfinance/b2bbea52-51f8-4504-bd1c-178c8fb0947c/completed.json"),
        ("pipeline/config/philippines_blgf_sre_source.json", "Philippines BLGF SRE", "89057cd5-b884-48f8-a0fe-81caf02ebcdb", "gs://czbudget-janrezab-data-layers/processing-runs/philippines-blgf-sre/89057cd5-b884-48f8-a0fe-81caf02ebcdb/completed.json"),
        ("pipeline/config/indonesia_djpk_apbd_sources.json", "Indonesia DJPK APBD", "17b0c866-1a0d-43a9-86f4-04aab1847eaf", "gs://czbudget-janrezab-data-layers/processing-runs/indonesia-djpk-apbd/17b0c866-1a0d-43a9-86f4-04aab1847eaf/completed.json"),
    ]:
        for code in city_codes(path): loaded[code] = (source, build, receipt)
    for code, name, rows in [(413,"South African Treasury municipal API",2002),(3664,"South African Treasury municipal API",571),(5227,"South African Treasury municipal API",1642),(4244,"South African Treasury municipal API",1453),(4433,"South African Treasury municipal API",930)]:
        loaded[code] = (name, "f7bece9a-19da-4893-9c7c-9b2cde37cb36", "gs://czbudget-janrezab-data-layers/processing-runs/south-africa-municipal/f7bece9a-19da-4893-9c7c-9b2cde37cb36/completed.json")
    loaded[11566] = ("Hong Kong 2025-26 Estimates", "2891e289-2714-4eff-a864-ced789296e4c", "gs://czbudget-janrezab-data-layers/processing-runs/hong-kong-budget/2891e289-2714-4eff-a864-ced789296e4c/warehouse-loaded.json")
    loaded[12135] = ("Kaohsiung City Government open budget dataset 101174", "8e764c97-7ec7-4c4d-ac4d-07264c946f57", "gs://czbudget-janrezab-data-layers/processing-runs/taiwan-city-budget/8e764c97-7ec7-4c4d-ac4d-07264c946f57/completed.json")
    for code in (12128, 12126):
        loaded[code] = ("Taipei/Taichung official city open-budget data", "bbf6b2ab-4ae4-49fc-b43a-15635abea327", "gs://czbudget-janrezab-data-layers/processing-runs/taiwan-taipei-taichung/bbf6b2ab-4ae4-49fc-b43a-15635abea327/completed.json")
    loaded[332] = ("Seoul Metropolitan Government FY2025 project budget/execution XLSX", "b2137799-28c1-4ac3-ad33-e22573486db4", "gs://czbudget-janrezab-data-layers/processing-runs/seoul-project-budget/b2137799-28c1-4ac3-ad33-e22573486db4/completed.json")
    for code in (3878, 2915, 2214, 2656):
        loaded[code] = ("Korea Local Finance 365 FY2025 metropolitan main-office project budget/execution", "a4558e2c-6757-40f4-99a1-3c81ec9c32dc", "gs://czbudget-janrezab-data-layers/processing-runs/korea-lofin365-city/a4558e2c-6757-40f4-99a1-3c81ec9c32dc/completed.json")
    loaded[439] = ("Israel Ministry of Interior audited local-authority Form 2", "c674a349-0cff-4f2e-a020-4e3b329b2b16", "gs://czbudget-janrezab-data-layers/processing-runs/israel-tel-aviv/c674a349-0cff-4f2e-a020-4e3b329b2b16/completed.json")
    loaded[2626] = ("İstanbul Metropolitan Municipality 2025 coded final-account XLSX", "2886b80c-b634-469a-97cc-2c552dc0d06f", "gs://czbudget-janrezab-data-layers/processing-runs/istanbul-metropolitan/2886b80c-b634-469a-97cc-2c552dc0d06f/completed.json")

    partial = {}
    for audit_path in ["pipeline/config/pakistan_bangladesh_million_city_audit.json", "pipeline/config/china_taiwan_vietnam_million_city_audit.json", "pipeline/config/egypt_nigeria_million_city_audit.json"]:
        audit = read(audit_path)
        for row in audit["cities"]:
            if row["classification"] == "partial": partial[int(row["un_city_code"])] = row
    blocked = {}
    for audit_path in ["pipeline/config/kenya_nairobi_city_audit.json", "pipeline/config/turkey_metropolitan_followon_audit.json"]:
        audit = read(audit_path)
        for row in audit["cities"]:
            if row["classification"] == "hard_blocked": blocked[int(row["un_city_code"])] = row
    # Verified source adapters or domain-limited warehouse loads that cannot claim a complete city budget.
    partial.update({
        165: {"official_source_url":"https://data.gov.sg/datasets/d_11f25a62a23dd91abf01ef74f558b0d3/view","blocker":"Official machine-readable sector table has only 25 headline rows and does not meet item-level coverage."},
        1634: {"official_source_url":"https://data.melbourne.vic.gov.au/explore/dataset/planned-capital-works-and-maintenance-2014-15-with-funding-sources/","blocker":"133 production rows cover FY2015 capital projects only, not the complete City of Melbourne budget."},
        2591: {"official_source_url":"https://data.brisbane.qld.gov.au/explore/dataset/grants-recipients/","blocker":"960 production rows cover grants only, not the complete Brisbane City Council budget."},
        2286: {"official_source_url":"https://data.bangkok.go.th/th/dataset/2568","government_boundary":"Bangkok Metropolitan Administration legal special local government only; anchor government, not the full UN Degree-of-Urbanization built-up area.","blocker":"Official FY2568 enacted citywide and agency-level XLS/XLSX workbooks are cataloged, but data.bangkok.go.th resets direct/API connections from both local and Google Cloud Build (probe 06dc6f3f-a2b2-435d-b029-206e05313fa2); no source bytes, hashes, or verified rows, so no load is claimed."},
        2965: {"official_source_url":"https://budget.egov.kz/application/search?budgetStatus=ALL&govAgencyId=3679&page=99&searchType=ALL","government_boundary":"Akimat of Almaty, city of republican significance; legal-city anchor only, not the full UN built-up area.","blocker":"Official coded budget-program pages exist, but no reproducible unauthenticated bulk city export/API contract was verified; mixed per-document HTML/files prevent exhaustive hashes and row counts. No load claimed."},
        2354: {"official_source_url":"https://budget.egov.kz/budgetprogram/budgetprogram?budgetId=4354859&govAgencyId=3678","government_boundary":"Akimat of Shymkent, city of republican significance; legal-city anchor only, not the full UN built-up area.","blocker":"Official coded plan/fact program pages exist, but no reproducible unauthenticated bulk city export/API contract was verified; mixed per-document HTML/files prevent exhaustive hashes and row counts. No load claimed."},
        1705: {"official_source_url":"https://budget.egov.kz/budgetexecutecontroller/incomeexpense","government_boundary":"Akimat of Astana, capital city local government; legal-city anchor only, not the full UN built-up area.","blocker":"Official execution UI has region/period filters and download control, but the export requires opaque interactive state and no stable unauthenticated city API contract was verified. No load claimed."},
        2076: {"official_source_url":"https://www.casablancacity.ma/fr/article/323/etats-financiers-de-la-commune-de-casablanca","government_boundary":"Commune de Casablanca legal municipal government only; anchor government, not the full UN Degree-of-Urbanization built-up area.","blocker":"Official FY2026 budget and FY2024 execution schedules are detailed but every current/historical resource linked by the commune is PDF-only; no official XLS/XLSX/CSV/JSON/API resource was found. No machine-readable load claimed."},
        1629: {"official_source_url":"https://www.dbkl.gov.my/files/data-terbuka/ringkasan-bajet-hasil-dan-belanja-dbkl.xlsx","government_boundary":"Dewan Bandaraya Kuala Lumpur legal city authority only; anchor government, not the full UN Degree-of-Urbanization built-up area.","blocker":"Official XLSX hash 4242bc20ee035d2f2059e32efec05cbaccc2647014aa4361f0e2c20dd0911b40 has only four headline budget categories per year through 2023 and no agency/programme/project/object codes. No line-item load claimed."},
        1866: {"official_source_url":"https://budget.finance.go.ug/dashboard","government_boundary":"Kampala Capital City Authority (Vote 122) legal authority, including five subordinate city divisions; anchor government only, not the full UN built-up area.","blocker":"Official KCCA documents expose vote/programme/sub-programme/department/output/economic codes and plan/performance amounts, but the public portal provides Tableau/dashboard views and PDFs with no verified stable unauthenticated complete CSV/JSON export contract. No load claimed."},
    })
    # Existing served Japanese municipal profiles are genuine itemized actuals, although anchor-only.
    served = {int(city["un_city_code"]) for city in base["cities"] if city["iso3"] == "JPN" and city["coverage_status"] == "anchor_only"}
    hard_evidence = {
        3566: {"official_source_url":"https://www.tamisemi.go.tz/","government_boundary":"No single legal-government anchor: the UN built-up area spans Dar es Salaam/Ilala City Council and Kinondoni, Temeke, Ubungo and Kigamboni municipal councils.","blocker":"PO-RALG systems are council-specific and no official machine-readable consolidated export covering all five Dar es Salaam councils was verified."}
    }

    rows=[]
    for city in base["cities"]:
        code=int(city["un_city_code"]); row={k:city[k] for k in ("un_city_code","un_city_name","country","iso3","population_2025")}
        row.update({"anchor_only": True, "government_boundary": city.get("fiscal_scope") or "No reviewed legal-government boundary mapping", "date_checked":"2026-09-20"})
        if code in loaded:
            source, build, receipt=loaded[code]; row.update({"classification":"production_loaded","coverage_domain":"official coded municipal budget/execution line items","source":source,"verified_build_id":build,"immutable_receipt":receipt,"blocker":"Full UN built-up-area consolidation is not measured."})
            if code==2626: row.update({"government_boundary":"İstanbul Büyükşehir Belediye Başkanlığı (legal metropolitan municipality; districts and affiliates excluded)","official_source_url":"https://uploads.ibb.istanbul/uploads/2025_yili_kesin_hesap_a7055163c7.zip","fiscal_year":2025,"budget_stages":["enacted","actual"],"warehouse_rows":1515,"archive_sha256":"c174f5c7b36f04ae0495bc52b858b3b0c88c3a1847c1908d35f4702fc822c9fb"})
        elif code in served:
            row.update({"classification":"production_loaded","coverage_domain":"served official Japanese municipal actual line items","official_source_url":city.get("source_url"),"fiscal_year":city.get("fiscal_year"),"published_detail_rows":city.get("published_detail_rows"),"blocker":"Full UN built-up-area consolidation is not measured."})
        elif code in partial:
            evidence=partial[code]; row.update({"classification":"partial","coverage_domain":"source verified but incomplete, domain-limited, credential-blocked, or load pending","official_source_url":evidence.get("official_source_url") or evidence.get("official_url"),"blocker":evidence.get("blocker") or evidence.get("evidence")})
            if evidence.get("government_boundary"): row["government_boundary"]=evidence["government_boundary"]
        elif code in blocked:
            evidence=blocked[code]; row.update({"classification":"hard_blocked","coverage_domain":"official sources reviewed; no production-qualifying machine-readable itemized anchor","government_boundary":evidence["government_boundary"],"official_source_url":evidence["official_source_url"],"secondary_official_source_url":evidence.get("secondary_official_source_url"),"verified_probe_build_ids":evidence["verified_probe_build_ids"],"warehouse_rows_loaded":evidence["warehouse_rows_loaded"],"blocker":evidence["blocker"]})
        else:
            row.update({"classification":"hard_blocked","coverage_domain":"no reviewed production-qualifying itemized anchor","official_source_url":None,"blocker":city.get("blocker") or "No reviewed published itemized anchor mapping"})
            if code in hard_evidence:
                row.update(hard_evidence[code])
        rows.append(row)
    counts=Counter(r["classification"] for r in rows)
    by_country={}
    for r in rows:
        c=by_country.setdefault(r["iso3"],{"total":0,"production_loaded":0,"partial":0,"hard_blocked":0}); c["total"]+=1;c[r["classification"]]+=1
    assert len(rows)==378 and sum(counts.values())==378
    payload={"schema_version":"1.0.0","dataset_id":"asia-africa-oceania-million-plus-coverage-v1","generated_from":str(BASE.relative_to(ROOT)),"methodology":"Each UN built-up-area anchor receives exactly one state. production_loaded requires verified warehouse/served item rows; partial covers incomplete domains, source-only evidence, credentials, or pending loads; hard_blocked means no reviewed production-qualifying itemized legal-government anchor. All coverage is anchor-only unless explicitly stated.","counts":{"total":378,**dict(counts)},"by_country":dict(sorted(by_country.items())),"cities":rows}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(payload["counts"],sort_keys=True))

if __name__=="__main__": main()
