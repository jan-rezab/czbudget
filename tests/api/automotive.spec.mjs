import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlySeries, monthLabel } from '../../lib/automotive.mjs';
const row = (period, market, values) => ({ period, market, segment: 'vehicles', values });
const data = { periods: ['202501','202502','202503'], panel: ['USA','DEU'], rows: [
  row('202501','USA',{USA:0,EU27:30,CHN:20,ROW:50}), row('202501','DEU',{USA:10,EU27:0,CHN:20,ROW:10}),
  row('202502','USA',{USA:0,EU27:40,CHN:40,ROW:20}), row('202502','DEU',{USA:20,EU27:0,CHN:20,ROW:20}),
  row('202503','USA',{USA:0,EU27:40,CHN:40,ROW:20}),
] };
test('sums a fixed market panel; a missing month stays missing', () => {
  const {points} = monthlySeries(data)[0];
  assert.equal(points[0].total,140);
  assert.equal(points[1].values.CHN,60);
  assert.equal(points[2].values.CHN,null);
  assert.equal(points[2].displayed.CHN,null);
});
test('shares partition the observed panel and zero baselines are not indexed', () => {
  const shares = monthlySeries(data,{metric:'share'})[0].points;
  assert.ok(Math.abs(Object.values(shares[0].displayed).reduce((a,b)=>a+b,0)-100)<1e-9);
  const indexed = monthlySeries(data,{market:'USA',metric:'index'})[0].points;
  assert.equal(indexed[0].displayed.USA,null);
  assert.equal(indexed[1].displayed.CHN,200);
});
test('market and period filters change the denominator and index base', () => {
  const points = monthlySeries(data,{market:'USA',metric:'index',start:'202502'})[0].points;
  assert.equal(points.length,2);assert.equal(points[0].displayed.CHN,100);
  assert.equal(points[1].displayed.CHN,100);
  assert.equal(monthLabel('202512'),'Dec 2025');
});
