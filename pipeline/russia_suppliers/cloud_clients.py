"""Bounded stdlib clients using Cloud SDK's worker identity, no pip install."""
import json
from datetime import datetime,timezone
from decimal import Decimal
import subprocess
import time
from types import SimpleNamespace
import urllib.error
import urllib.parse
import urllib.request

class Rest:
    def __init__(self):
        self.token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True,timeout=30).strip()
    def request(self,url,body=None,method=None,raw=False,content_type='application/json'):
        if body is not None and not isinstance(body,bytes): body=json.dumps(body).encode()
        req=urllib.request.Request(url,data=body,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':content_type})
        with urllib.request.urlopen(req,timeout=45) as response:
            data=response.read(40*1024*1024+1)
        if len(data)>40*1024*1024: raise ValueError('API response exceeds bound')
        return data if raw else (json.loads(data) if data else {})

class QueryJobConfig(SimpleNamespace):
    pass
class ScalarQueryParameter:
    def __init__(self,name,kind,value): self.name=name;self.kind=kind;self.value=value
    def api(self):
        return dict(name=self.name,parameterType={'type':self.kind},parameterValue={'value':str(self.value)})

class QueryJob:
    def __init__(self,api,root,data,dry=False):
        self.api=api;self.root=root;self.data=data;self.dry=dry
        self.job_id=data.get('jobReference',{}).get('jobId')
        self.stats()
    def stats(self):
        stats=self.data.get('statistics',{}).get('query',{})
        self.total_bytes_processed=stats.get('totalBytesProcessed')
        self.total_bytes_billed=stats.get('totalBytesBilled')
        self.cache_hit=stats.get('cacheHit',False)
    def result(self):
        for _ in range(45):
            self.data=self.api.request(self.root+'/jobs/'+self.job_id+'?location=EU')
            if self.data.get('status',{}).get('state')=='DONE': break
            time.sleep(2)
        else: raise RuntimeError('Query polling timeout; do not resubmit')
        if self.data['status'].get('errorResult'): raise RuntimeError(json.dumps(self.data['status']['errorResult']))
        self.stats();url=self.root+'/queries/'+self.job_id+'?location=EU&maxResults=1000'
        rows=[]
        for _ in range(100):
            page=self.api.request(url)
            if not page.get('jobComplete'): raise RuntimeError('Query results not complete')
            fields=page.get('schema',{}).get('fields',[])
            for row in page.get('rows',[]):
                decoded={}
                for field,value in zip(fields,row['f']):
                    raw=value['v']
                    if raw is not None and field['type']=='TIMESTAMP':
                        raw=datetime.fromtimestamp(float(Decimal(raw)),timezone.utc).isoformat()
                    decoded[field['name']]=raw
                rows.append(decoded)
            if not page.get('pageToken'): return rows
            url=self.root+'/queries/'+self.job_id+'?location=EU&maxResults=1000&pageToken='+urllib.parse.quote(page['pageToken'])
        raise RuntimeError('Query result pagination exceeds bound')

class BigQueryClient:
    def __init__(self,project,location): self.api=Rest();self.root='https://bigquery.googleapis.com/bigquery/v2/projects/'+project;self.project=project
    def query(self,sql,job_config,location):
        query=dict(query=sql,useLegacySql=False,labels=job_config.labels,
            queryParameters=[p.api() for p in job_config.query_parameters],parameterMode='NAMED')
        # Labels belong on configuration, not query, in jobs.insert.
        labels=query.pop('labels')
        if getattr(job_config,'dry_run',False): query['useQueryCache']=False
        if getattr(job_config,'maximum_bytes_billed',None): query['maximumBytesBilled']=str(job_config.maximum_bytes_billed)
        config=dict(query=query,labels=labels,dryRun=getattr(job_config,'dry_run',False))
        body=dict(configuration=config,jobReference={'projectId':self.project,'location':'EU'})
        return QueryJob(self.api,self.root,self.api.request(self.root+'/jobs',body),config['dryRun'])
    def reuse(self,job_id,sql):
        import re
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,256}',job_id): raise ValueError('Invalid source job ID')
        data=self.api.request(self.root+'/jobs/'+job_id+'?location=EU')
        config=data['configuration'];query=config['query'];status=data['status']
        if status.get('state')!='DONE' or status.get('errorResult') or query.get('query')!=sql: raise ValueError('Source query is not the exact successful export')
        if config.get('labels',{}).get('purpose')!='russia-suppliers' or config['labels'].get('plane')!='data': raise ValueError('Source job attribution differs')
        if int(query.get('maximumBytesBilled','0'))>96*1024**3: raise ValueError('Source job allowance exceeds this export')
        pins=[p['parameterValue']['value'] for p in query.get('queryParameters',[]) if p['name']=='snapshot_at' and p['parameterType']['type']=='TIMESTAMP']
        if len(pins)!=1: raise ValueError('Source query has no exact timestamp pin')
        return QueryJob(self.api,self.root,data),pins[0],config['labels']

class Blob:
    def __init__(self,bucket,name,generation=None): self.bucket=bucket;self.name=name;self.generation=generation
    def url(self): return 'https://storage.googleapis.com/storage/v1/b/'+self.bucket.name+'/o/'+urllib.parse.quote(self.name,safe='')
    def exists(self):
        try: self.reload();return True
        except urllib.error.HTTPError as error:
            if error.code==404: return False
            raise
    def reload(self):
        data=self.bucket.api.request(self.url()+(('?generation='+str(self.generation)) if self.generation else ''))
        self.generation=data['generation']
    def download_as_bytes(self,if_generation_match=None,checksum=None):
        params={'alt':'media'}
        if self.generation: params['generation']=str(self.generation)
        if if_generation_match is not None: params['ifGenerationMatch']=str(if_generation_match)
        return self.bucket.api.request(self.url()+'?'+urllib.parse.urlencode(params),raw=True)
    def upload_from_string(self,body,content_type,if_generation_match,checksum=None):
        params={'uploadType':'media','name':self.name,'ifGenerationMatch':str(if_generation_match)}
        result=self.bucket.api.request('https://storage.googleapis.com/upload/storage/v1/b/'+self.bucket.name+'/o?'+urllib.parse.urlencode(params),body,content_type=content_type)
        self.generation=result['generation']

class Bucket:
    def __init__(self,api,name): self.api=api;self.name=name
    def blob(self,name,generation=None): return Blob(self,name,generation)
class StorageClient:
    def __init__(self,project): self.api=Rest()
    def bucket(self,name): return Bucket(self.api,name)

bigquery=SimpleNamespace(Client=BigQueryClient,QueryJobConfig=QueryJobConfig,ScalarQueryParameter=ScalarQueryParameter)
storage=SimpleNamespace(Client=StorageClient)
