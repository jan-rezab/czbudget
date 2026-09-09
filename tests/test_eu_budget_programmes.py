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


if __name__ == "__main__":
    unittest.main()
