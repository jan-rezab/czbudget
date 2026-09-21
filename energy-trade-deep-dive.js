const $ = (selector) => document.querySelector(selector);
const lang = document.documentElement.lang === "en" ? "en" : "cs";
const tr = (cs, en) => lang === "en" ? en : cs;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const PRODUCTS = [
  { id: "petroleum", code: "270900", cs: "Surová ropa", en: "Crude petroleum", color: "#b36b36" },
  { id: "lng", code: "271111", cs: "LNG", en: "LNG", color: "#a8b63f" },
  { id: "gas", code: "271121", cs: "Zemní plyn", en: "Natural gas", color: "#58717c" },
];
const params = new URLSearchParams(location.search);
const requestedProduct = params.get("product");
const COUNTRY_STORAGE_KEY = "psd-energy-country";
const validCountry = (value) => typeof value === "string" && /^[A-Z0-9_ ]{2,12}$/.test(value);
function rememberedCountry() {
  try {
    const value = JSON.parse(localStorage.getItem(COUNTRY_STORAGE_KEY));
    return validCountry(value?.code) ? value : null;
  } catch { return null; }
}
const remembered = rememberedCountry();
const initialCountry = params.has("country") ? (validCountry(params.get("country")) ? params.get("country") : "ALL") : remembered?.code || "ALL";
const state = {
  product: PRODUCTS.some((item) => item.id === requestedProduct) ? requestedProduct : "petroleum",
  frequency: params.get("frequency") === "M" ? "M" : "A",
  period: params.get("period"),
  country: initialCountry,
  knownCountries: new Map(initialCountry === "ALL" ? [] : [[initialCountry, { code: initialCountry, name: remembered?.code === initialCountry ? remembered.name || initialCountry : initialCountry }]]),
  metadata: null,
  geometry: null,
  flows: null,
  request: 0,
  loading: false,
  playing: false,
  playTimer: null,
};

const product = () => PRODUCTS.find((item) => item.id === state.product);
const productName = (item = product()) => item[lang];
const money = (value) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value || 0);
const number = (value, digits = 0) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { maximumFractionDigits: digits }).format(value || 0);
const periodLabel = (period, frequency = state.frequency) => frequency === "A" ? period : new Intl.DateTimeFormat(lang === "cs" ? "cs-CZ" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${period.slice(0, 4)}-${period.slice(4)}-01T00:00:00Z`));
const productMeta = () => state.metadata.products.find((item) => item.id === state.product);
const periods = () => productMeta().periods.filter((item) => item.frequency === state.frequency).sort((a, b) => a.period.localeCompare(b.period));
const selectedMeta = () => periods().find((item) => item.period === state.period);

function translateStatic() {
  document.querySelectorAll("[data-cs][data-en]").forEach((node) => { node.textContent = node.dataset[lang]; });
  for (const [id, label] of [["energy-previous", tr("Předchozí období", "Previous period")], ["energy-next", tr("Další období", "Next period")]]) {
    $("#" + id).setAttribute("aria-label", label); $("#" + id).title = label;
  }
  $(".energy-playback").setAttribute("aria-label", tr("Přehrávání mapy", "Map playback"));
  document.title = tr("Světový obchod s ropou a plynem", "World oil and gas trade") + " — Public Spending Data";
  document.querySelector('meta[name="description"]').content = tr("Mapa světového obchodu se surovou ropou, LNG a zemním plynem podle vykázaného původu a dovozního trhu.", "A map of global trade in crude petroleum, LNG and natural gas by reported origin and importing market.");
}

function syncURL() {
  const url = new URL(location.href);
  url.searchParams.set("product", state.product);
  url.searchParams.set("frequency", state.frequency);
  if (state.period) url.searchParams.set("period", state.period); else url.searchParams.delete("period");
  if (state.country === "ALL") url.searchParams.delete("country"); else url.searchParams.set("country", state.country);
  history.replaceState(null, "", url);
}

function recommendedPeriod() {
  const rows = periods();
  if (!rows.length) return null;
  if (state.frequency === "A") return rows.at(-1).period;
  const maxMarkets = Math.max(...rows.map((item) => item.reporting_markets));
  return [...rows].reverse().find((item) => item.reporting_markets >= maxMarkets * .65)?.period || rows.at(-1).period;
}

function renderProductControls() {
  $("#energy-products").innerHTML = PRODUCTS.map((item, index) => `<button type="button" data-product="${item.id}" aria-pressed="${item.id === state.product}"><span>0${index + 1} · HS ${item.code}</span><strong>${esc(productName(item))}</strong></button>`).join("");
  $("#energy-products").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    pausePlayback(); state.product = button.dataset.product; renderProductControls(); fillPeriods(); loadFlows();
  }));
  document.documentElement.style.setProperty("--energy-accent", product().color);
}

function fillPeriods() {
  const rows = periods();
  if (!rows.some((item) => item.period === state.period)) state.period = recommendedPeriod();
  $("#energy-period").innerHTML = [...rows].reverse().map((item) => `<option value="${item.period}">${esc(periodLabel(item.period))} · ${item.reporting_markets} ${tr("trhů", "markets")}</option>`).join("");
  $("#energy-period").value = state.period;
  $("#energy-period").disabled = !rows.length;
  $("#energy-frequency").value = state.frequency;
  syncURL();
  renderHistory();
  renderPlayback();
}

function renderPlayback() {
  const rows = state.metadata ? periods() : [];
  const index = rows.findIndex((item) => item.period === state.period);
  const play = $("#energy-play");
  play.textContent = state.playing ? tr("Ⅱ Pozastavit", "Ⅱ Pause") : tr("▶ Přehrát", "▶ Play");
  play.setAttribute("aria-pressed", String(state.playing));
  play.disabled = rows.length < 2 || (state.loading && !state.playing);
  $("#energy-previous").disabled = state.loading || index <= 0;
  $("#energy-next").disabled = state.loading || index < 0 || index >= rows.length - 1;
  const timeline = $("#energy-timeline");
  timeline.max = Math.max(0, rows.length - 1);
  timeline.value = Math.max(0, index);
  timeline.disabled = state.loading || rows.length < 2;
  timeline.setAttribute("aria-valuetext", state.period ? periodLabel(state.period) : tr("Bez dat", "No data"));
  $("#energy-playback-label").textContent = state.frequency === "M" ? tr("Měsíc po měsíci", "Month by month") : tr("Rok po roku", "Year by year");
  $("#energy-playback-period").textContent = state.period ? periodLabel(state.period) : "—";
}

function pausePlayback() {
  state.playing = false;
  clearTimeout(state.playTimer);
  state.playTimer = null;
  renderPlayback();
}

function schedulePlayback() {
  clearTimeout(state.playTimer);
  if (!state.playing || state.loading) return;
  const rows = periods();
  const index = rows.findIndex((item) => item.period === state.period);
  if (index < 0 || index >= rows.length - 1) { pausePlayback(); return; }
  // Wait after each completed frame; slow requests never overlap or skip a cut.
  state.playTimer = setTimeout(() => changePeriod(rows[index + 1].period, true), 1400);
}

function changePeriod(period, autoplay = false) {
  if (!autoplay) pausePlayback();
  state.period = period;
  // Rebuild the options so the shared custom dropdown reflects playback too.
  fillPeriods();
  return loadFlows({ retainMap: autoplay });
}

function togglePlayback() {
  if (state.playing) { pausePlayback(); return; }
  const rows = periods();
  if (rows.length < 2) return;
  state.playing = true;
  renderPlayback();
  if (!state.loading && state.period === rows.at(-1).period) changePeriod(rows[0].period, true);
  else schedulePlayback();
}

function scopedRoutes() {
  const routes = state.flows?.routes || [];
  return state.country === "ALL" ? routes : routes.filter((route) => route.origin.code === state.country || route.market.code === state.country);
}

function countries() {
  for (const route of state.flows?.routes || []) for (const area of [route.origin, route.market]) state.knownCountries.set(area.code, area);
  return [...state.knownCountries.values()].sort((a, b) => a.name.localeCompare(b.name, lang === "cs" ? "cs" : "en"));
}

function fillCountries() {
  const rows = countries();
  $("#energy-country").innerHTML = `<option value="ALL">${tr("Všechny země", "All countries")}</option>${rows.map((item) => `<option value="${esc(item.code)}">${esc(item.name)}</option>`).join("")}`;
  $("#energy-country").value = state.country;
  $("#energy-country").disabled = false;
}

function aggregate(dimension, routes = scopedRoutes()) {
  const totals = new Map();
  for (const route of routes) {
    const area = route[dimension];
    const row = totals.get(area.code) || { ...area, value: 0 };
    row.value += route.value_usd;
    totals.set(area.code, row);
  }
  return [...totals.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function renderKpis() {
  const routes = scopedRoutes();
  const total = routes.reduce((sum, route) => sum + route.value_usd, 0);
  const origins = new Set(routes.map((route) => route.origin.code)).size;
  const markets = new Set(routes.map((route) => route.market.code)).size;
  const top = routes[0];
  $("#energy-kpis").innerHTML = `<article><span>${tr("Pozorovaný dovoz", "Observed imports")}</span><strong>${routes.length ? money(total) : "—"}</strong></article><article><span>${tr("Vykázané původy", "Reported origins")}</span><strong>${routes.length ? number(origins) : "—"}</strong></article><article><span>${tr("Dovozní trhy", "Importing markets")}</span><strong>${routes.length ? number(markets) : "—"}</strong></article><article><span>${tr("Největší trasa", "Largest route")}</span><strong>${top ? money(top.value_usd) : "—"}</strong></article>`;
}

function renderRankings() {
  const routes = scopedRoutes();
  const total = routes.reduce((sum, route) => sum + route.value_usd, 0);
  const ranking = (dimension) => {
    const rows = aggregate(dimension, routes).slice(0, 12); const max = rows[0]?.value || 1;
    return rows.map((row, index) => `<div class="energy-rank-row"><span>${String(index + 1).padStart(2, "0")}</span><button type="button" data-country="${row.code}">${esc(row.name)}</button><i><b style="width:${row.value / max * 100}%"></b></i><em>${money(row.value)}</em></div>`).join("");
  };
  $("#energy-origins").innerHTML = ranking("origin"); $("#energy-markets").innerHTML = ranking("market");
  document.querySelectorAll(".energy-rank-row button").forEach((button) => button.addEventListener("click", () => selectCountry(button.dataset.country)));
  $("#energy-routes").innerHTML = [...routes].sort((a, b) => b.value_usd - a.value_usd).slice(0, 40).map((route) => `<tr><td>${esc(route.origin.name)}</td><td>${esc(route.market.name)}</td><td>${money(route.value_usd)}</td><td>${number(total ? route.value_usd / total * 100 : 0, 1)}%</td></tr>`).join("");
  if (!routes.length) $("#energy-routes").innerHTML = `<tr><td colspan="4">${esc(noCountryData())}</td></tr>`;
}

function routePath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const bend = Math.min(95, Math.max(22, Math.hypot(dx, dy) * .18));
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)},${((a.y + b.y) / 2 - bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

function renderMap() {
  const routes = scopedRoutes();
  const map = $("#energy-map");
  const involved = new Map();
  for (const route of routes) for (const area of [route.origin, route.market]) if (area.iso2) involved.set(area.iso2.toLowerCase(), area.code);
  map.innerHTML = `<svg viewBox="${esc(state.geometry.viewBox)}" role="img" aria-label="${esc(productName())} · ${esc(periodLabel(state.period))}"><g class="energy-countries">${state.geometry.locations.map((location) => `<path class="energy-country ${involved.has(location.id) ? "has-flow" : ""} ${involved.get(location.id) === state.country ? "is-selected" : ""}" data-iso2="${location.id}" data-code="${involved.get(location.id) || ""}" d="${location.path}"><title>${esc(location.name)}</title></path>`).join("")}</g><g class="energy-routes"></g><g class="energy-nodes"></g></svg>`;
  const svg = map.querySelector("svg"), coordinates = new Map();
  svg.querySelectorAll(".energy-country.has-flow").forEach((path) => { const box = path.getBBox(); coordinates.set(path.dataset.iso2, { x: box.x + box.width / 2, y: box.y + box.height / 2 }); });
  const visualRoutes = [...routes].filter((route) => coordinates.has(route.origin.iso2?.toLowerCase()) && coordinates.has(route.market.iso2?.toLowerCase())).sort((a, b) => b.value_usd - a.value_usd).slice(0, 70);
  const max = visualRoutes[0]?.value_usd || 1;
  const lines = visualRoutes.map((route, index) => {
    const start = coordinates.get(route.origin.iso2.toLowerCase()), end = coordinates.get(route.market.iso2.toLowerCase());
    const width = .6 + Math.sqrt(route.value_usd / max) * 8;
    const label = `${route.origin.name} → ${route.market.name}: ${money(route.value_usd)}`;
    return `<g class="energy-route-group" data-route="${index}" tabindex="0" role="button" aria-label="${esc(label)}"><path class="energy-route" d="${routePath(start, end)}" stroke="${product().color}" stroke-width="${width.toFixed(2)}"><title>${esc(label)}</title></path><path class="energy-route-hit" d="${routePath(start, end)}" stroke-width="${Math.max(8, width).toFixed(2)}"></path></g>`;
  }).join("");
  const nodeCodes = new Map(); for (const route of visualRoutes) { nodeCodes.set(route.origin.iso2.toLowerCase(), route.origin); nodeCodes.set(route.market.iso2.toLowerCase(), route.market); }
  const nodes = [...nodeCodes].map(([iso2, area]) => { const point = coordinates.get(iso2); return point ? `<circle class="energy-node" cx="${point.x}" cy="${point.y}" r="3.2" fill="${product().color}"><title>${esc(area.name)}</title></circle>` : ""; }).join("");
  svg.querySelector(".energy-routes").innerHTML = lines; svg.querySelector(".energy-nodes").innerHTML = nodes;
  const detail = $("#energy-map-detail");
  detail.innerHTML = `<strong>${esc(productName())}</strong> · ${esc(periodLabel(state.period))} · ${routes.length} ${tr("načtených tras", "loaded routes")} · ${tr("mapa zobrazuje největších", "map shows the largest")} ${visualRoutes.length}`;
  if (!routes.length) detail.textContent = noCountryData();
  svg.querySelectorAll(".energy-route-group").forEach((group) => {
    const show = () => { const route = visualRoutes[Number(group.dataset.route)]; const weight = route.net_weight_kg == null ? "—" : `${number(route.net_weight_kg / 1e9, 1)} ${tr("mil. tun", "million tonnes")}`; detail.innerHTML = `<strong>${esc(route.origin.name)} → ${esc(route.market.name)}</strong> · ${money(route.value_usd)} · ${weight}${route.net_weight_is_estimated ? ` · ${tr("hmotnost obsahuje odhad", "weight includes estimates")}` : ""}`; };
    group.addEventListener("pointerenter", show); group.addEventListener("focus", show); group.addEventListener("click", show);
  });
  svg.querySelectorAll(".energy-country.has-flow").forEach((path) => { path.addEventListener("click", () => selectCountry(path.dataset.code)); path.setAttribute("tabindex", "0"); path.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectCountry(path.dataset.code); } }); });
}

function renderHistory() {
  if (!state.metadata) return;
  const host = $("#energy-history-chart"), rows = periods();
  const renderToken = Symbol("energy-history");
  host.__energyHistoryToken = renderToken;
  host.textContent = "";
  window.PSDPlotReady.then((plot) => {
    if (!host.isConnected || host.__energyHistoryToken !== renderToken) return;
    plot.render(host, {
      type: "column", rows: rows.map((item) => ({ label: periodLabel(item.period), period: item.period, value: item.observed_value_usd, markets: item.reporting_markets })),
      fields: [{ key: "value", label: tr("Pozorovaná hodnota", "Observed value"), color: product().color, format: (value, row) => `${money(value)} · ${row.markets} ${tr("trhů", "markets")}` }],
      title: productName(), unit: "USD", locale: lang === "cs" ? "cs-CZ" : "en-GB", height: 320,
      onSelect: (row) => changePeriod(row.period),
    });
  }).catch((error) => { if (host.isConnected) host.textContent = `Chart error: ${error.message}`; });
}

function selectCountry(code) {
  pausePlayback();
  state.country = code;
  try {
    if (code === "ALL") localStorage.removeItem(COUNTRY_STORAGE_KEY);
    else localStorage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify(state.knownCountries.get(code) || { code, name: code }));
  } catch { /* URL state still preserves the selection when storage is unavailable. */ }
  syncURL();
  if (state.flows) renderAll();
  else { fillCountries(); $("#energy-country").disabled = true; }
}

function noCountryData() {
  const name = state.knownCountries.get(state.country)?.name || state.country;
  return tr(`${name}: pro toto období nejsou vykázány žádné trasy.`, `${name}: no reported routes for this period.`);
}

function sourceDate(value) {
  if (!value) return "—";
  const date = new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}

function renderAll() {
  fillCountries(); renderKpis(); renderMap(); renderRankings();
  const meta = selectedMeta(), maxMarkets = Math.max(...periods().map((item) => item.reporting_markets));
  const partial = meta.reporting_markets < maxMarkets * .65;
  $("#energy-status").classList.toggle("partial", partial);
  $("#energy-status").textContent = `${productName()} · ${periodLabel(state.period)} · ${meta.reporting_markets} ${tr("reportujících dovozních trhů", "reporting import markets")}${partial ? ` · ${tr("částečné pokrytí", "partial coverage")}` : ""}`;
  if (state.country !== "ALL" && !scopedRoutes().length) $("#energy-status").textContent += ` · ${noCountryData()}`;
  $("#energy-coverage-copy").textContent = tr(`Výřez obsahuje ${meta.reporting_markets} dovozních trhů a ${meta.reported_origins} vykázaných původů. Součet není odhad chybějícího světového obchodu.`, `This cut contains ${meta.reporting_markets} importing markets and ${meta.reported_origins} reported origins. The total does not estimate missing world trade.`);
  $("#energy-vintage").textContent = `${tr("Staženo", "Retrieved")} ${sourceDate(state.flows.source.retrieved_at)}`;
  renderHistory();
}

function clearFlowView() {
  for (const id of ["energy-kpis", "energy-map", "energy-origins", "energy-markets", "energy-routes", "energy-coverage-copy", "energy-map-detail"]) $("#" + id).replaceChildren();
  $("#energy-vintage").textContent = "—";
}

async function loadFlows({ retainMap = false } = {}) {
  const request = ++state.request;
  state.flows = null;
  state.loading = true;
  if (!retainMap) clearFlowView();
  $("#energy-map").setAttribute("aria-busy", "true");
  renderPlayback();
  $("#energy-country").disabled = true;
  if (!state.period) {
    clearFlowView(); state.loading = false; pausePlayback();
    $("#energy-map").setAttribute("aria-busy", "false");
    $("#energy-status").textContent = tr("Pro tento produkt a časové rozlišení zatím nejsou zveřejněna data.", "No data is published yet for this product and frequency.");
    return;
  }
  $("#energy-status").classList.remove("partial"); $("#energy-status").textContent = `${tr("Načítám obchodní toky", "Loading trade flows")} · ${periodLabel(state.period)}…`;
  try {
    const url = `/api/v1/trade/energy/flows?product=${encodeURIComponent(state.product)}&frequency=${state.frequency}&period=${state.period}`;
    const payload = await PSDData.loadJson(url, { timeoutMs: 20000 });
    if (request !== state.request) return; state.flows = payload.data; renderAll();
  } catch (error) {
    console.error("energy trade flows", error); if (request !== state.request) return;
    state.flows = null; clearFlowView(); pausePlayback(); $("#energy-status").textContent = tr("Obchodní toky se nepodařilo načíst.", "Trade flows could not be loaded."); $("#energy-map").innerHTML = `<p>${esc(tr("Data jsou dočasně nedostupná.", "Data are temporarily unavailable."))}</p>`;
  } finally {
    if (request === state.request) {
      state.loading = false;
      $("#energy-map").setAttribute("aria-busy", "false");
      renderPlayback(); schedulePlayback();
    }
  }
}

function bind() {
  $("#energy-controls").addEventListener("submit", (event) => event.preventDefault());
  $("#energy-frequency").addEventListener("change", (event) => { pausePlayback(); state.frequency = event.target.value; fillPeriods(); loadFlows(); });
  $("#energy-period").addEventListener("change", (event) => changePeriod(event.target.value));
  $("#energy-country").addEventListener("change", (event) => selectCountry(event.target.value));
  $("#energy-reset").addEventListener("click", () => selectCountry("ALL"));
  $("#energy-play").addEventListener("click", togglePlayback);
  $("#energy-previous").addEventListener("click", () => { const rows = periods(), index = rows.findIndex((item) => item.period === state.period); if (index > 0) changePeriod(rows[index - 1].period); });
  $("#energy-next").addEventListener("click", () => { const rows = periods(), index = rows.findIndex((item) => item.period === state.period); if (index >= 0 && index < rows.length - 1) changePeriod(rows[index + 1].period); });
  $("#energy-timeline").addEventListener("input", (event) => { const period = periods()[Number(event.target.value)]?.period; if (period) changePeriod(period); });
  window.addEventListener("pagehide", pausePlayback);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pausePlayback(); });
}

translateStatic(); window.psdLanguageReady?.(); bind();
Promise.all([
  PSDData.loadJson("/api/v1/trade/energy/periods", { timeoutMs: 20000 }),
  PSDData.loadJson("/data/world-map.v1.json"),
]).then(([metadata, geometry]) => {
  state.metadata = metadata.data; state.geometry = geometry; renderProductControls(); fillPeriods(); loadFlows();
}).catch((error) => { console.error("energy trade", error); $("#energy-status").textContent = tr("Data obchodu s energií se nepodařilo načíst.", "Energy-trade data could not be loaded."); });
