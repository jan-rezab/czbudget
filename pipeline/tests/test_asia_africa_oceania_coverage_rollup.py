import json, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_every_regional_anchor_has_exact_state():
    m=runpy.run_path(str(ROOT/"pipeline/transforms/build_asia_africa_oceania_coverage_rollup.py"));m["main"]()
    d=json.loads((ROOT/"data/major-cities/asia-africa-oceania-million-plus-coverage.v1.json").read_text())
    assert d["counts"]["total"]==378
    assert sum(d["counts"][x] for x in ("production_loaded","partial","hard_blocked"))==378
    assert len(d["cities"])==len({x["un_city_code"] for x in d["cities"]})==378
    assert d["counts"]=={"total":378,"production_loaded":56,"partial":120,"hard_blocked":202}
    taiwan={x["un_city_code"]:x for x in d["cities"] if x["un_city_code"] in (12128,12126)}
    assert set(taiwan)=={12128,12126}
    assert {x["classification"] for x in taiwan.values()}=={"production_loaded"}
    assert {x["verified_build_id"] for x in taiwan.values()}=={"bbf6b2ab-4ae4-49fc-b43a-15635abea327"}
    bangkok=next(x for x in d["cities"] if x["un_city_code"]==2286)
    assert bangkok["classification"]=="partial"
    assert "06dc6f3f-a2b2-435d-b029-206e05313fa2" in bangkok["blocker"]
    kazakhstan={x["un_city_code"]:x for x in d["cities"] if x["iso3"]=="KAZ"}
    assert set(kazakhstan)=={2965,2354,1705}
    assert {x["classification"] for x in kazakhstan.values()}=={"partial"}
    assert all("Akimat" in x["government_boundary"] for x in kazakhstan.values())
    casablanca=next(x for x in d["cities"] if x["un_city_code"]==2076)
    assert casablanca["classification"]=="partial"
    assert "PDF-only" in casablanca["blocker"]
    kuala_lumpur=next(x for x in d["cities"] if x["un_city_code"]==1629)
    assert kuala_lumpur["classification"]=="partial"
    assert "four headline" in kuala_lumpur["blocker"]
    kampala=next(x for x in d["cities"] if x["un_city_code"]==1866)
    assert kampala["classification"]=="partial"
    assert "Vote 122" in kampala["government_boundary"]
    tel_aviv=next(x for x in d["cities"] if x["un_city_code"]==439)
    assert tel_aviv["classification"]=="production_loaded"
    assert tel_aviv["verified_build_id"]=="c674a349-0cff-4f2e-a020-4e3b329b2b16"
    assert tel_aviv["immutable_receipt"].endswith("/c674a349-0cff-4f2e-a020-4e3b329b2b16/completed.json")
    nairobi=next(x for x in d["cities"] if x["un_city_code"]==2033)
    assert nairobi["classification"]=="hard_blocked"
    assert nairobi["warehouse_rows_loaded"]==0
    assert nairobi["verified_probe_build_ids"]==["2c511353-18ce-4f9d-bfd6-e2c02079ddc6","3743cdf4-917e-46ba-bae3-6e362ce123ee"]
    assert "grid export of document names" in nairobi["blocker"]
    istanbul=next(x for x in d["cities"] if x["un_city_code"]==2626)
    assert istanbul["classification"]=="production_loaded"
    assert istanbul["verified_build_id"]=="2886b80c-b634-469a-97cc-2c552dc0d06f"
    assert istanbul["warehouse_rows"]==1515
    assert istanbul["government_boundary"].startswith("İstanbul Büyükşehir")
    assert istanbul["immutable_receipt"].endswith("/2886b80c-b634-469a-97cc-2c552dc0d06f/completed.json")
    turkey={x["un_city_code"]:x for x in d["cities"] if x["un_city_code"] in (4941,1069,3124,6315)}
    assert set(turkey)=={4941,1069,3124,6315}
    assert all(x["classification"]=="hard_blocked" and x["warehouse_rows_loaded"]==0 for x in turkey.values())
    assert all(x["verified_probe_build_ids"]==["4077233d-cd92-45f2-9287-e06a78486188"] for x in turkey.values())
    assert all(x["classification"] in {"production_loaded","partial","hard_blocked"} for x in d["cities"])
    assert all(x["anchor_only"] is True and x["blocker"] for x in d["cities"])
