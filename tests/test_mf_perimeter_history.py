import unittest,json,gzip,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class PerimeterTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.d=json.loads((ROOT/'data/czech-mf-perimeter-history.v1.json').read_text())
 def test_actual_vs_declared_years(self):
  self.assertEqual([x['year'] for x in self.d['actual_perimeters']],[2020])
  registers=[x for x in self.d['declared_registers_and_changes'] if x['kind']=='declared-register'];self.assertEqual({x['year'] for x in registers},set(range(2016,2024)))
  self.assertEqual(len(self.d['declared_registers_and_changes']),15)
  missing={x['year'] for x in self.d['availability'] if x['actual_entity_list_status'].startswith('not_found')};self.assertEqual(missing,{2016,2017,2018,2019,2021,2022,2023})
 def test_native_rows_and_digests(self):
  for entry in self.d['declared_registers_and_changes']:
   detail=entry['detail'];raw=(ROOT/detail['path']).read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),detail['sha256'])
   d=json.loads(gzip.decompress(raw));self.assertEqual(sum(len(s['rows']) for s in d['sheets']),entry['native_nonempty_rows'])
   self.assertEqual(d['status'],'declared_reporting_perimeter_not_verified_final_membership')
 def test_actual2020_does_not_copy_request_count(self):
  e=self.d['actual_perimeters'][0];d=json.loads(gzip.decompress((ROOT/e['detail']['path']).read_bytes()));self.assertEqual(d['count'],18159);self.assertEqual(len(d['records']),18159);self.assertEqual(len({r['source_identifier'] for r in d['records']}),18159)
  self.assertEqual(d['year'],2020);self.assertEqual(d['response_dated'],'2021-12-02')
if __name__=='__main__':unittest.main()
