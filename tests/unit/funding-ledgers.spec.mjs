import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLedgers,missingLedger,ledgerRows,ledgerSources} from '../../lib/funding-ledgers.mjs';
const read=f=>JSON.parse(readFileSync(new URL('../../data/'+f,import.meta.url)));
const input={education:read('education-deep-dive.v1.json'),healthInsurers:read('cz-health-insurers-2024.json'),health:read('country-health.v1.json')};
const graphs=createLedgers(input);
const get=id=>graphs.find(g=>g.id===id);
const sum=(edges,key,id)=>edges.filter(e=>e[key]===id).reduce((s,e)=>s+(e.value??0),0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
test('every graph has auditable numbers and bilingual labels, including missing routes',()=>{
 assert.equal(graphs.length,16);
 for(const g of graphs.concat(['school','health','pension','social'].map(t=>missingLedger('RUS',t)))){
  const ids=new Set(g.nodes.map(n=>n.id));assert.equal(ids.size,g.nodes.length);
  for(const s of g.sourceIds)assert.ok(ledgerSources[s]?.url.startsWith('https://'));
  for(const text of [g.title,g.note,...g.nodes.flatMap(n=>[n.label,n.note]),...g.edges.map(e=>e.label)])for(const lang of ['en','cs'])assert.equal(typeof text[lang],'string');
  for(const e of g.edges){assert.ok(ids.has(e.from)&&ids.has(e.to));assert.ok(e.value===null||Number.isFinite(e.value)&&e.value>=0);assert.ok(g.nodes.find(n=>n.id===e.from).row<g.nodes.find(n=>n.id===e.to).row);if(e.value===null)assert.equal(e.status,'unknown');}
 }
});
test('Czech education consolidates ministry transfers exactly once; residual is not labelled own tax revenue',()=>{
 const g=get('cz-education'),n=Object.fromEntries(g.nodes.map(n=>[n.id,n]));near(n.ministry.value+n.residual.value,g.total);near(sum(g.edges,'to','local'),n.local.value);near(sum(g.edges,'to','delivery'),g.total);near(n.ministry.value+input.education.local.net_czk_bn-g.total,input.education.ministry.education_local_transfers_czk_bn);assert.equal(g.edges.find(e=>e.from==='residual').status,'derived');
});
test('US school revenue and expenditure retain their difference without fabricated cash balancing',()=>{
 const g=get('us-school');near(sum(g.edges,'to','district'),994.9);near(sum(g.edges,'from','district'),983.7);assert.match(g.balance.en,/not|reconciliation/);assert.equal(g.edges.find(e=>e.to==='other').status,'derived');
});
test('French primary-education categories reconcile but remain classifications within the state budget',()=>{
 const g=get('fr-school');near(sum(g.edges,'from','state'),g.total);near(sum(g.edges,'from','staff'),26.590427344);assert.ok(g.edges.every(e=>e.status==='classification'));assert.match(g.note.en,/Municipal.*outside/);
});
test('Czech insurer financing gap balances cash expenditure; missing provider amounts never become zero',()=>{
 const g=get('cz-health');near(sum(g.edges,'to','insurers'),input.healthInsurers.summary.expenditure_mczk/1000);assert.equal(g.edges.find(e=>e.to==='care').value,null);assert.equal(ledgerRows(g,'en',true).find(r=>r.status==='unknown').value,null);
});
test('OASI payments reconcile with income and reserve drawdown, separately from disability insurance',()=>{
 const g=get('us-pension');near(sum(g.edges,'to','fund'),sum(g.edges,'from','fund'));near(sum(g.edges,'from','fund'),g.total);assert.match(g.note.en,/OASI only/);
});
test('Ukraine plans remain distinct from execution and do not become payroll contributions',()=>{
 const g=get('ua-pension');near(sum(g.edges,'to','pfu'),1025.2);near(sum(g.edges,'from','pfu'),1020.9);assert.equal(g.stage,'plan');assert.match(g.note.en,/not all payroll/);for(const id of ['ua-school','ua-health','ua-social']){const p=get(id);assert.equal(p.stage,'plan');assert.equal(p.edges.at(-1).value,null);}
});
test('per-100 conversion uses the declared denominator and preserves source data',()=>{
 const g=get('us-school'),rows=ledgerRows(g,'cs',true);near(rows.filter(r=>r.to.includes('systémů')).reduce((s,r)=>s+r.value,0),100);near(g.edges[0].value,115.1);for(const topic of ['school','health','pension','social'])assert.ok(ledgerRows(missingLedger('RUS',topic),'en',true).every(r=>r.value===null));
});
