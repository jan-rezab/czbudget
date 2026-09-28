import json
import unittest
from publish import payloads

RELEASE='01234567-89ab-4cde-8fab-0123456789ab'
def row(product,value,count=1,received=2):
    return dict(product=product,period='2025',reporter_iso3='CZE',reporter_name='Czechia',partner_iso3='RUS',
        value_usd=value,product_count=count,accepted_source_rows=count,received_source_rows=received,
        missing_money_rows=0,release_ids='a|b',source_last_released='2026-01-01T00:00:00+00:00',retrieved_at='2026-01-02T00:00:00+00:00')

class ServingValidation(unittest.TestCase):
    def test_exact_negative_decimal_reconciliation_and_source_counts(self):
        rows=[row('TOTAL','100000000000000000000.000000001',2,5),row('01','100000000000000000001.000000001',1,3),row('02','-1',1,2)]
        bodies,controls=payloads(rows,RELEASE,'2026-09-28T10:00:00+00:00')
        self.assertEqual(json.loads(bodies['TOTAL'])['rows'][0]['value_usd'],rows[0]['value_usd'])
        self.assertEqual((controls['accepted_source_rows'],controls['received_source_rows'],controls['deduplicated_source_rows']),(2,5,3))
        self.assertEqual(len(bodies),104)
        self.assertEqual(json.loads(bodies['03'])['rows'],[])
    def test_wrong_basket_total_or_duplicate_holds_publication(self):
        for rows in ([row('TOTAL','5'),row('01','4')],[row('TOTAL','5'),row('01','5'),row('01','5')]):
            with self.assertRaises(ValueError): payloads(rows,RELEASE,'2026-09-28T10:00:00+00:00')
    def test_missing_amount_or_monthly_period_holds_publication(self):
        for field,value in [('missing_money_rows',1),('period','202501')]:
            rows=[row('TOTAL','5'),row('01','5')];rows[0][field]=value
            with self.assertRaises(ValueError): payloads(rows,RELEASE,'2026-09-28T10:00:00+00:00')

if __name__=='__main__': unittest.main()
