import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {identify,group}=createRequire(import.meta.url)('../../lib/praha-company-model.js');

test('ownership classification requires exact source IČO, never a similar name or padded ID',()=>{
  assert.equal(identify('00005886').name,'Dopravní podnik hl. m. Prahy, a.s.');
  for(const id of [5886,'5886','00005886 ','12345678',null]) assert.equal(identify(id),null);
  const rows=[{counterpartyId:'12345678',counterparty:'Dopravní podnik hl. m. Prahy, a.s.',expenditure:10}];
  assert.deepEqual(group(rows).unreviewed,rows);
  assert.equal(group(rows).companies.length,0);
});

test('company allocations retain signed cents, zeros and source records',()=>{
  const rows=[0.1,0.2,-0.05,0].map(expenditure=>({counterpartyId:'02795281',expenditure}));
  const result=group(rows).companies[0];
  assert.equal(result.amount,0.25);
  assert.deepEqual(result.rows,rows);
  assert.equal(result.evidencePeriod,'2023-08-08');
  assert.equal(result.sourceUrl,'https://operatorict.cz/informace/verejne-zakazky');
});

test('missing values and empty publication cannot imply complete spending',()=>{
  assert.equal(group([{counterpartyId:'02795281',expenditure:null}]).companies[0].amount,null);
  assert.deepEqual(group([]),{companies:[],unreviewed:[]});
});
