import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url)));
const catalogue = read('state-owned-enterprises.v1.json');
const inventory = read('cz-public-entities-2024.json');
test('Czech catalogue includes every state company from the existing inventory exactly once',()=>{
  const expected = inventory.entities.filter(row=>row.category==='Firma' && row.owner_level==='Stát');
  const actual = catalogue.records.filter(row=>row.country_code==='CZE');
  assert.equal(actual.length,49);
  assert.deepEqual(actual.map(r=>r.ico).sort(),expected.map(r=>r.ico).sort());
  assert.equal(new Set(catalogue.records.map(r=>r.id)).size,catalogue.records.length);
  for(const row of actual.filter(r=>r.inventory_ico)) {
    const source = expected.find(r=>r.ico===row.ico);
    assert.equal(row.source_revenue_m,source.revenue_mczk);
    assert.equal(row.ownership_pct,null);
    assert.match(row.source_url,/^https:\/\//);
  }
  assert.equal(actual.find(r=>r.company==='CENDIS, s.p.').source_revenue_m,null);
});
test('other countries retain their sourced comparison records',()=>{
  for(const code of new Set(catalogue.records.map(r=>r.country_code))) {
    if(code!=='CZE') assert.equal(catalogue.records.filter(r=>r.country_code===code).length,3);
  }
});

test('treemap keeps small revenue tiles at mobile widths', async()=>{
  const {runInNewContext} = await import('node:vm');
  const script = readFileSync(new URL('../../state-owned-enterprises.js',import.meta.url),'utf8');
  const fn = script.slice(script.indexOf('  function layoutBinary('),script.indexOf('  function svgElement('));
  const layout = runInNewContext(`${fn}; layoutBinary`);
  const companies = catalogue.records.filter(r=>r.source_revenue_m>0).map(r=>({id:r.id,value:r.source_revenue_m/catalogue.fx.rates[r.currency]}));
  for (const width of [20,100,300,390,1280]) {
    const tiles = layout(companies,0,0,width,420);
    assert.equal(tiles.length,companies.length);
    assert.ok(tiles.every(t=>Number.isFinite(t.width)&&t.width>0&&Number.isFinite(t.height)&&t.height>0));
  }
});
