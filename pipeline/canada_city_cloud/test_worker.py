import io

from openpyxl import Workbook

from worker import montreal, toronto, vancouver


LOADED_AT = "2026-09-19T22:50:59+00:00"


def workbook_bytes(sheet, rows):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet
    for row in rows:
        worksheet.append(row)
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_toronto_preserves_operating_detail_and_side():
    body = workbook_bytes("Open Data", [
        ["Program", "Service", "Activity", "Expense/Revenue", "Category Name", "Sub-Category Name", "Commitment item", "2025"],
        ["P", "S", "A", "Expenses", "C", "SC", "Payroll", 12.34],
        ["P", "S", "A", "Revenues", "C", "SC", "Fee", 5],
    ])
    rows = toronto(body, LOADED_AT)
    assert [(row["budget_side"], row["amount_local"]) for row in rows] == [
        ("expenditure", "12.340000000"), ("revenue", "5.000000000")
    ]


def test_montreal_scales_thousands_and_removes_xlsx_float_noise():
    body = workbook_bytes("SOMM CM", [
        [None] * 8, [None] * 8, [None] * 8,
        ["REVENUS"] + [None] * 7,
        ["Taxes"] + [None] * 6 + [123.45600000000002],
        ["DÉPENSES"] + [None] * 7,
        ["Services"] + [None] * 6 + [7.89],
    ])
    rows = montreal(body, LOADED_AT)
    assert [(row["budget_side"], row["amount_local"]) for row in rows] == [
        ("revenue", "123456.000000000"), ("expenditure", "7890.000000000")
    ]


def test_vancouver_rounds_portal_float_tail_to_cents():
    body = ("Service Category 1,Service Category 2,Service Category 3,Project/Program Name,Annual Capital Expenditure-2025 Capital Expenditure Budget\n"
            "Roads,Renewal,Bridges,Example,706167.8200000001\n").encode()
    rows = vancouver(body, LOADED_AT)
    assert rows[0]["amount_local"] == "706167.820000000"
