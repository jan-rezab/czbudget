import unittest
from decimal import Decimal
from original_survey_figures import *
REF={'source_id':'hdr25_timeseries','release_id':'r','sha256':'a'*64,'url':'https://hdr.undp.org/exact.csv'}
def cells(variable,yes_weight=1,scope='hdi',group='High'):
    if variable in USE_DOMAINS:yes,no,miss=1,2,None
    elif variable in EXPECTED_DOMAINS:yes,no,miss=3,1,5
    elif variable in (PRODUCTIVITY,AUTOMATION,AUGMENTATION):yes,no,miss=4,3,6
    else:yes,no,miss=8,1,11
    return [dict(release_id='r',source_id='ai2025_survey',source_url='https://hdr.undp.org/exact.dta',source_sha256='b'*64,scope=scope,group_label=group,variable=variable,source_value=str(code) if code is not None else None,missing_kind='system_missing' if code is None else None,received_n=1,usable_weight_n=1,invalid_weight_n=0,weighted_n=str(weight),countries=['India']) for code,weight in [(yes,yes_weight),(no,4-yes_weight),(miss,1)]]
def all_cells():
    out=[]
    for scope,labels in [('hdi',HDI_GROUPS),('age',AGES),('hdi_age',[h+'|'+a for h in HDI_GROUPS for a in AGES])]:
        for label in labels:
            for v in VARIABLES:
                weight=USE_DOMAINS.index(v)+1 if v in USE_DOMAINS else (3 if v=='Q15' else 1)
                out+=cells(v,weight,scope,label)
    return out
class OriginalFigureTests(unittest.TestCase):
    def test_missing_denominator_and_native_codes(self):
        a=stats(cells('Q14'),'Q14');self.assertEqual(a['value'],20);self.assertEqual(a['valid_percent'],25)
        self.assertEqual(a['all_weight'],'5');self.assertEqual(a['valid_weight'],'4');self.assertEqual(a['missing_categories'][0]['source_code'],'11')
        self.assertEqual(stats(cells('Q14'),'Q14',denominator='valid_answers')['value'],25)
    def test_neutral_differs_between_figures(self):
        rows=cells(PRODUCTIVITY);self.assertEqual(stats(rows,PRODUCTIVITY)['value'],20)
        self.assertEqual(stats(rows,PRODUCTIVITY,half_neutral=True)['value'],50);self.assertIsNone(response_score(PRODUCTIVITY,'6'))
    def test_average_domains_and_agency_difference(self):
        charts,gaps=derive_panels(all_cells(),REF);self.assertFalse(gaps);self.assertEqual(len(charts),5)
        use=charts[0]['rows'][0];self.assertEqual(use['actual'],40);self.assertEqual(len(use['domain_denominators']),6)
        agency=charts[1]['rows'][0];self.assertEqual(agency['current'],20);self.assertEqual(agency['future'],60);self.assertEqual(agency['change'],40)
        self.assertEqual(charts[2]['rows'][0]['confidence'],20);self.assertEqual(charts[4]['rows'][0]['productivity'],50)
        self.assertEqual(charts[0]['published_value_benchmark']['status'],'not_matched')
        self.assertNotEqual(charts[0]['original_recreation_status'],'published_values_and_documented_method_matched')
    def test_published_benchmark_gate(self):
        rows=[{'label':g,**{k:float(v) for k,v in vals.items()}} for g,vals in BENCHMARKS['2.1'].items()]
        self.assertEqual(benchmark('2.1',rows)['status'],'passed');rows[0]['future']+=0.06
        self.assertEqual(benchmark('2.1',rows)['status'],'not_matched')
    def test_invalid_codes_duplicates_and_weights_fail(self):
        with self.assertRaises(ValueError):response_score('Q14','99')
        with self.assertRaises(ValueError):response_score(EDUCATION,'1.5')
        c=cells('Q14');c+=c[:1]
        with self.assertRaises(ValueError):stats(c,'Q14')
        c=cells('Q14');c[0]['invalid_weight_n']=1
        with self.assertRaises(ValueError):stats(c,'Q14')
    def test_query_exact_scoped_release_and_grouping(self):
        mapping={c:'High' for c in COUNTRIES};q=grouped_query('project.dataset',mapping)
        self.assertIn('r.release_id=@release',q);self.assertIn("a.variable='Q1'",q);self.assertIn('BETWEEN 15 AND 24',q)
        self.assertIn("'hdi_age' AS scope",q);self.assertNotIn('current_survey',q)
        with self.assertRaises(ValueError):grouped_query('bad`dataset',mapping)
        with self.assertRaises(ValueError):grouped_query('project.dataset',{'India':'High'})
    def test_missing_provenance_and_missing_marginal_fail(self):
        with self.assertRaises(ValueError):derive_panels(all_cells(),{})
        with self.assertRaises(ValueError):derive_panels([],REF)
        rows=all_cells();rows[0]['source_sha256']=None
        with self.assertRaises(ValueError):derive_panels(rows,REF)
    def test_uncodable_age_coverage_remains_visible(self):
        rows=all_cells()+cells('Q14',scope='age',group='__unmapped_age__');charts,gaps=derive_panels(rows,REF)
        self.assertEqual(len(gaps),3);self.assertEqual(gaps[0]['reason'],'unmapped source dimension retained');self.assertEqual(len(charts),5)
if __name__=='__main__':unittest.main()
