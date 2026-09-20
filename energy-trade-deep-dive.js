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
const state = {
  product: PRODUCTS.some((item) => item.id === requestedProduct) ? requestedProduct : "petroleum",
  frequency: params.get("frequency") === "M" ? "M" : "A",
  period: params.get("period"),
  country: /^[A-Z]{3}$/.test(params.get("country") || "") ? params.get("country") : "ALL",
  metadata: null,
  geometry: null,
  flows: null,
  request: 0,
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
  document.title = tr("Světový obchod s ropou a plynem", "World oil and gas trade") + " — Public Spending Data";
  document.querySelector('meta[name="description"]').content = tr("Mapa světového obchodu se surovou ropou, LNG a zemním plynem podle vykázaného původu a dovozního trhu.", "A map of global trade in crude petroleum, LNG and natural gas by reported origin and importing market.");
}

function syncURL() {
  const url = new URL(location.href);
  url.searchParams.set("product", state.product);
  url.searchParams.set("frequency", state.frequency);
  url.searchParams.set("period", state.period);
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
    state.product = button.dataset.product; state.period = recommendedPeriod(); state.country = "ALL"; syncURL(); renderProductControls(); fillPeriods(); loadFlows();
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
}

function scopedRoutes() {
  const routes = state.flows?.routes || [];
  return state.country === "ALL" ? routes : routes.filter((route) => route.origin.code === state.country || route.market.code === state.country);
}

function countries() {
  const byCode = new Map();
  for (const route of state.flows?.routes || []) for (const area of [route.origin, route.market]) if (!byCode.has(area.code)) byCode.set(area.code, area);
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, lang === "cs" ? "cs" : "en"));
}

function fillCountries() {
  const rows = countries();
  if (state.country !== "ALL" && !rows.some((item) => item.code === state.country)) state.country = "ALL";
  $("#energy-country").innerHTML = `<option value="ALL">${tr("Všechny země", "All countries")}</option>${rows.map((item) => `<option value="${item.code}">${esc(item.name)}</option>`).join("")}`;
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
  $("#energy-kpis").innerHTML = `<article><span>${tr("Pozorovaný dovoz", "Observed imports")}</span><strong>${money(total)}</strong></article><article><span>${tr("Vykázané původy", "Reported origins")}</span><strong>${number(origins)}</strong></article><article><span>${tr("Dovozní trhy", "Importing markets")}</span><strong>${number(markets)}</strong></article><article><span>${tr("Největší trasa", "Largest route")}</span><strong>${top ? money(top.value_usd) : "—"}</strong></article>`;
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
  svg.querySelectorAll(".energy-route-group").forEach((group) => {
    const show = () => { const route = visualRoutes[Number(group.dataset.route)]; const weight = route.net_weight_kg == null ? "—" : `${number(route.net_weight_kg / 1e9, 1)} ${tr("mil. tun", "million tonnes")}`; detail.innerHTML = `<strong>${esc(route.origin.name)} → ${esc(route.market.name)}</strong> · ${money(route.value_usd)} · ${weight}${route.net_weight_is_estimated ? ` · ${tr("hmotnost obsahuje odhad", "weight includes estimates")}` : ""}`; };
    group.addEventListener("pointerenter", show); group.addEventListener("focus", show); group.addEventListener("click", show);
  });
  svg.querySelectorAll(".energy-country.has-flow").forEach((path) => { path.addEventListener("click", () => selectCountry(path.dataset.code)); path.setAttribute("tabindex", "0"); path.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectCountry(path.dataset.code); } }); });
}

function renderHistory() {
  if (!state.metadata) return;
  const rows = periods(), max = Math.max(1, ...rows.map((item) => item.observed_value_usd));
  $("#energy-history-chart").innerHTML = rows.map((item) => `<button type="button" class="energy-history-bar ${item.period === state.period ? "selected" : ""}" data-period="${item.period}" style="--height:${Math.max(1.5, item.observed_value_usd / max * 100)}%" aria-label="${esc(`${periodLabel(item.period)} · ${money(item.observed_value_usd)} · ${item.reporting_markets} ${tr("trhů", "markets")}`)}"><i></i><span>${esc(periodLabel(item.period))}</span><small>${item.reporting_markets} ${tr("trhů", "markets")}</small></button>`).join("");
  $("#energy-history-chart").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.period = button.dataset.period; $("#energy-period").value = state.period; syncURL(); renderHistory(); loadFlows(); }));
}

function selectCountry(code) {
  state.country = state.country === code ? "ALL" : code; $("#energy-country").value = state.country; syncURL(); renderAll();
}

function renderAll() {
  fillCountries(); renderKpis(); renderMap(); renderRankings();
  const meta = selectedMeta(), maxMarkets = Math.max(...periods().map((item) => item.reporting_markets));
  const partial = meta.reporting_markets < maxMarkets * .65;
  $("#energy-status").classList.toggle("partial", partial);
  $("#energy-status").textContent = `${productName()} · ${periodLabel(state.period)} · ${meta.reporting_markets} ${tr("reportujících dovozních trhů", "reporting import markets")}${partial ? ` · ${tr("částečné pokrytí", "partial coverage")}` : ""}`;
  $("#energy-coverage-copy").textContent = tr(`Výřez obsahuje ${meta.reporting_markets} dovozních trhů a ${meta.reported_origins} vykázaných původů. Součet není odhad chybějícího světového obchodu.`, `This cut contains ${meta.reporting_markets} importing markets and ${meta.reported_origins} reported origins. The total does not estimate missing world trade.`);
  $("#energy-vintage").textContent = `${tr("Staženo", "Retrieved")} ${String(state.flows.source.retrieved_at || "—").slice(0, 10)}`;
  renderHistory();
}

async function loadFlows() {
  const request = ++state.request;
  $("#energy-status").classList.remove("partial"); $("#energy-status").textContent = tr("Načítám obchodní toky…", "Loading trade flows…");
  try {
    const url = `/api/v1/trade/energy/flows?product=${encodeURIComponent(state.product)}&frequency=${state.frequency}&period=${state.period}`;
    const response = await fetch(url); if (!response.ok) throw new Error(response.status); const payload = await response.json();
    if (request !== state.request) return; state.flows = payload.data; renderAll();
  } catch (error) {
    console.error("energy trade flows", error); if (request !== state.request) return;
    state.flows = null; $("#energy-status").textContent = tr("Obchodní toky se nepodařilo načíst.", "Trade flows could not be loaded."); $("#energy-map").innerHTML = `<p>${esc(tr("Data jsou dočasně nedostupná.", "Data are temporarily unavailable."))}</p>`;
  }
}

function bind() {
  $("#energy-controls").addEventListener("submit", (event) => event.preventDefault());
  $("#energy-frequency").addEventListener("change", (event) => { state.frequency = event.target.value; state.period = recommendedPeriod(); state.country = "ALL"; fillPeriods(); loadFlows(); });
  $("#energy-period").addEventListener("change", (event) => { state.period = event.target.value; state.country = "ALL"; syncURL(); renderHistory(); loadFlows(); });
  $("#energy-country").addEventListener("change", (event) => { state.country = event.target.value; syncURL(); renderAll(); });
  $("#energy-reset").addEventListener("click", () => { state.country = "ALL"; syncURL(); renderAll(); });
}

translateStatic(); bind();
Promise.all([
  fetch("/api/v1/trade/energy/periods").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
  fetch("/data/world-map.v1.json").then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); }),
]).then(([metadata, geometry]) => {
  state.metadata = metadata.data; state.geometry = geometry; renderProductControls(); fillPeriods(); loadFlows();
}).catch((error) => { console.error("energy trade", error); $("#energy-status").textContent = tr("Data obchodu s energií se nepodařilo načíst.", "Energy-trade data could not be loaded."); });
