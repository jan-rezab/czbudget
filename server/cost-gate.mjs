import {metadataToken} from './france-municipal-lines.mjs';
import {shareInFlight} from './in-flight.mjs';

export class CostGate {
  constructor({fetchImpl=globalThis.fetch,tokenProvider,now=()=>Date.now(),enabled=Boolean(process.env.K_SERVICE)}={}) {
    this.fetch=fetchImpl;this.token=tokenProvider||(()=>metadataToken(fetchImpl));this.now=now;this.enabled=enabled;this.checkedAt=-Infinity;this.pending=new Map();
  }
  async status() {
    if(!this.enabled)return {paused:false};
    if(this.now()-this.checkedAt<30_000)return this.value;
    return shareInFlight(this.pending,'status',async()=>{
      try {
        const response=await this.fetch('https://storage.googleapis.com/storage/v1/b/czbudget-janrezab-public-snapshots/o/static-assets%2Fcost-control%2Fcurrent.json?alt=media',{headers:{Authorization:`Bearer ${await this.token()}`},signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw Error('cost_status_unavailable');
        const body=await response.text();if(Buffer.byteLength(body)>16384)throw Error('cost_status_oversized');
        const state=JSON.parse(body);
        const age=this.now()-Date.parse(state.checked_at);
        if(state.schema_version!=='project-cost-control.v1'||state.project!=='czbudget-janrezab'||state.currency!=='CZK'||state.month_limit!==10000||state.day_limit!==2000||typeof state.paused!=='boolean'||!Number.isFinite(age)||age< -60_000||(state.enforced!==false&&age>30*60_000))throw Error('cost_status_invalid');
        this.value={...state,paused:state.enforced===false?false:state.paused};
      }catch{this.value={paused:true,reason:'cost_monitor_unavailable'};}
      this.checkedAt=this.now();return this.value;
    });
  }
}
export const costGate=new CostGate();

export const overloadHTML=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public Spending Data · Temporarily paused</title><style>body{margin:0;background:#f6f7fa;color:#152238;font:17px/1.6 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:620px;padding:48px 28px}small{color:#567086}h1{font-size:clamp(28px,6vw,42px);line-height:1.2}a{color:#235da7}hr{border:0;border-top:1px solid #d6dde5;margin:32px 0}</style><main><small>PUBLIC SPENDING DATA</small><h1>We’re taking a short pause</h1><p>The site is temporarily paused to protect its operating budget. Our published data is safe. Please come back later.</p><hr><section lang="cs"><h2>Krátká přestávka</h2><p>Web je dočasně pozastaven, abychom ochránili jeho provozní rozpočet. Zveřejněná data zůstávají bezpečně uložena. Zkuste to prosím později.</p></section></main></html>`;
