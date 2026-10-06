import test from 'node:test';
import assert from 'node:assert/strict';
import charts from '../../lib/chart-renderer.js';
import {METRICS} from '../../lib/economic-flow-model.mjs';
import {CIRCUIT_NODES,CIRCUIT_FLOWS,CIRCUIT_JOURNEYS,circuitView,paymentIllustration} from '../../lib/economic-circuit-model.mjs';

test('schematic connections resolve participants and account definitions without invented amounts',()=>{
  const nodes=new Set(CIRCUIT_NODES.map(n=>n.id)),metrics=new Set(METRICS.map(m=>m.id));
  for(const flow of CIRCUIT_FLOWS){assert.ok(nodes.has(flow.from)&&nodes.has(flow.to));assert.equal('value' in flow,false);assert.ok(flow.description.en&&flow.description.cs);for(const id of flow.metrics)assert.ok(metrics.has(id),id);}
  for(const node of CIRCUIT_NODES)for(const id of node.metrics)assert.ok(metrics.has(id),id);
  for(const journey of CIRCUIT_JOURNEYS)for(const id of journey.steps)assert.ok(CIRCUIT_FLOWS.some(f=>f.id===id));
});
test('filter and participant selection retain the complete graph while highlighting relevant connections',()=>{
  const external=circuitView({layer:'external'});assert.equal(external.edges.length,CIRCUIT_FLOWS.length);
  assert.ok(external.edges.every(e=>e.active===(e.layer==='external')));
  const banks=circuitView({node:'banks'});assert.ok(banks.edges.every(e=>e.active===(e.from==='banks'||e.to==='banks')));
  assert.ok(banks.nodes.find(n=>n.id==='banks').selected);
});
test('guided lending path ends at repayment and bounds a stale bookmarked step',()=>{
  const view=circuitView({journey:'loan',step:999});assert.equal(view.selectedEdge,'repayment');assert.equal(view.edges.filter(e=>e.active).length,1);
  assert.equal(circuitView({journey:'loan',step:-10}).selectedEdge,'business-loans');
});
test('repeated payments change turnover without inventing money or GDP',()=>{
  assert.equal(paymentIllustration(1).stock,paymentIllustration(12).stock);
  assert.equal(paymentIllustration(12).payments,1200);assert.equal(paymentIllustration(12).gdp,null);
  assert.equal(paymentIllustration(-1).turns,1);assert.equal(paymentIllustration(100).turns,12);
});
test('circuit geometry is finite, deterministic and keeps reverse transfers distinct',()=>{
  const spec={nodes:CIRCUIT_NODES,edges:CIRCUIT_FLOWS},layout=charts.circuitLayout(spec);
  assert.deepEqual(layout,charts.circuitLayout(spec));
  for(const edge of layout.edges){assert.doesNotMatch(edge.path,/NaN|Infinity/);assert.ok(edge.midpoint.every(Number.isFinite));}
  const flow=id=>layout.edges.find(e=>e.id===id);
  assert.notEqual(flow('exports').path,flow('imports').path);
  assert.match(flow('inputs').path,/ C/);
  assert.throws(()=>charts.circuitLayout({nodes:CIRCUIT_NODES,edges:[{from:'missing',to:'banks'}]}),/endpoint/);
});
