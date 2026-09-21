(() => {
  const query = new URLSearchParams(location.search);
  const lang = () => query.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "cs";
  const routes = {POL:"poland",DEU:"germany",GBR:"united-kingdom",FRA:"france",USA:"united-states",CHE:"switzerland",SWE:"sweden",DNK:"denmark",FIN:"finland",ESP:"spain",NLD:"netherlands",GRC:"greece"};
  const slug = location.pathname.match(/^\/national-budgets\/([^/]+)\/?$/)?.[1]?.toLowerCase() || "poland";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits = 1) => finite(value) ? Number(value).toLocaleString(locale(), {maximumFractionDigits:digits}) : "—";
  const latest = (metric) => metric?.values?.filter((point) => finite(point.value)).at(-1);
  const C = {
    cs:{overview:"Přehled",budget:"Rozpočet",revenue:"Příjmy",spending:"Výdaje",economy:"Ekonomika",health:"Zdraví",demography:"Demografie",methodology:"Metodika",eyebrow:"Národní dashboard",intro:"Příjmy, výdaje, ekonomika, zdraví a demografický tlak v jednom auditovatelném pohledu na zemi.",switchCountry:"Změnit zemi",budgetKicker:"Celý fiskální obraz",budgetTitle:"Příjmy, výdaje a saldo",revenueKicker:"Odkud peníze přicházejí",revenueTitle:"Struktura příjmů",spendingKicker:"Kam peníze jdou",spendingTitle:"Národní členění výdajů",economyKicker:"Ekonomický kontext",economyTitle:"Růst, ceny a práce",healthKicker:"Zdravotní systém",healthTitle:"Financování, kapacita a výsledky",demographyKicker:"Výhled populace",demographyTitle:"Tlak za budoucími rozpočty",methodKicker:"Data a definice",methodTitle:"Srovnatelně, kde to jde. Národně, kde je to nutné.",fiscalSnapshot:"Fiskální snapshot",revenueMetric:"Příjmy",expenseMetric:"Výdaje",balance:"Saldo",debt:"Dluh",growth:"Růst HDP",inflation:"Inflace",unemployment:"Nezaměstnanost",gdpCapita:"HDP na obyvatele",healthGdp:"Výdaje na zdraví",healthPpp:"Na obyvatele",beds:"Nemocniční lůžka",oop:"Platby domácností",dependency:"65+ na 100 osob 20–64",population:"Populace",workingAge:"Věk 20–64",age80:"Věk 80+",profile:"Otevřít stávající profil země →",national:"Národní data",harmonised:"Harmonizovaná data",boundaries:"Účetní hranice",nationalCopy:"Členění příjmů a výdajů zachovává domácí názvy, fiskální rok a schvalovací fázi.",harmonisedCopy:"Makroekonomika používá srovnatelnou řadu IMF; zdravotnictví OECD/WHO/World Bank a demografie Eurostat nebo OSN.",boundariesCopy:"Státní nebo federální rozpočet se nikdy nesčítá se sektorem vládních institucí, veřejnými podniky ani obcemi.",missingHealth:"Harmonizovaný finanční profil zdravotnictví zatím není v této vrstvě dostupný.",year:"rok",people:"obyvatel"},
    en:{overview:"Overview",budget:"Budget",revenue:"Revenue",spending:"Spending",economy:"Economy",health:"Health",demography:"Demography",methodology:"Methodology",eyebrow:"National dashboard",intro:"Revenue, spending, the economy, health and demographic pressure in one auditable country view.",switchCountry:"Change country",budgetKicker:"The whole fiscal picture",budgetTitle:"Revenue, expenditure and balance",revenueKicker:"Where money comes from",revenueTitle:"Revenue structure",spendingKicker:"Where money goes",spendingTitle:"National spending classification",economyKicker:"Economic context",economyTitle:"Growth, prices and work",healthKicker:"Health system",healthTitle:"Funding, capacity and outcomes",demographyKicker:"Population outlook",demographyTitle:"The pressure behind future budgets",methodKicker:"Data and definitions",methodTitle:"Comparable where possible, national where necessary",fiscalSnapshot:"Fiscal snapshot",revenueMetric:"Revenue",expenseMetric:"Expenditure",balance:"Balance",debt:"Debt",growth:"GDP growth",inflation:"Inflation",unemployment:"Unemployment",gdpCapita:"GDP per capita",healthGdp:"Health spending",healthPpp:"Per capita",beds:"Hospital beds",oop:"Household payments",dependency:"65+ per 100 people aged 20–64",population:"Population",workingAge:"Aged 20–64",age80:"Aged 80+",profile:"Open the existing country profile →",national:"National data",harmonised:"Harmonised data",boundaries:"Accounting boundaries",nationalCopy:"Revenue and spending retain domestic labels, fiscal years and approval stages.",harmonisedCopy:"Macroeconomics uses the comparable IMF series; health uses OECD/WHO/World Bank and demography uses Eurostat or the UN.",boundariesCopy:"A state or federal budget is never added to general government, public corporations or municipalities.",missingHealth:"A harmonised health-financing profile is not yet available in this layer.",year:"year",people:"people"},
  };
  Object.assign(C.cs,{insights:"Závěry",insightsKicker:"Co čísla říkají",insightsTitle:"Pět signálů, které stojí za pozornost"});
  Object.assign(C.en,{insights:"Insights",insightsKicker:"What the numbers say",insightsTitle:"Five signals to take away"});
  const t = () => C[lang()];
  const metric = (series, key) => latest(series.metrics[key]);
  const pct = (point) => point ? `${number(point.value)}%` : "—";
  const kpi = (label, value, note = "") => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
  const table = (rows) => `<table class="nb-data-table"><thead><tr><th>${lang()==="en"?"Category":"Kategorie"}</th><th>${lang()==="en"?"Value":"Hodnota"}</th></tr></thead><tbody>${rows.map(row=>`<tr><th>${esc(row.label)}</th><td>${esc(row.formatted)}</td></tr>`).join("")}</tbody></table>`;
  function bars(host, rows, title, unit) {
    host.innerHTML = `<div class="nb-plot"></div>${table(rows)}`;
    window.PSDPlotReady.then(plot => {
      if (!host.isConnected) return;
      plot.render(host.querySelector(".nb-plot"), {type:"bar",rows:rows.map(row=>({label:row.label,value:row.value})),fields:[{key:"value",label:title,format:value=>`${number(value,2)} ${unit}`}],title,unit,locale:locale(),height:Math.max(320,Math.min(700,rows.length*32))});
    }).catch(error => { host.querySelector(".nb-plot").textContent = error.message; });
  }
  function lines(host, definitions, title, unit) {
    const years = [...new Set(definitions.flatMap(definition=>definition.points.map(point=>point.year)))].sort((a,b)=>a-b);
    const rows = years.map(year => ({label:String(year),...Object.fromEntries(definitions.map((definition,index)=>[index,definition.points.find(point=>point.year===year)?.value??null]))}));
    host.innerHTML = `<div class="nb-plot"></div><div class="nb-table-wrap">${table(rows.map(row=>({label:row.label,formatted:definitions.map((definition,index)=>`${definition.label}: ${number(row[index])}`).join(" · ")})))}</div>`;
    window.PSDPlotReady.then(plot => {
      if (!host.isConnected) return;
      plot.render(host.querySelector(".nb-plot"),{type:"line",rows,fields:definitions.map((definition,index)=>({key:String(index),label:definition.label,format:value=>number(value)})),title,unit,locale:locale(),height:260});
    }).catch(error => { host.querySelector(".nb-plot").textContent = error.message; });
  }

  function render(state) {
    const {route, sovereign, revenue, spending, demography, health} = state;
    const name = lang() === "en" ? route.name_en : route.name_cs;
    document.documentElement.lang = lang();
    document.querySelectorAll("[data-copy]").forEach((node) => { node.textContent = t()[node.dataset.copy] || node.textContent; });
    document.title = `${name} — ${lang() === "en" ? "national budget" : "národní rozpočet"} — Public Spending Data`;
    $("#country-name").textContent = name;
    const canonical = `https://publicspendingdata.org${route.path}`;
    $("#canonical-url").href = query.has("lang") ? `${canonical}?lang=${lang()}` : canonical;
    $("#alternate-cs").href = `${canonical}?lang=cs`; $("#alternate-en").href = `${canonical}?lang=en`; $("#alternate-default").href = canonical;
    $("#country-switch").innerHTML = state.manifest.countries.map((country) => `<option value="${country.path}" ${country.country_code === route.country_code ? "selected" : ""}>${esc(lang() === "en" ? country.name_en : country.name_cs)}</option>`).join("");
    $("#country-switch").addEventListener("change", (event) => { location.href = `${event.target.value}?lang=${lang()}`; });

    const revenuePoint = metric(sovereign, "revenue_pct_gdp"), expensePoint = metric(sovereign, "expenditure_pct_gdp"), balancePoint = metric(sovereign, "balance_pct_gdp"), debtPoint = metric(sovereign, "gross_debt_pct_gdp");
    $("#headline-snapshot").innerHTML = `<span>${t().fiscalSnapshot} · ${balancePoint?.year || "—"}</span><strong>${pct(balancePoint)}</strong><small>${t().balance} / GDP</small><div><span>${t().revenueMetric}</span><b>${pct(revenuePoint)}</b><span>${t().expenseMetric}</span><b>${pct(expensePoint)}</b><span>${t().debt}</span><b>${pct(debtPoint)}</b></div>`;
    $("#budget-kpis").innerHTML = [[t().revenueMetric,revenuePoint],[t().expenseMetric,expensePoint],[t().balance,balancePoint],[t().debt,debtPoint]].map(([label,point]) => kpi(label,pct(point),`${point?.year || "—"} · % GDP`)).join("");
    lines($("#budget-trend"),[{label:t().revenueMetric,points:sovereign.metrics.revenue_pct_gdp.values},{label:t().expenseMetric,points:sovereign.metrics.expenditure_pct_gdp.values}],t().budgetTitle,"% GDP");

    const revenueLabels = lang() === "en" ? {personal_income:"Personal income tax",corporate_income:"Corporate income tax",vat:"VAT",excise:"Excise taxes",social_security:"Social contributions",property:"Property taxes",other:"Other taxes"} : {personal_income:"Daň z příjmů fyzických osob",corporate_income:"Daň z příjmů právnických osob",vat:"DPH",excise:"Spotřební daně",social_security:"Sociální pojistné",property:"Majetkové daně",other:"Ostatní daně"};
    bars($("#revenue-bars"),Object.entries(revenue.tax_detail || {}).map(([key,value]) => ({label:revenueLabels[key] || key,value,formatted:`${number(value)}%`})),t().revenueTitle,"%");
    $("#spending-scope").textContent = spending[`scope_${lang()}`];
    bars($("#spending-bars"),[...spending.rows].sort((a,b) => b.amounts.current-a.amounts.current).slice(0,18).map((row) => ({label:lang()==="en"?(row.label_en||row.label_native):row.label_native,value:row.amounts.current,formatted:`${number(row.amounts.current,2)} ${lang()==="en"?"bn":"mld."} ${spending.currency}`})),t().spendingTitle,spending.currency);

    const growth = metric(sovereign,"real_gdp_growth_pct"), inflation = metric(sovereign,"inflation_pct"), unemployment = metric(sovereign,"unemployment_pct"), capita = metric(sovereign,"gdp_per_capita_usd");
    $("#economy-kpis").innerHTML = kpi(t().growth,pct(growth),String(growth?.year||"—"))+kpi(t().inflation,pct(inflation),String(inflation?.year||"—"))+kpi(t().unemployment,pct(unemployment),String(unemployment?.year||"—"))+kpi(t().gdpCapita,capita?`$${number(capita.value,0)}`:"—",String(capita?.year||"—"));

    const healthSpend = health?.health_gdp_pct, healthPpp = health?.per_capita_ppp, beds = health?.beds_per_1000, oop = health?.financing?.out_of_pocket;
    $("#health-kpis").innerHTML = kpi(t().healthGdp,finite(healthSpend)?`${number(healthSpend)}%`:"—",String(health?.year||"—"))+kpi(t().healthPpp,finite(healthPpp)?`intl$ ${number(healthPpp,0)}`:"—",String(health?.year||"—"))+kpi(t().beds,finite(beds)?number(beds,2):"—",`${health?.bed_year||"—"} · per 1,000`)+kpi(t().oop,finite(oop)?`${number(oop)}%`:"—",String(health?.year||"—"));
    $("#health-note").textContent = health ? health[`architecture_${lang()}`] : t().missingHealth;

    const firstDemo = demography.years.find((row) => row.year >= 2025) || demography.years[0], lastDemo = demography.years.find((row) => row.year === 2050) || demography.years.at(-1);
    $("#demography-kpis").innerHTML = kpi(t().dependency,number(lastDemo.old_age_dependency_per_100_working_age),String(lastDemo.year))+kpi(t().population,number(lastDemo.total/1e6,2)+"m",String(lastDemo.year))+kpi(t().workingAge,`${number((lastDemo.age_20_64/firstDemo.age_20_64-1)*100)}%`,`${firstDemo.year}–${lastDemo.year}`)+kpi(t().age80,`${number((lastDemo.age_80_plus/firstDemo.age_80_plus-1)*100)}%`,`${firstDemo.year}–${lastDemo.year}`);
    lines($("#demography-chart"),[{label:t().population,points:demography.years.map((row)=>({year:row.year,value:row.total/1e6}))}],t().demographyTitle,lang()==="en"?"million people":"miliony obyvatel");
    const spendingRows = [...spending.rows].sort((a,b)=>b.amounts.current-a.amounts.current);
    const topSpending = spendingRows[0];
    const unemploymentValues = sovereign.metrics.unemployment_pct.values.filter((point)=>finite(point.value));
    const unemploymentChange = unemploymentValues.length > 1 ? unemploymentValues.at(-1).value-unemploymentValues[0].value : null;
    const dependencyChange = lastDemo.old_age_dependency_per_100_working_age-firstDemo.old_age_dependency_per_100_working_age;
    const peerOop = Object.values(state.healthData.countries).map(country=>country.financing?.out_of_pocket).filter(finite).map(Number).sort((a,b)=>a-b);
    const oopMedian = peerOop[Math.floor(peerOop.length/2)];
    const topLabel = lang()==="en"?(topSpending?.label_en||topSpending?.label_native):topSpending?.label_native;
    const insights = lang()==="en" ? [
      ["Fiscal position",`${name} records a ${balancePoint.value>=0?"surplus":"deficit"} of ${number(Math.abs(balancePoint.value))}% of GDP in ${balancePoint.year}.`],
      ["Largest budget line",`${topLabel} is the largest listed national spending line at ${number(topSpending.amounts.current,2)} bn ${spending.currency}.`],
      ["Labour market",`Unemployment ${unemploymentChange<=0?"fell":"rose"} by ${number(Math.abs(unemploymentChange))} percentage points between ${unemploymentValues[0].year} and ${unemploymentValues.at(-1).year}.`],
      ["Ageing pressure",`The 65+ dependency ratio increases by ${number(dependencyChange)} people per 100 working-age residents between ${firstDemo.year} and ${lastDemo.year}.`],
      ["Household health burden",`Out-of-pocket payments are ${number(oop)}% of health spending, ${oop<=oopMedian?"below":"above"} the median of the available country health profiles (${number(oopMedian)}%).`],
    ] : [
      ["Fiskální pozice",`${name} vykazuje v roce ${balancePoint.year} ${balancePoint.value>=0?"přebytek":"schodek"} ${number(Math.abs(balancePoint.value))} % HDP.`],
      ["Největší rozpočtová položka",`${topLabel} je největší uvedenou položkou národních výdajů: ${number(topSpending.amounts.current,2)} mld. ${spending.currency}.`],
      ["Trh práce",`Nezaměstnanost mezi roky ${unemploymentValues[0].year} a ${unemploymentValues.at(-1).year} ${unemploymentChange<=0?"klesla":"vzrostla"} o ${number(Math.abs(unemploymentChange))} procentního bodu.`],
      ["Tlak stárnutí",`Poměr lidí 65+ vzroste mezi roky ${firstDemo.year} a ${lastDemo.year} o ${number(dependencyChange)} na 100 obyvatel v produktivním věku.`],
      ["Zátěž domácností ve zdravotnictví",`Přímé platby domácností tvoří ${number(oop)} % výdajů na zdraví, ${oop<=oopMedian?"méně":"více"} než medián dostupných profilů zemí ${number(oopMedian)} %.`],
    ];
    $("#insight-cards").innerHTML=insights.map(([title,copy],index)=>`<article><span>0${index+1}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join("");
    $("#methodology-copy").innerHTML = [[t().national,t().nationalCopy],[t().harmonised,t().harmonisedCopy],[t().boundaries,t().boundariesCopy]].map(([title,copy])=>`<article><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join("");
    $("#methodology-sources").innerHTML = `<h3>${lang()==="en"?"Primary sources":"Primární zdroje"}</h3>${state.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join("")}`;
    $("#existing-profile-link").href=`/countries/${route.slug}?lang=${lang()}`; $("#existing-profile-link").textContent=t().profile;
  }

  Promise.all([
    fetch("/data/country-parity.v1.json").then((r)=>r.json()),
    fetch("/data/sovereign-benchmark-slim.v1.json").then((r)=>r.json()),
    fetch("/data/country-revenue.v1.json").then((r)=>r.json()),
    fetch("/data/country-spending-2025-2026.v1.json").then((r)=>r.json()),
    fetch("/data/country-demography.v1.json").then((r)=>r.json()),
    fetch("/data/country-health.v1.json").then((r)=>r.json()),
  ]).then(([parity,sovereignData,revenueData,spendingData,demographyData,healthData])=>{
    const manifest = {countries:Object.entries(routes).map(([country_code,routeSlug])=>{
      const country = parity.countries.find(entry=>entry.country_code===country_code);
      if (!country) throw new Error(`Country parity missing ${country_code}`);
      return {country_code,slug:routeSlug,path:`/national-budgets/${routeSlug}`,name_cs:country.name_cs,name_en:country.name_en};
    })};
    const route=manifest.countries.find((country)=>country.slug===slug);
    if(!route) throw new Error(`Unknown national budget route: ${slug}`);
    const sovereign=sovereignData.series.find((series)=>series.country_code===route.country_code);
    const revenue=revenueData.countries[route.country_code],spending=spendingData.countries.find((country)=>country.code===route.country_code),demography=demographyData.countries[route.country_code],health=healthData.countries[route.country_code];
    if (!sovereign || !revenue || !spending || !demography || !health) throw new Error(`Incomplete core data for ${route.country_code}`);
    const sources = [
      {title:sovereignData.source.dataset,url:sovereignData.source.download_page},
      ...revenueData.sources.filter(source=>source.url).slice(0,2),
      ...healthData.sources,
    ];
    render({manifest,route,sovereign,revenue,spending,demography,health,healthData,sources});
  }).catch((error)=>{console.error("National budget",error);document.body.classList.add("national-budget-error");$("#country-name").textContent=lang()==="en"?"Dashboard unavailable":"Dashboard není dostupný";});
})();
