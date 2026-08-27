(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../";
  const params = new URLSearchParams(location.search);
  const requestedType = params.get("type");
  const requestedLanguage = params.get("lang");
  const requestedCountry = params.get("country")?.toUpperCase();
  const initialLanguage = ["cs", "en"].includes(requestedLanguage) ? requestedLanguage : (document.documentElement.lang === "en" ? "en" : "cs");
  const state = {data:null,benchmark:null,benchmarkMetric:"mean",capitals:[],lang:initialLanguage,type:requestedType === "capital" ? "capital" : "all",country:"all",year:"all",query:"",shown:48};
  const C = {
    cs:{viewEurope:"Evropa",viewCzechia:"Česko",eyebrow:"Místní rozpočty · víceletá řada",title:"Obce napříč<br><em>deseti zeměmi.</em>",intro:"Jedno místo pro dohledání obcí, kontrolu dostupných let a pochopení, co lze mezi zeměmi opravdu srovnávat.",covered:"Pokryté obecní jednotky",navCountries:"Země",navInsights:"Co data říkají",navDirectory:"Adresář",navMethod:"Srovnatelnost",countriesKicker:"01 / Přehled pokrytí",countriesTitle:"Ne každá země publikuje totéž.",countriesCopy:"Počty, roky, rozpočtové fáze a účetní rozsah zůstávají viditelné. Skutečnost nikdy nevydáváme za schválený rozpočet.",insightsKicker:"02 / První zjištění",insightsTitle:"Rozdíl není jen ve velikosti.",insightsCopy:"Největší překážkou srovnání je odlišná účetní fáze a rozsah, nikoli formát souboru.",directoryKicker:"03 / Adresář obcí",directoryTitle:"Filtrujte podle země nebo zobrazte hlavní města.",type:"Typ",allTypes:"Obce + hlavní města",capitalsOnly:"Hlavní města EU",country:"Země",search:"Hledat",year:"Rok",searchPlaceholder:"Název nebo národní kód…",reset:"Vymazat filtry",more:"Načíst další",methodKicker:"04 / Smlouva se čtenářem",methodTitle:"Srovnatelnost bez falešné přesnosti.",method1:"Stejná úroveň",method1Copy:"Adresář drží obecní nebo jí nejbližší místní úroveň; regiony, policie a hasiči jsou mimo.",method2:"Viditelná fáze",method2Copy:"Schválený, upravený a skutečný rozpočet jsou samostatné hodnoty.",method3:"Národní klasifikace",method3Copy:"Originální kódy uchováváme. Společné tematické mapování bude samostatná odvozená vrstva.",footer:"Obecní finance · oficiální národní zdroje",top:"Nahoru ↑",all:"Všechny země",entities:"jednotek",complete:"Plné pokrytí",partial:"Částečné pokrytí",downloading:"Probíhá import",actual:"skutečnost",enacted:"schválený",revised:"upravený",revenue:"příjmy",expenditure:"výdaje",balance:"saldo",cash:"stav účtů",financing:"financování",openSource:"Zdroj ↗",openCzechia:"Detail Česka →",noResults:"Filtru neodpovídá žádná obec.",detail:"Detail",shown:"zobrazeno",capital:"Hlavní město EU",capitalBudget:"Rozpočet",openCapital:"Fiskální profil →"},
    en:{viewEurope:"Europe",viewCzechia:"Czechia",eyebrow:"Local budgets · multi-year coverage",title:"Municipalities across<br><em>ten countries.</em>",intro:"One place to find municipalities, verify available years and understand what can genuinely be compared across countries.",covered:"Covered municipal units",navCountries:"Countries",navInsights:"What the data says",navDirectory:"Directory",navMethod:"Comparability",countriesKicker:"01 / Coverage overview",countriesTitle:"Countries do not publish the same thing.",countriesCopy:"Counts, years, budget stages and accounting scope remain visible. Actual accounts are never presented as approved budgets.",insightsKicker:"02 / Initial findings",insightsTitle:"The difference is not only size.",insightsCopy:"The largest comparison barrier is accounting stage and scope, not file format.",directoryKicker:"03 / Municipality directory",directoryTitle:"Filter by country or show the capitals.",type:"Type",allTypes:"Municipalities + capitals",capitalsOnly:"EU capitals",country:"Country",search:"Search",year:"Year",searchPlaceholder:"Name or national code…",reset:"Reset filters",more:"Load more",methodKicker:"04 / Reader contract",methodTitle:"Comparability without false precision.",method1:"Same tier",method1Copy:"The directory keeps the municipal or closest local tier; regions, police and fire bodies are excluded.",method2:"Visible stage",method2Copy:"Approved, revised and actual budgets remain separate values.",method3:"National classifications",method3Copy:"Original codes are preserved. Common thematic mapping will be a separate derived layer.",footer:"Municipal finance · official national sources",top:"Back to top ↑",all:"All countries",entities:"entities",complete:"Full coverage",partial:"Partial coverage",downloading:"Import running",actual:"actual",enacted:"approved",revised:"revised",revenue:"revenue",expenditure:"expenditure",balance:"balance",cash:"cash",financing:"financing",openSource:"Source ↗",openCzechia:"Czechia detail →",noResults:"No municipality matches these filters.",detail:"Detail",shown:"shown",capital:"EU capital",capitalBudget:"Budget",openCapital:"Fiscal profile →"}
  };
  Object.assign(C.cs,{navAbout:"O projektu",aboutKicker:"06 / O projektu",aboutTitle:"O Public Spending Data",aboutCopy:"Public Spending Data zveřejňuje rozpočty obcí a evropských měst spolu s roky, měnami, účetním rozsahem a odkazy na zdroje.",aboutNote:"Projekt staví na otevřených datech veřejných institucí. Není oficiálním portálem žádné vlády ani samosprávy.",creditsKicker:"Projekt připravuje",creditsCopy:"Nezávislá česká nezisková organizace, která propojuje a analyzuje veřejná data.",legalForm:"Právní forma",legalFormValue:"zapsaný ústav · nezisková organizace",registeredOffice:"Sídlo",officialSite:"Oficiální web ↗",aboutHlidac:"O Hlidac statu, z.u. ↗",impactReport:"Výsledky a dopad ↗"});
  Object.assign(C.en,{navAbout:"About",aboutKicker:"06 / About the project",aboutTitle:"About Public Spending Data",aboutCopy:"Public Spending Data publishes budgets for municipalities and European cities together with years, currencies, accounting scope and source links.",aboutNote:"The project is built on open data from public institutions. It is not an official portal of any government or municipality.",creditsKicker:"Created by",creditsCopy:"An independent Czech nonprofit organisation that connects and analyses public data.",legalForm:"Legal form",legalFormValue:"registered institute · nonprofit organisation",registeredOffice:"Registered office",officialSite:"Official website ↗",aboutHlidac:"About Hlidac statu, z.u. ↗",impactReport:"Results and impact ↗"});
  Object.assign(C.cs,{title:"Rozpočty obcí v deseti zemích",intro:"Vyhledejte obec, zkontrolujte dostupné roky a otevřete její rozpočtový profil.",countriesTitle:"Pokrytí dat podle země",countriesCopy:"U každé země uvádíme počet obcí, roky, rozpočtovou fázi a původní zdroj.",insightsTitle:"Co lze srovnávat",insightsCopy:"Největší rozdíly jsou v účetní fázi a rozsahu dat.",directoryTitle:"Najděte obec",methodKicker:"04 / Metodika",methodTitle:"Jak srovnání funguje",aboutTitle:"O Public Spending Data",creditsCopy:"Nezávislá česká nezisková organizace, která propojuje a analyzuje veřejná data.",aboutHlidac:"O Hlidac statu, z.u. ↗",population:"obyvatel",result:"výsledek",dataSource:"Zdroj dat ↗",openData:"Otevřená data",loadError:"Data se nepodařilo načíst."});
  Object.assign(C.en,{title:"Municipal budgets in ten countries",intro:"Find a municipality, check the available years and open its budget profile.",countriesTitle:"Data coverage by country",countriesCopy:"Each country shows its municipality count, years, budget stage and original source.",insightsTitle:"What can be compared",insightsCopy:"The main differences are the accounting stage and the scope of the data.",directoryTitle:"Find a municipality",methodKicker:"04 / Methodology",methodTitle:"How the comparison works",aboutTitle:"About Public Spending Data",creditsCopy:"An independent Czech nonprofit organisation that connects and analyses public data.",aboutHlidac:"About Hlidac statu, z.u. ↗",population:"population",result:"balance",dataSource:"Data source ↗",openData:"Open data",loadError:"The data could not be loaded."});
  Object.assign(C.cs,{sourceYears:"2015–2025 · národní zdroje",navBenchmark:"Srovnání OECD",benchmarkKicker:"03 / Srovnatelná struktura",benchmarkTitle:"Velikost obcí lze porovnat.",benchmarkCopy:"Tři ukazatele z jediné definice OECD popisují velikost a roztříštěnost obecní samosprávy. Nejsou žebříčkem kvality ani efektivity.",benchmarkLoading:"Načítám srovnání OECD…",directoryKicker:"04 / Adresář obcí",methodKicker:"05 / Metodika"});
  Object.assign(C.en,{sourceYears:"2015–2025 · national sources",navBenchmark:"OECD comparison",benchmarkKicker:"03 / Comparable structure",benchmarkTitle:"Municipal size can be compared.",benchmarkCopy:"Three indicators from one OECD definition describe the scale and fragmentation of municipal government. They are not a ranking of quality or efficiency.",benchmarkLoading:"Loading OECD comparison…",directoryKicker:"04 / Municipality directory",methodKicker:"05 / Methodology"});
  C.cs.countryHomepage="Stránka země"; C.en.countryHomepage="Country homepage";
  Object.assign(C.cs,{loadingDirectory:"Načítám adresář obcí…",pickCountry:"Vyberte zemi a prohledejte její obce"});
  Object.assign(C.en,{loadingDirectory:"Loading the municipality directory…",pickCountry:"Choose a country to search its municipalities"});
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const t = () => C[state.lang];
  const name = (country) => country[`name_${state.lang}`];
  const fmt = (number) => new Intl.NumberFormat(state.lang === "en" ? "en-GB" : "cs-CZ").format(number);
  const currency = (number, code) => new Intl.NumberFormat(state.lang === "en" ? "en-GB" : "cs-CZ", {style:"currency",currency:code,notation:"compact",maximumFractionDigits:1}).format(number);
  const slugs={CZE:"czechia",POL:"poland",DNK:"denmark",FRA:"france",SWE:"sweden",GBR:"england",UKR:"ukraine",NOR:"norway",NLD:"netherlands",FIN:"finland",BRA:"brazil",ESP:"spain",JPN:"japan",COL:"colombia",GEO:"georgia",ITA:"italy",BOL:"bolivia",SLV:"el-salvador",MEX:"mexico",CRI:"costa-rica",GTM:"guatemala",PER:"peru",KOR:"south-korea",CHL:"chile"};
  const czechRegions={"Hlavní město Praha":"Prague","Středočeský kraj":"Central Bohemian Region","Jihočeský kraj":"South Bohemian Region","Plzeňský kraj":"Plzeň Region","Karlovarský kraj":"Karlovy Vary Region","Ústecký kraj":"Ústí nad Labem Region","Liberecký kraj":"Liberec Region","Královéhradecký kraj":"Hradec Králové Region","Pardubický kraj":"Pardubice Region","Kraj Vysočina":"Vysočina Region","Jihomoravský kraj":"South Moravian Region","Olomoucký kraj":"Olomouc Region","Zlínský kraj":"Zlín Region","Moravskoslezský kraj":"Moravian-Silesian Region"};
  const regionName = (entity) => state.lang === "en" && entity.country === "CZE" ? (czechRegions[entity.region] || entity.region) : entity.region;

  // The hub paints from the 24 kB country index; municipal entities arrive one country
  // shard at a time and only when a filter actually needs them. A shard omits everything
  // its country already states, so rehydrate to the shape the cards render from.
  const shards=new Map(), loaded=new Map();
  const hydrate = (shard) => {const d=shard.defaults,code=shard.country.code;return shard.entities.map((entity)=>({id:entity.id||`${d.id_prefix}:${entity.code}`,country:code,code:entity.code,name:entity.name,region:entity.region??null,currency:entity.currency||d.currency,years:entity.years||d.years,revenue:entity.revenue??null,expenditure:entity.expenditure??null,balance:entity.balance??null,population:entity.population??null,url:entity.url||(entity.slug?`${d.url_prefix}${entity.slug}/`:null)}));};
  const loadShard = (code) => {
    if(!shards.has(code))shards.set(code,fetch(`${assetRoot}data/international-municipalities/${code}.v1.json`).then((response)=>{if(!response.ok)throw new Error(`${code}: ${response.status}`);return response.json();}).then((shard)=>{loaded.set(code,hydrate(shard));return loaded.get(code);}).catch((error)=>{console.error("Municipal shard",error);loaded.set(code,[]);return [];}));
    return shards.get(code);
  };
  // Capitals alone answer the default view; a country choice needs one shard, and a free
  // search or a year filter across every country needs them all.
  const required = () => state.type === "capital" ? [] : state.country !== "all" ? [state.country] : (state.query.trim() || state.year !== "all") ? state.data.countries.map((country) => country.code) : [];
  const municipalRows = () => required().flatMap((code) => loaded.get(code) || []);

  function renderCountrySwitch(){
    const select=$("#municipality-country-switch"); if(!select||!state.data)return;
    select.innerHTML=`<option value="">${state.lang==="cs"?"Vyberte zemi…":"Choose a country…"}</option>`+state.data.countries.filter((country)=>slugs[country.code]).map((country)=>`<option value="${slugs[country.code]}">${esc(name(country))}</option>`).join("");
  }

  function updateUrl() {
    const url = new URL(location.href); url.searchParams.set("lang", state.lang);
    if (state.type === "capital") url.searchParams.set("type", "capital"); else url.searchParams.delete("type");
    if (state.type !== "capital" && state.country !== "all") url.searchParams.set("country", state.country); else url.searchParams.delete("country");
    history.replaceState(null, "", `${url.pathname}${url.search}${location.hash}`);
  }
  function setLanguage() {
    document.documentElement.lang = state.lang;
    document.title=state.lang==="en"?"Municipality budgets across Europe — Public Spending Data":"Rozpočty obcí v Evropě — Public Spending Data";
    document.querySelector('meta[name="description"]')?.setAttribute("content",state.lang==="en"?"Explore municipal budgets across Europe, Czech municipality detail and the directory of EU capitals.":"Prozkoumejte rozpočty obcí v Evropě, detail českých obcí a adresář hlavních měst EU.");
    document.querySelectorAll("[data-copy]").forEach((element) => { const value = t()[element.dataset.copy]; if (value) element.innerHTML = value; });
    document.querySelectorAll("[data-placeholder]").forEach((element) => { element.placeholder = t()[element.dataset.placeholder]; });
    if(state.data){
      const count=fmt(state.data.countries.length);
      $(".municipal-hero h1").textContent=state.lang==="en"?`Municipal budgets in ${count} countries`:`Rozpočty obcí ve ${count} zemích`;
    }
    document.querySelectorAll("[data-lang]").forEach((button) => { const active=button.dataset.lang===state.lang; button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active)); });
    document.querySelector(".municipality-lang-switch")?.setAttribute("aria-label",state.lang==="en"?"Language":"Jazyk");
    document.querySelector("#municipality-country-switch")?.setAttribute("aria-label",state.lang==="en"?"Municipality country page":"Stránka obcí podle země");
    document.querySelector('[data-view-link="europe"]')?.setAttribute("href", `./?lang=${state.lang}`);
    renderCountrySwitch();
    renderBenchmark();
  }
  function countryCards() {
    const max = Math.max(...state.data.countries.map((country) => country.directory_count));
    $("#country-grid").innerHTML = state.data.countries.map((country) => {
      const slug=slugs[country.code],href=slug?`${assetRoot}municipalities/${slug}/?lang=${state.lang}`:"";
      const cta = href?`<a href="${href}">${esc(state.lang==="cs"?"Detail země →":"Country detail →")}</a>`:`<button type="button" data-filter-country="${country.code}">${esc(state.lang==="cs"?"Procházet obce ↓":"Browse municipalities ↓")}</button>`;
      return `<article class="municipal-country-card" data-country="${country.code}"${href?` data-href="${href}"`:""}><header><img src="${assetRoot}assets/flags/${country.alpha2.toLowerCase()}.svg" alt=""><div><small>${country.code} · ${country.currency}</small><h3>${esc(name(country))}</h3></div><span class="coverage-status ${country.status}">${esc(t()[country.status])}</span></header><strong>${fmt(country.directory_count)}</strong><div class="coverage-bar"><i style="width:${Math.max(3,country.directory_count/max*100)}%"></i></div><p>${esc(country[`coverage_${state.lang}`])}</p><div class="country-badges">${country.years.map((year) => `<b>${year}</b>`).join("")}${country.stages.map((stage) => `<span>${esc(t()[stage])}</span>`).join("")}</div><footer>${cta}<a href="${esc(country.source)}" target="_blank" rel="noopener">${esc(t().dataSource)}</a></footer></article>`;
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
  function renderBenchmark(){
    const root=$("#municipal-benchmark-content"); if(!root||!state.benchmark)return;
    const cs=state.lang==="cs",dataset=state.benchmark,covered=new Set(state.data?.countries.map((country)=>country.code)||[]);
    const metricCopy={
      mean:{label:cs?"Průměr obyvatel na obec":"Average population per municipality",short:cs?"Průměr":"Average",description:cs?"Počet obyvatel dělený počtem samosprávných obcí.":"Population divided by the number of self-governing municipalities.",unit:"people",cap:70000},
      median:{label:cs?"Medián obce":"Median municipality",short:cs?"Medián":"Median",description:cs?"Prostřední obec po seřazení podle počtu obyvatel.":"The middle municipality when ordered by population.",unit:"people",cap:50000},
      under_2000_pct:{label:cs?"Obce pod 2 000 obyvatel":"Municipalities under 2,000 people",short:cs?"Pod 2 000":"Under 2,000",description:cs?"Podíl obcí v nejmenší populační kategorii OECD.":"Share of municipalities in the OECD's smallest population band.",unit:"percent",cap:100}
    };
    const metric=metricCopy[state.benchmarkMetric],value=(country)=>Number(country[state.benchmarkMetric]),display=(number)=>metric.unit==="percent"?`${fmt(Math.round(number))} %`:fmt(Math.round(number));
    const countries=[...dataset.countries].filter((country)=>Number.isFinite(value(country))).sort((a,b)=>state.benchmarkMetric==="under_2000_pct"?value(b)-value(a):value(a)-value(b));
    const czech=dataset.countries.find((country)=>country.iso3==="CZE");
    const rows=countries.map((country,index)=>{
      const number=value(country),width=Math.max(2,Math.min(100,number/metric.cap*100)),isCapped=number>metric.cap;
      const countryName=country[`name_${state.lang}`];
      return `<li class="benchmark-row${country.iso3==="CZE"?" is-czech":""}${covered.has(country.iso3)?" has-budget":""}"><span class="benchmark-rank">${String(index+1).padStart(2,"0")}</span><span class="benchmark-country">${esc(countryName)}${covered.has(country.iso3)?`<i title="${esc(cs?"Rozpočtová data na tomto webu":"Budget data on this site")}"></i>`:""}</span><span class="benchmark-track"><span style="width:${width}%"></span>${isCapped?`<b aria-hidden="true">›</b>`:""}</span><strong>${display(number)}</strong></li>`;
    }).join("");
    root.innerHTML=`
      <div class="benchmark-kpis">
        <article><span>${cs?"Referenční rok":"Reference year"}</span><strong>${dataset.reference_year}</strong><small>${cs?"nebo nejnovější dostupný":"or latest available"}</small></article>
        <article><span>${cs?"Evropské země":"European countries"}</span><strong>${fmt(dataset.countries.length)}</strong><small>${cs?"jedna definice OECD":"one OECD definition"}</small></article>
        <article><span>${cs?"Průměr EU27":"EU27 average"}</span><strong>${fmt(Math.round(dataset.eu27_mean))}</strong><small>${cs?"obyvatel na obec":"people per municipality"}</small></article>
        <article><span>${cs?"Česko · průměr / medián":"Czechia · average / median"}</span><strong>${fmt(Math.round(czech.mean))} / ${fmt(Math.round(czech.median))}</strong><small>${fmt(Math.round(czech.under_2000_pct))} % ${cs?"obcí pod 2 000":"under 2,000"}</small></article>
      </div>
      <div class="benchmark-panel">
        <div class="benchmark-toolbar"><div role="group" aria-label="${esc(cs?"Ukazatel srovnání":"Comparison metric")}">${Object.entries(metricCopy).map(([key,item])=>`<button type="button" data-benchmark-metric="${key}" class="${key===state.benchmarkMetric?"active":""}" aria-pressed="${key===state.benchmarkMetric}">${esc(item.short)}</button>`).join("")}</div><p><strong>${esc(metric.label)}</strong><span>${esc(metric.description)}</span></p></div>
        <div class="benchmark-legend"><span><i></i>${cs?"Rozpočtová data na tomto webu":"Budget data on this site"}</span><small>${cs?`Lineární měřítko končí na ${display(metric.cap)}; vyšší hodnoty označuje ›.`:`Linear scale ends at ${display(metric.cap)}; › marks higher values.`}</small></div>
        <ol class="benchmark-chart" aria-label="${esc(metric.label)}">${rows}</ol>
      </div>
      <div class="benchmark-method"><p>${cs?"Ukazatele popisují územní uspořádání, nikoli počet úředníků, kvalitu služeb, náklady nebo efektivitu. Kompetence obcí se mezi zeměmi liší; proto zde nespojujeme strukturální žebříček s národními rozpočtovými částkami.":"These indicators describe territorial structure—not staffing, service quality, cost or efficiency. Municipal responsibilities differ between countries, so the structural comparison is kept separate from national budget amounts."}</p><a href="${esc(dataset.source.explorer_url)}" target="_blank" rel="noopener">${cs?"Zdroj: OECD · Obce podle počtu obyvatel":"Source: OECD · Municipal level government by population size"} ↗</a></div>`;
    root.querySelectorAll("[data-benchmark-metric]").forEach((button)=>button.onclick=()=>{state.benchmarkMetric=button.dataset.benchmarkMetric;renderBenchmark();});
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
    const municipalities=municipalRows().filter((entity)=>state.year==="all"||entity.years.includes(Number(state.year)));
    const source=state.type==="capital"?state.capitals:state.country==="all"&&state.year==="all"?[...state.capitals,...municipalities]:municipalities;
    return source.filter((entity)=>!query||`${entity.name} ${entity.code} ${entity.countryName||""}`.toLocaleLowerCase().includes(query));
  }
  function renderCapital(entity) {
    const href=`${assetRoot}eu-capitals.html?lang=${state.lang}&city=${encodeURIComponent(entity.code)}#city-detail`;
    return `<article class="municipality-card capital-card" data-href="${href}"><header><b class="capital-country-code" aria-hidden="true">${esc(entity.alpha2)}</b><span>${esc(entity.countryName)}</span><small>${esc(t().capital)}</small></header><h3>${esc(entity.name)}</h3><p>${esc(entity.scope)}</p><dl><div><dt>${esc(t().expenditure)}</dt><dd>${currency(entity.expenditure,entity.currency)}</dd></div><div><dt>${esc(t().revenue)}</dt><dd>${Number.isFinite(entity.revenue)?currency(entity.revenue,entity.currency):"—"}</dd></div><div><dt>${esc(t().result)}</dt><dd>${Number.isFinite(entity.balance)?currency(entity.balance,entity.currency):"—"}</dd></div><div><dt>${esc(t().population)}</dt><dd>${Number.isFinite(entity.population)?fmt(entity.population):"—"}</dd></div></dl><footer><b>${esc(entity.period)}</b><a class="card-source" href="${esc(entity.source)}" target="_blank" rel="noopener">${esc(t().dataSource)}</a><a href="${href}">${esc(t().openCapital)}</a></footer></article>`;
  }
  function renderMunicipality(entity,countries) {
    const country=countries[entity.country],href=entity.url?`${entity.url}?lang=${state.lang}`:(slugs[country.code]?`${assetRoot}municipalities/${slugs[country.code]}/?lang=${state.lang}#directory`:"");
    const amount=`<dl><div><dt>${t().revenue}</dt><dd>${Number.isFinite(entity.revenue)?currency(entity.revenue,entity.currency):"—"}</dd></div><div><dt>${t().expenditure}</dt><dd>${Number.isFinite(entity.expenditure)?currency(entity.expenditure,entity.currency):"—"}</dd></div><div><dt>${t().result}</dt><dd>${Number.isFinite(entity.balance)?currency(entity.balance,entity.currency):"—"}</dd></div><div><dt>${t().population}</dt><dd>${Number.isFinite(entity.population)?fmt(entity.population):"—"}</dd></div></dl>`;
    return `<article class="municipality-card"${href?` data-href="${esc(href)}"`:""}><header><img src="${assetRoot}assets/flags/${country.alpha2.toLowerCase()}.svg" alt=""><span>${esc(name(country))}</span><small>${esc(entity.code)}</small></header><h3>${esc(entity.name)}</h3><p>${esc(regionName(entity)||country[`coverage_${state.lang}`])}</p>${amount}<footer>${entity.years.map((year)=>`<b>${year}</b>`).join("")}<a class="card-source" href="${esc(country.source)}" target="_blank" rel="noopener">${esc(t().dataSource)}</a>${href?`<a href="${esc(href)}">${t().openProfile||t().detail} →</a>`:`<span>${esc(t().openData)}</span>`}</footer></article>`;
  }
  // Paints what has already arrived, then repaints as each outstanding shard lands, so a
  // search never blocks on the slowest country.
  let directoryRequest=0;
  function renderDirectory() {
    const request=++directoryRequest,missing=required().filter((code)=>!loaded.has(code));
    paintDirectory(missing.length>0);
    missing.forEach((code)=>loadShard(code).then(()=>{if(request===directoryRequest)paintDirectory(required().some((item)=>!loaded.has(item)));}));
  }
  function paintDirectory(loading) {
    const result=filtered(),countries=Object.fromEntries(state.data.countries.map((country)=>[country.code,country]));
    const hint=!loading&&state.type!=="capital"&&!required().length?` · ${t().pickCountry}`:"";
    $("#directory-count").textContent=loading?t().loadingDirectory:`${fmt(Math.min(result.length,state.shown))} ${t().shown} · ${fmt(result.length)} ${t().entities}${hint}`;
    $("#municipality-grid").innerHTML=result.slice(0,state.shown).map((entity)=>entity.kind==="capital"?renderCapital(entity):renderMunicipality(entity,countries)).join("")||`<p class="directory-empty">${loading?t().loadingDirectory:t().noResults}</p>`;
    $("#load-more").hidden=state.shown>=result.length;
  }
  function bind() {
    $("#municipality-country-switch").onchange=(event)=>{if(event.target.value)location.href=`${assetRoot}municipalities/${event.target.value}/?lang=${state.lang}`;};
    document.querySelectorAll("[data-lang]").forEach((button)=>button.onclick=()=>{state.lang=button.dataset.lang;setLanguage();countryCards();insights();controls();renderDirectory();updateUrl();});
    $("#type-filter").onchange=(event)=>{state.type=event.target.value;state.country="all";state.year="all";state.shown=48;$("#country-filter").value="all";$("#year-filter").value="all";syncControlState();renderDirectory();updateUrl();};
    $("#country-filter").onchange=(event)=>{state.country=event.target.value;state.shown=48;renderDirectory();updateUrl();};
    $("#year-filter").onchange=(event)=>{state.year=event.target.value;state.shown=48;renderDirectory();};
    $("#municipality-search").oninput=(event)=>{state.query=event.target.value;state.shown=48;renderDirectory();};
    $("#reset-filters").onclick=()=>{state.type="all";state.country="all";state.year="all";state.query="";state.shown=48;$("#type-filter").value="all";$("#country-filter").value="all";$("#year-filter").value="all";$("#municipality-search").value="";syncControlState();renderDirectory();updateUrl();};
    $("#load-more").onclick=()=>{state.shown+=48;renderDirectory();};
  }
  Promise.all([fetch(`${assetRoot}data/international-municipalities/index.v1.json`).then((response)=>response.json()),fetch(`${assetRoot}data/eu-capital-budgets.v1.json`).then((response)=>response.json())]).then(([index,capitalData])=>{
    const data={countries:index.countries,totals:index.totals};
    state.data=data;if(requestedCountry&&data.countries.some((country)=>country.code===requestedCountry))state.country=requestedCountry;state.capitals=capitalData.cities.filter((city)=>city.eu_capital).map((city)=>({kind:"capital",code:city.city_id,name:city.city,countryName:city.country,alpha2:city.country_code,currency:city.budget.local_currency,expenditure:city.fiscal_details?.expenditure?.local_amount||city.budget.local_amount,revenue:city.fiscal_details?.revenue?.local_amount,balance:city.fiscal_details?.balance?.local_amount,population:city.benchmarks?.population?.value,period:city.period,scope:city.scope,source:city.landing_page_url||city.download_url}));
    setLanguage();$("#total-entities").textContent=fmt(index.totals.entity_count);countryCards();insights();controls();renderDirectory();bind();updateUrl();
    fetch(`${assetRoot}data/municipal-size-benchmark.v1.json`).then((response)=>{if(!response.ok)throw new Error(`Municipal benchmark returned ${response.status}`);return response.json();}).then((benchmark)=>{state.benchmark=benchmark;renderBenchmark();}).catch((error)=>{console.error(error);$("#municipal-benchmark-content").innerHTML=`<p class="benchmark-loading">${esc(state.lang==="en"?"The OECD comparison could not be loaded.":"Srovnání OECD se nepodařilo načíst.")}</p>`;});
  }).catch((error)=>{console.error(error);$("#country-grid").innerHTML=`<p>${esc(t().loadError)}</p>`;});
})();
