import unittest
import json
from datetime import datetime,timezone
from cap import decision,windows,timestamp

class CapTests(unittest.TestCase):
    def test_cloud_nanosecond_timestamps(self):
        self.assertEqual(timestamp('2026-09-28T12:32:05.281993021Z').microsecond,281993)
    def test_exact_thresholds_and_warning(self):
        now=datetime(2026,9,28,12,tzinfo=timezone.utc)
        warning=decision({},now,7500,1500)
        self.assertTrue(warning['month_warning']);self.assertTrue(warning['day_warning']);self.assertFalse(warning['paused'])
        self.assertTrue(decision({},now,10000,0)['paused']);self.assertTrue(decision({},now,0,2000)['paused'])
    def test_period_latches_never_reopen_from_late_credits(self):
        now=datetime(2026,9,28,12,tzinfo=timezone.utc)
        month=decision({},now,10000,0)
        self.assertTrue(decision(month,now,1,0)['paused'])
        day=decision({},now,0,2000)
        self.assertTrue(decision(day,now,0,1)['paused'])
        self.assertFalse(decision(day,datetime(2026,9,29,12,tzinfo=timezone.utc),0,1)['paused'])
        self.assertFalse(decision(month,datetime(2026,10,1,12,tzinfo=timezone.utc),1,0)['paused'])
    def test_prague_day_and_month_boundaries(self):
        month,day=windows(datetime(2026,9,28,12,tzinfo=timezone.utc))
        self.assertEqual(month.isoformat(),'2026-08-31T22:00:00+00:00')
        self.assertEqual(day.isoformat(),'2026-09-27T22:00:00+00:00')
    def test_rollout_does_not_stop_until_controller_enabled(self):
        self.assertFalse(decision({},datetime.now(timezone.utc),10001,2001,False)['paused'])


from unittest.mock import patch
import os
import cap

class ManagedJobTests(unittest.TestCase):
    def fake(self):
        class API:
            writes=[]
            def request(self,url,body=None,**kwargs):
                if body is None:return {'generation':'17'}
                self.writes.append((url,body,kwargs));return {}
        api=API()
        config={'month_limit':10000,'day_limit':2000,'warning_fraction':.75,'enabled':True,'reports_only':True}
        def read(api,key):return config if key=='config.json' else {}
        return api,read
    def test_job_dry_run_checks_without_changing_state_or_alerting(self):
        api,read=self.fake()
        with patch.dict(os.environ,{'CLOUD_RUN_EXECUTION':'monitor-test','PSD_COST_DRY_RUN':'1'}),patch.object(cap,'Rest',return_value=api),patch.object(cap,'read_optional',side_effect=read),patch.object(cap,'fast_estimates',return_value=({'day':1,'month':2},{})),patch.object(cap,'billing_estimates',return_value={'day':0,'month':1}):
            state=cap.run()
        self.assertFalse(state['paused']);self.assertEqual(state['execution_id'],'monitor-test');self.assertEqual(api.writes,[])
    def test_job_failure_preserves_fail_closed_behavior(self):
        api,read=self.fake()
        with patch.dict(os.environ,{'CLOUD_RUN_EXECUTION':'monitor-test','PSD_COST_DRY_RUN':'0'}),patch.object(cap,'Rest',return_value=api),patch.object(cap,'read_optional',side_effect=read),patch.object(cap,'fast_estimates',side_effect=RuntimeError('unavailable')):
            cap.run()
        saved=[json.loads(body) for url,body,_ in api.writes if 'upload/storage' in url]
        self.assertEqual(len(saved),1);self.assertTrue(saved[0]['paused']);self.assertEqual(saved[0]['reason'],'cost_monitor_unavailable')
    def test_job_uses_metadata_credentials_without_cloud_sdk(self):
        from cloud_clients import Rest
        import io
        with patch.dict(os.environ,{'CLOUD_RUN_EXECUTION':'monitor-test'}),patch('cloud_clients.urllib.request.urlopen',return_value=io.BytesIO(b'{"access_token":"test-token"}')),patch('cloud_clients.subprocess.check_output',side_effect=AssertionError('SDK forbidden')):
            self.assertEqual(Rest().token,'test-token')

if __name__=='__main__':unittest.main()
