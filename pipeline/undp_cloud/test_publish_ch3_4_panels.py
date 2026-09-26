"""Tiny aggregate contract fixtures; no real survey records or cloud I/O."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import publish_ch3_4_panels as p

class AggregatePanels(unittest.TestCase):
 def fixture(self):
  sid='itu_global_regional2025';digest='a'*64;member='itu.xlsx::Internet::cached'
  meta=dict(release_id='release',url='https://provider.example/data.xlsx',sha256=digest,vintage='2025',accepted_records=2)
  binding=dict(source_id=sid,source_sha256=digest,schema_evidence='reviewed fixture only',binding_verified=True,period='2025',geography='Source region',unit='percent',denominator='Individuals',metric='Internet use',method_version='fixture-1',selections=[dict(member=member,row_number=2,column_index=1,period='2025',geography='Source region',category='Source region',unit='percent',denominator='Individuals')])
  contract=dict(source_id=sid,source_sha256=digest,binding=binding,schema_anchors=[dict(member=member,row_number=1,column_index=1,source_value='Internet use (%)')],id='fixture-itu',chapter='chapter3',title=p.bi('Fixture','Test'),unit='percent',chart_type='bar',value_label=p.bi('Value','Hodnota'),method=p.bi('Fixture','Test'),denominator_en='Individuals',denominator_cs='Jednotlivci',original_refs=['3.10'],status='ready')
  rows=[dict(release_id='release',source_id=sid,source_sha256=digest,source_url=meta['url'],member=member,row_number=n,record_json=json.dumps(dict(values=v,representation='cached_values',sheet='Internet'))) for n,v in [(1,['Region','Internet use (%)']),(2,['Source region',74.25])]]
  return sid,meta,contract,rows
 def test_exact_aggregate_cell_preserves_source_value_and_provenance(self):
  sid,meta,c,rows=self.fixture()
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'contracts.json';path.write_text(json.dumps([c]))
   with patch.object(p,'CONTRACTS_PATH',path):charts,gaps=p.provider_panels(lambda _:iter(rows),{sid:meta})
  self.assertEqual(charts[0]['rows'][0]['source_value'],74.25)
  self.assertEqual(charts[0]['source_refs'][0]['release_id'],'release')
  self.assertEqual(charts[0]['rows'][0]['source_row_number'],2)
 def test_unreviewed_hash_is_gap_without_iterating_data(self):
  sid,meta,c,rows=self.fixture();meta['sha256']='b'*64
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'contracts.json';path.write_text(json.dumps([c]))
   with patch.object(p,'CONTRACTS_PATH',path):charts,gaps=p.provider_panels(lambda _:self.fail('must not iterate'),{sid:meta})
  self.assertEqual(charts,[]);self.assertTrue(any('different source snapshot' in g['reason'] for g in gaps))
 def test_changed_schema_anchor_fails_closed(self):
  sid,meta,c,rows=self.fixture();rows[0]['record_json']=json.dumps(dict(values=['Region','different unit'],representation='cached_values'))
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'contracts.json';path.write_text(json.dumps([c]))
   with patch.object(p,'CONTRACTS_PATH',path),self.assertRaisesRegex(ValueError,'anchor changed'):p.provider_panels(lambda _:iter(rows),{sid:meta})
if __name__=='__main__':unittest.main()
