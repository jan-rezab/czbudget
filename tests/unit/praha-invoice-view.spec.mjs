import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {describe,render}=createRequire(import.meta.url)('../../praha-invoice-view.js');
const row={id:'one',profileKey:'cityvizor.praha.eu/4',year:2025,event:'45029',counterpartyId:'25021915',counterparty:'Metrostav',expenditure:100};
test('supplier and project similarity never becomes a contract match or invoice-line identity',()=>{
 const s=describe(row,{rows:[row,{...row,id:'two',expenditure:100},{...row,id:'wrong-year',year:2024},{...row,id:'wrong-supplier',counterpartyId:'12345678'},{...row,id:'wrong-project',event:'other'},{...row,id:'wrong-authority',profileKey:'cityvizor.praha.eu/6'}]});
 assert.equal(s.contractStatus,'not_assessed');assert.deepEqual(s.peers.map(r=>r.id),['two']);assert.equal(new URL(s.supplierSearch).searchParams.get('Q'),'ico:25021915');
});
test('missing and invalid identity do not create supplier links or peer joins',()=>{
 for(const id of ['', 'null','1234','12345678&Q=other']){const s=describe({...row,counterpartyId:id},{rows:[{...row,id:'two'}]});assert.equal(s.supplierSearch,null);assert.deepEqual(s.peers,[]);}
 assert.deepEqual(describe({...row,event:''},{rows:[{...row,id:'two',event:''}]}).peers,[]);
});
test('detail labels unknown matching and missing line items rather than claiming no match',()=>{
 const html=render(row,{T:en=>en,esc:v=>String(v??'').replaceAll('<','&lt;'),exact:v=>String(v),money:v=>String(v),number:v=>String(v),link:(u,t)=>t,context:{rows:[]}});
 assert.ok(html.includes('data-contract-status="not_assessed"'));assert.ok(html.includes('This does not mean that no contract exists'));assert.ok(html.includes('Purchased goods / services line items'));assert.ok(html.includes('not an invoice line item'));assert.ok(!html.includes('data-contract-status="unmatched"'));
});

test('missing district authority identity cannot be filled with the magistrate IČO',()=>{
 const html=render(row,{T:en=>en,esc:v=>String(v??''),exact:v=>String(v),money:v=>String(v),number:v=>String(v),link:(u,t)=>t,context:{profile:{key:'cityvizor.praha.eu/6',name:'Praha 3'},evidence:{profileKey:'cityvizor.praha.eu/6'}}});
 assert.ok(!html.includes('00064581'));assert.ok(html.includes('cityvizor.praha.eu/6 / Not supplied'));
});
