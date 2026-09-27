import json,unittest
from wipo_family_history import derive_family_history
class Tests(unittest.TestCase):
 def fixture(self):
  sid='fixture';meta=dict(release_id='release',sha256='a'*64,url='https://source.example/data.xlsx');binding=dict(expected_families=3,export_header='Export2020',cutoff='2020-07-20')
  vals=[['S.No','DWPI Accession Number ','x','Earliest Priority Year (Year of first Filing) ','x','Export2020','x','Utility Model/Patent (how it was treated in the analysis)'],[1,'a','x',1998,'x','x','x','Patent'],[2,'b','x',1998,'x','x','x','Utility Model'],[3,'c','x',2020,'x','x','x','Research Disclosure']]
  rows=[dict(source_id=sid,release_id=meta['release_id'],source_sha256=meta['sha256'],source_url=meta['url'],record_json=json.dumps(dict(representation='cached_values',sheet='Overall Metadata',values=v))) for v in vals]
  return sid,meta,binding,rows
 def test_distinct_families_and_partial_year(self):
  sid,m,b,r=self.fixture();x=derive_family_history(r,sid,m,b)
  self.assertEqual([z['value'] for z in x['rows']],[2,1]);self.assertTrue(x['rows'][-1]['partial_year']);self.assertEqual(x['native_family_count'],3)
  self.assertEqual(x['native_treatment_counts']['Research Disclosure'],1)
 def test_formula_rows_do_not_duplicate(self):
  sid,m,b,r=self.fixture();extra=dict(r[-1]);p=json.loads(extra['record_json']);p['representation']='formulas';extra['record_json']=json.dumps(p)
  self.assertEqual(derive_family_history(r+[extra],sid,m,b)['native_family_count'],3)
 def test_duplicate_family_fails(self):
  sid,m,b,r=self.fixture()
  with self.assertRaisesRegex(ValueError,'Duplicate DWPI'):derive_family_history(r+[r[-1]],sid,m,b)
 def test_partial_coverage_or_wrong_header_fails(self):
  sid,m,b,r=self.fixture()
  with self.assertRaises(ValueError):derive_family_history(r[:-1],sid,m,b)
  p=json.loads(r[0]['record_json']);p['values'][3]='Publication Year';r[0]['record_json']=json.dumps(p)
  with self.assertRaises(ValueError):derive_family_history(r,sid,m,b)
 def test_missing_or_wrong_year_is_not_imputed(self):
  for bad in (None,'2020',2020.5,2021):
   sid,m,b,r=self.fixture();p=json.loads(r[-1]['record_json']);p['values'][3]=bad;r[-1]['record_json']=json.dumps(p)
   with self.assertRaises(ValueError):derive_family_history(r,sid,m,b)

class ProviderIntegrationTests(unittest.TestCase):
 def test_provider_emits_derived_global_history_with_pinned_provenance(self):
  from unittest.mock import patch
  import publish_ch3_4_panels as p
  _,meta,binding,rows=Tests().fixture();sid='wipo_assistive_conventional2021'
  meta['accepted_records']=4;meta['vintage']='2021 fixture'
  for row in rows:row['source_id']=sid
  binding.update(sha256=meta['sha256'],kind='conventional')
  with patch.object(p,'WIPO_BINDINGS',{sid:binding}):charts,gaps=p.provider_panels(lambda _:iter(rows),{sid:meta})
  self.assertEqual(len(charts),1);c=charts[0]
  self.assertEqual(c['unit'],'families');self.assertEqual(c['status'],'historical')
  self.assertTrue(all(r['country']=='WLD' for r in c['rows']))
  self.assertEqual(c['source_refs'][0]['sha256'],meta['sha256'])
  self.assertEqual(c['source_coverage']['original_corrected_scope'],'2000–2020')
  self.assertTrue(c['source_coverage']['partial_final_year'])
  self.assertIn('Calculation:',c['method']['en'])
 def test_unreviewed_snapshot_does_not_stream_source(self):
  import publish_ch3_4_panels as p
  sid='wipo_assistive_conventional2021';meta=dict(release_id='release',url='https://source.example/data',sha256='b'*64,accepted_records=4)
  charts,gaps=p.provider_panels(lambda _:self.fail('unreviewed source must not be streamed'),{sid:meta})
  self.assertEqual(charts,[]);self.assertTrue(any(g['source_id']==sid and 'different source snapshot' in g['reason'] for g in gaps))

if __name__=='__main__':unittest.main()
