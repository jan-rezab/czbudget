import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('gate',Path(__file__).resolve().parents[1]/'scripts/check-cloud-verification.py')
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class CloudVerificationTest(unittest.TestCase):
    def test_receipts_are_bound_to_candidate_base_lane_identity_and_success(self):
        build={'status':'SUCCESS','serviceAccount':'projects/p/serviceAccounts/'+gate.VERIFIER,'tags':['plane-verification','fast-ui'],'substitutions':{'_CANDIDATE_SHA':'a'*40,'_BASE_SHA':'b'*40},'steps':[{'args':['node scripts/run-component-gate.mjs']} ]}
        self.assertTrue(gate.valid_build(build,'a'*40,'b'*40,'component'))
        self.assertFalse(gate.valid_build(build,'c'*40,'b'*40,'component'))
        self.assertFalse(gate.valid_build(build,'a'*40,'c'*40,'component'))
        self.assertFalse(gate.valid_build(build,'a'*40,'b'*40,'full'))
        for key,value in [('status','WORKING'),('serviceAccount','other'),('tags',[])]:
            self.assertFalse(gate.valid_build({**build,key:value},'a'*40,'b'*40,'component'))

    def test_full_receipt_requires_the_trusted_trigger_and_completed_gate(self):
        build={'status':'SUCCESS','serviceAccount':gate.VERIFIER,'tags':['plane-verification','full-browser'],
               'buildTriggerId':'8fb8b1d5-0e9f-4cd2-a76e-8e2fb18d50d3',
               'substitutions':{'COMMIT_SHA':'a'*40},'steps':[{'id':'verification-complete'}]}
        self.assertTrue(gate.valid_build(build,'a'*40,'b'*40,'full'))
        self.assertTrue(gate.valid_build(build,'a'*40,'b'*40,'component'))
        for key,value in [('buildTriggerId','other'),('steps',[]),('status','FAILURE'),('substitutions',{'COMMIT_SHA':'c'*40})]:
            self.assertFalse(gate.valid_build({**build,key:value},'a'*40,'b'*40,'full'))
