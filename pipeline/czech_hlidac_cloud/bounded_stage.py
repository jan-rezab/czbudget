"""Immutable page checkpoints and explicit bounded-stage completion."""
import hashlib
import json
import time
from datetime import datetime,timezone

class StageLimit(RuntimeError): pass
class StageGuard:
    def __init__(self,seconds=1200,idle_seconds=300,clock=time.monotonic):
        if not 60<=seconds<=1200 or not 30<=idle_seconds<=300: raise ValueError('Invalid stage/idle budget')
        self.clock=clock;self.started=self.last_progress=clock();self.seconds=seconds;self.idle_seconds=idle_seconds
    def check(self):
        now=self.clock()
        if now-self.started>=self.seconds: raise StageLimit('Stage time budget reached; retained pages are resumable')
        if now-self.last_progress>=self.idle_seconds: raise StageLimit('No source/checkpoint progress within idle allowance')
    def progressed(self): self.last_progress=self.clock()

def encoded(value): return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()

class PageCache:
    def __init__(self,bucket,prefix,build_id,guard,source_fetch):
        self.bucket=bucket;self.prefix=prefix;self.build_id=build_id;self.guard=guard;self.source_fetch=source_fetch
        self.fetched=self.reused=0;self.refs=[]
    def fetch(self,token,query,page):
        self.guard.check();key=hashlib.sha256(encoded({'query':query,'page':page})).hexdigest()
        blob=self.bucket.blob(self.prefix+'/'+key+'.json')
        if blob.exists():
            raw=blob.download_as_bytes(checksum='auto');record=json.loads(raw);self.reused+=1
            if record.get('query')!=query or record.get('page')!=page or hashlib.sha256(encoded(record['response'])).hexdigest()!=record.get('response_sha256'): raise ValueError('Raw page checkpoint does not match its query/hash')
        else:
            response=self.source_fetch(token,query,page,progress_guard=self.guard.check)
            record=dict(schema_version='hlidac-raw-page.v1',query=query,page=page,response=response,
                response_sha256=hashlib.sha256(encoded(response)).hexdigest(),source_url='https://api.hlidacstatu.cz/api/v2/smlouvy/hledat',
                retrieved_at=datetime.now(timezone.utc).isoformat(),build_id=self.build_id)
            raw=encoded(record)
            blob.upload_from_string(raw,content_type='application/json',if_generation_match=0,checksum='auto');blob.reload()
            if blob.download_as_bytes(checksum='auto')!=raw: raise ValueError('Raw page checkpoint readback differs')
            self.fetched+=1
        self.refs.append(dict(object=blob.name,generation=str(blob.generation),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw)))
        self.guard.progressed();return record['response']
