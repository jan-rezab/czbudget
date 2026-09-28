from datetime import date
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from pipeline.czech_hlidac_cloud.bounded_stage import PageCache,StageGuard,StageLimit
from pipeline.transforms.fetch_hlidac_contracts import fetch_full_history

class Blob:
    def __init__(self,bucket,name): self.bucket=bucket;self.name=name;self.generation='1'
    def exists(self): return self.name in self.bucket.data
    def reload(self): pass
    def download_as_bytes(self,**kwargs): return self.bucket.data[self.name]
    def upload_from_string(self,body,**kwargs):
        assert kwargs['if_generation_match']==0 and self.name not in self.bucket.data
        self.bucket.data[self.name]=body
class Bucket:
    def __init__(self): self.data={}
    def blob(self,name): return Blob(self,name)

class BoundedReplay(unittest.TestCase):
    def test_stage_and_idle_deadlines(self):
        now=[0];guard=StageGuard(60,30,clock=lambda:now[0]);now[0]=31
        with self.assertRaises(StageLimit): guard.check()
        guard.progressed();now[0]=59;guard.check();now[0]=60
        with self.assertRaises(StageLimit): guard.check()
    def test_new_worker_reuses_raw_pages_and_rebuilds_complete_accounting(self):
        bucket=Bucket();calls=[]
        def source(token,query,page,progress_guard):
            progress_guard();calls.append(page)
            return {'total':2,'results':[{'id':str(page),'predmet':'test','datumZverejneni':'2025-01-01T00:00:00Z'}]}
        for run in ['first','retry']:
            cache=PageCache(bucket,'cutoff/raw-pages',run,StageGuard(),source);observed=[]
            with tempfile.TemporaryDirectory() as temporary,patch('pipeline.transforms.fetch_hlidac_contracts.MIN_INTERVAL_SECONDS',0):
                rows,_,_=fetch_full_history('token','00064581',date(2025,1,1),date(2025,12,31),Path(temporary)/'checkpoint',
                    page_observer=lambda start,end,page,payload:observed.extend(payload['results']),page_fetcher=cache.fetch)
            self.assertEqual(len(rows),2);self.assertEqual(len(observed),2)
            self.assertEqual(cache.fetched,2 if run=='first' else 0)
            self.assertEqual(cache.reused,0 if run=='first' else 2)
        self.assertEqual(calls,[1,2])
    def test_corrupted_checkpoint_never_reaches_normalization(self):
        import json
        bucket=Bucket();cache=PageCache(bucket,'pages','run',StageGuard(),lambda *a,**kw:{'results':[]})
        cache.fetch('token','query',1)
        key=next(iter(bucket.data));record=json.loads(bucket.data[key]);record['response']={'results':[{'id':'tampered'}]}
        bucket.data[key]=json.dumps(record).encode()
        with self.assertRaises(ValueError): cache.fetch('token','query',1)

if __name__=='__main__': unittest.main()
