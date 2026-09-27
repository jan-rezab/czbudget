import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthlyRows, calendar } from '../../lib/russia-trade-model.mjs';
const observation=(period,from,to,value)=>({period,reporter_iso3:from,partner_iso3:to,value_usd:value});
const data=observations=>({exporter:'DEU',via:'KAZ',end_period:'202403',observations});
test('timeline retains absent months across year boundaries',()=>{assert.deepEqual(calendar('202112','202203'),['202112','202201','202202','202203']);const rows=monthlyRows(data([]));assert.equal(rows[0].period,'201902');assert.equal(rows.find(r=>r.period==='202203').direct,null);});
test('seasonal baseline uses three matching months and does not infer zero',()=>{
 const input=data([observation('201903','DEU','RUS',90),observation('202003','DEU','RUS',120),observation('202103','DEU','RUS',150),observation('202403','DEU','RUS',0),observation('202403','DEU','KAZ',180)]);
 const row=monthlyRows(input).at(-1);assert.equal(row.directBaseline,120);assert.equal(row.direct,0);assert.equal(row.directDelta,-120);assert.equal(row.inboundBaseline,null);assert.equal(row.inboundDelta,null);assert.equal(row.offsetRatio,null);assert.equal(row.onward,null);
});
test('January baseline spans 2020, 2021 and 2022 and excludes January 2019',()=>{
 const input=data(['201901','202001','202101','202201'].map((p,i)=>observation(p,'DEU','RUS',i?30:900)));
 assert.equal(monthlyRows(input).find(r=>r.period==='202401').directBaseline,30);
});
test('the descriptive offset compares deltas and never adds onward exports',()=>{
 const observations=[];for(const p of ['201903','202003','202103']){observations.push(observation(p,'DEU','RUS',100),observation(p,'DEU','KAZ',10),observation(p,'KAZ','RUS',5));}
 observations.push(observation('202403','DEU','RUS',60),observation('202403','DEU','KAZ',30),observation('202403','KAZ','RUS',900));
 const row=monthlyRows(data(observations)).at(-1);assert.equal(row.offsetRatio,.5);assert.equal(row.onwardDelta,895);assert.equal(row.gain,20);assert.equal(row.loss,40);
});

import {aggregateModel,supplierComparisons} from '../../lib/russia-trade-model.mjs';
const agg=(period,hub,flow,partner,product,value)=>({period,reporter_iso3:hub,flow_code:flow,partner_iso3:partner,partner_area_code:partner==='WORLD'?0:1,product_code:product,value_usd:value});
test('aggregate model uses World independently from partners, preserves gaps and keeps both hubs',()=>{
 const model=aggregateModel({frequency:'A',product:'TOTAL',observations:[agg('2019','KAZ','M','WORLD','TOTAL',100),agg('2019','KAZ','M','CHN','TOTAL',90),agg('2025','KAZ','M','WORLD','TOTAL',250),agg('2025','KGZ','M','WORLD','TOTAL',0)]});
 assert.equal(model.rows[0].KAZ,100);assert.equal(model.rows[0].KGZ,null);assert.equal(model.rows[1].KGZ,0);assert.equal(model.compare('2025','KAZ','M').delta,150);assert.equal(model.suppliers('2019').length,1);
});
test('dependency ranking requires positive growth on both sides and uses all exports as denominator',()=>{
 const rows=[];for(const [year,imports,onward,exports] of [['2019',100,10,50],['2025',300,90,100]]){rows.push(agg(year,'KAZ','M','WORLD','84',imports),agg(year,'KAZ','X','RUS','84',onward),agg(year,'KAZ','X','WORLD','84',exports));}
 const r=aggregateModel({frequency:'A',product:'TOTAL',observations:rows}).dependencies('2025')[0];assert.equal(r.jointGrowth,80);assert.equal(r.russiaShare,.9);assert.equal(r.inbound.delta,200);
});
test('missing monthly periods remain gaps and do not borrow annual baselines',()=>{
 const m=aggregateModel({frequency:'M',product:'TOTAL',observations:[agg('202401','KAZ','M','WORLD','TOTAL',20),agg('202403','KAZ','M','WORLD','TOTAL',30)]});assert.deepEqual(m.periods,['202401','202402','202403']);assert.equal(m.rows[1].KAZ,null);assert.equal(m.compare('202403','KAZ','M').delta,null);
});
test('supplier panel excludes an incomplete bilateral and preserves genuine zero',()=>{
 const suppliers=[];for(const reporter_iso3 of ['DEU','USA'])for(const period of ['2019','2025'])for(const partner_iso3 of ['RUS','KAZ','KGZ'])if(!(reporter_iso3==='USA'&&period==='2019'&&partner_iso3==='KGZ'))suppliers.push({period,reporter_iso3,partner_iso3,value_usd:period==='2019'?100:partner_iso3==='RUS'?0:150});
 const a=supplierComparisons({suppliers},'2025');assert.equal(a.find(r=>r.reporter==='DEU').hubDelta,100);assert.equal(a.find(r=>r.reporter==='DEU').direct.delta,-100);assert.equal(a.find(r=>r.reporter==='USA').eligible,false);
});
