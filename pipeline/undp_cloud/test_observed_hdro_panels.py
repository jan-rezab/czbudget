import unittest
from publish_observed_hdro_panels import observed_panels,GROUPS
class ObservedHDROTests(unittest.TestCase):
 def fixtures(self):
  common=dict(release_id='r',source_id='hdr',source_vintage='HDR2025',source_url='https://example.org/source',source_sha256='a'*64,metric='hdi',geography_kind='aggregate',unit='index')
  return [dict(common,country_code=c,country_name=GROUPS[c][0],year=y,value=v) for c,y,v in [('ZZK.WORLD',2019,'.7'),('ZZK.WORLD',2020,'.69'),('ZZK.WORLD',2021,'.68'),('ZZK.WORLD',2022,'.71'),('ZZK.WORLD',2023,'.72'),('ZZA.VHHD',2023,'.94'),('ZZD.LHD',2023,'.51')]]
 def test_observed_delta_exact_inputs_and_no_forecast(self):
  charts=observed_panels(self.fixtures());delta=next(c for c in charts if c['id']=='observed-world-hdi-change')
  self.assertEqual([(r['year'],r['value']) for r in delta['rows']],[(2023,.01)])
  gap=next(c for c in charts if c['id']=='observed-hdi-group-gap');self.assertEqual(gap['rows'][0]['value'],.43);self.assertEqual(gap['rows'][0]['very_high_hdi'],'0.94')
  self.assertFalse(any(r['year']==2024 for c in charts for r in c['rows']))
  self.assertTrue(all(c['original_reproduction_status'].startswith('observed_series_only') for c in charts))
 def test_wrong_group_label_and_duplicate_fail(self):
  rows=self.fixtures();rows[0]['country_name']='Guessed region'
  with self.assertRaises(ValueError):observed_panels(rows)
  rows=self.fixtures()
  with self.assertRaises(ValueError):observed_panels(rows+[rows[0]])
if __name__=='__main__':unittest.main()
