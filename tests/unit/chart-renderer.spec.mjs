import { test } from 'node:test';
import assert from 'node:assert/strict';
import charts from '../../lib/chart-renderer.js';

test('signed domains include zero and negative balances', () => {
  const axis = charts.domain([-40, 100, null, NaN]);
  assert.ok(axis.min <= -40 && axis.max >= 100);
  assert.ok(axis.ticks.includes(0));
});
test('null, empty and string values are not invented financial observations', () => {
  const spec = charts.model({ rows: [{ year: 2024, amount: null }, { year: 2025, amount: 0 }, { year: 2026, amount: '5' }], fields: [{ key: 'amount' }] });
  assert.deepEqual(spec.rows.map(row => row.values[0]), [null, 0, null]);
});
test('stacks reject partial or negative compositions', () => {
  const fields = [{ key: 'a' }, { key: 'b' }];
  const { rows } = charts.model({ type: 'stacked', fields, rows: [{ a: 25, b: 75 }, { a: null, b: 75 }, { a: -5, b: 105 }, { a: 0, b: 0 }] });
  assert.deepEqual(rows.map(row => row.shares), [[25, 75], [null, null], [null, null], [null, null]]);
});
test('adapters keep original rows available to currency and provenance formatters', () => {
  const row = { year: 2025, actual: 10, plan: 20, currency: 'CZK' };
  const { rows } = charts.model({ rows: [row], fields: [{ value: r => r.actual * 2 }] });
  assert.equal(rows[0].values[0], 20);
  assert.equal(rows[0].raw, row);
  assert.equal(row.actual, 10);
});
test('empty and single-zero series have usable domains', () => {
  for (const values of [[], [0], [null], [-1]]) {
    const { min, max, ticks } = charts.domain(values);
    assert.ok(max > min); assert.ok(ticks.length >= 2);
  }
});
test('indexed trends can omit zero without collapsing a constant series',()=>{
  const axis=charts.domain([100,100],false);
  assert.ok(axis.min<100 && axis.max>100);
  assert.ok(charts.model({rows:[{year:2025,index:100},{year:2026,index:110}],fields:[{key:'index'}],includeZero:false}).axis.min>0);
});
test('plot, tooltip table and CSV rail share one canonical accessor',()=>{
  const data=charts.model({rows:[{year:2024,revenue:10,expense:null}],fields:[{key:'revenue',label:'Revenue'},{key:'expense',label:'Expenditure'}]});
  assert.deepEqual(data.columns.map(column=>column.key),['label','revenue','expense']);
  assert.deepEqual(data.accessor.rows(),[{label:'2024',revenue:10,expense:null}]);
  assert.equal(data.rows[0].raw.year,2024);
});

test('compact plots preserve accessible country names without a crowded end-label gutter', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: null, querySelector: () => ({}) };
  const stopAfterMarkup = Symbol('capture rendered markup');
  function markup(clientWidth) {
    let html;
    const host = { clientWidth, contains: () => false, classList: { add() {} }, dataset: {}, set innerHTML(value) { html = value; throw stopAfterMarkup; } };
    try {
      charts.render(host, { type: 'line', compact: true, endLabels: true, rows: [{ year: 2020, CZE: 40 }, { year: 2024, CZE: 42.858 }], fields: [{ key: 'CZE', label: 'Czechia' }] });
    } catch (error) { if (error !== stopAfterMarkup) throw error; }
    return html;
  }
  try {
    const mobile = markup(393), desktop = markup(1120);
    assert.doesNotMatch(mobile, /data-end-series=/);
    assert.match(mobile, /aria-label="2024\. Czechia: 42\.858"/);
    assert.match(mobile, /data-series="CZE"/);
    assert.match(desktop, /data-end-series="CZE"/);
    assert.match(desktop, /Czechia/);
  } finally { globalThis.document = originalDocument; }
});
test('absolute stacks use cumulative dollar heights and preserve percentage-stack defaults',()=>{
 const fields=[{key:'a'},{key:'b'}],rows=[{label:'2019',a:200,b:300},{label:'2025',a:500,b:700}];
 const absolute=charts.model({type:'stacked',stackMode:'absolute',fields,rows});
 assert.deepEqual(absolute.rows.map(r=>r.stackValues),[[200,300],[500,700]]);
 assert.ok(absolute.axis.max>=1200);assert.equal(absolute.accessor.rows()[1].b,700);
 assert.equal(charts.model({type:'stacked',fields,rows}).axis.max,100);
});
test('absolute stacks withhold incomplete or negative compositions, but preserve reported zeros',()=>{
 const fields=[{key:'a'},{key:'b'}],rows=[{a:0,b:0},{a:2,b:null},{a:-1,b:3}];
 assert.deepEqual(charts.model({type:'stacked',stackMode:'absolute',fields,rows}).rows.map(r=>r.stackValues),[[0,0],[null,null],[null,null]]);
});

test('donuts use a positive cross-row denominator and withhold partial or negative compositions',()=>{
 const fields=[{key:'delta'}],rows=[{label:'Vehicles',delta:30},{label:'Machinery',delta:70}];
 assert.deepEqual(charts.model({type:'donut',fields,rows}).rows.map(r=>r.shares),[[30],[70]]);
 for(const bad of [null,-1])assert.deepEqual(charts.model({type:'donut',fields,rows:[rows[0],{delta:bad}]}).rows.map(r=>r.shares),[[null],[null]]);
 assert.throws(()=>charts.model({type:'donut',fields:[...fields,{key:'other'}],rows}),/one nonnegative/);
});
test('exact story table columns retain source decimal text without changing plot coordinates',()=>{
 const row={label:'Machinery',delta:50,deltaExact:'50.000000001',baseExact:'100.000000001'};
 const data=charts.model({type:'donut',fields:[{key:'delta'}],rows:[row],tableColumns:[{key:'label'},{key:'baseExact'},{key:'deltaExact'}]});assert.equal(data.rows[0].values[0],50);assert.deepEqual(data.accessor.rows(),[{label:'Machinery',baseExact:'100.000000001',deltaExact:'50.000000001'}]);
});


test('donut markup preserves a single full-circle observation and rejects incomplete geometry',()=>{
 const originalDocument=globalThis.document;globalThis.document={activeElement:null};const stop=Symbol('markup');
 function capture(rows){let html;const host={clientWidth:393,contains:()=>false,classList:{add(){}},dataset:{},set innerHTML(v){html=v;throw stop;}};try{charts.render(host,{type:'donut',rows,fields:[{key:'delta',format:(v,r)=>r.deltaExact+' USD'}],title:'Growing categories',shareFormat:(v,r)=>r.share+'%'});}catch(e){if(e!==stop)throw e;}return html;}
 try{const single=capture([{label:'Mineral fuels',delta:50,deltaExact:'50.000000001',share:'100'}]);assert.match(single,/aria-label="Mineral fuels: 50\.000000001 USD \(100%\)"/);assert.match(single,/class="psd-donut-slice"/);assert.doesNotMatch(single,/NaN|Infinity/);const missing=capture([{label:'Missing',delta:null}]);assert.doesNotMatch(missing,/class="psd-donut-slice"/);assert.match(missing,/No complete positive composition/);}finally{globalThis.document=originalDocument;}
});
