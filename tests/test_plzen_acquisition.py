import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('plzen',Path(__file__).resolve().parents[1]/'pipeline/transforms/fetch_plzen_budget_projects.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PlzenAcquisitionTests(unittest.TestCase):
 def test_discovers_new_deployment_ids_by_name_and_rejects_ambiguity(self):
  chunks=[f'(0,x.createServerReference)("{i:040x}",x.callServer,void 0,x.findSourceMapURL,"{name}")' for i,name in enumerate(m.ACTION_NAMES,1)]
  self.assertEqual(m.discover_references(chunks)['getNode'],'0'*39+'1')
  with self.assertRaises(ValueError):m.discover_references(chunks[:2])
  with self.assertRaises(ValueError):m.discover_references(chunks+[chunks[0].replace('0'*39+'1','f'*40)])
 def node(self,**kwargs):
  return dict(title='Projekt',nodeId=1,detailId='ABC',approved=None,edited=0,real=-3,hasChild=False,**kwargs)
 def test_missing_data_is_not_successful_empty(self):
  for payload in ({'isError':False},{'isError':False,'data':None},{'isError':True,'data':[]}):
   with self.assertRaises(ValueError):m.validate_payload('getNode',payload)
  self.assertEqual(m.validate_payload('getNode',{'isError':False,'data':[]}),[])
 def test_null_zero_negative_and_units_preserved(self):
  node=self.node();m.validate_payload('getNode',{'isError':False,'data':[node]});clean=m.clean_node(node)
  self.assertIsNone(clean['approved_thousand_czk']);self.assertEqual(clean['adjusted_thousand_czk'],0);self.assertEqual(clean['actual_thousand_czk'],-3)
  del node['real']
  with self.assertRaises(ValueError):m.validate_payload('getNode',{'isError':False,'data':[node]})
 def test_tree_repeated_parent_is_fetched_once_per_year(self):
  class Client:
   def __init__(self):self.calls=[]
   def call(self,name,args):
    self.calls.append((name,args))
    return {'data':[{'title':'Parent','nodeId':1,'detailId':None,'hasChild':True}]*2 if name=='getNode' else []}
  client=Client();rows=m.crawl_year(client,2026)
  self.assertEqual(len(client.calls),2);self.assertEqual(len(rows),2)
 def test_flight_signed_zero_and_undefined_preserved(self):
  import math
  node=self.node();node.update(real='$-0',approved='$undefined')
  m.validate_payload('getNode',{'isError':False,'data':[node]})
  self.assertEqual(math.copysign(1,node['real']),-1);self.assertIsNone(node['approved'])
 def test_unavailable_detail_fails_before_compaction(self):
  with self.assertRaises(ValueError):m.validate_payload('getDetail',{'isError':False,'data':{}})
if __name__=='__main__':unittest.main()
