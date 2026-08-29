(() => {
  const root = document.querySelector("#surface-coverage-atlas");
  if (!root) return;

  // language-bootstrap.js is the single language authority; read the language it
  // resolved instead of re-reading the URL, which is only rewritten later.
  const resolveLang = () => (window.PSDLanguage?.current() || document.documentElement.lang) === "en" ? "en" : "cs";
  let lang = resolveLang();
  const state = { mode: "all", selected: null, freshness: null, registry: null, geometry: null };
  const copy = {
    cs: {
      eyebrow: "Publikované na PSD · 15 sekcí",
      title: "Co je na webu publikované",
      lead: "Vyberte sekci a uvidíte země, pro které má Public Spending Data publikovaný profil nebo datovou vrstvu. Mapa měří obsah na tomto webu, nikoli vše, co může existovat u původních poskytovatelů.",
      choose: "Zobrazená sekce", all: "Všechny publikované sekce", countryData: "Data země", municipal: "Obce a města", deepDive: "Hloubkové profily",
      countries: "zemí s publikovaným obsahem", sections: "sekcí webu", records: "kombinací země × sekce", deep: "zemí s 10+ sekcemi",
      share: "z 195 států", currentCount: "zemí s aktuálním / živým obdobím", latest: "nejnovější období", publishedRecords: "publikovaných záznamů",
      depth12: "12–15 sekcí", depth10: "10–11 sekcí", depth2: "2–4 sekce", depth1: "1 sekce", none: "Bez publikované sekce",
      current: "Aktuální, živé nebo plánované", recent: "Statistická řada do 2024", older: "Řada do 2023 nebo starší", other: "Publikováno · projekce / bez roku", notPublished: "V této sekci nepublikováno",
      selectCountry: "Vyberte zemi na mapě", selectCopy: "Po výběru ukážeme přesně ty sekce, které jsou pro zemi na PSD publikované, jejich období a odkazy na profil.",
      publishedFor: "Publikované sekce", noPublished: "Pro tuto zemi není ve vybrané sekci publikovaný artefakt.", open: "Otevřít sekci", source: "Primární zdroj",
      mapLabel: "Mapa publikovaného pokrytí Public Spending Data", scopeNote: "Měřeno na obsahu tohoto webu, ne na dostupnosti u poskytovatelů.", searchCountry: "Najít zemi", searchPlaceholder: "Název nebo kód země",
      loadError: "Mapu publikovaného pokrytí se nepodařilo načíst."
    },
    en: {
      eyebrow: "Published on PSD · 15 sections",
      title: "What is published on this site",
      lead: "Choose a section to see the countries for which Public Spending Data publishes a profile or data layer. This map measures content on this site, not everything that may exist at original providers.",
      choose: "Section shown", all: "All published sections", countryData: "Country data", municipal: "Municipalities and cities", deepDive: "Deep dives",
      countries: "countries with published content", sections: "site sections", records: "country × section records", deep: "countries with 10+ sections",
      share: "of 195 states", currentCount: "countries with a current / live period", latest: "latest period", publishedRecords: "published records",
      depth12: "12–15 sections", depth10: "10–11 sections", depth2: "2–4 sections", depth1: "1 section", none: "No published section",
      current: "Current, live or planned", recent: "Statistical series through 2024", older: "Series through 2023 or older", other: "Published · projection / undated", notPublished: "Not published in this section",
      selectCountry: "Select a country on the map", selectCopy: "The detail will show exactly which sections PSD publishes for that country, their periods and links to the profile.",
      publishedFor: "Published sections", noPublished: "No artifact is published for this country in the selected section.", open: "Open section", source: "Primary source",
      mapLabel: "Map of published Public Spending Data coverage", scopeNote: "Measured on content published on this site, not on availability at providers.", searchCountry: "Find a country", searchPlaceholder: "Country name or code",
      loadError: "The published coverage map could not be loaded."
    }
  };
  let t = copy[lang];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const number = (value) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(Number(value) || 0);
  const moduleName = (item) => item?.[`label_${lang}`] || item?.id || "—";
  const countryName = (item) => item?.[`name_${lang}`] || item?.iso3 || "—";
  const familyName = (family) => ({ country: t.countryData, municipal: t.municipal, deep_dive: t.deepDive })[family] || family;
  const recordsFor = (iso3) => state.freshness.records.filter((record) => record.country_code === iso3 && (state.mode === "all" || record.module === state.mode));
  const allRecordsFor = (iso3) => state.freshness.records.filter((record) => record.country_code === iso3);
  const moduleById = () => new Map(state.freshness.modules.map((item) => [item.id, item]));
  const currentBands = new Set(["current", "planned", "live_register", "estimate_current", "mixed_current"]);
  const recentBands = new Set(["statistical_lag", "estimate_lag", "mixed_lag"]);

  function coverageBand(country) {
    const records = recordsFor(country.iso3);
    if (state.mode === "all") {
      const count = new Set(records.map((record) => record.module)).size;
      if (count >= 12) return "depth12";
      if (count >= 10) return "depth10";
      if (count >= 2) return "depth2";
      if (count === 1) return "depth1";
      return "none";
    }
    const record = records[0];
    if (!record) return "none";
    if (currentBands.has(record.freshness_band)) return "current";
    if (recentBands.has(record.freshness_band)) return "recent";
    if (record.freshness_band === "older") return "older";
    return "other";
  }

  function bandLabel(band) {
    return ({ depth12: t.depth12, depth10: t.depth10, depth2: t.depth2, depth1: t.depth1, none: state.mode === "all" ? t.none : t.notPublished, current: t.current, recent: t.recent, older: t.older, other: t.other })[band];
  }

  function modeOptions() {
    const groups = ["country", "municipal", "deep_dive"];
    return `<option value="all">${esc(t.all)}</option>${groups.map((family) => `<optgroup label="${esc(familyName(family))}">${state.freshness.modules.filter((item) => item.family === family).map((item) => `<option value="${esc(item.id)}">${esc(moduleName(item))}</option>`).join("")}</optgroup>`).join("")}`;
  }

  function legend(countries) {
    const bands = state.mode === "all" ? ["depth12", "depth10", "depth2", "depth1", "none"] : ["current", "recent", "older", "other", "none"];
    return bands.map((band) => `<li><i class="surface-swatch surface-${band}"></i><span>${esc(bandLabel(band))}</span><b>${countries.filter((country) => coverageBand(country) === band).length}</b></li>`).join("");
  }

  function kpis(countries) {
    const activeRecords = state.mode === "all" ? state.freshness.records : state.freshness.records.filter((record) => record.module === state.mode);
    const coveredCountries = new Set(activeRecords.map((record) => record.country_code)).size;
    if (state.mode === "all") {
      const deepCountries = countries.filter((country) => allRecordsFor(country.iso3).length >= 10).length;
      return [[coveredCountries, t.countries], [state.freshness.modules.length, t.sections], [activeRecords.length, t.records], [deepCountries, t.deep]];
    }
    const currentCountries = activeRecords.filter((record) => currentBands.has(record.freshness_band)).length;
    const years = activeRecords.map((record) => Number(record.latest_year)).filter(Number.isFinite);
    return [[coveredCountries, t.countries], [`${Math.round(coveredCountries / countries.length * 100)}%`, t.share], [currentCountries, t.currentCount], [years.length ? Math.max(...years) : "—", t.latest]];
  }

  function viewHref(record) {
    if (!record?.view_url) return null;
    const url = new URL(record.view_url, location.origin);
    url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function detail(country) {
    if (!country) return `<div class="surface-empty-detail"><span>${esc(t.publishedFor)}</span><h3>${esc(t.selectCountry)}</h3><p>${esc(t.selectCopy)}</p></div>`;
    const modules = moduleById();
    const records = recordsFor(country.iso3).sort((a, b) => (modules.get(a.module)?.order || 0) - (modules.get(b.module)?.order || 0));
    const heading = `${countryName(country)} · ${country.iso3}`;
    if (!records.length) return `<div class="surface-empty-detail"><span>${esc(t.publishedFor)}</span><h3>${esc(heading)}</h3><p>${esc(t.noPublished)}</p></div>`;
    return `<header><span>${esc(t.publishedFor)}</span><h3>${esc(heading)}</h3><strong>${records.length} / ${state.mode === "all" ? state.freshness.modules.length : 1}</strong></header><div class="surface-section-list">${records.map((record) => {
      const module = modules.get(record.module);
      const href = viewHref(record);
      const period = record.period_label || record.latest_year || "—";
      return `<article><div><small>${esc(familyName(module?.family))}</small><h4>${esc(moduleName(module))}</h4></div><p>${esc(record[`coverage_${lang}`] || record.coverage_en || record.coverage_cs)}</p><div><b>${esc(period)}</b>${href ? `<a href="${esc(href)}">${esc(t.open)} →</a>` : ""}${record.source_url ? `<a href="${esc(record.source_url)}" target="_blank" rel="noreferrer">${esc(t.source)} ↗</a>` : ""}</div></article>`;
    }).join("")}</div>`;
  }

  function tooltip(country) {
    const records = recordsFor(country.iso3);
    const modules = moduleById();
    if (state.mode === "all") {
      const names = records.slice(0, 5).map((record) => moduleName(modules.get(record.module)));
      return `<strong>${esc(countryName(country))}</strong><span>${records.length} / ${state.freshness.modules.length} ${esc(t.sections)}</span><small>${esc(names.join(" · "))}${records.length > names.length ? " …" : ""}</small>`;
    }
    const record = records[0];
    return `<strong>${esc(countryName(country))}</strong><span>${esc(record ? moduleName(modules.get(record.module)) : t.notPublished)}</span><small>${esc(record ? `${record.period_label || record.latest_year || "—"} · ${bandLabel(coverageBand(country))}` : t.noPublished)}</small>`;
  }

  function render() {
    const countries = state.registry.countries;
    const prioritisedCountries = countries.slice().sort((a, b) => allRecordsFor(b.iso3).length - allRecordsFor(a.iso3).length || countryName(a).localeCompare(countryName(b), lang));
    const byIso2 = new Map(countries.map((country) => [country.iso2, country]));
    const paths = state.geometry.locations.map((location) => {
      const country = byIso2.get(location.id);
      if (!country) return `<path class="surface-country surface-outside" d="${location.path}"><title>${esc(location.name)}</title></path>`;
      const band = coverageBand(country);
      const label = `${countryName(country)}: ${bandLabel(band)}`;
      return `<path class="surface-country surface-${band}${state.selected === country.iso3 ? " is-selected" : ""}" d="${location.path}" tabindex="0" data-surface-country="${esc(country.iso3)}" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
    }).join("");
    const selectedCountry = countries.find((country) => country.iso3 === state.selected);
    root.innerHTML = `<div class="surface-controls"><label for="surface-mode">${esc(t.choose)}</label><select id="surface-mode">${modeOptions()}</select><label for="surface-country-search">${esc(t.searchCountry)}</label><input id="surface-country-search" type="search" list="surface-country-options" placeholder="${esc(t.searchPlaceholder)}" value="${esc(selectedCountry ? countryName(selectedCountry) : "")}"><datalist id="surface-country-options">${prioritisedCountries.map(country=>`<option value="${esc(countryName(country))}" data-code="${esc(country.iso3)}">${esc(country.iso3)} · ${allRecordsFor(country.iso3).length} ${esc(t.sections)}</option>`).join("")}</datalist><p>${esc(t.scopeNote)}</p></div><div class="surface-kpis">${kpis(countries).map(([value, label]) => `<article><strong>${esc(typeof value === "number" ? number(value) : value)}</strong><span>${esc(label)}</span></article>`).join("")}</div><div class="surface-map-panel"><div class="surface-map-wrap"><svg class="surface-map" viewBox="${state.geometry.viewBox}" role="img" aria-label="${esc(t.mapLabel)}">${paths}</svg></div><ol class="surface-legend">${legend(countries)}</ol><div class="surface-tooltip" role="tooltip" aria-hidden="true"></div></div><section class="surface-detail" aria-live="polite">${detail(selectedCountry)}</section>`;
    const select = root.querySelector("#surface-mode");
    select.value = state.mode;
    select.addEventListener("change", () => { state.mode = select.value; state.selected = null; render(); });
    const countrySearch = root.querySelector("#surface-country-search");
    const activateSearch = () => {
      const query = String(countrySearch.value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      if (!query) return;
      const country = prioritisedCountries.find(item => [countryName(item), item.iso3, item.iso2].some(value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === query)) || prioritisedCountries.find(item => countryName(item).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
      if (country) { state.selected = country.iso3; render(); root.querySelector(".surface-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    };
    countrySearch.addEventListener("change", activateSearch);
    countrySearch.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); activateSearch(); } });
    const panel = root.querySelector(".surface-map-panel");
    const tooltipNode = root.querySelector(".surface-tooltip");
    const showTooltip = (path, event) => {
      const country = countries.find((item) => item.iso3 === path.dataset.surfaceCountry);
      if (!country) return;
      tooltipNode.innerHTML = tooltip(country);
      tooltipNode.setAttribute("aria-hidden", "false");
      const panelRect = panel.getBoundingClientRect();
      const markRect = path.getBoundingClientRect();
      const x = event?.clientX ?? markRect.left + markRect.width / 2;
      const y = event?.clientY ?? markRect.top;
      const halfWidth = Math.min(165, (panelRect.width - 24) / 2);
      const localY = Math.max(12, y - panelRect.top);
      tooltipNode.style.left = `${Math.max(halfWidth + 12, Math.min(panelRect.width - halfWidth - 12, x - panelRect.left))}px`;
      tooltipNode.style.top = `${localY}px`;
      tooltipNode.style.transform = localY > tooltipNode.offsetHeight + 24 ? "translate(-50%, calc(-100% - 14px))" : "translate(-50%, 14px)";
    };
    const hideTooltip = () => tooltipNode.setAttribute("aria-hidden", "true");
    root.querySelectorAll("[data-surface-country]").forEach((path) => {
      const activate = () => { state.selected = path.dataset.surfaceCountry; render(); root.querySelector(".surface-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
      path.addEventListener("pointerenter", (event) => showTooltip(path, event));
      path.addEventListener("pointermove", (event) => showTooltip(path, event));
      path.addEventListener("pointerleave", hideTooltip);
      path.addEventListener("focus", () => showTooltip(path));
      path.addEventListener("blur", hideTooltip);
      path.addEventListener("click", activate);
      path.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
    });
  }

  const applyStaticCopy = () => document.querySelectorAll("[data-surface-copy]").forEach((node) => { node.textContent = t[node.dataset.surfaceCopy]; });
  applyStaticCopy();
  // document.title belongs to the metadata map in language-bootstrap.js; writing
  // it here only started a fight with its MutationObserver.
  addEventListener("psdlanguagechange", () => {
    if (resolveLang() === lang) return;
    lang = resolveLang(); t = copy[lang];
    applyStaticCopy();
    if (state.registry) render();
  });
  const freshnessPromise = window.psdDataFreshnessPromise || (window.psdDataFreshnessPromise = fetch("data/data-freshness.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }));
  const transparencyPromise = window.psdTransparencyDataPromise || (window.psdTransparencyDataPromise = Promise.all([
    fetch("data/global-budget-transparency.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
    fetch("data/world-map.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); })
  ]));
  Promise.all([freshnessPromise, transparencyPromise]).then(([freshness, [registry, geometry]]) => {
    Object.assign(state, { freshness, registry, geometry });
    render();
  }).catch((error) => {
    console.error(error);
    root.innerHTML = `<p class="surface-error">${esc(t.loadError)}</p>`;
  });
})();
