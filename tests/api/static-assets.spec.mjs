import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import {Writable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {ASSET_PATH, AssetError, StaticAssets, warmStaticAssetLock} from '../../server/static-assets.mjs';

const raw = Buffer.from('{"value":123}\n');
const sha = crypto.createHash('sha256').update(raw).digest('hex');
const filename = `${'a'.repeat(64)}.pack`;
const asset = '/data/isred/index.json';
function manifest() {
  return {version: 1, bucket: 'czbudget-janrezab-public-snapshots',
    packs: {isred: {key: `static-assets/v1/${filename}`, file: filename, generation: '123456', size: raw.length + 4}},
    files: {[asset]: {pack: 'isred', offset: 4, size: raw.length, sha256: sha}}};
}
function store(fetchImpl) {
  const result = new StaticAssets({manifest: manifest(), localRoot: '', fetchImpl});
  result.token = async () => 'synthetic-token';
  return result;
}
function response(body = raw, headers = {}) {
  return new Response(body, {status: 206, headers: {'content-range': `bytes 4-${raw.length + 3}/${raw.length + 4}`, ...headers}});
}
function outgoing() {
  return {headers: {}, setHeader(k,v) {this.headers[k.toLowerCase()] = v;}, writeHead(s,h = {}) {this.status = s; for (const [k,v] of Object.entries(h)) this.setHeader(k,v);}, end(body) {this.body = body;}};
}

test('generation and range are pinned; concurrent requests share one checked read', async () => {
  let calls = 0;
  const service = store(async (url, options) => {
    calls++;
    assert.ok(url.endsWith('?alt=media&generation=123456'));
    assert.equal(options.headers.Range, `bytes=4-${raw.length + 3}`);
    assert.equal(options.headers['Accept-Encoding'], 'identity');
    return response();
  });
  const lock = await service.lock();
  const replies = await Promise.all(Array.from({length: 20}, () => service.body(asset, lock.files[asset], lock)));
  replies.forEach(body => assert.deepEqual(body, raw));
  assert.equal(calls, 1);
  assert.equal(service.inFlightBytes, 0);
  assert.equal(service.pending.size, 0);
  assert.deepEqual(await service.body(asset, lock.files[asset], lock), raw);
  assert.equal(calls, 1);
});

test('runtime data routes include every independently published serving contract', () => {
  for (const url of [
    '/data/paq/catalog.json.gz',
    '/data/paq/obec-001.json.gz',
    '/data/trade/automotive-monthly.v1.json',
    '/data/municipal-budget-codebook.v1.json',
    '/data/monitor-2026/unit-facts-001.ndjson.gz',
    '/data/dotaceeu/operation-rows.ndjson.gz',
    '/data/mv-administration-grants/2025.json.gz',
    '/data/mf-perimeter-history/2020-actual-perimeter.json.gz',
    '/data/france-municipal-profiles/62.v1.json',
    '/data/municipal-benchmarks/nor.json',
  ]) assert.match(url, ASSET_PATH);
  for (const url of ['/data/trade/README.md', '/data/other.json', '/paq/catalog.json.gz']) assert.doesNotMatch(url, ASSET_PATH);
});

// Datasets that left the repository on 27 September 2026. nginx must proxy exactly these
// to the Node server, which reads them from the packs; the image no longer carries them.
const OFFLOADED_SAMPLES = [
  '/data/countries/cze/providers.v1.json', '/data/public-entities/CZE.v1.csv.gz',
  '/data/economy/economic-observations.v1.csv.gz', '/data/international-municipalities/index.v1.json',
  '/data/czech-sfdi-tables/4774ca359c7e.json', '/data/monitor-grants/paid-facts.ndjson.gz',
  '/data/registry/source-provenance/sources-001.json.gz', '/data/international-municipalities.v1.json',
  '/data/municipal-snapshot.v1.json', '/data/municipal-history-directory.v1.json',
  '/data/cze-medicine-reimbursements.v1.json', '/data/cze-school-funding-2026.v1.json',
  '/data/czech-consolidated-accounts.v1.json', '/data/czech-sfdi-financing.v1.json', '/data/pensions-today.v1.json',
  '/data/methodology-sources.v1.json', '/data/eu-budget-flows.v1.json', '/data/sovereign-benchmark-slim.v1.json',
  '/data/paq/index.json', '/data/industry/CZE.json.gz', '/data/contracts/00075370.plzen-projects.v1.json',
];
// Small contracts generated or validated with the code stay in the image.
const IMAGE_SAMPLES = [
  '/data/registry/countries.v1.json', '/data/registry/run-log.v1.json', '/data/registry/source-provenance.v1.json',
  '/data/registry/municipal-entities/CZE.v1.json', '/data/cze-school-funding-2026-summary.v1.json',
  '/data/country-parity.v1.json', '/data/release-manifest.v1.json', '/data/international-municipalities.v1.json.gz',
  '/data/czech-monitor-grants.v1.json', '/data/countries.v1.json',
  // Released independently with the public-company accounts (PUBLIC_ENTITY_PATH).
  '/data/public-entity-directory/USA.v1.json', '/data/public-entity-directory/manifest.v1.json',
];

test('nginx proxies every offloaded dataset to the pack server and nothing the image carries', async () => {
  const {readFile} = await import('node:fs/promises');
  const nginx = await readFile(new URL('../../nginx.conf.template', import.meta.url), 'utf8');
  const location = nginx.split('\n').find(line => line.includes('location ~ ^/data/(?:(?:isred|'));
  assert.ok(location, 'nginx has a static-asset location');
  const route = new RegExp(location.trim().replace(/^location ~ /, '').replace(/ \{$/, ''));
  for (const url of OFFLOADED_SAMPLES) {
    assert.match(url, ASSET_PATH, url);
    assert.match(url, route, `nginx: ${url}`);
  }
  for (const url of IMAGE_SAMPLES) {
    assert.doesNotMatch(url, ASSET_PATH, url);
    assert.doesNotMatch(url, route, `nginx: ${url}`);
  }
});

test('corrupt, truncated, oversized and non-range replies fail closed and can retry', async () => {
  for (const bad of [() => response(Buffer.from('x')), () => response(Buffer.alloc(raw.length)), () => response(Buffer.alloc(raw.length + 1)), () => new Response(raw), () => response(raw, {'content-range': 'bytes 0-12/13'})]) {
    let attempt = 0;
    const service = store(async () => ++attempt === 1 ? bad() : response());
    const lock = await service.lock();
    await assert.rejects(service.body(asset, lock.files[asset], lock));
    assert.equal(service.cache.size, 0);
    assert.equal(service.pending.size, 0);
    assert.equal(service.inFlightBytes, 0);
    assert.deepEqual(await service.body(asset, lock.files[asset], lock), raw);
  }
});

test('HEAD, conditional responses and missing paths never download data', async () => {
  const service = store(async () => {throw new Error('Unexpected network');});
  const head = outgoing();
  await service.serve({method: 'HEAD', headers: {}}, head, asset);
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], raw.length);
  assert.equal(head.body, undefined);
  const cached = outgoing();
  await service.serve({method: 'GET', headers: {'if-none-match': `"${sha}"`}}, cached, asset);
  assert.equal(cached.status, 304);
  const weak = outgoing();
  await service.serve({method: 'GET', headers: {'if-none-match': `"other", W/"${sha}"`}}, weak, asset);
  assert.equal(weak.status, 304);
  for (const url of ['/data/isred/absent', '/data/isred/%2e%2e/secret', '/data/isred/%']) {
    await assert.rejects(service.serve({method: 'GET', headers: {}}, outgoing(), url), e => [400,404].includes(e.status));
  }
  await assert.rejects(service.serve({method: 'POST', headers: {}}, outgoing(), asset), {status: 405});
});

test('gzip file URLs preserve raw bytes and never acquire Content-Encoding', async () => {
  const service = store(async () => response());
  const lock = service.manifest;
  lock.files['/data/isred/shard.json.gz'] = lock.files[asset];
  const output = outgoing();
  await service.serve({method: 'GET', headers: {}}, output, '/data/isred/shard.json.gz');
  assert.deepEqual(output.body, raw);
  assert.equal(output.headers['content-type'], 'application/gzip');
  assert.equal(output.headers['content-encoding'], undefined);
});

test('invalid and out-of-bounds manifests cannot be used', async () => {
  for (const change of [m => m.bucket = 'some-other-bucket', m => m.files[asset].offset = -1, m => m.files[asset].size += 10, m => m.packs.isred.generation = '', m => m.packs.isred.file = '../secret']) {
    const value = manifest(); change(value);
    await assert.rejects(new StaticAssets({manifest: value, localRoot: ''}).lock());
  }
});

test('production lock is refreshed from the published data pointer', async () => {
  const first = manifest();
  const second = manifest();
  second.packs.isred.generation = '654321';
  let calls = 0;
  const service = new StaticAssets({
    lockPath: null,
    lockObject: 'static-assets/current.json',
    lockTtlMs: 0,
    fetchImpl: async (url, options) => {
      calls++;
      assert.match(url, /static-assets%2Fcurrent\.json\?alt=media$/);
      assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
      return new Response(JSON.stringify(calls === 1 ? first : second));
    },
  });
  service.token = async () => 'synthetic-token';
  service.cache.set(asset, raw);
  service.cacheBytes = raw.length;
  assert.equal((await service.lock()).packs.isred.generation, '123456');
  assert.equal((await service.lock()).packs.isred.generation, '654321');
  assert.equal(service.cache.size, 0);
  assert.equal(service.cacheBytes, 0);
});

test('startup warm-up is best effort and a failed lock remains retryable', async () => {
  let attempts = 0;
  const errors = [];
  const service = new StaticAssets({
    lockPath: null,
    lockObject: 'static-assets/current.json',
    fetchImpl: async () => {
      attempts++;
      if (attempts === 1) throw new Error('temporary metadata outage');
      return new Response(JSON.stringify(manifest()));
    },
  });
  service.token = async () => 'synthetic-token';
  assert.equal(await warmStaticAssetLock(service, error => errors.push(error)), false);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof AssetError);
  assert.equal(errors[0].status, 502);
  assert.equal(errors[0].code, 'asset_lock_failed');
  assert.equal(service.loading, null);
  assert.equal((await service.lock()).packs.isred.generation, '123456');
});

test('JSON aliases negotiate gzip and stream identity without buffering expanded data', async () => {
  const compressed = gzipSync(raw);
  for (const accept of ['gzip', 'identity', 'gzip;q=0, *;q=1']) {
    const value = manifest();
    value.packs.isred.size = compressed.length + 4;
    value.files[asset] = {...value.files[asset], size: compressed.length,
      sha256: crypto.createHash('sha256').update(compressed).digest('hex'), encoding: 'gzip', raw_size: raw.length, raw_sha256: sha};
    const service = new StaticAssets({manifest: value, localRoot: '', fetchImpl: async () => new Response(compressed, {
      status: 206, headers: {'content-range': `bytes 4-${compressed.length + 3}/${compressed.length + 4}`},
    })});
    service.token = async () => 'synthetic';
    const chunks = [];
    const output = new Writable({write(chunk, encoding, next) {chunks.push(chunk); next();}});
    output.headers = {};
    output.setHeader = function(k,v) {this.headers[k.toLowerCase()] = v;};
    output.writeHead = function(s,h) {this.status = s; for (const [k,v] of Object.entries(h)) this.setHeader(k,v);};
    await service.serve({method: 'GET', headers: {'accept-encoding': accept}}, output, asset);
    assert.equal(output.headers.vary, 'Accept-Encoding');
    assert.equal(output.headers['content-encoding'], accept === 'gzip' ? 'gzip' : undefined);
    assert.deepEqual(Buffer.concat(chunks), accept === 'gzip' ? compressed : raw);
  }
});

test('cold reads have bounded admission and memory', async () => {
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  const service = store(async () => {await gate; return response();});
  const lock = await service.lock();
  const pending = Array.from({length: 32}, (_, i) => service.body(asset + i, lock.files[asset], lock));
  await assert.rejects(service.body(asset + 'extra', lock.files[asset], lock), {status: 503});
  release(); await Promise.all(pending);
  assert.equal(service.inFlightBytes, 0);
});

test('paths this build does not route are skipped, not fatal to the whole lock', async () => {
  const value = manifest();
  value.files['/data/not-yet-routed/a.json'] = {...value.files[asset]};
  const lock = await new StaticAssets({manifest: value, localRoot: ''}).lock();
  assert.ok(lock.files[asset]);
  assert.equal(lock.files['/data/not-yet-routed/a.json'], undefined);
});

test('a failed refresh keeps serving the last verified lock', async () => {
  let calls = 0;
  const service = new StaticAssets({
    lockPath: null, lockObject: 'static-assets/current.json', lockTtlMs: 0,
    fetchImpl: async () => { calls++; return calls === 1 ? new Response(JSON.stringify(manifest())) : new Response('{"version":2}'); },
  });
  service.token = async () => 'synthetic-token';
  assert.equal((await service.lock()).packs.isred.generation, '123456');
  assert.equal((await service.lock()).packs.isred.generation, '123456');
  assert.equal(calls, 2);
});


test('public-entity data refreshes from an atomic release, with absence-only legacy fallback', async () => {
  const url = '/data/public-entity-directory/CZE.v1.json';
  const service = store(async () => response());
  assert.equal(await service.publishedEntityJSON(url), null);
  service.manifest.files[url] = service.manifest.files[asset];
  assert.deepEqual(await service.publishedEntityJSON(url), {value: 123});
  await assert.rejects(service.publishedEntityJSON('/data/unrelated.json'), {status: 400});
  service.cache.clear();
  service.fetch = async () => response(Buffer.alloc(raw.length));
  await assert.rejects(service.publishedEntityJSON(url), {code: 'asset_checksum_failed'});
});

function gzipManifest(documents) {
  // documents: {url: object}; stored as gzip aliases in one pack starting at offset 0.
  const value = {version: 1, bucket: 'czbudget-janrezab-public-snapshots', packs: {}, files: {}};
  const parts = []; let offset = 0;
  for (const [url, document] of Object.entries(documents)) {
    const plain = Buffer.from(JSON.stringify(document));
    const packed = gzipSync(plain);
    value.files[url] = {pack: 'countries', offset, size: packed.length, sha256: crypto.createHash('sha256').update(packed).digest('hex'),
      encoding: 'gzip', raw_size: plain.length, raw_sha256: crypto.createHash('sha256').update(plain).digest('hex')};
    parts.push(packed); offset += packed.length;
  }
  const pack = Buffer.concat(parts);
  value.packs.countries = {key: `static-assets/v1/${'c'.repeat(64)}.pack`, file: `${'c'.repeat(64)}.pack`, generation: '42', size: pack.length};
  return {value, pack};
}
function rangeServer(pack, counter = {calls: 0}) {
  return async (url, options) => {
    counter.calls++;
    const [start, end] = options.headers.Range.slice(6).split('-').map(Number);
    return new Response(pack.subarray(start, end + 1), {status: 206, headers: {'content-range': `bytes ${start}-${end}/${pack.length}`}});
  };
}

test('server-side readers get verified, inflated JSON through one shared read', async () => {
  const {value, pack} = gzipManifest({'/data/countries/cze/a.v1.json': {rows: [1, 2, 3]}, '/data/countries/deu/b.v1.json': {rows: []}});
  const counter = {calls: 0};
  const tokens = [];
  const service = new StaticAssets({manifest: value, localRoot: '', fetchImpl: rangeServer(pack, counter), tokenProvider: async () => { tokens.push(1); return 'local'; }});
  const results = await Promise.all(Array.from({length: 10}, () => service.readJSON('/data/countries/cze/a.v1.json')));
  results.forEach(result => assert.deepEqual(result, {rows: [1, 2, 3]}));
  assert.equal(counter.calls, 1);
  assert.ok(tokens.length >= 1, 'the configured token provider authenticates range reads');
  assert.deepEqual(await service.readJSON('/data/countries/cze/a.v1.json'), {rows: [1, 2, 3]});
  assert.equal(counter.calls, 1);
  assert.equal((await service.readBuffer('/data/countries/deu/b.v1.json')).toString(), '{"rows":[]}');
  assert.deepEqual(await service.list('/data/countries/'), ['/data/countries/cze/a.v1.json', '/data/countries/deu/b.v1.json']);
  assert.equal(await service.entry('/data/countries/absent.json'), null);
  await assert.rejects(service.readJSON('/data/countries/absent.json'), {status: 404});
});

test('a gzip alias whose inflated bytes do not match the lock fails closed', async () => {
  const {value, pack} = gzipManifest({'/data/countries/cze/a.v1.json': {rows: [1]}});
  value.files['/data/countries/cze/a.v1.json'].raw_sha256 = 'f'.repeat(64);
  const service = new StaticAssets({manifest: value, localRoot: '', fetchImpl: rangeServer(pack), tokenProvider: async () => 'local'});
  await assert.rejects(service.readJSON('/data/countries/cze/a.v1.json'), {code: 'asset_checksum_failed'});
  assert.equal(service.json.size, 0);
});

test('parsed JSON is evicted least-recently-used within its raw-byte budget', async () => {
  const big = 'x'.repeat(20 * 1024 * 1024);
  const {value, pack} = gzipManifest({'/data/countries/a.json': {big}, '/data/countries/b.json': {big}, '/data/countries/c.json': {big}});
  const service = new StaticAssets({manifest: value, localRoot: '', fetchImpl: rangeServer(pack), tokenProvider: async () => 'local'});
  for (const name of ['a', 'b', 'c']) await service.readJSON(`/data/countries/${name}.json`);
  assert.ok(service.jsonBytes <= 48 * 1024 * 1024);
  assert.equal(service.json.size, 2);
  assert.deepEqual([...service.json.keys()].map(key => key.split('\0')[0]), ['/data/countries/b.json', '/data/countries/c.json']);
});

test('a hydrated pack root reads absent packs from the bucket at their pinned generation', async () => {
  const {mkdtemp, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {value, pack} = gzipManifest({'/data/countries/cze/a.v1.json': {remote: true}});
  const local = gzipManifest({'/data/economy/manifest.v1.json': {local: true}});
  local.value.packs.countries.file = `${'d'.repeat(64)}.pack`;
  local.value.packs.countries.key = `static-assets/v1/${'d'.repeat(64)}.pack`;
  delete local.value.packs.countries.generation;
  value.packs.economy = local.value.packs.countries;
  value.files['/data/economy/manifest.v1.json'] = {...local.value.files['/data/economy/manifest.v1.json'], pack: 'economy'};
  const root = await mkdtemp(join(tmpdir(), 'asset-root-'));
  try {
    await writeFile(join(root, value.packs.economy.file), local.pack);
    const urls = [];
    const service = new StaticAssets({manifest: value, localRoot: root, fetchImpl: async (url, options) => { urls.push(url); return rangeServer(pack)(url, options); }, tokenProvider: async () => 'local'});
    assert.deepEqual(await service.readJSON('/data/economy/manifest.v1.json'), {local: true});
    assert.equal(urls.length, 0);
    assert.deepEqual(await service.readJSON('/data/countries/cze/a.v1.json'), {remote: true});
    assert.equal(urls.length, 1);
    assert.match(urls[0], /generation=42$/);
    delete value.packs.countries.generation;
    const unpinned = new StaticAssets({manifest: value, localRoot: root, fetchImpl: rangeServer(pack), tokenProvider: async () => 'local'});
    await assert.rejects(unpinned.readJSON('/data/countries/cze/a.v1.json'), {code: 'asset_pack_missing'});
  } finally { await rm(root, {recursive: true, force: true}); }
});
