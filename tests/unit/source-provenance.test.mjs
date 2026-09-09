import test from 'node:test';
import assert from 'node:assert/strict';
import { readSources, reconcileSourceDeclarations, mergeSourceDeclaration } from '../../scripts/lib/source-provenance.mjs';
test('named comparison source declarations are discoverable',()=>{
 const [row]=readSources({comparison_source:{url:'https://example.org/comparison'}},'a.json');
 assert.equal(row.location,'/comparison_source');
});
test('nested dictionary and URL sources retain actual timestamp meaning',()=>{
  const rows=readSources({generated_at:'2026-09-09',countries:{CZE:{period:2025,sources:{native:{url:'https://example.org',published_at:'2026-01-01'},budget:'https://example.org/budget'}}}},'test.json');
  assert.equal(rows.length,2);assert.equal(rows[0].extracted,null);assert.equal(rows[0].generated_at,'2026-09-09');assert.equal(rows[0].reference_period,2025);assert.equal(rows[0].published_at,'2026-01-01');
});
test('retrieval and publication stay separate from artifact generation',()=>{
 const [row]=readSources({generated_at:'2026-09-09',source:{url:'https://example.org',retrieved_at:'2026-09-08',published_at:'2025-12-31',edition:'2025 annual'}},'a.json');
 assert.equal(row.retrieved_at,'2026-09-08');assert.equal(row.extracted,'2026-09-08');assert.equal(row.edition,'2025 annual');
});
test('distribution checksum and reference year survive flat source declarations',()=>{
 const [row]=readSources({year:2024,generated_at:'2026-09-09',source_url:'https://example.org/table.csv',download_page:'https://example.org/catalogue',sha256:'a'.repeat(64),fetched_at:'2026-09-08'},'flat.json');
 assert.equal(row.url,'https://example.org/table.csv');assert.equal(row.landing_page,'https://example.org/catalogue');assert.equal(row.reference_period,2024);assert.equal(row.retrieved_at,'2026-09-08');assert.deepEqual(row.checksum,{algorithm:'sha256',value:'a'.repeat(64)});
});
test('archived bulk exports retain native validity separately from retrieval',()=>{
 const [row]=readSources({years:[{year:2025,bulk_export_url:'https://cityvizor.cz/api/exports/profiles/8/all/2025',sha256:'b'.repeat(64),source_validity:'2025-12-31',retrieved_at:'2026-09-09'}]},'catalogue.json');
 assert.equal(row.reference_period,2025);assert.equal(row.source_validity,'2025-12-31');assert.equal(row.retrieved_at,'2026-09-09');assert.equal(row.checksum.value,'b'.repeat(64));
 const [native]=readSources({source:{url:'https://example.org/native',raw_sha256:'c'.repeat(64),reference_date:'2026-07-01'}},'native.json');
 assert.deepEqual(native.checksum,{algorithm:'sha256',value:'c'.repeat(64)});assert.equal(native.reference_period,'2026-07-01');assert.equal(native.retrieved_at,null);
});
test('a reused URL cannot synthesize a single edition and checksum from conflicting observations',()=>{
 const declarations=[{edition:'2024',retrieved_at:'2025-01-01',reference_period:2024,checksum:{algorithm:'sha256',value:'old'}},{edition:'2025',retrieved_at:'2026-01-01',reference_period:2025,checksum:{algorithm:'sha256',value:'new'}}];
 const row=reconcileSourceDeclarations({key:'https://example.org/latest',...declarations[0],declarations});
 assert.equal(row.edition,null);assert.equal(row.retrieved_at,null);assert.equal(row.reference_period,null);assert.equal(row.checksum,null);
 assert.deepEqual(row.metadata_variants.edition,['2024','2025']);assert.deepEqual(row.declarations,declarations);
 const one=reconcileSourceDeclarations({declarations:[declarations[0],{edition:null,retrieved_at:null}]});assert.equal(one.edition,'2024');assert.equal(one.retrieved_at,'2025-01-01');
});
test('identical declarations compact while metadata variants remain separate',()=>{
 const row={declarations:[]};const base={url:'https://example.org/latest',edition:'2025',artifact:'a.json',location:'/source'};
 mergeSourceDeclaration(row,base);mergeSourceDeclaration(row,{...base,location:'/copy'});mergeSourceDeclaration(row,{...base,edition:'2024',artifact:'b.json'});
 assert.equal(row.declarations.length,2);assert.equal(row.declarations[0].declaration_count,2);assert.deepEqual(row.declarations[0].location_examples,['/source','/copy']);
 const reconciled=reconcileSourceDeclarations(row);assert.equal(reconciled.edition,null);assert.deepEqual(reconciled.metadata_variants.edition,['2025','2024']);
});
