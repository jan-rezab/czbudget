import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def test_israel_audit_has_exact_registry_set_and_no_load_claim():
    audit=json.loads((ROOT/"pipeline/config/israel_million_city_budget_audit.json").read_text())
    assert {x["un_city_code"] for x in audit["cities"]}=={439}
    assert audit["cities"][0]["classification"]=="partial"
    assert audit["cities"][0]["production_load"] is None
    assert audit["jerusalem_review"]["registry_status"]=="not_in_project_un_million_anchor_set"
    assert "not the full UN" in audit["cities"][0]["government_boundary"]
