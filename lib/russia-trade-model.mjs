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
