import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarks,vat,countries,socialRoutes,sources,deltaFromCzech,countryCode} from '../../lib/funding-deep-dive.mjs';

test('deltas compare the same year, preserve zero, and never turn gaps into observations',()=>{
  assert.equal(deltaFromCzech({value:0,year:2020},{value:27.7,year:2020}),-27.7);
  assert.equal(deltaFromCzech({value:79.1,year:2020},{value:49.3,year:2019}),null);
  assert.equal(deltaFromCzech({value:null,year:2020},{value:27.7,year:2020}),null);
  assert.equal(deltaFromCzech({value:10,year:2020},{value:null,year:2020}),null);
  assert.equal(deltaFromCzech(benchmarks[0].rows[1],benchmarks[0].rows[0]),12);
});
test('observations retain scope, dates and sources across all five countries',()=>{
  assert.equal(benchmarks.find(b=>b.id==='pensions').denominator,'gdp');
  assert.equal(benchmarks.find(b=>b.id==='social').denominator,'government_category');
  for(const b of benchmarks){
    assert.deepEqual(b.rows.map(r=>r.code),countries.map(c=>c.code));
    for(const r of b.rows){
      if(r.value===null){assert.equal(r.source,null);continue;}
      assert.ok(Number.isFinite(r.value)&&r.value>=0&&r.value<=100);
      assert.ok(Number.isInteger(r.year));assert.ok(sources[r.source]?.url.startsWith('https://'));
    }
    assert.equal(b.rows.find(r=>r.code==='RUS').value,null);
  }
});
test('Czech VAT allocations reconcile and remain a separate revenue example',()=>{
  assert.ok(Math.abs(vat.reduce((s,r)=>s+r.value,0)-100)<1e-9);
  assert.deepEqual(vat.map(r=>r.value),[63.84,10.23,25.93]);
});
test('every pension and social route is bilingual and evidence-linked',()=>{
  for(const c of countries)for(const topic of ['pensions','social'])for(const r of socialRoutes[c.code][topic]){
    for(const label of [r.label,r.note,...r.nodes])for(const lang of ['en','cs'])assert.ok(label[lang]?.trim());
    for(const id of r.sources)assert.ok(sources[id]?.url);
    if(c.code==='RUS')assert.equal(r.partial,true);
  }
});
test('country URLs accept the report convention and legacy links, with safe fallbacks',()=>{
  assert.equal(countryCode('?code=FRA'),'FRA');assert.equal(countryCode('?country=UKR'),'UKR');
  assert.equal(countryCode('?code=invalid'),'CZE');assert.equal(countryCode('?code=USA&country=CZE'),'USA');
});
