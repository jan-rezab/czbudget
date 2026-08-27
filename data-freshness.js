(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") === "en" ? "en" : "cs";
  const state = { data: null, country: "", family: "", band: "", query: "", selected: null };
  const copy = {
    cs: {
      eyebrow: "Data · 191 zemí · 15 vrstev", title: "Jak čerstvá jsou data napříč celým webem?",
      countries: "zemí", layers: "datových vrstev", records: "kombinací země × vrstva", units: "obecních jednotek",
      country: "Země", allCountries: "Všechny země", family: "Rodina dat", allFamilies: "Všechny vrstvy",
      municipal: "Obce a města", countryData: "Data země", deepDive: "Hloubkové profily", freshness: "Datový horizont",
      allFreshness: "Všechny horizonty", search: "Hledat", searchPlaceholder: "země, vrstva, pokrytí…", reset: "Vymazat",
      matrix: "Srovnávací matice", detailTable: "Podrobný registr", latest: "Nejnovější období", type: "Typ",
      coverage: "Pokrytí", generated: "Artefakt sestaven", artifact: "Publikovaný artefakt", openView: "Otevřít profil",
      openSource: "Primární zdroj", download: "Stáhnout CSV", shown: "zobrazených záznamů", noRows: "Filtru neodpovídají žádná data.",
      selected: "Vybraná vrstva", firstYear: "Začátek řady", entities: "Jednotky / řady", actual: "skutečnost / statistika", estimate: "odhad zdroje", actual_estimate: "skutečnost + odhad",
      plan: "plán / schválený rozpočet", projection: "projekce", register: "živý registr", mixed: "skutečnost + plán",
      current: "2025+ skutečnost", statistical_lag: "2024 statistická řada", older: "2023 nebo starší",
      planned: "plán", live_register: "živý registr", estimate_current: "aktuální odhad", estimate_lag: "odhad za 2024", mixed_current: "aktuální mix", mixed_lag: "starší mix", undated: "bez roku",
      none: "bez vrstvy", method: "Rok v buňce je nejnovější fiskální, vykazované nebo pozorované období. Datum sestavení souboru je samostatné; plán, skutečnost a projekce nejsou zaměnitelné.",
    },
    en: {
      eyebrow: "Data · 191 countries · 15 layers", title: "How fresh is the data across the whole site?",
      countries: "countries", layers: "data layers", records: "country × layer records", units: "municipal units",
      country: "Country", allCountries: "All countries", family: "Data family", allFamilies: "All layers",
      municipal: "Municipalities and cities", countryData: "Country data", deepDive: "Deep dives", freshness: "Data horizon",
      allFreshness: "All horizons", search: "Search", searchPlaceholder: "country, layer, coverage…", reset: "Reset",
      matrix: "Comparison matrix", detailTable: "Detailed ledger", latest: "Latest period", type: "Type",
      coverage: "Coverage", generated: "Artifact built", artifact: "Published artifact", openView: "Open profile",
      openSource: "Primary source", download: "Download CSV", shown: "records shown", noRows: "No data matches these filters.",
      selected: "Selected layer", firstYear: "Series start", entities: "Entities / series", actual: "actual / statistical", estimate: "source estimate", actual_estimate: "actual + estimate",
      plan: "plan / adopted budget", projection: "projection", register: "live register", mixed: "actual + plan",
      current: "2025+ actual", statistical_lag: "2024 statistical series", older: "2023 or older",
      planned: "plan", live_register: "live register", estimate_current: "current estimate", estimate_lag: "2024 estimate", mixed_current: "current mix", mixed_lag: "older mix", undated: "undated",
      none: "no layer", method: "The year in each cell is the latest fiscal, reporting or observation period. The file-build date is separate; plans, actuals and projections are not interchangeable.",
    },
  };
  const t = (key) => copy[lang][key] || key;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const number = (value) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(Number(value) || 0);
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat(lang === "cs" ? "cs-CZ" : "en-GB", { dateStyle: "medium" }).format(parsed);
  };
  const country = (code) => state.data.countries.find((item) => item.code === code);
  const module = (id) => state.data.modules.find((item) => item.id === id);
  const countryName = (item) => item?.[`name_${lang}`] || item?.code || "—";
  const moduleName = (item) => item?.[`label_${lang}`] || item?.id || "—";
  const vintageLabel = (value) => t(value);
  const bandLabel = (value) => t(value);
  const familyLabel = (value) => ({ municipal: t("municipal"), country: t("countryData"), deep_dive: t("deepDive") })[value] || value;
  const cellLabel = (record) => record?.period_label || (record?.latest_year ? String(record.latest_year) : record?.vintage_type === "register" ? "LIVE" : "—");

  function filteredModules() {
    return state.data.modules.filter((item) => !state.family || item.family === state.family);
  }
  function filteredRecords() {
    const query = state.query.trim().toLocaleLowerCase(lang === "cs" ? "cs" : "en");
    const visibleModules = new Set(filteredModules().map((item) => item.id));
    return state.data.records.filter((record) => {
      if (!visibleModules.has(record.module)) return false;
      if (state.country && record.country_code !== state.country) return false;
      if (state.band && record.freshness_band !== state.band) return false;
      if (!query) return true;
      const haystack = [countryName(country(record.country_code)), record.country_code, moduleName(module(record.module)), record.coverage_cs, record.coverage_en, record.artifact].join(" ").toLocaleLowerCase(lang === "cs" ? "cs" : "en");
      return haystack.includes(query);
    });
  }
  function visibleCountries(records) {
    const codes = new Set(records.map((record) => record.country_code));
    return state.data.countries.filter((item) => codes.has(item.code)).sort((a, b) => countryName(a).localeCompare(countryName(b), lang));
  }
  function fillControls() {
    const countrySelect = document.querySelector("#freshness-country");
    countrySelect.innerHTML = `<option value="">${esc(t("allCountries"))}</option>${state.data.countries.map((item) => `<option value="${esc(item.code)}">${esc(countryName(item))} · ${esc(item.code)}</option>`).join("")}`;
    countrySelect.value = state.country;
    document.querySelector("#freshness-family").innerHTML = `<option value="">${esc(t("allFamilies"))}</option>${["municipal", "country", "deep_dive"].map((family) => `<option value="${family}">${esc(familyLabel(family))}</option>`).join("")}`;
    document.querySelector("#freshness-family").value = state.family;
    const bands = [...new Set(state.data.records.map((record) => record.freshness_band))];
    document.querySelector("#freshness-band").innerHTML = `<option value="">${esc(t("allFreshness"))}</option>${bands.map((band) => `<option value="${esc(band)}">${esc(bandLabel(band))}</option>`).join("")}`;
    document.querySelector("#freshness-band").value = state.band;
    document.querySelector("#freshness-search").value = state.query;
  }
  function renderKpis() {
    const totals = state.data.totals;
    document.querySelector("#freshness-kpis").innerHTML = [
      [totals.countries, t("countries")], [totals.modules, t("layers")], [totals.records, t("records")], [totals.municipal_units, t("units")],
    ].map(([value, label]) => `<article><strong>${number(value)}</strong><span>${esc(label)}</span></article>`).join("");
  }
  function renderMatrix(records) {
    const modules = filteredModules();
    const countries = visibleCountries(records);
    const byKey = new Map(records.map((record) => [`${record.country_code}:${record.module}`, record]));
    const table = document.querySelector("#freshness-matrix");
    table.innerHTML = `<thead><tr><th>${esc(t("country"))}</th>${modules.map((item) => `<th><span>${esc(moduleName(item))}</span><small>${esc(familyLabel(item.family))}</small></th>`).join("")}</tr></thead><tbody>${countries.map((item) => `<tr><th><b>${esc(countryName(item))}</b><small>${esc(item.code)}</small></th>${modules.map((layer) => {
      const record = byKey.get(`${item.code}:${layer.id}`);
      if (!record) return `<td class="freshness-empty"><span aria-label="${esc(t("none"))}">·</span></td>`;
      const active = state.selected?.country_code === item.code && state.selected?.module === layer.id;
      return `<td><button type="button" class="freshness-cell freshness-${esc(record.freshness_band)}${active ? " selected" : ""}" data-freshness-country="${esc(item.code)}" data-freshness-module="${esc(layer.id)}" aria-pressed="${active}" aria-label="${esc(`${countryName(item)}, ${moduleName(layer)}, ${cellLabel(record)}, ${bandLabel(record.freshness_band)}`)}"><strong>${esc(cellLabel(record))}</strong><small>${esc(vintageLabel(record.vintage_type))}</small></button></td>`;
    }).join("")}</tr>`).join("")}</tbody>`;
  }
  function renderSelection() {
    const root = document.querySelector("#freshness-selection");
    const record = state.selected;
    if (!record) {
      root.innerHTML = `<p>${esc(t("method"))}</p>`;
      return;
    }
    const item = country(record.country_code);
    const layer = module(record.module);
    const count = record.entity_count || record.row_count;
    const viewUrl = record.view_url ? `${record.view_url}${record.view_url.includes("?") ? "&" : "?"}lang=${lang}` : null;
    root.innerHTML = `<header><span>${esc(t("selected"))}</span><h3>${esc(countryName(item))} · ${esc(moduleName(layer))}</h3></header><div class="freshness-selection-grid"><div><span>${esc(t("latest"))}</span><strong>${esc(cellLabel(record))}</strong><small>${esc(bandLabel(record.freshness_band))}</small></div><div><span>${esc(t("firstYear"))}</span><strong>${record.first_year || "—"}</strong><small>${esc(vintageLabel(record.vintage_type))}</small></div><div><span>${esc(t("entities"))}</span><strong>${count ? number(count) : "—"}</strong><small>${esc(record.coverage_status)}</small></div><div><span>${esc(t("generated"))}</span><strong>${esc(date(record.artifact_generated_at))}</strong><small>${esc(record.artifact)}</small></div></div><p>${esc(record[`coverage_${lang}`] || record.coverage_en || record.coverage_cs)}</p><nav>${viewUrl ? `<a href="${esc(viewUrl)}">${esc(t("openView"))} →</a>` : ""}${record.source_url ? `<a href="${esc(record.source_url)}" target="_blank" rel="noreferrer">${esc(t("openSource"))} ↗</a>` : ""}</nav>`;
  }
  function renderTable(records) {
    const body = document.querySelector("#freshness-table-body");
    body.innerHTML = records.length ? records.map((record) => {
      const item = country(record.country_code), layer = module(record.module), count = record.entity_count || record.row_count;
      const viewUrl = record.view_url ? `${record.view_url}${record.view_url.includes("?") ? "&" : "?"}lang=${lang}` : null;
      return `<tr><td><b>${esc(countryName(item))}</b><small>${esc(item.code)}</small></td><td><b>${esc(moduleName(layer))}</b><small>${esc(familyLabel(layer.family))}</small></td><td><span class="freshness-pill freshness-${esc(record.freshness_band)}">${esc(cellLabel(record))}</span><small>${esc(bandLabel(record.freshness_band))}</small></td><td>${esc(vintageLabel(record.vintage_type))}</td><td><p>${esc(record[`coverage_${lang}`] || record.coverage_en || record.coverage_cs)}</p>${count ? `<small>${number(count)} ${esc(t("entities").toLocaleLowerCase())}</small>` : ""}</td><td><b>${esc(date(record.artifact_generated_at))}</b><small>${esc(record.artifact)}</small></td><td>${viewUrl ? `<a href="${esc(viewUrl)}">${esc(t("openView"))} →</a>` : ""}${record.source_url ? `<a href="${esc(record.source_url)}" target="_blank" rel="noreferrer">${esc(t("openSource"))} ↗</a>` : ""}</td></tr>`;
    }).join("") : `<tr><td colspan="7">${esc(t("noRows"))}</td></tr>`;
    document.querySelector("#freshness-summary").textContent = `${number(records.length)} / ${number(state.data.records.length)} ${t("shown")}`;
  }
  function render() {
    const records = filteredRecords();
    renderMatrix(records);
    renderSelection();
    renderTable(records);
  }
  function downloadCsv() {
    const headings = ["country_code", "country", "module", "latest_year", "period_label", "vintage_type", "freshness_band", "coverage", "entity_count", "row_count", "artifact", "artifact_generated_at", "source_url", "view_url"];
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [headings.join(","), ...filteredRecords().map((record) => [record.country_code, countryName(country(record.country_code)), moduleName(module(record.module)), record.latest_year, record.period_label, record.vintage_type, record.freshness_band, record[`coverage_${lang}`], record.entity_count, record.row_count, record.artifact, record.artifact_generated_at, record.source_url, record.view_url].map(quote).join(","))];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    link.download = `public-spending-data-freshness-${lang}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function bind() {
    document.querySelector("#freshness-country").addEventListener("change", (event) => { state.country = event.target.value; state.selected = null; render(); });
    document.querySelector("#freshness-family").addEventListener("change", (event) => { state.family = event.target.value; state.selected = null; render(); });
    document.querySelector("#freshness-band").addEventListener("change", (event) => { state.band = event.target.value; state.selected = null; render(); });
    document.querySelector("#freshness-search").addEventListener("input", (event) => { state.query = event.target.value; state.selected = null; render(); });
    document.querySelector("#freshness-reset").addEventListener("click", () => { Object.assign(state, { country: "", family: "", band: "", query: "", selected: null }); fillControls(); render(); });
    document.querySelector("#freshness-matrix").addEventListener("click", (event) => {
      const button = event.target.closest("[data-freshness-module]");
      if (!button) return;
      state.selected = state.data.records.find((record) => record.country_code === button.dataset.freshnessCountry && record.module === button.dataset.freshnessModule);
      render();
      document.querySelector("#freshness-selection").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    document.querySelector("#freshness-download").addEventListener("click", downloadCsv);
  }
  document.querySelectorAll("[data-freshness-copy]").forEach((node) => { node.textContent = t(node.dataset.freshnessCopy); });
  document.querySelector("#freshness-search").placeholder = t("searchPlaceholder");
  fetch("data/data-freshness.v1.json").then((response) => {
    if (!response.ok) throw new Error(`Freshness data returned ${response.status}`);
    return response.json();
  }).then((data) => {
    state.data = data;
    renderKpis();
    fillControls();
    bind();
    render();
  }).catch((error) => {
    console.error(error);
    document.querySelector("#freshness-root").innerHTML = `<p class="freshness-error">${esc(error.message)}</p>`;
  });
})();
