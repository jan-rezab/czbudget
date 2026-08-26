#!/usr/bin/env node

import fs from "node:fs/promises";
import https from "node:https";

const OUTPUT = new URL("../data/transport-performance.v1.json", import.meta.url);
const OECD_URL = "https://sdmx.oecd.org/public/rest/v1/data/OECD.ITF,DSD_INFRINV@DF_INFRINV,1.0/?startPeriod=2015";
const EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

const COUNTRIES = {
  CZE:{geo:"CZ",name_cs:"Česko",name_en:"Czechia"}, DEU:{geo:"DE",name_cs:"Německo",name_en:"Germany"},
  DNK:{geo:"DK",name_cs:"Dánsko",name_en:"Denmark"}, FRA:{geo:"FR",name_cs:"Francie",name_en:"France"},
  GBR:{geo:"UK",name_cs:"Spojené království",name_en:"United Kingdom"}, POL:{geo:"PL",name_cs:"Polsko",name_en:"Poland"},
  SWE:{geo:"SE",name_cs:"Švédsko",name_en:"Sweden"}, CHE:{geo:"CH",name_cs:"Švýcarsko",name_en:"Switzerland"},
  UKR:{geo:"UA",name_cs:"Ukrajina",name_en:"Ukraine"}, USA:{geo:null,name_cs:"Spojené státy",name_en:"United States"},
  BRA:{geo:null,name_cs:"Brazílie",name_en:"Brazil"}, ESP:{geo:"ES",name_cs:"Španělsko",name_en:"Spain"},
  FIN:{geo:"FI",name_cs:"Finsko",name_en:"Finland"}, JPN:{geo:null,name_cs:"Japonsko",name_en:"Japan"},
  NLD:{geo:"NL",name_cs:"Nizozemsko",name_en:"Netherlands"}, NOR:{geo:"NO",name_cs:"Norsko",name_en:"Norway"}
};

const NATIONAL_SOURCES = {
  CZE:{condition_status:"source_available",condition_year:null,machine_readable:"partial",condition_note_en:"ŘSD publishes network, traffic, construction and project material; pavement-condition and completed repair outputs still require a stable national extract.",condition_note_cs:"ŘSD zveřejňuje síť, dopravu, výstavbu a projektové materiály; stav vozovek a dokončené opravy ještě vyžadují stabilní národní export.",sources:[{title:"ŘSD · construction project leaflets",url:"https://letaky.rsd.cz/"},{title:"Správa železnic · open data",url:"https://www.spravazeleznic.cz/o-nas/vse-o-sprave-zeleznic/otevrena-data"}]},
  DEU:{condition_status:"available",condition_year:2024,machine_readable:"partial",condition_note_en:"Federal-road surfaces are measured under ZEB; Autobahn financing plans cover preservation, bridge modernisation and new capacity.",condition_note_cs:"Povrchy spolkových silnic měří systém ZEB; plány Autobahn pokrývají údržbu, modernizaci mostů a nové kapacity.",sources:[{title:"FBA · ZEB road-condition assessment",url:"https://www.fba.bund.de/DE/Themen/Zustandserfassung_Zustandsbewertung/Zustandserfassung_Zustandsbewertung.html"},{title:"Autobahn GmbH · financing plans",url:"https://www.autobahn.de/planen-bauen/finanzierungs-und-realisierungsplaene"}]},
  DNK:{condition_status:"source_available",condition_year:null,machine_readable:"partial",condition_note_en:"The Road Directorate publishes state-road projects and pavement maintenance; municipal condition uses a separate reporting perimeter.",condition_note_cs:"Ředitelství silnic zveřejňuje projekty státních silnic a údržbu povrchů; obecní stav používá jiný vykazovací rozsah.",sources:[{title:"Vejdirektoratet · road projects",url:"https://www.vejdirektoratet.dk/sektion/vores-projekter"},{title:"Vejdirektoratet · municipal maintenance guidance",url:"https://www.vejdirektoratet.dk/udgivelse/synliggoerelse-af-kommunal-vejvedligeholdelse-inspiration-til-kommuner"}]},
  FRA:{condition_status:"available",condition_year:2024,machine_readable:"yes",condition_note_en:"The state publishes maintenance and operating expenditure for the non-concession national network by activity and territory.",condition_note_cs:"Stát zveřejňuje výdaje na údržbu a provoz nekoncesionářské národní sítě podle činnosti a území.",sources:[{title:"data.gouv.fr · national-road maintenance spending",url:"https://www.data.gouv.fr/datasets/depenses-dentretien-et-dexploitation-du-reseau-routier-national-non-concede"},{title:"Ministry · road-project ex-post evaluations",url:"https://www.ecologie.gouv.fr/politiques-publiques/bilans-ex-post-projets-routiers-bilans-loti"}]},
  GBR:{condition_status:"available",condition_year:2025,machine_readable:"yes",condition_note_en:"DfT publishes road condition, maintenance expenditure and kilometres treated; England roads and Great Britain rail have different perimeters.",condition_note_cs:"DfT zveřejňuje stav silnic, výdaje na údržbu a ošetřené kilometry; anglické silnice a britská železnice mají odlišný rozsah.",sources:[{title:"DfT · road condition and maintenance tables",url:"https://www.gov.uk/government/statistical-data-sets/road-condition-statistics-data-tables-rdc"},{title:"ORR · Network Rail finance",url:"https://www.orr.gov.uk/annual-efficiency-and-finance-assessment-network-rail-2025/annex-a"}]},
  POL:{condition_status:"available",condition_year:2024,machine_readable:"partial",condition_note_en:"GDDKiA publishes annual pavement-condition reports, maps and geostatistical summaries for national roads.",condition_note_cs:"GDDKiA zveřejňuje roční zprávy o stavu vozovek, mapy a geostatistická shrnutí státních silnic.",sources:[{title:"GDDKiA · pavement-condition reports",url:"https://www.gov.pl/web/gddkia/raporty"},{title:"GDDKiA · indexed unit costs",url:"https://www.gov.pl/web/gddkia/analiza-kosztow-i-korzysci"}]},
  SWE:{condition_status:"available",condition_year:2025,machine_readable:"yes",condition_note_en:"Trafikverket exposes measured road-surface condition and traffic information through public systems and APIs.",condition_note_cs:"Trafikverket zpřístupňuje měřený stav povrchů a dopravní informace ve veřejných systémech a API.",sources:[{title:"Trafikverket · pavement condition PMS",url:"https://pmsv4.trafikverket.se/"},{title:"Trafikverket · open traffic API",url:"https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/"}]},
  CHE:{condition_status:"available",condition_year:2024,machine_readable:"partial",condition_note_en:"ASTRA reports national-road asset condition and planned maintenance expenditure annually.",condition_note_cs:"ASTRA každoročně vykazuje stav majetku národních silnic a plánované výdaje na údržbu.",headline:{label_en:"Assets in good or very good condition",label_cs:"Majetek v dobrém nebo velmi dobrém stavu",value:91,unit:"percent",year:2024},sources:[{title:"ASTRA · national-road condition report",url:"https://www.astra.admin.ch/dam/astra/de/bilder/abteilung_strasseninfrastrukturallgemein/netzzustandsbericht_2023/netzzustandsbericht_2024.pdf.download.pdf/Netzzustandsbericht_2024.pdf"},{title:"ASTRA · annual construction programmes",url:"https://www.astra.admin.ch/de/jaehrliche-bauprogramme"}]},
  UKR:{condition_status:"fragmented",condition_year:2025,machine_readable:"yes",condition_note_en:"Wartime repairs and reconstruction are project-based. DREAM exposes investment projects and Prozorro exposes tenders and contracts; a stable national condition denominator is unavailable.",condition_note_cs:"Válečné opravy a obnova jsou projektové. DREAM zpřístupňuje investiční projekty a Prozorro zakázky a smlouvy; stabilní národní jmenovatel stavu není dostupný.",sources:[{title:"DREAM · transport project pipeline",url:"https://www.dream.gov.ua/pip-pipeline?filter%5Bsector%5D=E"},{title:"Prozorro · procurement API",url:"https://prozorro.gov.ua/openprocurement"}]},
  USA:{condition_status:"available",condition_year:2024,machine_readable:"yes",condition_note_en:"FHWA Highway Statistics provides pavement and bridge condition, mileage, vehicle-miles, capital outlay and maintenance by state and government level.",condition_note_cs:"FHWA Highway Statistics uvádí stav vozovek a mostů, délku, vozokilometry, investice a údržbu podle státu a úrovně vlády.",sources:[{title:"FHWA · Highway Statistics 2024",url:"https://www.fhwa.dot.gov/policyinformation/statistics/2024/"},{title:"FRA · national rail GIS and APIs",url:"https://railroads.dot.gov/rail-network-development/maps-and-data/maps-geographic-information-system/maps-geographic"}]},
  BRA:{condition_status:"fragmented",condition_year:null,machine_readable:"partial",condition_note_en:"ANTT publishes modal panels and the Treasury publishes harmonised expenditure, but road-condition, investment and delivery data remain split across agencies and levels of government.",condition_note_cs:"ANTT zveřejňuje modální panely a státní pokladna harmonizované výdaje, ale stav silnic, investice a realizace zůstávají rozdělené mezi úřady a úrovně vlády.",sources:[{title:"ANTT · strategic data panels",url:"https://www.gov.br/antt/pt-br/assuntos/informacoes-estrategicas/paineis_interativos"},{title:"Tesouro Nacional · harmonised fiscal statistics",url:"https://www.gov.br/tesouronacional/en/fiscal-policy/harmonized-fiscal-statistics"}]},
  ESP:{condition_status:"source_available",condition_year:null,machine_readable:"partial",condition_note_en:"The ministry publishes infrastructure indicators, budgets and project material; this layer currently uses harmonised OECD/Eurostat series.",condition_note_cs:"Ministerstvo zveřejňuje infrastrukturní ukazatele, rozpočty a projektové podklady; tato vrstva zatím používá harmonizované řady OECD/Eurostatu.",sources:[{title:"Ministerio de Transportes · economic information",url:"https://www.transportes.gob.es/el-ministerio/informacion-economica"}]},
  FIN:{condition_status:"source_available",condition_year:null,machine_readable:"yes",condition_note_en:"Fintraffic and Statistics Finland publish transport and infrastructure statistics; the comparable layer uses OECD/Eurostat series.",condition_note_cs:"Fintraffic a Statistics Finland zveřejňují dopravní a infrastrukturní statistiky; srovnatelná vrstva používá řady OECD/Eurostatu.",sources:[{title:"Statistics Finland · transport",url:"https://stat.fi/en/topic/transport-and-tourism"}]},
  JPN:{condition_status:"source_available",condition_year:null,machine_readable:"partial",condition_note_en:"MLIT publishes national transport and railway statistics, while OECD supplies comparable investment and maintenance observations where available.",condition_note_cs:"MLIT zveřejňuje národní dopravní a železniční statistiky, zatímco OECD poskytuje srovnatelné údaje o investicích a údržbě tam, kde jsou dostupné.",sources:[{title:"MLIT · statistics",url:"https://www.mlit.go.jp/english/statistics.html"},{title:"MLIT · railway statistics",url:"https://www.mlit.go.jp/statistics/details/tetsudo_list.html"}]},
  NLD:{condition_status:"source_available",condition_year:null,machine_readable:"yes",condition_note_en:"National open data and budget documents complement the harmonised OECD/Eurostat investment, maintenance and rail series.",condition_note_cs:"Národní otevřená data a rozpočtové dokumenty doplňují harmonizované řady OECD/Eurostatu pro investice, údržbu a železnice.",sources:[{title:"Government of the Netherlands · mobility open data",url:"https://data.overheid.nl/en/communities/mobiliteit"}]},
  NOR:{condition_status:"source_available",condition_year:null,machine_readable:"yes",condition_note_en:"Statistics Norway and the National Transport Plan complement the harmonised OECD/Eurostat series.",condition_note_cs:"Statistics Norway a Národní dopravní plán doplňují harmonizované řady OECD/Eurostatu.",sources:[{title:"Statistics Norway · transport",url:"https://www.ssb.no/en/transport-og-reiseliv"},{title:"National Transport Plan",url:"https://www.regjeringen.no/en/topics/transport-and-communications/national-transport-plan/id2475111/"}]}
};

const PROJECTS = [
  {id:"CZE-D7-KNOVIZ-SLANY",country:"CZE",mode:"road",asset_type:"motorway_widening",project_name:"D7 Knovíz – Slaný-západ",status:"construction",cost_stage:"contract_award",route_km:6.6,cost_local_million:1535.9,currency:"CZK",price_year:2024,tunnel_km:0,urbanity:"mixed",cost_scope:"construction contract; excludes VAT",source:{title:"ŘSD · signed construction contract",url:"https://kraje.rsd.cz/stredocesky/blog/2024/11/27/smlouva-se-zhotovitelem-dostavby-dalnice-d7-mezi-slanym-a-knovizi-uzavrena/"}},
  {id:"CZE-D7-KUTROVICE-PANENSKY-TYNEC",country:"CZE",mode:"road",asset_type:"motorway_widening",project_name:"D7 Kutrovice – Panenský Týnec",status:"construction",cost_stage:"contract_award",route_km:6.764,cost_local_million:1319.404038,currency:"CZK",price_year:2023,tunnel_km:0,urbanity:"rural",cost_scope:"construction contract; excludes VAT",source:{title:"Ministry of Transport · construction start and contract value",url:"https://md.gov.cz/Media/Media-a-tiskove-zpravy/Reditelstvi-silnic-a-dalnic-zacalo-stavet-novy-use?returl=%2FMedia%2FMedia-a-tiskove-zpravy%2FZ-Planetaria-az-ke-hvezdam-Cesko-rekapituluje-svo"}},
  {id:"CZE-D0-518-RUZYNE-SUCHDOL",country:"CZE",mode:"road",asset_type:"motorway_tunnel_heavy",project_name:"D0 518 Ruzyně – Suchdol",status:"planned",cost_stage:"official_estimate",route_km:8.26,cost_local_million:10658.98,currency:"CZK",price_year:2024,tunnel_km:3.45,urbanity:"urban",cost_scope:"official construction-cost estimate; excludes VAT",source:{title:"ŘSD · northern Prague ring preparation",url:"https://kraje.rsd.cz/stredocesky/blog/2024/09/03/priprava-dostavby-severni-casti-prazskeho-okruhu-pokrocila/"}},
  {id:"POL-S17-PIASKI-LOPIENNIK",country:"POL",mode:"road",asset_type:"expressway",project_name:"S17 Piaski Wschód – Łopiennik",status:"awarded",cost_stage:"contract_award",route_km:16,cost_local_million:810,currency:"PLN",price_year:2024,tunnel_km:0,urbanity:"mixed",cost_scope:"design_and_build_contract; reported values are approximate",source:{title:"GDDKiA · contract announcement",url:"https://www.gov.pl/web/gddkia/rok-pelen-umow-podpisalismy-wlasnie-30-i-31"}},
  {id:"POL-S19-JAWORNIK-LUTCZA",country:"POL",mode:"road",asset_type:"expressway_tunnel_heavy",project_name:"S19 Jawornik – Lutcza",status:"construction",cost_stage:"contract_award",route_km:5.2,cost_local_million:1900,currency:"PLN",price_year:2025,tunnel_km:3,urbanity:"rural",cost_scope:"contract value; approximately 3 km of tunnel",source:{title:"GDDKiA · projects in construction",url:"https://www.gov.pl/web/gddkia/ponad-1600-km-drog-w-realizacji"}},
  {id:"CHE-A16-TRANSJURANE",country:"CHE",mode:"road",asset_type:"motorway_tunnel_heavy",project_name:"A16 Transjurane",status:"completed",cost_stage:"final_outturn",route_km:85,cost_local_million:6600,currency:"CHF",price_year:2017,tunnel_km:37,bridge_km:6,urbanity:"mixed",cost_scope:"completed corridor total; includes 37 km of tunnels and 6 km of bridges",source:{title:"ASTRA · Roads and Traffic 2017",url:"https://www.astra.admin.ch/dam/astra/de/dokumente/abteilung_direktionsgeschaefteallgemein/strassen-verkehr/strassenundverkehr2017.pdf.download.pdf/Strassen%2520und%2520Verkehr%25202017%2520-%2520Entwicklungen%2C%2520Zahlen%2C%2520Fakten.pdf"}}
].map(project=>({...project,cost_per_route_km_local_million:Number((project.cost_local_million/project.route_km).toFixed(3))}));

function csvRows(text) {
  const [header,...lines]=text.trim().split(/\r?\n/); const keys=header.split(",");
  return lines.map(line=>Object.fromEntries(line.split(",").map((value,index)=>[keys[index],value])));
}

function fetchText(url,headers={}) {
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{"user-agent":"PublicSpendingData/1.0",...headers}},response=>{
      if(response.statusCode>=300&&response.statusCode<400&&response.headers.location)return resolve(fetchText(new URL(response.headers.location,url),headers));
      const chunks=[]; response.on("data",chunk=>chunks.push(chunk)); response.on("end",()=>response.statusCode>=200&&response.statusCode<300?resolve(Buffer.concat(chunks).toString("utf8")):reject(new Error(`${response.statusCode} ${url}`))); response.on("error",reject);
    }).on("error",reject);
  });
}

function valueAt(dataset,selections) {
  let index=0;
  for(let dimensionIndex=0;dimensionIndex<dataset.id.length;dimensionIndex++) {
    const id=dataset.id[dimensionIndex]; const selected=selections[id]??Object.keys(dataset.dimension[id].category.index)[0];
    const position=dataset.dimension[id].category.index[selected]; if(position===undefined)return null;
    index=index*dataset.size[dimensionIndex]+position;
  }
  const value=dataset.value?.[index]??dataset.value?.[String(index)]; return Number.isFinite(value)?value:null;
}

function jsonStatSeries(dataset,selections) {
  if(!dataset?.dimension?.time)return [];
  return Object.keys(dataset.dimension.time.category.index).map(year=>({year:Number(year),value:valueAt(dataset,{...selections,time:year})})).filter(point=>Number.isFinite(point.value));
}

async function fetchJson(url) {
  const response=await fetch(url,{headers:{"user-agent":"PublicSpendingData/transport-performance"}});
  if(!response.ok)throw new Error(`${response.status} ${url}`); return response.json();
}

async function eurostatRail(country) {
  if(!country.geo)return {coverage:"national_bridge",network:[],passenger_km:[],freight_tonne_km:[]};
  try {
    const query=`lang=en&geo=${country.geo}&sinceTimePeriod=2015`;
    const [network,passengers,freight]=await Promise.all([
      fetchJson(`${EUROSTAT}/rail_if_line_tr?${query}`), fetchJson(`${EUROSTAT}/rail_pa_typepas?${query}`), fetchJson(`${EUROSTAT}/rail_go_total?${query}`)
    ]);
    const total=jsonStatSeries(network,{freq:"A",tra_infr:"TOTAL",n_tracks:"TOTAL",unit:"KM"});
    const electrified=jsonStatSeries(network,{freq:"A",tra_infr:"RL_ELC",n_tracks:"TOTAL",unit:"KM"});
    const byYear=new Map(electrified.map(point=>[point.year,point.value]));
    return {coverage:total.length?"harmonised":"national_bridge",network:total.map(point=>({...point,unit:"route_km",electrified_km:byYear.get(point.year)??null,electrified_share_pct:byYear.has(point.year)?Number((byYear.get(point.year)/point.value*100).toFixed(2)):null})),passenger_km:jsonStatSeries(passengers,{freq:"A",unit:"MIO_PKM",tra_cov:"TOTAL"}).map(point=>({...point,unit:"million_passenger_km"})),freight_tonne_km:jsonStatSeries(freight,{freq:"A",unit:"MIO_TKM"}).map(point=>({...point,unit:"million_tonne_km"}))};
  } catch(error) {
    return {coverage:"national_bridge",network:[],passenger_km:[],freight_tonne_km:[],error:String(error.message)};
  }
}

const oecdRows=csvRows(await fetchText(OECD_URL,{accept:"text/csv"})).filter(row=>COUNTRIES[row.REF_AREA]&&row.OBS_VALUE!=="");

function oecdSeries(code,measure,mode,priceBase) {
  return oecdRows.filter(row=>row.REF_AREA===code&&row.MEASURE===measure&&row.TRANSPORT_MODE===mode&&row.UNIT_MEASURE==="EUR"&&row.PRICE_BASE===priceBase).map(row=>({year:Number(row.TIME_PERIOD),value:Number(row.OBS_VALUE),unit:"eur",price_base:priceBase==="Q"?"constant_2015":"current",status:row.OBS_STATUS||null})).sort((a,b)=>a.year-b.year);
}

const railEntries=await Promise.all(Object.entries(COUNTRIES).map(async([code,country])=>[code,await eurostatRail(country)]));
const railByCountry=Object.fromEntries(railEntries);
const countries=Object.fromEntries(Object.entries(COUNTRIES).map(([code,country])=>[code,{...country,rail:railByCountry[code],infrastructure_spending:{road:{investment_constant_eur:oecdSeries(code,"INV","ROAD","Q"),investment_current_eur:oecdSeries(code,"INV","ROAD","V"),maintenance_constant_eur:oecdSeries(code,"MNT","ROAD","Q"),maintenance_current_eur:oecdSeries(code,"MNT","ROAD","V")},motorways:{investment_constant_eur:oecdSeries(code,"INV","MOTORWAYS","Q"),maintenance_constant_eur:oecdSeries(code,"MNT","MOTORWAYS","Q")},rail:{investment_constant_eur:oecdSeries(code,"INV","RAIL","Q"),investment_current_eur:oecdSeries(code,"INV","RAIL","V"),maintenance_constant_eur:oecdSeries(code,"MNT","RAIL","Q"),maintenance_current_eur:oecdSeries(code,"MNT","RAIL","V")}},condition_and_repairs:NATIONAL_SOURCES[code]}]));

const payload={schema_version:"1.0.0",generated_at:new Date().toISOString(),methodology:{en:"Infrastructure investment and maintenance are kept separate and use OECD-ITF definitions. Constant-euro series use the OECD 2015 price base. Rail network and traffic use Eurostat definitions. Condition measures retain national definitions and are never ranked without a shared denominator. Project cost per kilometre is calculated only for records with an explicit cost stage, scope and route length; route-km and lane-km must not be mixed.",cs:"Investice do infrastruktury a údržba zůstávají oddělené a používají definice OECD-ITF. Řady ve stálých eurech používají cenovou bázi OECD 2015. Železniční síť a provoz používají definice Eurostatu. Ukazatele stavu zachovávají národní definice a bez společného jmenovatele se neřadí. Náklady na kilometr se počítají jen u záznamů s výslovnou fází nákladu, rozsahem a délkou trasy; traťové a pruhové kilometry se nesmějí míchat."},countries,projects:PROJECTS,cost_method:{required_fields:["cost_stage","cost_scope","route_km","currency","price_year","source"],comparison_groups:["greenfield_motorway","motorway_widening","expressway","ordinary_bypass","surface_rehabilitation","bridge_or_tunnel_heavy","conventional_rail","rail_electrification","high_speed_rail","signalling_or_station"],display:["local_currency_per_route_km","constant_eur_per_route_km","cost_per_lane_km_when_lanes_are_known","planned_vs_awarded_vs_final_outturn","median_and_interquartile_range"]},sources:[{id:"oecd-itf-infrinv",title:"OECD ITF · Transport infrastructure investment and maintenance spending",url:"https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.ITF&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_INFRINV%40DF_INFRINV&df%5Bvs%5D=1.0",api_url:OECD_URL},{id:"eurostat-rail",title:"Eurostat · railway transport database",url:"https://ec.europa.eu/eurostat/en/web/transport/database"},{id:"eu-rmms",title:"European Commission · Rail Market Monitoring",url:"https://transport.ec.europa.eu/transport-modes/rail/market/rail-market-monitoring-rmms_en"}]};

await fs.writeFile(OUTPUT,`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote transport performance for ${Object.keys(countries).length} countries, ${PROJECTS.length} verified project-cost records`);
