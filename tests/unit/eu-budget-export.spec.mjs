import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('CSV exports the selected country/year, source cells and unrounded EUR-million components', async () => {
  const data = JSON.parse(await readFile(new URL('../../data/eu-budget-flows.v1.json', import.meta.url)));
  const source = await readFile(new URL('../../eu-budget-deep-dive.js', import.meta.url), 'utf8');
  const nodes = new Map();
  let exported;
  let filename;
  const errors = [];
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      handlers: {}, innerHTML: '', textContent: '',
      addEventListener(event, fn) { this.handlers[event] = fn; },
      querySelectorAll() { return []; },
      insertAdjacentHTML() {},
    });
    return nodes.get(selector);
  };
  class DownloadURL extends URL {
    static createObjectURL(blob) { exported = blob; return 'blob:test'; }
    static revokeObjectURL() {}
  }
  vm.runInNewContext(source, {
    URL: DownloadURL, URLSearchParams, Blob, Intl, console: { error: (...args) => errors.push(args) },
    setTimeout: (fn) => fn(), addEventListener() {}, history: { replaceState() {} },
    location: { search: '?code=CZE&year=2024', href: 'https://example.org/deep-dives/eu-budget/?code=CZE&year=2024' },
    document: {
      currentScript: { src: 'https://example.org/eu-budget-deep-dive.js' },
      documentElement: { lang: 'cs' }, querySelector: node, querySelectorAll: () => [],
      createElement: () => ({ click() { filename = this.download; } }),
    },
    fetch: async () => ({ ok: true, json: async () => data }),
  });
  await new Promise(setImmediate);
  assert.deepEqual(errors, []);
  node('#eu-programme-download').handlers.click();
  let csv = await exported.text();
  assert.equal(filename, 'eu-programmes-CZE-2024.csv');
  assert.match(csv, /"CZE","2024","2","2\.2\.21"/);
  assert.match(csv, /"0","2184\.652805","2184\.652805"/);
  assert.ok(csv.includes("'2024'!K49 + '2024'!K152"));
  const expected = data.countries.find(c => c.iso3 === 'CZE').series.find(r => r.year === 2024)
    .spending_breakdown.flatMap(h => h.programmes || []);
  assert.equal(csv.split('\r\n').length, expected.length + 1);
  node('#eu-year').handlers.change({ target: { value: '2021' } });
  node('#eu-country').handlers.change({ target: { value: 'DEU' } });
  node('#eu-programme-download').handlers.click();
  csv = await exported.text();
  assert.equal(filename, 'eu-programmes-DEU-2021.csv');
  assert.match(csv, /"DEU","2021","2","2\.2\.21"/);
  assert.ok(!csv.includes('"CZE"'));
});
