(() => {
  const roots = {
    budget: document.querySelector("#country-budget-map-root"),
    demography: document.querySelector("#country-demography-root"),
  };
  if (!Object.values(roots).every(Boolean)) return;

  const state = {
    code: window.PSDCountryRoutes.codeFromLocation(),
    lang: document.documentElement.lang === "en" ? "en" : "cs",
    currencyView: "local",
    native: null,
    common: null,
    demography: null,
  };
  const copy = {
    cs: {
      navBudget: "Překlad", navEntities: "Subjekty", navDemography: "Demografie",
      budgetKicker: "04 / Překlad rozpočtových řádků", budgetTitle: "Národní řádek. Společný účel.",
      budgetCopy: "Originální název položky zůstává viditelný a jeho anglický překlad zachovává institucionální význam. Teprve potom položky mapujeme do společných oblastí.",
      largestPurpose: "Největší společná oblast", topThree: "Tři největší oblasti", strongestRise: "Největší růst podílu", nativeLines: "Zdrojové rozpočtové řádky", currentBudget: "Aktuální rozpočet", share: "Podíl", change: "Změna podílu", pp: "p. b.", moreLines: "dalších řádků", classificationNote: "Společné oblasti jsou analytická mapa, nikoli náhrada národní klasifikace. Součty zůstávají v původním rozpočtovém rozsahu.",
      entitiesKicker: "05 / Stát jako vlastník", entitiesTitle: "Veřejné subjekty a dostupné účty.",
      entitiesCopy: "Oddělujeme počet subjektů v oficiálním portfoliu od počtu účetních výkazů, které lze skutečně srovnat. Obrat firem nepřičítáme k příjmům rozpočtu.",
      officialPortfolio: "Oficiální portfolio", statements: "Výkazy ve zdroji", statementCoverage: "Pokrytí výkazy", period: "Období", scope: "Koho zdroj zahrnuje", boundary: "Národní hranice portfolia", fullRoster: "Detailní seznam uložen", sourceOnly: "Zdroj a rozsah uloženy; řádkový seznam zatím ne", records: "Otevřít uložené záznamy", source: "Otevřít oficiální zdroj", inventory: "Přehled portfolií", notRanking: "Počty nejsou žebříček: definice veřejného subjektu se mezi zeměmi liší.", accounts: "výkazů", entities: "subjektů",
      demoKicker: "08 / Demografický tlak", demoTitle: "Kdo bude žít v zemi — rok po roku.",
      demoCopy: "Oficiální hlavní varianta je uložena po věku a pohlaví. Pásma níže jsou dopočítána přímo z těchto řádků, nikoli z předem zaokrouhlených souhrnů.",
      populationChange: "Změna populace", workingChange: "Změna věku 20–64", olderGrowth: "Změna populace 80+", dependency: "65+ na 100 lidí 20–64", ageStructure: "Věková struktura", men: "Muži", women: "Ženy", referenceDate: "Referenční datum", detailRows: "uložených řádků", downloadDetail: "Stáhnout věk × pohlaví × rok", projection: "Varianta", years: "2025 → 2045", age0: "0–19", age20: "20–64", age65: "65–79", age80: "80+",
    },
    en: {
      navBudget: "Translation", navEntities: "Entities", navDemography: "Demography",
      budgetKicker: "04 / Budget-line translation", budgetTitle: "Native line. Common purpose.",
      budgetCopy: "The original source label stays visible, while its English translation preserves the institutional meaning. Only then are lines mapped into common purposes.",
      largestPurpose: "Largest common purpose", topThree: "Top-three purposes", strongestRise: "Largest share increase", nativeLines: "Source budget lines", currentBudget: "Current budget", share: "Share", change: "Share change", pp: "pp", moreLines: "more lines", classificationNote: "Common purposes are an analytical map, not a replacement for the national classification. Totals retain the source budget perimeter.",
      entitiesKicker: "05 / The state as owner", entitiesTitle: "Public entities and available accounts.",
      entitiesCopy: "The official portfolio count is kept separate from the financial statements that can actually be compared. Company turnover is not added to budget revenue.",
      officialPortfolio: "Official portfolio", statements: "Statements in source", statementCoverage: "Statement coverage", period: "Period", scope: "Who the source includes", boundary: "National portfolio boundary", fullRoster: "Detailed records stored", sourceOnly: "Source and scope stored; row-level roster not yet loaded", records: "Open stored records", source: "Open official source", inventory: "Portfolio inventory", notRanking: "Counts are not a ranking: countries define public entities differently.", accounts: "statements", entities: "entities",
      demoKicker: "08 / Demographic pressure", demoTitle: "Who will live in the country — year by year.",
      demoCopy: "The official central variant is stored by age and sex. The bands below are calculated directly from those rows, not from pre-rounded summaries.",
      populationChange: "Population change", workingChange: "Change in ages 20–64", olderGrowth: "Change in population 80+", dependency: "People 65+ per 100 aged 20–64", ageStructure: "Age structure", men: "Men", women: "Women", referenceDate: "Reference date", detailRows: "stored rows", downloadDetail: "Download age × sex × year", projection: "Variant", years: "2025 → 2045", age0: "0–19", age20: "20–64", age65: "65–79", age80: "80+",
    },
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits = 1) => Number(value).toLocaleString(locale(), {minimumFractionDigits: digits, maximumFractionDigits: digits});
  const integer = value => Number(value).toLocaleString(locale(), {maximumFractionDigits: 0});
  const signed = (value, suffix = "%") => `${value > 0 ? "+" : ""}${number(value)}${suffix}`;
  const pctChange = (from, to) => from ? (to / from - 1) * 100 : null;
  const nativeCountry = () => state.native?.countries.find(country => country.code === state.code);
  const commonCountry = () => state.common?.countries.find(country => country.code === state.code);
  const money = (value, country) => {
    const inEur = state.currencyView === "eur";
    const converted = inEur ? value / state.native.fx.local_per_eur[country.currency] : value;
    const unit = inEur ? "EUR" : country.currency;
    return `${number(converted, Math.abs(converted) < 10 ? 2 : Math.abs(converted) < 100 ? 1 : 0)} ${state.lang === "en" ? "bn" : "mld."} ${unit}`;
  };
  const translatedLine = row => {
    const translated = row.label_en || row.label_native;
    const differs = translated.toLocaleLowerCase("en") !== row.label_native.toLocaleLowerCase("en");
    if (state.lang === "en") return `<b>${esc(translated)}</b>${differs ? `<small>${esc(row.label_native)}</small>` : ""}`;
    return `<b>${esc(row.label_native)}</b>${differs ? `<small>EN · ${esc(translated)}</small>` : ""}`;
  };

  function renderBudgetMap() {
    const t = copy[state.lang], native = nativeCountry(), common = commonCountry();
    if (!native || !common) return;
    const categories = new Map(state.common.categories.map(category => [category.id, category]));
    const groups = [...common.groups].sort((a, b) => b.amounts.current - a.amounts.current);
    const biggest = groups[0], topThree = groups.slice(0, 3).reduce((sum, group) => sum + group.shares_pct.current, 0);
    const rise = [...groups].sort((a, b) => (b.shares_pct.current - b.shares_pct.previous) - (a.shares_pct.current - a.shares_pct.previous))[0];
    const label = group => categories.get(group.category_id)[`label_${state.lang}`];
    roots.budget.innerHTML = `<div class="detail-heading"><div><span class="kicker">${t.budgetKicker}</span><h2 id="country-budget-map-title">${t.budgetTitle}</h2></div><p>${t.budgetCopy}</p></div>
      <div class="insight-kpis budget-map-kpis"><article><span>${t.currentBudget}</span><strong>${money(common.totals.current, native)}</strong><small>${esc(native[`scope_${state.lang}`])}</small></article><article><span>${t.largestPurpose}</span><strong>${esc(label(biggest))}</strong><small>${number(biggest.shares_pct.current)}%</small></article><article><span>${t.topThree}</span><strong>${number(topThree)}%</strong><small>${groups.slice(0, 3).map(label).join(" · ")}</small></article><article><span>${t.strongestRise}</span><strong>${esc(label(rise))}</strong><small>${signed(rise.shares_pct.current-rise.shares_pct.previous, ` ${t.pp}`)}</small></article></div>
      <div class="budget-map-list">${groups.map(group => {
        const category = categories.get(group.category_id), delta = group.shares_pct.current - group.shares_pct.previous;
        return `<article class="budget-map-row"><header><div><span>${esc(group.category_id.replaceAll("_", " "))}</span><h3>${esc(category[`label_${state.lang}`])}</h3></div><div><strong>${money(group.amounts.current, native)}</strong><small>${t.share} ${number(group.shares_pct.current)}% · ${t.change} ${signed(delta, ` ${t.pp}`)}</small></div></header><div class="budget-map-track"><i style="width:${Math.max(0, group.shares_pct.current)}%"></i></div><div class="budget-source-lines"><span>${t.nativeLines}</span>${group.source_rows.slice(0, 5).map(row => `<div>${translatedLine(row)}</div>`).join("")}${group.source_rows.length > 5 ? `<em>+${group.source_rows.length - 5} ${t.moreLines}</em>` : ""}</div></article>`;
      }).join("")}</div><p class="insight-method">${t.classificationNote}</p>`;
  }

  function renderDemography() {
    const t = copy[state.lang], profile = state.demography?.countries[state.code];
    if (!profile) return;
    const first = profile.years[0], last = profile.years.at(-1), shownYears = new Set([2025, 2030, 2035, 2040, 2045]);
    const populationDelta = pctChange(first.total, last.total), workingDelta = pctChange(first.age_20_64, last.age_20_64), olderDelta = pctChange(first.age_80_plus, last.age_80_plus);
    const bands = [{key:"age_0_19",label:t.age0},{key:"age_20_64",label:t.age20},{key:"age_65_79",label:t.age65},{key:"age_80_plus",label:t.age80}];
    roots.demography.innerHTML = `<div class="detail-heading"><div><span class="kicker">${t.demoKicker}</span><h2 id="country-demography-title">${t.demoTitle}</h2></div><p>${t.demoCopy}</p></div>
      <div class="insight-kpis demography-kpis"><article><span>${t.populationChange}</span><strong>${signed(populationDelta)}</strong><small>${t.years}</small></article><article><span>${t.workingChange}</span><strong>${signed(workingDelta)}</strong><small>${integer(first.age_20_64)} → ${integer(last.age_20_64)}</small></article><article><span>${t.olderGrowth}</span><strong>${signed(olderDelta)}</strong><small>${integer(first.age_80_plus)} → ${integer(last.age_80_plus)}</small></article><article><span>${t.dependency}</span><strong>${number(last.old_age_dependency_per_100_working_age)}</strong><small>${number(first.old_age_dependency_per_100_working_age)} → ${number(last.old_age_dependency_per_100_working_age)}</small></article></div>
      <article class="demography-structure"><header><div><span>${t.ageStructure}</span><h3>${esc(profile.projection)}</h3></div><div class="age-legend">${bands.map(band => `<span class="${band.key}"><i></i>${band.label}</span>`).join("")}</div></header><div class="demography-years">${profile.years.filter(row => shownYears.has(row.year)).map(row => `<div class="demography-year"><b>${row.year}</b><div class="demography-stack">${bands.map(band => `<i class="${band.key}" style="width:${row.shares_pct[band.key]}%" title="${band.label}: ${number(row.shares_pct[band.key])}%"></i>`).join("")}</div><strong>${integer(row.total)}</strong><small>${t.men} ${number(row.male / row.total * 100)}% · ${t.women} ${number(row.female / row.total * 100)}%</small></div>`).join("")}</div></article>
      <div class="demography-source"><div><span>${t.projection}</span><strong>${esc(profile.projection)}</strong><small>${t.referenceDate}: ${esc(profile.reference_date)} · ${profile.source.period}</small></div><div><span>${integer(profile.detail_row_count)} ${t.detailRows}</span><a href="${esc(profile.detail)}">${t.downloadDetail} ↗</a><a href="${esc(profile.source.url)}" target="_blank" rel="noreferrer">${esc(profile.source.publisher)} ↗</a></div></div>`;
  }

  function render() {
    document.querySelector('[data-insight-nav="budget"]')?.replaceChildren(document.createTextNode(copy[state.lang].navBudget));
    document.querySelector('[data-insight-nav="entities"]')?.replaceChildren(document.createTextNode(copy[state.lang].navEntities));
    document.querySelector('[data-insight-nav="demography"]')?.replaceChildren(document.createTextNode(copy[state.lang].navDemography));
    if (state.native && state.common) renderBudgetMap();
    if (state.demography) renderDemography();
  }
  addEventListener("countryprofilechange", event => {
    state.code = event.detail.code;
    state.lang = event.detail.lang === "en" ? "en" : "cs";
    state.currencyView = event.detail.currency === "eur" ? "eur" : "local";
    render();
  });
  Promise.all([
    fetch("data/country-spending-2025-2026.v1.json"), fetch("data/country-spending-comparison.v1.json"),
    fetch("data/country-demography.v1.json"),
  ]).then(async responses => {
    for (const response of responses) if (!response.ok) throw new Error(response.status);
    [state.native, state.common, state.demography] = await Promise.all(responses.map(response => response.json()));
    render();
  }).catch(error => console.error("Country insight parity", error));
})();
