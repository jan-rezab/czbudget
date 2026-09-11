"""Financial reconciliation and provenance checks for the served EU programmes."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class EUProgrammeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data/eu-budget-flows.v1.json").read_text())

    def test_all_countries_have_reconciled_programmes_for_2021_2024(self):
        self.assertEqual(len(self.data["countries"]), 27)
        for country in self.data["countries"]:
            detailed = [r for r in country["series"] if 2021 <= r["year"] <= 2024]
            self.assertEqual({r["year"] for r in detailed}, {2021, 2022, 2023, 2024})
            for row in detailed:
                headings = row["spending_breakdown"]
                self.assertAlmostEqual(sum(h["amount_m_eur"] for h in headings), row["allocated_spending_m_eur"], delta=0.01)
                for heading in headings:
                    if heading["code"] == "O":
                        continue
                    programmes = heading["programmes"]
                    codes = [p["code"] for p in programmes]
                    self.assertEqual(len(codes), len(set(codes)))
                    for field in ("amount_m_eur", "mff_spending_m_eur", "ngeu_spending_m_eur"):
                        with self.subTest(country=country["iso3"], year=row["year"], heading=heading["code"], field=field):
                            self.assertAlmostEqual(sum(p[field] for p in programmes), heading[field], delta=0.0001)
                    for p in programmes:
                        self.assertAlmostEqual(p["amount_m_eur"], p["mff_spending_m_eur"] + p["ngeu_spending_m_eur"], places=5)
                        self.assertFalse(any(other != p["code"] and other.startswith(p["code"]) for other in codes))
                        self.assertTrue(p["source_cells"])
                        self.assertTrue(all(ref.startswith(f"'{row['year']}'!") for ref in p["source_cells"].values()))

    def test_czech_rrf_and_erdf_source_values(self):
        country = next(c for c in self.data["countries"] if c["iso3"] == "CZE")
        row = next(r for r in country["series"] if r["year"] == 2024)
        programmes = {p["code"]: p for h in row["spending_breakdown"] for p in h.get("programmes", [])}
        rrf = programmes["2.2.21"]
        self.assertEqual(rrf["source_cells"], {"mff": "'2024'!K49", "ngeu": "'2024'!K152"})
        self.assertAlmostEqual(rrf["amount_m_eur"], 2184.652805, places=6)
        self.assertEqual(rrf["mff_spending_m_eur"], 0)
        self.assertAlmostEqual(programmes["2.1.11"]["mff_spending_m_eur"], 582.111759, places=6)

    def test_older_years_do_not_claim_current_programme_coverage(self):
        for country in self.data["countries"]:
            for row in country["series"]:
                if row["year"] < 2021:
                    self.assertNotIn("spending_breakdown", row)

    def test_eu27_country_view_reconciles_for_each_displayed_year(self):
        reconciliations = {row["year"]: row for row in self.data["eu_reconciliation"]}
        self.assertEqual(set(reconciliations), {2021, 2022, 2023, 2024})
        for year, aggregate in reconciliations.items():
            country_rows = [
                next(row for row in country["series"] if row["year"] == year)
                for country in self.data["countries"]
            ]
            self.assertAlmostEqual(
                sum(row["allocated_spending_m_eur"] for row in country_rows),
                aggregate["attributed_spending_m_eur"], places=5,
            )
            self.assertAlmostEqual(
                sum(row["national_contribution_m_eur"] for row in country_rows),
                aggregate["national_contribution_m_eur"], places=5,
            )
            self.assertAlmostEqual(
                aggregate["attributed_spending_m_eur"] - aggregate["national_contribution_m_eur"],
                aggregate["accounting_difference_m_eur"], places=5,
            )
            self.assertAlmostEqual(
                aggregate["ngeu_attributed_spending_m_eur"] + aggregate["regular_difference_m_eur"],
                aggregate["accounting_difference_m_eur"], places=5,
            )
            self.assertAlmostEqual(
                aggregate["total_budget_payments_m_eur"] - aggregate["attributed_spending_m_eur"],
                aggregate["outside_country_view_m_eur"], places=5,
            )
            self.assertAlmostEqual(
                sum(aggregate["outside_country_view_breakdown"].values()),
                aggregate["outside_country_view_m_eur"], places=5,
            )

    def test_audited_2024_budget_revenue_is_fully_balanced(self):
        audited = self.data["audited_budget"]
        workbook = next(row for row in self.data["eu_reconciliation"] if row["year"] == 2024)
        self.assertEqual(audited["year"], 2024)
        self.assertEqual(sum(audited["revenue_breakdown"].values()), audited["revenue_m_eur"])
        self.assertAlmostEqual(
            audited["payments_m_eur"], workbook["total_budget_payments_m_eur"], delta=1,
        )
        self.assertEqual(audited["revenue_breakdown"]["ngeu_borrowing_proceeds_m_eur"], 73332)
        self.assertEqual(audited["budget_result_m_eur"], 1345)

    def test_2024_published_totals_are_pinned(self):
        row = next(row for row in self.data["eu_reconciliation"] if row["year"] == 2024)
        self.assertAlmostEqual(row["regular_attributed_spending_m_eur"], 122957.113404, places=6)
        self.assertAlmostEqual(row["ngeu_attributed_spending_m_eur"], 71746.311564, places=6)
        self.assertAlmostEqual(row["attributed_spending_m_eur"], 194703.424968, places=6)
        self.assertAlmostEqual(row["national_contribution_m_eur"], 121016.662331, places=6)
        self.assertAlmostEqual(row["accounting_difference_m_eur"], 73686.762637, places=6)
        self.assertAlmostEqual(row["total_budget_payments_m_eur"], 246988.298444, places=6)
        self.assertEqual(
            self.data["sources"]["sha256"],
            "ac05b66df6290b1a1eb73bd58dcab6e0833f7bcb414a7b401d482dc2dba4d58e",
        )

    def test_total_own_resources_definition_does_not_claim_false_additivity(self):
        definition = self.data["definitions"]["total_own_resources_m_eur"]
        self.assertIn("not exactly additive", definition)
        czech = next(country for country in self.data["countries"] if country["iso3"] == "CZE")
        row = next(row for row in czech["series"] if row["year"] == 2024)
        additive_total = row["national_contribution_m_eur"] + row["traditional_own_resources_m_eur"]
        self.assertNotAlmostEqual(additive_total, row["total_own_resources_m_eur"], places=3)


if __name__ == "__main__":
    unittest.main()
