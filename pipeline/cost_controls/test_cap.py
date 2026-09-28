import unittest
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

if __name__=='__main__':unittest.main()
