import unittest
from control import WEB_MEMBER, reader_policy, registry_policy, protected_versions


class ControlsTests(unittest.TestCase):
    def test_table_grant_preserves_conditional_access_and_etag(self):
        old = {'etag':'pin','version':3,'bindings':[
            {'role':'roles/bigquery.dataViewer','members':['user:other@example.org'],
             'condition':{'expression':'false','title':'conditional'}}]}
        new = reader_policy(old)
        self.assertEqual(new['bindings'][0],old['bindings'][0])
        self.assertEqual(new['etag'],'pin')
        self.assertEqual(new['bindings'][1]['members'],[WEB_MEMBER])
        self.assertEqual(reader_policy(new),new)
        self.assertEqual(len(old['bindings']),1)

    def test_registry_preserves_existing_rules_and_live_digest_in_dry_run(self):
        repo = {'name':'projects/czbudget-janrezab/locations/europe-west1/repositories/web',
                'cleanupPolicies':{'existing':{'id':'existing','action':'KEEP',
                                             'condition':{'tagState':'TAGGED'}}}}
        protected = ['europe-west1-docker.pkg.dev/czbudget-janrezab/web/app@sha256:'+'a'*64]
        plan = registry_policy(repo,protected)
        self.assertTrue(plan['cleanupPolicyDryRun'])
        self.assertEqual(plan['cleanupPolicies']['existing'],repo['cleanupPolicies']['existing'])
        self.assertEqual(plan['cleanupPolicies']['psd-audit-keep-revisions']['condition']['versionNamePrefixes'],['sha256:'+'a'*57])
        self.assertEqual(plan['cleanupPolicies']['psd-audit-keep-recent']['mostRecentVersions']['keepCount'],20)

    def test_old_live_revision_is_preserved_beyond_recent_rollback_window(self):
        revisions = [{'metadata':{'name':str(n),'creationTimestamp':f'2026-09-{n+1:02d}'},
                      'status':{'imageDigest':f'registry/app@sha256:{n}'}} for n in range(15)]
        images = protected_versions(revisions,[{'revisionName':'0','percent':100}])
        self.assertIn('registry/app@sha256:0',images)
        self.assertEqual(len(images),11)


if __name__ == '__main__':
    unittest.main()
