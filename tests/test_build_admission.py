import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

spec=importlib.util.spec_from_file_location('admission',Path(__file__).parents[1]/'scripts/build-admission.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
COMMIT='a'*40;TREE='b'*40
REQUEST={'commit':COMMIT,'tree':TREE,'source_contracts_passed':True,'task':'example-task'}
def previous(status='FAILURE',build='old',cost=4):
    return {'commit':'c'*40,'build_id':build,'status':status,'reserved_czk':60,'charged_czk':cost,'rate_czk_per_minute':2}

class AdmissionTests(unittest.TestCase):
    def test_reserves_full_timeout_before_work(self):
        result=a.decide(a.POLICY,[],REQUEST,'new',COMMIT,TREE)
        self.assertEqual(result['reserved_czk'],60)
    def test_duplicate_success_and_active_task_are_rejected(self):
        for entries in [[dict(previous('SUCCESS'),commit=COMMIT)],[previous('WORKING')]]:
            with self.assertRaises(ValueError):a.decide(a.POLICY,entries,REQUEST,'new',COMMIT,TREE)
    def test_budget_includes_reservation_not_only_actual_spend(self):
        with self.assertRaisesRegex(ValueError,'allowance would be exceeded'):
            a.decide(a.POLICY,[previous('SUCCESS',cost=91)],REQUEST,'new',COMMIT,TREE)
    def test_failed_and_cancelled_attempts_share_same_task_history(self):
        entries=[previous(build='failed'),previous('CANCELLED',build='cancelled')]
        with self.assertRaisesRegex(ValueError,'correction'):
            a.decide(a.POLICY,entries,REQUEST,'new',COMMIT,TREE)
        receipt=dict(REQUEST,correction={'exit_code':0,'diagnosis':'fixed missing fixture','command':'node --test tests/focused.mjs','failed_builds':['failed','cancelled']})
        a.decide(a.POLICY,entries,receipt,'new',COMMIT,TREE)
        receipt['correction']['failed_builds']=['failed']
        with self.assertRaises(ValueError):a.decide(a.POLICY,entries,receipt,'new',COMMIT,TREE)
    def test_exhausted_attempts_cannot_be_reset_by_corrected_code(self):
        with self.assertRaisesRegex(ValueError,'attempt allowance'):
            a.decide(a.POLICY,[previous('SUCCESS',build=str(n),cost=0) for n in range(6)],REQUEST,'new',COMMIT,TREE)
    def test_wrong_candidate_or_missing_preflight_fails_closed(self):
        for change in [{'commit':'d'*40},{'tree':'e'*40},{'source_contracts_passed':False}]:
            with self.assertRaises(ValueError):a.decide(a.POLICY,[],dict(REQUEST,**change),'new',COMMIT,TREE)
    def test_finished_build_refunds_only_verified_duration(self):
        entry=previous('WORKING');entry.pop('charged_czk')
        result=a.reconcile([entry],lambda _:dict(status='SUCCESS',startTime='2026-10-07T10:00:00Z',finishTime='2026-10-07T10:03:00Z'))
        self.assertEqual(result[0]['charged_czk'],6)
        result=a.reconcile([entry],lambda _:dict(status='CANCELLED'))
        self.assertEqual(result[0]['charged_czk'],60)
    def test_stale_and_unreachable_main_never_admit(self):
        def opener(*args,**kwargs):return io.BytesIO(json.dumps({'object':{'sha':'f'*40}}).encode())
        with self.assertRaisesRegex(ValueError,'Stale candidate'):a.assert_current_main(COMMIT,opener)
        def unavailable(*args,**kwargs):raise TimeoutError('unavailable')
        with self.assertRaises(TimeoutError):a.assert_current_main(COMMIT,unavailable)
    def test_concurrent_task_claim_loses_cas_and_rechecks_active_build(self):
        class Fake:
            reads=0
            def read(self,key):
                if key.startswith('requests/'):return REQUEST,1
                if key.endswith('policy.json'):return a.POLICY,1
                self.reads+=1
                return ({'entries':[]},0) if self.reads==1 else ({'entries':[previous('WORKING',build='winner')]},2)
            def build(self,_):return {'status':'WORKING','timeout':'1800s','options':{'machineType':'E2_HIGHCPU_32'}}
            def write(self,key,value,generation):
                if key.endswith('ledger.json'):raise urllib.error.HTTPError('',412,'CAS lost',{},None)
        with patch.object(a,'assert_current_main'):
            with self.assertRaisesRegex(ValueError,'in-flight'):a.admit(Fake(),COMMIT,'new',TREE)
    def test_every_root_step_waits_for_admission_and_final_gate_remains(self):
        config=(Path(__file__).parents[1]/'cloudbuild.yaml').read_text()
        steps=config.split('\n  - id: ')[1:]
        self.assertTrue(steps[0].startswith('build-admission\n'))
        self.assertIn('waitFor: ["-"]',steps[0])
        for step in steps[1:]:self.assertNotIn('waitFor: ["-"]',step)
        final=next(s for s in steps if s.startswith('assert-current-main\n'))
        self.assertIn('full-verification',final);self.assertIn('image-browser-contract',final)
        self.assertIn('machineType: E2_HIGHCPU_32',config)

if __name__=='__main__':unittest.main()
