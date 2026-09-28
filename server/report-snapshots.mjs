import {createHash} from 'node:crypto';
import {RussiaSuppliersSnapshot} from './russia-suppliers-snapshot.mjs';
import {shareInFlight} from './in-flight.mjs';

export const REPORT_PREFIX='static-assets/trade-reports/';
export const reportKey=parts=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// Every public query result comes from one independently validated data release.
// Missing/corrupt objects never cause a visitor-triggered warehouse query.
export class ReportSnapshots extends RussiaSuppliersSnapshot {
  constructor(options={}) {super(options);this.cachedBytes=0;}
  validateRef(ref,object) {
    if(ref?.object!==object || !/^[a-f0-9]{64}$/.test(ref.sha256||'') ||
      !/^[1-9][0-9]*$/.test(ref.generation||'') || !Number.isSafeInteger(ref.bytes) || ref.bytes<1 || ref.bytes>24*1024*1024)
      throw Error('report_reference_invalid');
  }
  async current() {
    if(this.now()-this.checkedAt<60_000)return this.manifest;
    return shareInFlight(this.pending,'report-manifest',async()=>{
      try {
        const token=await this.token();const body=await this.object(REPORT_PREFIX+'current.json',token,4096);
        const pointer=JSON.parse(body);
        if(pointer.schema_version!=='1.0.0'||pointer.bucket!=='czbudget-janrezab-public-snapshots'||!/^[a-f0-9-]{36}$/.test(pointer.release_id||''))throw Error('report_pointer_invalid');
        this.validateRef(pointer,`${REPORT_PREFIX}releases/${pointer.release_id}/manifest.json`);
        if(this.manifestRef?.sha256===pointer.sha256){this.checkedAt=this.now();return this.manifest;}
        const manifest=await this.verified(pointer,token,24*1024*1024);
        if(manifest.schema_version!=='trade-reports.v1'||manifest.release_id!==pointer.release_id||!Number.isFinite(Date.parse(manifest.snapshot_as_of))||!manifest.results||Object.keys(manifest.results).length>50000)throw Error('report_manifest_invalid');
        for(const [key,ref] of Object.entries(manifest.results)){
          if(!/^[a-f0-9]{64}$/.test(key))throw Error('report_key_invalid');
          this.validateRef(ref,`${REPORT_PREFIX}releases/${pointer.release_id}/${key}.json`);
          if(!Number.isSafeInteger(ref.rows)||ref.rows<0||ref.rows>100000)throw Error('report_count_invalid');
        }
        this.rowsCache.clear();this.cachedBytes=0;this.manifest=manifest;this.manifestRef=pointer;this.checkedAt=this.now();return manifest;
      }catch(error){if(this.manifest){this.checkedAt=this.now();return this.manifest;}throw error;}
    });
  }
  async rows(parts) {
    const manifest=await this.current();const key=reportKey(parts);const ref=manifest.results[key];
    if(!ref)return []; // No observed coverage, not a request to create coverage.
    const cacheKey=manifest.release_id+':'+key;
    if(this.rowsCache.has(cacheKey))return this.rowsCache.get(cacheKey).rows;
    return shareInFlight(this.pending,cacheKey,async()=>{
      const payload=await this.verified(ref,await this.token(),24*1024*1024);
      if(payload.schema_version!=='trade-report-rows.v1'||payload.release_id!==manifest.release_id||payload.key!==key||!Array.isArray(payload.rows)||payload.rows.length!==ref.rows)throw Error('report_payload_invalid');
      this.rowsCache.set(cacheKey,{rows:payload.rows,bytes:ref.bytes});this.cachedBytes+=ref.bytes;
      while(this.cachedBytes>48*1024*1024&&this.rowsCache.size>1){const oldest=this.rowsCache.keys().next().value;this.cachedBytes-=this.rowsCache.get(oldest).bytes;this.rowsCache.delete(oldest);}
      return payload.rows;
    });
  }
}
