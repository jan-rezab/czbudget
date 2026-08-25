#!/usr/bin/env node

import fs from "node:fs/promises";

const YEARS = Array.from({length:10},(_,index)=>2015+index);
const OECD_AREAS = ["CZE","DEU","DNK","FRA","POL","SWE","CHE","GBR","USA","ESP","JPN","NLD","NOR"];
const ALL_AREAS = [...OECD_AREAS,"UKR"];
const CATEGORY_CODES = {health:"GF07",social:"GF10",transport:"GF0405"};
const OECD_URL = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NASEC10@DF_TABLE11,1.1/A.${OECD_AREAS.join("+")}.S13...OTE..${Object.values(CATEGORY_CODES).join("+")}...V..?startPeriod=2015&endPeriod=2024&dimensionAtObservation=AllDimensions`;
const UKRAINE_API = year=>`https://api.openbudget.gov.ua/api/public/generalData?budgetItem=EXPENSES&classificationType=FUNCTIONAL&year=${year}`;
const OMB_URL = "https://www.govinfo.gov/content/pkg/BUDGET-2026-TAB/xls/BUDGET-2026-TAB.xlsx";

const names = {
  CZE:["Česko","Czechia"],DEU:["Německo","Germany"],DNK:["Dánsko","Denmark"],FRA:["Francie","France"],
  POL:["Polsko","Poland"],SWE:["Švédsko","Sweden"],CHE:["Švýcarsko","Switzerland"],GBR:["Spojené království","United Kingdom"],
  USA:["Spojené státy","United States"],UKR:["Ukrajina","Ukraine"],BRA:["Brazílie","Brazil"],
  ESP:["Španělsko","Spain"],JPN:["Japonsko","Japan"],NLD:["Nizozemsko","Netherlands"],NOR:["Norsko","Norway"]
};

const ukraineHistorical = {
  2015:{health:71001.1211,social:176339.8371,transport:31110.3512},
  2016:{health:75503.4347,social:258326.1377,transport:29261.9764},
  2017:{health:102392.4294,social:285761.7,transport:49389.7}
};

const usaFederalTransport = {
  2015:89533,2016:92566,2017:93552,2018:92785,2019:95756,
  2020:145623,2021:154291,2022:131024,2023:126417,2024:136582
};

function parseCsv(text,delimiter=",") {
  const [header,...lines] = text.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
  const keys = header.split(delimiter);
  return lines.filter(Boolean).map(line=>Object.fromEntries(line.split(delimiter).map((value,index)=>[keys[index],value])));
}

async function getText(url) {
  for(let attempt=1;attempt<=4;attempt++) {
    const response=await fetch(url,{headers:{accept:"text/csv","accept-language":"en","user-agent":"CZBudget/1.0"}});
    if(response.ok) return response.text();
    if(attempt===4) throw new Error(`${response.status} ${url}`);
    await new Promise(resolve=>setTimeout(resolve,attempt*750));
  }
}

const benchmark=JSON.parse(await fs.readFile(new URL("../lib/data/sovereign-benchmark.v1.json",import.meta.url)));
const benchmarkSeries=Object.fromEntries(benchmark.series.map(item=>[item.country_code,item]));
const benchmarkCountries=Object.fromEntries(benchmark.countries.map(item=>[item.country_code,item]));
const gdp=(code,year)=>benchmarkSeries[code].metrics.nominal_gdp_local_bn.values.find(item=>item.year===year)?.value;
const ratio=(amountMn,code,year)=>Number((amountMn/(gdp(code,year)*1000)*100).toFixed(3));

const oecdRows=parseCsv(await getText(OECD_URL));
const countries={};
for(const code of ALL_AREAS) {
  countries[code]={
    name_cs:names[code][0],name_en:names[code][1],currency:benchmarkCountries[code].currency_code,
    scope:code==="UKR"?"consolidated_budget":code==="USA"?"mixed_by_category":"general_government",
    categories:{health:[],social:[],transport:[]}
  };
}

for(const code of OECD_AREAS) {
  for(const [category,categoryCode] of Object.entries(CATEGORY_CODES)) {
    if(code==="USA"&&category==="transport") continue;
    const rows=oecdRows.filter(row=>row.REF_AREA===code&&row.EXPENDITURE===categoryCode);
    for(const year of YEARS) {
      const row=rows.find(item=>Number(item.TIME_PERIOD)===year);
      if(!row) throw new Error(`Missing OECD ${category} ${code} ${year}`);
      const amount=Number(row.OBS_VALUE);
      countries[code].categories[category].push({year,amount_local_mn:amount,pct_gdp:ratio(amount,code,year),status:row.OBS_STATUS||""});
    }
  }
}

for(const year of YEARS) {
  const amount=usaFederalTransport[year];
  countries.USA.categories.transport.push({year,amount_local_mn:amount,pct_gdp:ratio(amount,"USA",year),status:"federal_scope"});
}

const ukraine={...ukraineHistorical};
for(const year of YEARS.filter(item=>item>=2018)) {
  const rows=parseCsv(await getText(UKRAINE_API(year)),";");
  const finalRows=rows.filter(row=>row.REP_PERIOD===`12.${year}`&&row.BUDG_TYP==="Z"&&row.FUND_TYP==="T");
  const amount=code=>Number(finalRows.find(row=>row.COD_CONS_FK===code)?.DONE_PERIOD_AMT)/1e6;
  ukraine[year]={health:amount("0700"),social:amount("1000"),transport:amount("0450")};
}
for(const year of YEARS) {
  for(const category of Object.keys(CATEGORY_CODES)) {
    const amount=ukraine[year][category];
    if(!Number.isFinite(amount)) throw new Error(`Missing Ukraine ${category} ${year}`);
    countries.UKR.categories[category].push({year,amount_local_mn:Number(amount.toFixed(3)),pct_gdp:ratio(amount,"UKR",year),status:year<2018?"official_yearbook":"open_budget_api"});
  }
}

for(const [code,country] of Object.entries(countries)) {
  for(const [category,series] of Object.entries(country.categories)) {
    if(series.length!==10||series.some(item=>!Number.isFinite(item.pct_gdp))) throw new Error(`Incomplete ${code} ${category}`);
  }
}

const payload={
  schema_version:"1.0.0",
  generated_at:new Date().toISOString(),
  period:{start:2015,end:2024},
  unit:"pct_gdp",
  categories:{
    health:{cofog:"GF07",label_cs:"Zdravotnictví",label_en:"Health"},
    social:{cofog:"GF10",label_cs:"Sociální ochrana",label_en:"Social protection"},
    transport:{cofog:"GF04.5",label_cs:"Doprava",label_en:"Transport"}
  },
  methodology:{
    cs:"Třináct zemí používá výdaje podle funkce COFOG a nominální HDP. Ukrajina používá konsolidovaný státní a místní rozpočet; USA používají pro dopravu federální výdaje OMB. Brazílie má samostatně načtenou oficiální COFOG tabulku za roky 2023–2024 v národní výdajové vrstvě.",
    en:"Thirteen countries use expenditure by COFOG function and nominal GDP. Ukraine uses the consolidated national and local budget; U.S. transport uses OMB federal outlays. Brazil's official 2023–2024 COFOG table is loaded separately in the national-spending layer."
  },
  countries,
  sources:[
    {id:"oecd-cofog",title:"OECD · Annual government expenditure by function (COFOG)",url:"https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.NAD&df%5Bid%5D=DSD_NASEC10%40DF_TABLE11&df%5Bvs%5D=1.1",api_url:OECD_URL},
    {id:"ukraine-open-budget",title:"Ukraine Open Budget · functional expenditure API",url:"https://openbudget.gov.ua/en",api_url:"https://api.openbudget.gov.ua/swagger-ui.html"},
    {id:"ukraine-yearbooks",title:"Ministry of Finance of Ukraine · Budget of Ukraine 2015–2017",url:"https://www.mof.gov.ua/en/statistichnij-zbirnik"},
    {id:"us-omb",title:"U.S. OMB · Historical Tables, Table 3.1",url:"https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/",download_url:OMB_URL},
    {id:"imf-gdp",title:"IMF World Economic Outlook · nominal GDP",url:benchmark.source.url}
  ]
};

await fs.writeFile(new URL("../data/country-functional-budgets.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote ${Object.keys(countries).length} countries × 3 functions × ${YEARS.length} years`);
