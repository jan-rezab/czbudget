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

test.after(() => fs.rm(root, {recursive: true, force: true}));

test('reads and validates append-only deployment receipts', async () => {
  const result = await new ProcessLogStore({localRoot: root}).deployments();
  assert.equal(result.status, 'available');
  assert.deepEqual(result.events, [event]);
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
