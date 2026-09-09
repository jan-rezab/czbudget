import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root='data/paq/';
const index=JSON.parse(fs.readFileSync(root+'index.json'));
const audit=JSON.parse(fs.readFileSync(root+'coverage-audit.json'));
assert.equal(audit.expected,audit.received);assert.deepEqual(audit.missing,[]);
const catalog=JSON.parse(gunzipSync(fs.readFileSync(root+'catalog.json.gz')));
assert.equal(Object.keys(catalog.variables).length,index.variables);
assert.equal(Object.keys(catalog.fields).length,index.fields);
const seen=new Set(), totals={}, usedFields=new Set();let cells=0,nonNull=0;
for(const file of index.files){
  const bytes=fs.readFileSync(root+file.file);
  assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  if(file.file==='catalog.json.gz')continue;
  for(const [key,values] of Object.entries(JSON.parse(gunzipSync(bytes)))){
    assert(!seen.has(key));seen.add(key);const region=index.regions[key];assert(region);assert.equal(region.shard,file.file);
    totals[region.level]=(totals[region.level]||0)+1;
    for(const [id,record] of Object.entries(values)){
      const field=catalog.fields[id];assert(field);assert.equal(field.granularity,region.level);assert(catalog.variables[field.variable_key]);
      assert(Object.hasOwn(record,'value'));assert(record.value===null || typeof record.value!=='number' || Number.isFinite(record.value));
      usedFields.add(id);cells++;if(record.value!==null)nonNull++;
    }
    // Independent, previously sampled source values catch geography/variant confusion.
    if(key==='obec:554791'){
      const find=(variable,type,period)=>Object.entries(values).find(([id])=>{const f=catalog.fields[id];return f.variable_key===variable&&f.values_type_key===type&&f.period_key===period;})?.[1].value;
      assert.equal(find('suma_vyplacene_prispevky_na_bydleni','hodnoty','2025'),328104184);
      assert.equal(find('suma_vyplacene_prispevky_na_peci','hodnoty','2025'),711495480);
      assert.equal(region.ico,'00075370');
    }
  }
}
assert.equal(cells,index.observations);assert.equal(nonNull,index.non_null_observations);assert.deepEqual(totals,index.region_counts);
assert.equal(usedFields.size,index.fields);
const links=JSON.parse(fs.readFileSync(root+'links.json'));
for(const key of Object.values(links))assert(index.regions[key]?.shard);
assert.equal(links['/cz/municipalities/plzen/'],'obec:554791');
assert.equal(links['/cz/kraje/plzensky-kraj/'],'kraj:3042');
const panels=JSON.parse(fs.readFileSync(root+'panels.json'));
assert.equal(panels.unavailable.length,0);
for(const chart of panels.charts){
  assert.equal(chart.geography,'stat:CZ');const data=chart.data;
  for(const record of [data.total,...(data.groups||[]).flatMap(g=>g.data)]){
    assert.equal(record.lines.length,data.titles.length);
    for(const series of record.lines)assert.equal(series.length,data.ticks.length);
  }
}
console.log(JSON.stringify({variables:index.variables,fields:index.fields,regions:seen.size,observations:cells,reported:nonNull,panel_charts:panels.charts.length}));
