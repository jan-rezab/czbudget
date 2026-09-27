import io,unittest
from urllib.error import HTTPError
from probe_cdc_access import probe,official,LIMIT,probe_sources
URL='https://www.cdc.gov/brfss/annual_data/2024/files/LLCP2024ASC.zip'
class Response(io.BytesIO):
    status=200;headers={}
class Tests(unittest.TestCase):
    def test_denial_is_not_retried_or_bypassed(self):
        calls=[]
        def opener(req,timeout):
            calls.append(req)
            raise HTTPError(URL,403,'Denied',{},None)
        result=probe(URL,opener)
        self.assertEqual(result['status'],'access_denied')
        self.assertEqual(result['attempted_method'],'HEAD')
        self.assertFalse(result['range_get_attempted'])
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].method,'HEAD')
    def test_ignored_range_still_reads_only_bound(self):
        calls=[];body=Response(b'PK\x03\x04'+b'a'*10000)
        def opener(req,timeout):
            calls.append(req);return Response() if req.method=='HEAD' else body
        result=probe(URL,opener)
        self.assertTrue(result['range_get_attempted'])
        self.assertEqual(result['attempted_method'],'GET')
        self.assertEqual(result['received_bytes'],LIMIT)
        self.assertTrue(body.closed)
        self.assertTrue(result['zip_signature'])
        self.assertEqual(calls[1].get_header('Range'),'bytes=0-4095')
    def test_runtime_bound_stops_all_following_sources_and_discloses_unattempted(self):
        times=iter([0,0,221]);calls=[]
        sources=[dict(year=2024,page=URL,ascii=URL,layout=URL),dict(year=2025,page=URL,ascii=URL)]
        def access(url):calls.append(url);return {'status':'fixture'}
        results,unattempted=probe_sources(sources,clock=lambda:next(times),access_probe=access)
        self.assertEqual(len(calls),1)
        self.assertEqual(len(results),1)
        self.assertEqual([(r['year'],r['kind']) for r in unattempted],[(2024,'layout'),(2025,'ascii')])
    def test_nonofficial_or_credentials_and_queries_rejected(self):
        for url in ['https://example.com/file.zip',URL+'?token=a','https://user:secret@www.cdc.gov/brfss/annual_data/file','http://www.cdc.gov/brfss/annual_data/file']:
            with self.assertRaises(ValueError):official(url)
if __name__=='__main__':unittest.main()
