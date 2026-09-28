import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {RussiaSuppliersSnapshot} from '../../server/russia-suppliers-snapshot.mjs';
import {RussiaTradeStore,RUSSIA_SUPPLIERS_SQL} from '../../server/russia-trade-store.mjs';

function fixture() {
 const release='00000000-0000-4000-8000-000000000001',prefix=`static-assets/russia-trade-suppliers/releases/${release}/`;
 const products=['TOTAL',...Array.from({length:99},(_,n)=>String(n+1).padStart(2,'0')),'854231','847130','845710','848210'];
 const objects=new Map();
 const store=(object,value)=>{const body=Buffer.from(JSON.stringify(value));objects.set(object,body);return {object,generation:'123',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};};
 const rows=[{period:'2024',reporter_iso3:'DEU',partner_iso3:'KAZ',value_usd:'123.456789012345678',product_count:'2',release_ids:'source-release'}];
 const manifest={schema_version:'russia-trade-suppliers.v1',release_id:release,snapshot_as_of:'2026-09-28T10:00:00Z',products:{}};
 for(const product of products)manifest.products[product]={...store(prefix+product+'.json',{schema_version:'russia-trade-suppliers.product.v1',release_id:release,product,rows}),rows:rows.length};
 const pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',release_id:release,...store(prefix+'manifest.json',manifest)};
 return {objects,pointer,rows};
}

test('verified supplier release avoids the 32 GiB query and pins object generations',async()=>{
 const f=fixture();let requests=0;
 const source=new RussiaSuppliersSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>{
  requests++;const key=decodeURIComponent(new URL(url).pathname.split('/o/')[1]);
  if(key.endsWith('current.json'))return new Response(JSON.stringify(f.pointer));
  assert.equal(new URL(url).searchParams.get('generation'),'123');return new Response(f.objects.get(key));
 }});
 const store=new RussiaTradeStore({suppliersSource:source});
 store.query=async sql=>{assert.notEqual(sql,RUSSIA_SUPPLIERS_SQL);return [];};
 const result=await store.aggregate();assert.equal(result.suppliers[0].reported_value_usd,'123.456789012345678');
 assert.equal(requests,3);assert.deepEqual(await source.rows('TOTAL'),f.rows);assert.equal(requests,3);
});

test('missing and corrupt supplier pointers never trigger a visitor warehouse scan',async()=>{
 const missing=new RussiaSuppliersSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async()=>new Response('',{status:404})});
 let calls=0;const legacy=new RussiaTradeStore({suppliersSource:missing});legacy.query=async(sql,params,options)=>{
  calls++;assert.equal(sql,RUSSIA_SUPPLIERS_SQL);assert.equal(options.maximumBytesBilled,'40000000000');return [];};
 await assert.rejects(legacy.suppliers('TOTAL'),{code:'russia_suppliers_snapshot_unavailable'});assert.equal(calls,0);
 const f=fixture();f.pointer.sha256='b'.repeat(64);
 const corrupt=new RussiaSuppliersSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>new Response(url.includes('current.json')?JSON.stringify(f.pointer):f.objects.get(f.pointer.object))});
 const store=new RussiaTradeStore({suppliersSource:corrupt});store.query=()=>{throw Error('must not scan');};
 await assert.rejects(store.suppliers('TOTAL'),{code:'russia_suppliers_snapshot_unavailable'});
});

test('new corrupt manifest keeps the previous verified release; duplicate rows fail',async()=>{
 const f=fixture();let now=0,invalid=false;
 const source=new RussiaSuppliersSnapshot({now:()=>now,tokenProvider:async()=>'fixture',fetchImpl:async url=>{
  const key=decodeURIComponent(new URL(url).pathname.split('/o/')[1]);
  return new Response(key.endsWith('current.json')?JSON.stringify(invalid?{...f.pointer,object:'../escape'}:f.pointer):f.objects.get(key));
 }});
 const rows=await source.rows('TOTAL');invalid=true;now=60001;assert.equal(await source.rows('TOTAL'),rows);
 const ref=fixture();const productRef=JSON.parse(ref.objects.get(ref.pointer.object)).products.TOTAL;
 const payload=JSON.parse(ref.objects.get(productRef.object));payload.rows.push({...payload.rows[0]});
 const body=Buffer.from(JSON.stringify(payload));ref.objects.set(productRef.object,body);
 const manifest=JSON.parse(ref.objects.get(ref.pointer.object));manifest.products.TOTAL={...productRef,rows:2,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};
 const manifestBody=Buffer.from(JSON.stringify(manifest));ref.objects.set(ref.pointer.object,manifestBody);ref.pointer.bytes=manifestBody.length;ref.pointer.sha256=createHash('sha256').update(manifestBody).digest('hex');
 const duplicate=new RussiaSuppliersSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>{
  const key=decodeURIComponent(new URL(url).pathname.split('/o/')[1]);return new Response(key.endsWith('current.json')?JSON.stringify(ref.pointer):ref.objects.get(key));
 }});
 await assert.rejects(duplicate.rows('TOTAL'),/row_invalid/);
});
