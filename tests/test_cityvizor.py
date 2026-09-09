import importlib.util, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('cityvizor',Path(__file__).resolve().parents[1]/'scripts/download-cityvizor.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CityVizorTests(unittest.TestCase):
 def test_bulk_preserves_duplicates_zero_and_empty_tables(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'all.zip'
   with zipfile.ZipFile(p,'w') as z:
    z.writestr('accounting.csv','year;incomeAmount\n2025;0\n')
    z.writestr('payments.csv','year;expenditureAmount\n2025;12\n2025;12\n')
    z.writestr('events.csv','')
   result=m.inspect_zip(p)
   self.assertEqual(result['payments.csv']['rows'],2)
   self.assertEqual(result['events.csv']['rows'],0)
 def test_rejects_malformed_bulk(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'all.zip'
   with zipfile.ZipFile(p,'w') as z:z.writestr('../payments.csv','')
   with self.assertRaises(ValueError):m.inspect_zip(p)
 def test_pagination_continues_past_server_cap(self):
  s=m.Snapshot(Path('/unused'));seen=[]
  def data(url,path):
   seen.append(url)
   return [[{'id':1},{'id':2}],[{'id':3}],[]][len(seen)-1]
  s.data=data
  result=s.pages('https://cityvizor.cz/api/public/profiles/1','1','payments',10000)
  self.assertEqual(result['rows'],3)
  self.assertTrue(result['terminal_empty_page'])
  self.assertTrue('offset=2&sort=' in seen[1])
  self.assertTrue('offset=3&sort=' in seen[2])
 def test_repeated_pages_fail_completeness(self):
  s=m.Snapshot(Path('/unused'));s.data=lambda *args:[{'id':1}]
  with self.assertRaises(ValueError):s.pages('https://cityvizor.cz','1','payments',100)
 def test_federation_requires_https_cityvizor_origin(self):
  self.assertEqual(m.origin('https://cityvizor.praha.eu/path'),'https://cityvizor.praha.eu')
  for url in ['http://cityvizor.cz','https://user:pass@cityvizor.cz','https://example.com']:
   with self.assertRaises(ValueError):m.origin(url)

spec_v=importlib.util.spec_from_file_location('cityvizor_verify',Path(__file__).resolve().parents[1]/'scripts/verify-cityvizor.py')
v=importlib.util.module_from_spec(spec_v);spec_v.loader.exec_module(v)
class CityVizorIntegrityTests(unittest.TestCase):
 def fixture(self,path,payments='profileId;year;incomeAmount;expenditureAmount\n1;2025;0;3.10\n',year=2025):
  with zipfile.ZipFile(path,'w') as z:
   z.writestr('accounting.csv',f'profileId;year;incomeAmount;expenditureAmount;budgetIncomeAmount;budgetExpenditureAmount\n1;{year};0;0.10;;0\n1;{year};0;0.20;;0\n')
   z.writestr('events.csv','year;id;name\n2025;7;Example\n')
   z.writestr('payments.csv',payments)
 def test_cent_precision_zero_and_missing_remain_distinct(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'all.zip';self.fixture(p);sums,counts=v.accounting(p,1,2025)
   self.assertEqual(str(sums['expenditureAmount']),'0.30')
   self.assertEqual(sums['incomeAmount'],0)
   self.assertIsNone(sums['budgetIncomeAmount'])
   self.assertEqual(counts['events.csv'],1)
 def test_wrong_source_year_is_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'all.zip';self.fixture(p,year=2024)
   with self.assertRaises(ValueError):v.accounting(p,1,2025)
 def test_unquoted_description_continuation_needs_verified_recovery(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'all.zip';self.fixture(p,payments='profileId;year;description\n1;2025;Description\n- extra line\n')
   with self.assertRaises(ValueError):v.accounting(p,1,2025)
   _,counts=v.accounting(p,1,2025,recovered_rows=[3])
   self.assertEqual(counts['payments.csv'],2) # original malformed parser count retained

class CityVizorTransportTests(unittest.TestCase):
 def response(self,payload,status=200):
  import io,gzip,requests,urllib3
  r=requests.Response();r.status_code=status;r.url='https://cityvizor.cz/api/test'
  r.headers={'Content-Type':'application/json','Content-Encoding':'gzip'}
  r.raw=urllib3.response.HTTPResponse(body=io.BytesIO(gzip.compress(payload)),headers=r.headers,preload_content=False)
  return r
 def test_http_gzip_is_decoded_before_cache_compression_and_cache_reused(self):
  import gzip,json
  from unittest.mock import Mock,patch
  with tempfile.TemporaryDirectory() as d:
   s=m.Snapshot(Path(d),delay=0);response=self.response(b'[{"id":1},{"id":1}]')
   transport=Mock();transport.get.return_value=response
   with patch.object(s,'session',return_value=transport):
    meta=s.fetch(response.url,'rows.json.gz')
    self.assertEqual(meta['rows'],2)
    with gzip.open(Path(d)/'rows.json.gz','rt') as f:self.assertEqual(json.load(f),[{'id':1},{'id':1}])
    self.assertEqual(s.fetch(response.url,'rows.json.gz'),meta)
   self.assertEqual(transport.get.call_count,1)
   self.assertTrue(transport.get.call_args.kwargs['verify'])
   self.assertTrue(transport.get.call_args.kwargs['stream'])
   self.assertEqual(transport.get.call_args.kwargs['timeout'],120)
 def test_http_gzip_wrapped_zip_is_stored_as_native_zip(self):
  import io
  from unittest.mock import Mock,patch
  payload=io.BytesIO()
  with zipfile.ZipFile(payload,'w') as z:
   z.writestr('accounting.csv','year;incomeAmount\n2025;0\n')
   z.writestr('payments.csv','');z.writestr('events.csv','')
  with tempfile.TemporaryDirectory() as d:
   s=m.Snapshot(Path(d),delay=0);transport=Mock();transport.get.return_value=self.response(payload.getvalue())
   with patch.object(s,'session',return_value=transport):
    meta=s.fetch('https://cityvizor.cz/api/export','all.zip','zip')
   self.assertEqual((Path(d)/'all.zip').read_bytes(),payload.getvalue())
   self.assertEqual(meta['members']['accounting.csv']['rows'],1)
 def test_permanent_http_error_not_cached_or_retried(self):
  from unittest.mock import Mock,patch
  with tempfile.TemporaryDirectory() as d:
   s=m.Snapshot(Path(d),delay=0);transport=Mock();transport.get.return_value=self.response(b'{"error":"missing"}',404)
   with patch.object(s,'session',return_value=transport),patch.object(m.time,'sleep'):
    with self.assertRaises(RuntimeError):s.fetch('https://cityvizor.cz/api/missing','missing.json.gz')
   self.assertEqual(transport.get.call_count,1)
   self.assertFalse((Path(d)/'missing.json.gz').exists())
   self.assertFalse((Path(d)/'missing.json.gz.meta.json').exists())
 def test_transient_http_error_retries_then_succeeds(self):
  from unittest.mock import Mock,patch
  with tempfile.TemporaryDirectory() as d:
   s=m.Snapshot(Path(d),delay=0);transport=Mock();transport.get.side_effect=[self.response(b'error',503),self.response(b'[]')]
   with patch.object(s,'session',return_value=transport),patch.object(m.time,'sleep'):
    self.assertEqual(s.fetch('https://cityvizor.cz/api/test','rows.json.gz')['rows'],0)
   self.assertEqual(transport.get.call_count,2)
 def test_sessions_reused_within_but_not_across_threads(self):
  import threading
  s=m.Snapshot(Path('/unused'));main=s.session();seen=[]
  def worker():
   first=s.session();seen.append(first);self.assertIs(first,s.session());first.close()
  thread=threading.Thread(target=worker);thread.start();thread.join()
  self.assertIs(main,s.session());self.assertIsNot(main,seen[0]);main.close()

class CityVizorPboCoverageTests(unittest.TestCase):
 def test_pbo_row_counts_keep_missing_and_unpublished_years_explicit(self):
  checks=v.pbo_payment_controls('prague/31',{'2023':2,'2025':1,'None':1},{'2023':2,'2024':3})
  byyear={c['year']:c for c in checks}
  self.assertTrue(byyear['2023']['matched'])
  self.assertEqual(byyear['2024']['difference_rows'],-3)
  self.assertFalse(byyear['2025']['published_bulk_year'])
  self.assertIsNone(byyear['None']['valid_bulk_rows'])
  self.assertEqual(sum(not c['matched'] for c in checks),3)
 def test_pbo_preserves_zero_and_duplicate_row_counts(self):
  checks=v.pbo_payment_controls('prague/31',{'2023':2},{'2023':2,'2024':0})
  self.assertTrue(all(c['matched'] for c in checks))

class CityVizorPublicationTests(unittest.TestCase):
 def load(self,name):
  spec=importlib.util.spec_from_file_location(name,Path(__file__).resolve().parents[1]/('scripts/'+name+'.py'))
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
 def test_catalogue_counts_one_payment_view_per_profile(self):
  import json,hashlib
  b=self.load('build-cityvizor-catalogue')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);profiles=[]
   for identifier,kind,count in [(1,'municipality',3),(2,'pbo',2)]:
    key='cityvizor.cz/'+str(identifier);path=key+'/2025/all.zip';(root/path).parent.mkdir(parents=True);(root/path).write_bytes(b'fixture')
    profiles.append({'key':key,'instance':'https://cityvizor.cz','profile':{'id':identifier,'name':kind,'type':kind,'ico':' '+str(identifier).zfill(8)+' ','url':kind},'years':[{'year':2025,'path':path,'members':{'accounting.csv':{'rows':1},'events.csv':{'rows':0},'payments.csv':{'rows':count}},'retrieved_at':'2026-09-09','sha256':hashlib.sha256(b'fixture').hexdigest(),'bytes':7}],'pbo_payments':{'rows':count} if kind=='pbo' else None})
   manifest={'complete':True,'profile_count':2,'profile_years':2,'profiles':profiles,'completed_at':'2026-09-09','scope':'fixture','definitions':{}}
   verification={'partial_run':False,'byte_and_row_integrity':True,'profiles':2,'verified_at':'2026-09-09','control_count':8,'source_control_exceptions':[]}
   (root/'manifest.json').write_text(json.dumps(manifest));(root/'verification.json').write_text(json.dumps(verification));out=root/'catalogue.json';b.build(root,out);result=json.loads(out.read_text())
   self.assertEqual(result['preferred_payment_view_rows'],5)
   self.assertEqual(result['profiles'][0]['ico'],'00000001')
   self.assertEqual(result['profiles'][0]['raw_ico'],' 00000001 ')
   self.assertEqual(result['profiles_with_payment_rows'],2)
   self.assertEqual(result['record_counts']['payments'],5)
   self.assertEqual(result['record_counts']['pbo_payments'],2)
   (root/profiles[0]['years'][0]['path']).write_bytes(b'changed')
   with self.assertRaises(ValueError):b.build(root,out)
 def test_bundle_refuses_partial_verification(self):
  import json
  b=self.load('package-cityvizor')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'manifest.json').write_text(json.dumps({'complete':True,'profile_count':1}));(root/'verification.json').write_text(json.dumps({'partial_run':True,'byte_and_row_integrity':True,'profiles':1}))
   with self.assertRaises(ValueError):b.build(root,root/'bundle.zip')

if __name__=='__main__':unittest.main()
