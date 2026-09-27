/* Published directory adapter: ranking period and financial scope are independent of latest data. */
(function(root) {
  function decode(shard) {
    if (!Array.isArray(shard.fields) || !Array.isArray(shard.records)) throw new Error('Invalid public-entity directory');
    return shard.records.map(row => Object.fromEntries(shard.fields.map((field,index) => [field,(shard.dictionary_fields || []).includes(field) ? shard.dictionaries[field][row[index]] : row[index]])));
  }
  function auditedTransportOperator(row) {
    return (row.financial_history || []).some(h=>['fare_revenue','public_service_compensation'].some(metric=>{const obs=h.observations?.[metric];return Number.isFinite(h[metric]) && obs?.normalized_unit==='CZK_million' && /^[a-f0-9]{64}$/.test(obs.source_sha256 || '') && /^https:\/\//.test(obs.source_url || '') && Number.isInteger(obs.page) && obs.page>0;}));
  }
  function merge(dataset,shard) {
    const fx=dataset.fx.rates.CZK;
    if (!(Number.isFinite(fx) && fx>0)) throw new Error('Missing documented 2024 CZK exchange rate');
    const editorial=new Map(dataset.records.filter(r=>r.country_code==='CZE').map(r=>[r.ico,r]));
    const output=dataset.records.filter(r=>r.country_code!=='CZE').map(r=>({...r,owner_level:'national',fx_rate:dataset.fx.rates[r.currency]}));
    const seen=new Set();
    for (const row of decode(shard)) {
      if ((!['controlled_enterprise','majority_public_owned_enterprise','consolidation_enterprise'].includes(row.entity_class) && !(['statutory_public_body','budgetary_organization'].includes(row.entity_class) && auditedTransportOperator(row))) || !row.national_id) continue;
      if (seen.has(row.national_id)) throw new Error('Duplicate Czech enterprise identity');
      seen.add(row.national_id);
      const old=editorial.get(row.national_id), history=Array.isArray(row.financial_history)?row.financial_history:[];
      const annual=history.filter(h=>Number(h.year)===2024 && h.scope==='standalone' && h.period_start==='2024-01-01' && h.period_end==='2024-12-31');
      if (annual.length>1) throw new Error('Ambiguous 2024 individual accounts');
      const chosen=annual[0], obs=chosen?.observations?.revenue;
      // This existing editorial group comparator is intentionally not substituted with parent accounts.
      const group=old?.id==='CZE-CEZ';
      const revenue=chosen && Number.isFinite(chosen.revenue) && obs?.normalized_unit==='CZK_million' ? chosen.revenue : null;
      const fallback=!group && revenue===null && old?.period==='2024' && Number.isFinite(old.source_revenue_m) && /^https:\/\//.test(old.source_url || '') && Boolean(old.metric_en);
      const editorialValue=group || fallback;
      const owner=row.ownership_level || 'unknown';
      output.push({...old,id:old?.id || row.record_id,ico:row.national_id,country_code:'CZE',country_en:'Czechia',country_cs:'Česko',company:row.name,sector:old?.sector || 'other',currency:'CZK',fx_rate:fx,period:'2024',source_revenue_m:editorialValue?old.source_revenue_m:revenue,ownership_pct:Number.isFinite(row.ownership_share_pct)?row.ownership_share_pct:old?.ownership_pct ?? null,owner_level:group?'national':owner,ownership_en:row.controlling_authority || old?.ownership_en || owner,ownership_cs:row.controlling_authority || old?.ownership_cs || owner,metric_en:editorialValue?old.metric_en:chosen?.revenue_definition || 'Individual accounts · 2024 unavailable',metric_cs:editorialValue?old.metric_cs:chosen?.revenue_definition || 'Samostatná závěrka · 2024 nedostupné',source_url:editorialValue?old.source_url:obs?.source_url || row.source_url,source_title:editorialValue?old.source_title:'Verified annual accounts / public registry',note_en:editorialValue?old.note_en:'Ranking uses individual 2024 accounts only. Ownership metadata may describe a later snapshot.',note_cs:editorialValue?old.note_cs:'Pořadí používá pouze samostatnou závěrku 2024. Vlastnictví může pocházet z pozdějšího snímku.',ownership_snapshot:Number.isFinite(row.ownership_share_pct)?{kind:'published directory',period:row.period,source_url:row.source_url}:Number.isFinite(old?.ownership_pct)?{kind:'editorial snapshot',period:old.period,source_url:old.source_url}:null,financial_history:history,ranking_scope:group?'editorial state-consolidation comparator':fallback?'2024 editorial snapshot fallback · '+old.metric_en:'standalone',directory_record:row});
    }
    for(const [ico,row] of editorial) if(!seen.has(ico)) output.push({...row,owner_level:'national',fx_rate:dataset.fx.rates[row.currency]});
    return output;
  }
  root.StateEnterpriseModel={decode,merge};
})(typeof globalThis==='undefined'?this:globalThis);
