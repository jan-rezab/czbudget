import copy
import unittest
from publish_reports import core_charts, survey_charts, validate, audit_ledger, bi
from pathlib import Path

SHA='a'*64
class PublicReportTests(unittest.TestCase):
 def core(self):
  common=dict(source_id='hdr',release_id='r',source_vintage='HDR2025',source_url='https://example.org/source',source_sha256=SHA,geography_kind='country_or_area',unit='index')
  return [dict(common,country_code=c,country_name=c,metric=m,year=y,value=v) for c,m,y,v in [('CZE','hdi',2023,'.9'),('DEU','hdi',2023,'.9'),('CZE','hdi',2022,'.8'),('CZE','gdi',2023,'1.1'),('CZE','le',2023,'80'),('CZE','le',2022,'79')]]
 def test_common_year_ties_components_and_parity(self):
  charts,countries=core_charts(self.core());rank=next(c for c in charts if '-rank-' in c['id'])
  self.assertEqual([r['rank'] for r in rank['rows']],[1,1])
  self.assertFalse(any('gdi-rank' in c['id'] for c in charts))
  life=next(c for c in charts if c['id'].startswith('hdro-le-'));self.assertEqual([r['year'] for r in life['rows']],[2023])
 def test_survey_exact_bins_czech_gap(self):
  common=dict(release_id='r',source_id='ai',variable='Q8',geography='Germany',source_url='https://example.org/ai',source_sha256=SHA,countries=['Germany'],received_n=1,usable_weight_n=1,invalid_weight_n=0)
  bins=[dict(common,source_value='1',value_label='Some',missing_kind=None,weighted_n='2'),dict(common,source_value='99',value_label="Don't know",missing_kind='explicit_nonresponse',weighted_n='1')]
  charts=survey_charts(bins,[dict(source_id='ai',variable='Q8',label='AI knowledge',metadata_json='{}')])
  self.assertEqual(charts[0]['rows'][0]['weighted_n'],'2');self.assertEqual(charts[0]['rows'][0]['country'],'DEU');self.assertFalse(any(r['country']=='CZE' for r in charts[0]['rows']))
  self.assertEqual(charts[0]['denominators'][0]['weighted_all'],'3');self.assertEqual(charts[0]['denominators'][0]['weighted_valid'],'2')
 def payload(self):
  charts,_=core_charts(self.core())
  return dict(schema_version='1.0.0',release_id='00000000-0000-4000-8000-000000000001',generated_at='2026-09-27T00:00:00+00:00',source_releases={'core':'r'},geographies=[dict(code=c,name=bi(c,c)) for c in ['CZE','DEU','WLD']],chapters=[dict(id='annex',title=bi('Annex','Příloha'))],charts=charts,coverage={'source_count':1,'unavailable_sources':[]})
 def test_invalid_unregistered_country_nonfinite_and_provenance(self):
  p=self.payload();self.assertLess(len(validate(p)),2*1024*1024)
  for mutate in [lambda x:x['charts'][0]['rows'][0].update(country='UNKNOWN'),lambda x:x['charts'][0]['rows'][0].update(value=float('nan')),lambda x:x['charts'][0]['source_refs'][0].update(sha256='bad')]:
   x=copy.deepcopy(p);mutate(x)
   with self.assertRaises(ValueError):validate(x)
 def test_full_caption_census_is_ledger_not_recreation(self):
  entries=audit_ledger(Path(__file__).parent/'audit')
  self.assertGreaterEqual(len(entries),86)
  self.assertFalse(any(e['status']=='ready' for e in entries))
if __name__=='__main__':unittest.main()
