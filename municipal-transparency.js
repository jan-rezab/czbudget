(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../";
  const root = document.querySelector("#transparency-atlas");
  if (!root) return;
  let registry;
  let geometry;
  const state = { mode:"national" };
  const featureKeys = ["enacted","revised","execution","actual","function","economic","api"];
  const copy = {
    en: {
      mode:"Map layer", national:"National budget transparency", municipal:"Municipal item-level lifecycle",
      features:{enacted:"Municipal approved budget",revised:"Municipal revised budget",execution:"Municipal in-year execution",actual:"Municipal final accounts",function:"Municipal functional classification",economic:"Municipal economic classification",api:"Municipal API / bulk data"},
      universe:"sovereign states on the map", assessed:"national budgets assessed", researched:"municipal systems researched", sufficient:"publish enough for informed debate", full:"full municipal lifecycles", scant:"scant or no central-budget information", decentralized:"without one national municipal layer",
      extensive:"Extensive information · 81–100", substantial:"Substantial · 61–80", limited:"Limited · 41–60", minimal:"Minimal · 21–40", scantBand:"Scant or none · 0–20",
      fullLifecycle:"Full municipal lifecycle", budgetAccounts:"Approved budget + final accounts", accountsOnly:"Final accounts / execution only", decentralizedBand:"No single national item-level layer found",
      available:"Available in researched national layer", unavailable:"Not in researched national layer", verify:"Needs verification", notResearched:"Not researched",
      caveat:"Black means not researched—not “publishes nothing.” National scores cover central-government budget documents. Municipal colours use a separate, stricter test: one official national, comparable, item-level local-budget source.",
      bestTitle:"Governments publishing sufficient national budget information", worstTitle:"Scant or no central-budget information", municipalTitle:"Municipal item-level findings", tableTitle:"All 195 states · evidence matrix",
      country:"Country", score:"National score", municipalColumn:"Municipal layer", stages:["Approved","Revised","In-year","Final","Function","Economic","API / bulk"], outside:"Outside the 195-state universe",
      source:"Official municipal source ↗", status:{loaded:"Loaded",loaded_partial:"Partly loaded",upgrading:"Detail upgrade running",crawling:"Crawl started",candidate:"Recommended next",assessed:"Assessed"},
      sources:"Research sources", nationalNote:"OBS 2023 is the latest complete global round: 125 countries, central government only.", municipalNote:"SNG-WOFI and BOOST are screening evidence; PSD still verifies municipality-level, item-level publication country by country."
    },
    cs: {
      mode:"Vrstva mapy", national:"Transparentnost státního rozpočtu", municipal:"Položkový životní cyklus obcí",
      features:{enacted:"Schválený obecní rozpočet",revised:"Upravený obecní rozpočet",execution:"Průběžné plnění obcí",actual:"Závěrečné účty obcí",function:"Funkční členění obcí",economic:"Ekonomické členění obcí",api:"Obecní API / hromadná data"},
      universe:"suverénních států na mapě", assessed:"posouzených státních rozpočtů", researched:"prověřených obecních systémů", sufficient:"zveřejňuje dost pro informovanou debatu", full:"úplných obecních životních cyklů", scant:"téměř žádné informace o státním rozpočtu", decentralized:"bez jednotné národní obecní vrstvy",
      extensive:"Rozsáhlé informace · 81–100", substantial:"Dostatečné · 61–80", limited:"Omezené · 41–60", minimal:"Minimální · 21–40", scantBand:"Skrovné nebo žádné · 0–20",
      fullLifecycle:"Úplný obecní životní cyklus", budgetAccounts:"Schválený rozpočet + závěrečné účty", accountsOnly:"Jen skutečnost / plnění", decentralizedBand:"Nenalezena jednotná národní položková vrstva",
      available:"Dostupné v prověřené národní vrstvě", unavailable:"Není v prověřené národní vrstvě", verify:"Nutno ověřit", notResearched:"Neprověřeno",
      caveat:"Černá znamená neprověřeno—nikoli „vláda nic nezveřejňuje“. Státní skóre hodnotí dokumenty centrální vlády. Obecní barvy používají jiný, přísnější test: jeden oficiální národní, srovnatelný položkový zdroj místních rozpočtů.",
      bestTitle:"Vlády zveřejňující dostatek informací o státním rozpočtu", worstTitle:"Skrovné nebo žádné informace o státním rozpočtu", municipalTitle:"Zjištění k položkovým obecním datům", tableTitle:"Všech 195 států · matice důkazů",
      country:"Země", score:"Státní skóre", municipalColumn:"Obecní vrstva", stages:["Schválený","Upravený","Během roku","Skutečnost","Funkce","Ekonomika","API / bulk"], outside:"Mimo univerzum 195 států",
      source:"Oficiální obecní zdroj ↗", status:{loaded:"Načteno",loaded_partial:"Částečně načteno",upgrading:"Běží detailní upgrade",crawling:"Crawl spuštěn",candidate:"Doporučený další",assessed:"Posouzeno"},
      sources:"Výzkumné zdroje", nationalNote:"OBS 2023 je poslední úplné globální kolo: 125 zemí, pouze centrální vláda.", municipalNote:"SNG-WOFI a BOOST slouží ke screeningu; PSD dál ověřuje položkovou obecní publikaci zemi po zemi."
    }
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const flag = (iso2) => [...iso2.toUpperCase()].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");
  const featureCategory = (country,key) => country?.municipal_item_level?.research_status !== "researched" ? "not_researched" : country.municipal_item_level.features[key] === true ? "available" : country.municipal_item_level.features[key] === false ? "unavailable" : "verify";
  const categoryFor = (country) => state.mode === "national" ? country?.national_budget?.band ?? "not_researched" : state.mode === "municipal" ? country?.municipal_item_level?.category ?? "not_researched" : featureCategory(country,state.mode);
  const municipalLabel = (category,t) => ({full_lifecycle:t.fullLifecycle,budget_and_accounts:t.budgetAccounts,accounts_only:t.accountsOnly,decentralized:t.decentralizedBand,not_researched:t.notResearched})[category];
  const nationalLabel = (category,t) => ({extensive:t.extensive,substantial:t.substantial,limited:t.limited,minimal:t.minimal,scant:t.scantBand,not_researched:t.notResearched})[category];
  const categoryLabel = (category,t) => state.mode === "national" ? nationalLabel(category,t) : state.mode === "municipal" ? municipalLabel(category,t) : ({available:t.available,unavailable:t.unavailable,verify:t.verify,not_researched:t.notResearched})[category];
  const symbol = (country,key) => country.municipal_item_level.research_status !== "researched" ? "●" : country.municipal_item_level.features[key] === true ? "✓" : country.municipal_item_level.features[key] === false ? "—" : "?";
  const symbolClass = (country,key) => country.municipal_item_level.research_status !== "researched" ? "not-researched" : featureCategory(country,key);

  function modeOptions(t) {
    return `<option value="national">${esc(t.national)}</option><option value="municipal">${esc(t.municipal)}</option>${featureKeys.map((key) => `<option value="${key}">${esc(t.features[key])}</option>`).join("")}`;
  }
  function legend(t,countries) {
    const orders = state.mode === "national" ? ["extensive","substantial","limited","minimal","scant","not_researched"] : state.mode === "municipal" ? ["full_lifecycle","budget_and_accounts","accounts_only","decentralized","not_researched"] : ["available","unavailable","verify","not_researched"];
    return orders.map((category) => `<li><i class="atlas-${category}"></i><span>${esc(categoryLabel(category,t))}</span><b>${countries.filter((country) => categoryFor(country) === category).length}</b></li>`).join("");
  }
  function summary(t,countries) {
    const assessed = countries.filter((country) => country.national_budget.research_status === "assessed").length;
    const researched = countries.filter((country) => country.municipal_item_level.research_status === "researched").length;
    if (state.mode === "national") return [[countries.length,t.universe],[assessed,t.assessed],[countries.filter((country) => country.national_budget.score >= 61).length,t.sufficient],[countries.filter((country) => country.national_budget.band === "scant").length,t.scant]];
    if (state.mode === "municipal") return [[countries.length,t.universe],[researched,t.researched],[countries.filter((country) => country.municipal_item_level.category === "full_lifecycle").length,t.full],[countries.filter((country) => country.municipal_item_level.category === "decentralized").length,t.decentralized]];
    return [[countries.length,t.universe],[researched,t.researched],[countries.filter((country) => featureCategory(country,state.mode) === "available").length,t.available],[countries.filter((country) => featureCategory(country,state.mode) === "unavailable").length,t.unavailable]];
  }
  function nationalLists(t,countries) {
    const sufficient = countries.filter((country) => country.national_budget.score >= 61).sort((a,b) => b.national_budget.score-a.national_budget.score || a.name_en.localeCompare(b.name_en));
    const scant = countries.filter((country) => country.national_budget.band === "scant").sort((a,b) => a.national_budget.score-b.national_budget.score || a.name_en.localeCompare(b.name_en));
    const list = (items) => `<ol class="atlas-score-list">${items.map((country) => `<li><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><span>${esc(country[`name_${language()}`])}</span><b>${country.national_budget.score}</b></li>`).join("")}</ol>`;
    return `<div class="atlas-rankings"><section><h3>${esc(t.bestTitle)}</h3>${list(sufficient)}</section><section><h3>${esc(t.worstTitle)}</h3>${list(scant)}</section></div>`;
  }
  function municipalFindings(t,countries) {
    const order = ["full_lifecycle","budget_and_accounts","accounts_only","decentralized"];
    const findings = countries.filter((country) => country.municipal_item_level.research_status === "researched").sort((a,b) => order.indexOf(a.municipal_item_level.category)-order.indexOf(b.municipal_item_level.category) || a.name_en.localeCompare(b.name_en));
    return `<h3 class="atlas-subtitle">${esc(t.municipalTitle)}</h3><div class="atlas-targets">${findings.map((country) => `<article class="atlas-target"><header><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><div><small>${esc(country.iso3 ?? country.iso2.toUpperCase())}</small><h3>${esc(country[`name_${language()}`])}</h3></div>${country.municipal_item_level.pipeline ? `<b class="pipeline-${esc(country.municipal_item_level.pipeline)}">${esc(t.status[country.municipal_item_level.pipeline])}</b>` : ""}</header><p>${esc(country.municipal_item_level[`note_${language()}`])}</p><a href="${esc(country.municipal_item_level.source)}" target="_blank" rel="noopener">${esc(t.source)}</a></article>`).join("")}</div>`;
  }
  function evidenceTable(t,countries) {
    const rows = [...countries].sort((a,b) => a[`name_${language()}`].localeCompare(b[`name_${language()}`],language())).map((country) => {
      const municipal = country.municipal_item_level;
      const municipalText = municipal.research_status === "researched" ? municipalLabel(municipal.category,t) : t.notResearched;
      return `<tr id="atlas-row-${country.iso2}"><th><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><span>${esc(country[`name_${language()}`])}<small>${esc(country.iso2.toUpperCase())}</small></span></th><td class="atlas-score ${country.national_budget.band}">${country.national_budget.score ?? "●"}</td><td class="atlas-municipal-status atlas-${municipal.category}">${esc(municipalText)}</td>${featureKeys.map((key) => `<td class="${symbolClass(country,key)}" aria-label="${esc(({available:t.available,unavailable:t.unavailable,verify:t.verify,not_researched:t.notResearched})[featureCategory(country,key)])}">${symbol(country,key)}</td>`).join("")}</tr>`;
    }).join("");
    return `<h3 class="atlas-subtitle">${esc(t.tableTitle)}</h3><div class="atlas-table-wrap" tabindex="0"><table class="atlas-table"><thead><tr><th>${esc(t.country)}</th><th>${esc(t.score)}</th><th>${esc(t.municipalColumn)}</th>${t.stages.map((label) => `<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function render() {
    if (!registry || !geometry) return;
    const lang=language(), t=copy[lang], countries=registry.countries, byIso=new Map(countries.map((country) => [country.iso2,country]));
    const paths=geometry.locations.map((location) => {
      const country=byIso.get(location.id);
      if (!country) return `<path class="atlas-country atlas-outside" d="${location.path}" aria-label="${esc(`${location.name}: ${t.outside}`)}"><title>${esc(`${location.name}: ${t.outside}`)}</title></path>`;
      const category=categoryFor(country), label=`${country[`name_${lang}`]}: ${categoryLabel(category,t)}`;
      return `<path class="atlas-country atlas-${category}" d="${location.path}" tabindex="0" data-iso="${location.id}" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
    }).join("");
    const kpis=summary(t,countries).map(([value,label]) => `<article><strong>${value}</strong><span>${esc(label)}</span></article>`).join("");
    const detail=state.mode === "national" ? nationalLists(t,countries) : municipalFindings(t,countries);
    const sources=registry.sources.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a><span>${esc(source.scope)}</span></li>`).join("");
    root.innerHTML=`<div class="atlas-controls"><label for="atlas-mode">${esc(t.mode)}</label><select id="atlas-mode">${modeOptions(t)}</select></div><div class="atlas-kpis">${kpis}</div><div class="atlas-map-panel"><div class="atlas-map-wrap"><svg class="atlas-map" viewBox="${geometry.viewBox}" role="img" aria-label="${esc(t.mode)}"><defs><pattern id="atlas-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#d2ccc1"></rect><line x1="0" y1="0" x2="0" y2="8" stroke="#8b8d83" stroke-width="2"></line></pattern></defs>${paths}</svg></div><ol class="atlas-legend">${legend(t,countries)}</ol></div><p class="atlas-caveat">${esc(t.caveat)}</p>${detail}${evidenceTable(t,countries)}<div class="atlas-research-notes"><div><h3>${esc(t.sources)}</h3><ul>${sources}</ul></div><p>${esc(t.nationalNote)}<br>${esc(t.municipalNote)}</p></div>`;
    const mode=root.querySelector("#atlas-mode"); mode.value=state.mode; mode.addEventListener("change",() => { state.mode=mode.value; render(); });
    root.querySelectorAll(".atlas-country[tabindex='0']").forEach((path) => {
      const activate=() => { const row=root.querySelector(`#atlas-row-${path.dataset.iso}`); row?.scrollIntoView({behavior:"smooth",block:"center"}); row?.classList.add("is-highlighted"); setTimeout(() => row?.classList.remove("is-highlighted"),1800); };
      path.addEventListener("click",activate); path.addEventListener("keydown",(event) => { if (event.key === "Enter" || event.key === " ") activate(); });
    });
  }
  Promise.all([fetch(`${assetRoot}data/global-budget-transparency.v1.json`).then((response) => response.json()),fetch(`${assetRoot}data/world-map.v1.json`).then((response) => response.json())]).then(([data,map]) => { registry=data; geometry=map; render(); }).catch((error) => { console.error(error); root.textContent=language() === "en" ? "Transparency atlas could not be loaded." : "Atlas transparentnosti se nepodařilo načíst."; });
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click",() => setTimeout(render)));
})();
