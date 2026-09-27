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
