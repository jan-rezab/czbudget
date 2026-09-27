import copy,json,unittest
from report_compaction import compact_chart,expanded_rows
class CompactionTests(unittest.TestCase):
 def test_exact_multi_country_gaps_and_boundaries(self):
  chart=dict(id='provider-example',fields=[dict(key='value')],rows=[dict(country=c,period=str(y),value=v) for c,y,v in [('CZE',1999,None),('CZE',2000,None),('CZE',2001,1.23),('CZE',2002,None),('CZE',2003,2.34),('DEU',2000,None),('DEU',2001,5.67)]])
  old=copy.deepcopy(chart['rows']);compact_chart(chart)
  self.assertEqual(chart['missing_periods_by_country']['CZE'],[dict(start=1999,end=2000),dict(start=2002,end=2002)])
  self.assertEqual(sorted(old,key=lambda r:(r['country'],r['period'])),sorted(expanded_rows(chart),key=lambda r:(r['country'],r['period'])))
  self.assertEqual(chart['native_coverage'],dict(received_rows=7,nonmissing_rows=3,missing_rows=4))
 def test_partial_fields_retained_and_survey_details_exact(self):
  r=dict(country='CZE',period='2025',label='Some response',value=33.333333333333,valid_share=50.,weighted_n='0.3333333333333333333333333333333',unweighted_n=1,source_code='1',missing_kind=None)
  c=dict(id='ai-survey-Q8',rows=[r],fields=[dict(key='value')]);old=compact_chart(c)
  self.assertEqual(old[0],r);self.assertEqual(c['rows'][0]['value'],r['value']);self.assertNotIn('weighted_n',c['rows'][0])
 def test_matched_wdi_shape_saves_over_1mb_without_losing_values(self):
  # Actual pinned source counts: two measures each2430 values/15060 null observations.
  rows=[dict(country='C'+str(i//66),period=str(1960+i%66),value=12.34 if i<2430 else None) for i in range(17490)]
  c=dict(id='provider-wdi',rows=rows,fields=[dict(key='value')]);before=len(json.dumps(c,separators=(',',':')));original=compact_chart(c);after=len(json.dumps(c,separators=(',',':')))
  self.assertEqual(len(list(expanded_rows(c))),17490);self.assertEqual(sum(r['value'] is not None for r in original),2430);self.assertGreater(2*(before-after),1000000)
if __name__=='__main__':unittest.main()
