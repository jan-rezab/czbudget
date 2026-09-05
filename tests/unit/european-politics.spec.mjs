import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../../data/european-politics.v1.json',import.meta.url)));
const fiscal=JSON.parse(fs.readFileSync(new URL('../../lib/data/sovereign-benchmark.v1.json',import.meta.url)));
test('all original benchmark countries have uninterrupted dated coverage and source-backed programs',()=>{
 assert.deepEqual(new Set(data.countries.map(c=>c.code)),new Set(['CZE','UKR','POL','DEU','GBR','FRA','USA','CHE','SWE','DNK']));
 const ids=new Set();
 for(const c of data.countries){
  assert(c.terms[0].start<='2015-01-01');assert.equal(c.terms.at(-1).end,null);
  for(const [i,g] of c.terms.entries()){
   assert(!ids.has(g.id));ids.add(g.id);
   if(i)assert.equal(c.terms[i-1].end,g.start);
   if(g.end)assert(g.start<g.end);
   if(g.program_id){const d=data.documents[g.program_id];assert(d);assert.equal(new URL(d.url).protocol,'https:');assert(d.published_on<=data.as_of);assert(d.summary_en.length&&d.summary_cs.length);}
   else {assert.equal(g.id,'fra-2024-12-13');assert.match(g.note_en,/January 2025/);}
  }
 }
});
test('economic observations preserve benchmark values and statuses, including the Ukrainian war shock',()=>{
 for(const c of data.countries){
  assert.equal(c.observations.length,10);
  const original=fiscal.series.find(x=>x.country_code===c.code);
  for(const row of c.observations){
   for(const key of ['nominal_gdp_usd_bn','gross_debt_pct_gdp','real_gdp_growth_pct']){
    const source=original.metrics[key].values.find(o=>o.year===row.year);
    assert.equal(row[key],source.value);assert.equal(row[`${key}_status`],source.status);
   }
   assert(Math.abs(row.gross_debt_usd_bn-row.nominal_gdp_usd_bn*row.gross_debt_pct_gdp/100)<1e-8);
  }
 }
 assert(data.countries.find(c=>c.code==='UKR').observations.find(o=>o.year===2022).real_gdp_growth_pct < -20);
});
test('short tenures and constitutional distinctions remain explicit',()=>{
 const uk=data.countries.find(c=>c.code==='GBR').terms.find(g=>g.leader==='Liz Truss');
 assert.equal((Date.parse(uk.end)-Date.parse(uk.start))/86400000,49);
 assert.match(data.countries.find(c=>c.code==='CHE').note_en,/collectively/);
 assert.match(data.countries.find(c=>c.code==='USA').note_en,/Congress/);
 assert.match(data.countries.find(c=>c.code==='UKR').terms.at(-1).note_en,/did not approve/);
});
test('every benchmark country has an extracted party program and reviewed source evidence',()=>{
 const manifests=Object.values(data.crawl.sources).filter(s=>s.kind==='party_manifesto');
 assert.equal(manifests.length,10);
 assert.deepEqual(new Set(manifests.map(s=>s.country)),new Set(data.country_order));
 for(const source of manifests){assert.equal(source.status,'extracted');assert.match(source.sha256,/^[a-f0-9]{64}$/);assert(source.characters>1000);}
 for(const c of data.countries){
  const promises=data.promise_review.promises.filter(p=>p.country===c.code);assert(promises.length);
  for(const p of promises){
   assert.equal(p.source_sha256,data.crawl.sources[p.source_id].sha256);assert(p.quote&&p.title_en&&p.title_cs);assert(p.observed_on<=data.as_of);
   assert(p.government_ids.every(id=>c.terms.some(g=>g.id===id)));
   for(const e of p.evidence){assert.equal(e.source_sha256,data.crawl.sources[e.source_id].sha256);assert.equal(data.crawl.sources[e.source_id].status,'extracted');}
  }
 }
});
test('future, incomparable, qualitative and reversed promises cannot silently become achieved scores',()=>{
 const promises=data.promise_review.promises,p=id=>promises.find(p=>p.id===id);
 assert.equal(p('dnk-welfare-envelope').actual,null);assert(p('dnk-welfare-envelope').deadline>data.as_of);assert.equal(p('dnk-welfare-envelope').status,'not_due');
 assert.equal(p('ukr-defence-floor').comparison,'context');assert.equal(p('ukr-defence-floor').status,'scope_mismatch');
 assert.equal(p('che-vat-position').status,'position_only');
 assert.equal(p('deu-wealth-tax').actual,null);
 assert.equal(p('gbr-ni-freeze').status,'breached_reversed');assert.deepEqual(p('gbr-ni-freeze').history.map(o=>o.value),[1.25,0]);
 assert.equal(p('usa-corporation-tax').operator,'gt');assert.equal(p('usa-corporation-tax').status,'not_implemented');
 for(const item of promises.filter(p=>p.status==='implemented')){assert.equal(item.comparison,'matched');assert.equal(item.target,item.actual);assert(item.evidence.length);}
});
test('every individual leader has a self-contained portrait and attribution',()=>{
 for(const c of data.countries.filter(c=>c.code!=='CHE'))for(const g of c.terms){const p=data.portraits[g.leader.replace(/ [IV]+$/,'')];assert(p);assert(p.author&&p.license&&p.source);assert.match(p.data_uri,/^data:image\/jpeg;base64,/);}
});
