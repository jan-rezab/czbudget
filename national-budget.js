(() => {
  const query = new URLSearchParams(location.search);
  const lang = () => query.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "cs";
  const slug = location.pathname.match(/^\/national-budgets\/([^/]+)\/?$/)?.[1]?.toLowerCase() || "czechia";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const finite = (value) => Number.isFinite(Number(value));
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits = 1) => finite(value) ? Number(value).toLocaleString(locale(), {maximumFractionDigits:digits}) : "—";
  const latest = (metric) => metric?.values?.filter((point) => finite(point.value)).at(-1);
  const C = {
    cs:{overview:"Přehled",budget:"Rozpočet",revenue:"Příjmy",spending:"Výdaje",economy:"Ekonomika",health:"Zdraví",demography:"Demografie",methodology:"Metodika",eyebrow:"Národní dashboard · paralelní náhled",intro:"Příjmy, výdaje, ekonomika, zdraví a demografický tlak v jednom auditovatelném pohledu na zemi.",switchCountry:"Změnit zemi",budgetKicker:"Celý fiskální obraz",budgetTitle:"Příjmy, výdaje a saldo",revenueKicker:"Odkud peníze přicházejí",revenueTitle:"Struktura příjmů",spendingKicker:"Kam peníze jdou",spendingTitle:"Národní členění výdajů",economyKicker:"Ekonomický kontext",economyTitle:"Růst, ceny a práce",healthKicker:"Zdravotní systém",healthTitle:"Financování, kapacita a výsledky",demographyKicker:"Výhled populace",demographyTitle:"Tlak za budoucími rozpočty",methodKicker:"Data a definice",methodTitle:"Srovnatelně, kde to jde. Národně, kde je to nutné.",fiscalSnapshot:"Fiskální snapshot",revenueMetric:"Příjmy",expenseMetric:"Výdaje",balance:"Saldo",debt:"Dluh",growth:"Růst HDP",inflation:"Inflace",unemployment:"Nezaměstnanost",gdpCapita:"HDP na obyvatele",healthGdp:"Výdaje na zdraví",healthPpp:"Na obyvatele",beds:"Nemocniční lůžka",oop:"Platby domácností",dependency:"65+ na 100 osob 20–64",population:"Populace",workingAge:"Věk 20–64",age80:"Věk 80+",profile:"Otevřít stávající profil země →",national:"Národní data",harmonised:"Harmonizovaná data",boundaries:"Účetní hranice",nationalCopy:"Členění příjmů a výdajů zachovává domácí názvy, fiskální rok a schvalovací fázi.",harmonisedCopy:"Makroekonomika používá srovnatelnou řadu IMF; zdravotnictví OECD/WHO/World Bank a demografie Eurostat nebo OSN.",boundariesCopy:"Státní nebo federální rozpočet se nikdy nesčítá se sektorem vládních institucí, veřejnými podniky ani obcemi.",missingHealth:"Harmonizovaný finanční profil zdravotnictví zatím není v této vrstvě dostupný.",year:"rok",people:"obyvatel"},
    en:{overview:"Overview",budget:"Budget",revenue:"Revenue",spending:"Spending",economy:"Economy",health:"Health",demography:"Demography",methodology:"Methodology",eyebrow:"National dashboard · parallel preview",intro:"Revenue, spending, the economy, health and demographic pressure in one auditable country view.",switchCountry:"Change country",budgetKicker:"The whole fiscal picture",budgetTitle:"Revenue, expenditure and balance",revenueKicker:"Where money comes from",revenueTitle:"Revenue structure",spendingKicker:"Where money goes",spendingTitle:"National spending classification",economyKicker:"Economic context",economyTitle:"Growth, prices and work",healthKicker:"Health system",healthTitle:"Funding, capacity and outcomes",demographyKicker:"Population outlook",demographyTitle:"The pressure behind future budgets",methodKicker:"Data and definitions",methodTitle:"Comparable where possible, national where necessary",fiscalSnapshot:"Fiscal snapshot",revenueMetric:"Revenue",expenseMetric:"Expenditure",balance:"Balance",debt:"Debt",growth:"GDP growth",inflation:"Inflation",unemployment:"Unemployment",gdpCapita:"GDP per capita",healthGdp:"Health spending",healthPpp:"Per capita",beds:"Hospital beds",oop:"Household payments",dependency:"65+ per 100 people aged 20–64",population:"Population",workingAge:"Aged 20–64",age80:"Aged 80+",profile:"Open the existing country profile →",national:"National data",harmonised:"Harmonised data",boundaries:"Accounting boundaries",nationalCopy:"Revenue and spending retain domestic labels, fiscal years and approval stages.",harmonisedCopy:"Macroeconomics uses the comparable IMF series; health uses OECD/WHO/World Bank and demography uses Eurostat or the UN.",boundariesCopy:"A state or federal budget is never added to general government, public corporations or municipalities.",missingHealth:"A harmonised health-financing profile is not yet available in this layer.",year:"year",people:"people"},
  };
  Object.assign(C.cs,{insights:"Závěry",insightsKicker:"Co čísla říkají",insightsTitle:"Pět signálů, které stojí za pozornost"});
  Object.assign(C.en,{insights:"Insights",insightsKicker:"What the numbers say",insightsTitle:"Five signals to take away"});
  const t = () => C[lang()];
  const metric = (series, key) => latest(series.metrics[key]);
  const pct = (point) => point ? `${number(point.value)}%` : "—";
  const kpi = (label, value, note = "") => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
  const barRows = (rows) => {
    const max = Math.max(...rows.map((row) => Math.abs(Number(row.value) || 0)), 1);
    return rows.map((row) => `<div class="nb-bar"><span>${esc(row.label)}</span><i><b style="width:${Math.abs(row.value) / max * 100}%"></b></i><strong>${esc(row.formatted)}</strong></div>`).join("");
  };
  const lineChart = (series, definitions) => {
    const all = definitions.flatMap((definition) => definition.points.map((point) => point.value)).filter(finite).map(Number);
    const years = definitions.flatMap((definition) => definition.points.map((point) => point.year));
    if (!all.length) return "";
    const min = Math.min(...all), max = Math.max(...all), firstYear = Math.min(...years), lastYear = Math.max(...years);
    const x = (year) => 30 + (year - firstYear) / Math.max(1, lastYear - firstYear) * 940;
    const y = (value) => 210 - (value - min) / Math.max(.001, max - min) * 180;
    const paths = definitions.map((definition) => `<path class="${definition.className}" d="${definition.points.filter((point) => finite(point.value)).map((point,index) => `${index ? "L" : "M"}${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")}"></path>`).join("");
    return `<div class="nb-chart-labels">${definitions.map((definition) => `<span><i class="${definition.className}"></i>${esc(definition.label)}</span>`).join("")}</div><svg viewBox="0 0 1000 240" role="img"><line class="axis" x1="30" y1="210" x2="970" y2="210"></line>${paths}<text x="30" y="232">${firstYear}</text><text x="940" y="232">${lastYear}</text></svg>`;
  };

  function render(state) {
    const {route, sovereign, revenue, spending, demography, health, healthBaseline, globalHealth} = state;
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
    $("#budget-trend").innerHTML = lineChart(sovereign,[{label:t().revenueMetric,className:"revenue",points:sovereign.metrics.revenue_pct_gdp.values},{label:t().expenseMetric,className:"expense",points:sovereign.metrics.expenditure_pct_gdp.values}]);

    const revenueLabels = lang() === "en" ? {personal_income:"Personal income tax",corporate_income:"Corporate income tax",vat:"VAT",excise:"Excise taxes",social_security:"Social contributions",property:"Property taxes",other:"Other taxes"} : {personal_income:"Daň z příjmů fyzických osob",corporate_income:"Daň z příjmů právnických osob",vat:"DPH",excise:"Spotřební daně",social_security:"Sociální pojistné",property:"Majetkové daně",other:"Ostatní daně"};
    $("#revenue-bars").innerHTML = barRows(Object.entries(revenue.tax_detail || {}).map(([key,value]) => ({label:revenueLabels[key] || key,value,formatted:`${number(value)}%`})));
    $("#spending-scope").textContent = spending[`scope_${lang()}`];
    $("#spending-bars").innerHTML = barRows([...spending.rows].sort((a,b) => b.amounts.current-a.amounts.current).slice(0,18).map((row) => ({label:lang()==="en"?(row.label_en||row.label_native):row.label_native,value:row.amounts.current,formatted:`${number(row.amounts.current,2)} bn ${spending.currency}`})));

    const growth = metric(sovereign,"real_gdp_growth_pct"), inflation = metric(sovereign,"inflation_pct"), unemployment = metric(sovereign,"unemployment_pct"), capita = metric(sovereign,"gdp_per_capita_usd");
    $("#economy-kpis").innerHTML = kpi(t().growth,pct(growth),String(growth?.year||"—"))+kpi(t().inflation,pct(inflation),String(inflation?.year||"—"))+kpi(t().unemployment,pct(unemployment),String(unemployment?.year||"—"))+kpi(t().gdpCapita,capita?`$${number(capita.value,0)}`:"—",String(capita?.year||"—"));

    const healthSpend = healthBaseline?.financing?.health_gdp_pct, healthPpp = healthBaseline?.financing?.per_capita_ppp, beds = healthBaseline?.capacity?.beds_per_1000, oop = healthBaseline?.financing?.out_of_pocket_pct;
    $("#health-kpis").innerHTML = kpi(t().healthGdp,healthSpend?`${number(healthSpend.value)}%`:"—",String(healthSpend?.year||"—"))+kpi(t().healthPpp,healthPpp?`intl$ ${number(healthPpp.value,0)}`:"—",String(healthPpp?.year||"—"))+kpi(t().beds,beds?number(beds.value,2):"—",`${beds?.year||"—"} · per 1,000`)+kpi(t().oop,oop?`${number(oop.value)}%`:"—",String(oop?.year||"—"));
    $("#health-note").textContent = health ? health[`architecture_${lang()}`] : t().missingHealth;

    const firstDemo = demography.years.find((row) => row.year >= 2025) || demography.years[0], lastDemo = demography.years.find((row) => row.year === 2050) || demography.years.at(-1);
    $("#demography-kpis").innerHTML = kpi(t().dependency,number(lastDemo.old_age_dependency_per_100_working_age),String(lastDemo.year))+kpi(t().population,number(lastDemo.total/1e6,2)+"m",String(lastDemo.year))+kpi(t().workingAge,`${number((lastDemo.age_20_64/firstDemo.age_20_64-1)*100)}%`,`${firstDemo.year}–${lastDemo.year}`)+kpi(t().age80,`${number((lastDemo.age_80_plus/firstDemo.age_80_plus-1)*100)}%`,`${firstDemo.year}–${lastDemo.year}`);
    $("#demography-chart").innerHTML = lineChart(null,[{label:t().population,className:"population",points:demography.years.map((row)=>({year:row.year,value:row.total/1e6}))}]);
    const spendingRows = [...spending.rows].sort((a,b)=>b.amounts.current-a.amounts.current);
    const spendingTotal = spendingRows.reduce((sum,row)=>sum+(Number(row.amounts.current)||0),0);
    const topSpending = spendingRows[0];
    const unemploymentValues = sovereign.metrics.unemployment_pct.values.filter((point)=>finite(point.value));
    const unemploymentChange = unemploymentValues.length > 1 ? unemploymentValues.at(-1).value-unemploymentValues[0].value : null;
    const dependencyChange = lastDemo.old_age_dependency_per_100_working_age-firstDemo.old_age_dependency_per_100_working_age;
    const globalOop = Object.values(globalHealth.countries).map((country)=>country.financing?.out_of_pocket_pct?.value).filter(finite).map(Number).sort((a,b)=>a-b);
    const oopMedian = globalOop.length ? globalOop[Math.floor(globalOop.length/2)] : null;
    const topLabel = lang()==="en"?(topSpending?.label_en||topSpending?.label_native):topSpending?.label_native;
    const insights = lang()==="en" ? [
      ["Fiscal position",`${name} records a ${balancePoint.value>=0?"surplus":"deficit"} of ${number(Math.abs(balancePoint.value))}% of GDP in ${balancePoint.year}.`],
      ["Largest budget line",`${topLabel} is the largest listed national spending line at ${number(topSpending.amounts.current,2)} bn ${spending.currency}, ${number(topSpending.amounts.current/spendingTotal*100)}% of the displayed total.`],
      ["Labour market",`Unemployment ${unemploymentChange<=0?"fell":"rose"} by ${number(Math.abs(unemploymentChange))} percentage points between ${unemploymentValues[0].year} and ${unemploymentValues.at(-1).year}.`],
      ["Ageing pressure",`The 65+ dependency ratio increases by ${number(dependencyChange)} people per 100 working-age residents between ${firstDemo.year} and ${lastDemo.year}.`],
      ["Household health burden",`Out-of-pocket payments are ${number(oop.value)}% of health spending, ${oop.value<=oopMedian?"below":"above"} the global median of ${number(oopMedian)}%.`],
    ] : [
      ["Fiskální pozice",`${name} vykazuje v roce ${balancePoint.year} ${balancePoint.value>=0?"přebytek":"schodek"} ${number(Math.abs(balancePoint.value))} % HDP.`],
      ["Největší rozpočtová položka",`${topLabel} je největší uvedenou položkou národních výdajů: ${number(topSpending.amounts.current,2)} mld. ${spending.currency}, tedy ${number(topSpending.amounts.current/spendingTotal*100)} % zobrazeného součtu.`],
      ["Trh práce",`Nezaměstnanost mezi roky ${unemploymentValues[0].year} a ${unemploymentValues.at(-1).year} ${unemploymentChange<=0?"klesla":"vzrostla"} o ${number(Math.abs(unemploymentChange))} procentního bodu.`],
      ["Tlak stárnutí",`Poměr lidí 65+ vzroste mezi roky ${firstDemo.year} a ${lastDemo.year} o ${number(dependencyChange)} na 100 obyvatel v produktivním věku.`],
      ["Zátěž domácností ve zdravotnictví",`Přímé platby domácností tvoří ${number(oop.value)} % výdajů na zdraví, ${oop.value<=oopMedian?"méně":"více"} než světový medián ${number(oopMedian)} %.`],
    ];
    $("#insight-cards").innerHTML=insights.map(([title,copy],index)=>`<article><span>0${index+1}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join("");
    $("#methodology-copy").innerHTML = [[t().national,t().nationalCopy],[t().harmonised,t().harmonisedCopy],[t().boundaries,t().boundariesCopy]].map(([title,copy])=>`<article><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join("");
    $("#existing-profile-link").href=`/countries/${route.slug}?lang=${lang()}`; $("#existing-profile-link").textContent=t().profile;
  }

  Promise.all([
    fetch("/data/national-budget-routes.v1.json").then((r)=>r.json()),
    fetch("/data/sovereign-benchmark-slim.v1.json").then((r)=>r.json()),
    fetch("/data/country-revenue.v1.json").then((r)=>r.json()),
    fetch("/data/country-spending-2025-2026.v1.json").then((r)=>r.json()),
    fetch("/data/country-demography.v1.json").then((r)=>r.json()),
    fetch("/data/country-health.v1.json").then((r)=>r.json()),
    fetch("/data/global-health-baseline.v1.json").then((r)=>r.json()),
  ]).then(([manifest,sovereignData,revenueData,spendingData,demographyData,healthData,globalHealthData])=>{
    const route=manifest.countries.find((country)=>country.slug===slug);
    if(!route) throw new Error(`Unknown national budget route: ${slug}`);
    const sovereign=sovereignData.series.find((series)=>series.country_code===route.country_code);
    render({manifest,route,sovereign,revenue:revenueData.countries[route.country_code],spending:spendingData.countries.find((country)=>country.code===route.country_code),demography:demographyData.countries[route.country_code],health:healthData.countries[route.country_code],healthBaseline:globalHealthData.countries[route.country_code],globalHealth:globalHealthData});
  }).catch((error)=>{console.error("National budget",error);document.body.classList.add("national-budget-error");$("#country-name").textContent=lang()==="en"?"Dashboard unavailable":"Dashboard není dostupný";});
})();
