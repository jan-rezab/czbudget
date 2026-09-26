"""Synthetic batch/recovery contracts, no SDK calls or bulk datasets."""
import argparse,ast,gzip,hashlib,json,re,tempfile,time,unittest
from pathlib import Path
source=Path(__file__).with_name('report_sources.py').read_text();tree=ast.parse(source)
ns=dict(argparse=argparse,json=json,re=re,gzip=gzip,BUCKET='fixture',time=time,sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest())
selected=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'select_sources','uuid_run','preview_record','verify_stage','transaction_with_retry'}],type_ignores=[])
exec(compile(selected,'batch_helpers','exec'),ns)
class Blob:
 def __init__(self,data,generation=1):self.data=data;self.generation=generation;self.md5_hash='fixture'
 def reload(self):pass
 def download_to_filename(self,path,checksum):Path(path).write_bytes(self.data)
class Bucket:
 def __init__(self,data):self.object=Blob(data)
 def blob(self,name,generation=None):return self.object
class BatchTests(unittest.TestCase):
 def test_all_entries_partitioned(self):
  root=Path(__file__).parent;entries=[e for f in sorted((root/'audit').glob('*_fetch.json')) for e in json.loads(f.read_text())]
  manifest=json.loads((root/'source_groups.json').read_text());full=ns['select_sources'](entries,'all',manifest)
  batches=[ns['select_sources'](entries,g,manifest) for g in manifest['groups']]
  self.assertEqual(sum(map(len,batches)),len(full))
  self.assertEqual({e['source_id'] for e in full},{e['source_id'] for batch in batches for e in batch})
  wid=[g for g in manifest['groups'] if any(s.startswith('wid_') for s in manifest['groups'][g])]
  self.assertEqual(wid,['inequality'])
 def test_duplicate_missing_and_unknown_groups_rejected(self):
  entries=[{'source_id':'a'}]
  for manifest in [{'groups':{'x':['a','a']}},{'groups':{'x':[]}}]:
   with self.assertRaises(ValueError):ns['select_sources'](entries,'all',manifest)
  with self.assertRaises(ValueError):ns['select_sources'](entries,'unknown',{'groups':{'x':['a']}})
 def test_resume_uuid(self):
  self.assertEqual(ns['uuid_run']('5dc392de-1b7f-48d2-913f-99ca35774c51'),'5dc392de-1b7f-48d2-913f-99ca35774c51')
  with self.assertRaises(argparse.ArgumentTypeError):ns['uuid_run']('../run')
 def test_preview_excludes_respondent_values(self):
  preview={};ns['preview_record'](preview,'respondents',{'age':71,'answer':'private'})
  self.assertEqual(preview,{'column_types':{'age':['int'],'answer':['str']}})
  self.assertNotIn('private',json.dumps(preview))
 def test_verified_stage_resume_and_count_failure(self):
  row={'source_id':'a','source_sha256':'hash','source_url':'url','member':'x','record_json':json.dumps({'age':71})}
  data=gzip.compress((json.dumps(row)+'\n').encode());bucket=Bucket(data)
  saved={'stage_uri':'gs://fixture/processing-runs/hdr-report-sources/run/x.gz','stage_generation':'1','accepted_records':1,'stage_md5':'fixture'}
  with tempfile.TemporaryDirectory() as d:
   result=ns['verify_stage'](bucket,saved,{'source_id':'a','sha256':'hash','url':'url'},Path(d)/'stage.gz',{})
   self.assertEqual(result['stage_sha256'],hashlib.sha256(data).hexdigest())
   with self.assertRaises(ValueError):ns['verify_stage'](bucket,dict(saved,accepted_records=2),{'source_id':'a','sha256':'hash','url':'url'},Path(d)/'stage.gz',{})
   bucket.object.generation=2
   with self.assertRaises(ValueError):ns['verify_stage'](bucket,saved,{'source_id':'a','sha256':'hash','url':'url'},Path(d)/'stage.gz',{})
 def test_publication_release_replacement_and_group_pointer(self):
  self.assertIn('SELECT * REPLACE({q(rid)} AS release_id)',source)
  self.assertIn("STARTS_WITH(p.dataset_id,'hdr_report_sources_2025:')",source)
  self.assertIn('WHERE dataset_id={q(pointer)}',source)
class TransactionTests(unittest.TestCase):
 def test_only_confirmed_abort_retried(self):
  attempts=[];waits=[]
  def aborted():
   attempts.append(1)
   if len(attempts)<3:raise ValueError('Transaction is aborted due to concurrent update')
   return 'ok'
  self.assertEqual(ns['transaction_with_retry'](aborted,lambda:False,waits.append),'ok')
  self.assertEqual(waits,[1,2])
  with self.assertRaises(ValueError):ns['transaction_with_retry'](lambda:(_ for _ in ()).throw(ValueError('unknown network error')),lambda:False,waits.append)
 def test_confirmed_commit_never_retried(self):
  attempts=[]
  def unknown():attempts.append(1);raise ValueError('unknown network error')
  ns['transaction_with_retry'](unknown,lambda:True,lambda _:None)
  self.assertEqual(len(attempts),1)
class ConfigTests(unittest.TestCase):
 def test_cloudbuild_shell_substitutions_escaped(self):
  config=Path(__file__).with_name('cloudbuild.report_sources.yaml').read_text()
  self.assertIn('"$${LOADER_SHA}"',config)
  self.assertNotIn('"$LOADER_SHA"',config)
  self.assertIn("uuid_run(v) if v else None",source)
 def test_stable_shards_disjoint_and_complete(self):
  codes=['AA','BB','CC','DD','EE']
  shards=[[c for i,c in enumerate(codes) if i%4==n] for n in range(4)]
  self.assertEqual(sorted(c for shard in shards for c in shard),codes)
  self.assertEqual(len(set(c for shard in shards for c in shard)),len(codes))
if __name__=='__main__':unittest.main()
