import copy,json,unittest
from report_compaction import compact_chart,expanded_rows
class CompactionTests(unittest.TestCase):
 def test_exact_multi_country_gaps_and_boundaries(self):
  chart=dict(id='provider-example',fields=[dict(key='value')],rows=[dict(country=c,period=str(y),value=v) for c,y,v in [('CZE',1999,None),('CZE',2000,None),('CZE',2001,1.23),('CZE',2002,None),('CZE',2003,2.34),('DEU',2000,None),('DEU',2001,5.67)]])
  old=copy.deepcopy(chart['rows']);compact_chart(chart)
  old=[dict(country=r['country'],year=int(r['period']),value=r['value']) for r in old]
  self.assertEqual(chart['missing_periods_by_country']['CZE'],[dict(start=1999,end=2000),dict(start=2002,end=2002)])
  self.assertEqual(sorted(old,key=lambda r:(r['country'],r['year'])),sorted(expanded_rows(chart),key=lambda r:(r['country'],r['year'])))
  self.assertEqual(chart['native_coverage'],dict(received_rows=7,nonmissing_rows=3,missing_rows=4))
 def test_partial_fields_retained_and_survey_details_exact(self):
  r=dict(country='CZE',period='2025',label='Some response',value=33.333333333333,valid_share=50.,weighted_n='0.3333333333333333333333333333333',unweighted_n=1,source_code='1',missing_kind=None)
  c=dict(id='ai-survey-Q8',rows=[r],fields=[dict(key='value')]);old=compact_chart(c)
  self.assertEqual(old[0],r);self.assertEqual(c['rows'][0]['value'],r['value']);self.assertEqual(c['row_defaults'],dict(country='CZE',period='2025'));self.assertNotIn('weighted_n',c['rows'][0])
 def test_explicit_numeric_null_keys_restore_and_zero_never_disappears(self):
  c=dict(id='mixed',fields=[dict(key='first'),dict(key='second')],rows=[dict(country='CZE',year=2023,first=0,second=None)])
  old=compact_chart(c)
  self.assertEqual(old[0]['second'],None);self.assertEqual(c['rows'][0],dict(first=0))
  self.assertEqual(list(expanded_rows(c)),[dict(country='CZE',year=2023,first=0,second=None)])
 def test_single_valid_year_defaults_do_not_override_explicit_missing_years(self):
  c=dict(id='provider-example',fields=[dict(key='value')],rows=[dict(country='CZE',period='2000',value=None),dict(country='CZE',period='2001',value=1.23456789)])
  old=[dict(r) for r in c['rows']];compact_chart(c)
  self.assertEqual(c['row_defaults'],dict(country='CZE',year=2001))
  self.assertEqual(sorted(expanded_rows(c),key=lambda r:r['year']),[dict(country=r['country'],year=int(r['period']),value=r['value']) for r in old])
  self.assertTrue(all('period' not in r for r in expanded_rows(c)))
 def test_core_tuple_roundtrip_precision_nulls_and_actual_scale_savings(self):
  rows=[dict(country='CZE' if i%2 else 'DEU',year=1990+i%34,hdi=.123456789,ihdi=.987654321,gdi=1.01234567,gii=.654321987,phdi=.234567891) for i in range(5992)]
  c=dict(id='hdro-indices-hdr25',fields=[dict(key=k) for k in ['hdi','ihdi','gdi','gii','phdi']],rows=rows)
  before=len(json.dumps(c,separators=(',',':')));old=compact_chart(c);after=len(json.dumps(c,separators=(',',':')))
  self.assertEqual(list(expanded_rows(c)),old);self.assertGreater(before-after,100000)
  c['rows'][0].pop()
  with self.assertRaises(ValueError):list(expanded_rows(c))
 def test_matched_wdi_shape_saves_over_1mb_without_losing_values(self):
  # Actual pinned source counts: two measures each2430 values/15060 null observations.
  rows=[dict(country='C'+str(i//66),period=str(1960+i%66),value=12.34 if i<2430 else None) for i in range(17490)]
  c=dict(id='provider-wdi',rows=rows,fields=[dict(key='value')]);before=len(json.dumps(c,separators=(',',':')));original=compact_chart(c);after=len(json.dumps(c,separators=(',',':')))
  self.assertEqual(len(list(expanded_rows(c))),17490);self.assertEqual(sum(r['value'] is not None for r in original),2430);self.assertGreater(2*(before-after),1000000)
if __name__=='__main__':unittest.main()
