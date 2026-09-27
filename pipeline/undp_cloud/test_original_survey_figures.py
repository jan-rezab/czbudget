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
        self.assertEqual(charts[1]['chapter'],'chapter2')
        self.assertTrue(all(isinstance(f,dict) and set(f)=={'key','label'} for c in charts for f in c['fields']))
        self.assertTrue(all(ref.get('table') for c in charts for ref in c['source_refs']))
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
    def test_equal_country_normalization_keeps_original_weights(self):
        row=dict(received_n=1,usable_weight_n=1,invalid_weight_n=0,missing_kind=None)
        native=[dict(row,source_value='8',weighted_n='100'),dict(row,source_value='1',weighted_n='1')]
        normalized=[dict(row,source_value='8',weighted_n='1',original_weighted_n='100'),dict(row,source_value='1',weighted_n='1',original_weighted_n='1')]
        self.assertAlmostEqual(stats(native,'Q14',denominator='valid_answers')['value'],10000/101)
        x=stats(normalized,'Q14',denominator='valid_answers');self.assertEqual(x['value'],50)
        self.assertEqual(x['original_all_weight'],'101');self.assertEqual(x['original_numerator_weight'],'100')
        query=grouped_query('project.dataset',{c:'High' for c in COUNTRIES},pooling_mode='equal_country_total_weight')
        self.assertIn('survey_weight / country_total_weight',query)
        self.assertIn('original_weighted_n',query);self.assertIn("'equal_country_total_weight' pooling_mode",query)
        rows=all_cells()
        for r in rows:r['pooling_mode']='equal_country_total_weight';r['original_weighted_n']=r['weighted_n']
        charts,_=derive_panels(rows,REF,denominator='valid_answers')
        self.assertEqual(charts[0]['pooling_mode'],'equal_country_total_weight')
        self.assertIn('inferred',charts[0]['method']['en'])
        rows[0]['pooling_mode']='native_weights'
        with self.assertRaises(ValueError):derive_panels(rows,REF,denominator='valid_answers')
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
class GroupDefinitionTests(unittest.TestCase):
    def test_pinned_exact_hdi_thresholds_and_missing_sources(self):
        codes={name:f'C{i:02d}' for i,name in enumerate(COUNTRIES)}
        rows=[dict(country_code=code,year=2023,metric='hdi',source_value='.700',value='.700',release_id='r',source_id='hdr25_timeseries',source_url='https://hdr.undp.org/exact.csv',source_sha256='a'*64) for code in codes.values()]
        rows[0]['source_value']=rows[0]['value']='.699999';rows[1]['source_value']=rows[1]['value']='.800'
        mapping,ref=hdi_mapping_from_observations(rows,codes)
        self.assertEqual(mapping[COUNTRIES[0]],'Low and medium');self.assertEqual(mapping[COUNTRIES[1]],'Very high');self.assertEqual(mapping[COUNTRIES[2]],'High')
        self.assertEqual(ref['release_id'],'r');self.assertIn('page=284',ref['definition_url'])
        with self.assertRaises(ValueError):hdi_mapping_from_observations(rows[:-1],codes)
        with self.assertRaises(ValueError):hdi_mapping_from_observations(rows+rows[:1],codes)
if __name__=='__main__':unittest.main()
