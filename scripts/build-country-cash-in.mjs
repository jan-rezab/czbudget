#!/usr/bin/env node

import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=async path=>JSON.parse(await fs.readFile(new URL(path,root),"utf8"));
const [sovereign,budget,municipal,enterprises]=await Promise.all([
  read("lib/data/sovereign-benchmark.v1.json"),read("data/czech-budget.v1.json"),read("data/municipal-snapshot.v1.json"),read("data/cz-state-enterprises-2024.json")
]);
const year=2024;
const countries={};
for(const country of sovereign.countries){
  const series=sovereign.series.find(item=>item.country_code===country.country_code);
  const metric=key=>series.metrics[key].values.find(point=>point.year===year)?.value;
  countries[country.country_code]={
    name_cs:country.name_cs,name_en:country.name_en,currency:country.currency_code,
    consolidated:{year,scope:"general_government",revenue_pct_gdp:metric("revenue_pct_gdp"),revenue_local_bn:Number((metric("revenue_pct_gdp")*metric("nominal_gdp_local_bn")/100).toFixed(3)),expense_pct_gdp:metric("expenditure_pct_gdp"),balance_pct_gdp:metric("balance_pct_gdp")},
    layers:null
  };
}
const budgetRow=budget.rows.find(row=>row[0]===2025);
const rank=(items,value,count=5)=>({
  top:[...items].filter(item=>Number.isFinite(value(item))).sort((a,b)=>value(b)-value(a)).slice(0,count),
  bottom:[...items].filter(item=>Number.isFinite(value(item))).sort((a,b)=>value(a)-value(b)).slice(0,count)
});
const municipalityRank=rank(municipal.municipalities,item=>item.amounts.revenue_actual);
const companyRank=rank(enterprises.entities,item=>item.metrics.turnover);
const municipalRow=item=>({name:item.short_name,revenue_local_bn:Number((item.amounts.revenue_actual/1e9).toFixed(3)),balance_local_bn:Number((item.amounts.budget_balance/1e9).toFixed(3)),path:item.seo.path});
const companyRow=item=>({name:item.name,turnover_local_bn:Number((item.metrics.turnover/1000).toFixed(3)),net_result_local_bn:Number((item.metrics.net_result/1000).toFixed(3))});
countries.CZE.layers={
  state_budget:{year:2025,revenue_local_bn:Number((budgetRow[1]+budgetRow[2]+budgetRow[3]).toFixed(3)),expense_local_bn:Number((budgetRow[4]+budgetRow[5]+budgetRow[6]+budgetRow[7]).toFixed(3)),balance_local_bn:Number((budgetRow[1]+budgetRow[2]+budgetRow[3]-budgetRow[4]-budgetRow[5]-budgetRow[6]-budgetRow[7]).toFixed(3))},
  municipalities:{year:municipal.period.fiscal_year,entity_count:municipal.summary.municipalities.entity_count,revenue_local_bn:Number((municipal.summary.municipalities.revenue_actual/1e9).toFixed(3)),expense_local_bn:Number((municipal.summary.municipalities.expense_actual/1e9).toFixed(3)),balance_local_bn:Number((municipal.summary.municipalities.budget_balance/1e9).toFixed(3)),cash_local_bn:Number((municipal.summary.municipalities.cash_current/1e9).toFixed(3)),top:municipalityRank.top.map(municipalRow),bottom:municipalityRank.bottom.map(municipalRow)},
  regions:{year:municipal.period.fiscal_year,entity_count:municipal.summary.regions_excluding_prague.entity_count,revenue_local_bn:Number((municipal.summary.regions_excluding_prague.revenue_actual/1e9).toFixed(3)),expense_local_bn:Number((municipal.summary.regions_excluding_prague.expense_actual/1e9).toFixed(3)),balance_local_bn:Number((municipal.summary.regions_excluding_prague.budget_balance/1e9).toFixed(3)),cash_local_bn:Number((municipal.summary.regions_excluding_prague.cash_current/1e9).toFixed(3))},
  companies:{year:2024,entity_count:enterprises.summary.entity_count,turnover_local_bn:Number((enterprises.summary.turnover_ranked_entities_sum/1000).toFixed(3)),net_result_local_bn:Number((enterprises.summary.net_result_ranked_entities_sum/1000).toFixed(3)),owner_transfers_local_bn:Number((enterprises.summary.budget_transfers_total/1000).toFixed(3)),top:companyRank.top.map(companyRow),bottom:companyRank.bottom.map(companyRow)}
};
const payload={schema_version:"1.0.0",generated_at:new Date().toISOString(),countries,methodology:{
  cs:"Příjmy sektoru vládních institucí jsou jediný konsolidovaný celek. Státní, obecní a krajské rozpočty jsou překrývající se vrstvy s vnitřními transfery. Obrat veřejných firem je komerční top-line mimo rozpočet; do veřejných příjmů patří pouze skutečné odvody vlastníku.",
  en:"General-government revenue is the only consolidated total. State, municipal and regional budgets are overlapping layers with internal transfers. Public-company turnover is a commercial top line outside the budget; only actual owner remittances enter public revenue."
},sources:[
  {title:"IMF World Economic Outlook · general government",url:sovereign.source.url},
  ...budget.sources.map(source=>({title:source.label,url:source.url})),
  ...municipal.sources.map(source=>({title:source.label_cs,url:source.url})),
  ...enterprises.sources.map(source=>({title:source.title,url:source.url}))
]};
await fs.writeFile(new URL("data/country-cash-in.v1.json",root),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote consolidated revenue for ${Object.keys(countries).length} countries and Czech cash-in layers`);
