import copy
import unittest
from publish import payload_from_rows, PRODUCTS, dump

RELEASE='00000000-0000-4000-8000-000000000001'
class EnergyExportTests(unittest.TestCase):
    def rows(self):
        return [dict(product_code=code,frequency=f,period=p,period_start=d,reporting_markets=2,reported_origins=3,source_record_count=5,observed_value_usd='1234567890.123456789',observed_net_weight_kg=None,source_last_released=None,retrieved_at='2026-09-26T00:00:00Z') for code,_ in PRODUCTS.values() for f,p,d in [('A','2025','2025-01-01'),('M','202501','2025-01-01')]]
    def test_exact_source_precision_and_grains(self):
        payload,body=payload_from_rows(self.rows(),RELEASE,'2026-09-27T00:00:00Z')
        self.assertEqual(len(payload['products']),3)
        for product in payload['products']:
            self.assertEqual([row['frequency'] for row in product['periods']],['A','M'])
            self.assertEqual(product['periods'][0]['observed_value_usd_source'],'1234567890.123456789')
            self.assertIsNone(product['periods'][0]['observed_net_weight_kg'])
        self.assertLess(len(body),2*1024*1024)
    def test_invalid_source_cannot_publish(self):
        mutations=[lambda r:r.append(copy.deepcopy(r[0])),lambda r:r[0].update(frequency='A+M'),lambda r:r[0].update(period_start='2024-01-01'),lambda r:r[0].update(observed_value_usd=None),lambda r:r[0].update(observed_value_usd='NaN'),lambda r:r[0].update(reporting_markets=6),lambda r:r.clear()]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                rows=self.rows();mutation(rows)
                with self.assertRaises(ValueError):payload_from_rows(rows,RELEASE,'2026-09-27T00:00:00Z')

if __name__=='__main__':unittest.main()
