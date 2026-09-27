import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {EnergyPeriodsSnapshot} from '../../server/energy-periods-snapshot.mjs';
import {TradeStore} from '../../server/trade-store.mjs';

const release='00000000-0000-4000-8000-000000000001';
function fixture() {
  const payload={schema_version:'energy-trade-periods.v1',release_id:release,snapshot_as_of:'2026-09-27T07:00:00Z',
    products:Object.entries({petroleum:'270900',lng:'271111',gas:'271121'}).map(([id,code])=>({id,code,periods:[{frequency:'A',period:'2025',period_start:'2025-01-01',reporting_markets:3,reported_origins:4,observed_value_usd:123,observed_net_weight_kg:null}]}))};
  const body=Buffer.from(JSON.stringify(payload));
  return {payload,body,pointer:{schema_version:'1.0.0',release_id:release,bucket:'czbudget-janrezab-public-snapshots',object:`static-assets/energy-trade-periods/releases/${release}/periods.json`,sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:body.length}};
}

test('energy published release bypasses warehouse queries and coalesces callers',async()=>{
  const f=fixture();let requests=0;
  const snapshot=new EnergyPeriodsSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>{requests++;return new Response(url.includes('current.json')?JSON.stringify(f.pointer):f.body);}});
  const store=new TradeStore({energyPeriodsSource:snapshot});
  store.query=async()=>{throw new Error('No warehouse scan permitted');};
  const [first,second]=await Promise.all([store.energyPeriods(),store.energyPeriods()]);
  assert.deepEqual(first,f.payload);assert.equal(first,second);assert.equal(requests,2);
  assert.equal(await store.energyPeriods(),first);assert.equal(requests,2);
});

test('missing pointer allows the bounded legacy path; corrupt release cannot trigger a scan',async()=>{
  const missing=new EnergyPeriodsSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async()=>new Response('',{status:404})});
  assert.equal(await missing.current(),null);
  const f=fixture();f.pointer.sha256='b'.repeat(64);
  const corrupt=new EnergyPeriodsSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>new Response(url.includes('current.json')?JSON.stringify(f.pointer):f.body)});
  const store=new TradeStore({energyPeriodsSource:corrupt});let scans=0;store.query=async()=>{scans++;return [];};
  await assert.rejects(()=>store.energyPeriods(),{code:'energy_periods_snapshot_unavailable'});
  assert.equal(scans,0);
});

test('invalid new pointer preserves the previous verified release',async()=>{
  const f=fixture();let now=0;let invalid=false;
  const snapshot=new EnergyPeriodsSnapshot({now:()=>now,tokenProvider:async()=>'fixture',fetchImpl:async url=>new Response(url.includes('current.json')?JSON.stringify(invalid?{...f.pointer,object:'../escape'}:f.pointer):f.body)});
  const previous=await snapshot.current();now=60_001;invalid=true;
  assert.equal(await snapshot.current(),previous);
});

test('payload rejects merged frequencies, nonfinite totals and duplicate product identities',async()=>{
  for(const mutation of [p=>p.products[0].periods[0].frequency='A+M',p=>p.products[0].periods[0].observed_value_usd=null,p=>p.products[1].id='petroleum']) {
    const f=fixture();mutation(f.payload);f.body=Buffer.from(JSON.stringify(f.payload));f.pointer.bytes=f.body.length;f.pointer.sha256=crypto.createHash('sha256').update(f.body).digest('hex');
    const snapshot=new EnergyPeriodsSnapshot({tokenProvider:async()=>'fixture',fetchImpl:async url=>new Response(url.includes('current.json')?JSON.stringify(f.pointer):f.body)});
    await assert.rejects(()=>snapshot.current());
  }
});
