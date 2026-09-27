import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {HumanDevelopmentError, HumanDevelopmentStore, validateHumanDevelopment} from '../../server/human-development-store.mjs';
const release='569ea124-a61b-4616-ac86-9061ea684998';
const fixture=()=>({schema_version:'1.0.0',release_id:release,generated_at:'2026-09-27T00:00:00Z',source_releases:['synthetic'],geographies:[{code:'CZE',name:'Synthetic country'}],chapters:[{id:'development',title:{en:'Development',cs:'Rozvoj'}}],charts:[{id:'development-index',chapter:'development',title:{en:'Synthetic index',cs:'Testovací index'},unit:'index',chart_type:'line',status:'ready',rows:[{country:'CZE',year:2023,value:0},{country:'CZE',year:2024,value:null}],fields:[{key:'value',label:{en:'Index',cs:'Index'}}],source_refs:[{url:'https://example.org/synthetic',vintage:'synthetic',table:'synthetic',release_id:'synthetic'}],method:'Synthetic fixture',denominator:'Synthetic fixture only',latest_period:2023,original_refs:[]}],coverage:{source_count:1,unavailable_sources:[],original_figures:1}});
function store(payload=fixture(), mutation={}) {
  const bytes=Buffer.from(JSON.stringify(payload));
  const pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',release_id:release,object:`static-assets/human-development/releases/${release}/reports.json`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...mutation};
  let requests=0;
  const instance=new HumanDevelopmentStore({token:async()=> 'synthetic',fetchImpl:async url=>{requests++;return new Response(url.includes('current.json')?JSON.stringify(pointer):bytes);}});
  return {instance,requests:()=>requests};
}
test('only serves a hash-verified matching release and shares concurrent/cache reads',async()=>{
  const {instance,requests}=store();const [a,b]=await Promise.all([instance.current(),instance.current()]);
  assert.equal(a,b);assert.equal(a.release_id,release);assert.equal(requests(),2);assert.equal(await instance.current(),a);
  assert.equal(a.charts[0].rows[0].value,0);assert.equal(a.charts[0].rows[1].value,null);
});
test('rejects a checksum mismatch and a pointer outside its immutable prefix',async()=>{
  for(const change of [{sha256:'0'.repeat(64)},{object:'static-assets/other/reports.json'}]) {
    await assert.rejects(store(fixture(),change).instance.current(),error=>error instanceof HumanDevelopmentError);
  }
});
test('rejects release mismatch, invalid country, missing source and numeric coercion',()=>{
  for(const change of [p=>{p.release_id='another-release';},p=>{p.charts[0].rows[0].country='unlisted';},p=>{p.charts[0].source_refs=[];},p=>{p.charts[0].rows[0].value='0';}]) {
    const p=fixture();change(p);assert.throws(()=>validateHumanDevelopment(p,release),HumanDevelopmentError);
  }
});
test('withdrawn and unavailable objects remain explicit without fabricated rows',()=>{
  const p=fixture();p.charts[0]={...p.charts[0],status:'withdrawn',rows:[],source_refs:[]};
  assert.equal(validateHumanDevelopment(p,release).charts[0].status,'withdrawn');
});
test('does not cache failures: a missing publication returns a retryable status',async()=>{
  let requests=0;const instance=new HumanDevelopmentStore({token:async()=> 'synthetic',fetchImpl:async()=>{requests++;return new Response('',{status:404});}});
  for(let i=0;i<2;i++)await assert.rejects(instance.current(),error=>error.status===503);
  assert.equal(requests,2);
});
test('rejects unknown geography, overlapping and unbounded declared missing ranges',()=>{
  for(const ranges of [{unlisted:[{start:2020,end:2021}]},{CZE:[{start:2020,end:2022},{start:2022,end:2023}]},{CZE:[{start:1,end:10000}]}]){
    const p=fixture();p.charts[0].missing_periods_by_country=ranges;
    assert.throws(()=>validateHumanDevelopment(p,release),HumanDevelopmentError);
  }
  const p=fixture();p.charts[0].missing_periods_by_country={CZE:[{start:2020,end:2021}]};
  assert.equal(validateHumanDevelopment(p,release),p);
});
test('validates restored defaults and rejects invalid coordinate defaults',()=>{
  const p=fixture();p.charts[0].rows=[{value:0}];p.charts[0].row_defaults={country:'CZE',year:2023};
  assert.equal(validateHumanDevelopment(p,release),p);
  for(const defaults of [{country:'unlisted',year:2023},{country:'CZE',year:'2023'},{country:'CZE',value:1,year:2023},[]]){
    p.charts[0].row_defaults=defaults;
    assert.throws(()=>validateHumanDevelopment(p,release),HumanDevelopmentError);
  }
});
test('validates declared tuple rows and rejects malformed columns or values',()=>{
  const p=fixture();p.charts[0].row_columns=['country','year','value'];p.charts[0].rows=[['CZE',2023,0],['CZE',2024,null]];
  assert.equal(validateHumanDevelopment(p,release),p);
  for(const [columns,rows] of [[['country','year','value'],[['CZE',2023]]],[['country','value','value'],[['CZE',0,0]]],[['country','year','value'],[['CZE',2023,'0']]],[['country','year','value'],[['unlisted',2023,0]]],[['country','year','extra'],[['CZE',2023,0]]]]){
    p.charts[0].row_columns=columns;p.charts[0].rows=rows;
    assert.throws(()=>validateHumanDevelopment(p,release),HumanDevelopmentError);
  }
});
