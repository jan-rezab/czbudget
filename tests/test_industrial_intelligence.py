import csv,gzip,importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
fetch=module('fetch-industrial-intelligence');build=module('build-industrial-intelligence')
class ArchiveTests(unittest.TestCase):
 def test_source_flags_zero_and_year_cutoff_roundtrip(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'filtered').mkdir();raw=root/'source.gz';filtered=root/'filtered'/'fixture.tsv.gz'
   with gzip.open(raw,'wt') as f:f.write('freq,nace_r2,geo\\TIME_PERIOD\t2009 \t2010 \t2011 \t2012 \nA,C23,CZ\t9\t0\t: c\t2.5 p\nA,C24,DE\t1\t:\t:\t: b\nA,C25,DE\t4\t:\t:\t:\n')
   result=fetch.process(raw,filtered,2010)
   self.assertEqual(result['observations'],2);self.assertEqual(result['series'],2);self.assertEqual(result['first_period'],'2010');self.assertEqual(result['flags'],{'c':1,'p':1,'b':1})
   meta=dict(code='fixture',filtered_sha256=fetch.digest(filtered),**result)
   index=build.build_one(meta,root,root/'serving');self.assertEqual(index['served_rows'],2)
   rows=[]
   for g in index['groups']:
    for s in g['shards']:
     with gzip.open(root/'serving'/'fixture'/s['file'],'rt') as f:rows.extend(json.load(f))
   self.assertEqual(rows,[[['A','C23','CZ'],['0',': c','2.5 p']],[['A','C24','DE'],[':',':',': b']]])
 def test_every_scoped_dataset_served_and_periods_2010_onwards(self):
  root=ROOT/'data/industrial-intelligence'
  if not (root/'index.json').exists():self.skipTest('Build archive first')
  index=json.loads((root/'index.json').read_text());self.assertEqual(index['errors'],0);self.assertEqual(index['pending'],0)
  config=json.loads((ROOT/'pipeline/config/industrial-intelligence.json').read_text())
  self.assertEqual({x['code'] for x in config['datasets']},{x['code'] for x in index['datasets']})
  for item in index['datasets']:
   m=json.loads((root/item['code']/'index.json').read_text())
   self.assertTrue(all(int(p[:4])>=2010 for p in m['periods']))
   self.assertEqual(m['series'],sum(s['rows'] for g in m['groups'] for s in g['shards']))
   for g in m['groups']:
    for s in g['shards']:self.assertTrue((root/item['code']/s['file']).is_file())
if __name__=='__main__':unittest.main()
