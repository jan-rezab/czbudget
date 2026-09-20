import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlySeries, monthLabel } from '../../lib/automotive.mjs';
const row = (period, market, values, values_all = values) => ({ period, market, segment: 'vehicles', values, values_all });
const data = { periods: ['202501','202502','202503'], panel: ['USA','DEU'], eu27:['DEU'], rows: [
  row('202501','USA',{USA:0,EU27:30,CHN:20,ROW:50}), row('202501','DEU',{USA:10,EU27:0,CHN:20,ROW:10},{USA:10,EU27:25,CHN:20,ROW:10}),
  row('202502','USA',{USA:0,EU27:40,CHN:40,ROW:20}), row('202502','DEU',{USA:20,EU27:0,CHN:20,ROW:20},{USA:20,EU27:35,CHN:20,ROW:20}),
  row('202503','USA',{USA:0,EU27:40,CHN:40,ROW:20}),
] };
test('sums a fixed market panel; a missing month stays missing', () => {
  const {points} = monthlySeries(data)[0];
  assert.equal(points[0].total,140);
  assert.equal(points[1].values.CHN,60);
  assert.equal(points[2].values.CHN,null);
  assert.equal(points[2].displayed.CHN,null);
});
test('all cross-border scope adds intra-EU imports without changing other regions', () => {
  const external = monthlySeries(data)[0].points[0];
  const all = monthlySeries(data,{scope:'all'})[0].points[0];
  assert.equal(external.values.EU27,30);
  assert.equal(all.values.EU27,55);
  assert.equal(all.values.CHN,external.values.CHN);
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

test('route filters preserve direction and reconcile region and country views', async () => {
  const {tradeRoutes,diagramRoutes}=await import('../../lib/automotive.mjs');
  const routesData={eu27:['DEU','FRA'],origins:[{code:'DEU',region:'EU27'},{code:'FRA',region:'EU27'},{code:'CHN',region:'CHN'}],routes:[
    {period:'202601',segment:'vehicles',origin:'DEU',market:'USA',value:30},
    {period:'202601',segment:'vehicles',origin:'FRA',market:'USA',value:20},
    {period:'202601',segment:'vehicles',origin:'DEU',market:'FRA',value:15},
    {period:'202601',segment:'vehicles',origin:'CHN',market:'CAN',value:40},
    {period:'202602',segment:'vehicles',origin:'CHN',market:'USA',value:900},
    {period:'202601',segment:'parts',origin:'CHN',market:'USA',value:800},
  ]};
  const regions=tradeRoutes(routesData,{period:'202601'});
  assert.deepEqual(regions,[{origin:'EU27',market:'USA',value:50},{origin:'CHN',market:'CAN',value:40}]);
  assert.equal(tradeRoutes(routesData,{period:'202601',scope:'all'}).reduce((sum,r)=>sum+r.value,0),105);
  const country=tradeRoutes(routesData,{period:'202601',geography:'countries',origin:'FRA',market:'USA'});
  assert.deepEqual(country,[{origin:'FRA',market:'USA',value:20}]);
  const collapsed=diagramRoutes(tradeRoutes(routesData,{period:'202601',geography:'countries'}),1);
  assert.equal(collapsed.reduce((s,r)=>s+r.value,0),90);
  assert.ok(collapsed.some(r=>r.origin==='OTHER_ORIGINS'));
  assert.ok(collapsed.some(r=>r.market==='OTHER_MARKETS'));
  assert.equal(tradeRoutes(routesData,{period:'202501'}).length,0);
});
