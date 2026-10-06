import crypto from 'node:crypto';
const BUCKET='czbudget-janrezab-public-snapshots';
const PREFIX='static-assets/czech-economic-flows/';
function validateRelease(data){
  if(data?.schema_version!=='czech-economic-flows.v1'||data.country!=='CZE'||!Array.isArray(data.years)||!data.years.length||!data.years.every(Number.isInteger)||!Array.isArray(data.observations)||!Array.isArray(data.sector_accounts))throw new Error('Invalid release');
  const keys=new Set();
  for(const r of [...data.observations,...data.sector_accounts]){
    const key=r.sector?`${r.year}:${r.sector}:${r.transaction}:${r.direction}`:`${r.year}:${r.id}`;
    if(keys.has(key)||!data.years.includes(r.year)||r.unit!=='CZK_million'||!/^https:\/\//.test(r.source_url||'')||!r.source_dataset||!r.source_code||r.value!==null&&(!Number.isFinite(r.value)||typeof r.source_value!=='string'||!r.source_value.trim()||!r.source_unit||!r.coverage||!Number.isFinite(Number(r.source_value))))throw new Error('Invalid observation');
    keys.add(key);
  }
  return data;
}
export class EconomicFlowError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
export class EconomicFlowStore {
  constructor({fetchImpl=globalThis.fetch,token,ttlMs=60000}={}){this.fetch=fetchImpl;this.token=token||this.metadataToken.bind(this);this.ttlMs=ttlMs;}
  async metadataToken(){const r=await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new EconomicFlowError(503,'economic_flow_auth_failed');const d=await r.json();if(!d.access_token)throw new EconomicFlowError(503,'economic_flow_auth_failed');return d.access_token;}
  async object(key,token,generation){const r=await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media${generation?'&generation='+generation:''}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new EconomicFlowError(r.status===404?503:502,'economic_flow_unavailable');return Buffer.from(await r.arrayBuffer());}
  async current(){
    if(this.cached&&Date.now()-this.loadedAt<this.ttlMs)return this.cached;
    this.loading||=(async()=>{
      const token=await this.token(),pointer=JSON.parse((await this.object(PREFIX+'current.json',token)).toString());
      if(pointer.schema_version!=='1.0.0'||pointer.bucket!==BUCKET||!/^[-a-zA-Z0-9]{8,80}$/.test(pointer.release_id||'')||pointer.object!==`${PREFIX}releases/${pointer.release_id}/atlas.json`||!/^\d+$/.test(pointer.generation||'')||!/^[a-f0-9]{64}$/.test(pointer.sha256||'')||!Number.isSafeInteger(pointer.bytes)||pointer.bytes<=0||pointer.bytes>4*1024*1024)throw new EconomicFlowError(502,'economic_flow_pointer_invalid');
      const body=await this.object(pointer.object,token,pointer.generation);
      if(body.length!==pointer.bytes||crypto.createHash('sha256').update(body).digest('hex')!==pointer.sha256)throw new EconomicFlowError(502,'economic_flow_checksum_failed');
      const data=validateRelease(JSON.parse(body.toString()));
      if(data.release_id!==pointer.release_id)throw new EconomicFlowError(502,'economic_flow_release_mismatch');
      this.cached=data;this.loadedAt=Date.now();return data;
    })().catch(error=>{if(error instanceof EconomicFlowError)throw error;throw new EconomicFlowError(502,'economic_flow_payload_invalid');}).finally(()=>{this.loading=null;});
    return this.loading;
  }
}
export const economicFlowStore=new EconomicFlowStore();
