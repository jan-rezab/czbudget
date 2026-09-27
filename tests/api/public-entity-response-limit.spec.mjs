import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
const { handler, sendJSON } = await import('../../server/index.mjs');
const { staticAssets } = await import('../../server/static-assets.mjs');

function response() {
  const headers = new Map();
  return {
    headersSent: false,
    setHeader(name,value) { headers.set(name.toLowerCase(),value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    removeHeader(name) { headers.delete(name.toLowerCase()); },
    writeHead(status,values) { this.status=status; this.headersSent=true; Object.entries(values).forEach(([key,value])=>this.setHeader(key,value)); },
    end(body) { this.body=body; },
  };
}

const registerSizedPayload = { records: 'x'.repeat(4_451_980) };

test('GET serves the complete registered 4.45 MB Czech shard without the API pagination limit', async () => {
  const original=staticAssets.publishedEntityJSON;
  staticAssets.publishedEntityJSON=async ()=>registerSizedPayload;
  try {
    const output=response();
    await handler({method:'GET',url:'/data/public-entity-directory/CZE.v1.json',headers:{}},output);
    assert.equal(output.status,200);
    assert.equal(JSON.parse(output.body).records.length,registerSizedPayload.records.length);
    assert.equal(output.getHeader('content-length'),Buffer.byteLength(output.body));
  } finally { staticAssets.publishedEntityJSON=original; }
});

test('ordinary API responses still reject the same oversized payload', () => {
  for (const pathname of ['', '/api/v1/public-entities', '/data/not-a-registered-file.json']) {
    const output=response();
    sendJSON(output,200,registerSizedPayload,{},pathname);
    assert.equal(output.status,500);
    assert.equal(JSON.parse(output.body).error.code,'response_limit_exceeded');
  }
});

test('registered dataset responses remain bounded at 32 MiB', () => {
  const output=response();
  sendJSON(output,200,{records:'x'.repeat(32*1024*1024)}, {}, '/data/public-entity-directory/CZE.v1.json');
  assert.equal(output.status,500);
  assert.equal(JSON.parse(output.body).error.code,'response_limit_exceeded');
});
