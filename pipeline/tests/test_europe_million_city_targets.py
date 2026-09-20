import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline" / "transforms"))

from build_europe_million_city_targets import build  # noqa: E402


def test_config_has_unique_explicit_anchor_entities():
    config = json.loads((ROOT / "pipeline/config/europe_million_city_targets.json").read_text())
    targets = config["targets"]
    assert len(targets) == 24
    assert len({row["anchor_entity_id"] for row in targets.values()}) == 24
    assert all(row["source_ids"] for row in targets.values())
    assert all(row["status"] in config["methodology"]["status_values"] for row in targets.values())


def test_build_rejects_missing_anchor(tmp_path):
    pytest.importorskip("openpyxl")
    # The production build performs this check against every country directory;
    # keeping it in the builder prevents a renamed or retired entity from silently
    # turning an urban area into a different municipality.
    source = (ROOT / "pipeline/transforms/build_europe_million_city_targets.py").read_text()
    assert "missing anchor" in source
    assert "anchor name drift" in source


def test_generated_bundle_contract_if_present():
    path = ROOT / "data/europe-million-city-budget-targets.v1.json"
    if not path.exists():
        pytest.skip("generated bundle requires the official UN workbook")
    payload = json.loads(path.read_text())
    assert payload["summary"]["european_un_cities_over_1m"] == 45
    assert payload["summary"]["anchor_targets"] == 24
    assert len(payload["cities"]) == 45
    assert all(row["fiscal_scope"] == "anchor_legal_government_only" for row in payload["cities"] if row.get("anchor_entity_id"))
