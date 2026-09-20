from decimal import Decimal

from worker import amount, parse_csv


def test_german_amounts_and_stages():
    assert amount("1.234,56") == Decimal("1234.56")
    body = ("Zeile_Ergebnisplan;Kostenart;Ansatz_2025;Planung_2026\n"
            "01 - Personal;401 - Taxes;1.234,56;2.000,00\n").encode("cp1252")
    rows = parse_csv(body, "2026-09-20T00:00:00+00:00")
    assert [(row["fiscal_year"], row["budget_stage"], row["amount_local"]) for row in rows] == [
        (2025, "enacted", "1234.56"), (2026, "proposal", "2000.00")
    ]
