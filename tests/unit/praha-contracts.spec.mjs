import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {PrahaContractsStore,CONTRACT_RELEASE} from '../../server/praha-contracts.mjs';
import {createRequire} from 'node:module';
const {renderContracts}=createRequire(import.meta.url)('../../praha-invoice-view.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const release='11111111-1111-1111-1111-111111111111',supplier='02795281',id=hash(supplier).slice(0,2),prefix='static-assets/praha-evidence/';
const row={supplier_ico:supplier,contract_id:'7939187',subject:'Lítačka',signed_at:'2019-01-01',value_czk:'1016400.01',source_url:'https://smlouvy.gov.cz/smlouva/7939187',parent_contract_id:'5395991',compact_contract_sha256:'a'.repeat(64),contract_json:'must not leak'};
function fixture({corrupt=false,wrongRelease=false,count=1}={}){
 const raw=Buffer.from(JSON.stringify({schema_version:'1.0.0',release_id:release,bucket_id:id,rows:[row]})),z=gzipSync(raw);
 const asset=(object,b)=>({object,generation:'123',bytes:b.length,sha256:hash(b)});
 const shard=asset(prefix+'releases/'+release+'/shards/'+id+'.json.gz',z);
 const m={schema_version:'1.0.0',release_id:release,payer_ico:'00064581',contract_release_id:wrongRelease?'wrong':CONTRACT_RELEASE,cityvizor_warehouse_release_id:'3c1b0b77-f00f-42c9-ae74-1a2366034a62',cityvizor_source_release_id:'20260909-2294793cff54',coverage_contracts:115429,candidate_pair_rows:count,supplier_counts:{[supplier]:count},shards:{[id]:{...shard,uncompressed_bytes:raw.length,rows:1}}};
 const mb=Buffer.from(JSON.stringify(m));const ma=asset(prefix+'releases/'+release+'/manifest.json',mb);
 const p=Buffer.from(JSON.stringify({schema_version:'1.0.0',release_id:release,bucket:'czbudget-janrezab-public-snapshots',validated:true,manifest:ma}));
 let requests=0;
 const store=new PrahaContractsStore({tokenProvider:async()=>'test',fetchImpl:async url=>{
  requests++;assert.ok(url.startsWith('https://storage.googleapis.com/'));assert.ok(!url.includes('data-layers'));
  const key=decodeURIComponent(url.split('/o/')[1].split('?')[0]);let b=key.endsWith('current.json')?p:key.endsWith('manifest.json')?mb:z;
  if(corrupt&&key.endsWith('.gz'))b=Buffer.from('corrupt');
  return {ok:true,arrayBuffer:async()=>b,headers:{get:()=>null}};
 }});return {store,requests:()=>requests};
}
test('curated exact parties preserve decimal precision, bound output and exclude raw JSON',async()=>{
 const f=fixture(),r=await f.store.related({payer:'00064581',supplier,date:'2026-01-28',term:'lítačka'});
 assert.equal(r.related_count,1);assert.equal(r.filtered_count,1);assert.equal(r.match_status,'not_verified');assert.equal(r.rows[0].value_czk,'1016400.01');assert.ok(!('contract_json' in r.rows[0]));assert.equal(r.release_id,CONTRACT_RELEASE);assert.equal(f.requests(),3);
 await f.store.related({payer:'00064581',supplier});assert.equal(f.requests(),3);
});
test('unsupported buyers and malformed identities fail before network',async()=>{
 const f=fixture();for(const keys of [{payer:'12345678',supplier},{payer:'00064581',supplier:'2795281'},{payer:'00064581',supplier:2795281}])await assert.rejects(f.store.related(keys));assert.equal(f.requests(),0);
});
test('checksum, warehouse release and count mismatch fail closed',async()=>{
 for(const options of [{corrupt:true},{wrongRelease:true},{count:2}])await assert.rejects(fixture(options).store.related({payer:'00064581',supplier}),{code:'prague_contract_release_unavailable'});
});
test('known absent supplier and empty subject filter keep coverage evidence',async()=>{
 const f=fixture();const absent=await f.store.related({payer:'00064581',supplier:'99999999'});assert.equal(absent.related_count,0);assert.equal(absent.coverage_contracts,115429);
 const filtered=await f.store.related({payer:'00064581',supplier,term:'missing'});assert.equal(filtered.related_count,1);assert.equal(filtered.filtered_count,0);
});
test('evidence separates commitments from spending and rejects unsafe URLs',()=>{
 const html=renderContracts({related_count:1,filtered_count:1,rows:[{...row,source_url:'javascript:alert(1)'}]}, {T:en=>en,esc:v=>String(v??''),link:(u,t)=>`<a href="${u}">${t}</a>`});assert.ok(html.includes('invoice-to-contract link not verified'));assert.ok(html.includes('not invoice amount'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('Parent contract / amendment chain'));
});
