import unittest
from unittest.mock import patch
from cloud_clients import BigQueryClient,QueryJobConfig,ScalarQueryParameter,Blob,Bucket

class FakeRest:
    def __init__(self): self.calls=[]
    def request(self,url,body=None,**kwargs):
        self.calls.append((url,body,kwargs))
        if body is not None: return {'jobReference':{'jobId':'one'},'statistics':{'query':{'totalBytesProcessed':'100'}}}
        if '/jobs/' in url: return {'status':{'state':'DONE'},'statistics':{'query':{'totalBytesProcessed':'100','totalBytesBilled':'10485760'}}}
        return {'jobComplete':True,'schema':{'fields':[{'name':'timestamp','type':'TIMESTAMP'},{'name':'money','type':'STRING'}]},
            'rows':[{'f':[{'v':'1790591400.123456'},{'v':'100000000000000000000.000000001'}]}]}

class RestContracts(unittest.TestCase):
    def test_query_cap_labels_timestamp_and_exact_decimal(self):
        with patch('cloud_clients.Rest',FakeRest): client=BigQueryClient('p','EU')
        job=client.query('SELECT x',QueryJobConfig(query_parameters=[ScalarQueryParameter('pin','TIMESTAMP','2026-09-28T00:00:00Z')],
            labels={'plane':'data'},maximum_bytes_billed=1000),location='EU')
        rows=job.result();request=client.api.calls[0][1]['configuration']
        self.assertEqual(request['query']['maximumBytesBilled'],'1000')
        self.assertEqual(request['labels'],{'plane':'data'})
        self.assertEqual(rows[0]['timestamp'],'2026-09-28T10:30:00.123456+00:00')
        self.assertEqual(rows[0]['money'],'100000000000000000000.000000001')
        self.assertEqual(job.total_bytes_billed,'10485760')
    def test_storage_reads_pin_generation_and_write_uses_cas(self):
        api=FakeRest();blob=Blob(Bucket(api,'private'),'a/b',123)
        blob.download_as_bytes(if_generation_match=123)
        self.assertIn('generation=123',api.calls[-1][0])
        self.assertIn('ifGenerationMatch=123',api.calls[-1][0])
        api.request=lambda url,body,**kwargs: (api.calls.append((url,body,kwargs)) or {'generation':'124'})
        blob.upload_from_string(b'{}',content_type='application/json',if_generation_match=0)
        self.assertIn('ifGenerationMatch=0',api.calls[-1][0]);self.assertEqual(blob.generation,'124')

if __name__=='__main__': unittest.main()
