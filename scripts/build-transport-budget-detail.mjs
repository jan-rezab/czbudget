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
const PUBLIC_DATA = {
  CZE:{detail_status:"harmonised",level_status:"harmonised",note_cs:"Harmonizované členění doplňují transakční data české Státní pokladny.",note_en:"The harmonised breakdown can be extended with transaction-level Czech Treasury data.",next_step_cs:"Doplnit projekty, kapitoly, fondy a obce bez dvojího započtení transferů.",next_step_en:"Add projects, budget chapters, funds and municipalities without double-counting transfers.",sources:[{title:"ČSÚ · Vládní finanční statistika",url:"https://csu.gov.cz/vladni-financni-statistika"},{title:"Monitor · otevřená data",url:"https://monitor.statnipokladna.gov.cz/datovy-katalog/open-data"}]},
  DEU:{detail_status:"harmonised",level_status:"national_bridge",note_cs:"Ekonomická skladba je harmonizovaná; funkční členění podle úrovní vlády je nutné doplnit z německých tabulek.",note_en:"The economic breakdown is harmonised; functional spending by government level needs a German-data bridge.",next_step_cs:"Napojit dopravu v GENESIS na spolkovou, zemskou a místní úroveň.",next_step_en:"Connect GENESIS transport data to federal, state and local government levels.",sources:[{title:"Destatis GENESIS · výdaje podle COFOG",url:"https://genesis.destatis.de/datenbank/online/statistic/81000/table/81000-0413"}]},
  DNK:{detail_status:"harmonised",level_status:"harmonised",note_cs:"StatBank zveřejňuje COFOG podle druhu transakce a umožňuje národní kontrolu Eurostatu.",note_en:"StatBank publishes COFOG by transaction type and supports a national cross-check of Eurostat.",next_step_cs:"Přidat dlouhou řadu a stálé ceny z tabulek OFF25/OFF29.",next_step_en:"Add a longer history and constant-price series from OFF25/OFF29.",sources:[{title:"Statistics Denmark · veřejné finance",url:"https://www.dst.dk/en/Statistik/udgivelser/nyt/relateret?pid=841"}]},
  FRA:{detail_status:"harmonised",level_status:"harmonised",note_cs:"INSEE zveřejňuje COFOG za celek i centrální, místní a sociální subsektory v tabulkách ke stažení.",note_en:"INSEE publishes downloadable COFOG tables for total, central, local and social-security government.",next_step_cs:"Propojit delší historii od roku 1995 a národní revizní poznámky.",next_step_en:"Connect the history from 1995 and national revision notes.",sources:[{title:"INSEE · výdaje podle funkce",url:"https://www.insee.fr/en/statistiques/8068562"}]},
  POL:{detail_status:"harmonised",level_status:"harmonised",note_cs:"Harmonizovaný celek lze doplnit detailními obecními výdaji na dopravu a spoje.",note_en:"The harmonised total can be extended with detailed municipal transport and communications expenditure.",next_step_cs:"Mapovat polskou rozpočtovou klasifikaci na COFOG a konsolidovat transfery.",next_step_en:"Map Polish budget classifications to COFOG and consolidate transfers.",sources:[{title:"Statistics Poland · Local Data Bank",url:"https://bdl.stat.gov.pl/bdl/dane/podgrup/wymiary/27/425/2635"}]},
  SWE:{detail_status:"harmonised",level_status:"harmonised",note_cs:"SCB nabízí spotřebu i investice podle COFOG, úrovně vlády a cenové báze.",note_en:"SCB provides consumption and investment by COFOG, government level and price basis.",next_step_cs:"Přidat stálé ceny a oddělenou národní investiční řadu.",next_step_en:"Add constant prices and the separate national investment series.",sources:[{title:"Statistics Sweden · COFOG PxWeb",url:"https://www.statistikdatabasen.scb.se/pxweb/en/ssd/START__NR__NR0103__NR0103E/NR0103ENS2010T05NA/"}]},
  CHE:{detail_status:"harmonised",level_status:"harmonised",note_cs:"Federální finanční správa publikuje funkční výdaje konfederace, kantonů, obcí a sociálních fondů.",note_en:"The Federal Finance Administration publishes functional spending for the Confederation, cantons, municipalities and social funds.",next_step_cs:"Doplnit čerstvější celkovou délku silnic; fiskální pokrytí je silné.",next_step_en:"Refresh total-road length; fiscal coverage is already strong.",sources:[{title:"Swiss FFA · financial statistics",url:"https://www.efv.admin.ch/en/data-fs"}]},
  GBR:{detail_status:"national_bridge",level_status:"national_bridge",note_cs:"Britská data rozlišují běžné a kapitálové výdaje, funkce, regiony a autoritu; používají však fiskální rok a rámec TES.",note_en:"UK data separates current and capital spending, function, region and authority, but uses financial years and the TES framework.",next_step_cs:"Postavit převod PESA/CRA na kalendářní COFOG bez smíchání metodik.",next_step_en:"Build a PESA/CRA-to-calendar-year COFOG bridge without mixing accounting frameworks.",sources:[{title:"DfT · transport expenditure TSGB13",url:"https://www.gov.uk/government/statistical-data-sets/transport-expenditure-tsgb13"},{title:"HM Treasury · Country and Regional Analysis",url:"https://www.gov.uk/government/statistics/country-and-regional-analysis-2025"}]},
  UKR:{detail_status:"national_bridge",level_status:"national_bridge",note_cs:"Open Budget zveřejňuje plnění státního i místních rozpočtů podle funkční, ekonomické a programové klasifikace.",note_en:"Open Budget publishes state and local execution by functional, economic and programme classifications.",next_step_cs:"Konsolidovat stát a obce, odstranit transfery a dokumentovat válečné revize.",next_step_en:"Consolidate national and local budgets, remove transfers and document wartime revisions.",sources:[{title:"Ukraine Open Budget · výdaje",url:"https://openbudget.gov.ua/en/national-budget/expenses?class=functional"},{title:"Ukraine Open Budget · klasifikace a API",url:"https://openbudget.gov.ua/en/budget-literacy/budget-system/classification/functional"}]},
  USA:{detail_status:"fragmented",level_status:"fragmented",note_cs:"Federální výdaje OMB a státní i místní finance Census jsou veřejné, ale nejsou jedním konsolidovaným COFOG souborem.",note_en:"OMB federal outlays and Census state/local finances are public, but they are not one consolidated COFOG dataset.",next_step_cs:"Sloučit federální, státní a místní dopravu a odečíst federální granty, aby nevzniklo dvojí započtení.",next_step_en:"Combine federal, state and local transport and net out federal grants to avoid double counting.",sources:[{title:"OMB · Historical Tables",url:"https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/"},{title:"U.S. Census · state and local finances",url:"https://www.census.gov/data/developers/data-sets/govslocalfin.html"}]}
};

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
    countries[code]={...country,coverage:"unavailable",reason_cs:"Eurostat COFOG II tuto zemi nepokrývá.",reason_en:"Eurostat COFOG II does not cover this country.",public_data:PUBLIC_DATA[code]};
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
  const levelValues=records.flatMap(record=>Object.values(record.levels)).filter(Number.isFinite);
  countries[code]={...country,coverage:records.length?"available":"unavailable",latest_year:records.at(-1)?.year??null,records,level_coverage:levelValues.length?"available":"unavailable",public_data:PUBLIC_DATA[code]};
}

const payload={
  schema_version:"1.1.0",
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
