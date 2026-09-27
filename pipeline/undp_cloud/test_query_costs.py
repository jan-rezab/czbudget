import json
import os
import types
import unittest
from query_costs import BudgetedQueries, PinnedSourceSpool, QueryBudgetExceeded, pinned_source_query


class QueryCostsTests(unittest.TestCase):
    def budget(self, estimates, billed=None, **limits):
        calls=[]
        estimates=iter(estimates)
        bills=iter(billed or [])
        def query(sql, job_config, location):
            calls.append(job_config)
            if job_config.get('dry_run'):
                return types.SimpleNamespace(total_bytes_processed=next(estimates))
            return types.SimpleNamespace(result=lambda:[{'v':'original'}],total_bytes_billed=next(bills,0),job_id='job',cache_hit=False)
        return BudgetedQueries(types.SimpleNamespace(query=query),types.SimpleNamespace(QueryJobConfig=lambda **kw:kw),run_id='build',loader_sha='abc',**limits),calls

    def test_per_query_rejection_submits_only_dry_run(self):
        budget,calls=self.budget([101],max_query_bytes=100,max_run_bytes=200)
        with self.assertRaises(QueryBudgetExceeded):budget.query('sql')
        self.assertEqual(len(calls),1)
        self.assertTrue(calls[0]['dry_run'])

    def test_cumulative_budget_and_actual_rounding(self):
        budget,calls=self.budget([40,50,1],[60,50],max_query_bytes=100,max_run_bytes=110)
        budget.query('first',['pin']);budget.query('second')
        with self.assertRaises(QueryBudgetExceeded):budget.query('third')
        self.assertEqual(calls[1]['maximum_bytes_billed'],100)
        self.assertEqual(calls[3]['maximum_bytes_billed'],50)
        self.assertEqual(calls[1]['query_parameters'],['pin'])
        self.assertEqual(calls[1]['labels']['plane'],'data')
        self.assertEqual(budget.receipt()['billed_bytes'],110)
        self.assertEqual(len(calls),5)

    def test_unknown_estimate_fails_closed(self):
        budget,calls=self.budget([None])
        with self.assertRaises(QueryBudgetExceeded):budget.query('sql')
        self.assertEqual(len(calls),1)

    def metadata(self):
        return {'s1':{'release_id':'r1','sha256':'abc','accepted_records':1},'s2':{'release_id':'r2','sha256':'def','accepted_records':1}}

    def records(self):
        return [dict(release_id='r1',source_id='s1',member='original.csv',row_number=1,record_json='{"value":"0.123456789012345678901234567890"}',source_url='https://example.org/1',source_sha256='abc'),dict(release_id='r2',source_id='s2',member='original.csv',row_number=2,record_json='{"value":null}',source_url='https://example.org/2',source_sha256='def')]

    def test_one_scan_reused_and_exact_record_text_preserved(self):
        fetched=[]
        spool=PinnedSourceSpool(self.metadata(),lambda:fetched.append(True) or self.records())
        try:
            self.assertEqual(list(spool.rows('s1')),[self.records()[0]])
            self.assertEqual(list(spool.rows('s2')),[self.records()[1]])
            self.assertEqual(list(spool.rows('s1')),[self.records()[0]])
            self.assertEqual(len(fetched),1)
            directory=spool.directory.name
            self.assertEqual(spool.receipt()['received_rows'],2)
        finally:spool.close()
        self.assertFalse(os.path.exists(directory))

    def test_wrong_pin_hash_count_and_size_hold_publication(self):
        for field,value in [('release_id','wrong'),('source_sha256','wrong')]:
            with self.subTest(field=field):
                rows=self.records();rows[0][field]=value
                spool=PinnedSourceSpool(self.metadata(),lambda:rows)
                with self.assertRaises(ValueError):list(spool.rows('s1'))
                self.assertIsNone(spool.connection)
                with self.assertRaises(ValueError):list(spool.rows('s1'))
        spool=PinnedSourceSpool(self.metadata(),lambda:self.records()[:1])
        with self.assertRaises(ValueError):list(spool.rows('s1'))
        spool=PinnedSourceSpool(self.metadata(),self.records,max_spool_bytes=1)
        with self.assertRaises(QueryBudgetExceeded):list(spool.rows('s1'))
        self.assertIsNone(spool.directory)

    def test_query_uses_exact_bound_pairs_and_explicit_provenance(self):
        metadata=self.metadata();metadata['empty']={'release_id':'r3','accepted_records':0}
        sql,pins=pinned_source_query('project.dataset',metadata)
        self.assertEqual(json.loads(pins),[{'release_id':'r1','source_id':'s1'},{'release_id':'r2','source_id':'s2'}])
        self.assertIn('JOIN pins USING (release_id, source_id)',sql)
        self.assertIn('records.source_sha256',sql)
        self.assertNotIn('SELECT *',sql)
        self.assertNotIn('r1',sql)


if __name__=='__main__':unittest.main()
