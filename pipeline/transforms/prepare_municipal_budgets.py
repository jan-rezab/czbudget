#!/usr/bin/env python3
"""Prepare a compact, auditable municipal-budget dataset from MONITOR CSV extracts."""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import zipfile
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
CODEBOOK_DIR = ROOT / "data/source_cache/codebooks"
PARAGRAPH_CODEBOOK = CODEBOOK_DIR / "CIS_PARAGRAF.CSV"
ITEM_CODEBOOK = CODEBOOK_DIR / "CIS_POLOZKA.CSV"
CODEBOOK_SOURCE_URL = "https://monitor.statnipokladna.gov.cz/datovy-katalog/ciselniky"

# CZK is quoted to the halere. Amounts are summed as Decimal so thousands of
# rows add up exactly, then quantized once at the boundary. A 2-decimal CZK
# value stays exactly representable as an IEEE-754 double well past the
# national aggregate, so the JSON contract is unchanged.
CZK = Decimal("0.01")


CITIES = [
    (1, "B", 3.19, "00297488", "Statutární město Havířov"),
    (2, "B", 3.33, "00075370", "Statutární město Plzeň"),
    (3, "B", 3.79, "00254657", "Statutární město Karlovy Vary"),
    (4, "B", 3.97, "00301825", "Statutární město Přerov"),
    (5, "B", 4.39, "00266094", "Statutární město Most"),
    (6, "B", 4.41, "00261238", "Statutární město Děčín"),
    (7, "B", 4.46, "00081531", "Statutární město Ústí nad Labem"),
    (8, "B", 4.55, "44992785", "Statutární město Brno"),
    (9, "B", 4.56, "00845451", "Statutární město Ostrava"),
    (10, "B", 4.84, "00288659", "Statutární město Prostějov"),
    (11, "B", 4.91, "00244732", "Statutární město České Budějovice"),
    (12, "B", 5.01, "00261891", "Statutární město Chomutov"),
    (13, "B", 5.43, "00283924", "Statutární město Zlín"),
    (14, "B", 5.45, "00238295", "Statutární město Mladá Boleslav"),
    (15, "B", 5.58, "00262340", "Statutární město Jablonec nad Nisou"),
    (16, "B", 5.84, "00262978", "STATUTÁRNÍ MĚSTO LIBEREC"),
    (17, "B", 5.89, "00297313", "Statutární město Třinec"),
    (18, "B", 5.91, "00286010", "Statutární město Jihlava"),
    (19, "C", 6.03, "00274046", "Statutární město Pardubice"),
    (20, "C", 6.29, "00300535", "Statutární město Opava"),
    (21, "C", 6.38, "00297534", "Statutární město Karviná"),
    (22, "C", 6.47, "00234516", "Statutární město Kladno"),
    (23, "C", 6.57, "00266621", "Statutární město Teplice"),
    (24, "C", 6.59, "00268810", "Statutární město Hradec Králové"),
    (25, "C", 7.04, "00296643", "Statutární město Frýdek-Místek"),
    (26, "C", None, "00299308", "Statutární město Olomouc"),
]

CASH_ACCOUNTS = {
    "068": "Termínované vklady dlouhodobé",
    "231": "Základní běžný účet územních samosprávných celků",
    "236": "Běžné účty fondů územních samosprávných celků",
    "241": "Běžný účet",
    "244": "Termínované vklady krátkodobé",
    "261": "Pokladna",
    "262": "Peníze na cestě",
}


def parse_number(value: str | None) -> Decimal:
    """Parse a MONITOR CZK amount exactly.

    Returned as :class:`~decimal.Decimal`, not ``float``: these values are
    summed across tens of thousands of rows, and binary floating point would
    accumulate a drift that downstream reconciliation then has to absorb with
    an artificial tolerance. Decimal addition of halere-precision amounts is
    exact, so a reconciliation residual afterwards is a real source
    discrepancy rather than arithmetic noise.
    """
    text = (value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return Decimal(0)
    negative = text.endswith("-")
    if negative:
        text = text[:-1]
    try:
        number = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Not a MONITOR amount: {value!r}") from exc
    return -number if negative else number


def czk(value: Decimal | float | int) -> float:
    """Quantize an exact CZK total to halere for JSON serialization."""
    return float(Decimal(value).quantize(CZK))


def valid_at_2025(start: str, end: str) -> bool:
    ref = "20251231"
    return (not start or start <= ref) and (not end or ref <= end)


def load_code_map(path: Path, code_idx: int, start_idx: int, end_idx: int, label_idx: int) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(
            f"Missing MONITOR codebook: {path}\n"
            f"Download CIS_PARAGRAF.CSV and CIS_POLOZKA.CSV from {CODEBOOK_SOURCE_URL} "
            f"and place them in {CODEBOOK_DIR}.\n"
            "These files are part of the source contract: without them every paragraph "
            "and item label would silently fall back to an empty string."
        )
    result: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=";", quotechar='"')
        next(reader, None)
        for row in reader:
            if len(row) <= max(code_idx, start_idx, end_idx, label_idx):
                continue
            if valid_at_2025(row[start_idx].strip(), row[end_idx].strip()):
                result[row[code_idx].strip().zfill(4)] = row[label_idx].strip()
    return result


def iter_zip_csv(zip_path: Path, member: str):
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(member) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            yield from csv.reader(text, delimiter=";", quotechar='"')


def extract_budget_detail(data_dir: Path, city_map: dict[str, dict], paragraph_labels: dict[str, str], item_labels: dict[str, str]):
    rows = []
    reader = iter_zip_csv(data_dir / "finm2025.zip", "FINM201_2025012.csv")
    next(reader, None)
    for row in reader:
        if len(row) < 13 or row[4] not in city_map:
            continue
        item = row[9].strip().zfill(4)
        item_class = item[:1]
        if item_class not in {"1", "2", "3", "4", "5", "6"}:
            continue
        approved = parse_number(row[10])
        after_changes = parse_number(row[11])
        actual = parse_number(row[12])
        if not approved and not after_changes and not actual:
            continue
        paragraph = row[8].strip().zfill(4)
        city = city_map[row[4]]
        rows.append({
            "rank": city["rank"],
            "city": city["name"],
            "ico": row[4],
            "kind": "Příjmy" if item_class in {"1", "2", "3", "4"} else "Výdaje",
            "class": item_class,
            "paragraph": paragraph,
            "paragraph_name": paragraph_labels.get(paragraph, ""),
            "item": item,
            "item_name": item_labels.get(item, ""),
            "approved": czk(approved),
            "after_changes": czk(after_changes),
            "actual": czk(actual),
        })
    rows.sort(key=lambda r: (r["rank"], r["kind"], r["paragraph"], r["item"]))
    return rows


def extract_financing(data_dir: Path, targets: set[str]):
    financing = {}
    reader = iter_zip_csv(data_dir / "finm2025.zip", "FINM202_2025012.csv")
    next(reader, None)
    for row in reader:
        if len(row) < 11 or row[4] not in targets or row[7].strip() != "8000":
            continue
        financing[row[4]] = {
            "approved": parse_number(row[8]),
            "after_changes": parse_number(row[9]),
            "actual": parse_number(row[10]),
        }  # Decimal; serialized via czk() at the output boundary
    return financing


def extract_cash(data_dir: Path, city_map: dict[str, dict]):
    components = []
    totals = defaultdict(lambda: {"current": Decimal(0), "prior": Decimal(0)})
    for member in ("ROZV1_2025012.csv", "ROZV2_2025012.csv"):
        reader = iter_zip_csv(data_dir / "rozvaha2025.zip", member)
        next(reader, None)
        for row in reader:
            if len(row) < 14 or row[4] not in city_map:
                continue
            account = row[9].strip()
            if account not in CASH_ACCOUNTS:
                continue
            current = parse_number(row[12])
            prior = parse_number(row[13])
            city = city_map[row[4]]
            components.append({
                "rank": city["rank"],
                "city": city["name"],
                "ico": row[4],
                "account": account,
                "account_name": CASH_ACCOUNTS[account],
                "cash_2025": czk(current),
                "cash_2024": czk(prior),
            })
            totals[row[4]]["current"] += current
            totals[row[4]]["prior"] += prior
    components.sort(key=lambda r: (r["rank"], r["account"]))
    return components, totals


def summary_categories(summary: dict) -> tuple[dict, dict]:
    groups = {group["name"]: group for group in summary.get("children", [])}
    revenue = groups.get("Revenues", {})
    expense = groups.get("Expenditures", {})
    categories = {}
    for group in (revenue, expense):
        for child in group.get("children", []):
            categories[str(child.get("code"))] = child.get("budget", {})
    return categories, {"revenue": revenue.get("budget", {}), "expense": expense.get("budget", {})}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--summary-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--paragraph-codebook", type=Path, default=PARAGRAPH_CODEBOOK,
        help=f"MONITOR CIS_PARAGRAF.CSV codebook (default: {PARAGRAPH_CODEBOOK})",
    )
    parser.add_argument(
        "--item-codebook", type=Path, default=ITEM_CODEBOOK,
        help=f"MONITOR CIS_POLOZKA.CSV codebook (default: {ITEM_CODEBOOK})",
    )
    args = parser.parse_args()

    city_map = {
        ico: {"rank": rank, "grade": grade, "score": score, "ico": ico, "name": name}
        for rank, grade, score, ico, name in CITIES
    }
    targets = set(city_map)
    paragraph_labels = load_code_map(args.paragraph_codebook, 0, 4, 5, 6)
    item_labels = load_code_map(args.item_codebook, 0, 1, 2, 6)

    detail = extract_budget_detail(args.data_dir, city_map, paragraph_labels, item_labels)
    financing = extract_financing(args.data_dir, targets)
    cash_components, cash_totals = extract_cash(args.data_dir, city_map)

    cities = []
    for rank, grade, score, ico, stated_name in CITIES:
        summary_path = args.summary_dir / f"{ico}.json"
        summary = json.loads(summary_path.read_text(encoding="utf-8"), parse_float=Decimal)
        categories, totals = summary_categories(summary)
        revenue = totals["revenue"]
        expense = totals["expense"]
        city = {
            "rank": rank,
            "grade": grade,
            "score": score,
            "ico": ico,
            "name": summary.get("name") or stated_name,
            "tax_revenue": czk(categories.get("1", {}).get("reality", 0)),
            "nontax_revenue": czk(categories.get("2", {}).get("reality", 0)),
            "capital_revenue": czk(categories.get("3", {}).get("reality", 0)),
            "transfer_revenue": czk(categories.get("4", {}).get("reality", 0)),
            "current_expense": czk(categories.get("5", {}).get("reality", 0)),
            "capital_expense": czk(categories.get("6", {}).get("reality", 0)),
            "revenue_approved": czk(revenue.get("approved", 0)),
            "revenue_after_changes": czk(revenue.get("afterChanges", 0)),
            "revenue_actual": czk(revenue.get("reality", 0)),
            "expense_approved": czk(expense.get("approved", 0)),
            "expense_after_changes": czk(expense.get("afterChanges", 0)),
            "expense_actual": czk(expense.get("reality", 0)),
            "financing_approved": czk(financing.get(ico, {}).get("approved", 0)),
            "financing_after_changes": czk(financing.get(ico, {}).get("after_changes", 0)),
            "financing_actual": czk(financing.get(ico, {}).get("actual", 0)),
            "cash_2025": czk(cash_totals[ico]["current"]),
            "cash_2024": czk(cash_totals[ico]["prior"]),
            "source_summary": f"https://monitor.statnipokladna.gov.cz/ucetni-jednotka/{ico}/rozpocet/souhrnny?obdobi=2512&rad=t",
            "source_entity": f"https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}",
        }
        cities.append(city)

    checks = []
    for city in cities:
        # Exact Decimal arithmetic: any residual here is a genuine discrepancy
        # between the published summary and the FINM202 financing extract, not
        # accumulated binary-float error.
        balance_delta = (
            Decimal(str(city["revenue_actual"]))
            - Decimal(str(city["expense_actual"]))
            + Decimal(str(city["financing_actual"]))
        )
        tolerance = Decimal("1.0")
        checks.append({
            "city": city["name"],
            "ico": city["ico"],
            "check": "Příjmy − výdaje + financování = 0",
            "delta": czk(balance_delta),
            "tolerance": float(tolerance),
            "status": "OK" if abs(balance_delta) <= tolerance else "ZKONTROLOVAT",
        })

    payload = {
        "metadata": {
            "period": "2025",
            "as_of": "2025-12-31",
            "prepared_on": "2026-08-20",
            "units": "Kč",
            "scope": "Samostatná účetní jednotka statutárního města; bez příspěvkových organizací a bez samostatných městských částí/obvodů.",
            "cash_definition": "Součet syntetických účtů 068, 231, 236, 241, 244, 261 a 262 podle metodiky MF.",
        },
        "cities": cities,
        "budget_detail": detail,
        "cash_components": cash_components,
        "checks": checks,
        "sources": [
            {
                "item": "Rozpočtové příjmy a výdaje",
                "period": "12/2025",
                "source": "MONITOR – FIN 2-12 M",
                "url": "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/2025_12_Data_CSUIS_FINM.zip",
                "note": "FINM201 detail příjmů a výdajů; FINM202 financování.",
            },
            {
                "item": "Stav peněžních prostředků",
                "period": "31. 12. 2025",
                "source": "MONITOR – Rozvaha",
                "url": "https://monitor.statnipokladna.gov.cz/data/extrakty/csv/Rozvaha/2025_12_Data_CSUIS_ROZV.zip",
                "note": "Rozvahové syntetické účty 068, 231, 236, 241, 244, 261 a 262.",
            },
            {
                "item": "Názvy paragrafů a rozpočtových položek",
                "period": "platnost 2025",
                "source": "MONITOR – Datový katalog / číselníky",
                "url": "https://monitor.statnipokladna.gov.cz/datovy-katalog/ciselniky",
                "note": "CIS_PARAGRAF.CSV a CIS_POLOZKA.CSV.",
            },
            {
                "item": "Metodika a definice dat",
                "period": "aktuální",
                "source": "MONITOR – Metodika",
                "url": "https://monitor.statnipokladna.gov.cz/metodika",
                "note": "Rozpočet je na cash principu; rozvaha zachycuje stav k rozvahovému dni.",
            },
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "cities": len(cities),
        "budget_detail_rows": len(detail),
        "cash_rows": len(cash_components),
        "checks_ok": sum(1 for c in checks if c["status"] == "OK"),
        "output": str(args.output),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
