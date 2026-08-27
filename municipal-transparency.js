(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../";
  const root = document.querySelector("#transparency-atlas");
  if (!root) return;
  let registry;
  let geometry;
  const state = { mode:"readiness", sortKey:"index", sortDirection:"desc" };
  const featureKeys = ["enacted","revised","execution","actual","function","economic","api"];
  const copy = {
    en: {
      mode:"Coverage layer", readiness:"Budget Transparency Index", national:"OBS central-government score", municipal:"Municipal item-level lifecycle",
      features:{enacted:"Municipal approved budget",revised:"Municipal revised budget",execution:"Municipal in-year execution",actual:"Municipal final accounts",function:"Municipal functional classification",economic:"Municipal economic classification",api:"Municipal API / bulk data"},
      universe:"states represented · 100% geographic coverage", scored:"countries with a verified score component", complete:"central + municipal evidence", provisional:"scores awaiting municipal review", assessed:"central budgets assessed by OBS", researched:"municipal systems researched", sufficient:"publish enough for informed debate", full:"full municipal lifecycles", scant:"scant or no central-budget information", decentralized:"without one national municipal layer",
      excellent:"Excellent · 81–100", strong:"Strong · 61–80", partial:"Partial · 41–60", weak:"Weak · 21–40", veryWeak:"Very weak · 0–20",
      extensive:"Extensive information · 81–100", substantial:"Substantial · 61–80", limited:"Limited · 41–60", minimal:"Minimal · 21–40", scantBand:"Scant or none · 0–20",
      fullLifecycle:"Full municipal lifecycle", budgetAccounts:"Approved budget + final accounts", accountsOnly:"Final accounts / execution only", decentralizedBand:"No single national item-level layer found",
      available:"Available in researched national layer", unavailable:"Not in researched national layer", verify:"Needs verification", notResearched:"Not researched / no verified score",
      caveat:"The Budget Transparency Index combines the OBS central-government score with up to 20 points for verified municipal depth. Missing municipal research adds no bonus and remains provisional. Dark gray means not researched or not scored—never “publishes nothing.” The tan colour is the middle band.",
      bestTitle:"Governments publishing sufficient central-budget information", worstTitle:"Scant or no central-budget information", municipalTitle:"Municipal item-level findings", tableTitle:"All 195 states · evidence and scoring matrix",
      country:"Country", psdScore:"Budget Transparency Index", obsScore:"OBS central-government score", municipalColumn:"Municipal layer", loadColumn:"PSD coverage", loadedProfile:"Loaded", crawlStarted:"Crawl started", notLoaded:"Not loaded", stages:["Approved","Revised","In-year","Final","Function","Economic","API / bulk"], outside:"Outside the 195-state universe",
      source:"Official municipal source ↗", status:{loaded:"Loaded",loaded_partial:"Partly loaded",upgrading:"Detail upgrade running",crawling:"Crawl started",candidate:"Recommended next",assessed:"Assessed"},
      sources:"Research sources", nationalNote:"OBS 2023 is the latest complete global round: 125 countries, central government only.", municipalNote:"Municipal score weights: approved 20, revised 15, in-year 15, final 20, function 10, economic 10, API/bulk 10. PSD adds 20% of that municipal score to OBS, capped at 100.",
      scoreWhy:"Why this score", obs:"OBS central government", municipalCapability:"municipal capability", municipalBonus:"municipal bonus", noObs:"OBS did not assess this country", noMunicipal:"municipal layer not yet researched", completeEvidence:"central and municipal evidence", nationalOnly:"central evidence; municipal review pending", municipalOnly:"municipal evidence; no OBS score", noEvidence:"no verified score component"
    },
    cs: {
      mode:"Vrstva pokrytí", readiness:"Index rozpočtové transparentnosti", national:"Skóre OBS pro centrální vládu", municipal:"Položkový životní cyklus obcí",
      features:{enacted:"Schválený obecní rozpočet",revised:"Upravený obecní rozpočet",execution:"Průběžné plnění obcí",actual:"Závěrečné účty obcí",function:"Funkční členění obcí",economic:"Ekonomické členění obcí",api:"Obecní API / hromadná data"},
      universe:"států zobrazeno · 100% geografické pokrytí", scored:"zemí s ověřenou složkou skóre", complete:"státních i obecních důkazů", provisional:"skóre čekajících na obecní průzkum", assessed:"státních rozpočtů posouzených OBS", researched:"prověřených obecních systémů", sufficient:"zveřejňuje dost pro informovanou debatu", full:"úplných obecních životních cyklů", scant:"téměř žádné informace o státním rozpočtu", decentralized:"bez jednotné národní obecní vrstvy",
      excellent:"Výborné · 81–100", strong:"Silné · 61–80", partial:"Částečné · 41–60", weak:"Slabé · 21–40", veryWeak:"Velmi slabé · 0–20",
      extensive:"Rozsáhlé informace · 81–100", substantial:"Dostatečné · 61–80", limited:"Omezené · 41–60", minimal:"Minimální · 21–40", scantBand:"Skrovné nebo žádné · 0–20",
      fullLifecycle:"Úplný obecní životní cyklus", budgetAccounts:"Schválený rozpočet + závěrečné účty", accountsOnly:"Jen skutečnost / plnění", decentralizedBand:"Nenalezena jednotná národní položková vrstva",
      available:"Dostupné v prověřené národní vrstvě", unavailable:"Není v prověřené národní vrstvě", verify:"Nutno ověřit", notResearched:"Neprověřeno / bez ověřeného skóre",
      caveat:"Index rozpočtové transparentnosti kombinuje skóre OBS pro centrální vládu s až 20 body za ověřenou hloubku obecních dat. Chybějící obecní průzkum nepřidává bonus a skóre zůstává předběžné. Tmavě šedá znamená neprověřeno či nehodnoceno—nikoli „vláda nic nezveřejňuje“. Béžová barva je prostřední pásmo.",
      bestTitle:"Vlády zveřejňující dostatek informací o centrálním rozpočtu", worstTitle:"Skrovné nebo žádné informace o centrálním rozpočtu", municipalTitle:"Zjištění k položkovým obecním datům", tableTitle:"Všech 195 států · matice důkazů a skóre",
      country:"Země", psdScore:"Index rozpočtové transparentnosti", obsScore:"Skóre OBS centrální vlády", municipalColumn:"Obecní vrstva", loadColumn:"Pokrytí v PSD", loadedProfile:"Načteno", crawlStarted:"Crawl spuštěn", notLoaded:"Nenačteno", stages:["Schválený","Upravený","Během roku","Skutečnost","Funkce","Ekonomika","API / bulk"], outside:"Mimo univerzum 195 států",
      source:"Oficiální obecní zdroj ↗", status:{loaded:"Načteno",loaded_partial:"Částečně načteno",upgrading:"Běží detailní upgrade",crawling:"Crawl spuštěn",candidate:"Doporučený další",assessed:"Posouzeno"},
      sources:"Výzkumné zdroje", nationalNote:"OBS 2023 je poslední úplné globální kolo: 125 zemí, pouze centrální vláda.", municipalNote:"Váhy obecního skóre: schválený rozpočet 20, upravený 15, průběžné plnění 15, skutečnost 20, funkce 10, ekonomika 10, API/bulk 10. PSD přičte 20 % obecního skóre k OBS, nejvýše do 100.",
      scoreWhy:"Proč má toto skóre", obs:"OBS centrální vláda", municipalCapability:"obecní schopnosti", municipalBonus:"obecní bonus", noObs:"OBS tuto zemi neposuzoval", noMunicipal:"obecní vrstva zatím neprověřena", completeEvidence:"státní i obecní důkazy", nationalOnly:"státní důkazy; obecní průzkum čeká", municipalOnly:"obecní důkazy; bez skóre OBS", noEvidence:"bez ověřené složky skóre"
    }
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const flag = (iso2) => [...iso2.toUpperCase()].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");
  const featureCategory = (country,key) => country?.municipal_item_level?.research_status !== "researched" ? "not_researched" : country.municipal_item_level.features[key] === true ? "available" : country.municipal_item_level.features[key] === false ? "unavailable" : "verify";
  const categoryFor = (country) => state.mode === "readiness" ? country?.portal_readiness?.band ?? "not_researched" : state.mode === "national" ? country?.national_budget?.band ?? "not_researched" : state.mode === "municipal" ? country?.municipal_item_level?.category ?? "not_researched" : featureCategory(country,state.mode);
  const municipalLabel = (category,t) => ({full_lifecycle:t.fullLifecycle,budget_and_accounts:t.budgetAccounts,accounts_only:t.accountsOnly,decentralized:t.decentralizedBand,not_researched:t.notResearched})[category];
  const nationalLabel = (category,t) => ({extensive:t.extensive,substantial:t.substantial,limited:t.limited,minimal:t.minimal,scant:t.scantBand,not_researched:t.notResearched})[category];
  const readinessLabel = (category,t) => ({excellent:t.excellent,strong:t.strong,partial:t.partial,weak:t.weak,very_weak:t.veryWeak,not_researched:t.notResearched})[category];
  const categoryLabel = (category,t) => state.mode === "readiness" ? readinessLabel(category,t) : state.mode === "national" ? nationalLabel(category,t) : state.mode === "municipal" ? municipalLabel(category,t) : ({available:t.available,unavailable:t.unavailable,verify:t.verify,not_researched:t.notResearched})[category];
  const symbol = (country,key) => country.municipal_item_level.research_status !== "researched" ? "●" : country.municipal_item_level.features[key] === true ? "✓" : country.municipal_item_level.features[key] === false ? "—" : "?";
  const symbolClass = (country,key) => country.municipal_item_level.research_status !== "researched" ? "not-researched" : featureCategory(country,key);

  function modeOptions(t) {
    return `<option value="readiness">${esc(t.readiness)}</option><option value="national">${esc(t.national)}</option><option value="municipal">${esc(t.municipal)}</option>${featureKeys.map((key) => `<option value="${key}">${esc(t.features[key])}</option>`).join("")}`;
  }
  function legend(t,countries) {
    const orders = state.mode === "readiness" ? ["excellent","strong","partial","weak","very_weak","not_researched"] : state.mode === "national" ? ["extensive","substantial","limited","minimal","scant","not_researched"] : state.mode === "municipal" ? ["full_lifecycle","budget_and_accounts","accounts_only","decentralized","not_researched"] : ["available","unavailable","verify","not_researched"];
    return orders.map((category) => `<li><i class="atlas-${category}"></i><span>${esc(categoryLabel(category,t))}</span><b>${countries.filter((country) => categoryFor(country) === category).length}</b></li>`).join("");
  }
  function summary(t,countries) {
    const assessed = countries.filter((country) => country.national_budget.research_status === "assessed").length;
    const researched = countries.filter((country) => country.municipal_item_level.research_status === "researched").length;
    if (state.mode === "readiness") return [[`${countries.length}/${registry.universe.country_count}`,t.universe],[countries.filter((country) => country.portal_readiness.score !== null).length,t.scored],[countries.filter((country) => country.portal_readiness.evidence_status === "complete").length,t.complete],[countries.filter((country) => country.portal_readiness.evidence_status === "national_only").length,t.provisional]];
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
  function sortValue(country,key) {
    if (key === "country") return country[`name_${language()}`];
    if (key === "index") return country.budget_transparency_index.score;
    if (key === "obs") return country.national_budget.score;
    if (key === "municipal") return ({full_lifecycle:4,budget_and_accounts:3,accounts_only:2,decentralized:1,not_researched:null})[country.municipal_item_level.category];
    if (key === "load") return ({loaded:3,discovery_crawl_started:2,not_queued:1})[country.psd_coverage.ingestion_status];
    if (featureKeys.includes(key)) return country.municipal_item_level.research_status !== "researched" ? null : country.municipal_item_level.features[key] === true ? 2 : country.municipal_item_level.features[key] === null ? 1 : 0;
    return null;
  }
  function sortedCountries(countries) {
    return [...countries].sort((a,b) => {
      const av=sortValue(a,state.sortKey), bv=sortValue(b,state.sortKey);
      if (av === null && bv !== null) return 1;
      if (av !== null && bv === null) return -1;
      if (av === null && bv === null) return a.name_en.localeCompare(b.name_en);
      const comparison=typeof av === "string" ? av.localeCompare(bv,language()) : av-bv;
      return (state.sortDirection === "asc" ? comparison : -comparison) || a.name_en.localeCompare(b.name_en);
    });
  }
  function sortHeader(key,label) {
    const active=state.sortKey === key, direction=active ? state.sortDirection : "none", arrow=active ? (state.sortDirection === "asc" ? "↑" : "↓") : "↕";
    return `<th aria-sort="${direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending"}"><button type="button" class="atlas-sort" data-sort="${key}">${esc(label)} <span aria-hidden="true">${arrow}</span></button></th>`;
  }
  function evidenceTable(t,countries) {
    const rows = sortedCountries(countries).map((country) => {
      const municipal = country.municipal_item_level;
      const municipalText = municipal.research_status === "researched" ? municipalLabel(municipal.category,t) : t.notResearched;
      const loadText=country.psd_coverage.country_profile === "loaded" ? t.loadedProfile : country.psd_coverage.ingestion_status === "discovery_crawl_started" ? t.crawlStarted : t.notLoaded;
      return `<tr id="atlas-row-${country.iso2}"><th><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><span>${esc(country[`name_${language()}`])}<small>${esc(country.iso2.toUpperCase())}</small></span></th><td class="atlas-score ${country.budget_transparency_index.band}">${country.budget_transparency_index.score ?? "●"}</td><td class="atlas-score ${country.national_budget.band}">${country.national_budget.score ?? "●"}</td><td class="atlas-municipal-status atlas-${municipal.category}">${esc(municipalText)}</td><td class="atlas-load atlas-load-${country.psd_coverage.ingestion_status}">${esc(loadText)}</td>${featureKeys.map((key) => `<td class="${symbolClass(country,key)}" aria-label="${esc(({available:t.available,unavailable:t.unavailable,verify:t.verify,not_researched:t.notResearched})[featureCategory(country,key)])}">${symbol(country,key)}</td>`).join("")}</tr>`;
    }).join("");
    return `<h3 class="atlas-subtitle">${esc(t.tableTitle)}</h3><div class="atlas-table-wrap" tabindex="0"><table class="atlas-table"><thead><tr>${sortHeader("country",t.country)}${sortHeader("index",t.psdScore)}${sortHeader("obs",t.obsScore)}${sortHeader("municipal",t.municipalColumn)}${sortHeader("load",t.loadColumn)}${t.stages.map((label,index) => sortHeader(featureKeys[index],label)).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function evidenceLabel(status,t) {
    return ({complete:t.completeEvidence,national_only:t.nationalOnly,municipal_only:t.municipalOnly,not_scored:t.noEvidence})[status];
  }
  function tooltipMarkup(country,t,lang) {
    const readiness=country.portal_readiness, name=country[`name_${lang}`];
    let calculation=t.noEvidence;
    if (readiness.obs_component !== null && readiness.municipal_score !== null) calculation=`${readiness.obs_component} ${t.obs} + ${readiness.municipal_bonus} ${t.municipalBonus} (${readiness.municipal_score}/100 ${t.municipalCapability}) = ${readiness.score}`;
    else if (readiness.obs_component !== null) calculation=`${readiness.obs_component} ${t.obs} + 0 ${t.municipalBonus} = ${readiness.score} · ${t.noMunicipal}`;
    else if (readiness.municipal_score !== null) calculation=`${readiness.municipal_score}/100 ${t.municipalCapability} = ${readiness.score} · ${t.noObs}`;
    const selected=`${categoryLabel(categoryFor(country),t)}${state.mode === "readiness" && readiness.score !== null ? ` · ${t.scoreWhy}` : ""}`;
    return `<strong>${flag(country.iso2)} ${esc(name)}</strong><span>${esc(selected)}</span><b>${esc(calculation)}</b><small>${esc(evidenceLabel(readiness.evidence_status,t))}</small>`;
  }
  function render() {
    if (!registry || !geometry) return;
    const lang=language(), t=copy[lang], countries=registry.countries, byIso=new Map(countries.map((country) => [country.iso2,country]));
    const paths=geometry.locations.map((location) => {
      const country=byIso.get(location.id);
      if (!country) return `<path class="atlas-country atlas-outside" d="${location.path}" aria-label="${esc(`${location.name}: ${t.outside}`)}"><title>${esc(`${location.name}: ${t.outside}`)}</title></path>`;
      const category=categoryFor(country), score=state.mode === "readiness" ? country.portal_readiness.score : state.mode === "national" ? country.national_budget.score : null;
      const label=`${country[`name_${lang}`]}: ${categoryLabel(category,t)}${score === null ? "" : `, ${score}/100`}`;
      return `<path class="atlas-country atlas-${category}" d="${location.path}" tabindex="0" data-iso="${location.id}" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
    }).join("");
    const kpis=summary(t,countries).map(([value,label]) => `<article><strong>${value}</strong><span>${esc(label)}</span></article>`).join("");
    const detail=state.mode === "readiness" ? "" : state.mode === "national" ? nationalLists(t,countries) : municipalFindings(t,countries);
    const sources=registry.sources.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a><span>${esc(source.scope)}</span></li>`).join("");
    root.innerHTML=`<div class="atlas-controls"><label for="atlas-mode">${esc(t.mode)}</label><select id="atlas-mode">${modeOptions(t)}</select></div><div class="atlas-kpis">${kpis}</div><div class="atlas-map-panel"><div class="atlas-map-wrap"><svg class="atlas-map" viewBox="${geometry.viewBox}" role="img" aria-label="${esc(t.mode)}"><defs><pattern id="atlas-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#d2ccc1"></rect><line x1="0" y1="0" x2="0" y2="8" stroke="#8b8d83" stroke-width="2"></line></pattern></defs>${paths}</svg></div><ol class="atlas-legend">${legend(t,countries)}</ol><div class="atlas-tooltip" role="tooltip" aria-hidden="true"></div></div><p class="atlas-caveat">${esc(t.caveat)}</p>${detail}${evidenceTable(t,countries)}<div class="atlas-research-notes"><div><h3>${esc(t.sources)}</h3><ul>${sources}</ul></div><p>${esc(t.nationalNote)}<br>${esc(t.municipalNote)}</p></div>`;
    const mode=root.querySelector("#atlas-mode"); mode.value=state.mode; mode.addEventListener("change",() => { state.mode=mode.value; render(); });
    root.querySelectorAll(".atlas-sort").forEach((button) => button.addEventListener("click",() => {
      const key=button.dataset.sort;
      if (state.sortKey === key) state.sortDirection=state.sortDirection === "asc" ? "desc" : "asc";
      else { state.sortKey=key; state.sortDirection=key === "country" ? "asc" : "desc"; }
      render();
    }));
    const panel=root.querySelector(".atlas-map-panel"), tooltip=root.querySelector(".atlas-tooltip");
    const showTooltip=(path,event) => {
      const country=byIso.get(path.dataset.iso); if (!country) return;
      tooltip.innerHTML=tooltipMarkup(country,t,lang); tooltip.setAttribute("aria-hidden","false");
      const panelRect=panel.getBoundingClientRect(), markRect=path.getBoundingClientRect();
      const x=event?.clientX ?? markRect.left + markRect.width/2, y=event?.clientY ?? markRect.top;
      const halfWidth=Math.min(165,(panelRect.width-24)/2), localY=Math.max(12,y-panelRect.top);
      tooltip.style.left=`${Math.max(halfWidth+12,Math.min(panelRect.width-halfWidth-12,x-panelRect.left))}px`;
      tooltip.style.top=`${localY}px`;
      tooltip.style.transform=localY > tooltip.offsetHeight + 24 ? "translate(-50%, calc(-100% - 14px))" : "translate(-50%, 14px)";
    };
    const hideTooltip=() => { tooltip.setAttribute("aria-hidden","true"); };
    root.querySelectorAll(".atlas-country[tabindex='0']").forEach((path) => {
      const activate=() => { const row=root.querySelector(`#atlas-row-${path.dataset.iso}`); row?.scrollIntoView({behavior:"smooth",block:"center"}); row?.classList.add("is-highlighted"); setTimeout(() => row?.classList.remove("is-highlighted"),1800); };
      path.addEventListener("pointerenter",(event) => showTooltip(path,event)); path.addEventListener("pointermove",(event) => showTooltip(path,event)); path.addEventListener("pointerleave",hideTooltip);
      path.addEventListener("focus",() => showTooltip(path)); path.addEventListener("blur",hideTooltip);
      path.addEventListener("click",activate); path.addEventListener("keydown",(event) => { if (event.key === "Enter" || event.key === " ") activate(); });
    });
  }
  const transparencyDataPromise = window.psdTransparencyDataPromise || (window.psdTransparencyDataPromise = Promise.all([fetch(`${assetRoot}data/global-budget-transparency.v1.json`).then((response) => response.json()),fetch(`${assetRoot}data/world-map.v1.json`).then((response) => response.json())]));
  transparencyDataPromise.then(([data,map]) => { registry=data; geometry=map; render(); }).catch((error) => { console.error(error); root.textContent=language() === "en" ? "Transparency atlas could not be loaded." : "Atlas transparentnosti se nepodařilo načíst."; });
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click",() => setTimeout(render)));
})();
