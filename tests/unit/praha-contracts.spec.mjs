import test from 'node:test';
import assert from 'node:assert/strict';
import {PrahaContractsStore,CONTRACT_RELEASE,RELATED_CONTRACTS_SQL} from '../../server/praha-contracts.mjs';
import {createRequire} from 'node:module';
const {renderContracts}=createRequire(import.meta.url)('../../praha-invoice-view.js');
function response(row){const fields=Object.keys(row);return {ok:true,json:async()=>({jobComplete:true,schema:{fields:fields.map(name=>({name}))},rows:[{f:fields.map(k=>({v:row[k]}))}]})};}
const row={release_id:CONTRACT_RELEASE,municipality_ico:'00064581',accepted_rows:'115429',source_completed_at:'2026-09-21',related_count:'826',filtered_count:'5',contract_id:'7939187',subject:'Lítačka',value_czk:'1016400',source_url:'https://smlouvy.gov.cz/smlouva/7939187',parent_contract_id:'5395991'};
test('exact party lookup is bound, bounded, and never returns raw contract JSON or confirmed invoice matches',async()=>{
 let body;
 const store=new PrahaContractsStore({tokenProvider:async()=> 'test',fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return response(row);}});
 const result=await store.related({payer:'00064581',supplier:'02795281',date:'2026-01-28',term:'lítačka'});
 assert.equal(result.related_count,826);assert.equal(result.filtered_count,5);assert.equal(result.match_status,'not_verified');
 assert.equal(result.rows[0].parent_contract_id,'5395991');assert.equal(result.rows[0].value_czk,'1016400');
 assert.equal(body.queryParameters.find(p=>p.name==='supplier').parameterValue.value,'02795281');
 assert.ok(RELATED_CONTRACTS_SQL.includes('EXISTS'));assert.ok(RELATED_CONTRACTS_SQL.includes('LIMIT 50'));
 assert.ok(!RELATED_CONTRACTS_SQL.includes('contract_json'));assert.ok(!('contract_json' in result.rows[0]));
});
test('unsupported buyers and invalid supplier identities fail before network requests',async()=>{
 const store=new PrahaContractsStore({tokenProvider:()=>{throw new Error('network should not run');}});
 for(const keys of [{payer:'12345678',supplier:'02795281'},{payer:'00064581',supplier:'2795281'},{payer:'00064581',supplier:2795281}]) await assert.rejects(store.related(keys));
});
test('a changed or absent warehouse release is unavailable, never an empty successful lookup',async()=>{
 const store=new PrahaContractsStore({tokenProvider:async()=> 'test',fetchImpl:async()=>response({...row,release_id:'other'})});
 await assert.rejects(store.related({payer:'00064581',supplier:'02795281'}),{code:'prague_contract_release_unavailable'});
});
test('evidence separates contract commitments from spending and does not link unsafe source URLs',()=>{
 const html=renderContracts({related_count:1,filtered_count:1,rows:[{...row,source_url:'javascript:alert(1)'}]}, {T:en=>en,esc:v=>String(v??''),link:(u,t)=>`<a href="${u}">${t}</a>`});
 assert.ok(html.includes('invoice-to-contract link not verified'));assert.ok(html.includes('not invoice amount'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('Parent contract / amendment chain'));
});
