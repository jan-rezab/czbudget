import copy,csv,io,json,unittest
from promote_review_report import promotion_payload,rewrite_chart_csv,KEYS,PRIVATE
RID='00000000-0000-4000-8000-000000000001'
class PromotionTests(unittest.TestCase):
 def payload(self):
  source=dict(source_id='wid_CZ',url='https://wid.world/bulk/CZ.csv',table='sptincj992',vintage='snapshot2026',release_id=RID,sha256='a'*64)
  chart=dict(id='provider-wid-top1-latest-snapshot',chapter='annex',title=dict(en='Title',cs='Název'),method=dict(en='Method',cs='Metoda'),denominator=dict(en='age992/popj',cs='věk992/popj'),unit='proportion',status='ready',source_refs=[source],fields=[dict(key='value')],row_columns=['country','year','value'],rows=[['CZE',2023,.123456789]])
  return dict(schema_version='1.0.0',release_id=RID,generated_at='2026-09-27T01:00:00+00:00',publication_status='not_published',processing_status='validated_review_bundle',source_releases={'undp':RID},geographies=[dict(code='CZE'),dict(code='WLD')],chapters=[dict(id='annex')],charts=[chart],downloads={k:f'gs://{PRIVATE}/processing-runs/hdr-report-review/{RID}/{v}' for k,v in KEYS.items()})
 def test_promotion_only_rewrites_destinations(self):
  old=self.payload();snapshot=copy.deepcopy(old);new=promotion_payload(old,RID,{k:'verified_anonymous_head_200' for k in KEYS})
  self.assertEqual(old,snapshot);self.assertEqual(new['charts'],old['charts']);self.assertEqual(new['source_releases'],old['source_releases']);self.assertTrue(new['downloads']['core_csv'].startswith('https://'))
  old['downloads']['core_csv']='gs://wrong/object'
  with self.assertRaises(ValueError):promotion_payload(old,RID,{k:'verified_anonymous_head_200' for k in KEYS})
 def test_native_csv_exact_data_cells_and_matching_source(self):
  payload=self.payload();stream=io.StringIO();w=csv.writer(stream);w.writerow(['chart_id','country','period','label','field','value','unit','source_release','source_url','original_row_json'])
  raw='0.123456789123456789';w.writerow([payload['charts'][0]['id'],'CZE','2020','','value',raw,'proportion','ambiguous;releases','many;urls',json.dumps(dict(source_id='wid_CZ',source_value=raw))]);stream.seek(0);output=io.StringIO();proof=rewrite_chart_csv(stream,output,payload['charts']);output.seek(0);row=next(csv.DictReader(output))
  self.assertEqual(row['value'],raw);self.assertEqual(row['source_url'],'https://wid.world/bulk/CZ.csv');self.assertEqual(row['source_release'],RID);self.assertEqual(proof['data_cells_before_sha256'],proof['data_cells_after_sha256']);self.assertEqual(proof['corrected_wid_rows'],1)
 def test_unverified_download_suppressed(self):
  p=self.payload();access={k:'verified_anonymous_head_200' for k in KEYS};access['chart_details']='not_available_http_403';self.assertIsNone(promotion_payload(p,RID,access)['downloads']['chart_details'])
if __name__=='__main__':unittest.main()
