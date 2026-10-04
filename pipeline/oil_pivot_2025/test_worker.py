import unittest
from pipeline.oil_pivot_2025.worker import source_rows,updated_rows,REPORTERS
from decimal import Decimal
class AnnualOilTests(unittest.TestCase):
 def source(self,**changes):
  r=dict(period='2025',typeCode='C',freqCode='A',reporterCode=156,partnerCode=643,partner2Code=0,cmdCode='270900',flowCode='M',customsCode='C00',motCode=0,isOriginalClassification=True,classificationCode='H6',primaryValue=Decimal('49039765736'),netWgt=Decimal('100855331239'));r.update(changes);return {'count':1,'data':[r],'error':''}
 def test_grain_and_decimal_conservation(self):
  r=source_rows(self.source(),156)[0];self.assertEqual(r['netWgt']/Decimal(365)/Decimal(1000000),Decimal('100855331239')/365/1000000)
  for change in [dict(freqCode='M'),dict(partnerCode=0),dict(reporterCode=643),dict(isOriginalClassification=False),dict(netWgt=-1)]:
   with self.assertRaises(ValueError):source_rows(self.source(**change),156)
 def test_incomplete_source_is_rejected(self):
  with self.assertRaises(ValueError):source_rows({'count':2,'data':self.source()['data']},156)
 def test_preserves_untargeted_routes_and_removes_missing_without_zero(self):
  old=[dict(origin_iso3='CAN',market_iso3='USA',value_usd='100',net_weight_kg='20'),dict(origin_iso3='RUS',market_iso3='DEU',value_usd='4',net_weight_kg='1')]
  obs=[dict(reporter_iso3='CHN',reporter_name='China',primary_value_usd='50',net_weight_kg='10',net_weight_is_estimated=False,source_last_released='2026-09-22',retrieved_at='2026-10-04')]
  out=updated_rows(old,obs,['CHN','DEU']);self.assertEqual(out[0],old[0]);self.assertEqual(out[1]['market_iso3'],'CHN');self.assertEqual(out[1]['market_iso2'],'CN');self.assertEqual(len(out),2)
 def test_fixed_eu27_and_core_market_coverage(self):
  self.assertEqual(len(REPORTERS),29);self.assertEqual(REPORTERS[156],'CHN');self.assertEqual(REPORTERS[699],'IND');self.assertNotIn('GBR',REPORTERS.values());self.assertNotIn('TUR',REPORTERS.values())
if __name__=='__main__':unittest.main()
