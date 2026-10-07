// Synthetic fixture only. These values must never be published as observations.
import {METRICS,SECTORS,TRANSACTIONS,SCHEMA} from '../../lib/economic-flow-model.mjs';
export function fixture(){
  const provenance={unit:'CZK_million',source_unit:'CZK_million',source_url:'https://example.org/synthetic-economic-test',source_dataset:'synthetic-test',source_code:'TEST',coverage:'Synthetic test fixture, not a country observation'};
  const data={schema_version:SCHEMA,country:'CZE',release_id:'synthetic-20261006',synthetic:true,acquired_at:'2026-10-06T00:00:00Z',years:[2023,2024],observations:[],sector_accounts:[]};
  const special={gdp:7500000,output:17000000,intermediate:10000000,gva:7000000,product_taxes_net:500000,household_consumption:4000000,government_consumption:1500000,investment:1750000,exports:5000000,imports:4750000,exports_goods:4000000,exports_services:1000000,imports_goods:3800000,imports_services:950000,imports_travel:200000,primary_received:600000,primary_paid:900000,secondary_received:300000,secondary_paid:200000,current_account:50000,m1:5000000,m2:6500000,m3:6700000,credit_transfers:160000000,net_lending:-1234.56};
  for(const year of data.years){
    METRICS.forEach((metric,index)=>{const value=(special[metric.id]??(index+1)*10000)*(year===2023?.9:1);data.observations.push({...provenance,id:metric.id,year,value,source_value:value.toFixed(3),basis:metric.basis,...(metric.basis==='stock'?{reference_date:`${year}-12-31`}:{} )});});
    for(const transaction of TRANSACTIONS)for(const [index,sector] of SECTORS.entries())for(const direction of ['uses','resources']){const value=(index+1)*100000;data.sector_accounts.push({...provenance,year,sector:sector.id,transaction:transaction.id,direction,basis:'accrual',value,source_value:value.toFixed(2)});}
  }
  data.observations.find(r=>r.id==='emoney'&&r.year===2024).value=null;
  return data;
}
