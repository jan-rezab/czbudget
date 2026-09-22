import importlib.util
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

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

    def test_candidate_config_receipt_pins_source_base_config_and_required_steps(self):
        commit, base, config_sha = 'a'*40, 'b'*40, 'c'*64
        build = {
            'status': 'SUCCESS', 'serviceAccount': gate.VERIFIER,
            'tags': ['plane-verification', 'full-browser'],
            'source': {'connectedRepository': {'repository': gate.CONNECTED_REPOSITORY, 'revision': commit}},
            'substitutions': {'_CANDIDATE_SHA': commit, '_BASE_SHA': base, '_VERIFY_CONFIG_SHA': config_sha},
            'steps': [{'id': step} for step in (
                'python-contracts', 'preflight-components', 'hydrate-published-releases',
                'verify-published-snapshots', 'verify-published-assets', 'validate-source-contract',
                'browser-contrast-a', 'nginx-routing', 'verification-complete')],
        }
        self.assertTrue(gate.valid_candidate_config_build(build, commit, base, config_sha))
        self.assertFalse(gate.valid_candidate_config_build(build, commit, 'd'*40, config_sha))
        self.assertFalse(gate.valid_candidate_config_build(build, commit, base, 'e'*64))
        self.assertFalse(gate.valid_candidate_config_build({**build, 'buildTriggerId': gate.FULL_TRIGGER}, commit, base, config_sha))
        self.assertFalse(gate.valid_candidate_config_build({**build, 'source': {'connectedRepository': {'repository': 'other', 'revision': commit}}}, commit, base, config_sha))
        self.assertFalse(gate.valid_candidate_config_build({**build, 'steps': build['steps'][:-1]}, commit, base, config_sha))

    def test_verifier_config_change_uses_one_exact_candidate_config_receipt(self):
        commit, base = 'a'*40, 'b'*40
        config_sha = hashlib.sha256(Path('cloudbuild.verify.yaml').read_bytes()).hexdigest()
        trigger = {
            'id': 'trigger', 'status': 'SUCCESS', 'serviceAccount': gate.VERIFIER,
            'tags': ['plane-verification', 'full-browser'], 'buildTriggerId': gate.FULL_TRIGGER,
            'substitutions': {'COMMIT_SHA': commit}, 'steps': [{'id': 'verification-complete'}],
        }
        direct = {
            'id': 'candidate-config', 'status': 'SUCCESS', 'serviceAccount': gate.VERIFIER,
            'tags': ['plane-verification', 'full-browser'],
            'source': {'connectedRepository': {'repository': gate.CONNECTED_REPOSITORY, 'revision': commit}},
            'substitutions': {'_CANDIDATE_SHA': commit, '_BASE_SHA': base, '_VERIFY_CONFIG_SHA': config_sha},
            'steps': [{'id': step} for step in (
                'python-contracts', 'preflight-components', 'hydrate-published-releases',
                'verify-published-snapshots', 'verify-published-assets', 'validate-source-contract',
                'browser-contrast-a', 'nginx-routing', 'verification-complete')],
        }
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json') as plan_file:
            json.dump({'commit': commit, 'base': base, 'lane': 'full', 'files': ['cloudbuild.verify.yaml']}, plan_file)
            plan_file.flush()
            with patch.object(sys, 'argv', ['gate', '--plan', plan_file.name]):
                with patch.object(gate.subprocess, 'check_output', return_value=json.dumps([trigger])):
                    with self.assertRaisesRegex(SystemExit, 'candidate-config build'):
                        gate.main()
                with patch.object(gate.subprocess, 'check_output', return_value=json.dumps([direct])):
                    gate.main()
