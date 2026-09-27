import ast,copy,unittest
from pathlib import Path
from pisa_completion_contract import *
def fixture():
 return {'jobReference':dict(jobId=JOB,projectId='czbudget-janrezab',location='EU'),'configuration':{'jobType':'LOAD','load':{'destinationTable':copy.deepcopy(DESTINATION),'sourceUris':[STAGE],'sourceFormat':'NEWLINE_DELIMITED_JSON','writeDisposition':'WRITE_TRUNCATE','maxBadRecords':0,'schema':{'fields':[dict(name=n,type=t) for n,t in SCHEMA]}}},'status':{'state':'DONE'},'statistics':{'load':dict(outputRows='613745',inputFiles='1',inputFileBytes=str(LOAD_INPUT_BYTES),badRecords='0')}}
class Tests(unittest.TestCase):
 def test_complete(self):self.assertEqual(validate_successful_load(fixture()),613745)
 def test_running(self):
  x=fixture();x['status']['state']='RUNNING';self.assertEqual(validate_job_binding(x),'RUNNING')
  with self.assertRaises(ValueError):validate_successful_load(x)
 def test_wrong_input_or_append(self):
  for field,value in [('sourceUris',[STAGE+'.other']),('maxBadRecords',1),('writeDisposition','WRITE_APPEND')]:
   x=fixture();x['configuration']['load'][field]=value
   with self.assertRaises(ValueError):validate_successful_load(x)
 def test_partial_or_failed(self):
  x=fixture();x['statistics']['load']['outputRows']='613744'
  with self.assertRaises(ValueError):validate_successful_load(x)
  x=fixture();x['status']['errorResult']={'reason':'invalid'}
  with self.assertRaises(ValueError):validate_successful_load(x)
 def test_stage_pin(self):
  c=dict(source_id=SOURCE,stage_uri=STAGE,stage_generation=STAGE_GENERATION,stage_sha256=STAGE_SHA,accepted_records=613745,parser_git_sha=PARSER_SHA)
  validate_stage_metadata(c,STAGE_GENERATION,STAGE_BYTES,STAGE_SHA)
  for k,v in [('parser_git_sha','newvalidator'),('stage_generation','other'),('accepted_records',613744)]:
   x=dict(c);x[k]=v
   with self.assertRaises(ValueError):validate_stage_metadata(x,STAGE_GENERATION,STAGE_BYTES,STAGE_SHA)
class WorkerBoundaryTests(unittest.TestCase):
 def test_no_native_reload_or_parser(self):
  code=Path(__file__).with_name('complete_pisa_load.py').read_text();tree=ast.parse(code)
  calls=[n.func.attr for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute)]
  self.assertNotIn('load_table_from_uri',calls)
  self.assertNotIn('read_file_in_chunks',calls)
  self.assertEqual(calls.count('load_table_from_json'),1)
  self.assertIn('existing_load_job_id=JOB',code)
  self.assertIn('original_parser_git_sha=PARSER_SHA',code)
  self.assertIn('completion_validator_git_sha=a.validator_sha',code)
  self.assertIn('SELECT * REPLACE',code)
  self.assertIn('BEGIN TRANSACTION',code)
  self.assertIn('COMMIT TRANSACTION',code)
  self.assertIn('PISA pointer changed during completion',code)
if __name__=='__main__':unittest.main()
