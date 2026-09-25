import { test } from 'node:test';
import assert from 'node:assert/strict';
import charts from '../../lib/chart-renderer.js';

test('signed domains include zero and negative balances', () => {
  const axis = charts.domain([-40, 100, null, NaN]);
  assert.ok(axis.min <= -40 && axis.max >= 100);
  assert.ok(axis.ticks.includes(0));
});
test('null, empty and string values are not invented financial observations', () => {
  const spec = charts.model({ rows: [{ year: 2024, amount: null }, { year: 2025, amount: 0 }, { year: 2026, amount: '5' }], fields: [{ key: 'amount' }] });
  assert.deepEqual(spec.rows.map(row => row.values[0]), [null, 0, null]);
});
test('stacks reject partial or negative compositions', () => {
  const fields = [{ key: 'a' }, { key: 'b' }];
  const { rows } = charts.model({ type: 'stacked', fields, rows: [{ a: 25, b: 75 }, { a: null, b: 75 }, { a: -5, b: 105 }, { a: 0, b: 0 }] });
  assert.deepEqual(rows.map(row => row.shares), [[25, 75], [null, null], [null, null], [null, null]]);
});
test('adapters keep original rows available to currency and provenance formatters', () => {
  const row = { year: 2025, actual: 10, plan: 20, currency: 'CZK' };
  const { rows } = charts.model({ rows: [row], fields: [{ value: r => r.actual * 2 }] });
  assert.equal(rows[0].values[0], 20);
  assert.equal(rows[0].raw, row);
  assert.equal(row.actual, 10);
});
test('empty and single-zero series have usable domains', () => {
  for (const values of [[], [0], [null], [-1]]) {
    const { min, max, ticks } = charts.domain(values);
    assert.ok(max > min); assert.ok(ticks.length >= 2);
  }
});
test('indexed trends can omit zero without collapsing a constant series',()=>{
  const axis=charts.domain([100,100],false);
  assert.ok(axis.min<100 && axis.max>100);
  assert.ok(charts.model({rows:[{year:2025,index:100},{year:2026,index:110}],fields:[{key:'index'}],includeZero:false}).axis.min>0);
});
test('plot, tooltip table and CSV rail share one canonical accessor',()=>{
  const data=charts.model({rows:[{year:2024,revenue:10,expense:null}],fields:[{key:'revenue',label:'Revenue'},{key:'expense',label:'Expenditure'}]});
  assert.deepEqual(data.columns.map(column=>column.key),['label','revenue','expense']);
  assert.deepEqual(data.accessor.rows(),[{label:'2024',revenue:10,expense:null}]);
  assert.equal(data.rows[0].raw.year,2024);
});

test('compact plots preserve accessible country names without a crowded end-label gutter', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null, querySelector: () => ({}) };
  const stopAfterMarkup = Symbol('capture rendered markup');
  function markup(clientWidth) {
    let html;
    const host = { clientWidth, contains: () => false, classList: { add() {} }, dataset: {}, set innerHTML(value) { html = value; throw stopAfterMarkup; } };
    try {
      charts.render(host, { type: 'line', compact: true, endLabels: true, rows: [{ year: 2020, CZE: 40 }, { year: 2024, CZE: 42.858 }], fields: [{ key: 'CZE', label: 'Czechia' }] });
    } catch (error) { if (error !== stopAfterMarkup) throw error; }
    return html;
  }
  try {
    const mobile = markup(393), desktop = markup(1120);
    assert.doesNotMatch(mobile, /data-end-series=/);
    assert.match(mobile, /aria-label="2024\. Czechia: 42\.858"/);
    assert.match(mobile, /data-series="CZE"/);
    assert.match(desktop, /data-end-series="CZE"/);
    assert.match(desktop, /Czechia/);
  } finally { globalThis.document = originalDocument; }
});
