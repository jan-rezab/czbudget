"""Fail-closed scan budgets and one-pass, disk-backed pinned source reads.

The spool is ephemeral worker storage, never a public dataset or a local restore.
All query admission happens before publication; no provenance fields are dropped.
"""
import atexit
import json
import os
import sqlite3
import tempfile

GIB = 1024**3
SOURCE_COLUMNS = ('release_id', 'source_id', 'member', 'row_number', 'record_json', 'source_url', 'source_sha256')


class QueryBudgetExceeded(RuntimeError):
    pass


class BudgetedQueries:
    def __init__(self, client, sdk, *, run_id, loader_sha, max_query_bytes=32*GIB, max_run_bytes=64*GIB):
        if not 0 < max_query_bytes <= max_run_bytes:
            raise ValueError('Query allowance must be positive and no larger than the run allowance')
        self.client, self.sdk = client, sdk
        self.max_query_bytes, self.max_run_bytes = max_query_bytes, max_run_bytes
        self.admitted_bytes = self.billed_bytes = 0
        self.jobs = []
        self.labels = {'plane':'data', 'dataset':'undp', 'purpose':'hdr-report', 'run_id':run_id.lower()[:63], 'loader_sha':loader_sha.lower()[:63]}

    def query(self, sql, parameters=()):
        # Conservative dry-run admission makes a cumulative cap effective even
        # when hundreds of individually affordable queries are submitted.
        dry = self.sdk.QueryJobConfig(query_parameters=list(parameters), dry_run=True, use_query_cache=False, labels=self.labels)
        estimate_job = self.client.query(sql, job_config=dry, location='EU')
        estimate = estimate_job.total_bytes_processed
        if estimate is None:
            raise QueryBudgetExceeded('No byte estimate available; publication held')
        estimate = int(estimate)
        if estimate > self.max_query_bytes or self.admitted_bytes + estimate > self.max_run_bytes:
            raise QueryBudgetExceeded(f'Query scan admission rejected: estimate={estimate}, admitted={self.admitted_bytes}, per_query={self.max_query_bytes}, per_run={self.max_run_bytes}; no new query submitted')
        remaining = self.max_run_bytes - self.admitted_bytes
        self.admitted_bytes += estimate
        config = self.sdk.QueryJobConfig(query_parameters=list(parameters), maximum_bytes_billed=min(self.max_query_bytes, remaining), labels=self.labels)
        job = self.client.query(sql, job_config=config, location='EU')
        rows = job.result()
        billed = int(job.total_bytes_billed or 0)
        self.billed_bytes += billed
        self.jobs.append({'job_id':job.job_id, 'estimated_bytes':estimate, 'billed_bytes':billed, 'cache_hit':bool(job.cache_hit)})
        # Reserve at least the actual bill, including rounding or a table that
        # grew between dry run and submission. Never silently overshoot a run.
        self.admitted_bytes += max(0, billed-estimate)
        if self.admitted_bytes > self.max_run_bytes:
            raise QueryBudgetExceeded('Observed run usage exceeded admission allowance; publication held')
        return rows

    def receipt(self):
        return {'per_query_limit_bytes':self.max_query_bytes, 'run_limit_bytes':self.max_run_bytes, 'admitted_estimate_bytes':self.admitted_bytes, 'billed_bytes':self.billed_bytes, 'jobs':self.jobs}


def pinned_source_query(dataset, metadata):
    # Table identifiers come from a fixed application constant. Pins are bound
    # JSON parameters, not interpolated SQL, and retain exact release/source pairs.
    pairs = [{'release_id':m['release_id'], 'source_id':sid} for sid,m in metadata.items() if int(m.get('accepted_records') or 0)>0]
    columns = ', '.join('records.'+column for column in SOURCE_COLUMNS)
    sql = f"""WITH pins AS (
      SELECT JSON_VALUE(pin,'$.release_id') AS release_id,
             JSON_VALUE(pin,'$.source_id') AS source_id
      FROM UNNEST(JSON_QUERY_ARRAY(@source_pairs)) AS pin
    )
    SELECT {columns}
    FROM `{dataset}.report_source_records` AS records
    JOIN pins USING (release_id, source_id)"""
    return sql, json.dumps(pairs, ensure_ascii=False, separators=(',', ':'))


class PinnedSourceSpool:
    def __init__(self, metadata, fetch_rows, *, max_spool_bytes=32*GIB):
        self.metadata, self.fetch_rows = metadata, fetch_rows
        self.max_spool_bytes = max_spool_bytes
        self.directory = self.connection = None
        self.received = self.encoded_bytes = 0
        self.failure = None
        atexit.register(self.close)

    def _load(self):
        self.directory = tempfile.TemporaryDirectory(prefix='hdr-pinned-sources-')
        self.connection = sqlite3.connect(os.path.join(self.directory.name,'sources.sqlite'))
        self.connection.execute('CREATE TABLE records (ordinal INTEGER PRIMARY KEY, source_id TEXT, release_id TEXT, body TEXT)')
        counts = {}
        try:
            for item in self.fetch_rows():
                row = dict(item)
                sid, release = row['source_id'], row['release_id']
                meta = self.metadata.get(sid)
                if meta is None or release != meta['release_id']:
                    raise ValueError('Source spool received an unpinned release/source pair')
                if row['source_sha256'] != meta['sha256']:
                    raise ValueError('Source spool SHA disagrees with the pinned source catalogue')
                body = json.dumps(row, ensure_ascii=False, separators=(',', ':'))
                self.encoded_bytes += len(body.encode('utf-8'))
                if self.encoded_bytes > self.max_spool_bytes:
                    raise QueryBudgetExceeded('Pinned source spool size exceeded; publication held')
                self.connection.execute('INSERT INTO records(source_id,release_id,body) VALUES(?,?,?)',(sid,release,body))
                counts[sid] = counts.get(sid,0)+1
                self.received += 1
            for sid,meta in self.metadata.items():
                if counts.get(sid,0) != int(meta.get('accepted_records') or 0):
                    raise ValueError('Pinned source row-count mismatch: '+sid)
            self.connection.execute('CREATE INDEX source_lookup ON records(source_id,release_id,ordinal)')
            self.connection.commit()
            if os.path.getsize(os.path.join(self.directory.name,'sources.sqlite')) > self.max_spool_bytes:
                raise QueryBudgetExceeded('Pinned source spool disk size exceeded; publication held')
        except BaseException as exc:
            self.failure = exc
            self.close()
            raise

    def rows(self, source_id):
        if self.failure is not None:
            raise self.failure
        meta = self.metadata[source_id]
        if self.connection is None:
            self._load()
        for (body,) in self.connection.execute('SELECT body FROM records WHERE source_id=? AND release_id=? ORDER BY ordinal',(source_id,meta['release_id'])):
            yield json.loads(body)

    def receipt(self):
        return {'received_rows':self.received, 'encoded_bytes':self.encoded_bytes,
                'max_spool_bytes':self.max_spool_bytes, 'pin_count':len(self.metadata),
                'validation':'exact release/source pairs, source hashes and catalogue row counts'}

    def close(self):
        if self.connection is not None:
            self.connection.close()
            self.connection = None
        if self.directory is not None:
            self.directory.cleanup()
            self.directory = None
