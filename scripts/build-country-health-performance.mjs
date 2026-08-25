#!/usr/bin/env node

import fs from "node:fs/promises";

const COUNTRIES = ["CZE","DEU","DNK","FRA","GBR","POL","SWE","CHE","USA","UKR","BRA","ESP","JPN","NLD","NOR"];
const WORLD_BANK = "https://api.worldbank.org/v2";
const OECD = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD";
const START_YEAR = 2015;

const indicators = {
  health_gdp_pct:"SH.XPD.CHEX.GD.ZS",
  per_capita_ppp:"SH.XPD.CHEX.PP.CD",
  out_of_pocket_pct:"SH.XPD.OOPC.CH.ZS",
  beds_per_1000:"SH.MED.BEDS.ZS",
  physicians_per_1000:"SH.MED.PHYS.ZS",
  nurses_per_1000:"SH.MED.NUMW.P3",
  life_expectancy_years:"SP.DYN.LE00.IN",
  premature_ncd_mortality_pct:"SH.DYN.NCOM.ZS",
  suicide_rate_per_100k:"SH.STA.SUIC.P5",
  under5_mortality_per_1000:"SH.DYN.MORT"
};

const urls = {
  world_bank:Object.fromEntries(Object.entries(indicators).map(([key,id])=>[key,`${WORLD_BANK}/country/${COUNTRIES.join(";")}/indicator/${id}?format=json&per_page=1000&date=${START_YEAR}:2025`])),
  hospital_utilisation:`${OECD},DSD_HEALTH_PROC@DF_AGGR,1.2/.?startPeriod=${START_YEAR}`,
  avoidable_mortality:`${OECD},DSD_HEALTH_STAT@DF_AM,1.1/.?startPeriod=${START_YEAR}`
};

async function fetchJson(url) {
  const response=await fetch(url,{headers:{"user-agent":"PublicSpendingData/1.0"}});
  if(!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchCsv(url) {
  const response=await fetch(url,{headers:{accept:"text/csv","accept-language":"en","user-agent":"PublicSpendingData/1.0"}});
  if(!response.ok) throw new Error(`${response.status} ${url}`);
  const [header,...lines]=(await response.text()).trim().split(/\r?\n/), keys=header.split(",");
  return lines.filter(Boolean).map(line=>Object.fromEntries(line.split(",").map((value,index)=>[keys[index],value])));
}

const wb={};
for(const [key,url] of Object.entries(urls.world_bank)) {
  const payload=await fetchJson(url), rows=payload[1]||[];
  wb[key]=Object.fromEntries(COUNTRIES.map(code=>{
    const series=rows.filter(row=>row.countryiso3code===code&&row.value!==null)
      .map(row=>({year:Number(row.date),value:Number(row.value)})).sort((a,b)=>a.year-b.year);
    return [code,{latest:series.at(-1)||null,series}];
  }));
}

const utilisation=await fetchCsv(urls.hospital_utilisation);
const mortality=await fetchCsv(urls.avoidable_mortality);
const latest=(rows,predicate)=>rows.filter(predicate).sort((a,b)=>Number(b.TIME_PERIOD)-Number(a.TIME_PERIOD))[0]||null;
const observation=row=>row?{value:Number(row.OBS_VALUE),year:Number(row.TIME_PERIOD),status:row.OBS_STATUS||""}:null;

const countries=Object.fromEntries(COUNTRIES.map(code=>{
  const metric=key=>wb[key][code].latest?{...wb[key][code].latest,series:wb[key][code].series}:null;
  const discharge=latest(utilisation,row=>row.REF_AREA===code&&row.MEASURE==="DISCHARGE"&&row.UNIT_MEASURE==="DSC_10P5PS"&&row.FUNCTION==="_T"&&row.MODE_PROVISION==="HBEDT"&&row.CARE_TYPE==="_T");
  const stay=latest(utilisation,row=>row.REF_AREA===code&&row.MEASURE==="STAY"&&row.UNIT_MEASURE==="D"&&row.FUNCTION==="_T"&&row.MODE_PROVISION==="HBEDT"&&row.CARE_TYPE==="_T");
  const occupancy=latest(utilisation,row=>row.REF_AREA===code&&row.MEASURE==="OCC_RATE"&&row.UNIT_MEASURE==="PT_BD_AV"&&row.FUNCTION==="HC1"&&row.CARE_TYPE==="_T");
  const treatable=latest(mortality,row=>row.REF_AREA===code&&row.MEASURE==="TRTM"&&row.UNIT_MEASURE==="DT_10P5HB"&&row.AGE==="_T"&&row.SEX==="_T");
  const preventable=latest(mortality,row=>row.REF_AREA===code&&row.MEASURE==="PREVM"&&row.UNIT_MEASURE==="DT_10P5HB"&&row.AGE==="_T"&&row.SEX==="_T");
  return [code,{
    spending:{health_gdp_pct:metric("health_gdp_pct"),per_capita_ppp:metric("per_capita_ppp"),out_of_pocket_pct:metric("out_of_pocket_pct")},
    workforce:{physicians_per_1000:metric("physicians_per_1000"),nurses_per_1000:metric("nurses_per_1000")},
    capacity:{beds_per_1000:metric("beds_per_1000")},
    utilisation:{discharges_per_100k:observation(discharge),average_length_of_stay_days:observation(stay),curative_bed_occupancy_pct:observation(occupancy)},
    outcomes:{life_expectancy_years:metric("life_expectancy_years"),premature_ncd_mortality_pct:metric("premature_ncd_mortality_pct"),suicide_rate_per_100k:metric("suicide_rate_per_100k"),under5_mortality_per_1000:metric("under5_mortality_per_1000"),treatable_mortality_per_100k:observation(treatable),preventable_mortality_per_100k:observation(preventable)}
  }];
}));

const payload={
  schema_version:"1.0.0",
  generated_at:new Date().toISOString(),
  coverage:"Fifteen-country performance layer. World Bank indicators provide the common spine; OECD hospital utilisation and avoidable mortality have partial country coverage.",
  methodology:{
    cs:"Každý ukazatel používá poslední dostupný rok a rok je publikován spolu s hodnotou. Řady Světové banky přebírají harmonizované údaje WHO a dalších mezinárodních správců. Nemocniční využití a odvratitelná úmrtnost pocházejí z OECD Health Statistics. Rozdílný rok není dopočítán ani nahrazen nulou.",
    en:"Every indicator uses its latest available year, shown alongside the value. World Bank series redistribute harmonised data from WHO and other international custodians. Hospital utilisation and avoidable mortality come from OECD Health Statistics. Different reference years are neither imputed nor treated as zero."
  },
  countries,
  sources:[
    {id:"world-bank-health",title:"World Bank · Health indicators",url:"https://data.worldbank.org/topic/health",api_url:`${WORLD_BANK}/indicator`},
    {id:"oecd-utilisation",title:"OECD · Hospital aggregates",url:"https://data-explorer.oecd.org/",api_url:urls.hospital_utilisation},
    {id:"oecd-avoidable-mortality",title:"OECD · Avoidable mortality",url:"https://data-explorer.oecd.org/",api_url:urls.avoidable_mortality}
  ],
  api_queries:urls
};

await fs.writeFile(new URL("../data/country-health-performance.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote health performance profiles for ${COUNTRIES.length} countries`);
