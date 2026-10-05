import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PrahaReconciliationStore} from '../../server/praha-reconciliation.mjs';
const id='12345678-1234-1234-1234-123456789012',prefix='static-assets/praha-reconciliation/';
const report=()=>({schema_version:'1.0.0',release_id:id,municipality_ico:'00064581',year:2025,currency:'CZK',validation:{passed:true},sources:[{id:'official',url:'https://eud.praha.eu/official.pdf',sha256:'a'.repeat(64)}],controls:[{passed:true}],observations:[{year:2025,currency:'CZK',amount_exact:'123.45',source_id:'official'}]});
function store(value,{badHash=false}={}){
 const bytes=Buffer.from(JSON.stringify(value)),pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',validated:true,release_id:id,report:{object:prefix+'releases/'+id+'/report.json',generation:'123',bytes:bytes.length,sha256:badHash?'b'.repeat(64):crypto.createHash('sha256').update(bytes).digest('hex')}};
 const requests=[];const s=new PrahaReconciliationStore({tokenProvider:async()=> 'fixture',fetchImpl:async url=>{requests.push(url);return new Response(url.includes('current.json')?JSON.stringify(pointer):bytes);}});return {s,requests};
}
test('missing release is explicit and is never a validated reconciliation',async()=>{
 const s=new PrahaReconciliationStore({tokenProvider:async()=> 'fixture',fetchImpl:async()=>new Response('',{status:404})});assert.equal((await s.current()).status,'not_published');
});
test('immutable report is generation-pinned, hash-verified and shared within the cache',async()=>{
 const {s,requests}=store(report());assert.equal((await s.current()).status,'available');await s.current();assert.equal(requests.length,2);assert.match(requests[1],/generation=123/);
});
test('wrong bytes, fiscal year or source identity cannot publish verified observations',async()=>{
 await assert.rejects(store(report(),{badHash:true}).s.current());
 const r=report();r.observations[0].year=2026;await assert.rejects(store(r).s.current());r.observations[0].year=2025;r.observations[0].source_id='missing';await assert.rejects(store(r).s.current());r.observations[0].source_id='official';r.controls[0].passed=false;await assert.rejects(store(r).s.current());
});
