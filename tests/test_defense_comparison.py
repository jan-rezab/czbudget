import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'data/defense-comparison.v1.json').read_text())
YEARS = DATA['years']
BY_CODE = {country['code']: country for country in DATA['countries']}
BY_ID = {group['id']: group for group in DATA['aggregates']}


def at(series, year):
    return series[YEARS.index(year)]


class DefenseComparisonTests(unittest.TestCase):
    def test_membership_and_axis(self):
        self.assertEqual(len([c for c in DATA['countries'] if c['nato_member']]), 32)
        self.assertEqual(len(DATA['countries']), 38)
        self.assertEqual((YEARS[0], YEARS[-1]), (1990, 2025))
        for country in DATA['countries']:
            for measure in DATA['measures']:
                self.assertEqual(len(country['series'][measure]), len(YEARS), country['code'])

    def test_aggregates_sum_their_members(self):
        for group in DATA['aggregates']:
            for measure in ('constant_usd', 'current_usd'):
                for index, year in enumerate(YEARS):
                    parts = [BY_CODE[code]['series'][measure][index] for code in group['members']]
                    parts = [value for value in parts if value is not None]
                    expected = round(sum(parts), 1) if parts else None
                    self.assertEqual(group['series'][measure][index], expected, f'{group["id"]} {measure} {year}')

    def test_aggregate_share_is_a_ratio_not_a_sum_of_shares(self):
        # Adding member GDP shares would put NATO past 80%. The published figure is
        # combined spending over combined GDP, so it has to sit between the European
        # members' share and the American one that pulls the alliance up.
        alliance = at(BY_ID['nato_total']['series']['gdp_share'], 2025)
        europe = at(BY_ID['nato_europe']['series']['gdp_share'], 2025)
        self.assertLess(europe, alliance)
        self.assertLess(alliance, at(BY_CODE['USA']['series']['gdp_share'], 2025))

    def test_montenegro_is_the_only_gap_in_the_modern_alliance(self):
        nato = BY_ID['nato_total']
        self.assertEqual(nato['member_count'], 32)
        self.assertEqual(nato['complete_from'], 2005)
        self.assertEqual(at(nato['members_reporting'], 2004), 31)
        self.assertIsNone(at(BY_CODE['MNE']['series']['constant_usd'], 2004))

    def test_estimate_flags_travel_with_the_numbers(self):
        # SIPRI prints every Chinese figure as its own estimate; the US series is reported.
        self.assertEqual(set(BY_CODE['CHN']['flags']['constant_usd'][-6:]), {'e'})
        self.assertNotIn('constant_usd', BY_CODE['USA'].get('flags', {}))
        for country in DATA['countries']:
            for measure, flags in country.get('flags', {}).items():
                self.assertEqual(len(flags), len(YEARS), country['code'])
                for index, mark in enumerate(flags):
                    has_value = country['series'][measure][index] is not None
                    self.assertEqual(mark != '.', has_value, f'{country["code"]} {measure} {YEARS[index]}')

    def test_iceland_reports_zero_rather_than_nothing(self):
        iceland = BY_CODE['ISL']
        self.assertTrue(iceland['nato_member'])
        self.assertEqual(at(iceland['series']['constant_usd'], 2025), 0)
        self.assertEqual(at(iceland['series']['gdp_share'], 2025), 0)

    def test_source_is_pinned_and_attributed(self):
        source = DATA['source']
        self.assertEqual(source['sha256'], '6cc3a30b1064f9f02e60236667eef82e08cad42910ce630909d004ad2c398a9d')
        self.assertIn('SIPRI', source['attribution'])
        self.assertNotIn('CC BY', source['attribution'])
        self.assertIn('Czechia', DATA['footnotes']['numbered'].get(
            BY_CODE['CZE']['source_note'].lstrip('†‡§¶‖'), ''))


if __name__ == '__main__':
    unittest.main()
