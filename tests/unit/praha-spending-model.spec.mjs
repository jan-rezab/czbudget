import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {investigate}=createRequire(import.meta.url)('../../lib/praha-spending-model.js');
const row=(id,itemCode,expenditure,extra={})=>({id,year:2025,itemCode,paragraphCode:'6171',event:'A',eventName:'System A',expenditure,...extra});
test('project investigation isolates exact IT codes and year; invoices never enlarge accounting totals',()=>{
  const d={accountingRows:[row('a','5168',100),row('b','5169',900),row('c','5168',999,{year:2024})]};
  const r=investigate(d,{rows:[row('i','5168',30,{counterpartyId:'1'}),row('j','5168',-5,{counterpartyId:'1'}),row('k','5169',900)]},2025,'it');
  assert.equal(r.projects[0].amount,100);assert.equal(r.projects[0].invoiceAmount,25);assert.equal(r.projects[0].vendors[0].amount,25);assert.equal(r.invoices.length,2);
});
test('all services use native purpose totals once, while a missing IT code remains unknown',()=>{
  const rows=[{year:2025,stage:'actual',side:'expenditure',dimension:'functional',code:'2212',amount:200},{year:2025,stage:'actual',side:'expenditure',dimension:'functional',code:'3111',amount:300},{year:2025,stage:'actual',side:'expenditure',dimension:'economic',code:'5168',amount:500}];
  assert.equal(investigate({rows},null,2025,'all').stages.actual,500);
  assert.equal(investigate({rows},null,2025,'transport').stages.actual,200);
  assert.equal(investigate({rows},null,2025,'it').stages.actual,null);
  assert.equal(investigate({rows},null,2024,'all').stages.actual,null);
});
test('missing project and supplier identifiers cannot create false joins; null actual stays missing',()=>{
  const r=investigate({accountingRows:[row('a','5168',null)]},{rows:[row('i','5168',2,{counterparty:'Same name'}),row('j','5168',3,{counterparty:'Same name'}),row('x','5168',4,{event:''}),row('y','5168',5,{event:''})]},2025,'it');
  assert.equal(r.projects.length,3);const a=r.projects.find(p=>p.code==='A');assert.equal(a.amount,null);assert.equal(a.vendors.length,2);assert.equal(a.invoiceAmount,5);
});

test('CAPEX and OPEX reconcile only with an observed total; missing values are never zero',()=>{
  const {capitalSplit,expenditureClass}=createRequire(import.meta.url)('../../lib/praha-spending-model.js');
  const s=capitalSplit({current_expense:98001773459.69,capital_expense:25968350575.70,expense_actual:123970124035.39});
  assert.equal(s.reconciled,true);assert.ok(Math.abs(s.opexShare+s.capexShare-1)<1e-12);
  assert.equal(capitalSplit({current_expense:100,capital_expense:null,expense_actual:100}).capexShare,null);
  assert.equal(capitalSplit({current_expense:100,capital_expense:20,expense_actual:130}).reconciled,false);
  assert.equal(expenditureClass('5168'),'opex');assert.equal(expenditureClass('6125'),'capex');assert.equal(expenditureClass(''),'unclassified');
});
test('visual navigation retains exact purpose, item, project and supplier scope through signed records',()=>{
  const d={rows:[{year:2025,stage:'actual',side:'expenditure',dimension:'economic',code:'6125',amount:1000}],accountingRows:[row('a','6125',100),row('b','5168',500),row('c','6125',900,{paragraphCode:'2212'})]};
  const p={rows:[row('x','6125',40,{counterpartyId:'001'}),row('refund','6125',-10,{counterpartyId:'001'}),row('other-purpose','6125',700,{paragraphCode:'2212',counterpartyId:'001'}),row('other-item','5168',300,{counterpartyId:'001'})]};
  const r=investigate(d,p,2025,'all',{item:'6125',purpose:'6171'});
  assert.equal(r.projects.length,1);assert.equal(r.projects[0].amount,100);assert.equal(r.projects[0].invoiceAmount,30);assert.equal(r.projects[0].vendors[0].amount,30);
  assert.equal(r.stages.actual,null,'A missing full-city purpose × item matrix must not be invented');
  assert.equal(investigate(d,p,2025,'all',{item:'6125'}).stages.actual,1000);
});

test('project income includes income-only native rows while preserving zero and unknown amounts',()=>{
 const r=investigate({accountingRows:[row('spend','5168',100,{income:0}),row('receipt','1111',0,{income:50}),row('zero','5168',0,{income:0,event:'Z'})]},null,2025,'all');
 assert.equal(r.projects.length,1);assert.equal(r.projects[0].amount,100);assert.equal(r.projects[0].income,50);
 assert.equal(investigate(null,{rows:[row('allocation','5168',10)]},2025).projects[0].income,null);
});

test('multi-source joins keep years and dimensions separate, with unknown distinct from zero',()=>{
 const {comparePublication,unmatchedPublication,reconcileAccounting}=createRequire(import.meta.url)('../../lib/praha-spending-model.js');
 const rows=[row('zero','5169',0,{income:0}),row('credit','5169',-5,{paragraphCode:'2212',income:0}),row('old','5169',100,{year:2024}),row('uncoded','',7,{paragraphCode:'',income:0})];
 assert.equal(comparePublication(rows,{year:2025,dimension:'economic',codes:['5169'],available:true}).amount,-5);
 assert.equal(comparePublication(rows,{year:2025,dimension:'functional',codes:['6171'],available:true}).amount,0);
 assert.equal(comparePublication(rows,{year:2025,dimension:'economic',codes:['6125'],available:true}).amount,null);
 assert.equal(comparePublication(rows,{year:2025,dimension:'economic',codes:['5169']}).amount,null);
 assert.deepEqual(unmatchedPublication(rows,{year:2025,dimension:'economic',codes:['5169']}),{amount:7,matchedRows:1});
 const accountingRows=[{income:1.01,expenditure:2.02,budgetIncome:3.03,budgetExpenditure:4.04}],source_api_control={income_actual_cents:101,expenditure_actual_cents:202,income_budget_cents:303,expenditure_budget_cents:404};
 const detail={coverage:{accounting:{status:'available'}},accountingRows,annualFinance:{source_api_control}};
 assert.equal(reconcileAccounting(detail).status,'reconciled');source_api_control.expenditure_actual_cents=203;
 assert.equal(reconcileAccounting(detail).status,'not_verified');delete detail.annualFinance;
 assert.equal(reconcileAccounting(detail).status,'not_verified');
});
