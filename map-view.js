(() => {
  const root = document.querySelector("#spending-map-root");
  if (!root) return;

  const getLang = () => (window.PSDLanguage?.current() || document.documentElement.lang) === "en" ? "en" : "cs";
  let lang = getLang();
  const copy = {
    cs: {
      heroKicker: "Mapa · celý svět", heroTitle: "Mapa veřejných výdajů", heroLead: "Postavte proti sobě školství a obranu, zdravotnictví a sociální ochranu nebo dvě fiskální veličiny. Mapa zobrazuje hodnotu i směr rozdílu.", heroAsideLabel: "Tři datové pohledy", heroCountries: "států na mapě", heroCategories: "rozpočtových a funkčních kategorií", heroYears: "let globálního fiskálního kontextu", workbenchKicker: "Interaktivní srovnání", workbenchTitle: "Porovnejte dvě kategorie výdajů", workbenchLead: "V režimu Souboj barva vyjadřuje rozdíl mezi dvěma ukazateli v téže účetní vrstvě. Režim Jedna vrstva ukazuje rozložení jediné hodnoty.", loading: "Načítám mapu a datové vrstvy…",
      lens: "Datový pohled", budget: "Koš státního rozpočtu", functions: "Funkce · % HDP", fiscal: "Fiskální systém", duel: "Souboj", single: "Jedna vrstva", metricA: "Ukazatel A · zelená", metricB: "Ukazatel B · červená", year: "Rok", period: "Období", country: "Najít zemi", countryPlaceholder: "Název nebo kód…", vs: "VS", mapLabel: "Mapa srovnání veřejných výdajů", legend: "Jak číst mapu", story: "Co mapa říká", source: "Metodika a zdroje", noData: "Bez srovnatelných dat", close: "téměř vyrovnané", strongerA: "více pro A", muchStrongerA: "výrazně více pro A", strongerB: "více pro B", muchStrongerB: "výrazně více pro B", lower: "nižší", higher: "vyšší", countries: "zemí", pp: "p. b.", pctBudget: "% mapovaného rozpočtu", pctGdp: "% HDP", percent: "%", selectedCountry: "Vybraná země", openProfile: "Otevřít profil →", noCountryData: "Pro tuto zemi není v právě zvolené vrstvě dost údajů.", scope: "Účetní rozsah", history: "Vývoj obou ukazatelů", ranking: "Největší rozdíly", mapError: "Mapu se nepodařilo načíst.", fixedPeriod: "nejnovější rozpočtové období", latestAvailable: "nejnovější dostupné období",
      budgetContract: "Široké kategorie jsou mapované z národních centrálních nebo státních rozpočtů. Nejde o harmonizovanou COFOG statistiku ani celý sektor vládních institucí; srovnávejte strukturu, ne velikost států.", functionsContract: "Funkční výdaje jsou převážně COFOG za sektor vládních institucí. Ukrajina a americká doprava používají odlišný národní rozsah, který zůstává uveden v detailu.", fiscalContract: "Globální fiskální řady používají harmonizovaný sektor vládních institucí z IMF World Economic Outlook. Zobrazený rok je skutečnost do roku 2024.",
      budgetStory: (a, b, ac, bc, n) => `${a} zabírá větší podíl než ${b} v ${ac} z ${n} zemí; opačně je tomu v ${bc}.`, duelStory: (a, b, ac, bc, n) => `${a} je vyšší než ${b} v ${ac} z ${n} zemí; ${b} vede v ${bc}.`, singleStory: (a, country, value) => `Nejvyšší hodnotu ukazatele ${a} má ${country}: ${value}.`, difference: "Rozdíl", mappedCountries: "zemí s oběma hodnotami", range: "Rozsah hodnot", from: "od", to: "do", current: "aktuální"
    },
    en: {
      heroKicker: "Map · whole world", heroTitle: "The public spending map", heroLead: "Put education against defence, health against social protection, or two fiscal measures. The map shows both the value and the direction of the gap.", heroAsideLabel: "Three data views", heroCountries: "states on the map", heroCategories: "budget and functional categories", heroYears: "years of global fiscal context", workbenchKicker: "Interactive comparison", workbenchTitle: "Compare two spending categories", workbenchLead: "In Duel mode, colour shows the gap between two measures from the same accounting layer. Single layer mode maps the distribution of one value.", loading: "Loading map and data layers…",
      lens: "Data view", budget: "National budget basket", functions: "Functions · % GDP", fiscal: "Fiscal system", duel: "Duel", single: "Single layer", metricA: "Metric A · green", metricB: "Metric B · red", year: "Year", period: "Period", country: "Find a country", countryPlaceholder: "Name or code…", vs: "VS", mapLabel: "Public spending comparison map", legend: "How to read the map", story: "What the map says", source: "Methodology & sources", noData: "No comparable data", close: "nearly even", strongerA: "more for A", muchStrongerA: "much more for A", strongerB: "more for B", muchStrongerB: "much more for B", lower: "lower", higher: "higher", countries: "countries", pp: "pp", pctBudget: "% of mapped budget", pctGdp: "% of GDP", percent: "%", selectedCountry: "Selected country", openProfile: "Open profile →", noCountryData: "This country does not have enough data in the selected layer.", scope: "Accounting scope", history: "Both metrics over time", ranking: "Largest gaps", mapError: "The map could not be loaded.", fixedPeriod: "latest national budget period", latestAvailable: "latest available period",
      budgetContract: "Broad categories are mapped from national central or state budgets. This is not harmonised COFOG statistics or the whole general-government sector; compare budget structure, not the size of states.", functionsContract: "Functional spending is mostly COFOG for general government. Ukraine and U.S. transport use a different national perimeter, kept visible in country detail.", fiscalContract: "Global fiscal series use the harmonised general-government perimeter from the IMF World Economic Outlook. The displayed series is actual through 2024.",
      budgetStory: (a, b, ac, bc, n) => `${a} takes a larger share than ${b} in ${ac} of ${n} countries; the reverse is true in ${bc}.`, duelStory: (a, b, ac, bc, n) => `${a} is higher than ${b} in ${ac} of ${n} countries; ${b} leads in ${bc}.`, singleStory: (a, country, value) => `${country} has the highest ${a} value: ${value}.`, difference: "Gap", mappedCountries: "countries with both values", range: "Value range", from: "from", to: "to", current: "current"
    }
  };
  let t = copy[lang];
  const state = { lens: "budget", mode: "duel", metricA: "defence", metricB: "education_research", year: 2024, selected: "CZE", data: null };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const locale = () => lang === "cs" ? "cs-CZ" : "en-GB";
  const format = (value, digits = 1) => new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))] : 0;
  const countryName = (country) => {
    const code = country?.iso3 || country?.country_code || country?.code;
    const canonical = state.data?.fiscal?.countries?.find((item) => item.country_code === code);
    return canonical?.[`name_${lang}`] || country?.[`name_${lang}`] || country?.name_en || code || "—";
  };
  const metricLabel = (metric) => metric?.[`label_${lang}`] || metric?.label_en || metric?.label_cs || metric?.id || "—";

  const fiscalLabels = {
    revenue_pct_gdp: ["Příjmy vládních institucí", "Government revenue"], expenditure_pct_gdp: ["Výdaje vládních institucí", "Government expenditure"], balance_pct_gdp: ["Rozpočtové saldo", "Fiscal balance"], primary_balance_pct_gdp: ["Primární saldo", "Primary balance"], gross_debt_pct_gdp: ["Hrubý vládní dluh", "Gross government debt"], real_gdp_growth_pct: ["Reálný růst HDP", "Real GDP growth"], inflation_pct: ["Inflace CPI", "CPI inflation"], unemployment_pct: ["Nezaměstnanost", "Unemployment"]
  };

  function metrics() {
    if (state.lens === "budget") return state.data.budget.categories.map((metric) => ({ ...metric, unit: "share_budget" }));
    if (state.lens === "functions") return Object.entries(state.data.functions.categories).map(([id, metric]) => ({ id, ...metric, unit: "pct_gdp" }));
    const allowed = new Set(Object.keys(fiscalLabels));
    return state.data.fiscal.metrics.filter((metric) => allowed.has(metric.metric_code)).map((metric) => ({ ...metric, id: metric.metric_code, label_cs: fiscalLabels[metric.metric_code][0], label_en: fiscalLabels[metric.metric_code][1] }));
  }

  function metric(id) { return metrics().find((item) => item.id === id); }
  function unitLabel(item = metric(state.metricA)) { return item?.unit === "share_budget" ? t.pctBudget : item?.unit === "pct_gdp" ? t.pctGdp : t.percent; }
  function formatValue(value, item = metric(state.metricA), signed = false) {
    if (!Number.isFinite(value)) return "—";
    const prefix = signed && value > 0 ? "+" : "";
    return `${prefix}${format(value, Math.abs(value) >= 100 ? 0 : 1)}${item?.unit === "pct_gdp" || item?.unit === "share_budget" || item?.unit === "percent" ? "%" : ""}`;
  }

  function budgetCountry(code) { return state.data.budget.countries.find((country) => country.code === code); }
  function fiscalCountry(code) { return state.data.fiscal.series.find((country) => country.country_code === code); }
  function valueFor(code, id) {
    if (state.lens === "budget") {
      const group = budgetCountry(code)?.groups.find((item) => item.category_id === id);
      if (!group || (!group.source_rows?.length && group.shares_pct.current === 0)) return null;
      return Number.isFinite(group.shares_pct.current) ? group.shares_pct.current : null;
    }
    if (state.lens === "functions") {
      const points = state.data.functions.countries[code]?.categories?.[id] || [];
      const point = points.find((item) => item.year === state.year);
      return Number.isFinite(point?.pct_gdp) ? point.pct_gdp : null;
    }
    const points = fiscalCountry(code)?.metrics?.[id]?.values || [];
    const point = points.find((item) => item.year === state.year);
    return Number.isFinite(point?.value) ? point.value : null;
  }

  function rows() {
    return state.data.registry.countries.map((country) => {
      const a = valueFor(country.iso3, state.metricA), b = valueFor(country.iso3, state.metricB);
      return { country, a, b, gap: Number.isFinite(a) && Number.isFinite(b) ? a - b : null };
    }).filter((row) => state.mode === "duel" ? Number.isFinite(row.gap) : Number.isFinite(row.a));
  }

  function yearRange() {
    if (state.lens === "budget") return [2024, 2024];
    if (state.lens === "functions") return [2015, 2024];
    return [2005, 2024];
  }

  function normalizeMetricState() {
    const available = metrics();
    if (!available.some((item) => item.id === state.metricA)) state.metricA = available[0]?.id;
    if (!available.some((item) => item.id === state.metricB) || state.metricB === state.metricA) state.metricB = available.find((item) => item.id !== state.metricA)?.id;
    const [min, max] = yearRange();
    state.year = Math.max(min, Math.min(max, state.year));
  }

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set("lens", state.lens);
    url.searchParams.set("mode", state.mode);
    url.searchParams.set("a", state.metricA);
    if (state.mode === "duel") url.searchParams.set("b", state.metricB); else url.searchParams.delete("b");
    if (state.lens !== "budget") url.searchParams.set("year", state.year); else url.searchParams.delete("year");
    if (state.selected) url.searchParams.set("country", state.selected); else url.searchParams.delete("country");
    history.replaceState(null, "", url);
  }

  function readUrl() {
    const query = new URLSearchParams(location.search);
    if (["budget", "functions", "fiscal"].includes(query.get("lens"))) state.lens = query.get("lens");
    if (["duel", "single"].includes(query.get("mode"))) state.mode = query.get("mode");
    if (query.get("a")) state.metricA = query.get("a");
    if (query.get("b")) state.metricB = query.get("b");
    if (Number.isFinite(Number(query.get("year")))) state.year = Number(query.get("year"));
    if (query.get("country")) state.selected = query.get("country").toUpperCase();
  }

  function metricOptions(selected, exclude) {
    return metrics().filter((item) => item.id !== exclude).map((item) => `<option value="${esc(item.id)}"${item.id === selected ? " selected" : ""}>${esc(metricLabel(item))}</option>`).join("");
  }

  function classifyMap(row, activeRows) {
    if (!row || (state.mode === "duel" ? !Number.isFinite(row.gap) : !Number.isFinite(row.a))) return "map-no-data";
    if (state.mode === "single") {
      const sorted = activeRows.map((item) => item.a).sort((a, b) => a - b);
      const thresholds = [.2, .4, .6, .8].map((q) => quantile(sorted, q));
      return `map-q${1 + thresholds.filter((threshold) => row.a > threshold).length}`;
    }
    const abs = activeRows.map((item) => Math.abs(item.gap)).sort((a, b) => a - b);
    const soft = Math.max(.05, quantile(abs, .35)), strong = Math.max(soft, quantile(abs, .76));
    if (row.gap > strong) return "map-a-strong";
    if (row.gap > soft) return "map-a";
    if (row.gap < -strong) return "map-b-strong";
    if (row.gap < -soft) return "map-b";
    return "map-even";
  }

  function legend(activeRows) {
    if (state.mode === "single") {
      const sorted = activeRows.map((item) => item.a).sort((a, b) => a - b);
      const cuts = [0, .2, .4, .6, .8, 1].map((q) => quantile(sorted, q));
      return [1, 2, 3, 4, 5].map((level, index) => `<li><i class="legend-q${level}"></i><span>${esc(formatValue(cuts[index]))}–${esc(formatValue(cuts[index + 1]))}</span><b>${activeRows.filter((row) => classifyMap(row, activeRows) === `map-q${level}`).length}</b></li>`).join("") + `<li><i class="legend-none"></i><span>${esc(t.noData)}</span><b>${195 - activeRows.length}</b></li>`;
    }
    const bands = [["map-a-strong", "legend-a-strong", t.muchStrongerA], ["map-a", "legend-a", t.strongerA], ["map-even", "legend-even", t.close], ["map-b", "legend-b", t.strongerB], ["map-b-strong", "legend-b-strong", t.muchStrongerB]];
    return bands.map(([className, swatch, label]) => `<li><i class="${swatch}"></i><span>${esc(label)}</span><b>${activeRows.filter((row) => classifyMap(row, activeRows) === className).length}</b></li>`).join("") + `<li><i class="legend-none"></i><span>${esc(t.noData)}</span><b>${195 - activeRows.length}</b></li>`;
  }

  function story(activeRows) {
    const aLabel = metricLabel(metric(state.metricA)), bLabel = metricLabel(metric(state.metricB));
    if (state.mode === "single") {
      const top = activeRows.slice().sort((a, b) => b.a - a.a)[0];
      return top ? t.singleStory(aLabel, countryName(top.country), formatValue(top.a)) : t.noData;
    }
    const aCount = activeRows.filter((row) => row.gap > 0).length, bCount = activeRows.filter((row) => row.gap < 0).length;
    return (state.lens === "budget" ? t.budgetStory : t.duelStory)(aLabel, bLabel, aCount, bCount, activeRows.length);
  }

  function tooltip(row) {
    if (!row || (state.mode === "duel" ? !Number.isFinite(row.gap) : !Number.isFinite(row.a))) return `<strong>${esc(countryName(row?.country))}</strong><span>${esc(t.noData)}</span>`;
    const a = metricLabel(metric(state.metricA));
    if (state.mode === "single") return `<strong>${esc(countryName(row.country))}</strong><span>${esc(a)} · ${esc(formatValue(row.a))}</span><small>${esc(unitLabel())}</small>`;
    return `<strong>${esc(countryName(row.country))}</strong><span>${esc(a)} ${esc(formatValue(row.a))} · ${esc(metricLabel(metric(state.metricB)))} ${esc(formatValue(row.b, metric(state.metricB)))}</span><small>${esc(t.difference)} ${esc(format(row.gap, 1))} ${esc(t.pp)}</small>`;
  }

  function profileHref(code) {
    if (window.PSDCountryRoutes?.href) return window.PSDCountryRoutes.href(code, lang);
    return `/country.html?code=${encodeURIComponent(code)}&lang=${lang}`;
  }

  function scopeFor(code) {
    if (state.lens === "budget") return budgetCountry(code)?.[`scope_${lang}`] || "—";
    if (state.lens === "functions") return state.data.functions.countries[code]?.scope === "general_government" ? (lang === "cs" ? "Sektor vládních institucí · funkční členění" : "General government · functional classification") : state.data.functions.countries[code]?.scope?.replaceAll("_", " ") || "—";
    return lang === "cs" ? "Sektor vládních institucí · IMF WEO" : "General government · IMF WEO";
  }

  function periodFor(code) {
    if (state.lens === "budget") return budgetCountry(code)?.periods?.current?.label || t.latestAvailable;
    return String(state.year);
  }

  function historySeries(code, id) {
    if (state.lens === "budget") {
      const country = budgetCountry(code), group = country?.groups.find((item) => item.category_id === id);
      return group ? [[country.periods.previous.label, group.shares_pct.previous], [country.periods.current.label, group.shares_pct.current]].filter(([, value]) => Number.isFinite(value)) : [];
    }
    if (state.lens === "functions") return (state.data.functions.countries[code]?.categories?.[id] || []).map((point) => [point.year, point.pct_gdp]);
    return (fiscalCountry(code)?.metrics?.[id]?.values || []).map((point) => [point.year, point.value]);
  }

  function miniHistory(code) {
    const a = historySeries(code, state.metricA), b = state.mode === "duel" ? historySeries(code, state.metricB) : [];
    const all = [...a, ...b];
    if (all.length < 2) return "";
    const labels = [...new Set(all.map(([label]) => String(label)))];
    const values = all.map(([, value]) => value).filter(Number.isFinite), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = (label) => 18 + labels.indexOf(String(label)) / Math.max(1, labels.length - 1) * 464;
    const y = (value) => 98 - (value - min) / span * 74;
    const path = (series) => series.map(([label, value], index) => `${index ? "L" : "M"}${x(label).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const dots = (series, color) => series.map(([label, value]) => `<circle cx="${x(label).toFixed(1)}" cy="${y(value).toFixed(1)}" r="3.5" fill="${color}"><title>${esc(label)} · ${esc(formatValue(value))}</title></circle>`).join("");
    return `<section class="map-mini-history"><header><span>${esc(t.history)}</span><b>${esc(labels[0])}–${esc(labels.at(-1))}</b></header><svg viewBox="0 0 500 120" role="img" aria-label="${esc(t.history)}"><line class="grid" x1="18" x2="482" y1="98" y2="98"></line><line class="grid" x1="18" x2="482" y1="24" y2="24"></line><path class="line-a" d="${path(a)}"></path>${b.length ? `<path class="line-b" d="${path(b)}"></path>` : ""}${dots(a, "#a8b63f")}${dots(b, "#c93237")}</svg></section>`;
  }

  function detail(activeRows) {
    const row = activeRows.find((item) => item.country.iso3 === state.selected) || state.data.registry.countries.find((country) => country.iso3 === state.selected) && { country: state.data.registry.countries.find((country) => country.iso3 === state.selected), a: null, b: null, gap: null };
    if (!row) return `<div class="map-detail-empty">${esc(t.noCountryData)}</div>`;
    const valid = Number.isFinite(row.a) && (state.mode === "single" || Number.isFinite(row.b));
    const valueCards = valid ? `<div class="map-value-pair"><article class="map-value-card"><span>${esc(metricLabel(metric(state.metricA)))}</span><strong>${esc(formatValue(row.a))}</strong><small>${esc(periodFor(row.country.iso3))} · ${esc(unitLabel(metric(state.metricA)))}</small></article>${state.mode === "duel" ? `<article class="map-value-card"><span>${esc(metricLabel(metric(state.metricB)))}</span><strong>${esc(formatValue(row.b, metric(state.metricB)))}</strong><small>${esc(periodFor(row.country.iso3))} · ${esc(unitLabel(metric(state.metricB)))}</small></article>` : ""}</div>` : `<p class="map-detail-note">${esc(t.noCountryData)}</p>`;
    return `<div class="map-detail-head"><div class="map-detail-flag"><img src="assets/flags/${esc(row.country.iso2)}.svg" alt=""><b>${esc(row.country.iso3)}</b></div><div><span>${esc(t.selectedCountry)}</span><h3>${esc(countryName(row.country))}</h3></div><a href="${esc(profileHref(row.country.iso3))}">${esc(t.openProfile)}</a></div>${valueCards}<p class="map-detail-note"><strong>${esc(t.scope)}:</strong> ${esc(scopeFor(row.country.iso3))}</p>${valid ? miniHistory(row.country.iso3) : ""}`;
  }

  function ranking(activeRows) {
    const sorted = activeRows.slice().sort((a, b) => state.mode === "duel" ? Math.abs(b.gap) - Math.abs(a.gap) : b.a - a.a).slice(0, 7);
    return sorted.map((row) => `<li><button type="button" data-rank-country="${esc(row.country.iso3)}" class="${state.selected === row.country.iso3 ? "is-selected" : ""}"><img src="assets/flags/${esc(row.country.iso2)}.svg" alt=""><strong>${esc(countryName(row.country))}</strong><b>${esc(state.mode === "duel" ? `${row.gap > 0 ? "+" : ""}${format(row.gap, 1)} ${t.pp}` : formatValue(row.a))}</b></button></li>`).join("");
  }

  function render() {
    normalizeMetricState();
    const activeRows = rows(), byCode = new Map(activeRows.map((row) => [row.country.iso3, row])), byIso2 = new Map(state.data.registry.countries.map((country) => [country.iso2, country]));
    const mapPaths = state.data.geometry.locations.map((location) => {
      const country = byIso2.get(location.id);
      if (!country) return `<path class="spending-country map-outside" d="${location.path}"><title>${esc(location.name)}</title></path>`;
      const row = byCode.get(country.iso3), className = classifyMap(row, activeRows);
      return `<path class="spending-country ${className}${state.selected === country.iso3 ? " is-selected" : ""}" d="${location.path}" tabindex="0" data-map-country="${esc(country.iso3)}" aria-label="${esc(countryName(country))}"><title>${esc(countryName(country))}</title></path>`;
    }).join("");
    const [minYear, maxYear] = yearRange();
    const contract = state.lens === "budget" ? t.budgetContract : state.lens === "functions" ? t.functionsContract : t.fiscalContract;
    const periodLabel = state.lens === "budget" ? t.fixedPeriod : state.year;
    root.innerHTML = `<div class="map-lens-bar"><span>${esc(t.lens)}</span><div class="map-lenses" role="group" aria-label="${esc(t.lens)}">${[["budget", t.budget], ["functions", t.functions], ["fiscal", t.fiscal]].map(([id, label]) => `<button type="button" data-map-lens="${id}" aria-pressed="${state.lens === id}">${esc(label)}</button>`).join("")}</div><div class="map-modes" role="group"><button type="button" data-map-mode="duel" aria-pressed="${state.mode === "duel"}">${esc(t.duel)}</button><button type="button" data-map-mode="single" aria-pressed="${state.mode === "single"}">${esc(t.single)}</button></div></div><div class="map-control-deck ${state.mode === "single" ? "is-single" : ""}"><label class="map-metric-control"><span>${esc(t.metricA)}</span><select id="map-metric-a">${metricOptions(state.metricA, state.mode === "duel" ? state.metricB : null)}</select></label><div class="map-vs">${esc(t.vs)}</div><label class="map-metric-control map-metric-b"><span>${esc(t.metricB)}</span><select id="map-metric-b">${metricOptions(state.metricB, state.metricA)}</select></label><label class="map-year-control ${state.lens === "budget" ? "is-fixed" : ""}"><span>${esc(state.lens === "budget" ? t.period : t.year)}</span><input id="map-year" type="range" min="${minYear}" max="${maxYear}" value="${state.year}" step="1" ${state.lens === "budget" ? "disabled" : ""}><output>${esc(periodLabel)}</output></label><label class="map-search-control"><span>${esc(t.country)}</span><input id="map-country-search" type="search" list="map-country-list" placeholder="${esc(t.countryPlaceholder)}"><datalist id="map-country-list">${state.data.registry.countries.map((country) => `<option value="${esc(countryName(country))}">${esc(country.iso3)}</option>`).join("")}</datalist></label></div><div class="map-contract"><strong>${esc(state.lens === "budget" ? t.budget : state.lens === "functions" ? t.functions : t.fiscal)}</strong><span>${esc(contract)}</span><a href="methodology.html?lang=${lang}#sources">${esc(t.source)} →</a></div><div class="map-stage"><div class="map-canvas"><svg viewBox="${state.data.geometry.viewBox}" role="img" aria-label="${esc(t.mapLabel)}">${mapPaths}</svg></div><aside class="map-side"><header><span>${esc(t.legend)}</span><strong>${esc(state.mode === "duel" ? `${metricLabel(metric(state.metricA))} / ${metricLabel(metric(state.metricB))}` : metricLabel(metric(state.metricA)))}</strong></header><ol class="map-legend">${legend(activeRows)}</ol><div class="map-story"><span>${esc(t.story)}</span><p>${esc(story(activeRows))}</p></div></aside><div class="map-tooltip" role="tooltip" aria-hidden="true"></div></div><div class="map-lower"><section class="map-detail" aria-live="polite">${detail(activeRows)}</section><aside class="map-ranking"><header><span>${esc(t.ranking)}</span><strong>${esc(activeRows.length)} ${esc(t.countries)} · ${esc(periodLabel)}</strong></header><ol class="map-rank-list">${ranking(activeRows)}</ol></aside></div>`;
    bind(activeRows, byCode);
    updateUrl();
  }

  function bind(activeRows, byCode) {
    root.querySelectorAll("[data-map-lens]").forEach((button) => button.addEventListener("click", () => {
      state.lens = button.dataset.mapLens;
      state.year = 2024;
      if (state.lens === "budget") { state.metricA = "defence"; state.metricB = "education_research"; }
      if (state.lens === "functions") { state.metricA = "social"; state.metricB = "health"; }
      if (state.lens === "fiscal") { state.metricA = "expenditure_pct_gdp"; state.metricB = "revenue_pct_gdp"; }
      render();
    }));
    root.querySelectorAll("[data-map-mode]").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.mapMode; render(); }));
    root.querySelector("#map-metric-a")?.addEventListener("change", (event) => { state.metricA = event.target.value; render(); });
    root.querySelector("#map-metric-b")?.addEventListener("change", (event) => { state.metricB = event.target.value; render(); });
    root.querySelector("#map-year")?.addEventListener("input", (event) => { state.year = Number(event.target.value); render(); });
    const search = root.querySelector("#map-country-search");
    const useSearch = () => {
      const query = fold(search.value);
      const country = state.data.registry.countries.find((item) => [countryName(item), item.iso3, item.iso2].some((value) => fold(value) === query)) || state.data.registry.countries.find((item) => fold(countryName(item)).includes(query));
      if (country) { state.selected = country.iso3; render(); root.querySelector(".map-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    };
    search?.addEventListener("change", useSearch);
    search?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); useSearch(); } });
    root.querySelectorAll("[data-rank-country]").forEach((button) => button.addEventListener("click", () => { state.selected = button.dataset.rankCountry; render(); }));
    const stage = root.querySelector(".map-stage"), tip = root.querySelector(".map-tooltip");
    const show = (path, event) => {
      const country = state.data.registry.countries.find((item) => item.iso3 === path.dataset.mapCountry), row = byCode.get(path.dataset.mapCountry) || { country };
      tip.innerHTML = tooltip(row); tip.setAttribute("aria-hidden", "false");
      const panel = stage.getBoundingClientRect(), mark = path.getBoundingClientRect(), x = event?.clientX ?? mark.left + mark.width / 2, y = event?.clientY ?? mark.top;
      tip.style.left = `${Math.max(155, Math.min(panel.width - 155, x - panel.left))}px`;
      tip.style.top = `${Math.max(12, y - panel.top)}px`;
      tip.style.transform = y - panel.top > 140 ? "translate(-50%, calc(-100% - 12px))" : "translate(-50%, 12px)";
    };
    root.querySelectorAll("[data-map-country]").forEach((path) => {
      const select = () => { state.selected = path.dataset.mapCountry; render(); };
      path.addEventListener("pointerenter", (event) => show(path, event)); path.addEventListener("pointermove", (event) => show(path, event)); path.addEventListener("pointerleave", () => tip.setAttribute("aria-hidden", "true")); path.addEventListener("focus", () => show(path)); path.addEventListener("blur", () => tip.setAttribute("aria-hidden", "true")); path.addEventListener("click", select); path.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(); } });
    });
  }

  function applyStaticCopy() {
    document.querySelectorAll("[data-map-copy]").forEach((node) => {
      const value = t[node.dataset.mapCopy];
      if (typeof value === "string") node.textContent = value;
    });
  }

  applyStaticCopy();
  addEventListener("psdlanguagechange", () => {
    const next = getLang();
    if (next === lang) return;
    lang = next; t = copy[lang]; applyStaticCopy(); if (state.data) render();
  });

  Promise.all([
    fetch("data/world-map.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
    fetch("data/global-budget-transparency.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
    fetch("data/country-spending-comparison.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
    fetch("data/country-functional-budgets.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
    fetch("data/sovereign-benchmark-slim.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); })
  ]).then(([geometry, registry, budget, functions, fiscal]) => {
    state.data = { geometry, registry, budget, functions, fiscal };
    readUrl(); normalizeMetricState(); render();
  }).catch((error) => {
    console.error(error);
    root.innerHTML = `<p class="map-error">${esc(t.mapError)}</p>`;
  });
})();
