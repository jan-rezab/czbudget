import base64
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'transforms'))
import run_un_comtrade_direct as direct


class DirectUploadTest(unittest.TestCase):
    def test_parallel_connections_claim_each_task_once(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)/'crawl.sqlite3'
            db = direct.c.connect(state)
            created = direct.c.now_iso()
            for number in range(40):
                db.execute("""INSERT INTO tasks (
                    task_id,parent_task_id,profile_id,product_type,frequency,period,
                    reporter_code,reporter_iso3,classification_code,flow_code,
                    partner_codes,product_selector,priority,status,created_at,updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(
                    f'task-{number:02d}',None,'test','C','A','2024',203,'CZE','H6','X',
                    '[0]','AG6',100,'queued',created,created))
            db.commit()
            db.close()

            def claim_all(_lane):
                connection = direct.c.connect(state)
                claimed = []
                try:
                    while task := direct.c.claim_next_task(connection):
                        claimed.append(task['task_id'])
                finally:
                    connection.close()
                return claimed

            with ThreadPoolExecutor(max_workers=8) as pool:
                claimed = [task for lane in pool.map(claim_all,range(8)) for task in lane]
            self.assertEqual(len(claimed),40)
            self.assertEqual(len(set(claimed)),40)

    def test_parallel_quota_reservations_stop_exactly_at_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)/'crawl.sqlite3'
            direct.c.connect(state).close()

            def spend_quota(_lane):
                connection = direct.c.connect(state)
                spent = 0
                try:
                    while True:
                        try:
                            direct.c.reserve_call(connection,50,'account-canary')
                            spent += 1
                        except direct.c.BudgetExhausted:
                            return spent
                finally:
                    connection.close()

            with ThreadPoolExecutor(max_workers=8) as pool:
                spent = sum(pool.map(spend_quota,range(8)))
            db = direct.c.connect(state)
            try:
                self.assertEqual(spent,50)
                self.assertEqual(direct.c.daily_calls(db,'account-canary'),50)
            finally:
                db.close()

    def test_remote_verification_requires_size_md5_and_generation(self):
        data = b'compressed fixture'
        md5 = base64.b64encode(hashlib.md5(data).digest()).decode()
        direct.verify_uploaded(data,{'size':len(data),'md5_hash':md5,'generation':'1'})
        for bad in ({'size':0,'md5_hash':md5,'generation':'1'},
                    {'size':len(data),'md5_hash':'wrong','generation':'1'},
                    {'size':len(data),'md5_hash':md5}):
            with self.assertRaises(direct.c.CloudPersistenceError):
                direct.verify_uploaded(data,bad)

    def test_sink_uploads_gzip_without_creating_a_local_raw_file(self):
        class FakeCloud:
            def put(self,uri,data,*,immutable=False):
                self.uri,self.data,self.immutable = uri,data,immutable
                return {'generation':'123','sha256':direct.digest(data),'uri':uri}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cloud = FakeCloud()
            settings = {'raw_path':'raw','archive':{'bucket_uri':'gs://test-private','raw_prefix':'raw'}}
            sink = direct.RawSink(settings,cloud)
            payload = {'data':[{'primaryValue':5}]}
            with patch.object(direct.c,'WORKSPACE',root):
                path,sha = sink({'task_id':'abc'},payload,root/'raw/C/A/2025/CZE/abc.json.gz')
            self.assertFalse(path.exists())
            self.assertEqual(list(root.rglob('*')),[])
            self.assertEqual(json.loads(gzip.decompress(cloud.data)),payload)
            self.assertIn(sha,cloud.uri)
            self.assertTrue(cloud.immutable)
            self.assertEqual(sink.receipts[0]['rows'],1)

    def test_failed_upload_has_no_success_receipt(self):
        class FailingCloud:
            def put(self,*args,**kwargs):
                raise RuntimeError('unavailable')
        settings = {'raw_path':'raw','archive':{'bucket_uri':'gs://test','raw_prefix':'raw'}}
        sink = direct.RawSink(settings,FailingCloud())
        with self.assertRaises(direct.c.CloudPersistenceError):
            sink({'task_id':'abc'},{'data':[]},direct.c.WORKSPACE/'raw/C/A/2025/CZE/abc.json.gz')
        self.assertEqual(sink.receipts,[])

    def test_gcs_uri_parser_rejects_non_gcs_and_missing_object(self):
        self.assertEqual(
            direct.Cloud.split_uri('gs://private-bucket/raw/a.json.gz'),
            ('private-bucket','raw/a.json.gz'))
        for uri in ('https://example.test/a','gs://bucket','not-a-uri'):
            with self.assertRaises(direct.c.CloudPersistenceError):
                direct.Cloud.split_uri(uri)

    def test_receipt_journal_returns_a_snapshot(self):
        journal = direct.ReceiptJournal()
        journal.add({'task_id':'one'})
        snapshot = journal.snapshot()
        snapshot.append({'task_id':'not-shared'})
        self.assertEqual(journal.snapshot(),[{'task_id':'one'}])

    def test_immutable_upload_uses_generation_precondition_and_one_response(self):
        data = b'raw-object'
        metadata = {
            'size':str(len(data)),
            'md5Hash':base64.b64encode(hashlib.md5(data).digest()).decode(),
            'generation':'7',
        }
        cloud = direct.Cloud()
        with patch.object(cloud,'_request_json',return_value=metadata) as request_json:
            receipt = cloud.put('gs://private/raw/task.json.gz',data,immutable=True)
        request = request_json.call_args.args[0]
        self.assertIn('ifGenerationMatch=0',request.full_url)
        self.assertEqual(request.data,data)
        self.assertEqual(request_json.call_count,1)
        self.assertEqual(receipt['generation'],'7')

    def test_immutable_retry_verifies_an_existing_object(self):
        data = b'checkpoint'
        metadata = {
            'size':str(len(data)),
            'md5Hash':base64.b64encode(hashlib.md5(data).digest()).decode(),
            'generation':'8',
        }
        conflict = urllib.error.HTTPError('https://storage.test',412,'exists',{},None)
        cloud = direct.Cloud()
        with patch.object(cloud,'_request_json',side_effect=[conflict,metadata]) as request_json:
            receipt = cloud.put('gs://private/checkpoints/id/crawl.sqlite3',data,immutable=True)
        self.assertEqual(request_json.call_count,2)
        self.assertEqual(receipt['generation'],'8')


if __name__ == '__main__':
    unittest.main()
