import unittest
from publish_wid_snapshot import merge_wid_snapshots
class WidSnapshotTests(unittest.TestCase):
 def chart(self,sid,country,rows):
  return dict(id='provider-wid-current-'+sid,source_refs=[dict(source_id=sid,vintage='snapshot2026',table='sptincj992')],unit='proportion',denominator=dict(en='age992/popj',cs='age992/popj'),rows=[dict(country=country,period=y,value=v) for y,v in rows],fields=[dict(key='value')])
 def test_latest_not_common_year_and_full_history_retained(self):
  a=self.chart('CZ','CZE',[('2021',.13),('2023',.14),('2024',None)]);b=self.chart('DE','DEU',[('2021',.20),('2022',.22)])
  charts,exports=merge_wid_snapshots([a,b]);c=charts[0]
  self.assertEqual([(r['country'],r['period'],r['value']) for r in c['rows']],[('CZE','2023',.14),('DEU','2022',.22)])
  self.assertEqual(len(exports[c['id']]),5);self.assertTrue(any(r['value'] is None for r in exports[c['id']]))
  self.assertEqual({r['source_id'] for r in exports[c['id']]},{'CZ','DE'});self.assertEqual(len(c['source_refs']),2)
 def test_distinct_vintage_never_merged_conflicts_rejected(self):
  a=self.chart('CZ','CZE',[('2023',.14)]);b=self.chart('CZ2','CZE',[('2023',.15)])
  with self.assertRaises(ValueError):merge_wid_snapshots([a,b])
  b['source_refs'][0]['vintage']='snapshot2025';self.assertEqual(len(merge_wid_snapshots([a,b])[0]),2)
if __name__=='__main__':unittest.main()
