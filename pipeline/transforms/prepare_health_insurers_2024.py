#!/usr/bin/env python3
"""Extract actual 2024 insurer finances from the official MZ/MF workbooks.

Requires openpyxl. Downloads are opt-in; cached sources permit offline rebuilds.
Cash flows must never be mapped to company revenue, costs or net profit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.request import urlopen

import openpyxl

ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
CACHE = ROOT / "data/source_cache/health_insurers"
OUTPUT = ROOT / "website/data/cz-health-insurers-2024.json"
BASE = "https://mzd.gov.cz/wp-content/uploads/2024/06/"
FILES = {
    "finance": "vz2024_hodnoceni_tab_1-1a-1b-1c-1d-2-4.xlsx",
    "accounts": "vz2024_hodnoceni_tab_3-3a-3b-3c.xlsx",
}
ICOS = {111: "41197518", 201: "47114975", 205: "47672234", 207: "47114321",
        209: "46354182", 211: "47114304", 213: "47673036"}


def build(download=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = []
    books = {}
    for key, filename in FILES.items():
        path = CACHE / f"vz2024_{key}.xlsx"
        if download:
            with urlopen(BASE + filename, timeout=60) as response:
                path.write_bytes(response.read())
        sources.append({"publisher": "MZ ČR / MF ČR", "title": filename,
                        "url": BASE + filename,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        books[key] = openpyxl.load_workbook(path, data_only=True)
    cash = books["finance"]["tab.č.1"]
    balance = books["finance"]["tab. č.2"]
    care = books["accounts"]["Tabulka č. 3"]
    assert cash["X4"].value == 2024 and cash["X5"].value == "skutečnost"
    assert cash["AR4"].value == 2024 and cash["AR5"].value == "skutečnost"
    assert "AKTIVA CELKEM" in balance["A61"].value
    assert "běžného účetního období" in balance["A89"].value
    assert "2024" in care["F6"].value and care["F7"].value == "Skutečnost"

    def amount(sheet, address):
        value = sheet[address].value
        assert isinstance(value, (int, float)), (sheet.title, address, value)
        return round(value / 1000, 3)  # source thousand CZK -> million CZK

    entities = []
    for index, (code, ico) in enumerate(ICOS.items()):
        row = index + 7
        column = openpyxl.utils.get_column_letter(index + 2)
        care_column = openpyxl.utils.get_column_letter(index * 5 + 6)
        assert cash[f"A{row}"].value == code
        assert str(code) in care.cell(5, index * 5 + 4).value
        receipts = amount(cash, f"X{row}")
        expenditure = amount(cash, f"AR{row}")
        cash_balance = amount(cash, f"AZ{row}")
        assert abs(receipts - expenditure - cash_balance) < .001
        assert balance[f"{column}61"].value == balance[f"{column}111"].value
        entities.append({
            "ico": ico, "insurer_code": code, "name": cash[f"B{row}"].value.strip(),
            "year": 2024, "basis": "cash_including_taxable_activities",
            "receipts_mczk": receipts, "expenditure_mczk": expenditure,
            "cash_balance_mczk": cash_balance,
            "assets_mczk": amount(balance, f"{column}61"),
            "accounting_net_result_mczk": amount(balance, f"{column}89"),
            "healthcare_cost_mczk": amount(care, f"{care_column}9"),
            "insured_persons": cash[f"D{row}"].value,
            "employees_fte": cash[f"I{row}"].value,
            "source_url": sources[0]["url"],
            "source_cells": {"cash": f"tab.č.1!X{row},AR{row},AZ{row}",
                             "balance_sheet": f"tab. č.2!{column}61,{column}89",
                             "healthcare_cost": f"Tabulka č. 3!{care_column}9"},
        })
    summary = {}
    for field, sheet, cell in [
        ("receipts_mczk", cash, "X15"), ("expenditure_mczk", cash, "AR15"),
        ("cash_balance_mczk", cash, "AZ15"), ("assets_mczk", balance, "I61"),
        ("accounting_net_result_mczk", balance, "I89"),
    ]:
        summary[field] = round(sum(e[field] for e in entities), 3)
        assert abs(summary[field] - amount(sheet, cell)) < .001, field
    payload = {"schema_version": "1.0.0", "year": 2024, "units": "mil. Kč",
               "methodology": "Příjmy a výdaje celkem včetně zdaňovaných činností (MZ/MF, tabulka 1, část A, skutečnost 2024). Saldo není účetní zisk. Aktiva jsou v čisté výši k 31. 12. 2024; účetní výsledek z rozvahy je veden samostatně. Náklady na zdravotní služby zahrnují dohadné položky a nejsou totožné s peněžními výdaji.",
               "summary": summary, "entities": entities, "sources": sources}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    build(parser.parse_args().download)
