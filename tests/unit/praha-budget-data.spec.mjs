import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('../../praha-budget-data.js');

test('history keeps missing amounts, source stages, nominal units and actual population denominator', () => {
  const [row] = data.normalizeHistory({municipality:{national_id:'00064581'},series:[{year:2025,expense_actual:120,expense_approved:100,population_mid_year:2,cash_current:null,expense_per_capita:60}]});
  assert.equal(row.expense_actual,120);
  assert.equal(row.expense_approved,100);
  assert.equal(row.cash_current,null);
  assert.equal(row.revenue_actual,null);
  assert.equal(row.expense_per_capita,60);
  assert.equal(row.priceBasis,'nominal');
  assert.throws(()=>data.normalizeHistory({municipality:{national_id:'44992785'},series:[]}),/identity/);
});

test('parallel budget classifications and source stages remain separate instead of additive', () => {
  const rows=data.normalizeBreakdown({national_id:'00064581',budget_breakdown:{fiscal_year:2025,stages:{enacted:{purpose_expenditure:[['3113',100]],economic_expenditure:[['5331',100]]},actual:{purpose_expenditure:[['3113',80]],economic_expenditure:[['5331',80]]}}}}, {dimensions:{purpose:{'3113':{cs:'Základní školy'}},economic:{'5331':{cs:'Příspěvky'}}}});
  assert.equal(rows.filter(r=>r.stage==='actual'&&r.dimension==='functional').reduce((a,r)=>a+r.amount,0),80);
  assert.equal(rows.filter(r=>r.stage==='approved'&&r.dimension==='economic')[0].amount,100);
  assert.equal(rows[0].name,'Základní školy');
});

test('invoice allocations preserve signed cents, zero, missing date and identifiers without bank-payment claims', () => {
  const [row]=data.normalizePayments([{row_id:'allocation-1',income_cents:0,expenditure_cents:-125,date:null,counterparty_id:'00012345',paragraph:'3113',item:'5169'}],2025,null);
  assert.equal(row.income,0);
  assert.equal(row.expenditure,-1.25);
  assert.equal(row.counterpartyId,'00012345');
  assert.equal(row.date,null);
  assert.equal(row.recordClass,'invoice_allocation');
  const [missing]=data.normalizePayments([{}],2025,null);
  assert.equal(missing.income,null);
  assert.equal(missing.expenditure,null);
});

test('PAQ context accepts only the exact municipality and real annual periods, preserving gaps and units', () => {
  const index={regions:{'obec:554782':{key:'obec:554782',code:'554782',level:'obec',ico:'00064581'}}};
  const fields={}; const values={};
  ['2020','2022','2023','2024','2020–2023'].forEach((period,id)=>{fields[id]={variable_key:'podil_lidi_v_nezamestnanosti',values_type_key:'hodnoty',period_key:period,period_name:period,display_unit:'%',sources:['MPSV']};values[id]={value:id===1?null:3+id};});
  const catalog={fields,variables:{podil_lidi_v_nezamestnanosti:{name:'Nezaměstnanost',description:'<p>Reported administrative unemployment.</p>'}}};
  const result=data.normalizeContext(index,catalog,{'obec:554782':values});
  assert.equal(result.series.length,1);
  assert.deepEqual(result.series[0].points.map(p=>p.year),[2020,2021,2022,2023,2024]);
  assert.equal(result.series[0].points[1].value,null);
  assert.equal(result.series[0].points[1].recordStatus,'not_reported');
  assert.equal(result.series[0].points[1].sourceFieldId,null);
  assert.equal(result.series[0].points[2].recordStatus,'reported_missing');
  assert.equal(result.series[0].unit,'%');
  assert.deepEqual(result.series[0].observedYears,[2020,2023,2024]);
  assert.throws(()=>data.normalizeContext({regions:{'obec:554782':{...index.regions['obec:554782'],level:'kraj'}}},catalog,{'obec:554782':values}),/identity/);
});

test('a failed detail publication remains unavailable, while the full-year published breakdown survives', async () => {
  const client=data.createClient({fetch:async url=>{
    if(url===data.PATHS.entity)return {ok:true,json:async()=>({entity:{national_id:'00064581',budget_breakdown:{fiscal_year:2025,stages:{actual:{purpose_expenditure:[['3113',80]]}},lineage:{source_id:'fixture'}}}})};
    if(url===data.PATHS.codebook)return {ok:true,json:async()=>({dimensions:{}})};
    return {ok:false,status:503};
  }});
  const result=await client.loadYearDetail(2025);
  assert.equal(result.rows[0].amount,80);
  assert.equal(result.coverage.fullBudgetBreakdown,true);
  assert.equal(result.coverage.accounting.status,'unavailable');
  assert.deepEqual(result.accountingRows,[]);
});

test('a published shard from a different profile is rejected before it can enter the ledger', async () => {
  const client=data.createClient({fetch:async url=>{
    let value;
    if(url===data.PATHS.codebook)value={dimensions:{}};
    else if(url.includes('/profile?'))value={profile:{key:'cityvizor.praha.eu/4',ico:'00064581'},years:[{year:2025,payments:{rows:1},events:{rows:0},assets:{payments:[{part:1}],events:[]}}]};
    else value={profile_key:'cityvizor.cz/45',year:2025,kind:'payments',columns:['row_id'],rows:[['wrong-place']]};
    return {ok:true,json:async()=>value};
  }});
  await assert.rejects(()=>client.loadPayments(2025),/scope/);
});

test('district IT loader preserves exact identity, allocation amounts and missing invoice numbers', async () => {
  const profile={key:'cityvizor.praha.eu/6',ico:'00063517',name:'Praha 3',instance:'https://cityvizor.praha.eu',type:'municipality',available_years:[2025],profile_url:'https://cityvizor.praha.eu/praha3'};
  const calls=[];
  const client=data.createClient({fetch:async url=>{
    calls.push(url); let value;
    if(url.endsWith('/index')) value={complete:true,release_id:'test-release',profiles:[profile,{...profile,key:'cityvizor.cz/6',instance:'https://cityvizor.cz'}]};
    else if(url===data.PATHS.codebook)value={dimensions:{}};
    else if(url.includes('/profile?'))value={release_id:'test-release',profile,years:[{year:2025,source_validity:'2025-12-31',accounting:{by_item:[{key:'5168',expenditure_actual_cents:10000,expenditure_budget_cents:12000}]},payments:{rows:3},events:{rows:0},assets:{payments:[{part:1}],events:[]}}]};
    else value={profile_key:profile.key,year:2025,kind:'payments',columns:['row_id','item','expenditure_cents','counterparty_id','counterparty_name','description'],rows:[['one','5168',10000,'00001234','Vendor','Support'],['correction','5168',-1000,'00001234','Vendor renamed','Correction'],['non-it','5169',8000,'00001234','Vendor','Other service']]};
    return {ok:true,json:async()=>value};
  }});
  const summary=await client.loadITSummary(profile.key,2025);
  assert.equal(summary.items[0].amount,100);
  assert.equal(calls.some(url=>url.includes('/shard?')),false,'invoice records must remain lazy');
  const result=await client.loadITPayments(profile.key,2025);
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[1].expenditure,-10);
  assert.equal(result.rows[0].invoiceNumber,null);
  assert.equal(result.rows[0].profileKey,profile.key);
  assert.equal(result.rows[0].counterpartyId,'00001234');
  await assert.rejects(()=>client.loadITSummary('cityvizor.cz/6',2025),/not published/);
  await assert.rejects(()=>client.loadITSummary(profile.key,2024),/not published/);
});

test('district summary rejects profile identity and release drift', async () => {
  const profile={key:'cityvizor.praha.eu/6',ico:'00063517',type:'municipality',instance:'https://cityvizor.praha.eu',available_years:[2025]};
  for(const corrupt of [{profile:{...profile,ico:'00064581'},release_id:'r1'},{profile,release_id:'r2'}]) {
    const client=data.createClient({fetch:async url=>({ok:true,json:async()=>url.endsWith('/index')?{complete:true,release_id:'r1',profiles:[profile]}:{...corrupt,years:[{year:2025}]}})});
    await assert.rejects(()=>client.loadITSummary(profile.key,2025),/identity|Publication changed/);
  }
});
