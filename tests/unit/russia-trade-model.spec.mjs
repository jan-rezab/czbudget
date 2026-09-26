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
