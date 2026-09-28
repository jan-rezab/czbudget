import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RussiaTradeStore, RUSSIA_ROUTES_SQL } from '../../server/russia-trade-store.mjs';

test('Russia comparison preserves exact source precision, reporting side and release provenance', async()=>{
 const store=new RussiaTradeStore({now:()=>Date.UTC(2026,8,26)});let calls=0;
 store.query=async(sql,parameters,options)=>{calls++;assert.equal(sql,RUSSIA_ROUTES_SQL);assert.equal(options.maxResults,'5000');assert.deepEqual(parameters.map(p=>p.parameterValue.value),['DEU','KAZ','854231']);return [{period:'202401',reporter_iso3:'DEU',partner_iso3:'KAZ',value_usd:'18143.966',ingestion_run_id:'published-period-1',source_response_sha256:'abc'}];};
 const result=await store.routes();assert.equal(result.observations[0].value_usd,18143.966);assert.equal(result.observations[0].reported_value_usd,'18143.966');assert.deepEqual(result.source.release_ids,['published-period-1']);assert.equal(result.reporting_basis,'EXPORTER_REPORTED');assert.equal(result.start_period,'201902');assert.equal(result.end_period,'202609');assert.equal((await store.routes()),result);assert.equal(calls,1);
});
test('invalid filters fail before querying, including an exporter identical to the intermediary', async()=>{
 const store=new RussiaTradeStore();store.query=()=>{throw new Error('must not query');};
 for(const args of [['EU','KAZ','854231'],['DEU','RUS','854231'],['DEU','KAZ','TOTAL'],['TUR','TUR','847130']])await assert.rejects(store.routes(...args),e=>e.code==='invalid_russia_trade_filter');
});
test('query keeps original monthly HS6 exports, excludes World and selects one revised record',()=>{
 assert.match(RUSSIA_ROUTES_SQL,/frequency = 'M'/);assert.match(RUSSIA_ROUTES_SQL,/flow_code = 'X'/);assert.match(RUSSIA_ROUTES_SQL,/is_original_classification/);assert.match(RUSSIA_ROUTES_SQL,/product_code = @product AND aggregation_level = 6/);assert.match(RUSSIA_ROUTES_SQL,/partner_area_code != 0/);assert.match(RUSSIA_ROUTES_SQL,/WHERE rank = 1/);assert.doesNotMatch(RUSSIA_ROUTES_SQL,/SUM\(/);
});
test('warehouse null is preserved rather than turned into zero', async()=>{
 const store=new RussiaTradeStore();store.query=async()=>[{value_usd:null}];assert.equal((await store.routes()).observations[0].value_usd,null);
});

import {RUSSIA_AGGREGATE_SQL,RUSSIA_SUPPLIERS_SQL} from '../../server/russia-trade-store.mjs';
test('aggregate endpoint defaults to annual all goods and retains derived precision and provenance',async()=>{
 const store=new RussiaTradeStore({suppliersSource:{rows:async()=>null}});let calls=0;store.query=async(sql,params)=>{calls++;if(sql===RUSSIA_AGGREGATE_SQL){assert.deepEqual(params.map(p=>p.parameterValue.value),['A','TOTAL']);return [{value_usd:'123456.789',product_count:'3',release_ids:'r1|r2'}];}if(sql===RUSSIA_SUPPLIERS_SQL)return [];return [{iso3:'DEU',iso2:'de'}];};const d=await store.aggregate();assert.equal(d.frequency,'A');assert.equal(d.product,'TOTAL');assert.equal(d.observations[0].reported_value_usd,'123456.789');assert.equal(d.observations[0].value_usd,123456.789);assert.deepEqual(d.source.release_ids,['r1','r2']);assert.equal(await store.aggregate(),d);assert.equal(calls,3);
});
test('aggregate query excludes regional groups, parents and mirror addition before summing',()=>{assert.match(RUSSIA_AGGREGATE_SQL,/aggregation_level=6/);assert.match(RUSSIA_AGGREGATE_SQL,/QUALIFY ROW_NUMBER/);assert.match(RUSSIA_AGGREGATE_SQL,/GROUP BY period,reporter_iso3,flow_code,partner_area_code,basket/);assert.match(RUSSIA_SUPPLIERS_SQL,/is_reporter AND NOT is_group/);assert.match(RUSSIA_SUPPLIERS_SQL,/frequency='A'/);});
test('aggregate filters reject malformed frequencies and products before network',async()=>{const s=new RussiaTradeStore();s.query=()=>{throw Error('network');};for(const a of [['Q','TOTAL'],['A','bad'],['A','123456']])await assert.rejects(s.aggregate(...a),e=>e.code==='invalid_russia_aggregate_filter');});

test('aggregate pagination preserves every observation and mirror declaration below the response limit',async()=>{
 const {pageRussiaAggregate}=await import('../../server/russia-trade-store.mjs');
 const data={view_id:'same-view',observations:Array.from({length:2300},(_,i)=>({period:'2025',value_usd:i,reported_value_usd:String(i),source_hashes:'a'.repeat(700)})),suppliers:Array.from({length:1200},(_,i)=>({reporter_iso3:'DEU',value_usd:i,reported_value_usd:String(i)})),countries:[],source:{release_ids:['release']}};
 const observations=[],suppliers=[];let page=0;
 do {const part=pageRussiaAggregate(data,String(page));assert.ok(Buffer.byteLength(JSON.stringify({data:part}))<2*1024*1024);observations.push(...part.observations);suppliers.push(...part.suppliers);page=part.pagination.next_page;}while(page!==null);
 assert.deepEqual(observations,data.observations);assert.deepEqual(suppliers,data.suppliers);
 for(const invalid of ['-1','1.5','1000','4'])assert.throws(()=>pageRussiaAggregate(data,invalid),e=>e.code==='invalid_russia_page');
});

test('bilateral comparison keeps direction, original HS6, annual grain and exact reported strings',async()=>{
 const {RUSSIA_BILATERAL_SQL}=await import('../../server/russia-trade-store.mjs');const store=new RussiaTradeStore();let calls=0;
 store.query=async(sql,params)=>{calls++;assert.equal(sql,RUSSIA_BILATERAL_SQL);assert.equal(params[0].parameterValue.value,'CHN');return [{period:'2024',reporter_iso3:'CHN',flow_code:'M',partner_iso3:'RUS',product_code:'27',value_usd:'1234.56789',product_count:'3',release_ids:'load-a|load-b'}];};
 const data=await store.bilateral('chn');assert.equal(data.country,'CHN');assert.equal(data.frequency,'A');assert.equal(data.observations[0].flow_code,'M');assert.equal(data.observations[0].reported_value_usd,'1234.56789');assert.deepEqual(data.source.release_ids,['load-a','load-b']);assert.equal(await store.bilateral('CHN'),data);assert.equal(calls,1);
 assert.match(RUSSIA_BILATERAL_SQL,/frequency='A'/);assert.match(RUSSIA_BILATERAL_SQL,/reporter_iso3=@country/);assert.match(RUSSIA_BILATERAL_SQL,/partner_iso3='RUS'/);assert.match(RUSSIA_BILATERAL_SQL,/aggregation_level=6 AND is_original_classification/);assert.match(RUSSIA_BILATERAL_SQL,/flow_code IN \('X','M'\)/);assert.match(RUSSIA_BILATERAL_SQL,/ROW_NUMBER\(\)/);
 await assert.rejects(store.bilateral('RUS'),e=>e.code==='invalid_russia_country');await assert.rejects(store.bilateral('China'),e=>e.code==='invalid_russia_country');
});
