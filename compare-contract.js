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
      countries: (n) => `${n} zemí s údajem`,
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
      countries: (n) => `${n} countries with a value`,
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

  const flagCodes = {
    CZE: "cz", DEU: "de", DNK: "dk", FIN: "fi", FRA: "fr", GBR: "gb", POL: "pl",
    SWE: "se", CHE: "ch", UKR: "ua", USA: "us", BRA: "br", ESP: "es", JPN: "jp",
    NLD: "nl", NOR: "no", GRC: "gr",
  };

  const state = {
    lang: (window.PSDLanguage && window.PSDLanguage.current()) ||
      (document.documentElement.lang === "en" ? "en" : "cs"),
    perimeter: "general_government",
    metric: "expenditure_pct_gdp",
    year: 2024,
    group: "all",
    ready: false,
  };

  let registry = null;
  let assignments = null;
  let countriesByCode = new Map();
  let seriesByCode = new Map();
  let sha = {};
  let cofog = {};

  const t = () => copy[state.lang];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pick = (obj, base) => obj[`${base}_${state.lang}`] || obj[`${base}_en`] || "";
  const locale = () => (state.lang === "en" ? "en-GB" : "cs-CZ");

  const flag = (code) => {
    const iso = flagCodes[code];
    const c = countriesByCode.get(code);
    const emoji = String((c && c.iso2) || "").toUpperCase()
      .replace(/[A-Z]/g, (l) => String.fromCodePoint(127397 + l.charCodeAt(0)));
    const inner = iso
      ? `<img src="assets/flags/${iso}.svg" alt="" loading="lazy">`
      : `<i class="country-flag-emoji" aria-hidden="true">${emoji}</i>`;
    return `<span class="country-flag-svg">${inner}<b>${esc(code)}</b></span>`;
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
    if (metric.dataset === "sha") {
      const h = sha[code];
      if (!h) return null;
      if (metric.metric_code === "health_che_pct_gdp") return shaValue(h.health_gdp_pct);
      const fin = h.financing || {};
      if (metric.metric_code === "health_oop_share") return shaValue(fin.out_of_pocket);
      if (metric.metric_code === "health_public_share") return shaValue(fin.public_compulsory);
    }
    return null;
  }

  function inGroup(country) {
    if (state.group === "all") return true;
    if (state.group === "requested") return country.role !== "responsible_benchmark";
    return country.role === "anchor" || country.role === "responsible_benchmark";
  }

  // The metric's dataset sets the country universe. A health metric covering sixteen
  // countries must not render a hundred and seventy-five empty rows.
  function universe(metric) {
    let codes;
    if (metric.dataset === "sha") codes = Object.keys(sha);
    else if (metric.dataset === "cofog") codes = Object.keys(cofog);
    else codes = Array.from(countriesByCode.keys());
    return codes.filter((code) => {
      const c = countriesByCode.get(code);
      return c && inGroup(c);
    });
  }

  function chipFor(code, metric) {
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

  function renderContract() {
    if (!contractRoot) return;
    const m = currentMetric();
    const verdictClass = { full: "is-full", conditional: "is-conditional", national_only: "is-refused" }[m.comparability];
    const rendersAs = { full: t().asRanked, conditional: t().asGroups, national_only: t().asRefusal }[m.comparability];
    const unit = units[m.unit] ? units[m.unit][state.lang] : m.unit;
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
    let rank = 0;
    resultRoot.innerHTML =
      `<p class="cmp-count">${esc(t().countries(values.length))}</p>` +
      `<ol class="cmp-rows">${sorted.map((code) => {
        if (Number.isFinite(valueFor(code, metric))) rank += 1;
        return rowHTML(code, metric, max, Number.isFinite(valueFor(code, metric)) ? rank : 0);
      }).join("")}</ol>` +
      (pick(metric, "note") ? `<p class="cmp-note">${esc(pick(metric, "note"))}</p>` : "");
  }

  function renderGrouped(metric, codes) {
    const vehicles = assignments.financing_vehicles;
    const buckets = new Map();
    codes.forEach((code) => {
      const a = assignments.countries[code];
      const key = (a && a.financing_vehicle) || "unclassified";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(code);
    });
    const values = codes.map((c) => valueFor(c, metric)).filter(Number.isFinite);
    const max = values.length ? Math.max.apply(null, values) : 0;
    const order = vehicles.map((v) => v.id).concat(["unclassified"]);

    const blocks = order.filter((k) => buckets.has(k)).map((key) => {
      const vehicle = vehicles.find((v) => v.id === key);
      const name = vehicle ? pick(vehicle, "label") : t().unclassified;
      const note = vehicle ? pick(vehicle, "note") : t().unclassifiedNote;
      const rows = sortCodes(buckets.get(key), metric)
        .map((code) => rowHTML(code, metric, max, 0)).join("");
      return `<section class="cmp-group">
        <header><h4>${esc(name)}</h4><span>${esc(note)}</span></header>
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
    renderContract();
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
      }
    });

    const year = document.querySelector("#year-select");
    if (year) year.addEventListener("change", (e) => { state.year = Number(e.target.value); render(); });
    const group = document.querySelector("#group-select");
    if (group) group.addEventListener("change", (e) => { state.group = e.target.value; render(); });

    window.addEventListener("psdlanguagechange", (event) => {
      state.lang = (event.detail && event.detail.lang) || state.lang;
      render();
    });
  }

  resultRoot.innerHTML = `<p class="cmp-note">${esc(t().loading)}</p>`;

  Promise.all([
    fetch("data/compare-metrics.v1.json").then((r) => r.json()),
    fetch("data/health-system-assignments.v1.json").then((r) => r.json()),
    fetch("data/sovereign-benchmark-slim.v1.json").then((r) => r.json()),
    fetch("data/country-health.v1.json").then((r) => r.json()),
    fetch("data/country-functional-budgets.v1.json").then((r) => r.json()),
  ]).then(([metricRegistry, systemAssignments, sovereign, health, functional]) => {
    registry = metricRegistry;
    assignments = systemAssignments;
    sovereign.countries.forEach((c) => countriesByCode.set(c.country_code, c));
    sovereign.series.forEach((s) => seriesByCode.set(s.country_code, s));
    sha = health.countries || {};
    cofog = functional.countries || {};

    const yearSelect = document.querySelector("#year-select");
    if (yearSelect && yearSelect.value) state.year = Number(yearSelect.value);
    const groupSelect = document.querySelector("#group-select");
    if (groupSelect && groupSelect.value) state.group = groupSelect.value;

    state.ready = true;
    bind();
    render();
  }).catch((error) => {
    console.error(error);
    resultRoot.innerHTML = `<p class="cmp-note">${esc(t().failed)}</p>`;
  });
})();
