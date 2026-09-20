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
