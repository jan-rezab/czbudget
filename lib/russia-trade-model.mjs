// Accounting semantics only. No interpolation, mirrored imports, or shipment matching.
export const BASE_START = '201902';
export const BASE_END = '202201';
export function calendar(start, end) {
 const rows=[];
 for(let year=Number(start.slice(0,4)),month=Number(start.slice(4)); `${year}${String(month).padStart(2,'0')}`<=end;) {
  rows.push(`${year}${String(month).padStart(2,'0')}`); if(++month===13){month=1;year++;}
 }
 return rows;
}
export function monthlyRows(data) {
 const lookup=new Map(data.observations.map(row=>[`${row.period}:${row.reporter_iso3}:${row.partner_iso3}`,row]));
 const legs=[['direct',data.exporter,'RUS'],['inbound',data.exporter,data.via],['onward',data.via,'RUS']];
 return calendar(BASE_START,data.end_period).map(period=>{
  const row={period,label:`${period.slice(0,4)}-${period.slice(4)}`};
  for(const [key,from,to] of legs){
   const observation=lookup.get(`${period}:${from}:${to}`);
   row[key]=observation?.value_usd ?? null;
   row[`${key}Observation`]=observation || null;
   // Same calendar month, three pre-invasion observations (Feb 2019–Jan 2022).
   const baseline=data.observations.filter(item=>item.reporter_iso3===from && item.partner_iso3===to && item.period>=BASE_START && item.period<=BASE_END && item.period.slice(4)===period.slice(4) && Number.isFinite(item.value_usd));
   row[`${key}BaselineCount`]=baseline.length;
   row[`${key}Baseline`]=baseline.length===3 ? baseline.reduce((sum,item)=>sum+item.value_usd,0)/3 : null;
   row[`${key}Delta`]=row[key]!==null && row[`${key}Baseline`]!==null ? row[key]-row[`${key}Baseline`] : null;
  }
  // Descriptive comparison only; no additive total across the three legs.
  row.loss=row.directDelta===null ? null : Math.max(0,-row.directDelta);
  row.gain=row.inboundDelta===null ? null : Math.max(0,row.inboundDelta);
  row.offsetRatio=row.loss>0 && row.gain!==null ? row.gain/row.loss : null;
  return row;
 });
}

export const HUBS = ['KAZ','KGZ'];
export function aggregateModel(data) {
 const index=new Map(data.observations.map(o=>[`${o.period}:${o.reporter_iso3}:${o.flow_code}:${Number(o.partner_area_code)===0?'WORLD':o.partner_iso3}:${o.product_code}`,o]));
 const get=(period,hub,flow,partner='WORLD',product=data.product)=>index.get(`${period}:${hub}:${flow}:${partner}:${product}`)?.value_usd ?? null;
 const periods=[...new Set(data.observations.filter(o=>o.product_code===data.product).map(o=>o.period))].sort();
 const timeline=data.frequency==='M'&&periods.length?calendar(periods[0],periods.at(-1)):periods;
 const baseline=(period,hub,flow,partner='WORLD',product=data.product)=>{
  const before=data.frequency==='A'?['2019']:['2019'].map(y=>y+period.slice(4));
  const values=before.map(p=>get(p,hub,flow,partner,product));
  return values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0)/values.length:null;
 };
 const compare=(period,hub,flow,partner='WORLD',product=data.product)=>{
  const value=get(period,hub,flow,partner,product),base=baseline(period,hub,flow,partner,product);
  return {value,base,delta:value!==null&&base!==null?value-base:null,ratio:base>0&&value!==null?value/base:null};
 };
 const rows=timeline.map(period=>({period,label:data.frequency==='A'?period:`${period.slice(0,4)}-${period.slice(4)}`,KAZ:get(period,'KAZ','M'),KGZ:get(period,'KGZ','M'),KAZ_RUS:get(period,'KAZ','X','RUS'),KGZ_RUS:get(period,'KGZ','X','RUS')}));
 return {get,baseline,compare,rows,periods:timeline,
  suppliers:(period)=>data.observations.filter(o=>o.period===period&&o.product_code===data.product&&o.flow_code==='M'&&Number(o.partner_area_code)!==0).sort((a,b)=>(b.value_usd??-1)-(a.value_usd??-1)),
  dependencies:(period)=>HUBS.flatMap(hub=>[...new Set(data.observations.filter(o=>o.product_code.length===2).map(o=>o.product_code))].map(product=>{
   const inbound=compare(period,hub,'M','WORLD',product),onward=compare(period,hub,'X','RUS',product),exports=get(period,hub,'X','WORLD',product);
   return {hub,product,inbound,onward,russiaShare:exports>0&&onward.value!==null?onward.value/exports:null,
    jointGrowth:inbound.delta>0&&onward.delta>0?Math.min(inbound.delta,onward.delta):null};
  })).filter(r=>r.inbound.value!==null||r.onward.value!==null).sort((a,b)=>(b.jointGrowth??-Infinity)-(a.jointGrowth??-Infinity)||(b.onward.value??-1)-(a.onward.value??-1))};
}

// Every reporter in the comparison must have observations for all three routes
// in 2019 and the selected year. Missing is never fabricated as zero.
export function supplierComparisons(data,year) {
 const rows=(data.suppliers||[]).filter(o=>!['RUS','KAZ','KGZ'].includes(o.reporter_iso3)),lookup=new Map(rows.map(o=>[`${o.period}:${o.reporter_iso3}:${o.partner_iso3}`,o.value_usd]));
 const results=[...new Set(rows.map(o=>o.reporter_iso3))].map(reporter=>{
  const route=partner=>{const values=['2019'].map(p=>lookup.get(`${p}:${reporter}:${partner}`));const value=lookup.get(`${year}:${reporter}:${partner}`);const base=values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0)/values.length:null;return {value:value??null,base,delta:Number.isFinite(value)&&base!==null?value-base:null};};
  const direct=route('RUS'),kaz=route('KAZ'),kgz=route('KGZ');
  const eligible=[direct,kaz,kgz].every(r=>r.delta!==null);
  return {reporter,name:rows.find(o=>o.reporter_iso3===reporter)?.reporter_name||reporter,direct,kaz,kgz,eligible,
   hubDelta:eligible?kaz.delta+kgz.delta:null};
 });
 return results.sort((a,b)=>(b.hubDelta??-Infinity)-(a.hubDelta??-Infinity));
}

// Fixed category cohort across the whole chart. Rank by absolute USD growth,
// not percentage growth from tiny bases. TOTAL is a separate World/Russia basket.
export function categoryGrowth(data, {hub, flow='M', baseYear='2019', endYear, limit=5, partner, continuousYears=false}) {
 if (data.frequency !== 'A') throw new Error('Category growth requires annual observations');
 const scoped=data.observations.filter(o=>o.reporter_iso3===hub&&o.flow_code===flow&&(partner?o.partner_iso3===partner:(flow==='M'?Number(o.partner_area_code)===0:o.partner_iso3==='RUS')));
 const lookup=new Map(scoped.map(o=>[`${o.period}:${o.product_code}`,o.value_usd]));
 const get=(year,code)=>lookup.get(`${year}:${code}`)??null;
 const periods=[...new Set(scoped.filter(o=>o.product_code==='TOTAL').map(o=>o.period))].sort();
 endYear ||= periods.at(-1);
 const categories=[...new Set(scoped.filter(o=>/^\d{2}$/.test(o.product_code)).map(o=>o.product_code))].map(code=>{
  const before=get(baseYear,code),after=get(endYear,code);
  return {code,before,after,delta:before!==null&&after!==null?after-before:null,ratio:before>0&&after!==null?after/before:null};
 }).filter(r=>r.delta>0).sort((a,b)=>b.delta-a.delta||a.code.localeCompare(b.code)).slice(0,limit);
 const timeline=continuousYears&&periods.length?Array.from({length:Number(periods.at(-1))-Number(periods[0])+1},(_,i)=>String(Number(periods[0])+i)):periods;
 const rows=timeline.map(period=>{
  const total=get(period,'TOTAL'),row={period,label:period,total};
  for(const c of categories)row[c.code]=get(period,c.code);
  const values=categories.map(c=>row[c.code]),sum=values.reduce((n,v)=>n+(v??0),0),complete=values.every(Number.isFinite);
  // Tolerate numerical summation noise only; never hide a genuine negative remainder.
  const tolerance=Math.max(1,Math.abs(total||0))*1e-12;
  row.other=total!==null&&complete&&total-sum>=-tolerance?Math.max(0,total-sum):null;
  return row;
 });
 return {hub,flow,baseYear,endYear,categories,rows};
}

export const RESEARCH_SUPPLIERS = ['KOR','GEO','DEU','TUR','ITA'];
// Annual supplier declarations stay separate from hub imports and monthly rows.
export function supplierHistory(data, year) {
 const observations=(data.suppliers||[]).filter(o=>RESEARCH_SUPPLIERS.includes(o.reporter_iso3)&&o.partner_iso3==='KGZ'&&/^\d{4}$/.test(o.period));
 const index=new Map(observations.map(o=>[`${o.period}:${o.reporter_iso3}`,o.value_usd]));
 const get=(period,reporter)=>index.get(`${period}:${reporter}`)??null;
 const periods=[...new Set(observations.map(o=>o.period))].sort();
 const timeline=periods.length?Array.from({length:Number(periods.at(-1))-Number(periods[0])+1},(_,i)=>String(Number(periods[0])+i)):[];
 const rows=timeline.map(period=>({period,label:period,...Object.fromEntries(RESEARCH_SUPPLIERS.map(reporter=>[reporter,get(period,reporter)]))}));
 const requestedYear=year;
 if(year&&!periods.includes(year))year=periods.filter(p=>p<=year).at(-1)||year;
 year ||= periods.at(-1);
 const comparisons=RESEARCH_SUPPLIERS.map(reporter=>{const base=get('2019',reporter),value=get(year,reporter);return {reporter,base,value,delta:base!==null&&value!==null?value-base:null,ratio:base>0&&value!==null?value/base:null};});
 return {rows,year,requestedYear,comparisons};
}

export async function readRussiaAggregate(frequency,product,fetchImpl=fetch,endpoint) {
 let result=null,page=0;const signal=AbortSignal.timeout(55000);
 for(let attempt=0;attempt<200;attempt++){
  const response=await fetchImpl(`${endpoint||`/api/v1/trade/russia-aggregate?frequency=${encodeURIComponent(frequency)}&product=${encodeURIComponent(product)}`}&page=${page}`,{signal});
  if(!response.ok)throw new Error(String(response.status));
  const {data}=await response.json();
  if(!result)result={...data,observations:[],suppliers:[]};
  if(result.view_id!==data.view_id)throw new Error('Comparison changed while loading; retry.');
  result.observations.push(...data.observations);result.suppliers.push(...data.suppliers);
  const next=data.pagination?.next_page;
  if(next==null){
   if(data.pagination && (result.observations.length!==data.pagination.observation_count || result.suppliers.length!==data.pagination.supplier_count))throw new Error('Incomplete comparison.');
   delete result.pagination;return result;
  }
  if(next!==page+1)throw new Error('Invalid comparison continuation.');page=next;
 }
 throw new Error('Comparison exceeds the bounded page count.');
}

export function largestMapSuppliers(rows,limit=8) {
 return HUBS.flatMap(hub=>rows.filter(row=>row.reporter_iso3===hub && Number.isFinite(row.value_usd) && row.value_usd>0).sort((a,b)=>b.value_usd-a.value_usd || String(a.partner_iso3).localeCompare(String(b.partner_iso3))).slice(0,limit));
}

export function directSupplierGrowth(data,baseYear='2019',endYear='2024'){
 const rows=(data.suppliers||[]).filter(o=>o.partner_iso3==='RUS'&&o.reporter_iso3!=='RUS'),countries=[...new Set(rows.map(o=>o.reporter_iso3))];
 return countries.map(reporter=>{const get=year=>rows.find(o=>o.reporter_iso3===reporter&&o.period===year)?.value_usd??null,base=get(baseYear),value=get(endYear);
  return {reporter,name:rows.find(o=>o.reporter_iso3===reporter)?.reporter_name||reporter,base,value,delta:base!==null&&value!==null?value-base:null,ratio:base>0&&value!==null?value/base:null};
 }).sort((a,b)=>(b.delta??-Infinity)-(a.delta??-Infinity));
}
export function bilateralHistory(data){
 const totals=data.observations.filter(o=>o.product_code==='TOTAL'),years=[...new Set(totals.map(o=>o.period))].sort();
 return years.length?Array.from({length:Number(years.at(-1))-Number(years[0])+1},(_,i)=>{const period=String(Number(years[0])+i),get=flow=>totals.find(o=>o.period===period&&o.flow_code===flow)?.value_usd??null;return {period,label:period,X:get('X'),M:get('M')};}):[];
}

// Exact decimal arithmetic for story accounting. Numeric copies are plot coordinates only.
const USD_SCALE=1000000000n;
function usdInteger(value){
 if(value===null||value===undefined)return null;
 const match=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
 if(!match)throw new Error('Invalid source USD decimal');
 const digits=match[2]+(match[3]||''),places=9-(match[3]||'').length+Number(match[4]||0);
 const integer=BigInt(digits);if(places<0&&integer%10n**BigInt(-places)!==0n)throw new Error('Source USD exceeds nine decimal places');
 return (match[1]?-1n:1n)*(places>=0?integer*10n**BigInt(places):integer/10n**BigInt(-places));
}
function usdString(value){if(value===null)return null;const sign=value<0n?'-':'',n=value<0n?-value:value;return sign+String(n/USD_SCALE)+(n%USD_SCALE?'.'+String(n%USD_SCALE).padStart(9,'0').replace(/0+$/,''):'');}
const sourceUSD=row=>row?usdInteger(row.reported_value_usd??row.value_usd):null;
export function deltaBasket(observations,{baseYear='2019',endYear='2024',key='product_code'}={}){
 const index=new Map(),codes=new Set(observations.map(o=>o[key]));
 for(const o of observations)if(o.period===baseYear||o.period===endYear){const id=`${o.period}:${o[key]}`;if(index.has(id))throw new Error('Duplicate delta observation');index.set(id,o);codes.add(o[key]);}
 const rows=[...codes].map(code=>{const before=index.get(`${baseYear}:${code}`),after=index.get(`${endYear}:${code}`),base=sourceUSD(before),value=sourceUSD(after),delta=base!==null&&value!==null?value-base:null;return {code,baseExact:usdString(base),valueExact:usdString(value),deltaExact:usdString(delta),delta:delta===null?null:Number(usdString(delta)),baseObservation:before||null,valueObservation:after||null};}).sort((a,b)=>(b.delta??-Infinity)-(a.delta??-Infinity)||String(a.code).localeCompare(String(b.code)));
 const positives=rows.filter(r=>r.delta>0),negatives=rows.filter(r=>r.delta<0),missing=rows.filter(r=>r.delta===null),sum=list=>list.reduce((s,r)=>s+usdInteger(r.deltaExact),0n),positive=sum(positives),negative=sum(negatives);
 for(const row of rows){const d=usdInteger(row.deltaExact);row.sharePositiveExact=d!==null&&d>0n&&positive>0n?usdString(d*100n*USD_SCALE/positive):null;}
 return {baseYear,endYear,rows,positives,negatives,missing,positiveExact:rows.length>missing.length?usdString(positive):null,negativeExact:rows.length>missing.length?usdString(negative):null,netExact:rows.length>missing.length?usdString(positive+negative):null,knownCount:rows.length-missing.length,totalCount:rows.length};
}
export function deltaSlices(basket,limit=5){
 const positive=usdInteger(basket.positiveExact),selected=basket.positives.slice(0,limit).map(r=>({...r,members:[r.code]})),rest=basket.positives.slice(limit);
 if(rest.length){const value=rest.reduce((s,r)=>s+usdInteger(r.deltaExact),0n);selected.push({code:'OTHER',deltaExact:usdString(value),delta:Number(usdString(value)),sharePositiveExact:usdString(value*100n*USD_SCALE/positive),members:rest.map(r=>r.code),baseLoadIds:[...new Set(rest.flatMap(r=>r.baseObservation?.release_ids||[]))],valueLoadIds:[...new Set(rest.flatMap(r=>r.valueObservation?.release_ids||[]))],baseExact:usdString(rest.reduce((s,r)=>s+usdInteger(r.baseExact),0n)),valueExact:usdString(rest.reduce((s,r)=>s+usdInteger(r.valueExact),0n))});}
 return selected;
}
export function bilateralDelta(data,{country=data.country,flow='X',baseYear='2019',endYear='2024'}={}){
 const scoped=data.observations.filter(o=>o.reporter_iso3===country&&o.partner_iso3==='RUS'&&o.flow_code===flow),basket=deltaBasket(scoped.filter(o=>/^\d{2}$/.test(o.product_code)),{baseYear,endYear});
 const totals=deltaBasket(scoped.filter(o=>o.product_code==='TOTAL'),{baseYear,endYear}),total=totals.rows[0];
 return {...basket,country,flow,total:total||null,coverageDifferenceExact:basket.netExact!==null&&total?.deltaExact!==null&&total?.deltaExact!==undefined?usdString(usdInteger(total.deltaExact)-usdInteger(basket.netExact)):null};
}
export function supplierDelta(data,baseYear='2019',endYear='2024'){
 return deltaBasket((data.suppliers||[]).filter(o=>o.partner_iso3==='RUS'&&o.reporter_iso3!=='RUS'),{baseYear,endYear,key:'reporter_iso3'});
}
export function hubDelta(data,hub,baseYear='2019',endYear='2024'){
 const scoped=data.observations.filter(o=>o.reporter_iso3===hub&&o.product_code==='TOTAL'&&((o.flow_code==='M'&&Number(o.partner_area_code)===0)||(o.flow_code==='X'&&o.partner_iso3==='RUS'))).map(o=>({...o,route:o.flow_code==='M'?'WORLD_IMPORTS':'RUSSIA_EXPORTS'}));
 return deltaBasket(scoped,{baseYear,endYear,key:'route'});
}
export function chooseStoryYear(suppliers,bilateral,requested){
 const years=[...new Set((suppliers.suppliers||[]).filter(o=>o.partner_iso3==='RUS'&&o.reporter_iso3===bilateral.country).map(o=>o.period))].sort();
 const shared=years.filter(y=>y>'2019'&&['X','M'].every(flow=>bilateral.observations.some(o=>o.product_code==='TOTAL'&&o.period===y&&o.flow_code===flow))&&(!suppliers.observations||HUBS.every(hub=>['M','X'].every(flow=>suppliers.observations.some(o=>o.period===y&&o.product_code==='TOTAL'&&o.reporter_iso3===hub&&o.flow_code===flow&&(flow==='M'?Number(o.partner_area_code)===0:o.partner_iso3==='RUS'))))));
 return requested||shared.at(-1)||null;
}

// Flat audit rows retain missing comparisons and original source metadata.
const auditMetadata=value=>value==null?null:Array.isArray(value)?value.join('|'):String(value);
export function deltaAuditRows(basket,{kind='category',reporter='',flow=''}={}){
 return basket.rows.map(r=>({kind,code:r.code,reporter_iso3:reporter||r.baseObservation?.reporter_iso3||r.valueObservation?.reporter_iso3||r.code,flow_code:flow,baseline_year:basket.baseYear,comparison_year:basket.endYear,unit:'current USD',baseline_usd:r.baseExact,endpoint_usd:r.valueExact,delta_usd:r.deltaExact,comparison_status:r.deltaExact!==null?'paired':r.baseExact===null&&r.valueExact===null?'missing_both':r.baseExact===null?'missing_baseline':'missing_endpoint',share_positive_pct:r.sharePositiveExact,positive_denominator_usd:basket.positiveExact,declines_usd:basket.negativeExact,paired_net_usd:basket.netExact,base_load_ids:auditMetadata(r.baseObservation?.release_ids),endpoint_load_ids:auditMetadata(r.valueObservation?.release_ids),base_source_hashes:auditMetadata(r.baseObservation?.source_hashes),endpoint_source_hashes:auditMetadata(r.valueObservation?.source_hashes)}));
}
