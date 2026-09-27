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

test('treemap tiles conserve area and preserve the exact positive proportions', () => {
  const rows=[{label:'Transport',value:55},{label:'Schools',value:30},{label:'Housing',value:10},{label:'Other',value:5}];
  for(const [width,height] of [[1000,500],[320,440],[1,1]]) {
    const result=charts.treemapLayout(rows,{width,height});
    assert.equal(result.total,100); assert.equal(result.unsized.length,0);
    const area=result.tiles.reduce((sum,tile)=>sum+tile.width*tile.height,0);
    assert.ok(Math.abs(area-width*height)<1e-8);
    for(const tile of result.tiles) {
      assert.equal(tile.row,rows[tile.index]);
      assert.ok(Math.abs(tile.width*tile.height/(width*height)-tile.value/100)<1e-12);
      assert.ok(tile.x>=0&&tile.y>=0&&tile.x+tile.width<=width+1e-10&&tile.y+tile.height<=height+1e-10);
    }
    for(const [i,a] of result.tiles.entries())for(const b of result.tiles.slice(i+1)) {
      const overlapWidth=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
      const overlapHeight=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
      assert.ok(overlapWidth*overlapHeight<1e-8);
    }
  }
});

test('treemap preserves signed, zero and missing rows outside the positive area encoding', () => {
  const rows=[{label:'Spend',value:40},{label:'Correction',value:-5},{label:'Reported zero',value:0},{label:'Missing',value:null},{label:'Not numeric',value:'15'}];
  const result=charts.treemapLayout(rows,{width:600,height:300});
  assert.equal(result.tiles.length,1);assert.equal(result.total,40);
  assert.deepEqual(result.unsized.map(row=>[row.index,row.value,row.reason]),[[1,-5,'negative'],[2,0,'zero'],[3,null,'missing'],[4,null,'missing']]);
  assert.equal(result.unsized[0].row,rows[1]);
  const data=charts.model({type:'treemap',rows,fields:[{key:'value',label:'CZK'}]});
  assert.deepEqual(data.accessor.rows().map(row=>row.value),[40,-5,0,null,null]);
});

test('treemap layout is deterministic, supports value accessors, and never mutates input rows', () => {
  const rows=Object.freeze([Object.freeze({label:'First',amount:5}),Object.freeze({label:'Second',amount:5}),Object.freeze({label:'Third',amount:20})]);
  const options={width:700,height:400,value:row=>row.amount};
  assert.deepEqual(charts.treemapLayout(rows,options),charts.treemapLayout(rows,options));
  assert.deepEqual(charts.treemapLayout(rows,options).tiles.map(tile=>tile.index),[2,0,1]);
  assert.deepEqual(charts.treemapLayout([]).tiles,[]);
  assert.deepEqual(charts.treemapLayout([{value:0},{value:null},{value:-4}]).tiles,[]);
});

test('treemap markup exposes unsized reasons, exact accessible values and escaped labels', () => {
  const originalDocument=globalThis.document;
  globalThis.document={activeElement:null,querySelector:()=>({})};
  const stop=Symbol('capture treemap markup');let html;
  const host={clientWidth:500,contains:()=>false,classList:{add(){}},dataset:{},removeAttribute(){},set innerHTML(value){html=value;throw stop;}};
  try {
    try { charts.render(host,{type:'treemap',rows:[{label:'<Transport>',value:75,detail:'A & B',color:'#171918'},{label:'Correction',value:-3},{label:'Zero',value:0},{label:'Missing',value:null}],fields:[{key:'value',label:'Actual'}],valueFormat:value=>`${value.toFixed(2)} CZK`}); }
    catch(error){if(error!==stop)throw error;}
    assert.match(html,/&lt;Transport&gt;/);assert.doesNotMatch(html,/<Transport>/);
    assert.match(html,/75\.00 CZK/);assert.match(html,/-3\.00 CZK/);
    assert.match(html,/Negative value — cannot size a rectangle/);
    assert.match(html,/Zero value — no rectangle area/);
    assert.match(html,/Missing value — cannot size a rectangle/);
    assert.equal((html.match(/data-point=/g)||[]).length,4);
    assert.match(html,/aria-label="&lt;Transport&gt;\. Actual: 75\.00 CZK/);
    assert.match(html,/--treemap-ink:#faf7ef/);
  } finally {globalThis.document=originalDocument;}
});

test('treemap keeps compact tile labels separate from exact tooltip and accessible amounts', () => {
  const originalDocument=globalThis.document, originalResize=globalThis.ResizeObserver;
  const listeners=new Map(),tooltip={hidden:true,style:{},offsetWidth:200,offsetHeight:80,innerHTML:''};
  let markup='';
  globalThis.document={activeElement:null,querySelector:()=>({}),addEventListener(){}};
  globalThis.ResizeObserver=class { observe(){} disconnect(){} };
  const box={left:0,top:0,width:500,height:500};
  const host={clientWidth:500,contains:()=>false,classList:{add(){}},dataset:{},removeAttribute(){},addEventListener:(name,callback)=>listeners.set(name,callback),querySelector:()=>tooltip,getBoundingClientRect:()=>box,set innerHTML(value){markup=value;}};
  try {
    const chart=charts.render(host,{type:'treemap',rows:[{label:'Transport',value:1234567.89},{label:'Schools',value:765432.11}],fields:[{key:'value',label:'Actual'}],valueFormat:()=> '1.2m CZK',format:value=>`${value.toFixed(2)} CZK`});
    assert.match(markup,/<strong class="psd-treemap-value">1\.2m CZK<\/strong>/);
    assert.match(markup,/aria-label="Transport\. Actual: 1234567\.89 CZK/);
    assert.doesNotMatch(markup,/--treemap-color:#c93237/);
    const hit={dataset:{point:'0'},getBoundingClientRect:()=>box};
    listeners.get('focusin')({target:{closest:()=>hit}});
    assert.equal(tooltip.hidden,false);
    assert.match(tooltip.innerHTML,/1234567\.89 CZK/);
    assert.doesNotMatch(tooltip.innerHTML,/1\.2m CZK/);
    chart.destroy();
  } finally {globalThis.document=originalDocument;globalThis.ResizeObserver=originalResize;}
});
