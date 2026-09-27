import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {gzipSync} from 'node:zlib';

// The image no longer carries the large datasets. data-store must read them from the
// static-asset packs, exactly as nginx serves them, and keep reading small files from disk.
const siteRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'czbudget-data-store-packs-'));
process.env.SITE_ROOT = siteRoot;
await fs.mkdir(path.join(siteRoot, 'data'), {recursive: true});
await fs.writeFile(path.join(siteRoot, 'data/country-parity.v1.json'), JSON.stringify({countries: [{country_code: 'CZE'}]}));
const {staticAssets} = await import('../../server/static-assets.mjs');
const store = await import('../../server/data-store.mjs');

const documents = {
  '/data/international-municipalities.v1.json': {contract: 'municipal-directory', entities: [{country: 'CZE', id: 'praha', code: '554782', name: 'Praha'}, {country: 'POL', id: 'krakow', name: 'Kraków'}]},
  '/data/municipal-snapshot.v1.json': {contract: 'municipal-snapshot', schema_version: '1.0.0', municipalities: [{national_id: '00064581', short_name: 'Praha'}]},
};
const parts = []; const files = {}; let offset = 0;
for (const [url, document] of Object.entries(documents)) {
  const raw = Buffer.from(JSON.stringify(document));
  const packed = gzipSync(raw);
  files[url] = {pack: 'datasets', offset, size: packed.length, sha256: crypto.createHash('sha256').update(packed).digest('hex'),
    encoding: 'gzip', raw_size: raw.length, raw_sha256: crypto.createHash('sha256').update(raw).digest('hex')};
  parts.push(packed); offset += packed.length;
}
const pack = Buffer.concat(parts);
let reads = 0;
staticAssets.configure({
  manifest: {version: 1, bucket: 'czbudget-janrezab-public-snapshots', files,
    packs: {datasets: {key: `static-assets/v1/${'e'.repeat(64)}.pack`, file: `${'e'.repeat(64)}.pack`, generation: '7', size: pack.length}}},
  tokenProvider: async () => 'synthetic',
  fetchImpl: async (url, options) => {
    reads++;
    const [start, end] = options.headers.Range.slice(6).split('-').map(Number);
    return new Response(pack.subarray(start, end + 1), {status: 206, headers: {'content-range': `bytes ${start}-${end}/${pack.length}`}});
  },
});

test('offloaded datasets are read from the packs; files in the image still come from disk', async () => {
  const listed = await store.listMunicipalities(new URLSearchParams('country=CZE'));
  assert.deepEqual(listed.data.map(item => item.id), ['praha']);
  assert.equal((await store.municipality('POL', 'krakow')).name, 'Kraków');
  assert.equal(reads, 1, 'one verified read serves every later request');
  const snapshot = await store.datasetPayload('czech-municipalities');
  assert.equal(snapshot.payload.municipalities[0].short_name, 'Praha');
  assert.equal((await store.listCountries())[0].country_code, 'CZE');
});

test('a dataset missing from both disk and the lock is a 404, never a crash', async () => {
  await assert.rejects(store.datasetPayload('capital-cities'), {status: 404, code: 'not_found'});
  await assert.rejects(store.municipality('CZE', 'absent'), {status: 404});
});

test.after(() => fs.rm(siteRoot, {recursive: true, force: true}));
