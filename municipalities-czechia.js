(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../../";
  const state = {lang:new URLSearchParams(location.search).get("lang") === "en" ? "en" : "cs",data:null};
  const C = {
    cs:{viewEurope:"Evropa",viewCzechia:"Česko",eyebrow:"Česko · skutečnost 2025",title:"České obce.<br><em>Celý obraz.</em>",intro:"Celostátní výsledek, dlouhá řada velkých měst a detail každé z 6 254 obcí patří na jedno místo.",municipalities:"Obce",coverage:"úplné pokrytí · 2025",navInsights:"Co data říkají",navExplore:"Prozkoumat",navMethod:"Jak data číst",insightsKicker:"01 / Celostátní pohled",insightsTitle:"Rok 2025 v jednom řezu.",insightsCopy:"Součty jsou po konsolidaci uvnitř každé obce. Nejsou konsolidované mezi obcemi navzájem.",exploreKicker:"02 / Navigátor",exploreTitle:"Od celku ke konkrétnímu městu.",exploreCopy:"Vyberte úplný adresář, dvacetiletou řadu velkých měst nebo fiskální profil Prahy mezi evropskými metropolemi.",directoryTitle:"Všechny obce",directoryCopy:"Filtrujte podle kraje, salda, výdajů na obyvatele nebo roku a otevřete detail obce.",openDirectory:"Otevřít adresář →",citiesTitle:"Velká města",citiesCopy:"Dvacet let příjmů, výdajů, výsledků hospodaření a stavu účtů.",openCities:"Otevřít města →",pragueTitle:"Praha mezi metropolemi",pragueCopy:"Rozpočet, saldo, obyvatelé a turistická přenocování ve srovnání hlavních měst EU.",openPrague:"Otevřít Prahu →",methodKicker:"03 / Přesné hranice",methodTitle:"Skutečnost, ne plán.",method1:"6 254 účetních jednotek",method1Copy:"Každá obec má vlastní profil a národní identifikátor IČO.",method2:"Výsledek po konsolidaci",method2Copy:"Příjmy minus výdaje po konsolidaci uvnitř účetní jednotky.",method3:"Dlouhá historie",method3Copy:"Úplný obecní adresář sahá do roku 2010; 27 velkých měst do roku 2006.",footer:"České obecní finance · Monitor státní pokladny",top:"Nahoru ↑",revenue:"Skutečné příjmy",expense:"Skutečné výdaje",result:"Výsledek hospodaření",cash:"Stav účtů",surplus:"přebytek",year:"2025 · nominální CZK"},
    en:{viewEurope:"Europe",viewCzechia:"Czechia",eyebrow:"Czechia · 2025 actuals",title:"Czech municipalities.<br><em>The full picture.</em>",intro:"The national result, a long series for large cities and the detail of all 6,254 municipalities belong in one place.",municipalities:"Municipalities",coverage:"full coverage · 2025",navInsights:"What the data says",navExplore:"Explore",navMethod:"How to read the data",insightsKicker:"01 / National view",insightsTitle:"2025 in one cut.",insightsCopy:"Totals are consolidated within each municipality. They are not consolidated between municipalities.",exploreKicker:"02 / Navigator",exploreTitle:"From the whole to a specific city.",exploreCopy:"Choose the complete directory, the twenty-year series for large cities, or Prague's fiscal profile among European capitals.",directoryTitle:"All municipalities",directoryCopy:"Filter by region, balance, spend per resident or year, then open a municipality detail.",openDirectory:"Open directory →",citiesTitle:"Large cities",citiesCopy:"Twenty years of revenue, expenditure, fiscal results and cash balances.",openCities:"Open cities →",pragueTitle:"Prague among capitals",pragueCopy:"Budget, balance, population and tourist nights compared with other EU capitals.",openPrague:"Open Prague →",methodKicker:"03 / Exact boundaries",methodTitle:"Actuals, not a plan.",method1:"6,254 reporting entities",method1Copy:"Every municipality has its own profile and national identifier.",method2:"Consolidated result",method2Copy:"Revenue minus expenditure after consolidation within the reporting entity.",method3:"Long history",method3Copy:"The complete municipality directory reaches back to 2010; 27 large cities to 2006.",footer:"Czech municipal finance · Treasury Monitor",top:"Back to top ↑",revenue:"Actual revenue",expense:"Actual expenditure",result:"Fiscal result",cash:"Cash balance",surplus:"surplus",year:"2025 · nominal CZK"}
  };
  C.cs.countryHomepage="Stránka země"; C.en.countryHomepage="Country homepage";
  const t=()=>C[state.lang];
  const routes={czechia:["Česko","Czechia"],poland:["Polsko","Poland"],denmark:["Dánsko","Denmark"],france:["Francie","France"],sweden:["Švédsko","Sweden"],england:["Anglie","England"],ukraine:["Ukrajina","Ukraine"]};
  const format=(value)=>new Intl.NumberFormat(state.lang==="en"?"en-GB":"cs-CZ",{style:"currency",currency:"CZK",notation:"compact",maximumFractionDigits:1}).format(value);
  function translate(){
    document.documentElement.lang=state.lang;
    document.querySelectorAll("[data-copy]").forEach((element)=>{const value=t()[element.dataset.copy];if(value)element.innerHTML=value;});
    document.querySelectorAll("[data-lang]").forEach((button)=>button.classList.toggle("active",button.dataset.lang===state.lang));
    document.querySelector('[data-view-link="europe"]')?.setAttribute("href",`../?lang=${state.lang}`);
    const countrySwitch=document.querySelector("#municipality-country-switch");
    if(countrySwitch)countrySwitch.innerHTML=Object.entries(routes).map(([slug,names])=>`<option value="${slug}"${slug==="czechia"?" selected":""}>${names[state.lang==="cs"?0:1]}</option>`).join("");
    document.querySelector('[data-destination="directory"]')?.setAttribute("href",`${assetRoot}cz/obce/?lang=${state.lang}`);
    document.querySelector('[data-destination="cities"]')?.setAttribute("href",`${assetRoot}cz/mesta/?lang=${state.lang}`);
    document.querySelector('[data-destination="prague"]')?.setAttribute("href",`${assetRoot}eu-capitals.html?lang=${state.lang}&city=prague-cz#city-detail`);
    if(state.data)renderInsights();
  }
  function renderInsights(){
    const summary=state.data.summary.municipalities,result=summary.budget_balance;
    document.querySelector("#cz-insight-grid").innerHTML=[
      {label:t().revenue,value:format(summary.revenue_actual)},
      {label:t().expense,value:format(summary.expense_actual)},
      {label:t().result,value:`${result>=0?"+":""}${format(result)}`,note:result>=0?t().surplus:""},
      {label:t().cash,value:format(summary.cash_current)}
    ].map((item)=>`<article><strong>${item.value}</strong><h3>${item.label}</h3><p>${item.note||t().year}</p></article>`).join("");
    document.querySelector("#cz-total-entities").textContent=new Intl.NumberFormat(state.lang==="en"?"en-GB":"cs-CZ").format(summary.entity_count);
  }
  document.querySelectorAll("[data-lang]").forEach((button)=>button.onclick=()=>{state.lang=button.dataset.lang;localStorage.setItem("psd-lang",state.lang);history.replaceState(null,"",`?lang=${state.lang}${location.hash}`);translate();});
  document.querySelector("#municipality-country-switch")?.addEventListener("change",(event)=>{if(event.target.value!=="czechia")location.href=`../${event.target.value}/?lang=${state.lang}`;});
  fetch(`${assetRoot}data/municipal-snapshot.v1.json`).then((response)=>response.json()).then((data)=>{state.data=data;translate();}).catch((error)=>{console.error(error);document.querySelector("#cz-insight-grid").innerHTML="<p>Data could not be loaded.</p>";});
  translate();
})();
