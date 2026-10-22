import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source = name => fs.readFile(new URL(`../../${name}`, import.meta.url), 'utf8');

test('coverage QA and release requests validate cached data on every page load', async () => {
  const js = await source('site-pages.js');
  const start = js.indexOf('Promise.all([', js.indexOf('document.body.dataset.page==='));
  const end = js.indexOf(']).then', start) + 2;
  assert.ok(start > 0 && end > start);
  const calls = [];
  await vm.runInNewContext(js.slice(start, end), {fetch: async (url, options) => {calls.push({url, options}); return {ok:true, json: async () => ({})};}});
  for (const path of ['data/data-quality-report.v1.json', 'data/release-manifest.v1.json', 'data/transport-performance.v1.json']) {
    const call = calls.find(item => item.url === path);
    assert.equal(call?.options?.cache, 'no-cache', path);
  }
  assert.equal(calls.some(item => item.url.includes('20260825-entry-count')), false);
});

test('the shared freshness request used by Map and Coverage bypasses a fresh browser cache', async () => {
  const calls = [];
  const base = {countries: [], modules: [], records: [], totals: {}};
  const context = {window: {}, AbortSignal, fetch: async (url, options) => {calls.push({url, options}); return {ok:true, json:async () => base};}, PSDData: {loadJson: async () => null}};
  vm.runInNewContext(await source('published-coverage.js'), context);
  await Promise.all([context.window.PSDCoverage.load(), context.window.PSDCoverage.load()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/data/data-freshness.v1.json');
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('the map revalidates repaired public source metadata', async () => {
  const js = await source('coverage-map.js');
  const start = js.indexOf('Promise.all([', js.indexOf('const freshnessPromise'));
  const end = js.indexOf(']));', start) + 2;
  assert.ok(start > 0 && end > start);
  const calls = [];
  await vm.runInNewContext(js.slice(start, end), {freshnessPromise: Promise.resolve({}), fetch: async (url, options) => {calls.push({url, options}); return {ok:true, json:async () => ({})};}});
  assert.equal(calls.find(item => item.url === 'data/global-budget-transparency.v1.json')?.options?.cache, 'no-cache');
});

test('every changed metadata consumer has a deterministic version in all HTML consumers', async () => {
  for (const [asset, files] of [
    ['site-pages.js', ['about.html', 'methodology.html']],
    ['published-coverage.js', ['map.html', 'methodology.html']],
    ['coverage-map.js', ['map.html', 'methodology.html']],
  ]) {
    const sha = crypto.createHash('sha256').update(await source(asset)).digest('hex');
    for (const file of files) assert.ok((await source(file)).includes(`${asset}?v=${sha}`), `${file}: ${asset}`);
  }
});
