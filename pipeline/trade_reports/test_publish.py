import unittest,re,hashlib,json,urllib.error
from pipeline.trade_reports.publish import partition,equivalent,key,numeric,Objects
from pipeline.trade_reports.queries import bulk,pinned
class Reports(unittest.TestCase):
 def test_russia_shared_totals_and_selected_bilateral_are_not_duplicated(self):
  def row(f,partner,flow,product,value):return dict(_frequency=f,period='2024' if f=='A' else '202401',reporter_iso3='KAZ',flow_code=flow,partner_area_code=str(partner),partner_iso3='RUS' if partner==643 else 'CHN',product_code=product,value_usd=value)
  rows=[row('A',0,'M','TOTAL','100'),row('A',0,'M','27','40'),row('A',156,'M','27','30'),row('A',156,'M','85','20'),row('A',643,'X','TOTAL','11'),row('A',643,'X','27','8'),row('A',0,'M','854231','2'),row('M',0,'M','TOTAL','50')]
  parts=partition('russia-aggregate',rows)
  self.assertEqual(len(parts),208)
  a=parts['russia-aggregate','A','27'];self.assertEqual(len(a),5);self.assertEqual(sum(r['product_code']=='TOTAL' for r in a),2)
  self.assertFalse(any(r['product_code']=='85' for r in a));self.assertFalse(any(len(r['period'])==6 for r in a))
  hs=parts['russia-aggregate','A','854231'];self.assertEqual(len(hs),5)
  self.assertEqual(len(parts['russia-aggregate','M','27']),1)
 def test_energy_period_and_grain_keys_are_separate(self):
  rows=[dict(_product='270900',frequency=f,period=p,origin_iso3='RUS',market_iso3='CZE',value_usd='1') for f,p in [('A','2024'),('M','202401')]]
  parts=partition('energy',rows);self.assertEqual(len(parts),2);self.assertNotIn('_product',parts['energy','270900','A','2024'][0])
 def test_route_partitions_keep_only_the_three_unlinked_legs(self):
  rows=[dict(_product='854231',period='202401',reporter_iso3=a,partner_iso3=b,value_usd='1') for a,b in [('DEU','RUS'),('DEU','KAZ'),('KAZ','RUS'),('FRA','RUS')]]
  parts=partition('russia-routes',rows);self.assertEqual(len(parts['russia-routes','DEU','KAZ','854231']),3);self.assertNotIn(('russia-routes','CHN','CHN','854231'),parts)
 def test_pins_follow_alias_and_keep_explicit_partition_bounds(self):
  self.assertIn('`czbudget-janrezab.budget_detail.trade_areas` AS areas FOR SYSTEM_TIME AS OF @snapshot_at',pinned('FROM `czbudget-janrezab.budget_detail.trade_areas` AS areas'))
  for sql in bulk().values():
   self.assertNotIn('CURRENT_DATE()',sql)
   self.assertEqual(sql.count('FOR SYSTEM_TIME AS OF'),sql.count('`czbudget-janrezab.budget_detail.'))
  self.assertIn("period_start BETWEEN DATE '2014-01-01'",bulk()['russia-aggregate'])
 def test_reconciliation_detects_changed_values_counts_and_provenance(self):
  a=[dict(period='2024',value_usd='1.01',source_hashes='b|a',reporter_name='Label')]
  self.assertTrue(equivalent(a,[dict(a[0],source_hashes='a|b',reporter_name='Other label')]))
  for changed in [dict(a[0],value_usd='1.02'),dict(a[0],source_hashes='a'),dict(a[0],period='2025')]:self.assertFalse(equivalent(a,[changed]))
  self.assertFalse(equivalent(a,a+a))
 def test_nonfinite_money_never_publishes_and_keys_match_js_json(self):
  with self.assertRaises(ValueError):numeric([{'value_usd':'NaN'}])
  self.assertEqual(key(['profile','CZE']),hashlib.sha256(b'["profile","CZE"]').hexdigest())
 def test_cas_conflict_never_overwrites_a_competing_pointer(self):
  class API:
   def request(self,*a,**kw):raise urllib.error.HTTPError(a[0],412,'conflict',{},None)
  with self.assertRaises(urllib.error.HTTPError):Objects(API()).write('bucket','current.json',b'new',generation='9')
 def test_immutable_retry_requires_exact_existing_bytes(self):
  class API:
   def request(self,url,data=None,**kw):
    if data is not None:raise urllib.error.HTTPError(url,412,'exists',{},None)
    if kw.get('raw'):return b'old'
    return {'generation':'12'}
  objects=Objects(API());self.assertEqual(objects.write('bucket','release.json',b'old')['generation'],'12')
  with self.assertRaises(ValueError):objects.write('bucket','release.json',b'changed')
if __name__=='__main__':unittest.main()
