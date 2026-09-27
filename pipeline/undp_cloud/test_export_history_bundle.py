import copy,json,unittest
from export_history_bundle import history_bundle

RID='569ea124-a61b-4616-ac86-9061ea684998'
class HistoryTests(unittest.TestCase):
    def fixture(self):
        ref=dict(source_id='wid_test',url='https://example.org/native',vintage='test',table='sptincj992')
        chart=dict(id='provider-wid-top1-latest-test',unit='proportion',fields=[dict(key='value')],source_refs=[ref],rows=[dict(country='CZE',period='2024',value=.123456789)],row_defaults={'period':'2024'},chart_type='bar')
        rows=[dict(country='CZE',period='1900',value=0,source_value='0.000000',source_id='wid_test'),dict(country='CZE',period='1901',value=None,source_value=None,source_id='wid_test'),dict(country='CZE',period='2024',value=.123456789,source_value='0.123456789',source_id='wid_test')]
        return dict(release_id=RID,charts=[chart],coverage={}),dict(release_id=RID,charts=[dict(chart_id=chart['id'],rows=rows,unit='proportion',source_refs=[ref])])
    def test_every_native_row_and_precision_preserved(self):
        payload,details=self.fixture();before=copy.deepcopy(payload)
        index,objects=history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
        full=json.loads(next(iter(objects.values())))
        self.assertEqual(full['rows'],details['charts'][0]['rows']);self.assertEqual(payload,before)
        self.assertNotIn('row_defaults',full);self.assertEqual(full['chart_type'],'line')
        self.assertEqual(index['coverage']['history_export']['rows'],3)
    def test_no_synthetic_year_or_country_mean(self):
        payload,details=self.fixture();details['charts'][0]['rows'].pop(1)
        index,objects=history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
        self.assertEqual(len(objects),1);self.assertEqual([r['period'] for r in json.loads(next(iter(objects.values())))['rows']],['1900','2024'])
        self.assertNotIn('WLD',index['charts'][0]['history_by_country'])
    def test_material_history_preserves_native_historical_geography(self):
        payload,details=self.fixture();chart=payload['charts'][0]
        chart['id']='provider-unep-irp-current-mfa-totals-ratios-mf-cap'
        chart['title']={'en':'Material footprint','cs':'Materiálová stopa'}
        details['charts'][0]['chart_id']=chart['id']
        code='SRC-SERBIA-AND-MONTENEGRO'
        for row in details['charts'][0]['rows']:row['country']=code
        index,objects=history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
        full=json.loads(next(iter(objects.values())))
        self.assertEqual(full['rows'],details['charts'][0]['rows'])
        self.assertEqual(index['charts'][0]['history_by_country'][code]['rows'],3)
        self.assertTrue(next(iter(objects)).endswith('/'+code+'.json'))
        self.assertEqual(index['charts'][0]['rows'][0]['period'],'2024')
    def test_rejects_duplicate_changed_definition_and_missing_source(self):
        for change in [lambda d:d['charts'][0]['rows'].append(copy.deepcopy(d['charts'][0]['rows'][0])),lambda d:d['charts'][0].update(unit='percent'),lambda d:d['charts'][0]['rows'][0].update(source_id='wrong'),lambda d:d.update(release_id='other')]:
            payload,details=self.fixture();change(details)
            with self.assertRaises(ValueError):history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
    def test_component_histories_require_complete_source_and_keep_explicit_nulls(self):
        payload,details=self.fixture();chart=payload['charts'][0]
        chart['id']='hdro-le-hdr2025';chart['title']={'en':'Life expectancy — latest comparable year','cs':'Délka života — poslední společný rok'}
        details['charts'][0]['chart_id']=chart['id']
        with self.assertRaises(ValueError):history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
        chart['native_history_complete']=True
        for row in details['charts'][0]['rows']:row['value']=None
        index,objects=history_bundle(payload,details,'669ea124-a61b-4616-ac86-9061ea684998')
        full=json.loads(next(iter(objects.values())))
        self.assertEqual(full['status'],'unavailable');self.assertEqual(len(full['rows']),3)
        self.assertEqual(full['unit'],chart['unit'])

if __name__=='__main__':unittest.main()
