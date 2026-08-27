const form = document.querySelector("#directory-filters");
const grid = document.querySelector("#entity-grid");
const cards = [...grid.querySelectorAll(".entity-card")];
const count = document.querySelector("#result-count");
const metricLabel = document.querySelector("#active-metric");
const empty = document.querySelector("#empty-state");

// An explicit ?lang= wins; otherwise take the language language-bootstrap.js
// resolved into <html lang>. Generated labels come from T, never hardcoded.
const directoryLang = (() => {
  const requested = new URLSearchParams(location.search).get("lang");
  return (requested === "en" || requested === "cs" ? requested : document.documentElement.lang) === "en" ? "en" : "cs";
})();
const T = {
  cs: {
    revenue: "příjmů", expense: "výdajů", cash: "peněz a vkladů", cashToExpense: "krytí výdajů hotovostí",
    capitalShare: "investičního podílu", transferShare: "podílu transferů", balanceRatio: "salda vůči příjmům",
    byName: "Řazeno podle názvu", sortedBy: (label) => `Řazeno podle ${label}`,
    entities: (count) => `${count} ${count === 1 ? "subjekt" : count < 5 ? "subjekty" : "subjektů"}`,
  },
  en: {
    revenue: "revenue", expense: "expenditure", cash: "cash and deposits", cashToExpense: "cash cover of expenditure",
    capitalShare: "capital share", transferShare: "transfer share", balanceRatio: "balance to revenue",
    byName: "Sorted by name", sortedBy: (label) => `Sorted by ${label}`,
    entities: (count) => `${count} ${count === 1 ? "entity" : "entities"}`,
  },
}[directoryLang];

const metricConfig = {
  revenue: { field: "revenue", label: "revenue" },
  expense: { field: "expense", label: "expense" },
  cash: { field: "cash", label: "cash" },
  "cash-to-expense": { field: "cashToExpense", label: "cashToExpense" },
  "capital-share": { field: "capitalShare", label: "capitalShare" },
  "transfer-share": { field: "transferShare", label: "transferShare" },
  "balance-ratio": { field: "balanceRatio", label: "balanceRatio" },
};

function values() {
  return {
    query: document.querySelector("#filter-query").value.trim().toLocaleLowerCase("cs"),
    metric: document.querySelector("#filter-metric").value,
    size: document.querySelector("#filter-size").value,
    balance: document.querySelector("#filter-balance").value,
    order: document.querySelector("#filter-order").value,
  };
}

function updateUrl(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && !["all", "desc"].includes(value) && !(key === "metric" && value === "revenue")) params.set(key, value);
  });
  // Keep the language in the shareable URL; dropping it would silently reset the
  // page to its route default on the next reload.
  if (new URLSearchParams(location.search).has("lang")) params.set("lang", directoryLang);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function applyFilters() {
  const filters = values();
  const config = metricConfig[filters.metric];
  const visible = cards.filter((card) => {
    const revenue = Number(card.dataset.revenue);
    const sizeMatch = filters.size === "all" || (filters.size === "small" && revenue < 5e9) || (filters.size === "medium" && revenue >= 5e9 && revenue <= 20e9) || (filters.size === "large" && revenue > 20e9);
    const queryMatch = !filters.query || card.dataset.name.includes(filters.query);
    const balanceMatch = filters.balance === "all" || card.dataset.balance === filters.balance;
    card.hidden = !(sizeMatch && queryMatch && balanceMatch);
    return !card.hidden;
  });
  visible.sort((a, b) => {
    if (filters.order === "name") return a.dataset.name.localeCompare(b.dataset.name, "cs");
    const difference = Number(a.dataset[config.field]) - Number(b.dataset[config.field]);
    return filters.order === "asc" ? difference : -difference;
  }).forEach((card) => grid.append(card));
  count.textContent = T.entities(visible.length);
  metricLabel.textContent = filters.order === "name" ? T.byName : T.sortedBy(T[config.label]);
  empty.hidden = visible.length !== 0;
  updateUrl(filters);
}

function loadUrlState() {
  const params = new URLSearchParams(location.search);
  const mapping = { query: "filter-query", metric: "filter-metric", size: "filter-size", balance: "filter-balance", order: "filter-order" };
  Object.entries(mapping).forEach(([key, id]) => {
    const value = params.get(key);
    const control = document.querySelector(`#${id}`);
    if (value && [...control.options || []].some((option) => option.value === value) || (key === "query" && value)) control.value = value;
  });
}

form.addEventListener("input", applyFilters);
form.addEventListener("change", applyFilters);
form.addEventListener("reset", () => setTimeout(applyFilters));
loadUrlState();
applyFilters();
