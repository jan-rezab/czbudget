import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RareEarthStore, rareEarthSelection, RARE_EARTH_HISTORY_SQL } from '../../server/rare-earth-store.mjs';
import { amount, pair, partners, timeline, treemap } from '../../lib/rare-earth-model.mjs';

const row = (product, flow, usd, kg, period='2024') => ({product_code:product,flow,value_usd:usd,net_weight_kg:kg,period});
test('missing trade and weights remain distinct from reported zero',()=>{
 assert.equal(amount([]),null);
 assert.equal(amount([row('280530','export',0,0)]),0);
 assert.equal(amount([row('280530','export',100,null)],'tonnes'),null);
 assert.equal(amount([row('280530','export',100,2000),row('284610','export',20,null)],'tonnes'),null);
 assert.equal(amount([row('280530','export',100,2000)],'tonnes'),2);
});
test('an incomplete basket cannot produce a headline balance',()=>{
 const rows=[row('280530','export',20,100),row('280530','import',10,50)];
 assert.equal(pair(rows).balance,null);
 assert.equal(pair(rows,'usd',1).balance,10);
});
test('product filtering does not count unrelated goods or invent the opposite flow',()=>{
 const rows=[{...row('280530','export',20,100),partner_iso3:'JPN'}, {...row('284610','export',80,400),partner_iso3:'JPN'}, {...row('850511','import',100,50),partner_iso3:'JPN'}];
 assert.equal(partners(rows,'280530')[0].export,20);
 assert.equal(partners(rows,'ALL')[0].export,100);
 assert.equal(partners(rows,'ALL')[0].import,null);
});
test('missing annual and monthly periods break the timeline',()=>{
 assert.deepEqual(timeline([row('280530','export',1,10,'2022'),row('280530','export',2,20,'2024')],'280530','usd','A').map(r=>r.export),[1,null,2]);
 assert.deepEqual(timeline([row('280530','export',1,10,'202512'),row('280530','export',2,20,'202602')],'280530','usd','M').map(r=>r.period),['202512','202601','202602']);
});
test('treemap geometry preserves value proportions and excludes zeroes',()=>{
 const tiles=treemap([{code:'A',weight:3},{code:'B',weight:1},{code:'C',weight:0}],{x:0,y:0,w:100,h:100});
 assert.equal(tiles.length,2);assert.equal(tiles[0].w*tiles[0].h,7500);assert.equal(tiles[1].w*tiles[1].h,2500);
});
test('frequency and periods are validated before any warehouse query',()=>{
 assert.equal(rareEarthSelection(' chn ','M','202608').country,'CHN');
 for(const [frequency,period] of [['Q','2024'],['M','202413'],['A','202608'],['A','2019']])assert.throws(()=>rareEarthSelection('CHN',frequency,period));
});
test('API caches history, keeps requested missing periods, and preserves null weights',async()=>{
 const store=new RareEarthStore({tokenProvider:async()=>''});const calls=[];
 store.query=async(sql,params)=>{calls.push({sql,params});return sql===RARE_EARTH_HISTORY_SQL?[
  {kind:'totals',payload:JSON.stringify([{period:'2024',product_code:'280530',flow_code:'X',value_usd:'100',net_weight_kg:null,retrieved_at:'2026-09-15T00:00:00Z'}])},
  {kind:'coverage',payload:'[]'},
 ]:[{kind:'partners',payload:'null'}];};
 const first=await store.profile('CHN','A','2024');
 assert.equal(first.totals[0].net_weight_kg,null);assert.equal(first.totals[0].value_usd,100);assert.equal(first.totals[0].flow,'export');
 await store.profile('CHN','A','2024');assert.equal(calls.length,2);
 const missing=await store.profile('CHN','A','2025');assert.equal(missing.period,'2025');assert.equal(calls.length,3);
 assert.equal(calls[2].params.find(p=>p.name==='period_start').parameterValue.value,'2025-01-01');
 await store.profile('CHN','M');assert.equal(calls.filter(call=>call.sql===RARE_EARTH_HISTORY_SQL).length,2);
});
test('empty monthly data have no annual or broad chapter fallback',async()=>{
 const store=new RareEarthStore({tokenProvider:async()=>''});store.query=async()=>[{kind:'totals',payload:'null'},{kind:'coverage',payload:'null'}];
 const result=await store.profile('CHN','M');assert.deepEqual(result.totals,[]);assert.deepEqual(result.partners,[]);assert.equal(result.period,null);
});
