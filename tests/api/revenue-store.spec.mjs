import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {RevenueError, RevenueStore} from '../../server/revenue-store.mjs';

const release = '569ea124-a61b-4616-ac86-9061ea684998';
const object = `processing-runs/revenue-serving/releases/${release}/revenue.json`;
const body = Buffer.from(JSON.stringify({schema_version:'1.0.0',release_id:release,countries:{CZE:{}},availability:{countries:{CZE:{eligible:true}}}}));
const pointer = {schema_version:'1.0.0',bucket:'czbudget-janrezab-data-layers',object,release_id:release,country_count:1,generation:"123",bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')};

function store(pointerValue=pointer, bodyValue=body) {
  let requests=0;
  const instance=new RevenueStore({token:async()=> 'test-token',ttlMs:60_000,fetchImpl:async url=>{
    requests++;
    const bytes=url.includes('current.json')?Buffer.from(JSON.stringify(pointerValue)):bodyValue;
    return new Response(bytes,{status:200});
  }});
  return {instance,requests:()=>requests};
}

test('reads one pointed release, checks its hash and caches the verified payload',async()=>{
  const {instance,requests}=store();
  const result=await instance.current();
  assert.equal(result.release_id,release);
  assert.deepEqual(Object.keys(result.countries),['CZE']);
  assert.equal(await instance.current(),result);
  assert.equal(requests(),2);
});

test('rejects a changed release body before serving it',async()=>{
  const {instance}=store(pointer,Buffer.from(body.toString('utf8')+' '));
  await assert.rejects(instance.current(),error=>error instanceof RevenueError&&error.code==='revenue_checksum_failed');
});

test('rejects a pointer outside the data publication prefix',async()=>{
  const {instance}=store({...pointer,object:'static-assets/other/data.json'});
  await assert.rejects(instance.current(),error=>error instanceof RevenueError&&error.code==='revenue_pointer_invalid');
});
