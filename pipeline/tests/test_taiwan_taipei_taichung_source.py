import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "pipeline/taiwan_taipei_taichung_cloud/worker.py"
CONFIG = ROOT / "pipeline/config/taiwan_taipei_taichung_sources.json"

spec = importlib.util.spec_from_file_location("taiwan_tpe_txg_worker", WORKER)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def test_contract_has_exact_two_remaining_taiwan_un_anchors():
    config = json.loads(CONFIG.read_text())
    assert {city["un_city_code"] for city in config["cities"]} == {12128, 12126}
    assert all("anchor legal government" in city["boundary"] for city in config["cities"])
    assert all(city["download_url"].startswith("https://") for city in config["cities"])


def test_taipei_parser_keeps_coded_agencies_and_excludes_total():
    body = ("<Root><Row><款></款><名稱>合計</名稱><合計>999</合計></Row>" + "".join(
        f"<Row><款>{i:02d}</款><名稱>A{i}</名稱><合計>{i}</合計></Row>" for i in range(1, 29)
    ) + "</Root>").encode("utf-8")
    rows = worker.parse_taipei(body)
    assert len(rows) == 28
    assert {row["stage"] for row in rows} == {"enacted"}


def test_taichung_parser_maps_only_budget_and_original_actual():
    rows = []
    for i in range(27):
        label = f"Agency {i}"
        rows.extend([
            {"項目": "地方總決算歲出機關別-預算數(單位:元)", "欄位名稱": label, "數值": str(i + 1)},
            {"項目": "地方總決算歲出機關別-原列決算數(單位:元)", "欄位名稱": label, "數值": str(i + 2)},
            {"項目": "地方總決算歲出機關別-決算審定數(單位:元)", "欄位名稱": label + "_實現數", "數值": str(i + 2)},
        ])
    parsed = worker.parse_taichung(json.dumps(rows, ensure_ascii=False).encode())
    assert len(parsed) == 54
    assert {stage: sum(row["stage"] == stage for row in parsed) for stage in ("enacted", "actual")} == {"enacted": 27, "actual": 27}
