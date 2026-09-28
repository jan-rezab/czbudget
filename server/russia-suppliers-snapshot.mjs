import { createHash } from 'node:crypto';
import { metadataToken } from './france-municipal-lines.mjs';
import { shareInFlight } from './in-flight.mjs';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const PREFIX = 'static-assets/russia-trade-suppliers/';
const PRODUCTS = new Set(['TOTAL', ...Array.from({length:99},(_,n)=>String(n+1).padStart(2,'0')), '854231','847130','845710','848210']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export class RussiaSuppliersSnapshot {
  constructor({fetchImpl=globalThis.fetch,tokenProvider,now=()=>Date.now()}={}) {
    this.fetch=fetchImpl; this.token=tokenProvider || (()=>metadataToken(fetchImpl));
    this.now=now; this.checkedAt=-Infinity; this.rowsCache=new Map(); this.pending=new Map();
  }

  async object(key, token, limit, generation, optional=false) {
    const query=new URLSearchParams({alt:'media'});
    if(generation) query.set('generation',generation);
    const response=await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?${query}`,{
      headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
    if(optional && response.status===404) return null;
    if(!response.ok) throw Error('russia_suppliers_object_unavailable');
    const reader=response.body.getReader(); const chunks=[]; let size=0;
    try {
      while(true) { const {value,done}=await reader.read(); if(done)break;
        size+=value.byteLength; if(size>limit)throw Error('russia_suppliers_object_oversized'); chunks.push(value); }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks,size);
  }

  validateRef(ref, object) {
    if(ref?.object!==object || !/^[a-f0-9]{64}$/.test(ref.sha256 || '') ||
      !/^[1-9][0-9]*$/.test(ref.generation || '') || !Number.isSafeInteger(ref.bytes) || ref.bytes<=0 || ref.bytes>4*1024*1024)
      throw Error('russia_suppliers_reference_invalid');
  }

  async verified(ref, token, limit) {
    const body=await this.object(ref.object,token,limit,ref.generation);
    if(body.length!==ref.bytes || createHash('sha256').update(body).digest('hex')!==ref.sha256)
      throw Error('russia_suppliers_checksum_failed');
    return JSON.parse(body);
  }

  async current() {
    if(this.now()-this.checkedAt<60_000) return this.manifest || null;
    return shareInFlight(this.pending,'manifest',async()=>{
      try {
        const token=await this.token(); const body=await this.object(PREFIX+'current.json',token,512*1024,null,true);
        if(!body) {this.checkedAt=this.now();return this.manifest || null;}
        const pointer=JSON.parse(body);
        if(pointer.schema_version!=='1.0.0' || pointer.bucket!==BUCKET || !UUID.test(pointer.release_id || ''))
          throw Error('russia_suppliers_pointer_invalid');
        this.validateRef(pointer,`${PREFIX}releases/${pointer.release_id}/manifest.json`);
        if(this.manifest?.release_id===pointer.release_id && this.manifestRef?.sha256===pointer.sha256) {
          this.checkedAt=this.now(); return this.manifest;
        }
        const manifest=await this.verified(pointer,token,512*1024);
        if(manifest.schema_version!=='russia-trade-suppliers.v1' || manifest.release_id!==pointer.release_id ||
          !Number.isFinite(Date.parse(manifest.snapshot_as_of)) || !manifest.products ||
          Object.keys(manifest.products).length!==PRODUCTS.size) throw Error('russia_suppliers_manifest_invalid');
        for(const product of PRODUCTS) {
          const ref=manifest.products[product];
          this.validateRef(ref,`${PREFIX}releases/${pointer.release_id}/${product}.json`);
          if(!Number.isSafeInteger(ref.rows) || ref.rows<0 || ref.rows>20000) throw Error('russia_suppliers_row_count_invalid');
        }
        this.manifest=manifest;this.manifestRef=pointer;this.checkedAt=this.now();return manifest;
      } catch(error) {
        if(this.manifest) {this.checkedAt=this.now();return this.manifest;}
        throw error;
      }
    });
  }

  async rows(product) {
    if(!PRODUCTS.has(product))throw Error('russia_suppliers_product_invalid');
    const manifest=await this.current(); if(!manifest)return null;
    const key=manifest.release_id+':'+product;
    if(this.rowsCache.has(key))return this.rowsCache.get(key);
    return shareInFlight(this.pending,key,async()=>{
      const ref=manifest.products[product]; const payload=await this.verified(ref,await this.token(),4*1024*1024);
      if(payload.schema_version!=='russia-trade-suppliers.product.v1' || payload.release_id!==manifest.release_id ||
        payload.product!==product || !Array.isArray(payload.rows) || payload.rows.length!==ref.rows)
        throw Error('russia_suppliers_payload_invalid');
      const seen=new Set();
      for(const row of payload.rows) {
        const identity=`${row.period}:${row.reporter_iso3}:${row.partner_iso3}`;
        if(!/^\d{4}$/.test(row.period || '') || !/^[A-Z]{3}$/.test(row.reporter_iso3 || '') ||
          !['RUS','KAZ','KGZ'].includes(row.partner_iso3) || seen.has(identity) ||
          !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(row.value_usd || '') || !Number.isFinite(Number(row.value_usd)) ||
          !Number.isSafeInteger(Number(row.product_count)) || Number(row.product_count)<=0)
          throw Error('russia_suppliers_row_invalid');
        seen.add(identity);
      }
      this.rowsCache.set(key,payload.rows);
      while(this.rowsCache.size>8)this.rowsCache.delete(this.rowsCache.keys().next().value);
      return payload.rows;
    });
  }
}
