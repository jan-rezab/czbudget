import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ProcessLogStore } from '../../server/process-log-store.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'psd-process-log-'));
await fs.mkdir(path.join(root, 'deployments'));
const event = {
  schema_version: '1.0.0', event_type: 'deployment', event_id: 'deployment:build-1',
  timestamp: '2026-09-20T10:00:00.000Z', outcome: 'deployed',
  git_sha: 'a'.repeat(40), pr_number: 21, cloud_build_id: 'build-1',
  image_digest: `sha256:${'b'.repeat(64)}`, data_release_ids: ['release-1'],
};
await fs.writeFile(path.join(root, 'deployments', 'build-1.json'), JSON.stringify(event));
await fs.mkdir(path.join(root, 'data-runs'));
const dataRun = {
  schema_version: '1.0.0', event_type: 'data_run', event_id: 'data-run:build-2',
  timestamp: '2026-09-25T08:00:00.000Z', outcome: 'completed',
  source_id: 'un_comtrade', dataset: 'budget_detail.trade_observations',
  cloud_build_id: 'build-2', git_sha: 'c'.repeat(40),
  lifecycle: {received: true, processed: true, published: false},
  sections: [], source_urls: ['https://comtrade.un.org/'],
};
await fs.writeFile(path.join(root, 'data-runs', 'build-2.json'), JSON.stringify(dataRun));

test.after(() => fs.rm(root, {recursive: true, force: true}));

test('reads and validates append-only deployment receipts', async () => {
  const result = await new ProcessLogStore({localRoot: root}).deployments();
  assert.equal(result.status, 'available');
  assert.deepEqual(result.events, [event]);
});

test('reads data-run receipts without inferring website publication', async () => {
  const result = await new ProcessLogStore({localRoot: root}).dataRuns();
  assert.deepEqual(result.events, [dataRun]);
  assert.equal(result.events[0].lifecycle.published, false);
});

test('rejects a data-run event that falsely omits provenance or lifecycle', async () => {
  const badRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'psd-data-run-bad-'));
  try {
    await fs.mkdir(path.join(badRoot, 'data-runs'));
    await fs.writeFile(path.join(badRoot, 'data-runs', 'bad.json'), JSON.stringify({...dataRun, lifecycle: null}));
    await assert.rejects(() => new ProcessLogStore({localRoot: badRoot}).dataRuns(), /failed its public contract/);
  } finally { await fs.rm(badRoot, {recursive: true, force: true}); }
});

test('rejects a published claim without a verified public destination', () => {
  const store = new ProcessLogStore({localRoot: root});
  assert.throws(() => store.validateDataRun({...dataRun, lifecycle: {received: true, processed: true, published: true}}), /failed its public contract/);
  assert.throws(() => store.validateDataRun({...dataRun, sections: ['javascript:alert(1)']}), /failed its public contract/);
});

test('reports an unconfigured deployment ledger honestly', async () => {
  assert.deepEqual(await new ProcessLogStore().deployments(), {schema_version: '1.0.0', events: [], status: 'not_configured'});
});

test('rejects receipts without immutable image evidence', async () => {
  const badRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'psd-process-log-bad-'));
  try {
    await fs.mkdir(path.join(badRoot, 'deployments'));
    await fs.writeFile(path.join(badRoot, 'deployments', 'bad.json'), JSON.stringify({...event, image_digest: null}));
    await assert.rejects(() => new ProcessLogStore({localRoot: badRoot}).deployments(), /failed its public contract/);
  } finally { await fs.rm(badRoot, {recursive: true, force: true}); }
});

test('reads private GCS receipts through authenticated JSON API calls', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, authorization: options.headers?.Authorization || null});
    if (url.startsWith('http://metadata.google.internal/')) return new Response(JSON.stringify({access_token: 'test-token', expires_in: 300}), {status: 200});
    if (url.includes('?prefix=')) return new Response(JSON.stringify({items: [{name: 'process-log/deployments/build-1.json', updated: event.timestamp}]}), {status: 200});
    return new Response(JSON.stringify(event), {status: 200});
  };
  const result = await new ProcessLogStore({base: 'gs://test-bucket/process-log', fetchImpl}).deployments();
  assert.deepEqual(result.events, [event]);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].authorization, 'Bearer test-token');
});

test('reads cloud data-run receipts from the data-runs prefix', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('http://metadata.google.internal/')) return new Response(JSON.stringify({access_token: 'test-token', expires_in: 300}), {status: 200});
    if (url.includes('?prefix=')) return new Response(JSON.stringify({items: [{name: 'process-log/data-runs/build-2.json', updated: dataRun.timestamp}]}), {status: 200});
    return new Response(JSON.stringify(dataRun), {status: 200});
  };
  const result = await new ProcessLogStore({base: 'gs://test-bucket/process-log', fetchImpl}).dataRuns();
  assert.deepEqual(result.events, [dataRun]);
  assert.match(calls[1], /data-runs%2F/);
});
