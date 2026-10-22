import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {StaticAssets} from '../../server/static-assets.mjs';
import {METADATA_PATHS, isMetadataPath} from '../../server/metadata-paths.mjs';
import {PublishedMetadataStore} from '../../server/published-metadata.mjs';

const hash = body => crypto.createHash('sha256').update(body).digest('hex');
const qaPath = '/data/data-quality-report.v1.json';
const manifestPath = '/data/release-manifest.v1.json';
function fixture(id = 'metadata-test-1', qaOverrides = {}) {
  const verified = '2026-10-22T15:30:52Z';
  const bodies = new Map(METADATA_PATHS.map(url => [url, Buffer.from(url.endsWith('.xml') ? '<urlset><url><loc>https://example.test/</loc></url></urlset>' : JSON.stringify({value: id}))]));
  bodies.set(qaPath, Buffer.from(JSON.stringify({release_id: id, verified_at: verified, build_mode: 'published-release-audit', status: 'passed', verification_scope: {cs: 'Ověřené publikované soubory; původní zdroje mohou chybět.', en: 'Verified published files; original sources may be unavailable.'}, published_releases: [{dataset: 'municipal', release_id: 'municipal-source-1'}], ...qaOverrides})));
  bodies.set(manifestPath, Buffer.from(JSON.stringify({release_id: id, artifacts: [...bodies].filter(([url]) => url !== manifestPath).map(([url, body]) => ({path: url.slice(1), sha256: hash(body), bytes: body.length}))})));
  const filename = `${'a'.repeat(64)}.pack`;
  let offset = 0;
  const files = Object.fromEntries([...bodies].map(([url, body]) => { const descriptor = {pack: 'metadata', offset, size: body.length, sha256: hash(body)}; offset += body.length; return [url, descriptor]; }));
  const lock = {version: 1, bucket: 'czbudget-janrezab-public-snapshots', packs: {metadata: {file: filename, key: `static-assets/v1/${filename}`, generation: '123', size: offset}}, files,
    metadata_release: {schema_version: 'public-metadata-release.v1', release_id: id, verified_at: verified, pack: 'metadata', paths: METADATA_PATHS}};
  return {lock, bodies};
}
function assetsFor(state) {
  return {lock: async () => new StaticAssets({manifest: state.lock}).lock(), body: async (key, file) => {
    assert.ok(key.endsWith(`\0${file.sha256}`));
    const body = state.bodies.get(key.split('\0')[0]);
    return body;
  }};
}
function outgoing() {
  return {headers: {}, setHeader(k,v) {this.headers[k.toLowerCase()] = v;}, writeHead(s,h = {}) {this.status = s; for (const [k,v] of Object.entries(h)) this.setHeader(k,v);}, end(body) {this.body = body;}};
}

test('only the exact metadata set is eligible, with every descriptor retained by the lock', async () => {
  const sample = fixture();
  const lock = await new StaticAssets({manifest: sample.lock}).lock();
  assert.deepEqual(Object.keys(lock.files).sort(), [...METADATA_PATHS].sort());
  for (const url of ['/data/secret.json', '/data/../secret.json', '/sitemap.xml/extra', '/%73itemap.xml']) assert.equal(isMetadataPath(url), false);
});

test('before publication the fallback returns unchanged local bytes without a cloud dependency', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'psd-metadata-test-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.mkdir(path.join(root, 'data'));
  const bytes = Buffer.from('{"legacy":true}\n');
  await fs.writeFile(path.join(root, qaPath), bytes);
  const service = new PublishedMetadataStore({root, assets: {lock: async () => {throw new Error('cloud unavailable');}}});
  assert.deepEqual((await service.entry(qaPath)).body, bytes);
  assert.deepEqual(await service.readJSON(qaPath), {legacy: true});
  assert.equal((await service.entry(qaPath)).releaseId, null);
  await assert.rejects(service.entry('/data/../secrets'), {status: 404});
});

test('all bytes and the artifact manifest are verified before a release switches', async () => {
  const state = fixture();
  const service = new PublishedMetadataStore({assets: assetsFor(state), ttlMs: 0});
  const first = await service.current();
  assert.equal(first.releaseId, 'metadata-test-1');
  const next = fixture('metadata-test-2');
  state.lock = next.lock; state.bodies = next.bodies;
  state.bodies.set('/sitemap.xml', Buffer.from('corrupt'));
  assert.strictEqual(await service.current(), first);
  assert.equal((await service.entry(qaPath)).releaseId, 'metadata-test-1');
  state.bodies.set('/sitemap.xml', fixture('metadata-test-2').bodies.get('/sitemap.xml'));
  assert.equal((await service.current()).releaseId, 'metadata-test-2');
});

test('partial, wrong-pack, oversized, unproven and contradictory groups retain previous release', async () => {
  for (const mutate of [
    state => delete state.lock.files['/sitemap.xml'],
    state => {state.lock.metadata_release.paths = METADATA_PATHS.slice(1);},
    state => {state.lock.metadata_release.paths = [...METADATA_PATHS.slice(1), METADATA_PATHS[1]];},
    state => {state.lock.metadata_release.verified_at = 'unknown';},
    state => {state.lock.metadata_release.pack = 'missing';},
    state => {state.lock.files['/sitemap.xml'].size = 33 * 1024 * 1024;},
    state => {state.lock.metadata_release.release_id = 'unmatched';},
    state => {state.bodies.set(manifestPath, Buffer.from('{"release_id":"metadata-test-2","artifacts":[]}')); state.lock.files[manifestPath].sha256 = hash(state.bodies.get(manifestPath)); state.lock.files[manifestPath].size = state.bodies.get(manifestPath).length;},
  ]) {
    const state = fixture();
    const service = new PublishedMetadataStore({assets: assetsFor(state), ttlMs: 0});
    const first = await service.current();
    Object.assign(state, fixture('metadata-test-2'));
    mutate(state);
    assert.strictEqual(await service.current(), first);
  }
});

test('consistent hashes cannot publish failed QA or an audit without explicit scope and inspected release IDs', async () => {
  for (const qaOverrides of [
    {status: 'failed'}, {status: 'processing'}, {status: undefined},
    {verification_scope: undefined}, {verification_scope: {en: 'Only English'}},
    {verification_scope: {cs: 'Popis', en: '   '}},
    {published_releases: []}, {published_releases: undefined},
    {published_releases: [{dataset: 'municipal'}]},
    {published_releases: [{dataset: 'municipal', release_id: ' '}]},
  ]) {
    const state = fixture();
    const service = new PublishedMetadataStore({assets: assetsFor(state), ttlMs: 0});
    const first = await service.current();
    Object.assign(state, fixture('metadata-test-2', qaOverrides));
    assert.strictEqual(await service.current(), first);
    assert.equal((await service.entry(qaPath)).releaseId, 'metadata-test-1');
    const freshService = new PublishedMetadataStore({assets: assetsFor(state)});
    assert.equal(await freshService.current(), null, 'a fresh instance must retain image fallback');
  }
});

test('refresh absence and read failures do not roll a published group back to image data', async () => {
  const state = fixture();
  const service = new PublishedMetadataStore({assets: assetsFor(state), ttlMs: 0});
  const first = await service.current();
  delete state.lock.metadata_release;
  assert.strictEqual(await service.current(), first);
  service.assets.lock = async () => {throw new Error('unavailable');};
  assert.strictEqual(await service.current(), first);
});

test('concurrent requests share verification and HTTP validators identify exact published bytes', async () => {
  const state = fixture(); let reads = 0;
  const assets = assetsFor(state); const body = assets.body;
  assets.body = async (...args) => {reads++; return body(...args);};
  const service = new PublishedMetadataStore({assets});
  const current = await Promise.all(Array.from({length: 8}, () => service.current()));
  assert.ok(current.every(item => item === current[0]));
  assert.equal(reads, METADATA_PATHS.length);
  const response = outgoing();
  await service.serve({method: 'GET', headers: {}}, response, '/sitemap.xml');
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'application/xml; charset=utf-8');
  assert.equal(response.headers['x-data-release'], state.lock.metadata_release.release_id);
  assert.deepEqual(response.body, state.bodies.get('/sitemap.xml'));
  const head = outgoing();
  await service.serve({method: 'HEAD', headers: {}}, head, qaPath);
  assert.equal(head.body, undefined);
  const conditional = outgoing();
  await service.serve({method: 'GET', headers: {'if-none-match': `W/${response.headers.etag}`}}, conditional, '/sitemap.xml');
  assert.equal(conditional.status, 304);
  await assert.rejects(service.serve({method: 'POST', headers: {}}, outgoing(), qaPath), {status: 405});
});
