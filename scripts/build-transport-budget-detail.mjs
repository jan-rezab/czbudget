#!/usr/bin/env node

import fs from "node:fs/promises";

const COUNTRIES = {
  CZE:{geo:"CZ",name_cs:"Česko",name_en:"Czechia",currency:"CZK"},
  DEU:{geo:"DE",name_cs:"Německo",name_en:"Germany",currency:"EUR"},
  DNK:{geo:"DK",name_cs:"Dánsko",name_en:"Denmark",currency:"DKK"},
  FRA:{geo:"FR",name_cs:"Francie",name_en:"France",currency:"EUR"},
  POL:{geo:"PL",name_cs:"Polsko",name_en:"Poland",currency:"PLN"},
  SWE:{geo:"SE",name_cs:"Švédsko",name_en:"Sweden",currency:"SEK"},
  CHE:{geo:"CH",name_cs:"Švýcarsko",name_en:"Switzerland",currency:"CHF"},
  GBR:{geo:"UK",name_cs:"Spojené království",name_en:"United Kingdom",currency:"GBP"},
  UKR:{name_cs:"Ukrajina",name_en:"Ukraine",currency:"UAH"},
  USA:{name_cs:"Spojené státy",name_en:"United States",currency:"USD"}
};
const COMPONENTS = {
  operations:"P2", payroll:"D1", subsidies:"D3", investment:"P5", capital_transfers:"D9"
};
const LEVELS = {central:"S1311",state:"S1312",local:"S1313",social_security:"S1314"};
const BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp";

function valueAt(dataset, selections) {
  let index=0;
  for(let dimensionIndex=0;dimensionIndex<dataset.id.length;dimensionIndex++) {
    const id=dataset.id[dimensionIndex];
    const selected=selections[id]??Object.keys(dataset.dimension[id].category.index)[0];
    const position=dataset.dimension[id].category.index[selected];
    if(position===undefined) return null;
    index=index*dataset.size[dimensionIndex]+position;
  }
  const value=dataset.value?.[index];
  return Number.isFinite(value)?value:null;
}

async function fetchCountry(country) {
  const params=new URLSearchParams({lang:"en",geo:country.geo,unit:"MIO_NAC",cofog99:"GF0405",sinceTimePeriod:"2015",untilTimePeriod:"2024"});
  const response=await fetch(`${BASE}?${params}`,{headers:{"user-agent":"CZBudget/1.0"}});
  if(!response.ok) throw new Error(`${response.status} ${country.geo}`);
  return response.json();
}

const countries={};
for(const [code,country] of Object.entries(COUNTRIES)) {
  if(!country.geo) {
    countries[code]={...country,coverage:"unavailable",reason_cs:"Eurostat COFOG II tuto zemi nepokrývá.",reason_en:"Eurostat COFOG II does not cover this country."};
    continue;
  }
  const dataset=await fetchCountry(country);
  const years=Object.keys(dataset.dimension.time.category.index).map(Number).sort((a,b)=>a-b);
  const records=[];
  for(const year of years) {
    const total=valueAt(dataset,{sector:"S13",na_item:"TE",time:String(year)});
    if(!Number.isFinite(total)) continue;
    const components=Object.fromEntries(Object.entries(COMPONENTS).map(([key,item])=>[key,valueAt(dataset,{sector:"S13",na_item:item,time:String(year)})??0]));
    const allocated=Object.values(components).reduce((sum,value)=>sum+value,0);
    components.other=Number((total-allocated).toFixed(3));
    const levels=Object.fromEntries(Object.entries(LEVELS).map(([key,sector])=>[key,valueAt(dataset,{sector,na_item:"TE",time:String(year)})]));
    records.push({year,total,components,levels});
  }
  countries[code]={...country,coverage:records.length?"available":"unavailable",latest_year:records.at(-1)?.year??null,records};
}

const payload={
  schema_version:"1.0.0",
  generated_at:new Date().toISOString(),
  unit:"million_national_currency",
  function:{code:"GF0405",label_cs:"Doprava",label_en:"Transport"},
  methodology:{
    cs:"Skutečné konsolidované výdaje sektoru vládních institucí na dopravu (COFOG 04.5), členěné podle ekonomického druhu a úrovně vlády. Složka „ostatní“ dopočítává položky mimo pět hlavních zobrazených skupin. Úrovně vlády jsou konsolidované uvnitř každého subsektoru, proto jejich prostý součet nemusí přesně odpovídat konsolidovanému celku.",
    en:"Actual consolidated general-government expenditure on transport (COFOG 04.5), split by economic type and level of government. ‘Other’ is the residual outside the five displayed main groups. Government levels are consolidated within each subsector, so their simple sum need not exactly match the consolidated total."
  },
  countries,
  sources:[{
    id:"eurostat-gov-10a-exp",
    title:"Eurostat · General government expenditure by function (COFOG)",
    url:"https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table?lang=en",
    metadata_url:"https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_exp_esms.htm",
    api_url:BASE
  }]
};

await fs.writeFile(new URL("../data/transport-budget-detail.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote detailed transport budgets for ${Object.values(countries).filter(country=>country.coverage==="available").length} countries`);
