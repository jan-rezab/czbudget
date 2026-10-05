import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DemographyStore} from '../../server/demography-store.mjs';
const payload={schema_version:'worldwide-demography-story.v1',release_id:'7c4803a6-426e-4fb5-9e47-74b61117d29d',warehouse_release_id:'0b7239dd-8ca1-4ea8-93e6-a5c7632ed167',years:Array.from({length:65},(_,i)=>1960+i),countries:Object.fromEntries(Array.from({length:217},(_,i)=>['C'+i,{fertility:Array(65).fill(null),birth_rate:Array(65).fill('1.3600')}]))};
const body=Buffer.from(JSON.stringify(payload));
const pointer={schema_version:'1.0.0',bucket:'czbudget-janrezab-public-snapshots',object:'static-assets/worldwide-demography/releases/7c4803a6-426e-4fb5-9e47-74b61117d29d/demography.json',generation:'123',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),release_id:'7c4803a6-426e-4fb5-9e47-74b61117d29d',warehouse_release_id:'0b7239dd-8ca1-4ea8-93e6-a5c7632ed167'};
function store(ref=pointer,bytes=body){let calls=0;const urls=[];return {urls,get calls(){return calls;},value:new DemographyStore({token:async()=>'fixture',fetchImpl:async url=>{calls++;urls.push(url);return new Response(url.includes('current.json')?JSON.stringify(ref):bytes);}})};}
test('generation-pinned, verified snapshot retains source precision and nulls; concurrent loads coalesce',async()=>{const s=store();const [a,b]=await Promise.all([s.value.current(),s.value.current()]);assert.equal(a,b);assert.equal(a.countries.C0.fertility[0],null);assert.equal(a.countries.C0.birth_rate[0],'1.3600');assert.ok(s.urls[1].endsWith('&generation=123'));await s.value.current();assert.equal(s.calls,2);});
test('corrupt bytes and foreign pointers fail closed',async()=>{await assert.rejects(store(pointer,Buffer.from('{}')).value.current(),{code:'demography_checksum_failed'});await assert.rejects(store({...pointer,object:'other.json'}).value.current(),{code:'demography_pointer_invalid'});});
