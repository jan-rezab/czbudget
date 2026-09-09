import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('prepare_reporting', Path(__file__).parents[1] / 'scripts/prepare-reporting.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

class ReportingSetupTests(unittest.TestCase):
    def test_local_execution_is_refused(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(setup, 'gcloud') as command:
            with self.assertRaises(RuntimeError): setup.main()
            command.assert_not_called()

    def test_obsolete_release_makes_no_changes(self):
        marker = MagicMock(); marker.exists.return_value = False
        with patch.dict(os.environ, {'BUILD_ID':'test','PROJECT_ID':setup.PROJECT}), patch.object(setup, 'Path', return_value=marker), patch.object(setup, 'gcloud') as command:
            setup.main(); command.assert_not_called()

    def test_existing_resources_are_reused_and_environment_is_written_last(self):
        calls = []
        key = {'displayName':setup.KEY_NAME,'name':'projects/test/keys/public-key','webSettings':{'integrationType':'SCORE','allowedDomains':['publicspendingdata.org']}}
        def command(*args):
            calls.append(args)
            if args == ('firestore','databases','list'): return [{'name':'projects/test/databases/data-reports','type':'FIRESTORE_NATIVE','locationId':'europe-west1'}]
            if args == ('recaptcha','keys','list'): return [key]
            return None
        def urlopen(request, **kwargs):
            url = request.full_url
            if '/releases/' in url: value = {'rulesetName':'projects/test/rulesets/existing'}
            elif '/rulesets/' in url: value = {'source':{'files':[{'content':setup.RULE}]}}
            elif '/fields/' in url: value = {'ttlConfig':{'state':'ACTIVE'}}
            else: value = {}
            self.assertEqual(request.method,'GET')
            return io.BytesIO(json.dumps(value).encode())
        destination=MagicMock();destination.exists.return_value=True
        with patch.dict(os.environ, {'BUILD_ID':'test','PROJECT_ID':setup.PROJECT}), patch.object(setup, 'Path', return_value=destination), patch.object(setup, 'gcloud', side_effect=command), patch.object(setup.subprocess,'check_output',return_value='private-token'), patch.object(setup.urllib.request,'urlopen',side_effect=urlopen):
            setup.main()
        self.assertFalse(any('create' in call or 'update' in call for call in calls))
        value=destination.write_text.call_args.args[0]
        self.assertIn('DATA_REPORTS_ENABLED=true',value)
        self.assertIn('REPORTS_DATABASE_ID=data-reports',value)
        self.assertNotIn('private-token',value)
        self.assertIn('REPORTS_ADMIN_EMAILS=jan@janrezab.com|',value)

    def test_storage_permission_failure_never_enables_intake(self):
        destination=MagicMock();destination.exists.return_value=True
        with patch.dict(os.environ, {'BUILD_ID':'test','PROJECT_ID':setup.PROJECT}), patch.object(setup, 'Path', return_value=destination), patch.object(setup, 'gcloud', side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError): setup.main()
        destination.write_text.assert_not_called()

if __name__ == '__main__': unittest.main()
