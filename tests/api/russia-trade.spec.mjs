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
