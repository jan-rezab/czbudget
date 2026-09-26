import copy
import unittest
from publish_reports import core_charts, survey_charts, validate, audit_ledger, bi
from pathlib import Path

SHA='a'*64
class PublicReportTests(unittest.TestCase):
 def core(self):
  common=dict(source_id='hdr',release_id='r',source_vintage='HDR2025',source_url='https://example.org/source',source_sha256=SHA,geography_kind='country_or_area',unit='index')
  return [dict(common,country_code=c,country_name=c,metric=m,year=y,value=v) for c,m,y,v in [('CZE','hdi',2023,'.9'),('DEU','hdi',2023,'.9'),('CZE','hdi',2022,'.8'),('CZE','gdi',2023,'1.1'),('CZE','le',2023,'80'),('CZE','le',2022,'79')]]
 def test_common_year_ties_components_and_parity(self):
  charts,countries=core_charts(self.core());rank=next(c for c in charts if '-rank-' in c['id'])
  self.assertEqual([r['rank'] for r in rank['rows']],[1,1])
  self.assertFalse(any('gdi-rank' in c['id'] for c in charts))
  life=next(c for c in charts if c['id'].startswith('hdro-le-'));self.assertEqual([r['year'] for r in life['rows']],[2023])
 def test_survey_exact_bins_czech_gap(self):
  common=dict(release_id='r',source_id='ai',variable='Q8',geography='Germany',source_url='https://example.org/ai',source_sha256=SHA,countries=['Germany'],received_n=1,usable_weight_n=1,invalid_weight_n=0)
  bins=[dict(common,source_value='1',value_label='Some',missing_kind=None,weighted_n='2'),dict(common,source_value='99',value_label="Don't know",missing_kind='explicit_nonresponse',weighted_n='1')]
  charts=survey_charts(bins,[dict(source_id='ai',variable='Q8',label='AI knowledge',metadata_json='{}')])
  self.assertEqual(charts[0]['rows'][0]['weighted_n'],'2');self.assertEqual(charts[0]['rows'][0]['country'],'DEU');self.assertFalse(any(r['country']=='CZE' for r in charts[0]['rows']))
  self.assertEqual(charts[0]['denominators'][0]['weighted_all'],'3');self.assertEqual(charts[0]['denominators'][0]['weighted_valid'],'2')
 def payload(self):
  charts,_=core_charts(self.core())
  return dict(schema_version='1.0.0',release_id='00000000-0000-4000-8000-000000000001',generated_at='2026-09-27T00:00:00+00:00',source_releases={'core':'r'},geographies=[dict(code=c,name=bi(c,c)) for c in ['CZE','DEU','WLD']],chapters=[dict(id='annex',title=bi('Annex','Příloha'))],charts=charts,coverage={'source_count':1,'unavailable_sources':[]})
 def test_invalid_unregistered_country_nonfinite_and_provenance(self):
  p=self.payload();self.assertLess(len(validate(p)),2*1024*1024)
  for mutate in [lambda x:x['charts'][0]['rows'][0].update(country='UNKNOWN'),lambda x:x['charts'][0]['rows'][0].update(value=float('nan')),lambda x:x['charts'][0]['source_refs'][0].update(sha256='bad')]:
   x=copy.deepcopy(p);mutate(x)
   with self.assertRaises(ValueError):validate(x)
 def test_full_caption_census_is_ledger_not_recreation(self):
  entries=audit_ledger(Path(__file__).parent/'audit')
  self.assertGreaterEqual(len(entries),86)
  self.assertFalse(any(e['status']=='ready' for e in entries))

class PrivateOnlyExecutionTests(unittest.TestCase):
 def test_private_mode_never_opens_public_bucket_pointer_or_head(self):
  import io,json,os,sys,types
  from unittest.mock import patch
  import publish_reports as module
  rid='00000000-0000-4000-8000-000000000002';sha='a'*64;objects={};requested=[]
  class Blob:
   def __init__(self,bucket,name,generation=None):self.bucket=bucket;self.name=name;self.generation=generation
   def exists(self):return self.name in objects
   def reload(self):self.generation='1'
   def download_as_bytes(self,**kw):return objects[self.name]
   def upload_from_string(self,data,**kw):
    assert self.bucket.name==module.PRIVATE and 'current.json' not in self.name
    objects[self.name]=data.encode() if isinstance(data,str) else data;self.generation='1'
   def upload_from_filename(self,path,**kw):
    with open(path,'rb') as f:self.upload_from_string(f.read(),**kw)
   def open(self,mode):return io.BytesIO(objects[self.name])
  class Bucket:
   name=module.PRIVATE
   def blob(self,name,**kw):return Blob(self,name,**kw)
  class Storage:
   def bucket(self,name):requested.append(name);assert name==module.PRIVATE;return Bucket()
  common=dict(release_id='core',source_id='hdr',source_vintage='HDR2025',country_code='CZE',country_name='Czechia',geography_kind='country_or_area',year=2023,metric='hdi',sex='both',source_value='0.9',value='0.9',unit='index',source_column='hdi_2023',source_url='https://example.org/source',source_sha256=sha)
  annex=dict(common,sheet='Table1',row_number=1,column_number=3,period='2023',source_notes='["original note"]')
  class Result:
   def __init__(self,rows):self.rows=rows
   def result(self):return self.rows
  class BQ:
   def query(self,sql,**kw):
    if 'release_pointer' in sql:return Result([dict(dataset_id='undp_bundle_2025',release_id='core')])
    if 'metric_observations' in sql:return Result([common])
    if 'table_observations' in sql:return Result([annex])
    return Result([])
  bq=types.SimpleNamespace(Client=lambda **kw:BQ(),QueryJobConfig=lambda **kw:kw,ScalarQueryParameter=lambda *args:args,ArrayQueryParameter=lambda *args:args)
  storage=types.SimpleNamespace(Client=lambda **kw:Storage());cloud=types.ModuleType('google.cloud');cloud.bigquery=bq;cloud.storage=storage;google=types.ModuleType('google');google.cloud=cloud
  with patch.dict(sys.modules,{'google':google,'google.cloud':cloud,'google.cloud.bigquery':bq,'google.cloud.storage':storage}),patch.dict(os.environ,{'BUILD_ID':rid}),patch.object(sys,'argv',['publisher','--private-only','--loader-sha','fixture']),patch('urllib.request.urlopen',side_effect=AssertionError('No HTTP permitted in private mode')):
   module.main()
  self.assertEqual(requested,[module.PRIVATE])
  prefix='processing-runs/hdr-report-review/'+rid
  receipt=json.loads(objects[prefix+'/review-receipt.json']);manifest=json.loads(objects[prefix+'/validated-report-manifest.json'])
  self.assertEqual(receipt['publication_status'],'not_published');self.assertIsNone(receipt['publication_pointer'])
  self.assertEqual(manifest['bucket'],module.PRIVATE);self.assertEqual(manifest['generation'],'1')
  payload=json.loads(objects[prefix+'/reports.json'])
  self.assertTrue(all(url.startswith('gs://'+module.PRIVATE+'/') for url in payload['downloads'].values()))
  self.assertEqual(len(receipt['downloads']),4)

if __name__=='__main__':unittest.main()
