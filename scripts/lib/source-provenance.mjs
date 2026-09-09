/** Collect nested source declarations without substituting build time for retrieval. */
export function readSources(payload, artifact) {
  const found=[];
  const add=(source,location,context)=>{
    if(typeof source==="string"&&/^https?:\/\//.test(source)) source={url:source};
    if(!source||typeof source!=="object"||Array.isArray(source)) return;
    const url=source.url||source.source_url||source.api_url||source.download_page||null;
    const title=source.title||source.name||source.label||source.label_cs||source.dataset||null;
    if(!url&&!title&&!source.provider&&!source.publisher) return;
    const retrieved=source.retrieved_at||source.extracted_at||source.extracted||source.retrieved||source.fetched_at||null;
    found.push({key:url||`${source.provider||source.publisher||""}:${title||"unnamed"}`,provider:source.provider||source.publisher||null,title,url,
      edition:source.edition||source.vintage||source.source_vintage||null,
      extracted:retrieved,retrieved_at:retrieved,published_at:source.published_at||source.published_on||null,
      reviewed_at:source.reviewed_at||source.reviewed_on||null,
      generated_at:context.generated_at||payload.generated_at||null,
      reference_period:source.reference_period||source.period||source.reference_date||context.period||context.year||null,
      source_validity:source.source_validity||source.validity||null,
      checksum:(source.sha256||source.raw_sha256||source.source_sha256)?{algorithm:"sha256",value:source.sha256||source.raw_sha256||source.source_sha256}:source.sha1?{algorithm:"sha1",value:source.sha1}:source.checksum||source.source_hash||null,
      landing_page:source.download_page||source.landing_page||null,
      etag:source.etag||null,last_modified:source.last_modified||null,
      artifact,location});
  };
  const walk=(node,location,context)=>{
    if(!node||typeof node!=="object")return;
    if(Array.isArray(node)){node.forEach((child,i)=>walk(child,`${location}/${i}`,context));return;}
    const local={...context,...(node.generated_at?{generated_at:node.generated_at}:{}),...(node.period?{period:node.period}:{}),...(node.year!==undefined?{year:node.year}:{})};
    for(const [key,value] of Object.entries(node)) {
      if(key==="source"||key.endsWith("_source"))add(value,`${location}/${key}`,local);
      if(["source_url","source_download_url","bulk_export_url"].includes(key)&&typeof value==="string"&&/^https?:\/\//.test(value))add({...node,url:value},`${location}/${key}`,local);
      if(key==="sources"&&value&&typeof value==="object") {
        for(const [id,entry] of Object.entries(value)) add(entry,`${location}/sources/${id}`,local);
      }
      walk(value,`${location}/${key}`,local);
    }
  };
  walk(payload,"",{});return found;
}

/** A URL may be reused for several editions. Do not synthesize one mixed vintage. */
export function reconcileSourceDeclarations(row) {
  const declarations=row.declarations||[];
  if(!declarations.length)return row;
  const result={...row,metadata_variants:{}};
  for(const field of ['edition','extracted','retrieved_at','published_at','reviewed_at','generated_at','reference_period','source_validity','checksum','etag','last_modified']) {
    const variants=[...new Map(declarations.filter(d=>d[field]!==null&&d[field]!==undefined).map(d=>[JSON.stringify(d[field]),d[field]])).values()];
    result[field]=variants.length===1?variants[0]:null;
    if(variants.length>1)result.metadata_variants[field]=variants;
  }
  return result;
}

/** Collapse repeated declarations without mixing their metadata variants. */
export function mergeSourceDeclaration(row,entry) {
  const fields=['provider','title','url','edition','extracted','retrieved_at','published_at','reviewed_at','generated_at','reference_period','source_validity','checksum','landing_page','etag','last_modified'];
  const values=Object.fromEntries(fields.map(field=>[field,entry[field]??null]));
  const fingerprint=JSON.stringify(values);
  let group=(row.declarations||[]).find(item=>item.fingerprint===fingerprint);
  if(!group){group={...values,fingerprint,declaration_count:0,artifacts:[],location_examples:[]};(row.declarations??=[]).push(group);}
  group.declaration_count+=1;
  if(entry.artifact&&!group.artifacts.includes(entry.artifact))group.artifacts.push(entry.artifact);
  if(entry.location&&group.location_examples.length<5&&!group.location_examples.includes(entry.location))group.location_examples.push(entry.location);
  return row;
}
