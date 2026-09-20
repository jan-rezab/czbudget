"""Pure normalization for City Finance standardized ULB income statements."""

from decimal import Decimal, InvalidOperation


def fiscal_year_end(label: str) -> int:
    start, end = label.split("-")
    return 2000 + int(end) if len(end) == 2 else int(end)


def normalize_income_statement(data: list[dict], ulb_id: str, year: str) -> list[dict]:
    value_key = year.replace("-", "") + "_" + ulb_id
    side = None
    facts = []
    for source_row, row in enumerate(data, 1):
        label = str(row.get("lineItem") or "").strip()
        if label == "A.Income":
            side = "revenue"
            continue
        if label == "B.Expenditure":
            side = "expenditure"
            continue
        if side is None or row.get("calculation") or row.get("reportType") == "summary":
            continue
        code = str(row.get("code") or "").strip()
        value = row.get(value_key)
        if not code or not label or value is None or isinstance(value, bool):
            continue
        try:
            amount = Decimal(str(value))
        except InvalidOperation:
            continue
        facts.append({
            "source_row_number": source_row,
            "budget_side": side,
            "economic_item_code": code,
            "line_item": label,
            "amount_local": str(amount),
            "report_type": row.get("reportType"),
        })
    return facts
