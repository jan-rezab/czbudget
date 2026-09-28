"""Small, auditable PSD cloud controls; no bulk restore or destructive cleanup."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'czbudget-janrezab'
WEB_MEMBER = 'serviceAccount:psd-web-runtime@czbudget-janrezab.iam.gserviceaccount.com'
TABLES = ('municipal_budget_line_facts', 'budget_nodes')
ALERT = 'projects/'+PROJECT+'/alertPolicies/18382163194667744698'
BQ = 'https://bigquery.googleapis.com/bigquery/v2/projects/'+PROJECT
AR = 'https://artifactregistry.googleapis.com/v1/'
DOC = '''This policy measures project-global BigQuery billed scan bytes over 24 hours. It is an anomaly notification, not an invoice or a hard spending cap. Metric ingestion can be delayed; compare job creation/end times and the alert's own window rather than assuming it measures current website traffic.

Attribute usage with region-eu.INFORMATION_SCHEMA.JOBS_BY_PROJECT, grouped by user_email, normalized query hash and job labels. Exclude parent SCRIPT jobs to avoid double-counting; inspect successful/stopped billed jobs and failures separately. psd-web-runtime is website serving; psd-data-builder and comtrade-builder are independent data workers. An increase does not establish a cache failure.

The 27 September 2026 audit found 242 repeated HDR source reads as the dominant prior incident. The dedicated loader now has batched pinned-source reads and per-query/cumulative run admission. Verify the actual running loader SHA and query labels; code integration alone does not prove workers used the fix. Energy-period serving uses a validated immutable snapshot; other broad trade paths need their own measured serving controls.

The threshold remains 1.7 TiB. At USD 6.25/TiB this is USD 10.625 gross before shared free-tier allowances, taxes and credits; EUR/CZK equivalents vary. Preserve the existing PSD monthly billing budget. Inspect labelled web/data usage separately, do not cancel unrelated jobs, and preserve immutable raw, backups and completion receipts.

Evidence: outputs/20260927-cloud-cost-audit/ and outputs/20260927-bq-safeguards/. All bulk corrections run on the data plane in europe-west4; website releases remain code-only in europe-west1.'''


def reader_policy(existing):
    """Add exactly one table-scoped reader; preserve etag/version/all bindings."""
    policy = json.loads(json.dumps(existing))
    bindings = policy.setdefault('bindings', [])
    role = 'roles/bigquery.dataViewer'
    for binding in bindings:
        if binding.get('role') == role and not binding.get('condition'):
            members = binding.setdefault('members', [])
            if WEB_MEMBER not in members:
                members.append(WEB_MEMBER)
            return policy
    bindings.append({'role':role, 'members':[WEB_MEMBER]})
    return policy


def protected_versions(revisions, traffic):
    names = {item.get('revisionName', '').rsplit('/', 1)[-1] for item in traffic
             if item.get('percent', 0) > 0 or item.get('tag')}
    ready = sorted((r for r in revisions if r.get('status', {}).get('imageDigest')),
                   key=lambda r:r.get('metadata', {}).get('creationTimestamp', ''), reverse=True)
    selected = [r for r in ready if r.get('metadata', {}).get('name') in names]
    selected += ready[:10]
    result = set()
    for revision in selected:
        image = revision['status']['imageDigest']
        if '@sha256:' not in image:
            raise ValueError('A retained ready revision has no immutable image digest')
        result.add(image)
    return sorted(result)


def registry_policy(repository, protected):
    policies = json.loads(json.dumps(repository.get('cleanupPolicies', {})))
    additions = {
        'psd-audit-untagged-30d':{'id':'psd-audit-untagged-30d', 'action':'DELETE',
                                'condition':{'tagState':'UNTAGGED', 'olderThan':'2592000s'}},
        'psd-audit-keep-tags':{'id':'psd-audit-keep-tags', 'action':'KEEP',
                             'condition':{'tagState':'TAGGED'}},
        'psd-audit-keep-recent':{'id':'psd-audit-keep-recent', 'action':'KEEP',
                               'mostRecentVersions':{'keepCount':20}},
    }
    digests = []
    repo_path = '/'+repository['name'].split('/repositories/',1)[1]+'/'
    host = repository['name'].split('/locations/',1)[1].split('/',1)[0]+'-docker.pkg.dev/'
    for image in protected:
        if image.startswith(host+PROJECT+'/') and repo_path in image:
            # Registry prefix fields allow at most 64 characters, whereas
            # sha256:<64 hex> is 71. A 64-character prefix preserves the exact
            # revision and conservatively keeps any hypothetical collision.
            digests.append(image.rsplit('@',1)[1][:64])
    if digests:
        additions['psd-audit-keep-revisions'] = {'id':'psd-audit-keep-revisions', 'action':'KEEP',
                    'condition':{'tagState':'ANY', 'versionNamePrefixes':sorted(set(digests))}}
    for key, value in additions.items():
        if key in policies and policies[key] != value:
            # We own these IDs only. Other policy IDs are preserved verbatim.
            if not key.startswith('psd-audit-'):
                raise ValueError('Unexpected cleanup policy collision')
        policies[key] = value
    return {'cleanupPolicies':policies, 'cleanupPolicyDryRun':True}


class API:
    def __init__(self, account, output):
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.token = subprocess.check_output(['gcloud','auth','print-access-token',
                       '--account='+account], text=True, timeout=30).strip()

    def request(self, url, body=None, method=None):
        req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(),
                method=method, headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'API HTTP {error.code}: '+error.read(8000).decode()) from error

    def save(self, name, value):
        (self.output/(name+'.json')).write_text(json.dumps(value, indent=2)+'\n')

    def pages(self, url, field):
        result = []
        for _ in range(20):
            response = self.request(url)
            result.extend(response.get(field, []))
            token = response.get('nextPageToken')
            if not token:
                return result
            url = url.split('&pageToken=')[0]+'&pageToken='+urllib.parse.quote(token)
        raise RuntimeError('Metadata pagination bound exceeded')

    def query(self, name, sql):
        (self.output/(name+'.sql')).write_text(sql+';\n')
        payload = self.request(BQ+'/queries',dict(query=sql, useLegacySql=False,location='EU',
            maximumBytesBilled='4000000000',timeoutMs=20000,maxResults=1000,
            labels={'plane':'control','purpose':'cost-audit'}))
        self.save(name+'-submission',payload)
        job = payload.get('jobReference', {})
        url = BQ+'/queries/'+job.get('jobId','')+'?location=EU&timeoutMs=10000&maxResults=1000'
        for _ in range(6):
            if payload.get('jobComplete'):
                break
            payload = self.request(url)
        if not payload.get('jobComplete'):
            raise RuntimeError('Metadata query not complete; do not resubmit the same job')
        rows = []
        fields = payload['schema']['fields']
        for _ in range(20):
            rows.extend({f['name']:v['v'] for f,v in zip(fields,r['f'])} for r in payload.get('rows', []))
            if not payload.get('pageToken'):
                break
            payload = self.request(url+'&pageToken='+urllib.parse.quote(payload['pageToken']))
        else:
            raise RuntimeError('Query pagination bound exceeded')
        self.save(name,rows)
        return rows


def inspect(api):
    sql = """WITH j AS (SELECT * FROM `czbudget-janrezab.region-eu.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
      WHERE creation_time >= TIMESTAMP('2026-09-27T02:25:00Z') AND creation_time < CURRENT_TIMESTAMP()
      AND job_type='QUERY' AND (statement_type IS NULL OR statement_type!='SCRIPT')),
    windows AS (SELECT 'email24h' audit_window,j.* FROM j WHERE creation_time < TIMESTAMP('2026-09-28T02:25:00Z')
      UNION ALL SELECT 'latest24h',j.* FROM j WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(),INTERVAL 24 HOUR))
    SELECT audit_window,user_email,query_info.query_hashes.normalized_literals query_hash,
      COUNT(*) jobs,COUNTIF(cache_hit) cache_hits,COUNTIF(error_result IS NOT NULL) errors,
      SUM(IF(error_result IS NULL OR error_result.reason='stopped',IFNULL(total_bytes_billed,0),0)) billed_bytes,
      ANY_VALUE(SUBSTR(query,1,1500)) example_query
    FROM windows GROUP BY 1,2,3 ORDER BY audit_window,billed_bytes DESC"""
    return api.query('current-workloads',sql)


def apply_readers(api):
    result = {}
    for table in TABLES:
        url = BQ+'/datasets/budget_detail/tables/'+table
        before = api.request(url+':getIamPolicy',{'options':{'requestedPolicyVersion':3}})
        api.save(table+'-iam-before',before)
        desired = reader_policy(before)
        if desired != before:
            api.request(url+':setIamPolicy',{'policy':desired})
        after = api.request(url+':getIamPolicy',{'options':{'requestedPolicyVersion':3}})
        api.save(table+'-iam-after',after)
        if reader_policy(after) != after:
            raise RuntimeError('Reader binding readback failed for '+table)
        result[table] = 'verified'
    return result


def apply_alert(api):
    url = 'https://monitoring.googleapis.com/v3/'+ALERT
    before = api.request(url)
    api.save('alert-before',before)
    api.request(url+'?updateMask=documentation',{'name':ALERT,
                'documentation':{'content':DOC,'mimeType':'text/markdown'}},method='PATCH')
    after = api.request(url)
    api.save('alert-after',after)
    if after['documentation']['content'] != DOC:
        raise RuntimeError('Alert documentation readback failed')
    for key in ('conditions','notificationChannels','enabled','alertStrategy'):
        if before.get(key) != after.get(key):
            raise RuntimeError('Unrelated alert field changed: '+key)
    return 'documentation verified; threshold/channels unchanged'


def apply_clustering(api):
    url = BQ+'/datasets/undp_human_development/tables/report_source_records'
    before = api.request(url)
    api.save('hdr-table-before',before)
    fields = {f['name']:f for f in before.get('schema',{}).get('fields',[])}
    if before.get('type') != 'TABLE' or any(fields.get(f,{}).get('type') != 'STRING'
            for f in ('source_id','release_id')):
        raise ValueError('HDR table schema changed; clustering held')
    desired = {'fields':['source_id','release_id']}
    if before.get('clustering') and before['clustering'] != desired:
        raise ValueError('HDR already has a different clustering specification; review required')
    if before.get('clustering') != desired:
        api.request(url,{'clustering':desired},method='PATCH')
    after = api.request(url)
    api.save('hdr-table-after',after)
    if after.get('clustering') != desired or before['schema'] != after['schema']:
        raise RuntimeError('Clustering/schema readback failed')
    return 'layout configured; historical reclustering/savings not claimed'


def registry_dry_run(api):
    base = 'https://europe-west1-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/'+PROJECT
    service = api.request(base+'/services/czbudget-public')
    revisions = api.request(base+'/revisions?labelSelector=serving.knative.dev%2Fservice%3Dczbudget-public')
    api.save('run-service',service)
    api.save('run-revisions',revisions)
    protected = protected_versions(revisions.get('items',[]),service.get('status',{}).get('traffic',[]))
    if not protected:
        raise ValueError('No immutable ready/live revision provenance; registry changes held')
    api.save('protected-images',protected)
    repositories = api.pages(AR+'projects/'+PROJECT+'/locations/europe-west1/repositories?pageSize=100','repositories')
    result = {}
    for repo in repositories:
        if repo.get('format') != 'DOCKER' or repo.get('mode') != 'STANDARD_REPOSITORY':
            continue
        name = repo['name'].rsplit('/',1)[1]
        api.save('registry-'+name+'-before',repo)
        desired = registry_policy(repo,protected)
        url = AR+repo['name']
        operation = api.request(url+'?updateMask=cleanupPolicies,cleanupPolicyDryRun',desired,method='PATCH')
        api.save('registry-'+name+'-operation',operation)
        # repositories.patch returns the Repository synchronously, unlike
        # repository creation's long-running operation response.
        if operation.get('format') != 'DOCKER' or operation.get('name') != repo['name']:
            raise RuntimeError('Unexpected registry patch response')
        after = api.request(url)
        api.save('registry-'+name+'-after',after)
        if not after.get('cleanupPolicyDryRun') or after.get('cleanupPolicies') != desired['cleanupPolicies']:
            raise RuntimeError('Registry dry-run policy readback failed')
        result[name] = 'dry-run only; no deletion'
    return result


def billing_dataset(api):
    url = BQ+'/datasets/psd_cost_control'
    try:
        dataset = api.request(url)
    except RuntimeError as error:
        if 'API HTTP 404:' not in str(error):
            raise
        api.request(BQ+'/datasets',{'datasetReference':{'projectId':PROJECT,'datasetId':'psd_cost_control'},
            'location':'EU','description':'Private billing export and cost governance. No website/raw dataset access.',
            'labels':{'plane':'control','purpose':'billing'}})
        dataset = api.request(url)
    api.save('billing-dataset',dataset)
    if dataset.get('location') != 'EU':
        raise ValueError('Billing dataset is outside EU')
    return 'EU dataset ready; billing export still requires Cloud Billing console'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action',choices=['inspect','apply','readers','alert','clustering','registry','billing'])
    parser.add_argument('--account',default='jan@ravineo.com')
    parser.add_argument('--output',required=True)
    args = parser.parse_args()
    here = Path(__file__).resolve().parents[2]
    if here.name == 'website' or not (here/'.git').is_file():
        raise RuntimeError('Dedicated clean Git worktree required')
    status = subprocess.check_output(['git','status','--porcelain'],cwd=here,text=True)
    if status.strip():
        raise RuntimeError('Commit and verify the candidate before cloud use')
    api = API(args.account,args.output)
    actions = {'inspect':inspect,'readers':apply_readers,'alert':apply_alert,
               'clustering':apply_clustering,'registry':registry_dry_run,'billing':billing_dataset}
    chosen = actions if args.action == 'apply' else {args.action:actions[args.action]}
    summary = {'started_at':datetime.now(timezone.utc).isoformat(),'results':{}}
    for name, action in chosen.items():
        try:
            value = action(api)
            summary['results'][name] = {'status':'verified','result':value}
        except Exception as error:
            summary['results'][name] = {'status':'failed','error':str(error)}
        api.save(args.action+'-result',summary)
        print(name,summary['results'][name]['status'],flush=True)
    if any(r['status']=='failed' for r in summary['results'].values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
