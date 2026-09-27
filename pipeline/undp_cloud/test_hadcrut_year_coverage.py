"""Synthetic native source rows verify latest-year completeness disclosure."""
import json
import unittest
from publish_ch5_6_panels import provider_panels

COLUMNS=['Time','Anomaly (deg C)','Lower confidence limit (2.5%)','Upper confidence limit (97.5%)']
ROOT='https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.'

def panels(months=None,monthly_release='fixture'):
    data={'hadcrut5_1':[['2025','1.01','0.99','1.03'],['2026','1.123456','1.10','1.15']]}
    if months is not None:
        data['hadcrut5_2']=[[f'2026-{month:02d}','1.20','1.18','1.22'] for month in months]
    meta={sid:dict(release_id=monthly_release if sid.endswith('_2') else 'fixture',url=ROOT+('monthly' if sid.endswith('_2') else 'annual')+'.csv',sha256=('b' if sid.endswith('_2') else 'a')*64,vintage='HadCRUT5.2.0.0',accepted_records=len(rows)+1) for sid,rows in data.items()}
    def records(sid):
        for row in [dict(kind='header',columns=COLUMNS)]+[dict(kind='data',columns=COLUMNS,values=values) for values in data[sid]]:
            yield dict(source_id=sid,release_id=meta[sid]['release_id'],source_sha256=meta[sid]['sha256'],source_url=meta[sid]['url'],record_json=json.dumps(row))
    charts,_=provider_panels(records,meta)
    return next(c for c in charts if c['id']=='provider-hadcrut5-1')

class HadcrutYearCoverageTests(unittest.TestCase):
    def test_partial_year_keeps_native_value_and_reports_month_count(self):
        chart=panels(range(1,9));latest=chart['rows'][-1]
        self.assertEqual(latest['value'],1.123456)
        self.assertEqual((latest['lower'],latest['upper']),(1.10,1.15))
        self.assertEqual(latest['calendar_year_status'],'partial_year')
        self.assertEqual(latest['observed_months'],8)
        self.assertEqual(latest['observed_through'],'2026-08')
        coverage=chart['source_coverage']['latest_year_monthly_coverage']
        self.assertEqual(coverage['monthly_sha256'],'b'*64)
        self.assertEqual(len(chart['source_refs']),2)
        self.assertIn('8 of 12',chart['method']['en'])
        self.assertIn('8 z 12',chart['method']['cs'])
        self.assertIn('without annual recalculation',chart['method']['en'])
    def test_all_twelve_months_are_required_for_complete_year(self):
        chart=panels(range(1,13))
        self.assertEqual(chart['rows'][-1]['calendar_year_status'],'complete_calendar_year')
        self.assertEqual(chart['rows'][-1]['observed_months'],12)
        chart=panels([1,2,3,4,5,6,7,8,9,10,12])
        self.assertEqual(chart['rows'][-1]['calendar_year_status'],'partial_year')
    def test_absent_or_different_pinned_release_never_implies_complete_year(self):
        for chart in [panels(),panels(range(1,13),monthly_release='other')]:
            self.assertEqual(chart['rows'][-1]['calendar_year_status'],'unverified')
            self.assertIsNone(chart['rows'][-1]['observed_months'])
            self.assertIn('completeness is unverified',chart['method']['en'])
            self.assertEqual(len(chart['source_refs']),1)

if __name__=='__main__':unittest.main()
