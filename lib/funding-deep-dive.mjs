import { countries, sources as institutionalSources, tr } from './funding-systems.mjs';
export { countries, tr };
export const reviewed = '2026-09-20';
export const sources = {
  ...institutionalSources,
  czVat: {title:'Finanční správa · RUD 2026',url:'https://financnisprava.gov.cz/assets/cs/prilohy/d-kraje-a-obce/Schema_rozpoctoveho_urceni_dani_2026.pdf',vintage:'2026 statutory allocation'},
  czPension: {title:'ČSSZ · 2024 accounts',url:'https://www.cssz.cz/documents/20143/99686/Z%C3%A1vazn%C3%A9%2Bukazatele%2B%C4%8CSSZ_2024.pdf/7d118629-b25c-9b92-efc7-53d5571342fa',vintage:'2024 outturn'},
  usPension: {title:'SSA · Social Security trust funds',url:'https://www.ssa.gov/news/en/press/what-are-the-trust-funds.html',vintage:'Institutional guidance'},
  frPension: {title:'CNAV · financial statements',url:'https://www.lassuranceretraite.fr/portail-info/files/live/sites/pub/files/PDF/etat-financier-2025.pdf',vintage:'2025'},
  frRsa: {title:'CAF · RSA and the département',url:'https://www.caf.fr/allocataires/caf-des-bouches-du-rhone/offre-de-service/vie-professionnelle/le-revenu-de-solidarite-active-rsa',vintage:'Institutional guidance'},
  ruSocial: {title:'Social Fund of Russia · institutional history',url:'https://sfr.gov.ru/en/about/history/',vintage:'Merger effective January 2023'},
  uaPension: {title:'PFU · pension fund budget',url:'https://www.pfu.gov.ua/2174363-uryad-zatverdyv-byudzhet-pensijnogo-fondu-ukrayiny-na-2025-rik/',vintage:'2025 budget'},
  wofiCZE: {title:'OECD/UCLG · Czechia',url:'https://www.sng-wofi.org/country_profiles/czech_republic.html',vintage:'2022 profile · overall 2020 / functions 2019'},
  wofiUSA: {title:'OECD/UCLG · United States',url:'https://www.sng-wofi.org/country_profiles/united_states_of_america.html',vintage:'2022 profile · overall 2020 / functions 2019'},
  wofiFRA: {title:'OECD/UCLG · France',url:'https://www.sng-wofi.org/country_profiles/france.html',vintage:'2022 profile · overall 2020 / functions 2019'},
  wofiUKR: {title:'OECD/UCLG · Ukraine',url:'https://www.sng-wofi.org/country_profiles/ukraine.html',vintage:'2022 profile · 2020, before full-scale invasion'},
  pensionSize: {title:'OECD · Pensions at a Glance 2025, Table 8.2',url:'https://www.oecd.org/en/publications/pensions-at-a-glance-2025_e40274c1-en/full-report/public-expenditure-on-pensions_ddc9a2dd.html',vintage:'2020 column · public old-age and survivor cash benefits'},
};
export const vat = [
  {label:tr('State budget','Státní rozpočet'),value:63.84},
  {label:tr('Regions','Kraje'),value:10.23},
  {label:tr('Municipalities','Obce'),value:25.93},
];
const route=(id,label,nodes,note,sourceIds,partial=false)=>({id,label,nodes,note,sources:sourceIds,partial});
export const socialRoutes={
  CZE:{
    pensions:[route('pension',tr('A national pension, paid locally','Celostátní důchod, místní pobočka'),[tr('Pension contributions + state budget','Důchodové pojistné + státní rozpočet'),tr('ČSSZ · national administration','ČSSZ · státní správa'),tr('Pensioner’s account','Účet důchodce')],tr('Local ČSSZ offices administer a national system. Their location does not turn the pension into municipal spending. Main civilian scheme shown.','Místní pracoviště ČSSZ spravují celostátní systém. Jejich adresa nedělá z důchodu obecní výdaj. Zobrazen hlavní civilní systém.'),['czPension'])],
    social:[route('benefits',tr('Cash benefits and social services','Peněžní dávky a sociální služby'),[tr('National resources + local co-funding','Státní zdroje + místní spolufinancování'),tr('National benefit agencies / local service providers','Státní dávkové úřady / místní poskytovatelé služeb'),tr('Households and service users','Domácnosti a uživatelé služeb')],tr('Cash benefits and locally delivered services have different payment routes. National transfers also help fund regional and municipal social services.','Peněžní dávky a místní služby mají různé platební cesty. Státní transfery spolufinancují i krajské a obecní sociální služby.'),['wofiCZE','czPension'])],
  },
  USA:{
    pensions:[route('pension',tr('Federal Social Security','Federální Social Security'),[tr('Payroll tax + other trust-fund income','Odvody ze mzdy + další příjmy fondů'),tr('OASI trust fund → SSA','Fond OASI → SSA'),tr('Retirees and survivors','Důchodci a pozůstalí')],tr('The federal retirement programme runs through national trust funds and SSA. Separate state and local public-employee pension schemes also exist.','Federální důchodový program prochází celostátními fondy a SSA. Existují také samostatné penzijní systémy zaměstnanců států a samospráv.'),['usPension','wofiUSA'])],
    social:[route('benefits',tr('Shared funding, state administration','Společné financování, správa států'),[tr('Federal + state resources','Federální + státní zdroje'),tr('State / local benefit agencies','Dávkové úřady států a samospráv'),tr('Households / service providers','Domácnosti / poskytovatelé služeb')],tr('The mix varies by programme. A US state is below the federal government; it is not the national government.','Poměr závisí na programu. Americký stát je úrovní pod federací; není celostátní vládou.'),['wofiUSA'])],
  },
  FRA:{
    pensions:[route('pension',tr('Pension schemes, not municipal budgets','Důchodové systémy, nikoli obecní rozpočty'),[tr('Contributions + assigned resources','Pojistné + přidělené zdroje'),tr('CNAV / CARSAT and other schemes','CNAV / CARSAT a další systémy'),tr('Retiree’s account','Účet důchodce')],tr('Basic and complementary pensions follow different schemes. A regional pension office is not an elected regional government.','Základní a doplňkové důchody mají různé systémy. Regionální důchodová pokladna není volenou krajskou samosprávou.'),['frPension'])],
    social:[route('benefits',tr('RSA: the payer and the funder differ','RSA: plátce a financující úroveň se liší'),[tr('Département budget','Rozpočet departementu'),tr('CAF / MSA pays on its behalf','CAF / MSA platí jeho jménem'),tr('Eligible household','Oprávněná domácnost')],tr('This is the standard RSA route, with territorial exceptions. Other family and social benefits have other national financing arrangements.','Jde o standardní cestu RSA s územními výjimkami. Ostatní rodinné a sociální dávky mají jiné celostátní financování.'),['frRsa','wofiFRA'])],
  },
  RUS:{
    pensions:[route('pension',tr('The national Social Fund','Celostátní Sociální fond'),[tr('Contributions + federal transfers','Pojistné + federální transfery'),tr('Social Fund of Russia · SFR','Sociální fond Ruska · SFR'),tr('Pensioner’s account','Účet důchodce')],tr('SFR combined the pension and social-insurance funds in 2023. Territorial branches administer national programmes; current execution is only partially verified.','SFR spojil důchodový fond a fond sociálního pojištění v roce 2023. Územní pobočky spravují celostátní programy; současné provádění je ověřeno jen částečně.'),['ruSocial'],true)],
    social:[route('benefits',tr('Federal benefits and regional additions','Federální dávky a regionální podpora'),[tr('Federal resources / regional budgets','Federální zdroje / regionální rozpočty'),tr('SFR / regional social authorities','SFR / regionální sociální úřady'),tr('Households / social services','Domácnosti / sociální služby')],tr('The intermediary depends on the programme. No current cross-country percentage is inferred from this institutional map.','Mezičlánek závisí na programu. Z této institucionální mapy neodvozujeme aktuální procenta pro srovnání zemí.'),['ruSocial'],true)],
  },
  UKR:{
    pensions:[route('pension',tr('National pension financing','Celostátní financování důchodů'),[tr('Social contribution + state transfers','Sociální pojistné + státní transfery'),tr('Pension Fund of Ukraine · PFU','Penzijní fond Ukrajiny · PFU'),tr('Pensioner’s account','Účet důchodce')],tr('Territorial PFU offices belong to the national fund. This structural route does not allocate wartime foreign support to individual pensions.','Územní pracoviště PFU patří celostátnímu fondu. Tato strukturální cesta nepřiřazuje válečnou zahraniční podporu konkrétním důchodům.'),['uaPension'])],
    social:[route('benefits',tr('Benefits and community services','Dávky a komunitní služby'),[tr('National resources + local budgets','Celostátní zdroje + místní rozpočty'),tr('PFU / other administrators / local providers','PFU / další správci / místní poskytovatelé'),tr('Households and service users','Domácnosti a uživatelé služeb')],tr('PFU administers several social payments alongside pensions. Local authorities fund community services. Wartime arrangements are simplified here.','PFU vedle důchodů spravuje i řadu sociálních plateb. Samosprávy financují komunitní služby. Válečné uspořádání je zde zjednodušeno.'),['uaPension','wofiUKR'])],
  },
};
const values=(numbers,years,source)=>countries.map((c,i)=>({code:c.code,value:numbers[i],year:years[i],source:numbers[i]===null?null:source||`wofi${c.code}`}));
const years=[2019,2019,2019,null,2020];
export const benchmarks=[
  {id:'all',title:tr('All public spending','Všechny veřejné výdaje'),denominator:'government_category',rows:values([27.7,39.7,19,null,25],[2020,2020,2020,null,2020])},
  {id:'education',title:tr('Education','Vzdělávání'),denominator:'government_category',rows:values([49.3,92.1,29.7,null,79.1],years)},
  {id:'health',title:tr('Healthcare','Zdravotnictví'),denominator:'government_category',rows:values([15,40,1,null,28.9],years)},
  {id:'social',title:tr('Social protection, including pensions','Sociální ochrana včetně důchodů'),denominator:'government_category',rows:values([8.3,10.3,8.5,null,2.7],years)},
  {id:'pensions',title:tr('Pensions: size of the commitment','Důchody: rozsah závazku'),denominator:'gdp',rows:values([8.6,7.4,14.4,null,null],[2020,2020,2020,null,null],'pensionSize')},
];
export function deltaFromCzech(row,baseline){
  if(!Number.isFinite(row.value)||!Number.isFinite(baseline.value)||row.year!==baseline.year)return null;
  return Math.round((row.value-baseline.value)*10)/10;
}
export function countryCode(search){const p=new URLSearchParams(search);const code=p.get('code')||p.get('country');return countries.some(c=>c.code===code)?code:'CZE';}
