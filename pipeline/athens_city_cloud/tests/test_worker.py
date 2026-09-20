import importlib.util
from decimal import Decimal
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "worker.py"
SPEC = importlib.util.spec_from_file_location("athens_worker", MODULE)
WORKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKER)


def test_money_preserves_decimal_and_rejects_missing():
    assert WORKER.money("123.45") == Decimal("123.45")
    assert WORKER.money(None) is None


def test_stage_contract_maps_approved_revised_and_cash_actual():
    assert WORKER.SOURCES["gr-moi-municipal-execution-revenue-2024"]["stages"] == {9: "enacted", 10: "revised", 8: "actual"}
    assert WORKER.SOURCES["gr-moi-municipal-execution-expenditure-2024"]["stages"] == {8: "enacted", 9: "revised", 11: "actual"}
