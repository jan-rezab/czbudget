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
export function categoryGrowth(data, {hub, flow='M', baseYear='2019', endYear, limit=5}) {
 if (data.frequency !== 'A') throw new Error('Category growth requires annual observations');
 const scoped=data.observations.filter(o=>o.reporter_iso3===hub&&o.flow_code===flow&&(flow==='M'?Number(o.partner_area_code)===0:o.partner_iso3==='RUS'));
 const lookup=new Map(scoped.map(o=>[`${o.period}:${o.product_code}`,o.value_usd]));
 const get=(year,code)=>lookup.get(`${year}:${code}`)??null;
 const periods=[...new Set(scoped.filter(o=>o.product_code==='TOTAL').map(o=>o.period))].sort();
 endYear ||= periods.at(-1);
 const categories=[...new Set(scoped.filter(o=>/^\d{2}$/.test(o.product_code)).map(o=>o.product_code))].map(code=>{
  const before=get(baseYear,code),after=get(endYear,code);
  return {code,before,after,delta:before!==null&&after!==null?after-before:null,ratio:before>0&&after!==null?after/before:null};
 }).filter(r=>r.delta>0).sort((a,b)=>b.delta-a.delta||a.code.localeCompare(b.code)).slice(0,limit);
 const rows=periods.map(period=>{
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
