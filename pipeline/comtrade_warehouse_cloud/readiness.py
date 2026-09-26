#!/usr/bin/env python3
"""Reconcile every available response in one pinned checkpoint, on a cloud worker."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'transforms'))
import run_un_comtrade_warehouse as loader


def sql_text(value):
    return "'" + str(value).replace('\\', '\\\\').replace("'", "\\'") + "'"


def audit(connection):
    ledger = loader.bq_query('''
SELECT crawl_task_id, source_response_sha256, frequency, period,
       source_record_count, normalized_row_count, source_status
FROM `czbudget-janrezab.budget_detail.trade_source_responses`
WHERE period_start BETWEEN DATE '1900-01-01' AND CURRENT_DATE()
''', json_output=True)
    if len(ledger) >= 1000000:
        raise RuntimeError('Response ledger output may be truncated')
    keys = {(r['crawl_task_id'], r['source_response_sha256']): r for r in ledger}
    if len(keys) != len(ledger):
        raise RuntimeError('Duplicate task/hash acknowledgements in warehouse')
    periods = []
    for frequency, period in loader.candidate_periods(connection, None, None):
        tasks = loader.source_tasks(connection, period, frequency)
        missing = [r for r in tasks if (r['task_id'], r['response_sha256']) not in keys]
        accepted = [keys[(r['task_id'], r['response_sha256'])] for r in tasks
                    if (r['task_id'], r['response_sha256']) in keys]
        mismatches = [r['task_id'] for r in tasks
                      if (r['task_id'], r['response_sha256']) in keys
                      and int(keys[(r['task_id'], r['response_sha256'])]['source_record_count'])
                      != int(r['record_count'] or 0)]
        periods.append(dict(frequency=frequency, period=period,
                            available_responses=len(tasks), acknowledged_responses=len(accepted),
                            pending_responses=len(missing), source_count_mismatches=len(mismatches),
                            source_rows=sum(int(r['record_count'] or 0) for r in tasks),
                            normalized_rows=sum(int(r['normalized_row_count']) for r in accepted),
                            pending_sample=[r['task_id'] for r in missing[:3]]))
    states = [dict(r) for r in connection.execute('''
SELECT frequency, product_type, status, COUNT(*) AS tasks FROM tasks
GROUP BY frequency, product_type, status ORDER BY frequency, product_type, status
''')]
    return dict(periods=periods, crawl_task_states=states,
                available_responses=sum(r['available_responses'] for r in periods),
                acknowledged_responses=sum(r['acknowledged_responses'] for r in periods),
                pending_responses=sum(r['pending_responses'] for r in periods),
                source_count_mismatches=sum(r['source_count_mismatches'] for r in periods))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reconcile', action='store_true')
    parser.add_argument('--checkpoint-sha', required=True)
    parser.add_argument('--loader-sha', required=True)
    args = parser.parse_args()
    cloud = loader.Cloud()
    started = loader.now_iso()
    build_id = os.environ['BUILD_ID']
    run_id = loader.table_token(build_id)
    prefix = f'{loader.RESULTS_BUCKET}/{loader.RESULTS_PREFIX}/{run_id}/readiness'
    config = loader.prepare.read_json(loader.CONFIG_PATH)
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        manifest, state, references = loader.restore_controls(cloud, temporary, config)
        if manifest['checkpoint']['sha256'] != args.checkpoint_sha:
            raise RuntimeError('Checkpoint changed since preflight; refuse a different checkpoint')
        connection = sqlite3.connect(state)
        connection.row_factory = sqlite3.Row
        if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Checkpoint integrity failed')
        before = audit(connection)
        print(json.dumps(dict(event='all_period_audit_before', **before)), flush=True)
        cloud.put(f'{prefix}/audit-before.json', (json.dumps(before, indent=2)+'\n').encode())
        loads = []
        if args.reconcile:
            for period in before['periods']:
                if period['pending_responses']:
                    if period['pending_responses'] > 50000:
                        raise RuntimeError('Period exceeds the safe atomic load limit')
                    print(json.dumps(dict(event='reconcile_period', **period)), flush=True)
                    loads.append(loader.process_period(
                        cloud, config, manifest, connection, references, temporary,
                        period['frequency'], period['period'], 50000, 1000000, run_id))
        after = audit(connection) if loads else before
        connection.close()
    ready = after['pending_responses'] == 0 and after['source_count_mismatches'] == 0
    result = dict(schema_version='1.0.0', build_id=build_id, loader_git_sha=args.loader_sha,
                  region='europe-west4', service_account='comtrade-builder@czbudget-janrezab.iam.gserviceaccount.com',
                  source_url='https://comtradeapi.un.org', checkpoint=manifest['checkpoint'],
                  checkpoint_archive_id=manifest['archive_id'], started_at=started,
                  completed_at=loader.now_iso(), processing_status='validated' if ready else 'incomplete',
                  publication_status='published' if ready else 'not_published',
                  available_raw_in_bigquery=ready, source_coverage_complete=False,
                  source_coverage_note='All held responses are checked; source errors and unavailable cells remain visible.',
                  audit=after, period_load_receipts=loads,
                  warehouse='czbudget-janrezab.budget_detail.trade_observations',
                  website_destinations=['/api/v1/trade', '/api/v1/trade/countries', '/api/v1/trade/product-partners',
                                        '/api/v1/trade/energy/periods', '/api/v1/trade/energy/flows'])
    receipt_uri = f'{prefix}/completed.json'
    receipt_bytes = (json.dumps(result, indent=2)+'\n').encode()
    receipt_sha = hashlib.sha256(receipt_bytes).hexdigest()
    if ready:
        loader.bq_query(f'''
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.un_warehouse_audits` (
 release_id STRING, dataset_id STRING, checkpoint_archive_id STRING,
 checkpoint_sha256 STRING, receipt_uri STRING, receipt_sha256 STRING,
 available_responses INT64, acknowledged_responses INT64, published_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.un_warehouse_audit_pointer` (
 dataset_id STRING, release_id STRING, published_at TIMESTAMP);
BEGIN TRANSACTION;
INSERT INTO `czbudget-janrezab.budget_detail.un_warehouse_audits`
VALUES ({sql_text(build_id)}, 'un_comtrade', {sql_text(manifest['archive_id'])},
 {sql_text(args.checkpoint_sha)}, {sql_text(receipt_uri)}, {sql_text(receipt_sha)},
 {after['available_responses']}, {after['acknowledged_responses']}, CURRENT_TIMESTAMP());
DELETE FROM `czbudget-janrezab.budget_detail.un_warehouse_audit_pointer` WHERE dataset_id='un_comtrade';
INSERT INTO `czbudget-janrezab.budget_detail.un_warehouse_audit_pointer`
VALUES ('un_comtrade', {sql_text(build_id)}, CURRENT_TIMESTAMP());
COMMIT TRANSACTION;
''')
    receipt = cloud.put(receipt_uri, receipt_bytes)
    print(json.dumps(dict(event='readiness_completed', receipt=receipt, **result), indent=2), flush=True)
    if not ready:
        raise RuntimeError('Available checkpoint responses still missing or mismatched')


if __name__ == '__main__':
    main()
