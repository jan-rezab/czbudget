import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import {Writable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {StaticAssets} from '../../server/static-assets.mjs';

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
