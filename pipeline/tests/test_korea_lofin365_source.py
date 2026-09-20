import importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_exact_un_registry_city_set_and_main_office_codes():
    config=json.loads((ROOT/"pipeline/config/korea_lofin365_city_sources.json").read_text())
    assert {c["un_city_code"] for c in config["cities"]}=={3878,2915,2214,2656}
    assert {c["legal_government_code"] for c in config["cities"]}=={"2600000","2700000","3000000","2900000"}
    assert all("main office only" in c["boundary"] and "excluded" in c["boundary"] for c in config["cities"])
    assert config["source_contract"]["stage_mapping"]=={"amt1":"current_budget","amt6":"actual","amt7":"unspent_balance"}
def test_normalization_has_no_summary_or_imputation():
    spec=importlib.util.spec_from_file_location("korea_worker",ROOT/"pipeline/korea_lofin365_cloud/worker.py"); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    config=json.loads((ROOT/"pipeline/config/korea_lofin365_city_sources.json").read_text()); city=config["cities"][0]
    row={"rn":"1","rsltYr":"2025","lafCd":"2600000","code":"6260000202130263","codeNm":"부산","codeNm2":"본청","codeNm3":"일반회계","codeNm4":"프로젝트","codeNm5":"문화및관광","codeNm6":"문화재","amt1":100,"amt6":60,"amt7":40}
    facts=module.facts_for_city([row],city,config,"2026-09-20T00:00:00Z","test")
    assert [f["budget_stage"] for f in facts]==["current_budget","actual","unspent_balance"]
    assert [f["amount_local"] for f in facts]==["100","60","40"]
    assert all(not f["is_summary_row"] and not f["is_imputed"] for f in facts)
