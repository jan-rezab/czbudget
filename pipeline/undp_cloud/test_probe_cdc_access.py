import io,unittest
from urllib.error import HTTPError
from probe_cdc_access import probe,official,LIMIT
URL='https://www.cdc.gov/brfss/annual_data/2024/files/LLCP2024ASC.zip'
class Response(io.BytesIO):
    status=200;headers={}
class Tests(unittest.TestCase):
    def test_denial_is_not_retried_or_bypassed(self):
        calls=[]
        def opener(req,timeout):
            calls.append(req)
            raise HTTPError(URL,403,'Denied',{},None)
        self.assertEqual(probe(URL,opener)['status'],'access_denied')
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].method,'HEAD')
    def test_ignored_range_still_reads_only_bound(self):
        calls=[];body=Response(b'PK\x03\x04'+b'a'*10000)
        def opener(req,timeout):
            calls.append(req);return Response() if req.method=='HEAD' else body
        result=probe(URL,opener)
        self.assertEqual(result['received_bytes'],LIMIT)
        self.assertTrue(body.closed)
        self.assertTrue(result['zip_signature'])
        self.assertEqual(calls[1].get_header('Range'),'bytes=0-4095')
    def test_nonofficial_or_credentials_and_queries_rejected(self):
        for url in ['https://example.com/file.zip',URL+'?token=a','https://user:secret@www.cdc.gov/brfss/annual_data/file','http://www.cdc.gov/brfss/annual_data/file']:
            with self.assertRaises(ValueError):official(url)
if __name__=='__main__':unittest.main()
