import unittest

from pipeline.transforms.build_municipal_budget_map import HISTORY_RELEASE, TRANSFER_RELEASE, MapError, build, tidy

SQUARE = [[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]]


def inputs(**five):
    row = {"national_id": "00000001", "yrs": "5", "years_without_transfer_rows": "0", "cur_rev": "1000",
           "cur_exp": "700", "cap_fund": "100", "cap_exp": "500", "bal": "-100", "rev": "1100",
           "transfer_gap": "0", "pop": "0.2", "pop_null": "0", "history_run": HISTORY_RELEASE,
           "transfer_run": TRANSFER_RELEASE, **five}
    feature = lambda code, name: {"attributes": {"kod": code, "nazev": name}, "geometry": {"rings": SQUARE}}
    return {
        "state": [{"features": [feature(1, "Česko")]}],
        "regions": [{"features": [feature(2, "Kraj")]}],
        "municipalities": [{"features": [feature(500001, "OBEC"), feature(500002, "Újezd")]}],
        "five_year": [[row]],
        "snapshot": [{"fiscal_year": 2025, "municipalities": [{
            "national_id": "00000001", "short_name": "DOLNÍ NAD LESEM", "population": {"value": 210},
            "territory": {"municipality_code": 500001, "region_name": "Kraj"}, "seo": {"path": "/cz/x/"},
            "ratios": {"cash_to_expense": 0.5}, "amounts": {"cash_current": 400}}]}],
    }


class BudgetMapTest(unittest.TestCase):
    def test_ratios_and_identity(self):
        row = build(inputs(), "x")["municipalities"][0]
        self.assertEqual((row["o"], row["ob"], row["cx"], row["cf"], row["fb"]), (0.3, 300, 500, 100, -100))
        self.assertEqual(row["ce"], 700)
        self.assertEqual(row["k"], 500)  # 500 CZK / 5 years / 0.2 mean residents
        self.assertEqual(row["m"], 6.0)
        self.assertEqual(row["n"], "Dolní nad Lesem")

    def test_municipality_without_budget_keeps_its_boundary(self):
        doc = build(inputs(), "x")
        self.assertEqual([u["c"] for u in doc["unbudgeted"]], [500002])

    def test_broken_identity_fails(self):
        with self.assertRaises(MapError):
            build(inputs(bal="-99"), "x")

    def test_unpinned_release_fails(self):
        with self.assertRaises(MapError):
            build(inputs(transfer_run="261b7cbe"), "x")

    def test_missing_population_is_not_zero(self):
        self.assertIsNone(build(inputs(pop=None, pop_null="1"), "x")["municipalities"][0]["k"])

    def test_tidy_keeps_mixed_case(self):
        self.assertEqual(tidy("Brno"), "Brno")


if __name__ == "__main__":
    unittest.main()
