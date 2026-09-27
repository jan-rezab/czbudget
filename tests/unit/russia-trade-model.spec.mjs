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

test('map selects major suppliers independently for each hub without discarding underlying rows',async()=>{
 const {largestMapSuppliers}=await import('../../lib/russia-trade-model.mjs');
 const rows=['KAZ','KGZ'].flatMap((reporter_iso3,h)=>Array.from({length:15},(_,i)=>({reporter_iso3,partner_iso3:String(i),value_usd:(i+1)*(h?1:1000)})));
 rows.push({reporter_iso3:'KGZ',partner_iso3:'missing',value_usd:null},{reporter_iso3:'KAZ',partner_iso3:'zero',value_usd:0});
 const selected=largestMapSuppliers(rows);assert.equal(selected.length,16);assert.equal(rows.length,32);
 for(const hub of ['KAZ','KGZ']){const values=selected.filter(r=>r.reporter_iso3===hub);assert.equal(values.length,8);assert.deepEqual(values.map(r=>r.partner_iso3),['14','13','12','11','10','9','8','7']);}
});

test('direct suppliers distinguish Korean decline, missing endpoints and tiny-base growth',async()=>{
 const {directSupplierGrowth}=await import('../../lib/russia-trade-model.mjs');const suppliers=[['CHN','2019',10],['CHN','2024',30],['KOR','2019',10],['KOR','2024',5],['PRK','2019',1],['GEO','2019',0],['GEO','2024',2]].map(([reporter_iso3,period,value_usd])=>({reporter_iso3,period,value_usd,partner_iso3:'RUS'}));
 const rows=directSupplierGrowth({suppliers},'2019','2024');assert.equal(rows[0].reporter,'CHN');assert.equal(rows.find(r=>r.reporter==='KOR').delta,-5);assert.equal(rows.find(r=>r.reporter==='PRK').delta,null);assert.equal(rows.find(r=>r.reporter==='GEO').ratio,null);
});
test('bilateral categories and history keep Russia imports distinct from World and preserve absent years',async()=>{
 const {bilateralHistory}=await import('../../lib/russia-trade-model.mjs');const observations=[['2019','M','TOTAL',10],['2019','M','27',8],['2021','M','TOTAL',30],['2021','M','27',25],['2019','X','TOTAL',4],['2021','X','TOTAL',5]].map(([period,flow_code,product_code,value_usd])=>({period,flow_code,product_code,value_usd,reporter_iso3:'CHN',partner_iso3:'RUS'}));
 const data={frequency:'A',observations},history=bilateralHistory(data);assert.equal(history[1].period,'2020');assert.equal(history[1].M,null);assert.equal(history[2].X,5);
 const model=categoryGrowth(data,{hub:'CHN',flow:'M',partner:'RUS',baseYear:'2019',endYear:'2021',continuousYears:true});assert.equal(model.categories[0].code,'27');assert.equal(model.categories[0].delta,17);assert.equal(model.rows[0].other,2);assert.equal(model.rows[1].period,'2020');assert.equal(model.rows[1]['27'],null);assert.equal(model.rows[1].other,null);
});

test('delta story uses exact decimal source arithmetic and distinguishes gross growth from net',async()=>{
 const {deltaBasket,deltaSlices}=await import('../../lib/russia-trade-model.mjs');
 const obs=[['84','2019','100.000000001'],['84','2024','150.000000002'],['27','2019','30.1'],['27','2024','20.2'],['85','2019','0'],['85','2024','0'],['26','2024','99'],['06','2020','1']].map(([product_code,period,reported_value_usd])=>({product_code,period,reported_value_usd,value_usd:999}));
 const b=deltaBasket(obs);assert.equal(b.positiveExact,'50.000000001');assert.equal(b.negativeExact,'-9.9');assert.equal(b.netExact,'40.100000001');assert.deepEqual(b.missing.map(r=>r.code),['06','26']);assert.equal(b.rows.find(r=>r.code==='85').deltaExact,'0');assert.equal(deltaSlices(b)[0].sharePositiveExact,'100');
 assert.equal(deltaBasket(obs,{endYear:'2025'}).netExact,null);assert.throws(()=>deltaBasket([...obs,obs[0]]),/Duplicate/);
});
test('donut slices retain every positive change and exact grouped inputs, without including declines',async()=>{
 const {deltaBasket,deltaSlices}=await import('../../lib/russia-trade-model.mjs'),observations=Array.from({length:8},(_,i)=>String(i+10)).flatMap((product_code,i)=>[{period:'2019',product_code,reported_value_usd:'0.01'},{period:'2024',product_code,reported_value_usd:String(i+1)+'.01'}]);
 const b=deltaBasket(observations),slices=deltaSlices(b,2);assert.equal(slices.length,3);assert.equal(slices[2].code,'OTHER');assert.equal(slices[2].deltaExact,'21');assert.equal(slices[2].baseExact,'0.06');assert.equal(slices[2].valueExact,'21.06');assert.equal(slices.reduce((s,r)=>s+r.delta,0),Number(b.positiveExact));assert.equal(slices[2].members.length,6);
});
test('bilateral delta exposes the missing-category bridge to the full basket and does not invent a North Korean zero',async()=>{
 const {bilateralDelta,chooseStoryYear}=await import('../../lib/russia-trade-model.mjs');
 const observations=[['2019','TOTAL','100'],['2024','TOTAL','150'],['2019','84','70'],['2024','84','130'],['2019','27','30']].map(([period,product_code,reported_value_usd])=>({period,product_code,reported_value_usd,reporter_iso3:'CHN',partner_iso3:'RUS',flow_code:'M'}));
 const b=bilateralDelta({country:'CHN',observations},{flow:'M'});assert.equal(b.netExact,'60');assert.equal(b.total.deltaExact,'50');assert.equal(b.coverageDifferenceExact,'-10');assert.equal(b.missing[0].code,'27');
 assert.equal(bilateralDelta({country:'PRK',observations:[]}).netExact,null);
 const data={country:'CHN',observations:[...observations,{period:'2024',product_code:'TOTAL',flow_code:'X'}]};assert.equal(chooseStoryYear({suppliers:[{reporter_iso3:'CHN',partner_iso3:'RUS',period:'2024'},{reporter_iso3:'KOR',partner_iso3:'RUS',period:'2025'}]},data), '2024');assert.equal(chooseStoryYear({suppliers:[]},data,'2025'),'2025');
});

test('audit export retains each missing endpoint, exact decimal and ingestion provenance',async()=>{
 const {deltaBasket,deltaAuditRows}=await import('../../lib/russia-trade-model.mjs');const basket=deltaBasket([{period:'2019',product_code:'75',reported_value_usd:'0.2',release_ids:'base'},{period:'2024',product_code:'75',reported_value_usd:'0.1',release_ids:['end']},{period:'2020',product_code:'06',reported_value_usd:'1'},{period:'2019',product_code:'14',reported_value_usd:'0'}]);const rows=deltaAuditRows(basket,{reporter:'CHN',flow:'M'});
 assert.equal(rows.length,3);assert.equal(rows.find(r=>r.code==='75').delta_usd,'-0.1');assert.equal(rows.find(r=>r.code==='75').endpoint_load_ids,'end');assert.equal(rows.find(r=>r.code==='75').base_load_ids,'base');assert.equal(rows.find(r=>r.code==='14').baseline_usd,'0');assert.equal(rows.find(r=>r.code==='14').comparison_status,'missing_endpoint');assert.equal(rows.find(r=>r.code==='06').comparison_status,'missing_both');assert.equal(rows[0].reporter_iso3,'CHN');
});
