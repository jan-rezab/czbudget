// Contract-driven comparison.
//
// The old compare table could sort blindly because every metric on it shared one
// perimeter, one source and one unit. Health breaks all three. Each metric now
// declares its own comparability in data/compare-metrics.v1.json, and that field —
// not this file's judgement — decides whether the result ranks, groups, or refuses.
(() => {
  const resultRoot = document.querySelector("#compare-result");
  if (!resultRoot) return;

  const perimeterRoot = document.querySelector("#compare-perimeters");
  const metricRoot = document.querySelector("#compare-metrics");
  const noteRoot = document.querySelector("#compare-perimeter-note");
  const contractRoot = document.querySelector("#compare-contract");

  const copy = {
    cs: {
      perimeter: "Rozsah",
      metric: "Ukazatel",
      comparability: "Srovnatelnost",
      unit: "Jednotka",
      source: "Zdroj",
      rendersAs: "Vykreslení",
      boundary: "Hranice",
      full: "úplná",
      conditional: "podmíněná",
      national_only: "jen národní",
      asRanked: "žebříček",
      asGroups: "skupiny, bez pořadí",
      asRefusal: "odmítnutí + náhrada",
      notRankable: "Skupiny nelze řadit mezi sebou.",
      cannotRank: "Tyto země na tomto ukazateli řadit nelze",
      swap: (label) => `Porovnat místo toho ${label}`,
      swapWhy: "Stejná otázka, rozsah, který platí ve všech zemích.",
      missing: "zdroj neuvádí",
      unclassified: "Nezařazeno",
      unclassifiedNote: "Způsob financování zatím není v registru",
      coverageResolved: "Registr plně určen",
      coverageResolvedNote: "Právní forma určuje vlastníka u každého zařízení",
      coveragePartial: "Registr určen částečně",
      coveragePartialNote: "U části zařízení právní forma vlastníka neprozradí",
      coverageNone: "Registr zatím nenačten",
      coverageNoneNote: "Zdroj je znám, jmenovité záznamy nejsou načteny",
      countries: (n) => `${n} zemí s údajem`,
      topCountries: (shown, total) => `Top ${shown} z ${total} zemí s údajem`,
      selectedCount: (n) => `${n} ${n === 1 ? "vybraná země" : n < 5 ? "vybrané země" : "vybraných zemí"}`,
      selectedEmpty: "Přidejte země, které chcete porovnat.",
      showTop20: "Ukázat Top 20",
      showSelected: "Ukázat moje země",
      removeCountry: (name) => `Odebrat ${name}`,
      sourcePath: "Jak vzniká tento pohled",
      originalSource: "Původní publikace",
      transform: "Harmonizace",
      publishedData: "Publikovaná data",
      openSource: "Otevřít zdroj ↗",
      openData: "Otevřít JSON ↗",
      transformCopy: "Zdrojové řady mapujeme na jednotnou definici ukazatele, rozsah a jednotku. Chybějící hodnoty nedopočítáváme.",
      fixedYear: (y) => `pevný rok ${y}`,
      profile: "Detail",
      breakYear: (y) => `zlom ${y}`,
      loading: "Načítám…",
      failed: "Data srovnání se nepodařilo načíst.",
    },
    en: {
      perimeter: "Perimeter",
      metric: "Metric",
      comparability: "Comparability",
      unit: "Unit",
      source: "Source",
      rendersAs: "Renders as",
      boundary: "Boundary",
      full: "full",
      conditional: "conditional",
      national_only: "national only",
      asRanked: "ranked table",
      asGroups: "groups, no global rank",
      asRefusal: "refusal + substitute",
      notRankable: "Groups are not rankable against each other.",
      cannotRank: "These countries cannot be ranked on this metric",
      swap: (label) => `Compare ${label} instead`,
      swapWhy: "Same question, a perimeter that holds across every country.",
      missing: "not reported in source",
      unclassified: "Unclassified",
      unclassifiedNote: "Financing vehicle not yet in the registry",
      coverageResolved: "Register fully resolved",
      coverageResolvedNote: "Legal form names the owner of every facility",
      coveragePartial: "Register partly resolved",
      coveragePartialNote: "Legal form does not name the owner for some facilities",
      coverageNone: "No register loaded",
      coverageNoneNote: "The source is known; named records are not loaded",
      countries: (n) => `${n} countries with a value`,
      topCountries: (shown, total) => `Top ${shown} of ${total} countries with a value`,
      selectedCount: (n) => `${n} selected ${n === 1 ? "country" : "countries"}`,
      selectedEmpty: "Add the countries you want to compare.",
      showTop20: "Show Top 20",
      showSelected: "Show my countries",
      removeCountry: (name) => `Remove ${name}`,
      sourcePath: "How this view is sourced",
      originalSource: "Original publication",
      transform: "Harmonisation",
      publishedData: "Published data",
      openSource: "Open source ↗",
      openData: "Open JSON ↗",
      transformCopy: "We map source series to one metric definition, perimeter and unit. Missing values are never imputed.",
      fixedYear: (y) => `fixed year ${y}`,
      profile: "Profile",
      breakYear: (y) => `break ${y}`,
      loading: "Loading…",
      failed: "The comparison data could not be loaded.",
    },
  };

  const units = {
    pct_gdp: { cs: "% HDP", en: "% of GDP" },
    pct_share: { cs: "% výdajů", en: "% of spending" },
    pct: { cs: "%", en: "%" },
    intl_dollar: { cs: "mez. dolary", en: "int'l dollars" },
  };

  const state = {
    lang: (window.PSDLanguage && window.PSDLanguage.current()) ||
      (document.documentElement.lang === "en" ? "en" : "cs"),
    perimeter: "general_government",
    metric: "expenditure_pct_gdp",
    year: 2024,
    view: "selected",
    selectedCountries: ["CZE", "DEU", "POL", "UKR"],
    scatterX: "social_spending",
    scatterY: "poverty_rate",
    ready: false,
  };

  let registry = null;
  let assignments = null;
  let countriesByCode = new Map();
  let seriesByCode = new Map();
  let sha = {};
  let cofog = {};
  let ownership = {};
  let networks = {};
  let oecd = {};
  let sovereignMeta = {};
  let healthMeta = {};
  let functionalMeta = {};

  const t = () => copy[state.lang];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = (obj, base) => obj[`${base}_${state.lang}`] || obj[`${base}_en`] || "";
  const locale = () => (state.lang === "en" ? "en-GB" : "cs-CZ");

  const flag = (code) => {
    const c = countriesByCode.get(code);
    const iso = c && c.iso2 ? c.iso2.toLowerCase() : "";
    return `<span class="country-flag-svg"><img src="assets/flags/${esc(iso)}.svg" alt="" loading="lazy"><b>${esc(code)}</b></span>`;
  };

  const countryName = (code) => {
    const c = countriesByCode.get(code);
    if (!c) return code;
    return state.lang === "en" ? c.name_en : c.name_cs;
  };

  const profileHref = (code) =>
    window.PSDCountryRoutes ? window.PSDCountryRoutes.href(code, state.lang) : `country.html?code=${code}`;

  const metricsFor = (perimeter) =>
    registry.metrics.filter((m) => m.perimeter === perimeter);

  const currentMetric = () =>
    registry.metrics.find((m) => m.metric_code === state.metric) || registry.metrics[0];

  function format(value, metric) {
    if (!Number.isFinite(value)) return "—";
    if (metric.dataset === "oecd") {
      const nativeUnit = metric[`unit_${state.lang}`] || "";
      const digits = nativeUnit === "0–1" ? 3 : (Math.abs(value) >= 100 ? 0 : 1);
      return `${value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })}${nativeUnit === "%" ? " %" : nativeUnit ? ` ${nativeUnit}` : ""}`;
    }
    if (metric.unit === "intl_dollar") {
      return value.toLocaleString(locale(), { maximumFractionDigits: 0 });
    }
    const sign = metric.signed && value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString(locale(), {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })} %`;
  }

  // A zero in the health-accounts slice means the country was not surveyed, not that
  // it spends nothing. Treating it as a value would rank Brazil bottom on every
  // health metric instead of showing it as absent.
  const shaValue = (raw) => (Number.isFinite(raw) && raw > 0 ? raw : null);

  // "Public" is every owner class that resolves to a public body, at any tier. Unknown is
  // never folded in: the whole point of the register normalisation is that a legal form
  // which does not name an owner stays unresolved rather than being guessed either way.
  const PUBLIC_CLASSES = ["state", "regional", "municipal", "subnational_unspecified", "public_autonomous"];

  function valueFor(code, metric) {
    if (metric.dataset === "sovereign") {
      const s = seriesByCode.get(code);
      const m = s && s.metrics && s.metrics[metric.metric_code];
      if (!m || !Array.isArray(m.values)) return null;
      const hit = m.values.find((v) => v.year === state.year);
      return hit && Number.isFinite(hit.value) ? hit.value : null;
    }
    if (metric.dataset === "cofog") {
      const entry = cofog[code];
      const rows = entry && entry.categories && entry.categories.health;
      if (!rows || !rows.length) return null;
      const eligible = rows.filter((r) => r.year <= state.year);
      const row = eligible.length ? eligible[eligible.length - 1] : null;
      return row && Number.isFinite(row.pct_gdp) ? row.pct_gdp : null;
    }
    if (metric.dataset === "ownership") {
      const entry = ownership[code];
      if (!entry || !entry.owner_class_pct) return null;
      if (metric.metric_code === "hospital_unresolved_share") return entry.owner_class_pct.unknown ?? 0;
      return PUBLIC_CLASSES.reduce((total, key) => total + (entry.owner_class_pct[key] ?? 0), 0);
    }
    if (metric.dataset === "sha") {
      const h = sha[code];
      if (!h) return null;
      if (metric.metric_code === "health_che_pct_gdp") return shaValue(h.health_gdp_pct);
      const fin = h.financing || {};
      if (metric.metric_code === "health_oop_share") return shaValue(fin.out_of_pocket);
      if (metric.metric_code === "health_public_share") return shaValue(fin.public_compulsory);
    }
    if (metric.dataset === "oecd") {
      const observation = oecd.countries && oecd.countries[code] && oecd.countries[code].comparison && oecd.countries[code].comparison[metric.metric_code];
      return observation && Number.isFinite(observation.value) ? observation.value : null;
    }
    return null;
  }

  const sovereignValue = (code, metricCode, year = 2024) => {
    const s = seriesByCode.get(code);
    const metric = s && s.metrics && s.metrics[metricCode];
    const hit = metric && Array.isArray(metric.values)
      ? metric.values.find((entry) => entry.year === year) : null;
    return hit && Number.isFinite(hit.value) ? hit.value : null;
  };

  const populationMillions = (code) => {
    const gdp = sovereignValue(code, "nominal_gdp_usd_bn");
    const perCapita = sovereignValue(code, "gdp_per_capita_usd");
    return Number.isFinite(gdp) && Number.isFinite(perCapita) && perCapita > 0
      ? gdp * 1000 / perCapita : null;
  };

  function inPopulation(code) {
    if (state.view === "all") return true;
    const population = populationMillions(code);
    if (!Number.isFinite(population)) return false;
    return state.view === "large" ? population >= 5 : population < 5;
  }

  // The metric's dataset sets the country universe. A health metric covering sixteen
  // countries must not render a hundred and seventy-five empty rows.
  function datasetUniverse(metric) {
    let codes;
    if (metric.dataset === "ownership") codes = Object.keys(networks);
    else if (metric.dataset === "sha") codes = Object.keys(sha);
    else if (metric.dataset === "cofog") codes = Object.keys(cofog);
    else if (metric.dataset === "oecd") codes = Object.keys(oecd.countries || {});
    else codes = Array.from(countriesByCode.keys());
    return codes.filter((code) => countriesByCode.has(code));
  }

  const universe = (metric) => {
    const available = datasetUniverse(metric);
    if (state.view === "selected") {
      return state.selectedCountries.filter((code) => available.includes(code));
    }
    return available.filter(inPopulation);
  };

  function chipFor(code, metric) {
    if (metric.dataset === "oecd") {
      const observation = oecd.countries?.[code]?.comparison?.[metric.metric_code];
      return observation?.year ? `<span class="cmp-chip">${esc(observation.year)}</span>` : "";
    }
    const a = assignments.countries[code];
    if (!a) return "";
    if (Array.isArray(a.breaks) && a.breaks.includes(state.year)) {
      return `<span class="cmp-chip is-break">${esc(t().breakYear(state.year))}</span>`;
    }
    const label = pick(a, "chip");
    return label ? `<span class="cmp-chip">${esc(label)}</span>` : "";
  }

  function rowHTML(code, metric, max, rank) {
    const value = valueFor(code, metric);
    const width = Number.isFinite(value) && max > 0
      ? Math.max(Math.abs(value) / max * 100, 0.6) : 0;
    const bar = Number.isFinite(value)
      ? `<span class="cmp-track"><span class="cmp-fill${metric.alt_colour ? " is-alt" : ""}" style="width:${width.toFixed(1)}%"></span></span>`
      : `<span class="cmp-absent">${esc(t().missing)}</span>`;
    return `<li class="cmp-row">
      <span class="cmp-rank">${rank ? String(rank).padStart(2, "0") : ""}</span>
      <span class="cmp-name">${flag(code)}<a href="${profileHref(code)}">${esc(countryName(code))}</a>${chipFor(code, metric)}</span>
      ${bar}
      <span class="cmp-value">${esc(format(value, metric))}</span>
    </li>`;
  }

  function sortCodes(codes, metric) {
    return codes.slice().sort((a, b) => {
      const x = valueFor(a, metric);
      const y = valueFor(b, metric);
      // A missing value is never a zero: it sorts last rather than mid-table.
      return (Number.isFinite(y) - Number.isFinite(x)) || (y - x);
    });
  }

  function renderPerimeters() {
    if (!perimeterRoot) return;
    perimeterRoot.innerHTML = registry.perimeters.map((p) =>
      `<button type="button" class="cmp-pill" data-perimeter="${esc(p.id)}" aria-pressed="${p.id === state.perimeter}">${esc(pick(p, "label"))}</button>`
    ).join("");
    const active = registry.perimeters.find((p) => p.id === state.perimeter);
    if (noteRoot && active) noteRoot.textContent = pick(active, "note");
  }

  function renderMetrics() {
    if (!metricRoot) return;
    metricRoot.innerHTML = metricsFor(state.perimeter).map((m) =>
      `<button type="button" class="cmp-pill" data-metric="${esc(m.metric_code)}" aria-pressed="${m.metric_code === state.metric}">${esc(pick(m, "label"))}</button>`
    ).join("");
  }

  function renderCountryPicker() {
    const input = document.querySelector("#comparison-country");
    const options = document.querySelector("#comparison-country-options");
    const view = document.querySelector("#comparison-view");
    if (view) view.value = state.view;
    if (!input || !options) return;
    const codes = datasetUniverse(currentMetric()).slice().sort((a, b) =>
      countryName(a).localeCompare(countryName(b), locale()));
    options.innerHTML = codes.map((code) =>
      `<option value="${esc(countryName(code))}">${esc(code)}</option>`).join("");
    input.value = "";
    input.placeholder = state.lang === "en" ? "Add a country…" : "Přidat zemi…";
  }

  function renderSelection() {
    const root = document.querySelector("#comparison-selection");
    if (!root) return;
    const selected = state.selectedCountries.filter((code) => countriesByCode.has(code));
    root.innerHTML = `<div><span>${esc(t().selectedCount(selected.length))}</span>${selected.map((code) =>
      `<button type="button" class="cmp-country-chip" data-remove-country="${esc(code)}" aria-label="${esc(t().removeCountry(countryName(code)))}">${flag(code)}<b>${esc(countryName(code))}</b><i aria-hidden="true">×</i></button>`
    ).join("")}</div>${state.view === "selected" && !selected.length ? `<p>${esc(t().selectedEmpty)}</p>` : ""}<button type="button" class="cmp-top20-btn" ${state.view === "selected" ? "data-show-top20" : "data-show-selected"}>${esc(state.view === "selected" ? t().showTop20 : t().showSelected)}</button>`;
  }

  function sourceFor(metric) {
    if (metric.dataset === "sovereign") {
      const source = sovereignMeta.source || {};
      return { title: `${source.provider || "IMF"} · ${source.dataset || metric.source_label}`, url: source.download_page || source.url, data: "lib/data/sovereign-benchmark.v1.json" };
    }
    if (metric.dataset === "cofog") {
      const source = (functionalMeta.sources || [])[0] || {};
      return { title: source.title || metric.source_label, url: source.url, data: "data/country-functional-budgets.v1.json" };
    }
    if (metric.dataset === "sha") {
      const source = (healthMeta.sources || [])[0] || {};
      return { title: source.title || metric.source_label, url: source.url, data: "data/country-health.v1.json" };
    }
    if (metric.dataset === "ownership") {
      return { title: metric.source_label, url: `methodology.html?lang=${state.lang}#sources`, data: "data/hospital-ownership.v1.json" };
    }
    if (metric.dataset === "oecd") {
      const source = oecd.sources?.[metric.source_id] || {};
      return { title: source.title || metric.source_label, url: source.url, data: "data/oecd-key-metrics.v1.json" };
    }
    return { title: metric.source_label, url: `methodology.html?lang=${state.lang}#sources`, data: "data/compare-metrics.v1.json" };
  }

  function renderProvenance() {
    const root = document.querySelector("#compare-provenance");
    if (!root) return;
    const metric = currentMetric();
    const source = sourceFor(metric);
    root.innerHTML = `<header><span>${esc(t().sourcePath)}</span><strong>${esc(pick(metric, "label"))}</strong></header><ol>
      <li><span>01</span><div><b>${esc(t().originalSource)}</b><strong>${esc(source.title)}</strong>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(t().openSource)}</a>` : ""}</div></li>
      <li><span>02</span><div><b>${esc(t().transform)}</b><strong>${esc(pick(metric, "boundary"))}</strong><small>${esc(t().transformCopy)}</small></div></li>
      <li><span>03</span><div><b>${esc(t().publishedData)}</b><strong>${esc(metric.metric_code)}</strong><a href="${esc(source.data)}" target="_blank" rel="noreferrer">${esc(t().openData)}</a></div></li>
    </ol>`;
  }

  function renderOecdScatter() {
    const root = document.querySelector("#oecd-scatter");
    if (!root || !oecd.metrics || !oecd.countries) return;
    const available = ["tax_to_gdp", "labour_tax_wedge_single", "labour_tax_wedge_family", "corporate_statutory_rate", "corporate_eatr", "net_carbon_rate", "disposable_gini", "market_gini", "poverty_rate", "social_spending", "pension_replacement_aw100", "government_employment", "procurement_gdp", "housing_affordability", "life_satisfaction", "pisa_math", "road_deaths"].filter((key) => oecd.metrics[key]);
    const points = Object.keys(oecd.countries).map((code) => ({
      code,
      x: oecd.countries[code].comparison?.[state.scatterX],
      y: oecd.countries[code].comparison?.[state.scatterY],
    })).filter((point) => Number.isFinite(point.x?.value) && Number.isFinite(point.y?.value));
    const metricLabel = (key) => oecd.metrics[key]?.[`label_${state.lang}`] || key;
    const options = (selected) => available.map((key) => `<option value="${esc(key)}"${key === selected ? " selected" : ""}>${esc(metricLabel(key))}</option>`).join("");
    let chart = `<p class="oecd-chart-empty">${esc(t().missing)}</p>`;
    if (points.length >= 3) {
      const W = 900, H = 460, L = 76, R = 56, T = 38, B = 68;
      const xv = points.map((point) => point.x.value), yv = points.map((point) => point.y.value);
      const extent = (values) => { const min = Math.min(...values), max = Math.max(...values), pad = (max - min || 1) * .08; return [min - pad, max + pad]; };
      const [xmin, xmax] = extent(xv), [ymin, ymax] = extent(yv);
      const x = (value) => L + (value - xmin) / (xmax - xmin) * (W - L - R);
      const y = (value) => T + (ymax - value) / (ymax - ymin) * (H - T - B);
      const digits = (key) => key.includes("gini") ? 2 : 1;
      const grid = [0, .25, .5, .75, 1].map((q) => {
        const xx = L + q * (W - L - R), yy = T + q * (H - T - B);
        return `<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${H - B}"/><line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="axis" x="${xx}" y="${H - B + 21}" text-anchor="middle">${(xmin + q * (xmax - xmin)).toFixed(digits(state.scatterX))}</text><text class="axis" x="${L - 11}" y="${yy + 3}" text-anchor="end">${(ymax - q * (ymax - ymin)).toFixed(digits(state.scatterY))}</text>`;
      }).join("");
      chart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metricLabel(state.scatterX))} × ${esc(metricLabel(state.scatterY))}">${grid}${points.map((point) => `<circle class="${state.selectedCountries.includes(point.code) ? "is-selected" : ""}" cx="${x(point.x.value)}" cy="${y(point.y.value)}" r="${state.selectedCountries.includes(point.code) ? 7 : 5}"><title>${esc(countryName(point.code))}: ${point.x.value.toFixed(digits(state.scatterX))} / ${point.y.value.toFixed(digits(state.scatterY))}; ${point.x.year} / ${point.y.year}</title></circle><text class="country" x="${x(point.x.value) + 8}" y="${y(point.y.value) - 8}">${esc(point.code)}</text>`).join("")}<text class="axis-title" x="${W / 2}" y="${H - 9}" text-anchor="middle">${esc(metricLabel(state.scatterX))}</text><text class="axis-title" transform="translate(17 ${H / 2}) rotate(-90)" text-anchor="middle">${esc(metricLabel(state.scatterY))}</text></svg>`;
    }
    root.innerHTML = `<div class="oecd-scatter-controls"><label>${state.lang === "en" ? "Horizontal axis" : "Vodorovná osa"}<select data-scatter-axis="x">${options(state.scatterX)}</select></label><label>${state.lang === "en" ? "Vertical axis" : "Svislá osa"}<select data-scatter-axis="y">${options(state.scatterY)}</select></label></div><div class="oecd-scatter-chart">${chart}</div><p class="oecd-chart-note">${state.lang === "en" ? "Each point keeps the two source years in its tooltip. Association is not causation; missing pairs are omitted, never estimated." : "Každý bod uchovává v nápovědě oba zdrojové roky. Souvislost není příčina; chybějící dvojice vynecháváme, nikdy je neodhadujeme."}</p>`;
    root.querySelectorAll("[data-scatter-axis]").forEach((select) => select.addEventListener("change", () => {
      if (select.dataset.scatterAxis === "x") state.scatterX = select.value;
      else state.scatterY = select.value;
      renderOecdScatter();
    }));
  }

  function renderContract() {
    if (!contractRoot) return;
    const m = currentMetric();
    const verdictClass = { full: "is-full", conditional: "is-conditional", national_only: "is-refused" }[m.comparability];
    const rendersAs = { full: t().asRanked, conditional: t().asGroups, national_only: t().asRefusal }[m.comparability];
    const unit = m.dataset === "oecd" ? m[`unit_${state.lang}`] : (units[m.unit] ? units[m.unit][state.lang] : m.unit);
    const source = m.fixed_year
      ? `${m.source_label} · ${t().fixedYear(m.fixed_year)}`
      : m.source_label;
    const field = (label, value, extra = "") =>
      `<div class="cmp-field${extra}"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
    contractRoot.innerHTML =
      field(t().comparability, `<b class="cmp-verdict ${verdictClass}">${esc(t()[m.comparability])}</b>`) +
      field(t().unit, esc(unit)) +
      field(t().source, esc(source)) +
      field(t().rendersAs, esc(rendersAs)) +
      field(t().boundary, esc(pick(m, "boundary")), " is-wide");
  }

  function renderRefusal(metric) {
    const sub = registry.metrics.find((x) => x.metric_code === metric.substitute);
    const label = sub ? pick(sub, "label") : "";
    const lowered = label ? label.charAt(0).toLocaleLowerCase(locale()) + label.slice(1) : "";
    resultRoot.innerHTML = `<div class="cmp-refusal">
      <h3>${esc(t().cannotRank)}</h3>
      <p>${esc(pick(metric, "refuse"))}</p>
      ${sub ? `<p class="cmp-swap">
        <button type="button" class="cmp-swap-btn" data-swap="${esc(sub.metric_code)}">${esc(t().swap(lowered))}</button>
        <span class="cmp-swap-why">${esc(t().swapWhy)}</span>
      </p>` : ""}
    </div>`;
  }

  function renderRanked(metric, codes) {
    const sorted = sortCodes(codes, metric);
    const values = codes.map((c) => valueFor(c, metric)).filter(Number.isFinite);
    const max = values.length ? Math.max.apply(null, values.map(Math.abs)) : 0;
    const visible = state.view !== "selected" && sorted.length > 20
      ? sorted.filter((code) => Number.isFinite(valueFor(code, metric))).slice(0, 20)
      : sorted;
    let rank = 0;
    resultRoot.innerHTML =
      `<p class="cmp-count">${esc(state.view !== "selected" && sorted.length > 20 ? t().topCountries(visible.length, values.length) : t().countries(values.length))}</p>` +
      `<ol class="cmp-rows">${visible.map((code) => {
        if (Number.isFinite(valueFor(code, metric))) rank += 1;
        return rowHTML(code, metric, max, Number.isFinite(valueFor(code, metric)) ? rank : 0);
      }).join("")}</ol>` +
      (pick(metric, "note") ? `<p class="cmp-note">${esc(pick(metric, "note"))}</p>` : "");
  }

  // Two groupings so far. Financing vehicle answers "is this the same kind of number";
  // register coverage answers "does the source even reveal what the metric claims". Both
  // exist to stop a ranked table forming across groups that are not comparable.
  function groupsFor(metric, codes) {
    const t_ = t();
    if (metric.group_by === "register_coverage") {
      const bucket = (code) => {
        const entry = ownership[code];
        if (!entry || !Number.isFinite(entry.resolved_share_pct)) return "none";
        return entry.resolved_share_pct >= 100 ? "resolved" : "partial";
      };
      return {
        order: ["resolved", "partial", "none"],
        titles: {
          resolved: { name: t_.coverageResolved, note: t_.coverageResolvedNote },
          partial: { name: t_.coveragePartial, note: t_.coveragePartialNote },
          none: { name: t_.coverageNone, note: t_.coverageNoneNote },
        },
        bucket,
      };
    }
    const vehicles = assignments.financing_vehicles;
    const titles = {};
    vehicles.forEach((vehicle) => { titles[vehicle.id] = { name: pick(vehicle, "label"), note: pick(vehicle, "note") }; });
    titles.unclassified = { name: t_.unclassified, note: t_.unclassifiedNote };
    return {
      order: vehicles.map((vehicle) => vehicle.id).concat(["unclassified"]),
      titles,
      bucket: (code) => (assignments.countries[code] || {}).financing_vehicle || "unclassified",
    };
  }

  function renderGrouped(metric, codes) {
    const { order, titles, bucket } = groupsFor(metric, codes);
    const buckets = new Map();
    codes.forEach((code) => {
      const key = bucket(code);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(code);
    });
    const values = codes.map((c) => valueFor(c, metric)).filter(Number.isFinite);
    const max = values.length ? Math.max.apply(null, values) : 0;

    const blocks = order.filter((k) => buckets.has(k)).map((key) => {
      const rows = sortCodes(buckets.get(key), metric)
        .map((code) => rowHTML(code, metric, max, 0)).join("");
      return `<section class="cmp-group">
        <header><h4>${esc(titles[key].name)}</h4><span>${esc(titles[key].note)}</span></header>
        <ol class="cmp-rows">${rows}</ol>
      </section>`;
    }).join("");

    resultRoot.innerHTML =
      `<p class="cmp-warning"><span aria-hidden="true">⚠</span><span><b>${esc(t().notRankable)}</b> ${esc(pick(metric, "warn"))}</span></p>` +
      blocks;
  }

  function render() {
    if (!state.ready) return;
    renderPerimeters();
    renderMetrics();
    renderCountryPicker();
    renderSelection();
    renderContract();
    renderProvenance();
    renderOecdScatter();
    const metric = currentMetric();
    if (metric.comparability === "national_only") { renderRefusal(metric); return; }
    const codes = universe(metric);
    if (metric.comparability === "conditional") renderGrouped(metric, codes);
    else renderRanked(metric, codes);
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const perimeter = event.target.closest("[data-perimeter]");
      if (perimeter) {
        state.perimeter = perimeter.dataset.perimeter;
        const first = metricsFor(state.perimeter)[0];
        if (first) state.metric = first.metric_code;
        render();
        return;
      }
      const metric = event.target.closest("[data-metric]");
      if (metric) { state.metric = metric.dataset.metric; render(); return; }
      const swap = event.target.closest("[data-swap]");
      if (swap) {
        const target = registry.metrics.find((m) => m.metric_code === swap.dataset.swap);
        if (target) { state.perimeter = target.perimeter; state.metric = target.metric_code; render(); }
        return;
      }
      const remove = event.target.closest("[data-remove-country]");
      if (remove) {
        state.selectedCountries = state.selectedCountries.filter((code) => code !== remove.dataset.removeCountry);
        state.view = "selected";
        render();
        return;
      }
      if (event.target.closest("[data-show-top20]")) {
        state.view = "large";
        render();
        return;
      }
      if (event.target.closest("[data-show-selected]")) {
        state.view = "selected";
        render();
      }
    });

    const year = document.querySelector("#year-select");
    if (year) year.addEventListener("change", (e) => { state.year = Number(e.target.value); render(); });
    const view = document.querySelector("#comparison-view");
    if (view) view.addEventListener("change", (event) => {
      state.view = event.target.value;
      render();
    });
    const countryInput = document.querySelector("#comparison-country");
    if (countryInput) {
      const applyCountry = () => {
        const query = countryInput.value.trim().toLocaleLowerCase(locale());
        const match = datasetUniverse(currentMetric()).find((code) =>
          countryName(code).toLocaleLowerCase(locale()) === query || code.toLowerCase() === query);
        if (match) {
          if (!state.selectedCountries.includes(match)) state.selectedCountries.push(match);
          state.view = "selected";
          render();
        }
      };
      countryInput.addEventListener("change", applyCountry);
      countryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); applyCountry(); }
      });
    }

    window.addEventListener("psdlanguagechange", (event) => {
      state.lang = (event.detail && event.detail.lang) || state.lang;
      render();
    });
  }

  resultRoot.innerHTML = `<p class="cmp-note">${esc(t().loading)}</p>`;

  Promise.all([
    fetch("data/compare-metrics.v1.json").then((r) => r.json()),
    fetch("data/health-system-assignments.v1.json").then((r) => r.json()),
    fetch("lib/data/sovereign-benchmark.v1.json").then((r) => r.json()),
    fetch("data/country-health.v1.json").then((r) => r.json()),
    fetch("data/country-functional-budgets.v1.json").then((r) => r.json()),
    fetch("data/hospital-ownership.v1.json").then((r) => r.json()),
    fetch("data/country-provider-networks.v1.json").then((r) => r.json()),
    fetch("data/oecd-key-metrics.v1.json").then((r) => r.json()),
  ]).then(([metricRegistry, systemAssignments, sovereign, health, functional, ownershipData, networkData, oecdData]) => {
    registry = metricRegistry;
    assignments = systemAssignments;
    sovereignMeta = sovereign;
    healthMeta = health;
    functionalMeta = functional;
    sovereign.countries.forEach((c) => countriesByCode.set(c.country_code, c));
    sovereign.series.forEach((s) => seriesByCode.set(s.country_code, s));
    sha = health.countries || {};
    cofog = functional.countries || {};
    ownership = ownershipData.countries || {};
    networks = networkData.countries || {};
    oecd = oecdData;
    const oecdPerimeters = [
      ["oecd_tax", "Daně a práce", "Tax and work", "Sazby a zatížení domácností, firem, místních daní a uhlíku. Každý ukazatel drží vlastní rok a přesnou definici OECD.", "Rates and burdens on households, companies, local taxes and carbon. Each indicator keeps its own year and exact OECD definition."],
      ["oecd_distribution", "Přerozdělení", "Redistribution", "Tržní příjem, disponibilní příjem a relativní chudoba v jednotné metodice OECD.", "Market income, disposable income and relative poverty under a common OECD method."],
      ["oecd_social", "Sociální stát", "Social state", "Veřejné sociální výdaje a modelové důchodové náhradové míry.", "Public social expenditure and modelled pension replacement rates."],
      ["oecd_government", "Kapacita státu", "State capacity", "Zaměstnanost ve vládním sektoru a veřejné zakázky; velikost není automaticky výkon.", "Government employment and procurement; size is not automatically performance."],
      ["oecd_wellbeing", "Výsledky OECD", "OECD outcomes", "Bydlení, životní spokojenost, dovednosti a bezpečnost jako výsledky mimo účetní hranici rozpočtu.", "Housing, life satisfaction, skills and safety as outcomes outside the budget perimeter."],
    ];
    oecdPerimeters.forEach(([id, label_cs, label_en, note_cs, note_en]) => registry.perimeters.push({ id, label_cs, label_en, note_cs, note_en }));
    const topicPerimeter = { tax: "oecd_tax", distribution: "oecd_distribution", social: "oecd_social", pensions: "oecd_social", government: "oecd_government", wellbeing: "oecd_wellbeing" };
    Object.entries(oecd.metrics || {}).forEach(([metric_code, contract]) => registry.metrics.push({
      metric_code, perimeter: topicPerimeter[contract.topic], dataset: "oecd", unit: "oecd_native", unit_cs: contract.unit_cs, unit_en: contract.unit_en,
      polarity: "neutral", signed: false, comparability: "full", source_id: Object.values(oecd.countries || {}).map((country) => country.comparison?.[metric_code]?.source_id).find(Boolean) || "oecd",
      source_label: "OECD", label_cs: contract.label_cs, label_en: contract.label_en, boundary_cs: contract.boundary_cs, boundary_en: contract.boundary_en,
    }));

    const yearSelect = document.querySelector("#year-select");
    if (yearSelect && yearSelect.value) state.year = Number(yearSelect.value);
    const coverage = document.querySelector("#comparison-coverage-count");
    if (coverage) {
      const years = sovereign.period && sovereign.period.year_count ? sovereign.period.year_count : 20;
      coverage.textContent = `${sovereign.countries.length} × ${years}`;
    }

    state.ready = true;
    bind();
    render();
  }).catch((error) => {
    console.error(error);
    resultRoot.innerHTML = `<p class="cmp-note">${esc(t().failed)}</p>`;
  });
})();
