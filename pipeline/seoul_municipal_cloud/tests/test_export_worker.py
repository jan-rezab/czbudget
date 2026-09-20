import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("seoul_export", ROOT / "seoul_municipal_cloud/export_worker.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_contract_uses_no_secret_https_export():
    contract = module.load_contract(ROOT / "config/seoul_budget_source.json")
    assert contract["source"]["status"] == "no_secret_xlsx_export_verified"
    assert contract["source"]["fiscal_year"] == 2025
    assert contract["source"]["export_url"].startswith("https://")
    assert contract["entity"]["un_city_code"] == 332


def test_project_row_normalizes_three_published_measures():
    contract = module.load_contract(ROOT / "config/seoul_budget_source.json")
    row = {"번호":"1","회계구분":"일반회계","부서명":"감사위원회 감사담당관","세부사업명":"감사활동 지원","분야":"일반공공행정","예산현액":"1,250","지출액":"500","집행잔액":"750"}
    facts = module.normalize(row, contract, 1, "2026-09-20T00:00:00+00:00", "test-run")
    assert [fact["budget_stage"] for fact in facts] == ["current_budget", "actual", "unspent_balance"]
    assert [fact["amount_local"] for fact in facts] == ["1250", "500", "750"]
    assert all(not fact["is_summary_row"] and not fact["is_imputed"] for fact in facts)
    assert all("anchor_legal_government_only" in fact["quality_flags"] for fact in facts)
