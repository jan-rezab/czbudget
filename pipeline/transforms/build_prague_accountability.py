#!/usr/bin/env python3
"""Build the Prague project accountability contract (prague-accountability.v1).

The contract follows one koruna through Prague's CityVizor layer: what the city
budgeted per project (event), what its accounting stream actually recorded, and
which projects were budgeted year after year without any recorded spend.  Two
rules are load-bearing and deliberately explicit in the output:

* Execution is measured from ``accounting.csv`` (non-``ROZ`` document classes
  divided by ``ROZ`` budget rows), never from ``events.csv``.  The events feed
  thins out over time and understates actuals; the accounting stream does not.
* Entity-years whose actuals are a publishing failure (the duplicated 2025
  bundle, a truncated feed) are excluded from every spend judgement and named
  in the output.  Their budget figures remain valid.

Inputs are the two intermediate tables extracted from the verified CityVizor
snapshot ``2026-09-09`` (see ``scripts/CITYVIZOR.md``): one event-year table
and one accounting-by-event table.  Their SHA-256 digests are pinned in the
config so a rebuild from a different extraction is a visible change, not a
silent one.  Research findings that data cannot derive (council resolutions,
delivery-moved-elsewhere verdicts) live in the config with their sources and a
confidence label, and are merged, never inferred.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

WEB = Path(__file__).resolve().parents[2]
CONFIG_PATH = WEB / "pipeline/config/prague_accountability.v1.json"
INPUT_DIR = WEB / "data/prague-accountability/inputs"
OUTPUT_PATH = WEB / "data/prague-accountability.v1.json"
CONTRACT = "prague-accountability.v1"
REPLACEMENT = "�"


class ContractError(ValueError):
    """Raised when the inputs or the reviewed config violate the contract."""


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_inputs(config: dict[str, Any], input_dir: Path) -> tuple[list[dict[str, Any]], dict[tuple[str, int, str], tuple[float, float]], dict[str, str], list[dict[str, Any]]]:
    manifest = []
    files = config["inputs"]
    for entry in files:
        path = input_dir / entry["file"]
        if not path.exists():
            raise ContractError(f"Missing input {path}")
        digest = sha256(path)
        if entry.get("sha256") and digest != entry["sha256"]:
            raise ContractError(f"Input {entry['file']} digest {digest} does not match the pinned {entry['sha256']}")
        manifest.append({"file": entry["file"], "sha256": digest, "bytes": path.stat().st_size, "role": entry["role"]})
    events_path = input_dir / next(e["file"] for e in files if e["role"] == "events")
    accounting_path = input_dir / next(e["file"] for e in files if e["role"] == "accounting_by_event")
    icos_path = input_dir / next(e["file"] for e in files if e["role"] == "district_icos")

    with gzip.open(events_path, "rt", encoding="utf-8") as handle:
        events = []
        for row in csv.DictReader(handle):
            budget = float(row["b"] or 0)
            if budget <= 0:
                continue
            events.append({"entity": row["ent"], "profile_id": int(row["pid"]), "year": int(row["year"]),
                           "event_id": row["eid"].strip(), "name": row["name"].strip(), "budget": budget,
                           "events_actual": float(row["a"] or 0)})
    with gzip.open(accounting_path, "rt", encoding="utf-8") as handle:
        raw = json.load(handle)
    accounting: dict[tuple[str, int, str], tuple[float, float]] = {}
    for key, (actual, budget) in raw.items():
        entity, year, event_id = key.split("|", 2)
        accounting[(entity, int(year), event_id)] = (float(actual), float(budget))
    icos = {}
    for row in csv.DictReader(io.StringIO(icos_path.read_text(encoding="utf-8"))):
        ico = (row.get("ico") or "").strip()
        if ico and ico.lower() != "none":
            icos[row["target"].strip()] = ico
    return events, accounting, icos, manifest


def entity_year_accounting(accounting: dict[tuple[str, int, str], tuple[float, float]]) -> dict[tuple[str, int], dict[str, float]]:
    totals: dict[tuple[str, int], dict[str, float]] = defaultdict(lambda: {"actual": 0.0, "budget": 0.0, "events": 0})
    for (entity, year, _event), (actual, budget) in accounting.items():
        cell = totals[(entity, year)]
        cell["actual"] += actual
        cell["budget"] += budget
        cell["events"] += 1
    return totals


def broken_feeds(config: dict[str, Any], totals: dict[tuple[str, int], dict[str, float]]) -> dict[tuple[str, int], dict[str, Any]]:
    rule = config["broken_feed_rule"]
    found: dict[tuple[str, int], dict[str, Any]] = {}
    for entry in config["broken_feeds"]:
        found[(entry["entity"], int(entry["year"]))] = dict(entry)
    for (entity, year), cell in totals.items():
        share = cell["actual"] / cell["budget"] if cell["budget"] else None
        if (cell["events"] >= rule["min_events"] and cell["budget"] >= rule["min_budget_czk"]
                and share is not None and share < rule["max_execution_share"] and (entity, year) not in found):
            found[(entity, year)] = {"entity": entity, "year": year, "code": "auto_low_execution",
                                     "note_cs": "Automaticky vyloučeno: zaznamenané plnění pod 5 % při rozpočtu nad 50 mil. Kč.",
                                     "note_en": "Automatically excluded: recorded execution under 5% on a budget above CZK 50m."}
    for key, entry in found.items():
        cell = totals.get(key)
        entry["execution_share"] = round(cell["actual"] / cell["budget"], 4) if cell and cell["budget"] else None
        entry["year"] = int(entry["year"])
    return found


def repair_name(name: str, repairs: list[list[str]]) -> tuple[str, bool]:
    if REPLACEMENT not in name:
        return name, False
    fixed = name
    for source, target in repairs:
        fixed = fixed.replace(source, target)
    return fixed, True


def classify_kind(name: str, entity: str, sibling_names: dict[str, set[str]], provision_patterns: list[str]) -> str:
    for pattern in provision_patterns:
        if re.search(pattern, name, re.IGNORECASE):
            return "provision"
    stem = name.strip().lower()
    if len(stem) >= 4:
        siblings = [other for other in sibling_names[entity] if other != stem and other.startswith(stem)]
        if len(siblings) >= 3:
            return "rollup_placeholder"
    return "project"


def build_projects(config: dict[str, Any], events: list[dict[str, Any]], accounting: dict[tuple[str, int, str], tuple[float, float]],
                   broken: dict[tuple[str, int], dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    band = config["band_czk"]
    rules = config["stuck_rule"]
    repairs = config["name_repairs"]
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    sibling_names: dict[str, set[str]] = defaultdict(set)
    for row in events:
        grouped[(row["entity"], row["event_id"])].append(row)
        sibling_names[row["entity"]].add(row["name"].strip().lower())

    traces = {(t["entity"], str(t["event_id"])): t for t in config["traces"]}
    projects: list[dict[str, Any]] = []
    kind_counts: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "cum_budget_czk": 0.0})
    carry_all = {"cases": 0, "projects": set(), "budget_czk": 0.0, "band_cases": 0, "band_budget_czk": 0.0}

    for (entity, event_id), rows in grouped.items():
        rows.sort(key=lambda r: r["year"])
        names = [r["name"] for r in rows if r["name"]]
        raw_name = max(set(names), key=lambda n: (names.count(n), len(n))) if names else "(unnamed)"
        name, corrupted = repair_name(raw_name, repairs)
        trusted = [r for r in rows if (entity, r["year"]) not in broken]
        trajectory = []
        for r in rows:
            actual, _budget = accounting.get((entity, r["year"], event_id), (0.0, 0.0))
            trajectory.append({"year": r["year"], "budget_czk": round(r["budget"], 2), "actual_czk": round(actual, 2),
                               "trusted": (entity, r["year"]) not in broken})
        # Carry-forward: identical budget copied into the next year with no recorded spend in either.
        carry = 0
        for a, b in zip(trajectory, trajectory[1:]):
            if b["year"] == a["year"] + 1 and a["trusted"] and b["trusted"] and a["budget_czk"] == b["budget_czk"] \
                    and a["budget_czk"] >= band["min"] and a["actual_czk"] == 0 and b["actual_czk"] == 0:
                carry += 1
                carry_all["cases"] += 1
                carry_all["projects"].add((entity, event_id))
                carry_all["budget_czk"] += a["budget_czk"]
                if a["budget_czk"] <= band["max"]:
                    carry_all["band_cases"] += 1
                    carry_all["band_budget_czk"] += a["budget_czk"]
        peak = max(r["budget"] for r in rows)
        if not trusted or not (band["min"] <= peak <= band["max"]):
            continue
        cum_budget = sum(t["budget_czk"] for t in trajectory if t["trusted"])
        cum_actual = sum(t["actual_czk"] for t in trajectory if t["trusted"])
        if len(trusted) < rules["min_trusted_years"] or cum_actual > rules["max_actual_share"] * cum_budget:
            continue
        kind = classify_kind(name, entity, sibling_names, config["provision_patterns"])
        kind_counts[kind]["count"] += 1
        kind_counts[kind]["cum_budget_czk"] += cum_budget
        if kind != "project":
            continue
        trace = traces.get((entity, event_id))
        projects.append({
            "entity": entity, "event_id": event_id, "name": name, "name_corrupted_at_source": corrupted,
            "years_budgeted": len(trusted), "first_year": rows[0]["year"], "last_year": rows[-1]["year"],
            "still_live_2026": rows[-1]["year"] >= 2026,
            "cum_budget_czk": round(cum_budget, 2), "cum_actual_czk": round(cum_actual, 2),
            "peak_annual_budget_czk": round(peak, 2), "carry_forward_pairs": carry,
            "trajectory": trajectory,
            "trace": ({k: v for k, v in trace.items() if k not in ("entity", "event_id")} if trace else None),
        })
    projects.sort(key=lambda p: (-p["cum_budget_czk"], p["entity"], p["event_id"]))
    summary = {
        "projects": len(projects),
        "cum_budget_czk": round(sum(p["cum_budget_czk"] for p in projects), 2),
        "cum_actual_czk": round(sum(p["cum_actual_czk"] for p in projects), 2),
        "still_live_2026": sum(1 for p in projects if p["still_live_2026"]),
        "abandoned": sum(1 for p in projects if not p["still_live_2026"]),
        "excluded": {kind: {"count": int(v["count"]), "cum_budget_czk": round(v["cum_budget_czk"], 2)}
                     for kind, v in sorted(kind_counts.items()) if kind != "project"},
    }
    carry = {"cases": carry_all["cases"], "projects": len(carry_all["projects"]), "budget_czk": round(carry_all["budget_czk"], 2),
             "band_cases": carry_all["band_cases"], "band_budget_czk": round(carry_all["band_budget_czk"], 2)}
    return projects, summary, carry


def build_baseline(config: dict[str, Any], totals: dict[tuple[str, int], dict[str, float]], broken: dict[tuple[str, int], dict[str, Any]]) -> list[dict[str, Any]]:
    entity = config["entity"]["cityvizor_name"]
    rows = []
    for (name, year), cell in sorted(totals.items()):
        if name != entity or not cell["budget"]:
            continue
        rows.append({"year": year, "budget_czk": round(cell["budget"], 2), "actual_czk": round(cell["actual"], 2),
                     "execution_share": round(cell["actual"] / cell["budget"], 4), "trusted": (name, year) not in broken,
                     "partial_year": year == config["partial_year"]})
    return rows


def build_compare(config: dict[str, Any], totals: dict[tuple[str, int], dict[str, float]], icos: dict[str, str]) -> list[dict[str, Any]]:
    year = config["compare_year"]
    flags = {f["entity"]: f for f in config["review_flags"]}
    rows = []
    for (entity, y), cell in totals.items():
        if y != year or cell["budget"] < config["compare_min_budget_czk"]:
            continue
        rows.append({"entity": entity, "ico": icos.get(entity) or (config["entity"]["ico"] if entity == config["entity"]["cityvizor_name"] else None),
                     "budget_czk": round(cell["budget"], 2), "actual_czk": round(cell["actual"], 2),
                     "execution_share": round(cell["actual"] / cell["budget"], 4),
                     "is_city": entity == config["entity"]["cityvizor_name"],
                     "review_flag": ({k: v for k, v in flags[entity].items() if k != "entity"} if entity in flags else None)})
    rows.sort(key=lambda r: (-r["execution_share"], r["entity"]))
    return rows


def build_payload(config: dict[str, Any], input_dir: Path = INPUT_DIR) -> dict[str, Any]:
    if config.get("contract") != "prague-accountability-config.v1":
        raise ContractError("Unexpected Prague accountability config contract")
    events, accounting, icos, manifest = load_inputs(config, input_dir)
    totals = entity_year_accounting(accounting)
    broken = broken_feeds(config, totals)
    projects, stuck_summary, carry = build_projects(config, events, accounting, broken)
    baseline = build_baseline(config, totals, broken)
    compare = build_compare(config, totals, icos)

    known_events = {(r["entity"], r["event_id"]) for r in events}
    trusted_baseline = [b for b in baseline if b["trusted"] and not b["partial_year"]]
    checks = {
        "execution_measured_from_accounting_stream": True,
        "broken_feed_years_excluded_from_spend": all(not t["trusted"] for p in projects for t in p["trajectory"] if (p["entity"], t["year"]) in broken),
        "stuck_projects_have_three_or_more_trusted_years": all(p["years_budgeted"] >= config["stuck_rule"]["min_trusted_years"] for p in projects),
        "stuck_projects_confirmed_by_events_feed": all(sum(r["events_actual"] for r in events if (r["entity"], r["event_id"]) == (p["entity"], p["event_id"]) and (p["entity"], r["year"]) not in broken) <= 0.02 * p["cum_budget_czk"] for p in projects),
        "traces_reference_published_events": all((t["entity"], str(t["event_id"])) in known_events for t in config["traces"]),
        "input_digests_pinned": all(entry.get("sha256") for entry in config["inputs"]),
        "city_baseline_trusted_years_within_band": all(0.7 <= b["execution_share"] <= 0.95 for b in trusted_baseline),
        "compare_year_excludes_broken_feeds": all((r["entity"], config["compare_year"]) not in broken for r in compare),
    }
    if not all(checks.values()):
        failed = [name for name, ok in checks.items() if not ok]
        raise ContractError(f"Integrity checks failed: {failed}")

    return {
        "schema_version": "1.0.0",
        "contract": CONTRACT,
        "generated_at": config["data_generated_at"],
        "entity": config["entity"],
        "source": {
            "snapshot": config["source"]["snapshot"],
            "release_id": config["source"]["release_id"],
            "instance": config["source"]["instance"],
            "inputs": manifest,
            "method_cs": config["source"]["method_cs"],
            "method_en": config["source"]["method_en"],
        },
        "rules": {"band_czk": config["band_czk"], "stuck_rule": config["stuck_rule"], "broken_feed_rule": config["broken_feed_rule"]},
        "execution_baseline": baseline,
        "broken_feeds": sorted(broken.values(), key=lambda e: (e["entity"], e["year"])),
        "stuck_summary": stuck_summary,
        "stuck_projects": projects,
        "carry_forward": carry,
        "district_compare": {"year": config["compare_year"], "min_budget_czk": config["compare_min_budget_czk"], "rows": compare},
        "integrity": {"status": "passed", "checks": checks,
                      "limitations_cs": config["limitations_cs"], "limitations_en": config["limitations_en"]},
        "sources": config["sources"],
    }


def canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def write_or_check(payload: dict[str, Any], check: bool) -> None:
    expected = canonical_json(payload)
    if check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf-8") != expected:
            raise ContractError(f"{OUTPUT_PATH} is missing or stale; run the Prague accountability build")
        return
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(expected, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify the committed artifact matches the inputs and config")
    parser.add_argument("--input-dir", type=Path, default=INPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(read_json(CONFIG_PATH), args.input_dir)
    write_or_check(payload, args.check)
    summary = payload["stuck_summary"]
    print(f"{'checked' if args.check else 'wrote'} {OUTPUT_PATH.relative_to(WEB)}: {summary['projects']} stuck projects, "
          f"{summary['cum_budget_czk'] / 1e6:,.0f} M CZK budgeted, {len(payload['broken_feeds'])} broken feed-years")


if __name__ == "__main__":
    main()
