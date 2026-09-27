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

import {categoryGrowth} from '../../lib/russia-trade-model.mjs';
test('growth stacks hold the largest absolute increases fixed and reconcile Other to the subtotal',()=>{
 const observations=[];
 for(const [year,total,a,b,c] of [['2019',1000,100,1,200],['2024',1700,800,10,100],['2025',2000,1100,20,90]])for(const [product,value] of [['TOTAL',total],['84',a],['85',b],['87',c]])observations.push(agg(year,'KAZ','M','WORLD',product,value));
 observations.push(agg('2025','KAZ','M','CHN','84',999999));
 const m=categoryGrowth({frequency:'A',observations},{hub:'KAZ',endYear:'2025',limit:1});
 assert.deepEqual(m.categories.map(c=>c.code),['84']);assert.equal(m.categories[0].delta,1000);assert.equal(m.rows[0].other,900);assert.equal(m.rows[2].other,900);assert.equal(m.rows[1]['84'],800);
});
test('growth stacks distinguish missing observations, missing baselines and real zero',()=>{
 const observations=[agg('2019','KGZ','X','RUS','TOTAL',100),agg('2019','KGZ','X','RUS','84',0),agg('2024','KGZ','X','RUS','TOTAL',150),agg('2025','KGZ','X','RUS','TOTAL',200),agg('2025','KGZ','X','RUS','84',100),agg('2025','KGZ','X','RUS','85',50)];
 const m=categoryGrowth({frequency:'A',observations},{hub:'KGZ',flow:'X'});assert.deepEqual(m.categories.map(c=>c.code),['84']);assert.equal(m.categories[0].ratio,null);assert.equal(m.rows[0]['84'],0);assert.equal(m.rows[1]['84'],null);assert.equal(m.rows[1].other,null);assert.equal(m.rows[2].other,100);
 assert.throws(()=>categoryGrowth({frequency:'M',observations},{hub:'KGZ'}),/annual/);
});
test('growth stack never turns a negative remainder into a valid total',()=>{const observations=[agg('2019','KAZ','M','WORLD','84',10),agg('2025','KAZ','M','WORLD','84',100),agg('2025','KAZ','M','WORLD','TOTAL',50)];assert.equal(categoryGrowth({frequency:'A',observations},{hub:'KAZ'}).rows[0].other,null);});
test('earlier baseline ranks pre-invasion growth without borrowing the 2019 reference',()=>{
 const observations=[];
 for(const [year,total,a,b] of [['2014',1000,100,200],['2019',1500,800,100],['2021',2000,300,600]])
  for(const [code,value] of [['TOTAL',total],['84',a],['85',b]])observations.push(agg(year,'KGZ','M','WORLD',code,value));
 const result=categoryGrowth({frequency:'A',observations},{hub:'KGZ',baseYear:'2014',endYear:'2021',limit:1});
 assert.equal(result.baseYear,'2014');assert.equal(result.categories[0].code,'85');assert.equal(result.categories[0].delta,400);
 assert.deepEqual(result.rows.map(r=>r.period),['2014','2019','2021']);assert.equal(result.rows[0].other,800);
});

import {supplierHistory} from '../../lib/russia-trade-model.mjs';
test('supplier history keeps annual exporter declarations, absent years and real zeros distinct',()=>{
 const suppliers=[
  {period:'2019',reporter_iso3:'DEU',partner_iso3:'KGZ',value_usd:100},
  {period:'2021',reporter_iso3:'DEU',partner_iso3:'KGZ',value_usd:0},
  {period:'2021',reporter_iso3:'DEU',partner_iso3:'KAZ',value_usd:999},
  {period:'202101',reporter_iso3:'DEU',partner_iso3:'KGZ',value_usd:999},
  {period:'2021',reporter_iso3:'KOR',partner_iso3:'KGZ',value_usd:200}
 ];
 const model=supplierHistory({suppliers},'2021');
 assert.deepEqual(model.rows.map(r=>r.period),['2019','2020','2021']);assert.equal(model.rows[1].DEU,null);assert.equal(model.rows[2].DEU,0);
 assert.equal(model.comparisons.find(r=>r.reporter==='DEU').delta,-100);assert.equal(model.comparisons.find(r=>r.reporter==='KOR').delta,null);
 assert.equal(supplierHistory({suppliers:[]},'2025').rows.length,0);
 assert.equal(supplierHistory({suppliers},'2026').year,'2021');assert.equal(supplierHistory({suppliers},'2014').year,'2014');
});

test('paged consumer assembles the full comparison and rejects changing or incomplete views',async()=>{
 const {readRussiaAggregate}=await import('../../lib/russia-trade-model.mjs');let calls=0;
 const pages=[{view_id:'v',observations:[{value_usd:null}],suppliers:[],pagination:{next_page:1,observation_count:1,supplier_count:1}},{view_id:'v',observations:[],suppliers:[{value_usd:0}],pagination:{next_page:null,observation_count:1,supplier_count:1}}];
 const fetcher=async url=>{assert.match(url,new RegExp(`page=${calls}$`));return Response.json({data:pages[calls++]});};
 const result=await readRussiaAggregate('A','TOTAL',fetcher);assert.equal(calls,2);assert.equal(result.observations[0].value_usd,null);assert.equal(result.suppliers[0].value_usd,0);assert.equal(result.pagination,undefined);
 calls=0;pages[1].view_id='changed';await assert.rejects(readRussiaAggregate('A','TOTAL',fetcher),/changed/);
 calls=0;pages[1].view_id='v';pages[1].pagination.supplier_count=2;await assert.rejects(readRussiaAggregate('A','TOTAL',fetcher),/Incomplete/);
});
