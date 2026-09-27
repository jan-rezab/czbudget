import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {describe,render,renderContracts}=createRequire(import.meta.url)('../../praha-invoice-view.js');
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

test('contract table preserves source decimal precision, negative corrections and primary/backup links',()=>{
 const esc=v=>String(v??'').replaceAll('<','&lt;');
 const html=renderContracts({payer_ico:'00064581',supplier_ico:'25021915',related_count:3,filtered_count:3,rows:[{contract_id:'7939187',subject:'Project',value_czk:'992378.475',currency:'CZK',source_url:'https://smlouvy.gov.cz/smlouva/7939187'},{contract_id:'2',value_czk:'-0.50',currency:'CZK'},{contract_id:'3',value_czk:'9007199254740993.01',currency:'CZK'}]}, {T:en=>en,esc,link:(url,label)=>`<a href="${url}">${label}</a>`});
 assert.ok(html.includes('992,378.475 CZK'));assert.ok(html.includes('-0.50 CZK'));assert.ok(html.includes('9,007,199,254,740,993.01 CZK'));
 assert.ok(html.includes('https://www.hlidacstatu.cz/Detail/7939187'));assert.ok(html.includes('https://smlouvy.gov.cz/smlouva/7939187'));
 assert.ok(html.includes('<table'));assert.ok(html.includes('invoice-to-contract link not verified'));
});
