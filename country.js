const P = new URLSearchParams(location.search);
const state = { code:P.get("code")||"CZE", lang:P.get("lang")||localStorage.getItem("psd-lang")||"cs", year:2024, chartView:"ratio", currency:"local", data:null, catalog:null, fx:null, ministries:null };
const $ = selector => document.querySelector(selector);
const T = {
  cs:{back:"← Všechny země",navTrend:"Vývoj",navMacro:"Makro",navSpecifics:"Specifika",navSources:"Zdroje",profileEyebrow:"Detail země · veřejné finance",switchCountry:"Změnit zemi",switchYear:"Rok profilu",currencyView:"Měna",localCurrency:"Místní",fiscalSnapshot:"Fiskální snapshot",scopeKicker:"Fiskální perimeter / účetní hranice",scopeTitle:"Co čísla zahrnují — a co ne.",scopeCopy:"Státní rozpočet, sektor vládních institucí a veřejný sektor jsou tři různé účetní hranice. Profil je drží viditelně oddělené.",comparisonScope:"Srovnávací řada",countryArchitecture:"Uspořádání veřejných účtů",publicCorporations:"Veřejné korporace",includes:"Zahrnuje",excludes:"Nezahrnuje",trendKicker:"01 / Dvacetiletý vývoj",trendTitle:"Veřejné finance v čase.",trendCopy:"Harmonizované ukazatele IMF umožňují číst dlouhodobý fiskální příběh ve společné definici sektoru vládních institucí.",balance:"Saldo",debt:"Dluh",expense:"Výdaje",revenue:"Příjmy",display:"Zobrazení",ratioView:"% HDP",nominalView:"Nominálně",realView:"Očištěno o inflaci",prices2024:"ceny roku 2024",billions:"mld.",calculation:"výpočet PSD",gdpPcTitle:"HDP na obyvatele",macroKicker:"02 / Makro kontext",macroTitle:"Výkon, dluh a kupní síla.",macroCopy:"Měnové částky se na detailu zobrazují v místní měně; přepínač je přepočítá na EUR. PPP zůstává v mezinárodních dolarech.",debtRatioTitle:"Hrubý dluh k HDP",pppTitle:"HDP na obyvatele v paritě kupní síly",specificKicker:"04 / Národní specifika",specificTitle:"Jak země hlídá rozpočet.",specificCopy:"Vedle výsledku ukazujeme institucionální pravidla a četnost přebytku, ne jen jeden vybraný rok.",sourcesKicker:"07 / Primární zdroje",sourcesTitle:"Od srovnání k rozpočtovým kapitolám.",sourcesCopy:"Originální národní soubory tvoří reprodukovatelný základ detailu výdajů výše; zde jsou odkazy na celé zdrojové publikace.",footerSource:"Srovnávací řady: IMF WEO · kurzy: ECB · národní zdroje jsou uvedené výše",backTop:"Nahoru ↑",primary:"Primární saldo",growth:"Růst HDP",inflation:"Inflace",unemployment:"Nezaměstnanost",actual:"skutečnost",estimate:"odhad",governmentScope:"Rozsah národního rozpočtu",fiscalRule:"Fiskální pravidlo",surplusRecord:"Roky s přebytkem",openSource:"Otevřít originál ↗",ministryData:"Detail ministerstev",downloaded:"staženo a ověřeno",mappingReady:"připraveno k mapování",noRule:"Pro tuto zemi zatím zobrazujeme empirický výsledek; právní rámec doplníme z primárního zdroje.",sourcePurpose:"Primární národní zdroj rozpočtu a jeho plnění.",czechLocalTitle:"Česká územní vrstva",czechLocalCta:"Otevřít obce a kraje →"},
  en:{back:"← All countries",navTrend:"Trend",navMacro:"Macro",navSpecifics:"Specifics",navSources:"Sources",profileEyebrow:"Country detail · public finance",switchCountry:"Change country",switchYear:"Profile year",currencyView:"Currency",localCurrency:"Local",fiscalSnapshot:"Fiscal snapshot",scopeKicker:"Fiscal perimeter / accounting boundary",scopeTitle:"What the figures include — and exclude.",scopeCopy:"The state budget, general government and the public sector are three different accounting boundaries. This profile keeps them visibly separate.",comparisonScope:"Comparison series",countryArchitecture:"Public-account architecture",publicCorporations:"Public corporations",includes:"Includes",excludes:"Excludes",trendKicker:"01 / Twenty-year trend",trendTitle:"Public finances over time.",trendCopy:"Harmonised IMF indicators reveal the long-run fiscal story under a common general-government definition.",balance:"Balance",debt:"Debt",expense:"Expenditure",revenue:"Revenue",display:"Display",ratioView:"% GDP",nominalView:"Nominal",realView:"Adjusted for inflation",prices2024:"2024 prices",billions:"bn",calculation:"PSD calculation",gdpPcTitle:"GDP per capita",macroKicker:"02 / Macro context",macroTitle:"Output, debt and purchasing power.",macroCopy:"Country details show monetary amounts in local currency by default; the toggle converts them to EUR. PPP stays in international dollars.",debtRatioTitle:"Gross debt to GDP",pppTitle:"GDP per capita at purchasing-power parity",specificKicker:"04 / National specifics",specificTitle:"How the country disciplines its budget.",specificCopy:"Alongside the latest result we show institutional rules and the frequency of surpluses across the full period.",sourcesKicker:"07 / Primary sources",sourcesTitle:"From comparison to budget departments.",sourcesCopy:"Original national files provide the reproducible basis for the spending detail above; this section links the complete source publications.",footerSource:"Comparable series: IMF WEO · exchange rates: ECB · national sources above",backTop:"Back to top ↑",primary:"Primary balance",growth:"GDP growth",inflation:"Inflation",unemployment:"Unemployment",actual:"actual",estimate:"estimate",governmentScope:"National budget scope",fiscalRule:"Fiscal rule",surplusRecord:"Years in surplus",openSource:"Open original ↗",ministryData:"Ministry detail",downloaded:"downloaded and verified",mappingReady:"ready for mapping",noRule:"For this country the page currently shows the empirical record; the legal framework will be added from a primary source.",sourcePurpose:"Primary national source for the budget and its execution.",czechLocalTitle:"Czech territorial layer",czechLocalCta:"Open cities and regions →"}
};
T.cs.sourcesKicker="10 / Primární zdroje";
T.en.sourcesKicker="10 / Primary sources";
Object.assign(T.cs,{czechBudgetTitle:"Český státní rozpočet",czechBudgetCta:"Otevřít rozpočet 2001–2045 →",czechViews:"České pohledy"});
Object.assign(T.en,{czechBudgetTitle:"Czech state budget",czechBudgetCta:"Open the 2001–2045 budget →",czechViews:"Czech views"});
Object.assign(T.cs,{navOverview:"Přehled",navScope:"Rozsah",navCashIn:"Příjmy",navSpending:"Výdaje",navHealthcare:"Zdraví",navSocial:"Sociální",navTransport:"Doprava"});
Object.assign(T.en,{navOverview:"Overview",navScope:"Scope",navCashIn:"Revenue",navSpending:"Spending",navHealthcare:"Health",navSocial:"Social",navTransport:"Transport"});
Object.assign(T.cs,{navData:"Data"});
Object.assign(T.en,{navData:"Data"});
Object.assign(T.cs,{gdpTag:"HDP / OBYV.",debtTag:"DLUH / HDP",pppTag:"PPP / OBYV."});
Object.assign(T.en,{gdpTag:"GDP / CAPITA",debtTag:"DEBT / GDP",pppTag:"PPP / CAPITA"});
Object.assign(T.cs,{scopeTitle:"Co data zahrnují",trendTitle:"Vývoj veřejných financí",macroTitle:"Ekonomický kontext",specificTitle:"Rozpočtová pravidla země",sourcesTitle:"Primární zdroje"});
Object.assign(T.en,{scopeTitle:"What the data includes",trendTitle:"Public finance over time",macroTitle:"Economic context",specificTitle:"National budget rules",sourcesTitle:"Primary sources"});
const flagCodes={CZE:"cz",DEU:"de",DNK:"dk",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",USA:"us"};
const scope={state_budget:{cs:"Státní rozpočet",en:"State budget"},state_and_consolidated_budget:{cs:"Státní a konsolidovaný rozpočet",en:"State and consolidated budget"},federal_budget:{cs:"Federální rozpočet",en:"Federal budget"},public_sector_and_central_government:{cs:"Veřejný sektor a centrální vláda",en:"Public sector and central government"},confederation_and_general_government:{cs:"Konfederace a vládní instituce",en:"Confederation and general government"},central_and_general_government:{cs:"Centrální vláda a vládní instituce",en:"Central and general government"}};
const loc=()=>state.lang==="en"?"en-GB":"cs-CZ";
const meta=()=>state.data.countries.find(c=>c.country_code===state.code);
const series=()=>state.data.series.find(c=>c.country_code===state.code);
const catalog=()=>state.catalog.countries.find(c=>c.country_code===state.code);
const summary=()=>state.data.summaries.find(c=>c.country_code===state.code);
const point=(key,year=state.year)=>series()?.metrics[key]?.values.find(v=>v.year===year);
const value=(key,year=state.year)=>point(key,year)?.value??null;
const name=()=>state.lang==="en"?meta().name_en:meta().name_cs;
const fmt=(v,unit="",signed=false,digits=1)=>Number.isFinite(v)?`${signed&&v>0?"+":""}${v.toLocaleString(loc(),{minimumFractionDigits:digits,maximumFractionDigits:digits})}${unit?` ${unit}`:""}`:"—";
const fxRate=year=>state.fx.values.find(v=>v.year===year)?.usd_per_eur;
const moneyCode=()=>state.currency==="eur"?"EUR":meta().currency_code;
const money=(v,code=moneyCode())=>Number.isFinite(v)?new Intl.NumberFormat(loc(),{style:"currency",currency:code,maximumFractionDigits:0,notation:Math.abs(v)>999999?"compact":"standard"}).format(v):"—";
const monetaryValue=(localKey,usdKey,year=state.year)=>state.currency==="local"?value(localKey,year):(value(usdKey,year)/fxRate(year));
const FISCAL_BASE_YEAR=2024;

function inflationIndex(){
  const rates=series()?.metrics.inflation_pct?.values||[], index={};
  let level=100;
  [...rates].sort((a,b)=>a.year-b.year).forEach(point=>{level*=1+point.value/100;index[point.year]=level});
  return index;
}
function fiscalAmount(key,year,view=state.chartView){
  const pct=value(key,year), localGdp=value("nominal_gdp_local_bn",year), usdGdp=value("nominal_gdp_usd_bn",year);
  if(!Number.isFinite(pct))return null;
  if(view==="ratio")return pct;
  if(view==="nominal"&&state.currency==="eur")return Number.isFinite(usdGdp)&&Number.isFinite(fxRate(year))?pct*usdGdp/fxRate(year)/100:null;
  if(!Number.isFinite(localGdp))return null;
  let amount=pct*localGdp/100;
  if(view==="real"){
    const index=inflationIndex();
    if(!Number.isFinite(index[year])||!Number.isFinite(index[FISCAL_BASE_YEAR]))return null;
    amount*=index[FISCAL_BASE_YEAR]/index[year];
    if(state.currency==="eur"){
      const baseLocal=value("nominal_gdp_local_bn",FISCAL_BASE_YEAR), baseUsd=value("nominal_gdp_usd_bn",FISCAL_BASE_YEAR), baseFx=fxRate(FISCAL_BASE_YEAR);
      const baseEur=Number.isFinite(baseUsd)&&Number.isFinite(baseFx)?baseUsd/baseFx:null;
      if(!Number.isFinite(baseLocal)||!Number.isFinite(baseEur)||baseEur===0)return null;
      amount/=baseLocal/baseEur;
    }
  }
  return amount;
}
function fiscalSeries(key){
  return (series()?.metrics[key]?.values||[]).map(point=>({year:point.year,value:fiscalAmount(key,point.year)}));
}
function fiscalUnit(){
  if(state.chartView==="ratio")return state.lang==="en"?"% GDP":"% HDP";
  const amountUnit=`${T[state.lang].billions} ${moneyCode()}`;
  return state.chartView==="real"?`${amountUnit} · ${T[state.lang].prices2024}`:amountUnit;
}
function fiscalFormat(v){
  return state.chartView==="ratio"?fmt(v,"%",false,0):fmt(v,"",false,Math.abs(v)<10?1:0);
}

function translate(){
  document.documentElement.lang=state.lang;
  document.querySelectorAll("[data-i18n]").forEach(n=>{if(T[state.lang][n.dataset.i18n])n.textContent=T[state.lang][n.dataset.i18n]});
  document.querySelectorAll("[data-lang]").forEach(b=>b.classList.toggle("active",b.dataset.lang===state.lang));
  document.querySelectorAll("[data-currency]").forEach(b=>b.classList.toggle("active",b.dataset.currency===state.currency));
  const back=$("#back-link"); if(back) back.href=`index.html?lang=${state.lang}#countries`; $("#home-link").href=`index.html?lang=${state.lang}`;
  document.title=`${name()} — Public Spending Data`;
  const origin="https://czbudget-public-258433468858.europe-west1.run.app";
  const canonical=`${origin}/country.html?code=${encodeURIComponent(state.code)}`;
  $("#canonical-url").href=canonical;
  $("#alternate-cs").href=`${canonical}&lang=cs`;
  $("#alternate-en").href=`${canonical}&lang=en`;
  $("#og-url").content=canonical;
}
function header(){
  const c=meta(); $("#country-code").innerHTML=`<img src="assets/flags/${flagCodes[c.country_code]}.svg" alt=""><b>${c.country_code}</b>`; $("#country-name").textContent=name(); $("#footer-country").textContent=name();
  $("#country-subtitle").textContent=state.lang==="en"?`${c.currency_code} · General government / harmonised scope · IMF WEO 2005–2024 · ${state.currency==="local"?"local-currency view":"EUR view"}`:`${c.currency_code} · Sektor vládních institucí / harmonizované vymezení · IMF WEO 2005–2024 · ${state.currency==="local"?"zobrazení v místní měně":"zobrazení v EUR"}`;
  $("#country-switch").innerHTML=state.data.countries.map(x=>`<option value="${x.country_code}">${state.lang==="en"?x.name_en:x.name_cs}</option>`).join(""); $("#country-switch").value=state.code;
  $("#year-switch").innerHTML=Array.from({length:20},(_,i)=>`<option>${2024-i}</option>`).join(""); $("#year-switch").value=state.year;
}
function amountFromPct(key){
  const pct=value(key), gdp=monetaryValue("nominal_gdp_local_bn","nominal_gdp_usd_bn");
  return Number.isFinite(pct)&&Number.isFinite(gdp)?pct*gdp/100:null;
}
function snapshot(){
  const rows=[[T[state.lang].revenue,"revenue_pct_gdp"],[T[state.lang].expense,"expenditure_pct_gdp"],[T[state.lang].balance,"balance_pct_gdp"],[T[state.lang].debt,"gross_debt_pct_gdp"]];
  $("#snapshot").innerHTML=rows.map(([label,key])=>`<div><span>${label} · ${state.year}</span><strong class="${key==="balance_pct_gdp"?(value(key)>=0?"positive":"negative"):""}">${fmt(value(key),state.lang==="en"?"% GDP":"% HDP",key==="balance_pct_gdp")}</strong><small>${fmt(amountFromPct(key),`${T[state.lang].billions} ${moneyCode()}`,key==="balance_pct_gdp")} · ${state.year}</small></div>`).join("");
  const kpis=[[T[state.lang].primary,"primary_balance_pct_gdp",state.lang==="en"?"% GDP":"% HDP",true],[T[state.lang].growth,"real_gdp_growth_pct","%",true],[T[state.lang].inflation,"inflation_pct","%",false],[T[state.lang].unemployment,"unemployment_pct","%",false]];
  $("#country-kpis").innerHTML=kpis.map(([label,key,unit,signed])=>`<article><span>${label}</span><strong>${fmt(value(key),unit,signed)}</strong><small>${point(key)?.status==="actual"?T[state.lang].actual:T[state.lang].estimate} · ${state.year}</small></article>`).join("");
}
function scopeProfile(){
  const architecture=meta().fiscal_architecture, registry=state.data.fiscal_perimeters, lang=state.lang, suffix=lang==="en"?"en":"cs";
  $("#scope-perimeter-grid").innerHTML=registry.perimeters.map((perimeter,index)=>{
    const active=perimeter.perimeter_code===registry.comparison_scope;
    const label=perimeter.perimeter_code==="national_budget"?architecture[`national_budget_label_${suffix}`]:perimeter[`label_${suffix}`];
    return `<article class="scope-perimeter-card${active?" active":""}"><header><span>0${index+1}</span>${active?`<b>${T[lang].comparisonScope}</b>`:""}</header><h3>${label}</h3><p>${perimeter[`definition_${suffix}`]}</p><dl><div><dt>${T[lang].includes}</dt><dd>${perimeter[`includes_${suffix}`]}</dd></div><div><dt>${T[lang].excludes}</dt><dd>${perimeter[`excludes_${suffix}`]}</dd></div></dl></article>`;
  }).join("");
  const links=(architecture.sources||[]).map(source=>`<a href="${source.source_url}" target="_blank" rel="noreferrer">${source.source_name} ↗</a>`).join("");
  $("#country-scope-facts").innerHTML=`<article><span>${T[lang].countryArchitecture}</span><h3>${architecture[`national_budget_label_${suffix}`]}</h3><p>${architecture[`architecture_${suffix}`]}</p><div class="scope-source-links">${links}</div></article><article><span>${T[lang].publicCorporations}</span><h3>${lang==="en"?"Owner flows, not company turnover":"Toky vlastníka, nikoli obrat podniku"}</h3><p>${architecture[`corporation_note_${suffix}`]}</p></article>`;
  $("#scope-nonadditivity").innerHTML=`<b>${lang==="en"?"Do not add the perimeters:":"Rozsahy nesčítejte:"}</b> ${registry[`non_additivity_rule_${suffix}`]} ${registry[`market_test_note_${suffix}`]}`;
}
function niceAxis(domainMin,domainMax,targetSteps=4){
  if(domainMin===domainMax){const pad=Math.abs(domainMin)*.1||1;domainMin-=pad;domainMax+=pad}
  const roughStep=Math.abs(domainMax-domainMin)/targetSteps,power=10**Math.floor(Math.log10(roughStep)),fraction=roughStep/power,multiplier=[1,2,5,10].find(candidate=>candidate>=fraction)||10,step=multiplier*power;
  const min=Math.floor(domainMin/step)*step,max=Math.ceil(domainMax/step)*step,count=Math.round((max-min)/step);
  return{min,max,ticks:Array.from({length:count+1},(_,index)=>Number((min+index*step).toPrecision(12)))};
}
function lineChart(id, values, {format=v=>fmt(v,"",false,0),source="IMF World Economic Outlook · April 2026",zero=false,color="#0b5d4a",seriesLabel=""}={}){
  const target=$("#"+id), W=760,H=280,m={t:24,r:94,b:34,l:56}, clean=values.filter(v=>Number.isFinite(v.value));
  if(!clean.length){target.innerHTML="—";return}
  let rawLo=Math.min(...clean.map(v=>v.value)),rawHi=Math.max(...clean.map(v=>v.value)); const pad=Math.max((rawHi-rawLo)*.08,Math.abs(rawHi)*.03,1);rawLo-=pad;rawHi+=pad;if(zero){rawLo=Math.min(0,rawLo);rawHi=Math.max(0,rawHi)}
  const axis=niceAxis(rawLo,rawHi),lo=axis.min,hi=axis.max,plotWidth=W-m.l-m.r,x=i=>m.l+(i+.5)*plotWidth/clean.length,y=v=>m.t+(hi-v)/(hi-lo)*(H-m.t-m.b),path=clean.map((p,i)=>`${i?"L":"M"}${x(i)},${y(p.value)}`).join(" "),last=clean.at(-1);
  target.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${id.replaceAll("-", " ")}">${axis.ticks.slice().reverse().map(tick=>`<line x1="${m.l}" x2="${W-m.r}" y1="${y(tick)}" y2="${y(tick)}" class="grid-line"/><text x="${m.l-8}" y="${y(tick)+4}" text-anchor="end" class="axis-label">${format(tick)}</text>`).join("")}${zero&&lo<0&&hi>0?`<line x1="${m.l}" x2="${W-m.r}" y1="${y(0)}" y2="${y(0)}" class="zero-line"/>`:""}<path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>${clean.map((p,i)=>i%5===0||i===clean.length-1?`<text x="${x(i)}" y="${H-10}" text-anchor="middle" class="axis-label">${p.year}</text>`:"").join("")}<circle cx="${x(clean.length-1)}" cy="${y(last.value)}" r="4" fill="${color}"/><text x="${x(clean.length-1)+10}" y="${y(last.value)+4}" class="chart-end-label">${format(last.value)}</text>${clean.map((p,i)=>`<circle class="country-chart-hit" cx="${x(i)}" cy="${y(p.value)}" r="12" tabindex="0" role="img" data-index="${i}" aria-label="${p.year}: ${format(p.value)}"/>`).join("")}</svg><div class="country-chart-tooltip" role="status" aria-live="polite"></div><div class="chart-source">${state.lang==="en"?"Source":"Zdroj"}: ${source}</div>`;
  const tooltip=target.querySelector(".country-chart-tooltip");
  const showPoint=(index,hit)=>{const p=clean[index];target.querySelectorAll(".country-chart-hit").forEach(node=>node.classList.toggle("active",node===hit));tooltip.innerHTML=`<strong>${p.year}</strong><span>${seriesLabel}</span><b>${format(p.value)}</b>`;tooltip.style.left=`${x(index)/W*100}%`;tooltip.style.top=`${y(p.value)/H*100}%`;tooltip.classList.add("visible")};
  const hidePoint=()=>{target.querySelectorAll(".country-chart-hit").forEach(node=>node.classList.remove("active"));tooltip.classList.remove("visible")};
  target.querySelectorAll(".country-chart-hit").forEach(hit=>{hit.addEventListener("pointerenter",()=>showPoint(+hit.dataset.index,hit));hit.addEventListener("pointerleave",hidePoint);hit.addEventListener("focus",()=>showPoint(+hit.dataset.index,hit));hit.addEventListener("blur",hidePoint)});
}
function charts(){
  const fiscalLabels={balance_pct_gdp:T[state.lang].balance,expenditure_pct_gdp:T[state.lang].expense,revenue_pct_gdp:T[state.lang].revenue};
  const source=state.chartView==="ratio"?"IMF World Economic Outlook · April 2026":`IMF World Economic Outlook · ECB${state.chartView==="real"?` · ${T[state.lang].calculation}`:""}`;
  document.querySelectorAll(".fiscal-unit-label").forEach(label=>label.textContent=fiscalUnit());
  [["balance-chart","balance-chart-title","balance_pct_gdp","#b13a33"],["revenue-chart","revenue-chart-title","revenue_pct_gdp","#0b5d4a"],["expenditure-chart","expenditure-chart-title","expenditure_pct_gdp","#b13a33"]].forEach(([id,titleId,key,color])=>{
    $("#"+titleId).textContent=`${fiscalLabels[key]} / ${fiscalUnit()}`;
    lineChart(id,fiscalSeries(key),{format:fiscalFormat,source,zero:key==="balance_pct_gdp",color,seriesLabel:fiscalLabels[key]});
  });
  const gdp=series().metrics[state.currency==="local"?"gdp_per_capita_local":"gdp_per_capita_usd"].values.map(p=>({year:p.year,value:state.currency==="local"?p.value:p.value/fxRate(p.year)}));
  $("#gdp-unit-label").textContent=moneyCode(); lineChart("gdp-per-capita-chart",gdp,{format:v=>money(v),color:"#0b5d4a",source:"IMF WEO · ECB",seriesLabel:T[state.lang].gdpPcTitle});
  lineChart("debt-ratio-chart",series().metrics.gross_debt_pct_gdp.values,{format:v=>fmt(v,"%",false,0),color:"#b13a33",seriesLabel:T[state.lang].debtRatioTitle});
  lineChart("ppp-chart",series().metrics.gdp_per_capita_ppp.values,{format:v=>`${Math.round(v/1000)}k`,color:"#9a7d20",seriesLabel:T[state.lang].pppTitle});
}
function specifics(){
  const c=meta(), s=summary(), framework=state.ministries.fiscal_frameworks.find(x=>x.code===state.code);
  const frameworkText=framework?(state.lang==="en"?framework.summary_en:framework.summary_cs):T[state.lang].noRule;
  const architecture=c.fiscal_architecture, suffix=state.lang==="en"?"en":"cs";
  $("#specific-grid").innerHTML=`<article><span>01</span><h3>${T[state.lang].governmentScope}</h3><strong>${architecture[`national_budget_label_${suffix}`]||scope[c.national_scope]?.[state.lang]||c.national_scope}</strong><p>${state.lang==="en"?"This national legal budget is shown separately from the harmonised general-government comparison.":"Tento národní právní rozpočet zobrazujeme odděleně od harmonizovaného srovnání sektoru vládních institucí."}</p></article><article><span>02</span><h3>${T[state.lang].fiscalRule}</h3><strong>${framework?(state.lang==="en"?framework.label_en:framework.label_cs):"—"}</strong><p>${frameworkText}</p>${framework?`<a href="${framework.source_url}" target="_blank" rel="noreferrer">${T[state.lang].openSource}</a>`:""}</article><article><span>03</span><h3>${T[state.lang].surplusRecord}</h3><strong>${fmt(s.surplus_year_share*100,"%",false,0)}</strong><p>${state.lang==="en"?`Share of years with a general-government surplus in 2005–2024. Median balance: ${fmt(s.median_balance_pct_gdp,"% GDP",true)}.`:`Podíl let s přebytkem vládních institucí v období 2005–2024. Medián salda: ${fmt(s.median_balance_pct_gdp,"% HDP",true)}.`}</p></article>`;
}
function sources(){
  const list=catalog()?.sources||[];
  $("#source-cards").innerHTML=list.map((s,i)=>`<article><span>${String(i+1).padStart(2,"0")} / ${(s.formats||[]).join(" · ")}</span><h3>${s.source_name}</h3><p>${state.lang==="en"?T[state.lang].sourcePurpose:s.purpose}</p><small>${s.coverage}</small><a href="${s.source_url}" target="_blank" rel="noreferrer">${T[state.lang].openSource}</a></article>`).join("");
  const raw=state.ministries.countries.find(x=>x.code===state.code);
  $("#ministry-source").innerHTML=raw?`<a class="ministry-source-card" href="${raw.source_url}" target="_blank" rel="noreferrer"><div><span>RAW / ${raw.code} / ${raw.year}</span><h3>${T[state.lang].ministryData}</h3><p>${raw.dimension} · ${raw.stage} · ${(raw.bytes/1024/1024).toLocaleString(loc(),{maximumFractionDigits:1})} MB</p></div><strong>${raw.available?T[state.lang].downloaded:T[state.lang].mappingReady} ↗</strong></a>`:"";
  $("#czech-local-link").innerHTML=state.code==="CZE"?`<div class="czech-view-heading"><span>${T[state.lang].czechViews}</span></div><div class="czech-view-grid"><a class="czech-local-card" href="cesky-rozpocet.html?lang=${state.lang}"><div><span>CZ / NATIONAL</span><h3>${T[state.lang].czechBudgetTitle}</h3></div><b>${T[state.lang].czechBudgetCta}</b></a><a class="czech-local-card territorial" href="cz/municipalities/?lang=${state.lang}"><div><span>CZ / LOCAL</span><h3>${T[state.lang].czechLocalTitle}</h3></div><b>${T[state.lang].czechLocalCta}</b></a></div>`:"";
}
function render(){translate();header();snapshot();scopeProfile();charts();specifics();sources();dispatchEvent(new CustomEvent("countryprofilechange",{detail:{code:state.code,lang:state.lang,year:state.year,currency:state.currency}}))}
function init(){
  if(!meta())state.code="CZE";
  document.querySelectorAll("[data-lang]").forEach(b=>b.onclick=()=>{state.lang=b.dataset.lang;localStorage.setItem("psd-lang",state.lang);history.replaceState(null,"",`?code=${state.code}&lang=${state.lang}`);render()});
  document.querySelectorAll("[data-currency]").forEach(b=>b.onclick=()=>{state.currency=b.dataset.currency;render()});
  $("#country-switch").onchange=e=>{state.code=e.target.value;state.currency="local";history.replaceState(null,"",`?code=${state.code}&lang=${state.lang}`);render()};
  $("#year-switch").onchange=e=>{state.year=+e.target.value;render()};
  document.querySelectorAll("[data-chart-view]").forEach(b=>b.onclick=()=>{state.chartView=b.dataset.chartView;document.querySelectorAll("[data-chart-view]").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",x===b)});charts()});
  render();
}
Promise.all([
  fetch("lib/data/sovereign-benchmark.v1.json").then(r=>r.json()),
  fetch("data/catalog.v1.json").then(r=>r.json()),
  fetch("data/fx-eur-annual.v1.json").then(r=>r.json()),
  fetch("data/ministry-budget-sources.v1.json").then(r=>r.json())
]).then(([data,catalog,fx,ministries])=>{state.data=data;state.catalog=catalog;state.fx=fx;state.ministries=ministries;init()}).catch(error=>{console.error(error);document.body.classList.add("data-error")});
