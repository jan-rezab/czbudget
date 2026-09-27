import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { retainUnavailableHistory } from '../../scripts/run-log-history.mjs';

const ledger = (runs) => ({
  schema_version: '2.0.0', runs,
  content_hash: createHash('sha256').update(JSON.stringify(runs)).digest('hex'),
});
const historical = { run_id: 'cityvizor-catalogue', volume: 35, sections: ['/czech-sources/'], lifecycle: { published: true } };

test('complete source inputs retain the normal regeneration contract', () => {
  const generated = [{ run_id: 'new-source' }];
  assert.deepEqual(retainUnavailableHistory(generated, ledger([historical]), []), { runs: generated, retained: 0 });
});

test('fully missing inputs preserve historical events verbatim', () => {
  const result = retainUnavailableHistory([], ledger([historical]), ['missing.json.gz']);
  assert.deepEqual(result, { runs: [historical], retained: 1 });
});

test('partial inputs cannot shrink historical evidence and append new events', () => {
  const newEvent = { run_id: 'new-source', commit_sha: 'verified-code-sha' };
  const result = retainUnavailableHistory([{ ...historical, volume: 1, sections: [] }, newEvent], ledger([historical]), ['missing.json.gz']);
  assert.deepEqual(result.runs, [historical, newEvent]);
});

test('missing inputs fail closed without an intact prior ledger', () => {
  assert.throws(() => retainUnavailableHistory([], null, ['missing']), /valid committed process ledger/);
  const corrupt = ledger([historical]);
  corrupt.runs[0] = { ...historical, volume: 1 };
  assert.throws(() => retainUnavailableHistory([], corrupt, ['missing']), /valid committed process ledger/);
  assert.throws(() => retainUnavailableHistory([], ledger([historical, historical]), ['missing']), /event identity/);
});

test('generator records unavailable inputs while retaining history and new build metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'psd-run-log-'));
  try {
    await mkdir(path.join(root, 'data/registry'), { recursive: true });
    const old = { ...historical, date: '2026-09-09', event_type: 'ingestion', record_kind: 'backfilled', country_codes: ['CZE'], source_id: 'cityvizor-catalogue' };
    await writeFile(path.join(root, 'data/registry/run-log.v1.json'), JSON.stringify(ledger([old])));
    await writeFile(path.join(root, 'data/registry/source-vintages.v1.json'), JSON.stringify({ sources: [] }));
    await writeFile(path.join(root, 'data/registry/source-provenance.v1.json'), JSON.stringify({ shards: [{ path: 'data/registry/missing.json.gz' }] }));
    execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/build-run-log.mjs', import.meta.url)), '--write'], {
      env: { ...process.env, SITE_ROOT: root, COMMIT_SHA: 'a'.repeat(40), BUILD_ID: 'synthetic-build' },
    });
    const result = JSON.parse(await readFile(path.join(root, 'data/registry/run-log.v1.json'), 'utf8'));
    assert.deepEqual(result.runs.find((run) => run.run_id === old.run_id), old);
    assert.equal(result.coverage.events, 2);
    assert.equal(result.input_status.status, 'historical_ledger_preserved');
    assert.deepEqual(result.input_status.unavailable_inputs, ['data/registry/missing.json.gz']);
    assert.equal(result.input_status.retained_historical_events, 1);
    assert.equal(result.runs.find((run) => run.cloud_build_id === 'synthetic-build').git_sha, 'a'.repeat(40));
    assert.equal(result.content_hash, ledger(result.runs).content_hash);
  } finally { await rm(root, { recursive: true, force: true }); }
});
