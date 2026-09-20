import json, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_global_non_us_rollup_is_exact_and_evidenced():
    m=runpy.run_path(str(ROOT/"pipeline/transforms/build_global_non_us_million_city_coverage.py"));m["main"]()
    d=json.loads((ROOT/"data/major-cities/global-non-us-million-plus-coverage.v1.json").read_text())
    assert d["region_counts"]=={"Asia/Africa/Oceania":378,"Latin America/Caribbean":60,"Europe":45,"Canada":4}
    assert d["counts"]["total"]==487
    assert d["counts"]=={"total":487,"production_loaded":136,"partial":120,"hard_blocked":231}
    assert sum(d["counts"][s] for s in ("production_loaded","partial","hard_blocked"))==487
    assert len(d["cities"])==len({x["un_city_code"] for x in d["cities"]})==487
    assert {x["un_city_code"] for x in d["cities"] if x["region"]=="Canada"}=={2925,3645,341,1126}
    assert all(x["anchor_only"] and x["blocker"] and x["classification"] in {"production_loaded","partial","hard_blocked"} for x in d["cities"])
    loaded=[x for x in d["cities"] if x["classification"]=="production_loaded"]
    assert sum(x["region"]=="Europe" for x in loaded)==30
    assert all(x.get("official_source_url") or x.get("source") or x.get("profile_url") or x.get("source_ids") for x in loaded)
    assert all(x.get("immutable_receipt") or x.get("warehouse_verification") or x.get("profile_url") or x.get("published_detail_rows") or x.get("warehouse_rows") for x in loaded)
