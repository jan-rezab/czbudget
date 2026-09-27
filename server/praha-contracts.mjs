import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {metadataToken} from './france-municipal-lines.mjs';
export const CONTRACT_RELEASE='95efccaf-8f0f-421d-b5fc-1316ee967cc6';
const CITY_RELEASE='3c1b0b77-f00f-42c9-ae74-1a2366034a62';
const BUCKET='czbudget-janrezab-public-snapshots';
const PREFIX='static-assets/praha-evidence/';
const MAX=16*1024*1024;
const hash=body=>crypto.createHash('sha256').update(body).digest('hex');
const KEYS=['contract_id','subject','signed_at','published_at','value_czk','currency','value_basis','source_url','parent_contract_id','compact_contract_sha256','source_validity_json'];
export class PrahaContractsError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
const fail=()=>{throw new PrahaContractsError(503,'prague_contract_release_unavailable');};
export class PrahaContractsStore {
 constructor({fetchImpl=globalThis.fetch,tokenProvider}={}){this.fetch=fetchImpl;this.token=tokenProvider||(()=>metadataToken(this.fetch));this.shards=new Map();}
 async object(key,token,asset){
  if(!key.startsWith(PREFIX))fail();
  const response=await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media${asset?'&generation='+encodeURIComponent(asset.generation):''}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
  if(!response.ok)fail();
  if(Number(response.headers?.get('content-length'))>MAX)fail();
  const body=Buffer.from(await response.arrayBuffer());
  if(body.length>MAX||(asset&&(body.length!==asset.bytes||hash(body)!==asset.sha256)))fail();
  return body;
 }
 async current(){
  if(this.cached&&Date.now()-this.loadedAt<60000)return this.cached;
  this.loading||=(async()=>{
   const token=await this.token(),p=JSON.parse(await this.object(PREFIX+'current.json',token));
   if(p.schema_version!=='1.0.0'||p.bucket!==BUCKET||p.validated!==true||!/^[-a-f0-9]{36}$/.test(p.release_id))fail();
   const a=p.manifest;
   if(!a||a.object!==PREFIX+'releases/'+p.release_id+'/manifest.json'||!/^\d+$/.test(a.generation)||!Number.isSafeInteger(a.bytes)||a.bytes>2*1024*1024||!/^([a-f0-9]{64})$/.test(a.sha256))fail();
   const m=JSON.parse(await this.object(a.object,token,a));
   if(m.schema_version!=='1.0.0'||m.release_id!==p.release_id||m.payer_ico!=='00064581'||m.contract_release_id!==CONTRACT_RELEASE||m.cityvizor_warehouse_release_id!==CITY_RELEASE||m.cityvizor_source_release_id!=='20260909-2294793cff54'||m.coverage_contracts!==115429||!m.supplier_counts||!m.shards)fail();
   if(Object.entries(m.supplier_counts).some(([ico,n])=>!/^\d{8}$/.test(ico)||!Number.isSafeInteger(n)||n<1)||Object.values(m.supplier_counts).reduce((a,b)=>a+b,0)!==m.candidate_pair_rows)fail();
   this.cached=m;this.loadedAt=Date.now();this.shards.clear();return m;
  })().catch(()=>fail()).finally(()=>{this.loading=null;});
  return this.loading;
 }
 async shard(m,id){
  const cacheKey=m.release_id+id;
  if(this.shards.has(cacheKey))return this.shards.get(cacheKey);
  const pending=(async()=>{
   const a=m.shards[id];
   if(!a||a.object!==PREFIX+'releases/'+m.release_id+'/shards/'+id+'.json.gz'||!/^\d+$/.test(a.generation)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>MAX||!/^([a-f0-9]{64})$/.test(a.sha256)||!Number.isSafeInteger(a.uncompressed_bytes)||a.uncompressed_bytes>MAX)fail();
   const raw=gunzipSync(await this.object(a.object,await this.token(),a),{maxOutputLength:MAX});
   if(raw.length!==a.uncompressed_bytes)fail();
   const s=JSON.parse(raw);
   if(s.release_id!==m.release_id||s.bucket_id!==id||s.schema_version!=='1.0.0'||!Array.isArray(s.rows)||s.rows.length!==a.rows)fail();
   if(s.rows.some(r=>!/^\d{8}$/.test(r.supplier_ico)||hash(r.supplier_ico).slice(0,2)!==id||!r.contract_id||!/^([a-f0-9]{64})$/.test(r.compact_contract_sha256)))fail();
   return s.rows;
  })().catch(()=>{this.shards.delete(cacheKey);fail();});
  this.shards.set(cacheKey,pending);if(this.shards.size>8)this.shards.delete(this.shards.keys().next().value);
  return pending;
 }
 async related({payer,supplier,date='',term=''}={}){
  if(payer!=='00064581')throw new PrahaContractsError(404,'prague_contract_payer_outside_coverage');
  if(typeof supplier!=='string'||!/^\d{8}$/.test(supplier)||typeof term!=='string'||term.length>80||typeof date!=='string'||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw new PrahaContractsError(400,'invalid_prague_contract_keys');
  const m=await this.current(),n=m.supplier_counts[supplier]||0;
  const rows=n?(await this.shard(m,hash(supplier).slice(0,2))).filter(r=>r.supplier_ico===supplier):[];
  if(rows.length!==n||new Set(rows.map(r=>r.contract_id)).size!==n)fail();
  const filtered=rows.filter(r=>!term||String(r.subject||'').toLowerCase().includes(term.toLowerCase()));
  const rank=r=>r.signed_at&&r.signed_at.slice(0,10)<=date?0:1;
  filtered.sort((a,b)=>rank(a)-rank(b)||String(b.signed_at||'').localeCompare(String(a.signed_at||''))||String(a.contract_id).localeCompare(String(b.contract_id)));
  return {status:'related_by_exact_parties',match_status:'not_verified',payer_ico:payer,supplier_ico:supplier,release_id:CONTRACT_RELEASE,serving_release_id:m.release_id,cityvizor_warehouse_release_id:CITY_RELEASE,cityvizor_source_release_id:m.cityvizor_source_release_id,snapshot_completed_at:m.source_snapshot_completed_at,coverage_contracts:115429,related_count:n,filtered_count:filtered.length,limit:50,term,rows:filtered.slice(0,50).map(r=>Object.fromEntries(KEYS.map(k=>[k,r[k]])))};
 }
}
export const prahaContractsStore=new PrahaContractsStore();
