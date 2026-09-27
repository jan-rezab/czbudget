import {metadataToken,requestJSON,parameter,decodeRows} from './france-municipal-lines.mjs';

export const CONTRACT_RELEASE='95efccaf-8f0f-421d-b5fc-1316ee967cc6';
export class PrahaContractsError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
export const RELATED_CONTRACTS_SQL=`
WITH coverage AS (
 SELECT release_id,municipality_ico,accepted_rows,source_completed_at
 FROM \`czbudget-janrezab.hlidac_contracts.current_municipality_coverage\`
 WHERE municipality_ico=@payer AND release_id=@release
), related AS (
 SELECT c.contract_id,c.subject,c.signed_at,c.published_at,c.value_czk,c.currency,c.value_basis,c.source_url,c.parent_contract_id,c.compact_contract_sha256,c.source_validity_json,c.signed_date FROM \`czbudget-janrezab.hlidac_contracts.current_contracts\` c
 WHERE c.release_id=@release AND c.payer_ico=@payer
 AND EXISTS (SELECT 1 FROM \`czbudget-janrezab.hlidac_contracts.current_contract_suppliers\` s
 WHERE s.release_id=c.release_id AND s.municipality_ico=c.municipality_ico
 AND s.contract_id=c.contract_id AND s.supplier_ico=@supplier)
), filtered AS (
 SELECT * FROM related WHERE @term='' OR STRPOS(LOWER(subject),LOWER(@term))>0
), sample AS (
 SELECT contract_id,subject,signed_at,published_at,CAST(value_czk AS STRING) value_czk,
 currency,value_basis,source_url,parent_contract_id,compact_contract_sha256,
 source_validity_json
 FROM filtered
 ORDER BY IF(signed_date<=SAFE_CAST(@date AS DATE),0,1),signed_date DESC,contract_id
 LIMIT 50
)
SELECT coverage.release_id,coverage.municipality_ico,coverage.accepted_rows,
 CAST(coverage.source_completed_at AS STRING) source_completed_at,
 (SELECT COUNT(*) FROM related) related_count,(SELECT COUNT(*) FROM filtered) filtered_count,
 sample.* FROM coverage LEFT JOIN sample ON TRUE`;

export class PrahaContractsStore {
  constructor({fetchImpl=globalThis.fetch,tokenProvider}={}) {
    this.fetch=fetchImpl;this.token=tokenProvider||(()=>metadataToken(this.fetch));
  }
  async related({payer,supplier,date='',term=''}={}) {
    if(payer!=='00064581') throw new PrahaContractsError(404,'prague_contract_payer_outside_coverage');
    if(typeof supplier!=='string'||!/^\d{8}$/.test(supplier)||typeof term!=='string'||term.length>80||
      typeof date!=='string'||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new PrahaContractsError(400,'invalid_prague_contract_keys');
    const token=await this.token();
    let payload=await requestJSON(this.fetch,'https://bigquery.googleapis.com/bigquery/v2/projects/czbudget-janrezab/queries',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({query:RELATED_CONTRACTS_SQL,useLegacySql:false,location:'EU',timeoutMs:5000,maxResults:51,
        maximumBytesBilled:'536870912',parameterMode:'NAMED',queryParameters:[
          parameter('payer','STRING',payer),parameter('supplier','STRING',supplier),parameter('release','STRING',CONTRACT_RELEASE),
          parameter('date','STRING',date),parameter('term','STRING',term)]})});
    if(!payload.jobComplete&&payload.jobReference?.jobId) {
      payload=await requestJSON(this.fetch,`https://bigquery.googleapis.com/bigquery/v2/projects/czbudget-janrezab/queries/${encodeURIComponent(payload.jobReference.jobId)}?location=EU&timeoutMs=5000&maxResults=51`,{headers:{Authorization:`Bearer ${token}`}});
    }
    if(!payload.jobComplete||payload.pageToken) throw new PrahaContractsError(503,'prague_contract_query_incomplete');
    const rows=decodeRows(payload),coverage=rows[0];
    if(!coverage||coverage.release_id!==CONTRACT_RELEASE||coverage.municipality_ico!==payer||Number(coverage.accepted_rows)!==115429) throw new PrahaContractsError(503,'prague_contract_release_unavailable');
    const keys=['contract_id','subject','signed_at','published_at','value_czk','currency','value_basis','source_url','parent_contract_id','compact_contract_sha256','source_validity_json'];
    return {status:'related_by_exact_parties',match_status:'not_verified',payer_ico:payer,supplier_ico:supplier,
      release_id:coverage.release_id,snapshot_completed_at:coverage.source_completed_at,coverage_contracts:Number(coverage.accepted_rows),
      related_count:Number(coverage.related_count),filtered_count:Number(coverage.filtered_count),limit:50,term,
      rows:rows.filter(r=>r.contract_id).map(r=>Object.fromEntries(keys.map(k=>[k,r[k]])))};
  }
}
export const prahaContractsStore=new PrahaContractsStore();
