#!/usr/bin/env python3
"""Fetch, gzip in memory, and stream to private GCS. No local raw spool."""
from __future__ import annotations

import argparse
import base64
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from types import SimpleNamespace
import urllib.error
import urllib.parse
import urllib.request

import crawl_un_comtrade as c
from archive_un_comtrade_raw import sqlite_backup


def credential_pool():
    """Return configured active keys without ever logging their values."""
    credentials = []
    # Slot 01 is the retired legacy credential. It returned HTTP 401 during the
    # 2026-09-19 pool migration, so keep it out of subsequent continuation
    # builds instead of spending another request on every rotation.
    # Slots 30 and 31 are excluded after failed validation. Slots 32 through 41
    # passed bounded validation and remain active with the proven 02-29 pool.
    for number in (*range(2, 30), *range(32, 42)):
        credential_id = f"account-{number:02d}"
        value = os.environ.get(f"UN_COMTRADE_API_KEY_{number:02d}")
        if value:
            credentials.append((credential_id, value.strip()))
    if not credentials and os.environ.get("UN_COMTRADE_API_KEY"):
        credentials.append(("default", os.environ["UN_COMTRADE_API_KEY"].strip()))
    if not credentials:
        raise SystemExit("No UN Comtrade API credentials are configured")
    return credentials


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build_provenance():
    """Return the immutable execution identity recorded in every checkpoint."""
    environment = {
        'cloud_build_id': 'COMTRADE_BUILD_ID',
        'loader_git_sha': 'COMTRADE_LOADER_GIT_SHA',
        'region': 'COMTRADE_BUILD_REGION',
        'service_account': 'COMTRADE_BUILD_SERVICE_ACCOUNT',
    }
    provenance = {name: os.environ.get(variable, '').strip()
                  for name, variable in environment.items()}
    missing = [name for name, value in provenance.items() if not value]
    if missing:
        raise c.CloudPersistenceError(
            'Missing build provenance: ' + ', '.join(sorted(missing)))
    provenance['source_config_sha256'] = digest(c.CONFIG_PATH.read_bytes())
    provenance['source_api'] = c.read_json(c.CONFIG_PATH)['api_base']
    return provenance


def verify_uploaded(data, metadata):
    expected = base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode('ascii')
    if int(metadata.get('size', -1)) != len(data) or (metadata.get('md5_hash') or metadata.get('md5Hash')) != expected or not metadata.get('generation'):
        raise c.CloudPersistenceError('Cloud checksum, size or generation mismatch')


class Cloud:
    def __init__(self):
        # Cloud Build supplies its service-account credentials. A local caller may
        # opt into a specific already-authenticated account without making the
        # cloud worker impersonate a human account that does not exist there.
        self.env = {**os.environ, 'CLOUDSDK_CORE_DISABLE_PROMPTS':'1'}
        account = os.environ.get('COMTRADE_GCLOUD_ACCOUNT')
        if account:
            self.env['CLOUDSDK_CORE_ACCOUNT'] = account
        self._token = None
        self._token_expires_at = 0.0
        self._token_lock = threading.Lock()

    def command(self, *args, data=None):
        result = subprocess.run(['gcloud','storage',*args], input=data, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=self.env, timeout=180)
        if result.returncode:
            # Do not echo command output containing account or credential data.
            raise c.CloudPersistenceError('Cloud storage command failed')
        return result.stdout

    @staticmethod
    def split_uri(uri):
        parsed = urllib.parse.urlsplit(uri)
        if parsed.scheme != 'gs' or not parsed.netloc or not parsed.path.lstrip('/'):
            raise c.CloudPersistenceError('Invalid Cloud Storage URI')
        return parsed.netloc, parsed.path.lstrip('/')

    def _access_token(self):
        with self._token_lock:
            if self._token and time.monotonic() < self._token_expires_at:
                return self._token
            request = urllib.request.Request(
                'http://metadata.google.internal/computeMetadata/v1/instance/'
                'service-accounts/default/token',
                headers={'Metadata-Flavor':'Google'},
            )
            try:
                with urllib.request.urlopen(request,timeout=10) as response:
                    payload = json.loads(response.read())
            except (OSError,ValueError) as exc:
                raise c.CloudPersistenceError('Unable to obtain Cloud Build access token') from exc
            self._token = payload['access_token']
            self._token_expires_at = time.monotonic()+max(1,int(payload.get('expires_in',300))-60)
            return self._token

    def _request_json(self,request,*,retry_auth=True):
        request.add_header('Authorization',f'Bearer {self._access_token()}')
        try:
            with urllib.request.urlopen(request,timeout=180) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            if exc.code == 401 and retry_auth:
                with self._token_lock:
                    self._token = None
                    self._token_expires_at = 0.0
                request.remove_header('Authorization')
                return self._request_json(request,retry_auth=False)
            raise

    def metadata(self,uri):
        bucket,name = self.split_uri(uri)
        url = ('https://storage.googleapis.com/storage/v1/b/'
               f'{urllib.parse.quote(bucket,safe="")}/o/{urllib.parse.quote(name,safe="")}')
        return self._request_json(urllib.request.Request(url,method='GET'))

    def put(self,uri,data,*,immutable=False):
        """Upload and verify in one JSON API request.

        Immutable objects use a generation-zero precondition. A retry that sees
        the object already present verifies its checksum instead of overwriting it.
        """
        bucket,name = self.split_uri(uri)
        query = {'uploadType':'media','name':name}
        if immutable:
            query['ifGenerationMatch'] = '0'
        url = ('https://storage.googleapis.com/upload/storage/v1/b/'
               f'{urllib.parse.quote(bucket,safe="")}/o?{urllib.parse.urlencode(query)}')
        request = urllib.request.Request(
            url,data=data,method='POST',
            headers={'Content-Type':'application/octet-stream'},
        )
        try:
            metadata = self._request_json(request)
        except urllib.error.HTTPError as exc:
            if immutable and exc.code == 412:
                try:
                    metadata = self.metadata(uri)
                except OSError as metadata_exc:
                    raise c.CloudPersistenceError(
                        'Unable to verify existing immutable object') from metadata_exc
            else:
                raise c.CloudPersistenceError('Cloud Storage upload failed') from exc
        except OSError as exc:
            raise c.CloudPersistenceError('Cloud Storage upload failed') from exc
        verify_uploaded(data, metadata)
        return {
            'uri':uri,
            'size':int(metadata['size']),
            'md5_hash':metadata.get('md5_hash') or metadata['md5Hash'],
            'generation':metadata['generation'],
            'sha256':digest(data),
        }


class ReceiptJournal:
    def __init__(self):
        self._receipts = []
        self._lock = threading.Lock()

    def add(self,receipt):
        with self._lock:
            self._receipts.append(receipt)

    def snapshot(self):
        with self._lock:
            return list(self._receipts)


class RawSink:
    def __init__(self, config, cloud, journal=None):
        self.config, self.cloud = config, cloud
        self.journal = journal
        self.receipts = []

    def __call__(self, task, payload, path):
        try:
            data = gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode('utf-8')+b'\n',compresslevel=6,mtime=0)
            if len(data) > 128 * 1024**2:
                raise c.CloudPersistenceError('Single response exceeds in-memory compressed limit')
            sha = digest(data)
            # Content-addressed name keeps retries/revisions from overwriting
            # another raw response. No file is written at this logical path.
            path = path.with_name(f"{task['task_id']}-{sha}.json.gz")
            root = c.WORKSPACE / self.config['raw_path']
            relative = path.relative_to(root).as_posix()
            archive = self.config['archive']
            uri = f"{archive['bucket_uri'].rstrip('/')}/{archive['raw_prefix'].strip('/')}/{relative}"
            receipt = self.cloud.put(uri, data, immutable=True)
            receipt = {**receipt, 'task_id':task['task_id'], 'key':relative,
                       'rows':len(payload['data']), 'bytes':len(data)}
            self.receipts.append(receipt)
            if self.journal:
                self.journal.add(receipt)
            return path, sha
        except Exception as exc:
            raise c.CloudPersistenceError('Raw cloud persistence failed') from exc


def restore_controls(state, settings, cloud):
    archive = settings['archive']
    bucket = archive['bucket_uri'].rstrip('/')
    if not state.exists():
        manifest = json.loads(cloud.command('cat', f"{bucket}/{archive['manifest_prefix']}/latest.json"))
        uri = f"{bucket}/{archive['checkpoint_prefix']}/{manifest['archive_id']}/crawl.sqlite3"
        data = cloud.command('cat', uri)
        if digest(data) != manifest['checkpoint']['sha256']:
            raise c.CloudPersistenceError('Checkpoint SHA-256 mismatch')
        c.atomic_bytes(state, data)
    references = c.reference_paths(state.parent / 'reference')
    for path in references.values():
        if not path.exists():
            data = cloud.command('cat', f"{bucket}/{archive['reference_prefix']}/{path.name}")
            if not isinstance(json.loads(data), dict):
                raise c.CloudPersistenceError('Invalid reference metadata')
            c.atomic_bytes(path, data)
    return references


def refill_historical_annual_queue(db, config, refs, cloud, credentials, max_periods):
    """Discover older released annual goods periods when the ready queue is empty."""
    if max_periods <= 0:
        return {'periods':0,'tasks':0,'credential_id':None}
    ready = db.execute(
        "SELECT COUNT(*) FROM tasks WHERE status='queued' "
        "AND (not_before IS NULL OR not_before <= ?)", (c.now_iso(),)).fetchone()[0]
    if ready:
        return {'periods':0,'tasks':0,'credential_id':None}
    profile = next(
        row for row in config['warehouse_crawl']['profiles']
        if row['product_type'] == 'C' and row['frequency'] == 'A')
    existing = {
        row[0] for row in db.execute(
            "SELECT DISTINCT period FROM availability "
            "WHERE product_type='C' AND frequency='A'")
    }
    candidates = [
        str(year) for year in range(datetime.now(timezone.utc).year-1,1987,-1)
        if str(year) not in existing
    ][:max_periods]
    if not candidates:
        return {'periods':0,'tasks':0,'credential_id':None}
    credential_id,_api_key = min(
        credentials,key=lambda item:c.daily_calls(db,item[0]))
    limiter = c.RateLimiter(
        1.1,lambda:c.reserve_call(db,500,credential_id))
    availability_root = c.WORKSPACE / config['warehouse_crawl']['availability_path']
    c.sync_availability(
        db,config,availability_root,limiter,None,None,500,
        {profile['id']:candidates},credential_id)
    archive = config['warehouse_crawl']['archive']
    bucket = archive['bucket_uri'].rstrip('/')
    prefix = archive['availability_prefix'].strip('/')
    for period in candidates:
        path = availability_root / 'C' / 'A' / f"{period}-{profile['classification']}.json.gz"
        data = path.read_bytes()
        sha = digest(data)
        name = f"{period}-{profile['classification']}-{sha}.json.gz"
        cloud.put(f"{bucket}/{prefix}/C/A/{name}",data,immutable=True)
    tasks = c.schedule_tasks(db,config,c.read_json(refs['partners']))
    print('Historical queue refill: '+json.dumps({
        'credential_id':credential_id,'periods':len(candidates),
        'oldest':candidates[-1],'newest':candidates[0],'new_tasks':tasks,
    }),flush=True)
    return {'periods':len(candidates),'tasks':tasks,'credential_id':credential_id}


def refresh_priority_monthly_queue(db, config, refs, cloud, credentials, prior_months):
    """Refresh YTD plus comparison months once per UTC day and queue new releases."""
    profile = next(
        row for row in config['warehouse_crawl']['profiles']
        if row['product_type'] == 'C' and row['frequency'] == 'M')
    periods = c.monthly_focus_periods(prior_months)
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    refreshed_today = {
        row[0] for row in db.execute(
            "SELECT period FROM history_discovery WHERE profile_id=? AND checked_at LIKE ?",
            (profile['id'], today_prefix+'%'))
    }
    candidates = [period for period in periods if period not in refreshed_today]
    if not candidates:
        return {'periods':0,'tasks':0,'credential_id':None,'window':periods}
    credential_id,_api_key = min(
        credentials,key=lambda item:c.daily_calls(db,item[0]))
    limiter = c.RateLimiter(
        1.1,lambda:c.reserve_call(db,500,credential_id))
    availability_root = c.WORKSPACE / config['warehouse_crawl']['availability_path']
    c.sync_availability(
        db,config,availability_root,limiter,None,None,500,
        {profile['id']:candidates},credential_id)
    archive = config['warehouse_crawl']['archive']
    bucket = archive['bucket_uri'].rstrip('/')
    prefix = archive['availability_prefix'].strip('/')
    for period in candidates:
        path = availability_root / 'C' / 'M' / f"{period}-{profile['classification']}.json.gz"
        data = path.read_bytes()
        sha = digest(data)
        name = f"{period}-{profile['classification']}-{sha}.json.gz"
        cloud.put(f"{bucket}/{prefix}/C/M/{name}",data,immutable=True)
    tasks = c.schedule_tasks(db,config,c.read_json(refs['partners']))
    print('Priority monthly refresh: '+json.dumps({
        'credential_id':credential_id,'periods':len(candidates),
        'oldest':periods[-1],'newest':periods[0],'new_tasks':tasks,
    }),flush=True)
    return {'periods':len(candidates),'tasks':tasks,
            'credential_id':credential_id,'window':periods}


def checkpoint(state, settings, cloud, receipts, summary):
    archive = settings['archive']
    bucket = archive['bucket_uri'].rstrip('/')
    archive_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ-direct')
    with tempfile.TemporaryDirectory(prefix='comtrade-checkpoint-') as directory:
        path = Path(directory) / 'crawl.sqlite3'
        sqlite_backup(state,path)
        checkpoint_data = path.read_bytes()
    receipt = cloud.put(
        f"{bucket}/{archive['checkpoint_prefix']}/{archive_id}/crawl.sqlite3",
        checkpoint_data,immutable=True)
    manifest = {'schema_version':'1.1.0','archive_id':archive_id,'mode':'direct-memory-to-gcs',
                'checkpoint':receipt, 'raw_objects':receipts, 'summary':summary}
    encoded = json.dumps(manifest,indent=2).encode('utf-8')
    cloud.put(f"{bucket}/{archive['manifest_prefix']}/{archive_id}.json",encoded,immutable=True)
    cloud.put(f"{bucket}/{archive['manifest_prefix']}/latest.json",encoded)
    return archive_id


def crawl_lane(state, config, refs, cloud, credential_id, api_key, remaining, deadline,
               batch_rows, max_tasks, shared_rate_limiter, receipt_journal,
               stop_event, queue_mode='balanced'):
    """Run one credential lane against the shared WAL queue.

    Task claiming is atomic in crawl_un_comtrade.crawl; every lane uses its own
    SQLite connection and response sink, while only the coordinator publishes
    checkpoints and the latest manifest.
    """
    db = c.connect(state)
    sink = RawSink(config['warehouse_crawl'], cloud, receipt_journal)
    started_at = c.now_iso()
    started_monotonic = time.monotonic()
    try:
        result = c.crawl(db, config, refs, SimpleNamespace(
            allow_preview=False, api_key=api_key, credential_id=credential_id,
            max_calls=remaining, daily_limit=500,
            max_minutes=max(0.1, (deadline-time.monotonic())/60),
            max_rows=batch_rows, max_tasks=max_tasks, response_sink=sink,
            reclaim_running=False, shared_rate_limiter=shared_rate_limiter,
            stop_event=stop_event, queue_mode=queue_mode))
        result['utc_calls_used'] = c.daily_calls(db, credential_id)
        result['started_at'] = started_at
        result['finished_at'] = c.now_iso()
        result['elapsed_seconds'] = round(time.monotonic()-started_monotonic,3)
        return result
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-calls-per-account',type=int,default=500)
    parser.add_argument('--batch-rows',type=int,default=1_000_000)
    parser.add_argument('--max-minutes',type=int,default=120)
    parser.add_argument('--lanes-per-account',type=int,default=1)
    parser.add_argument('--chunk-calls',type=int,default=10)
    parser.add_argument('--checkpoint-seconds',type=int,default=60)
    parser.add_argument('--history-periods',type=int,default=36)
    parser.add_argument('--monthly-prior-months',type=int,default=3)
    parser.add_argument('--monthly-focus-share',type=float,default=0.8)
    args = parser.parse_args()
    if (not 1 <= args.max_calls_per_account <= 500
            or not 1 <= args.batch_rows <= 1_000_000
            or not 1 <= args.max_minutes <= 120
            or not 1 <= args.lanes_per_account <= 5
            or not 1 <= args.chunk_calls <= 25
            or not 15 <= args.checkpoint_seconds <= 300
            or not 0 <= args.history_periods <= 36
            or not 0 <= args.monthly_prior_months <= 12
            or not 0 <= args.monthly_focus_share <= 1):
        parser.error('Bounds: 500 calls/account, 1m rows/batch, 120 minutes, '
                     '1-5 lanes/account, 1-25 calls/chunk, 15-300s checkpoints, '
                     '0-36 annual history periods, 0-12 prior monthly periods, '
                     'and 0-1 monthly lane share')
    config = c.read_json(c.CONFIG_PATH)
    settings = config['warehouse_crawl']
    state = c.WORKSPACE / settings['state_path']
    state.parent.mkdir(parents=True,exist_ok=True)
    locks = []
    for name in ('pipeline.lock','crawler.lock'):
        handle = (state.parent/name).open('a')
        fcntl.flock(handle,fcntl.LOCK_EX | fcntl.LOCK_NB)
        locks.append(handle)
    cloud = Cloud()
    refs = restore_controls(state,settings,cloud)
    db = c.connect(state)
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise c.CloudPersistenceError('Invalid checkpoint')
    day = datetime.now(timezone.utc).date()
    deadline = time.monotonic()+args.max_minutes*60
    credentials = credential_pool()
    initial = {credential_id: c.daily_calls(db, credential_id) for credential_id, _ in credentials}
    monthly_refresh = refresh_priority_monthly_queue(
        db,config,refs,cloud,credentials,args.monthly_prior_months)
    history_refill = refill_historical_annual_queue(
        db,config,refs,cloud,credentials,args.history_periods)
    rate_limiters = {credential_id:c.RateLimiter(0.22) for credential_id,_ in credentials}
    stop_events = {credential_id:threading.Event() for credential_id,_ in credentials}
    run_started_at = c.now_iso()
    run_started_monotonic = time.monotonic()
    settings['minimum_free_disk_gib'] = 3
    summary = {'downloaded_and_verified_rows':0,'verified_objects':0,'bigquery_rows_loaded':0,
               'http_attempts':0,'configured_accounts':len(credentials),'accounts':{},
               'run_started_at':run_started_at,'architecture':'dynamic-direct-gcs-v2',
               'monthly_refresh':monthly_refresh,'history_refill':history_refill,
               'provenance':build_provenance()}
    # Reclaim tasks left running by an interrupted predecessor exactly once,
    # before parallel lanes begin claiming new work.
    reclaimed = db.execute(
        "UPDATE tasks SET status='queued', updated_at=? WHERE status='running'",
        (c.now_iso(),)).rowcount
    db.commit()
    if reclaimed:
        print(f"reclaimed {reclaimed} interrupted task(s)",flush=True)
    journal = ReceiptJournal()
    credential_keys = dict(credentials)
    monthly_lane_count = round(len(credentials)*args.monthly_focus_share)
    queue_modes = {
        credential_id:('monthly_focus' if index < monthly_lane_count else 'annual')
        for index,(credential_id,_api_key) in enumerate(credentials)
    }
    remaining = {
        credential_id:min(args.max_calls_per_account,500-initial[credential_id])
        for credential_id,_ in credentials
    }
    enabled = {credential_id:remaining[credential_id] > 0 for credential_id,_ in credentials}
    for credential_id,_ in credentials:
        summary['accounts'][credential_id] = {
            'http_attempts':0,'utc_calls_used':initial[credential_id],
            'downloaded_and_verified_rows':0,'verified_objects':0,'outcomes':{},
            'started_at':run_started_at,'finished_at':None,'elapsed_seconds':0,
            'calls_per_hour':0,'stop_reason':'not_started',
        }

    def refresh_summary(stop_reason=None):
        elapsed = max(time.monotonic()-run_started_monotonic,0.001)
        for credential_id,_ in credentials:
            row = summary['accounts'][credential_id]
            current = c.daily_calls(db,credential_id)
            row['utc_calls_used'] = current
            row['http_attempts'] = current-initial[credential_id]
            row['elapsed_seconds'] = round(elapsed,3)
            row['calls_per_hour'] = round(row['http_attempts']*3600/elapsed,2)
        summary['http_attempts'] = sum(
            row['http_attempts'] for row in summary['accounts'].values())
        summary['finished_at'] = c.now_iso()
        if stop_reason:
            summary['stop_reason'] = stop_reason

    def publish_checkpoint(reason):
        refresh_summary(reason)
        archive_id = checkpoint(state,settings,cloud,journal.snapshot(),summary)
        c.atomic_bytes(
            state.parent/'direct-last-run.json',
            json.dumps(summary,indent=2).encode('utf-8'))
        print('Direct-to-cloud checkpoint: '+json.dumps({
            'archive_id':archive_id,'reason':reason,'http_attempts':summary['http_attempts'],
            'downloaded_and_verified_rows':summary['downloaded_and_verified_rows'],
            'verified_objects':summary['verified_objects'],
        }),flush=True)

    def merge_result(credential_id,result):
        row = summary['accounts'][credential_id]
        row['downloaded_and_verified_rows'] += result['rows']
        row['verified_objects'] += result['tasks']
        for name,value in result['outcomes'].items():
            row['outcomes'][name] = row['outcomes'].get(name,0)+value
        row['finished_at'] = result['finished_at']
        stop_priority = {
            'not_started':0,'call_budget':1,'task_batch':1,'row_batch':1,
            'no_ready_tasks':2,'time_budget':3,'rate_limited':4,
            'authentication':5,'disk_reserve':6,'cloud_persistence':7,
        }
        if stop_priority.get(result['stop_reason'],3) >= stop_priority.get(row['stop_reason'],0):
            row['stop_reason'] = result['stop_reason']
        summary['downloaded_and_verified_rows'] += result['rows']
        summary['verified_objects'] += result['tasks']

    def can_submit(credential_id):
        return (enabled[credential_id] and remaining[credential_id] > 0
                and time.monotonic() < deadline
                and datetime.now(timezone.utc).date() == day)

    pending = {}
    fatal_error = None
    last_checkpoint = time.monotonic()
    worker_count = len(credentials)*args.lanes_per_account
    with ThreadPoolExecutor(max_workers=worker_count,thread_name_prefix='comtrade') as pool:
        def submit_lane(credential_id,lane_number):
            if not can_submit(credential_id):
                return
            allowance = min(args.chunk_calls,remaining[credential_id])
            remaining[credential_id] -= allowance
            future = pool.submit(
                crawl_lane,state,config,refs,cloud,credential_id,
                credential_keys[credential_id],allowance,deadline,args.batch_rows,
                allowance,rate_limiters[credential_id],journal,
                stop_events[credential_id],queue_modes[credential_id])
            pending[future] = (credential_id,lane_number,allowance)

        # Interleave credentials so a constrained executor always gives every
        # account a lane before assigning any account an additional lane.
        for lane_number in range(args.lanes_per_account):
            for credential_id,_ in credentials:
                submit_lane(credential_id,lane_number)

        while pending:
            seconds_to_checkpoint = max(
                0.1,args.checkpoint_seconds-(time.monotonic()-last_checkpoint))
            completed,_ = wait(
                tuple(pending),timeout=seconds_to_checkpoint,
                return_when=FIRST_COMPLETED)
            for future in completed:
                credential_id,lane_number,allowance = pending.pop(future)
                try:
                    result = future.result()
                except Exception as exc:
                    fatal_error = exc
                    enabled = {key:False for key in enabled}
                    for event in stop_events.values():
                        event.set()
                    continue
                merge_result(credential_id,result)
                # A short chunk can end before spending its whole reservation
                # (for example when the ready queue empties). Make those
                # unspent calls available for a later chunk in the same run.
                remaining[credential_id] += allowance-result['http_attempts']
                if result['stop_reason'] in {
                    'authentication','cloud_persistence',
                    'disk_reserve','no_ready_tasks','time_budget',
                }:
                    enabled[credential_id] = False
                if result['stop_reason'] in {
                    'authentication','cloud_persistence','disk_reserve',
                }:
                    stop_events[credential_id].set()
                if result['stop_reason'] == 'cloud_persistence':
                    enabled = {key:False for key in enabled}
                    for event in stop_events.values():
                        event.set()
                submit_lane(credential_id,lane_number)
            if time.monotonic()-last_checkpoint >= args.checkpoint_seconds:
                publish_checkpoint('periodic')
                last_checkpoint = time.monotonic()

    if fatal_error:
        final_reason = 'worker_failure'
    elif datetime.now(timezone.utc).date() != day:
        final_reason = 'utc_day_ended'
    elif time.monotonic() >= deadline:
        final_reason = 'time_budget'
    elif all(not active or remaining[key] <= 0 for key,active in enabled.items()):
        reasons = {row['stop_reason'] for row in summary['accounts'].values()}
        final_reason = 'no_ready_tasks' if reasons <= {'not_started','no_ready_tasks'} else 'account_limits_or_deferrals'
    else:
        final_reason = 'complete'
    publish_checkpoint(final_reason)
    db.close()
    if fatal_error:
        raise fatal_error


if __name__ == '__main__':
    try:
        main()
    except (c.CloudPersistenceError,subprocess.TimeoutExpired,BlockingIOError) as exc:
        raise SystemExit(f'Direct crawl paused: {type(exc).__name__}; no raw files deleted')
