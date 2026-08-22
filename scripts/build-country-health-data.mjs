#!/usr/bin/env node

import fs from "node:fs/promises";

const AREAS = ["CZE","DEU","FRA","POL","GBR","USA","CHE","SWE","DNK"];
const AREA_KEY = AREAS.join("+");
const SHA = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD,DSD_SHA@DF_SHA,1.1";
const BEDS = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD,DSD_HEALTH_REAC_HOSP@DF_BEDS_FUNC,1.1";

const profiles = {
  CZE:{currency:"CZK",architecture_cs:"Veřejné zdravotní pojištění shromažďuje povinné odvody a státní platby. Zdravotní pojišťovny nakupují péči od veřejných i soukromých poskytovatelů; síť zařízení publikuje ÚZIS v registru NRPZS.",architecture_en:"Compulsory public health insurance pools contributions and state payments. Health insurers purchase care from public and private providers; ÚZIS publishes the facility network through the NRPZS register.",official_title:"ÚZIS · registr poskytovatelů NRPZS",official_url:"https://nrpzs.uzis.cz/"},
  POL:{currency:"PLN",architecture_cs:"Povinné veřejné pojištění soustřeďuje Národní fond zdraví (NFZ). Pojistné a státní transfery se mění v celostátní plán úhrad; nemocnice vlastní stát, kraje, okresy i obce.",architecture_en:"Compulsory public insurance is pooled by the National Health Fund (NFZ). Contributions and state transfers become a national purchasing plan; hospitals are owned by central, regional, county and municipal authorities.",official_title:"NFZ · finance and plans",official_url:"https://www.nfz.gov.pl/bip/finanse-nfz/"},
  DEU:{currency:"EUR",architecture_cs:"Zákonné zdravotní pojišťovny shromažďují pojistné a dostávají prostředky přes Gesundheitsfonds. Provoz nemocnic hradí pojišťovny, zatímco investice mají financovat spolkové země — klasický dvojí tok.",architecture_en:"Statutory sickness funds collect contributions and receive allocations through the Gesundheitsfonds. Insurers fund hospital operations while the Länder are responsible for capital investment — the classic dual-financing flow.",official_title:"BMG · statutory health financing",official_url:"https://www.bundesgesundheitsministerium.de/finanzierung-gkv.html"},
  GBR:{currency:"GBP",architecture_cs:"Daňové příjmy proudí přes čtyři decentralizované systémy NHS. Agregát OECD pokrývá celé Spojené království; veřejné účty jednotlivých poskytovatelů jsou nejsnáze dostupné pro NHS England.",architecture_en:"Tax revenue flows through four devolved NHS systems. The OECD aggregate covers the whole United Kingdom; provider-level public accounts are most readily available for NHS England.",official_title:"NHS England · financial accounting",official_url:"https://www.england.nhs.uk/financial-accounting-and-reporting/"},
  FRA:{currency:"EUR",architecture_cs:"Povinné pojištění Assurance Maladie je financováno pojistným a daněmi. Parlament schvaluje celkový výdajový cíl ONDAM; regionální agentury a pojištění směrují úhrady poskytovatelům.",architecture_en:"Compulsory Assurance Maladie is financed by contributions and taxes. Parliament approves the ONDAM spending target; regional agencies and insurance funds route payments to providers.",official_title:"DREES · French health accounts",official_url:"https://drees.solidarites-sante.gouv.fr/sources-outils-et-enquetes/les-comptes-de-la-sante"},
  USA:{currency:"USD",architecture_cs:"Peníze tečou paralelně přes Medicare, Medicaid, zaměstnavatelské a individuální pojištění i přímé platby. Nemocnice jsou veřejné, neziskové i ziskové; CMS zveřejňuje standardizované cost reports po zařízeních.",architecture_en:"Money flows in parallel through Medicare, Medicaid, employer and individual insurance, and direct payments. Hospitals can be public, non-profit or for-profit; CMS publishes standardised facility cost reports.",official_title:"CMS · hospital cost reports",official_url:"https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports"},
  CHE:{currency:"CHF",architecture_cs:"Povinné pojištění poskytují konkurenční soukromé pojišťovny; kantony dotují pojistné a spolufinancují nemocniční péči. SwissDRG rozděluje platby za případy mezi pojišťovny a kantony.",architecture_en:"Compulsory insurance is supplied by competing private insurers; cantons subsidise premiums and co-finance hospital care. SwissDRG case payments split hospital funding between insurers and cantons.",official_title:"FSO · health costs and financing",official_url:"https://www.bfs.admin.ch/bfs/en/home/statistics/health/costs-financing.html"},
  SWE:{currency:"SEK",architecture_cs:"Regiony vybírají daně a nakupují většinu zdravotní péče; stát přidává obecné a cílené granty. Obce financují významnou část dlouhodobé péče, takže zdravotní a sociální rozpočty se protínají.",architecture_en:"Regions levy taxes and purchase most healthcare, supplemented by general and earmarked central-government grants. Municipalities fund much long-term care, so health and social-care budgets overlap.",official_title:"Socialstyrelsen · health statistics",official_url:"https://www.socialstyrelsen.se/en/statistics-and-data/statistics/"},
  DNK:{currency:"DKK",architecture_cs:"Stát financuje regiony blokovými a částečně výkonovými granty; regiony provozují nemocnice a nakupují primární péči. Obce spolufinancují péči a odpovídají za prevenci a rehabilitaci.",architecture_en:"Central government funds regions through block and partly activity-based grants; regions run hospitals and purchase primary care. Municipalities co-finance care and are responsible for prevention and rehabilitation.",official_title:"Danish Health Authority · health system",official_url:"https://www.sst.dk/en/english"}
};

const queries = {
  public_compulsory:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH.HF1._Z._T._T._T._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  out_of_pocket:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH.HF3._Z._T._T._T._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  hospitals:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP1._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  residential_ltc:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP2._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  ambulatory:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP3._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  retailers:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP5._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  gdp:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.PT_B1GQ._T._Z._T._T._T._Z._Z._Z?startPeriod=2024&endPeriod=2024`,
  per_capita_ppp:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.USD_PPP_PS._T._Z._T._T._T._Z._Z.Q?startPeriod=2024&endPeriod=2024`,
  per_capita_local:`${SHA}/${AREA_KEY}.A.EXP_HEALTH.XDC_PS._T._Z._T._T._T._Z._Z.V?startPeriod=2024&endPeriod=2024`,
  beds:`${BEDS}/${AREA_KEY}..10P3HB...._T..?startPeriod=2022&endPeriod=2024`
};

function parseCsv(text) {
  const [header,...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return lines.filter(Boolean).map(line => Object.fromEntries(line.split(",").map((value,index)=>[keys[index],value])));
}

async function rows(url) {
  for (let attempt=1;attempt<=4;attempt++) {
    const response = await fetch(url,{headers:{accept:"text/csv","accept-language":"en","user-agent":"PublicSpendingData/1.0"}});
    if (response.ok) return parseCsv(await response.text());
    if (attempt===4) throw new Error(`${response.status} ${url}`);
    await new Promise(resolve=>setTimeout(resolve,attempt*750));
  }
}

const results = {};
for (const [key,url] of Object.entries(queries)) results[key] = await rows(url);
const value = (key,code) => Number(results[key].find(row=>row.REF_AREA===code)?.OBS_VALUE);
const bed = (code) => results.beds
  .filter(row=>row.REF_AREA===code && row.HEALTH_FUNCTION==="_T" && row.CARE_TYPE==="_T" && Number(row.OBS_VALUE)>0)
  .sort((a,b)=>Number(b.TIME_PERIOD)-Number(a.TIME_PERIOD))[0];

const countries = Object.fromEntries(AREAS.map(code=>{
  const financing = {public_compulsory:value("public_compulsory",code),out_of_pocket:value("out_of_pocket",code)};
  financing.voluntary_other = 100-financing.public_compulsory-financing.out_of_pocket;
  const providers = {hospitals:value("hospitals",code),residential_ltc:value("residential_ltc",code),ambulatory:value("ambulatory",code),retailers:value("retailers",code)};
  providers.other = 100-Object.values(providers).reduce((sum,item)=>sum+item,0);
  const latestBed = bed(code);
  return [code,{
    ...profiles[code],year:2024,
    health_gdp_pct:value("gdp",code),
    per_capita_ppp:value("per_capita_ppp",code),
    per_capita_local:value("per_capita_local",code),
    financing:Object.fromEntries(Object.entries(financing).map(([key,item])=>[key,Number(item.toFixed(3))])),
    providers:Object.fromEntries(Object.entries(providers).map(([key,item])=>[key,Number(item.toFixed(3))])),
    beds_per_1000:Number(latestBed.OBS_VALUE),bed_year:Number(latestBed.TIME_PERIOD),bed_status:latestBed.OBS_STATUS||""
  }];
}));

const payload = {
  schema_version:"1.0.0",
  generated_at:new Date().toISOString(),
  coverage:"Nine OECD country profiles in the sovereign benchmark; Ukraine uses separately sourced functional expenditure data",
  methodology:{
    cs:"Podíly jsou běžné výdaje na zdravotnictví podle System of Health Accounts 2011. Benchmark na lůžko je odhad: výdaje na obyvatele × podíl nemocnic ÷ lůžka na obyvatele. Nejde o účetní výnos konkrétní nemocnice ani žebříček kvality.",
    en:"Shares are current health expenditure under the System of Health Accounts 2011. The per-bed benchmark is an estimate: spending per capita × hospital share ÷ beds per capita. It is neither a named hospital's accounting revenue nor a quality ranking."
  },
  countries,
  sources:[
    {title:"OECD Health expenditure and financing",url:"https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.ELS.HD&df%5Bid%5D=DSD_SHA%40DF_SHA&df%5Bvs%5D=1.1"},
    {title:"OECD Hospital beds by function",url:"https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.ELS.HD&df%5Bid%5D=DSD_HEALTH_REAC_HOSP%40DF_BEDS_FUNC&df%5Bvs%5D=1.1"}
  ],
  api_queries:queries
};

await fs.writeFile(new URL("../data/country-health.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote ${AREAS.length} country profiles`);
