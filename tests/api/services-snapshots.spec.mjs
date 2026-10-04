import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {ServicesSnapshots} from '../../server/services-snapshots.mjs';

const prefix = 'static-assets/trade-services/';
const release = '123e4567-e89b-12d3-a456-426614174000';
const bytes = value => Buffer.from(JSON.stringify(value));
const ref = (object, value) => ({object, generation:'1', sha256:createHash('sha256').update(value).digest('hex'), bytes:value.length});

test('annual services rows are pinned to one manifest and exact object hash', async () => {
  const rowName = `${prefix}releases/${release}/CZE.json`;
  const rows = bytes({schema_version:'trade-services.rows.v1',release_id:release,country:'CZE',rows:[{row_kind:'total',ref_year:'2024',flow_code:'X',value_usd:'12'}]});
  const manifestName = `${prefix}releases/${release}/manifest.json`;
  const manifest = bytes({schema_version:'trade-services.v1',release_id:release,snapshot_as_of:'2026-10-04T12:00:00Z',countries:{CZE:{...ref(rowName,rows),rows:1}}});
  const pointer = bytes({...ref(manifestName,manifest),schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',release_id:release});
  const objects = new Map([[prefix+'current.json',pointer],[manifestName,manifest],[rowName,rows]]);
  const source = new ServicesSnapshots({tokenProvider:async()=> 'test'});
  source.object = async name => objects.get(name) || null;
  assert.equal((await source.rows('CZE'))[0].value_usd,'12');
  assert.deepEqual(await source.rows('DEU'),[]);
  assert.equal(await source.rows('CZE'),await source.rows('CZE'));
  source.rowsCache.clear(); objects.set(rowName,Buffer.from('corrupt'));
  await assert.rejects(source.rows('CZE'),/checksum_failed/);
});

test('unpublished services coverage remains absent', async () => {
  const source = new ServicesSnapshots({tokenProvider:async()=> 'test'});
  source.object = async () => null;
  assert.deepEqual(await source.rows('CZE'),[]);
});
