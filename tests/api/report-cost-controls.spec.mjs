import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ReportSnapshots,REPORT_PREFIX,reportKey} from '../../server/report-snapshots.mjs';
import {TradeStore} from '../../server/trade-store.mjs';
import {RussiaTradeStore} from '../../server/russia-trade-store.mjs';
import {CostGate} from '../../server/cost-gate.mjs';
import {QueryAdmission} from '../../server/query-admission.mjs';

test('published trade and Russia results never submit BigQuery requests, including missing coverage',async()=>{
 const keys=[];const source={manifest:{release_id:'fixed',snapshot_as_of:'2026-09-28T10:00:00Z'},rows:async key=>{keys.push(key);return [];}};
 const noNetwork=()=>{throw Error('Visitor attempted warehouse access');};
 const trade=new TradeStore({reportsSource:source,fetchImpl:noNetwork});
 assert.deepEqual((await trade.countries()).countries,[]);
 await assert.rejects(trade.energyFlows('gas','M','202601'),{code:'energy_trade_not_found'});
 const russia=new RussiaTradeStore({reportsSource:source,fetchImpl:noNetwork,suppliersSource:{rows:async()=>[]}});
 const result=await russia.aggregate('M','85');assert.deepEqual(result.observations,[]);assert.equal(result.source.published_release,'fixed');
 assert.deepEqual(keys,[['countries'],['energy','271121','M','202601'],['russia-aggregate','M','85'],['areas']]);
});

test('verified report reader pins generations, coalesces callers and rejects corruption',async()=>{
 const release='00000000-0000-4000-8000-000000000001',key=reportKey(['countries']);const objects=new Map();
 const add=(object,payload)=>{const body=Buffer.from(JSON.stringify(payload));objects.set(object,body);return {object,generation:'42',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};};
 const ref={...add(`${REPORT_PREFIX}releases/${release}/${key}.json`,{schema_version:'trade-report-rows.v1',release_id:release,key,rows:[{reporter_iso3:'CZE'}]}),rows:1};
 const pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',release_id:release,...add(`${REPORT_PREFIX}releases/${release}/manifest.json`,{schema_version:'trade-reports.v1',release_id:release,snapshot_as_of:'2026-09-28T10:00:00Z',results:{[key]:ref}})};
 let requests=0;const fetchImpl=async url=>{requests++;const parsed=new URL(url),object=decodeURIComponent(parsed.pathname.split('/o/')[1]);if(object.endsWith('current.json'))return Response.json(pointer);assert.equal(parsed.searchParams.get('generation'),'42');return new Response(objects.get(object));};
 const source=new ReportSnapshots({fetchImpl,tokenProvider:async()=>'fixture'});
 const values=await Promise.all([source.rows(['countries']),source.rows(['countries'])]);assert.deepEqual(values[0],[{reporter_iso3:'CZE'}]);assert.equal(requests,3);
 assert.deepEqual(await source.rows(['missing']),[]);
 objects.set(ref.object,Buffer.from('corrupt'));const corrupt=new ReportSnapshots({fetchImpl,tokenProvider:async()=>'fixture'});
 await assert.rejects(corrupt.rows(['countries']),/checksum/);
});

test('project cutoff is shared and fails closed on missing, stale or malformed monitoring',async()=>{
 let now=Date.parse('2026-09-28T12:00:00Z'),calls=0;
 const state={schema_version:'project-cost-control.v1',project:'czbudget-janrezab',currency:'CZK',month_limit:10000,day_limit:2000,checked_at:new Date(now).toISOString(),paused:false};
 const gate=new CostGate({enabled:true,now:()=>now,tokenProvider:async()=>'fixture',fetchImpl:async()=>{calls++;return Response.json(state);}});
 assert.equal((await gate.status()).paused,false);await gate.status();assert.equal(calls,1);
 now+=31000;state.paused=true;assert.equal((await gate.status()).paused,true);
 now+=31*60*1000;assert.equal((await gate.status()).reason,'cost_monitor_unavailable');
 const missing=new CostGate({enabled:true,tokenProvider:async()=>'fixture',fetchImpl:async()=>new Response('',{status:404})});assert.equal((await missing.status()).paused,true);
});

test('concurrent server instances reserve query costs atomically and refund only verified billed bytes',async()=>{
 const now=new Date('2026-09-28T12:00:00Z');let ledger=null,generation=0;
 const state={enforced:true,paused:false,currency:'CZK',checked_at:now.toISOString(),month_amount:0,day_amount:1999.8};
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);
  if(raw.includes('current.json'))return Response.json(state);
  if(url.searchParams.get('uploadType')){
   if(url.searchParams.get('ifGenerationMatch')!==String(generation))return new Response('',{status:412});
   ledger=JSON.parse(options.body);generation++;return Response.json({generation:String(generation)});
  }
  if(!ledger)return new Response('',{status:404});
  return Response.json(url.searchParams.get('alt')==='media'?structuredClone(ledger):{generation:String(generation)});
 };
 const first=new QueryAdmission({fetchImpl,now:()=>now}),second=new QueryAdmission({fetchImpl,now:()=>now});
 const results=await Promise.allSettled([first.reserve('Bearer fixture',1024**3),second.reserve('Bearer fixture',1024**3)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.ok(state.day_amount+ledger.day_reserved<=2000);
 const reservation=results.find(r=>r.status==='fulfilled').value;
 await first.settle(reservation,10485760);assert.ok(ledger.day_reserved<.002);assert.equal(Object.keys(ledger.active).length,0);
 const settled=ledger.month_reserved;await first.settle(reservation,0);assert.equal(ledger.month_reserved,settled);
});
