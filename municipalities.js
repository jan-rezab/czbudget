(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../";
  const requestedType = new URLSearchParams(location.search).get("type");
  const state = {data:null,capitals:[],lang:new URLSearchParams(location.search).get("lang") === "en" ? "en" : "cs",type:requestedType === "capital" ? "capital" : "all",country:"all",year:"all",query:"",shown:48};
  const C = {
    cs:{viewEurope:"Evropa",viewCzechia:"Česko",eyebrow:"Místní rozpočty · 2024 + 2025",title:"Obce napříč<br><em>sedmi zeměmi.</em>",intro:"Jedno místo pro dohledání obcí, kontrolu dostupných let a pochopení, co lze mezi zeměmi opravdu srovnávat.",covered:"Pokryté obecní jednotky",navCountries:"Země",navInsights:"Co data říkají",navDirectory:"Adresář",navMethod:"Srovnatelnost",countriesKicker:"01 / Přehled pokrytí",countriesTitle:"Ne každá země publikuje totéž.",countriesCopy:"Počty, roky, rozpočtové fáze a účetní rozsah zůstávají viditelné. Skutečnost nikdy nevydáváme za schválený rozpočet.",insightsKicker:"02 / První zjištění",insightsTitle:"Rozdíl není jen ve velikosti.",insightsCopy:"Největší překážkou srovnání je odlišná účetní fáze a rozsah, nikoli formát souboru.",directoryKicker:"03 / Adresář obcí",directoryTitle:"Filtrujte podle země nebo zobrazte hlavní města.",type:"Typ",allTypes:"Všechny obce",capitalsOnly:"Hlavní města EU",country:"Země",search:"Hledat",year:"Rok",searchPlaceholder:"Název nebo národní kód…",reset:"Vymazat filtry",more:"Načíst další",methodKicker:"04 / Smlouva se čtenářem",methodTitle:"Srovnatelnost bez falešné přesnosti.",method1:"Stejná úroveň",method1Copy:"Adresář drží obecní nebo jí nejbližší místní úroveň; regiony, policie a hasiči jsou mimo.",method2:"Viditelná fáze",method2Copy:"Schválený, upravený a skutečný rozpočet jsou samostatné hodnoty.",method3:"Národní klasifikace",method3Copy:"Originální kódy uchováváme. Společné tematické mapování bude samostatná odvozená vrstva.",footer:"Obecní finance · oficiální národní zdroje",top:"Nahoru ↑",all:"Všechny země",entities:"jednotek",complete:"Plné pokrytí",partial:"Částečné pokrytí",downloading:"Probíhá import",actual:"skutečnost",enacted:"schválený",revised:"upravený",revenue:"příjmy",expenditure:"výdaje",balance:"rozvaha",cash:"stav účtů",financing:"financování",openSource:"Zdroj ↗",openCzechia:"Detail Česka →",noResults:"Filtru neodpovídá žádná obec.",detail:"Detail",shown:"zobrazeno",capital:"Hlavní město EU",capitalBudget:"Rozpočet",openCapital:"Fiskální profil →"},
    en:{viewEurope:"Europe",viewCzechia:"Czechia",eyebrow:"Local budgets · 2024 + 2025",title:"Municipalities across<br><em>seven countries.</em>",intro:"One place to find municipalities, verify available years and understand what can genuinely be compared across countries.",covered:"Covered municipal units",navCountries:"Countries",navInsights:"What the data says",navDirectory:"Directory",navMethod:"Comparability",countriesKicker:"01 / Coverage overview",countriesTitle:"Countries do not publish the same thing.",countriesCopy:"Counts, years, budget stages and accounting scope remain visible. Actual accounts are never presented as approved budgets.",insightsKicker:"02 / Initial findings",insightsTitle:"The difference is not only size.",insightsCopy:"The largest comparison barrier is accounting stage and scope, not file format.",directoryKicker:"03 / Municipality directory",directoryTitle:"Filter by country or show the capitals.",type:"Type",allTypes:"All municipalities",capitalsOnly:"EU capitals",country:"Country",search:"Search",year:"Year",searchPlaceholder:"Name or national code…",reset:"Reset filters",more:"Load more",methodKicker:"04 / Reader contract",methodTitle:"Comparability without false precision.",method1:"Same tier",method1Copy:"The directory keeps the municipal or closest local tier; regions, police and fire bodies are excluded.",method2:"Visible stage",method2Copy:"Approved, revised and actual budgets remain separate values.",method3:"National classifications",method3Copy:"Original codes are preserved. Common thematic mapping will be a separate derived layer.",footer:"Municipal finance · official national sources",top:"Back to top ↑",all:"All countries",entities:"entities",complete:"Full coverage",partial:"Partial coverage",downloading:"Import running",actual:"actual",enacted:"approved",revised:"revised",revenue:"revenue",expenditure:"expenditure",balance:"balance sheet",cash:"cash",financing:"financing",openSource:"Source ↗",openCzechia:"Czechia detail →",noResults:"No municipality matches these filters.",detail:"Detail",shown:"shown",capital:"EU capital",capitalBudget:"Budget",openCapital:"Fiscal profile →"}
  };
  C.cs.countryHomepage="Stránka země"; C.en.countryHomepage="Country homepage";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const t = () => C[state.lang];
  const name = (country) => country[`name_${state.lang}`];
  const fmt = (number) => new Intl.NumberFormat(state.lang === "en" ? "en-GB" : "cs-CZ").format(number);
  const currency = (number, code) => new Intl.NumberFormat(state.lang === "en" ? "en-GB" : "cs-CZ", {style:"currency",currency:code,notation:"compact",maximumFractionDigits:1}).format(number);
  const slugs={CZE:"czechia",POL:"poland",DNK:"denmark",FRA:"france",SWE:"sweden",GBR:"england",UKR:"ukraine"};

  function renderCountrySwitch(){
    const select=$("#municipality-country-switch"); if(!select||!state.data)return;
    select.innerHTML=`<option value="">${state.lang==="cs"?"Vyberte zemi…":"Choose a country…"}</option>`+state.data.countries.map((country)=>`<option value="${slugs[country.code]}">${esc(name(country))}</option>`).join("");
  }

  function updateUrl() {
    const url = new URL(location.href); url.searchParams.set("lang", state.lang);
    if (state.type === "capital") url.searchParams.set("type", "capital"); else url.searchParams.delete("type");
    history.replaceState(null, "", `${url.pathname}${url.search}${location.hash}`);
  }
  function setLanguage() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-copy]").forEach((element) => { const value = t()[element.dataset.copy]; if (value) element.innerHTML = value; });
    document.querySelectorAll("[data-placeholder]").forEach((element) => { element.placeholder = t()[element.dataset.placeholder]; });
    document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("active", button.dataset.lang === state.lang));
    document.querySelector('[data-view-link="europe"]')?.setAttribute("href", `./?lang=${state.lang}`);
    renderCountrySwitch();
  }
  function countryCards() {
    const max = Math.max(...state.data.countries.map((country) => country.directory_count));
    $("#country-grid").innerHTML = state.data.countries.map((country) => {
      const cta = `<a href="${assetRoot}municipalities/${slugs[country.code]}/?lang=${state.lang}">${esc(state.lang==="cs"?"Detail země →":"Country detail →")}</a>`;
      return `<article class="municipal-country-card" data-country="${country.code}"><header><img src="${assetRoot}assets/flags/${country.alpha2.toLowerCase()}.svg" alt=""><div><small>${country.code} · ${country.currency}</small><h3>${esc(name(country))}</h3></div><span class="coverage-status ${country.status}">${esc(t()[country.status])}</span></header><strong>${fmt(country.directory_count)}</strong><div class="coverage-bar"><i style="width:${Math.max(3,country.directory_count/max*100)}%"></i></div><p>${esc(country[`coverage_${state.lang}`])}</p><div class="country-badges">${country.years.map((year) => `<b>${year}</b>`).join("")}${country.stages.map((stage) => `<span>${esc(t()[stage])}</span>`).join("")}</div><footer>${cta}<a href="${esc(country.source)}" target="_blank" rel="noopener">${esc(t().openSource)}</a></footer></article>`;
    }).join("");
    document.querySelectorAll("[data-filter-country]").forEach((button) => button.onclick = () => {state.type="all";state.country=button.dataset.filterCountry;state.shown=48;$("#type-filter").value="all";$("#country-filter").value=state.country;syncControlState();renderDirectory();updateUrl();location.hash="directory";});
  }
  function insights() {
    const cs=state.lang==="cs",countries=state.data.countries,full=countries.filter((country)=>country.status==="complete").length,twoYears=countries.filter((country)=>country.years.includes(2024)&&country.years.includes(2025)).length,stage=countries.filter((country)=>country.stages.includes("enacted")).length;
    $("#insight-grid").innerHTML=[
      {n:fmt(countries.length),h:cs?"zemí v jedné vrstvě":"countries in one layer",p:cs?"Stejný adresář, ale transparentně odlišné účetní rozsahy.":"One directory with transparently different accounting scopes."},
      {n:"27",h:cs?"hlavních měst EU":"EU capitals",p:cs?"Přepněte filtr Typ a otevřete jejich fiskální profily přímo z adresáře.":"Switch the Type filter and open their fiscal profiles directly from the directory."},
      {n:`${twoYears}/${countries.length}`,h:cs?"má oba cílové roky":"have both target years",p:cs?"Česká veřejná vrstva zobrazuje rok 2025; zdrojový archiv je hlubší.":"The Czech public layer shows 2025; its source archive is deeper."},
      {n:String(stage),h:cs?"země ukazují schválený plán":"countries expose an approved plan",p:cs?`Úplný obecní census mají ${full} země.`:`${full} countries provide a full municipal census.`}
    ].map((item)=>`<article><strong>${item.n}</strong><h3>${item.h}</h3><p>${item.p}</p></article>`).join("");
  }
  function controls() {
    $("#country-filter").innerHTML=[`<option value="all">${t().all}</option>`,...state.data.countries.map((country)=>`<option value="${country.code}">${esc(name(country))}</option>`)].join("");
    $("#country-filter").value=state.country;$("#type-filter").value=state.type;syncControlState();
  }
  function syncControlState() {
    const capitals=state.type==="capital";$("#country-filter").disabled=capitals;$("#year-filter").disabled=capitals;
    $("#country-filter").closest("label").classList.toggle("control-disabled",capitals);$("#year-filter").closest("label").classList.toggle("control-disabled",capitals);
  }
  function filtered() {
    const query=state.query.trim().toLocaleLowerCase();
    const source=state.type==="capital"?state.capitals:state.data.entities.filter((entity)=>(state.country==="all"||entity.country===state.country)&&(state.year==="all"||entity.years.includes(Number(state.year))));
    return source.filter((entity)=>!query||`${entity.name} ${entity.code} ${entity.countryName||""}`.toLocaleLowerCase().includes(query));
  }
  function renderCapital(entity) {
    return `<article class="municipality-card capital-card"><header><b class="capital-country-code" aria-hidden="true">${esc(entity.alpha2)}</b><span>${esc(entity.countryName)}</span><small>${esc(t().capital)}</small></header><h3>${esc(entity.name)}</h3><p>${esc(entity.scope)}</p><dl><div><dt>${esc(t().capitalBudget)}</dt><dd>${currency(entity.expenditure,entity.currency)}</dd></div><div><dt>${esc(t().revenue)}</dt><dd>${entity.revenue?currency(entity.revenue,entity.currency):"—"}</dd></div></dl><footer><b>${esc(entity.period)}</b><a href="${assetRoot}eu-capitals.html?lang=${state.lang}&city=${encodeURIComponent(entity.code)}#city-detail">${esc(t().openCapital)}</a></footer></article>`;
  }
  function renderMunicipality(entity,countries) {
    const country=countries[entity.country],amount=entity.revenue?`<dl><div><dt>${t().revenue}</dt><dd>${fmt(Math.round(entity.revenue/1e6))} mil. ${entity.currency}</dd></div><div><dt>${t().expenditure}</dt><dd>${fmt(Math.round(entity.expenditure/1e6))} mil. ${entity.currency}</dd></div></dl>`:"";
    return `<article class="municipality-card"><header><img src="${assetRoot}assets/flags/${country.alpha2.toLowerCase()}.svg" alt=""><span>${esc(name(country))}</span><small>${esc(entity.code)}</small></header><h3>${esc(entity.name)}</h3><p>${esc(entity.region||country[`coverage_${state.lang}`])}</p>${amount}<footer>${entity.years.map((year)=>`<b>${year}</b>`).join("")}${entity.url?`<a href="${esc(entity.url)}">${t().detail} →</a>`:"<span>Open data</span>"}</footer></article>`;
  }
  function renderDirectory() {
    const result=filtered(),countries=Object.fromEntries(state.data.countries.map((country)=>[country.code,country]));
    $("#directory-count").textContent=`${fmt(Math.min(result.length,state.shown))} ${t().shown} · ${fmt(result.length)} ${t().entities}`;
    $("#municipality-grid").innerHTML=result.slice(0,state.shown).map((entity)=>entity.kind==="capital"?renderCapital(entity):renderMunicipality(entity,countries)).join("")||`<p class="directory-empty">${t().noResults}</p>`;
    $("#load-more").hidden=state.shown>=result.length;
  }
  function bind() {
    $("#municipality-country-switch").onchange=(event)=>{if(event.target.value)location.href=`${assetRoot}municipalities/${event.target.value}/?lang=${state.lang}`;};
    document.querySelectorAll("[data-lang]").forEach((button)=>button.onclick=()=>{state.lang=button.dataset.lang;setLanguage();countryCards();insights();controls();renderDirectory();updateUrl();});
    $("#type-filter").onchange=(event)=>{state.type=event.target.value;state.country="all";state.year="all";state.shown=48;$("#country-filter").value="all";$("#year-filter").value="all";syncControlState();renderDirectory();updateUrl();};
    $("#country-filter").onchange=(event)=>{state.country=event.target.value;state.shown=48;renderDirectory();};
    $("#year-filter").onchange=(event)=>{state.year=event.target.value;state.shown=48;renderDirectory();};
    $("#municipality-search").oninput=(event)=>{state.query=event.target.value;state.shown=48;renderDirectory();};
    $("#reset-filters").onclick=()=>{state.type="all";state.country="all";state.year="all";state.query="";state.shown=48;$("#type-filter").value="all";$("#country-filter").value="all";$("#year-filter").value="all";$("#municipality-search").value="";syncControlState();renderDirectory();updateUrl();};
    $("#load-more").onclick=()=>{state.shown+=48;renderDirectory();};
  }
  Promise.all([fetch(`${assetRoot}data/international-municipalities.v1.json`).then((response)=>response.json()),fetch(`${assetRoot}data/eu-capital-budgets.v1.json`).then((response)=>response.json())]).then(([data,capitalData])=>{
    state.data=data;state.capitals=capitalData.cities.filter((city)=>city.eu_capital).map((city)=>({kind:"capital",code:city.city_id,name:city.city,countryName:city.country,alpha2:city.country_code,currency:city.budget.local_currency,expenditure:city.fiscal_details?.expenditure?.local_amount||city.budget.local_amount,revenue:city.fiscal_details?.revenue?.local_amount,period:city.period,scope:city.scope}));
    setLanguage();$("#total-entities").textContent=fmt(data.entities.length);countryCards();insights();controls();renderDirectory();bind();updateUrl();
  }).catch((error)=>{console.error(error);$("#country-grid").innerHTML="<p>Data could not be loaded.</p>";});
})();
