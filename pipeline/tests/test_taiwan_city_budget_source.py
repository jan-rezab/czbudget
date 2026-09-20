import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "pipeline/config/taiwan_city_budget_sources.json"

def test_kaohsiung_verified_source_contract_is_stable_without_raw_fixture():
    config = json.loads(CONFIG.read_text())
    verified = config["verified_run"]
    assert verified["warehouse_rows"] == 29
    assert verified["warehouse_amount_twd"] == 193651554000
    assert verified["source_sha256"] == "f23f5e40fe0a95f001e06f7c279c81a179e3b19c26105e0e2b72499a83e9bba1"
    assert verified["receipt"].endswith("/8e764c97-7ec7-4c4d-ac4d-07264c946f57/completed.json")
    city = config["cities"][0]
    assert city["csv_url"].startswith("https://")
    assert "anchor legal government" in city["boundary"]
