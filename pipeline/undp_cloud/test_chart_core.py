import unittest
from chart_core import metric_charts, survey_distributions, survey_aggregated_distributions, source_csv_observations, wdi_inequality, gcp_territorial, wid_observations
class ChartContractTests(unittest.TestCase):
 def test_survey_denominator_missing_codes(self):
  common=dict(release_id='r',source_id='s',variable='Q1',country='X')
  rows=[dict(common,respondent_id='1',source_value='1',value_label='Yes',missing_kind=None,survey_weight='2'),dict(common,respondent_id='2',source_value='99',value_label='Unknown',missing_kind='explicit_nonresponse',survey_weight='1'),dict(common,respondent_id='3',source_value='1',value_label='Yes',missing_kind=None,survey_weight=None)]
  r=survey_distributions(rows,[dict(source_id='s',variable='Q1',metadata_json='{}')])[0]
  self.assertEqual((r['weighted_denominator_all'],r['weighted_denominator_valid'],r['excluded_invalid_weight_n']),('3','2',1))
  self.assertEqual(next(x for x in r['categories'] if x['source_code']=='1')['share_valid_weighted_percent'],'100')
  self.assertIsNone(next(x for x in r['categories'] if x['source_code']=='99')['share_valid_weighted_percent'])
 def test_aggregated_survey_bins_provenance(self):
  common=dict(release_id='r',source_id='s',variable='Q8',geography='X',source_url='https://source',source_sha256='sha',countries=['X'])
  bins=[dict(common,source_value='1',value_label='Yes',missing_kind=None,received_n=2,usable_weight_n=1,invalid_weight_n=1,weighted_n='2'),dict(common,source_value='99',value_label='Unknown',missing_kind='explicit_nonresponse',received_n=1,usable_weight_n=1,invalid_weight_n=0,weighted_n='1')]
  r=survey_aggregated_distributions(bins,[dict(source_id='s',variable='Q8',metadata_json='{}')])[0]
  self.assertEqual((r['weighted_denominator_all'],r['weighted_denominator_valid'],r['excluded_invalid_weight_n']),('3','2',1))
  self.assertEqual(r['respondents_received'],3)
  self.assertEqual(r['source_provenance'][0]['source_url'],'https://source')
  self.assertEqual(next(x for x in r['categories'] if x['source_code']=='1')['share_valid_weighted_percent'],'100')
 def test_common_year_rank_ties_gdi(self):
  rows=[dict(release_id='r',source_id='s',source_vintage='v',metric='hdi',country_code=c,year=y,value=v,unit='index',geography_kind='country_or_area') for c,y,v in [('A',2023,'.8'),('B',2023,'.8'),('C',2023,'.6'),('D',2022,'.9')]]
  rank=next(x for x in metric_charts(rows) if x['kind']=='ranking')
  self.assertEqual(rank['denominator'],3);self.assertEqual([x['calculated_rank'] for x in rank['observations']],[1,1,3])
  self.assertFalse(any(x['kind']=='ranking' for x in metric_charts([dict(rows[0],metric='gdi')])))
 def test_unep_native_missing_year(self):
  row=dict(source_id='unep',release_id='r',member='f',row_number=2,record_json={'kind':'data','columns':['Country','Flow name','Flow code','Flow unit','2023','2024'],'values':['X','Footprint','MF/cap','t/cap','8.2','']})
  obs=list(source_csv_observations([row],'unep',{'MF/cap'}));self.assertEqual(obs[0]['value'],'8.2');self.assertEqual(obs[0]['unit'],'t/cap');self.assertIsNone(obs[1]['value'])
 def test_current_wid_native_variable_and_denominator_are_preserved(self):
  common=dict(source_id='wid_current_DE',release_id='r',member='data',row_number=1)
  data=dict(variable='sptincj992',percentile='p99p100',age='992',pop='j',country='DE',year='2024',value='0.123',data_quality='estimated')
  rows=[dict(common,record_json=data),dict(common,row_number=2,record_json=dict(data,age='999')),dict(common,row_number=3,record_json=dict(data,pop='i')),dict(common,row_number=4,record_json=dict(data,variable='sptinc992j'))]
  obs=list(wid_observations(rows));self.assertEqual(len(obs),1)
  self.assertEqual((obs[0]['metric'],obs[0]['age'],obs[0]['population'],obs[0]['source_value']),('sptincj992','992','j','0.123'))
 def test_wdi_sum_held(self):
  rows=[dict(release_id='r',country_code='X',period='2023',metric=m,value=v) for m,v in [('SI.DST.FRST.20','5'),('SI.DST.02ND.20','10')]]
  obs,held=wdi_inequality(rows);self.assertEqual(held[0]['value'],'15');self.assertEqual(held[0]['status'],'held_pending_same_survey_welfare_verification')
 def test_gcp_exact_header_native_unit(self):
  common=dict(source_id='gcp',source_sha256='sha',release_id='r')
  rows=[dict(common,row_number=1,record_json={'sheet':'Territorial','representation':'cached_values','values':['Year','X']}),dict(common,row_number=2,record_json={'sheet':'Territorial','representation':'cached_values','values':[2023,2]})]
  c=dict(source_id='gcp',source_sha256='sha',sheet='Territorial',header_row=1,year_column=0,unit='MtC',country_columns=[dict(column=1,expected_header='X',country_code='XXX',geography_kind='country_or_area')])
  result=gcp_territorial(rows,c);self.assertEqual((result[0]['value'],result[0]['unit']),('2','MtC'))
  c['country_columns'][0]['expected_header']='Y'
  with self.assertRaises(ValueError):gcp_territorial(rows,c)
if __name__=='__main__':unittest.main()
