import {randomUUID} from 'node:crypto';

const ROOT='https://storage.googleapis.com/storage/v1/b/czbudget-janrezab-public-snapshots/o/';
const UPLOAD='https://storage.googleapis.com/upload/storage/v1/b/czbudget-janrezab-public-snapshots/o';
const RATE=129.4275; // CZK/TiB; dated catalog price, reconciled by cost controller.
export class QueryAdmissionError extends Error {
  constructor(){super('Detailed queries are temporarily paused to protect the operating budget.');this.status=503;this.code='query_budget_paused';}
}
export class QueryAdmission {
  constructor({fetchImpl=globalThis.fetch,now=()=>new Date()}={}){this.fetch=fetchImpl;this.now=now;}
  async request(url,token,options={}){
    const response=await this.fetch(url,{...options,headers:{Authorization:token,'Content-Type':'application/json'},signal:AbortSignal.timeout(5000)});
    if(response.status===404)return null;
    if(response.status===412)return false;
    if(!response.ok)throw new QueryAdmissionError();
    return response.json();
  }
  async change(token,change){
    const day=this.now().toLocaleDateString('en-CA',{timeZone:'Europe/Prague'}),month=day.slice(0,7);
    const object=`static-assets/cost-control/admission/${month}.json`;
    for(let attempt=0;attempt<6;attempt++){
      const metadata=await this.request(ROOT+encodeURIComponent(object),token);
      const existing=metadata?await this.request(ROOT+encodeURIComponent(object)+'?alt=media&generation='+metadata.generation,token):null;
      const ledger=existing||{month,day,month_reserved:0,day_reserved:0,active:{}};
      if(ledger.month!==month||!Number.isFinite(ledger.month_reserved)||ledger.month_reserved<0||!Number.isFinite(ledger.day_reserved)||ledger.day_reserved<0||!ledger.active||Object.keys(ledger.active).length>4096)throw new QueryAdmissionError();
      if(ledger.day!==day){ledger.day=day;ledger.day_reserved=0;}
      const result=change(ledger,day);
      const query=new URLSearchParams({uploadType:'media',name:object,ifGenerationMatch:metadata?.generation||'0'});
      const updated=await this.request(UPLOAD+'?'+query,token,{method:'POST',body:JSON.stringify(ledger)});
      if(updated!==false)return result;
    }
    throw new QueryAdmissionError();
  }
  async reserve(token,maximumBytes){
    const state=await this.request(ROOT+encodeURIComponent('static-assets/cost-control/current.json')+'?alt=media',token);
    if(state?.enforced===false)return null; // Controlled two-stage rollout only.
    if(!state||state.paused||state.currency!=='CZK'||!Number.isFinite(Date.parse(state.checked_at))||this.now().getTime()-Date.parse(state.checked_at)>30*60_000||!Number.isFinite(state.month_amount)||!Number.isFinite(state.day_amount))throw new QueryAdmissionError();
    const charge=Number(maximumBytes)/2**40*RATE;
    if(!Number.isFinite(charge)||charge<=0||charge>100)throw new QueryAdmissionError();
    const id=randomUUID();
    return this.change(token,(ledger,day)=>{
      // Reservations are intentionally conservative: until reconciliation they
      // may overlap measured costs, but concurrent instances cannot overspend
      // the remaining admitted query budget through a check-then-submit race.
      if(state.month_amount+ledger.month_reserved+charge>10000||state.day_amount+ledger.day_reserved+charge>2000)throw new QueryAdmissionError();
      ledger.month_reserved+=charge;ledger.day_reserved+=charge;ledger.active[id]={day,charge};return {id,token};
    });
  }
  async settle(reservation,billedBytes){
    if(!reservation)return;
    if(!Number.isFinite(billedBytes)||billedBytes<0)return; // Unknown jobs retain their maximum reservation.
    await this.change(reservation.token,(ledger,day)=>{
      const entry=ledger.active[reservation.id];if(!entry)return;
      const actual=billedBytes/2**40*RATE;
      const refund=Math.max(0,entry.charge-actual);
      ledger.month_reserved=Math.max(0,ledger.month_reserved-refund);
      if(entry.day===day)ledger.day_reserved=Math.max(0,ledger.day_reserved-refund);
      delete ledger.active[reservation.id];
    });
  }
}

const admission=new QueryAdmission();
const pendingJobs=new Map();
export async function reserveWebQuery(url,options){
  if(!process.env.K_SERVICE||options?.method!=='POST'||!/^https:\/\/bigquery\.googleapis\.com\/bigquery\/v2\/projects\/[^/]+\/queries$/.test(url))return null;
  const body=JSON.parse(options.body);const token=options.headers.Authorization;
  return admission.reserve(token,body.maximumBytesBilled);
}
export async function settleWebQuery(payload,reservation){
  const job=payload.jobReference?.jobId;
  if(reservation&&job)pendingJobs.set(job,reservation);
  const active=reservation||pendingJobs.get(job);
  if(!active||!payload.jobComplete)return;
  // Read the completed job's billed bytes, not processed bytes. Minima/rounding
  // and cache hits make those quantities different.
  const response=await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/czbudget-janrezab/jobs/${encodeURIComponent(job)}?location=EU`,{headers:{Authorization:active.token},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return;
  const completed=await response.json();const billed=Number(completed.statistics?.query?.totalBytesBilled);
  if(completed.status?.state!=='DONE'||!Number.isFinite(billed))return;
  try {await admission.settle(active,billed);pendingJobs.delete(job);}catch{/* A failed refund stays reserved; never reopen the budget. */}
}
