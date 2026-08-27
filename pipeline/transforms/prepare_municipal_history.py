#!/usr/bin/env python3
"""Build 2010-2025 annual budget snapshots for every current Czech municipality."""

from __future__ import annotations

import csv
import io
import json
import os
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
WEB = ROOT / "website"
ANNUAL = ROOT / "data/source_cache/annual"
SNAPSHOT = WEB / "data/municipal-snapshot.v1.json"
OUTPUT = WEB / "data/municipal-history"
DIRECTORY_OUTPUT = WEB / "data/municipal-history-directory.v1.json"
POPULATION = ROOT / "data/source_cache/csu_municipal_population_2010_2025.csv"

YEARS = range(2010, 2026)
CASH_ACCOUNTS = {"068", "231", "236", "241", "244", "261", "262"}
CONSOLIDATED_REVENUE_ITEMS = {"4133", "4134", "4137", "4138", "4139", "4251"}
CONSOLIDATED_EXPENSE_ITEMS = {"5342", "5344", "5345", "5347", "5348", "5349", "6363"}
MUNICIPALITY_CODE_OVERRIDES = {"04498682": 500101, "00640506": 571512, "01265741": 500071}

# CZK is quoted to the halere. Amounts are accumulated as Decimal so 16 years x
# ~6,250 municipalities of row sums stay exact, then quantized once on output.
CZK = Decimal("0.01")


def number(value: str | None) -> Decimal:
    """Parse a MONITOR CZK amount exactly.

    Decimal rather than float: these values are summed over every municipality
    for every year from 2010, and binary floating point would accumulate a
    drift that downstream reconciliation then has to absorb with an artificial
    tolerance. Decimal addition of halere-precision amounts is exact.
    """
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return Decimal(0)
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    try:
        result = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Not a MONITOR amount: {value!r}") from exc
    return -result if negative else result


def normalize_ico(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    return str(int(digits or "0")).zfill(8)[-8:]


def load_population(municipalities: dict[str, dict]) -> dict[tuple[str, int], int]:
    """Join CZSO population onto municipalities strictly by municipality code.

    There is deliberately no fallback to matching on an accent-stripped,
    case-folded name. Czech municipality names are not unique once accents and
    case are removed -- hundreds of them collide -- so a name join is
    last-write-wins and would attach one village's population to another,
    invisibly and only for the affected rows. If two entities ever share a
    municipality code, that is a defect in the snapshot's territory mapping and
    it is raised here rather than worked around.
    """
    if not POPULATION.exists():
        raise RuntimeError(f"Missing CZSO population extract: run {WEB / 'pipeline/transforms/fetch_municipal_population.py'}")
    code_counts = Counter(str(entity["territory"]["municipality_code"]) for entity in municipalities.values())
    ambiguous = sorted(code for code, count in code_counts.items() if count > 1)
    if ambiguous:
        offenders = {
            code: sorted(
                f"{ico} ({entity['short_name']})"
                for ico, entity in municipalities.items()
                if str(entity["territory"]["municipality_code"]) == code
            )
            for code in ambiguous[:10]
        }
        raise RuntimeError(
            f"{len(ambiguous)} municipality code(s) are shared by more than one entity in "
            f"{SNAPSHOT.name}, so population cannot be joined unambiguously: "
            + "; ".join(f"{code} -> {', '.join(names)}" for code, names in offenders.items())
            + (f" (and {len(ambiguous) - 10} more)" if len(ambiguous) > 10 else "")
            + ". Fix the territory mapping in the snapshot. Matching these by normalized name "
            "is not an option: normalized Czech municipality names are not unique."
        )
    by_code: dict[tuple[int, str], int] = {}
    with POPULATION.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            code = row.get("UZ25.OBEC") or ""
            value = row.get("Hodnota") or ""
            year = int(row["CasR"])
            if code and value and year in YEARS:
                population = int(float(value.replace(" ", "").replace(",", ".")))
                by_code[year, code] = population
    result: dict[tuple[str, int], int] = {}
    for ico, entity in municipalities.items():
        code = str(entity["territory"]["municipality_code"])
        for year in YEARS:
            value = by_code.get((year, code))
            if value is not None:
                result[ico, year] = value
    return result


def archive_path(year: int, report: str) -> Path:
    if year == 2025:
        return ROOT / f"data/source_cache/2025_12_{report}.zip"
    return ANNUAL / f"{year}_12_{report}.zip"


def members(path: Path, prefix: str) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        return [name for name in archive.namelist() if Path(name).name.upper().startswith(prefix)]


def rows(path: Path, member: str):
    """Yield rows of a MONITOR CSV, failing loudly on an encoding mismatch.

    Monitor has shipped both cp1250 and UTF-8 extracts over the 2010-2025 span.
    Decoding with ``errors="replace"`` used to paper over that: a cp1250 file
    read as UTF-8 produced U+FFFD in every accented municipality name and every
    label, and the run completed silently with corrupted text. Now a mismatch
    raises and names the archive member, so the extract is re-fetched or the
    encoding is declared rather than quietly degraded.
    """
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        stream = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="strict", newline="")
        reader = csv.reader(stream, delimiter=";")
        try:
            next(reader, None)
            yield from reader
        except UnicodeDecodeError as exc:
            raise RuntimeError(
                f"{path.name}::{member} is not valid UTF-8 ({exc.reason} at byte {exc.start}). "
                "Monitor has published both cp1250 and UTF-8 extracts; re-fetch this archive "
                "or add an explicit per-vintage encoding. It is not decoded leniently, because "
                "that silently corrupts every accented name in the output."
            ) from exc


def czk(value: Decimal | float | int) -> float:
    """Quantize an exact CZK total to halere for JSON serialization."""
    return float(Decimal(value).quantize(CZK))


def rounded(values: dict[str, Decimal], key: str) -> float:
    return czk(values.get(key, Decimal(0)))


def main() -> None:
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    municipalities = {item["national_id"]: item for item in snapshot["municipalities"]}
    for ico, code in MUNICIPALITY_CODE_OVERRIDES.items():
        municipalities[ico]["territory"]["municipality_code"] = code
    population = load_population(municipalities)
    for ico, entity in municipalities.items():
        entity["population"] = {
            "value": population.get((ico, 2025)),
            "reference_date": "2025-07-01",
            "source_id": "CZSO_DATASTAT_OBY01B01_9379W",
        }
    snapshot["definitions"]["population"] = "Počet obyvatel k 1. 7. 2025 podle ČSÚ DataStat, ukazatel 9379W, pohlaví celkem."
    if not any(source.get("source_id") == "CZSO_DATASTAT_OBY01B01_9379W" for source in snapshot["sources"]):
        snapshot["sources"].append({
            "source_id": "CZSO_DATASTAT_OBY01B01_9379W",
            "label_cs": "ČSÚ DataStat — počet obyvatel k 1. 7.",
            "url": "https://data.csu.gov.cz/datastat/info/SADA/OBY01B01",
        })
    SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    targets = set(municipalities)
    history: dict[str, dict[int, dict[str, Decimal | bool]]] = {
        ico: {year: defaultdict(Decimal) for year in YEARS} for ico in targets
    }

    for year in YEARS:
        finm = archive_path(year, "FINM")
        rozv = archive_path(year, "ROZV")
        budget_members = members(finm, "FINM201")
        if not budget_members:
            raise RuntimeError(f"FINM201 was not found in {finm}")

        for row in rows(finm, budget_members[0]):
            if len(row) < 13:
                continue
            ico = normalize_ico(row[4])
            if ico not in targets:
                continue
            item = row[9].strip()
            item_class = item[:1]
            if item_class not in {"1", "2", "3", "4", "5", "6"}:
                continue
            approved, adjusted, actual = map(number, row[10:13])
            values = history[ico][year]
            values["budget_available"] = True
            if item_class in {"1", "2", "3", "4"}:
                if item in CONSOLIDATED_REVENUE_ITEMS:
                    continue
                values["revenue_approved"] += approved
                values["revenue_adjusted"] += adjusted
                values["revenue_actual"] += actual
                values[{"1": "tax_revenue", "2": "nontax_revenue", "3": "capital_revenue", "4": "transfer_revenue"}[item_class]] += actual
            else:
                if item in CONSOLIDATED_EXPENSE_ITEMS:
                    continue
                values["expense_approved"] += approved
                values["expense_adjusted"] += adjusted
                values["expense_actual"] += actual
                values["current_expense" if item_class == "5" else "capital_expense"] += actual

        if year <= 2011:
            bank_members = members(finm, "FINM204")
            if not bank_members:
                raise RuntimeError(f"FINM204 was not found in {finm}")
            for row in rows(finm, bank_members[0]):
                if len(row) < 10:
                    continue
                ico = normalize_ico(row[4])
                if ico not in targets or row[7].strip() != "6030":
                    continue
                values = history[ico][year]
                values["cash_available"] = True
                values["cash_previous"] += number(row[8])
                values["cash_current"] += number(row[9])
        else:
            balance_members = members(rozv, "ROZV")
            if not balance_members:
                raise RuntimeError(f"ROZV was not found in {rozv}")
            for member in balance_members:
                for row in rows(rozv, member):
                    if len(row) < 14:
                        continue
                    ico = normalize_ico(row[4])
                    if ico not in targets or row[9].strip() not in CASH_ACCOUNTS:
                        continue
                    values = history[ico][year]
                    values["cash_available"] = True
                    values["cash_current"] += number(row[12])
                    values["cash_previous"] += number(row[13])
        print(f"processed {year}", flush=True)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated_at = os.environ.get("CZBUDGET_GENERATED_AT") or datetime.now(timezone.utc).isoformat()
    coverage_by_year = {year: {"budget": 0, "cash": 0, "population": 0} for year in YEARS}
    complete_series = 0
    total_rows = 0
    directory_rows = []
    annual_summary = {
        year: defaultdict(Decimal, {
            "entity_count": Decimal(0), "cash_entity_count": Decimal(0),
            "surplus_count": Decimal(0), "deficit_count": Decimal(0),
        })
        for year in YEARS
    }

    for ico, entity in municipalities.items():
        series = []
        for year in YEARS:
            values = history[ico][year]
            if not values.get("budget_available"):
                continue
            revenue = values.get("revenue_actual", Decimal(0)).quantize(CZK)
            expense = values.get("expense_actual", Decimal(0)).quantize(CZK)
            balance = revenue - expense
            cash_available = bool(values.get("cash_available"))
            residents = population.get((ico, year))
            row = {
                "year": year,
                "revenue_approved": rounded(values, "revenue_approved"),
                "revenue_adjusted": rounded(values, "revenue_adjusted"),
                "revenue_actual": czk(revenue),
                "expense_approved": rounded(values, "expense_approved"),
                "expense_adjusted": rounded(values, "expense_adjusted"),
                "expense_actual": czk(expense),
                "tax_revenue": rounded(values, "tax_revenue"),
                "nontax_revenue": rounded(values, "nontax_revenue"),
                "capital_revenue": rounded(values, "capital_revenue"),
                "transfer_revenue": rounded(values, "transfer_revenue"),
                "current_expense": rounded(values, "current_expense"),
                "capital_expense": rounded(values, "capital_expense"),
                "budget_balance": czk(balance),
                "cash_current": rounded(values, "cash_current") if cash_available else None,
                "cash_previous": rounded(values, "cash_previous") if cash_available else None,
                "population_mid_year": residents,
                "expense_per_capita": czk(expense / residents) if residents else None,
                "source_kind": "Monitor CSV extract",
                "comparability": "historical_budget_cash_break_2012" if year <= 2011 else "consistent_2012_plus",
            }
            series.append(row)
            directory_rows.append([
                ico,
                year,
                row["revenue_actual"],
                row["expense_actual"],
                row["budget_balance"],
                row["cash_current"],
                residents,
            ])
            annual = annual_summary[year]
            annual["entity_count"] += 1
            annual["revenue_actual"] += revenue
            annual["expense_actual"] += expense
            annual["budget_balance"] += balance
            if cash_available:
                annual["cash_entity_count"] += 1
                annual["cash_current"] += values.get("cash_current", Decimal(0)).quantize(CZK)
            if residents is not None:
                annual["population_entity_count"] += 1
                annual["population_total"] += residents
            if balance >= 0:
                annual["surplus_count"] += 1
                annual["surplus_revenue"] += revenue
                annual["surplus_balance"] += balance
            else:
                annual["deficit_count"] += 1
                annual["deficit_revenue"] += revenue
                annual["deficit_balance"] += balance
            coverage_by_year[year]["budget"] += 1
            if cash_available:
                coverage_by_year[year]["cash"] += 1
            if residents is not None:
                coverage_by_year[year]["population"] += 1
        total_rows += len(series)
        if len(series) == len(YEARS):
            complete_series += 1
        payload = {
            "schema_version": "1.0.0",
            "dataset_id": "CZ_MUNICIPAL_HISTORY_2010_2025",
            "generated_at": generated_at,
            "period": {"from": 2010, "to": 2025, "years": 16},
            "definitions": {
                "budget_result": "Skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci.",
                "cash": "2010–2011: stav běžných účtů ve FIN 2-12 M; od 2012: součet účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze účetní jednotky.",
                "population": "Počet obyvatel k 1. 7. daného roku podle ČSÚ DataStat; používá se jako jmenovatel ročních částek na obyvatele.",
                "missing_year": "Chybějící rok znamená, že pro současné IČO nebyly ve zdrojovém FIN 2-12 M nalezeny rozpočtové řádky; nejde o nulový rozpočet.",
            },
            "municipality": {
                "entity_id": entity["entity_id"],
                "national_id": ico,
                "name": entity["short_name"],
                "currency_code": "CZK",
                "history_path": f"/data/municipal-history/{ico}.json",
            },
            "series": series,
        }
        (OUTPUT / f"{ico}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    summary = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_MUNICIPAL_HISTORY_INDEX_2010_2025",
        "generated_at": generated_at,
        "period": {"from": 2010, "to": 2025, "years": 16},
        "municipality_count": len(municipalities),
        "complete_series_count": complete_series,
        "annual_record_count": total_rows,
        "coverage_by_year": [{"year": year, **coverage_by_year[year]} for year in YEARS],
        "files": len(municipalities),
        "path_template": "/data/municipal-history/{national_id}.json",
        "sources": [
            {"label_cs": "Monitor státní pokladny — datové extrakty", "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/"},
            {"label_cs": "Monitor — historický archiv", "url": "https://monitor.statnipokladna.gov.cz/datovy-archiv/"},
            {"label_cs": "ČSÚ DataStat — stav a pohyb obyvatel podle obcí", "url": "https://data.csu.gov.cz/datastat/info/SADA/OBY01B01"},
        ],
    }
    (OUTPUT / "index.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    directory_payload = {
        "schema_version": "1.0.0",
        "dataset_id": "CZ_MUNICIPAL_HISTORY_DIRECTORY_2010_2025",
        "generated_at": generated_at,
        "period": {"from": 2010, "to": 2025, "years": 16},
        "currency_code": "CZK",
        "columns": ["national_id", "year", "revenue_actual", "expense_actual", "budget_balance", "cash_current", "population_mid_year"],
        "rows": directory_rows,
        "annual": [
            {
                "year": year,
                "entity_count": int(annual_summary[year]["entity_count"]),
                "cash_entity_count": int(annual_summary[year]["cash_entity_count"]),
                "population_entity_count": int(annual_summary[year]["population_entity_count"]),
                "population_total": int(annual_summary[year]["population_total"]),
                "surplus_count": int(annual_summary[year]["surplus_count"]),
                "deficit_count": int(annual_summary[year]["deficit_count"]),
                **{
                    key: czk(annual_summary[year][key])
                    for key in (
                        "revenue_actual", "expense_actual", "budget_balance", "cash_current",
                        "surplus_revenue", "surplus_balance", "deficit_revenue", "deficit_balance",
                    )
                },
                "expense_per_capita": czk(
                    annual_summary[year]["expense_actual"] / annual_summary[year]["population_total"]
                ),
            }
            for year in YEARS
        ],
        "definitions": {
            "coverage": "Řádky obsahují dnešní obecní IČO dostupná v daném ročním extraktu; chybějící obec není nulová hodnota.",
            "cash": "Součet stavu účtů pouze za obce s dostupnými řádky: 2010–2011 FIN 2-12 M, od 2012 rozvaha.",
            "population": "Počet obyvatel k 1. 7. daného roku podle ČSÚ DataStat, ukazatel 9379W, pohlaví celkem. Částky na obyvatele dělí roční tok středním stavem obyvatel.",
            "benchmark": "Národní hodnota na obyvatele je vážený průměr. Srovnání podobně velkých obcí používá medián osmi populačních pásem.",
        },
        "sources": [{"source_id": "CZSO_DATASTAT_OBY01B01_9379W", "label_cs": "ČSÚ DataStat — počet obyvatel k 1. 7.", "url": "https://data.csu.gov.cz/datastat/info/SADA/OBY01B01"}],
    }
    DIRECTORY_OUTPUT.write_text(
        json.dumps(directory_payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
