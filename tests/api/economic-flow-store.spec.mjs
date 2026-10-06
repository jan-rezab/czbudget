import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EconomicFlowStore} from '../../server/economic-flow-store.mjs';
import {fixture} from '../fixtures/economic-flows.mjs';
function store(overrides={},bodyOverride){
  const data=fixture(),body=Buffer.from(JSON.stringify(data));
  const pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',object:`static-assets/czech-economic-flows/releases/${data.release_id}/atlas.json`,generation:'123',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),release_id:data.release_id,...overrides};
  const urls=[];return {urls,value:new EconomicFlowStore({token:async()=>'fixture',fetchImpl:async url=>{urls.push(url);return new Response(url.includes('current.json')?JSON.stringify(pointer):bodyOverride??body);}})};
}
test('API pins object generation and hash, coalesces reads, preserves source decimals',async()=>{
  const s=store();const [a,b]=await Promise.all([s.value.current(),s.value.current()]);assert.equal(a,b);assert.equal(a.observations[0].source_value,'6750000.000');assert.match(s.urls[1],/&generation=123$/);await s.value.current();assert.equal(s.urls.length,2);
});
test('API fails closed on corrupt bytes and pointers outside the release namespace',async()=>{
  await assert.rejects(store({},Buffer.from('{}')).value.current(),{code:'economic_flow_checksum_failed'});
  await assert.rejects(store({object:'unrelated.json'}).value.current(),{code:'economic_flow_pointer_invalid'});
});
