import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease,borderModel,sectorModel,preferredYear,observation,completeSum,bopReconciliation,annualLedgerRows,serializeLedgerCSV,balanceBridge} from '../../lib/economic-flow-model.mjs';
import {fixture} from '../fixtures/economic-flows.mjs';

test('accounting boundaries preserve net negatives, zeros, exact source precision and stock basis',()=>{
  const d=validateRelease(fixture());
  assert.equal(observation(d,'m3',2024).basis,'stock');
  assert.equal(observation(d,'net_lending',2024).value,-1234.56);
  assert.equal(observation(d,'net_lending',2024).source_value,'-1234.560');
  assert.equal(completeSum([0,0]),0);assert.equal(completeSum([0,null]),null);assert.equal(completeSum([]),null);
});
test('current account is credits less debits; incomplete components never become zero',()=>{
  const d=fixture(),model=borderModel(d,2024);assert.equal(model.totalIn,5900000);assert.equal(model.totalOut,5850000);assert.equal(model.computed,50000);assert.equal(model.reported,50000);
  d.observations.find(r=>r.id==='imports_services'&&r.year===2024).value=null;
  assert.equal(borderModel(d,2024).computed,null);assert.equal(preferredYear(d),2023);
});
test('sector sides are independently sourced; missing counterpart keeps reconciliation incomplete',()=>{
  const d=fixture();assert.equal(sectorModel(d,2024,'D1').difference,0);
  d.sector_accounts=d.sector_accounts.filter(r=>!(r.year===2024&&r.sector==='S2'&&r.transaction==='D1'&&r.direction==='uses'));
  assert.equal(sectorModel(d,2024,'D1').paid,null);assert.equal(sectorModel(d,2024,'D1').received,1500000);
});
test('conflicting basis, duplicates and non-finite values are rejected',()=>{
  for(const mutate of [d=>d.observations.push(d.observations[0]),d=>d.observations[0].basis='stock',d=>d.observations[0].value=NaN,d=>d.observations[0].source_url='javascript:alert(1)']){const d=fixture();mutate(d);assert.throws(()=>validateRelease(d));}
});

test('BPM6 identity checks the reported discrepancy without inventing a balancing flow',()=>{
  const d=fixture();const value=id=>d.observations.find(r=>r.id===id&&r.year===2024);
  value('capital_account').value=10;value('errors_omissions').value=-5;value('financial_account').value=50005;
  assert.equal(bopReconciliation(d,2024).gap,0);value('errors_omissions').value=null;assert.equal(bopReconciliation(d,2024).gap,null);
});

test('annual download includes both metric and sector accounts with exact values and missing blanks',()=>{
  const rows=annualLedgerRows(fixture(),2024);assert.equal(rows.filter(r=>r.sector).length,60);
  assert.equal(rows.find(r=>r.id==='net_lending').source_value,'-1234.560');
  assert.equal(rows.find(r=>r.id==='emoney').value,null);assert.equal(rows.find(r=>r.id==='m3').reference_date,'2024-12-31');
  const csv=serializeLedgerCSV(rows);assert.ok(csv.includes('"D1:S11:uses"'));assert.ok(csv.includes('"-1234.560"'));
  assert.equal(serializeLedgerCSV([{label:'a,"b"',value:null}]),'\ufeff"label","value"\r\n"a,""b""",""');
});


test('stock-flow bridge reconciles successive years and identifies the remainder as calculated',()=>{
  const d=fixture(),set=(id,year,value)=>{d.observations.find(r=>r.id===id&&r.year===year).value=value;};
  set('financial_assets',2023,100);set('financial_assets',2024,115);set('asset_transactions',2024,-5);
  const b=balanceBridge(d,2024);assert.equal(b.complete,true);assert.equal(b.residual,20);assert.equal(b.opening.year,2023);
  assert.equal(b.opening.value+b.transactions.value+b.residual,b.closing.value);
  set('asset_transactions',2024,0);assert.equal(balanceBridge(d,2024).residual,15);
  set('financial_assets',2023,null);assert.equal(balanceBridge(d,2024).residual,null);
  assert.equal(balanceBridge(d,2023).complete,false);
  assert.equal(balanceBridge(d,2024,'liabilities').view.stock,'financial_liabilities');
});
