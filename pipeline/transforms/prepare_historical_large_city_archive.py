#!/usr/bin/env python3
"""Backfill 2006–2009 large-city series from the official Monitor ARIS archive."""

from __future__ import annotations

import os

import json
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
HISTORY = ROOT / "website/data/large-city-history.v1.json"
CACHE = ROOT / "data/source_cache/historical_2006_2009_large_cities.json"
BASE = "https://monitor.statnipokladna.gov.cz/olap-aris/rest/olap-aris/"
BUDGET_REPORT = Path("/tmp/hist0.xml")
CASH_REPORT = Path("/tmp/hist1.xml")


def minimal_query(report: Path, ico: str, year: int, row_codes: list[str]) -> str:
    xml = report.read_text(encoding="utf-8")
    xml = re.sub(r'\s*<Dimension name="PolvykNazev".*?</Dimension>', "", xml, flags=re.S)
    for dimension in ("UcjedKrajNazev", "UcjedDruhuj", "UcjedPoddruhuj", "UcjedNazev"):
        xml = re.sub(rf'\s*<Dimension name="{dimension}".*?</Dimension>', "", xml, flags=re.S)
    selections = "\n".join(
        f'              <Selection dimension="PolvykKod" type="member" node="[PolvykKod].[{code}]" operator="MEMBER" />'
        for code in row_codes
    )
    xml = xml.replace(
        '              <Selection dimension="PolvykKod" type="level" node="[PolvykKod].[PolvykKod]" operator="MEMBERS" />',
        selections,
    )
    xml = xml.replace("[Obdobi.Obdobi].[2009/12]", f"[Obdobi.Obdobi].[{year}/12]")
    xml = xml.replace(
        '<Selection dimension="UcjedIco" type="level" node="[UcjedIco].[UcjedIco]" operator="MEMBERS" />',
        f'<Selection dimension="UcjedIco" type="member" node="[UcjedIco].[{ico}]" operator="MEMBER" />',
    )
    return xml


def run_query(session: requests.Session, xml: str) -> list[list[dict]]:
    query_id = str(uuid.uuid4()).upper()
    url = BASE + f"anonymousUser/query/{query_id}"
    response = session.post(
        url,
        data={"xml": xml, "formatter": "flattened", "order": "j", "type": "QM"},
        timeout=60,
    )
    response.raise_for_status()
    response = session.get(url + "/result/flattened/j", timeout=60)
    response.raise_for_status()
    cellset = response.json().get("cellset")
    if not cellset:
        raise RuntimeError("archive query returned no cellset")
    return cellset


def raw(cell: dict | None) -> float:
    if cell is None:
        return 0.0
    value = cell.get("properties", {}).get("raw")
    return float(value) if value not in (None, "NaN", "Infinity", "-Infinity") else 0.0


def fetch_one(ico: str, name: str, year: int) -> dict:
    for attempt in range(3):
        try:
            session = requests.Session()
            session.get(BASE + "session", timeout=30).raise_for_status()
            revenue_code, expense_code, balance_code = ("53", "80", "82") if year == 2006 else ("57", "84", "86")
            budget_cells = run_query(session, minimal_query(BUDGET_REPORT, ico, year, [revenue_code, expense_code, balance_code]))
            budget = {
                row[0]["value"]: raw(row[3])
                for row in budget_cells[1:]
                if row and row[0] and len(row) > 3
            }
            cash_cells = run_query(session, minimal_query(CASH_REPORT, ico, year, ["6040"]))
            cash_row = next((row for row in cash_cells[1:] if row and row[0] and row[0].get("value") == "6040"), None)
            return {
                "national_id": ico,
                "name": name,
                "year": year,
                "revenue_actual": round(budget.get(revenue_code, 0.0), 2),
                "expense_actual": round(budget.get(expense_code, 0.0), 2),
                "budget_balance": round(budget.get(balance_code, budget.get(revenue_code, 0.0) - budget.get(expense_code, 0.0)), 2),
                "cash_current": round(raw(cash_row[2]), 2) if cash_row else 0.0,
                "cash_previous": round(raw(cash_row[1]), 2) if cash_row else 0.0,
                "source_kind": "Monitor ARIS historical archive",
                "comparability": "historical_budget_cash_break_2012",
            }
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def main() -> None:
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    jobs = [(city["national_id"], city["name"], year) for city in history["cities"] for year in range(2006, 2010)]
    records = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(fetch_one, *job): job for job in jobs}
        for completed, future in enumerate(as_completed(futures), 1):
            record = future.result()
            records.append(record)
            if completed % 12 == 0:
                print(f"fetched {completed}/{len(jobs)}", flush=True)
    records.sort(key=lambda item: (item["national_id"], item["year"]))
    CACHE.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "records": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_city: dict[str, list[dict]] = {}
    for record in records:
        by_city.setdefault(record["national_id"], []).append({key: value for key, value in record.items() if key not in {"national_id", "name"}})
    for city in history["cities"]:
        city["series"] = by_city[city["national_id"]] + [row for row in city["series"] if row["year"] >= 2010]
    history["dataset_id"] = "CZ_LARGE_CITY_HISTORY_2006_2025"
    history["generated_at"] = datetime.now(timezone.utc).isoformat()
    history["period"] = {"from": 2006, "to": 2025, "years": 20}
    history["definitions"]["comparability"] = (
        "Rozpočtový výsledek je v letech 2006–2025 veden po konsolidaci. Hotovost 2006–2011 je konečný stav běžných účtů "
        "z FIN 2-12M; od 2012 jde o širší součet vymezených účtů z rozvahy, proto je v roce 2012 metodický zlom."
    )
    HISTORY.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"records": len(records), "period": history["period"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
