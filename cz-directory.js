const form = document.querySelector("#directory-filters");
const grid = document.querySelector("#entity-grid");
const cards = [...grid.querySelectorAll(".entity-card")];
const count = document.querySelector("#result-count");
const metricLabel = document.querySelector("#active-metric");
const empty = document.querySelector("#empty-state");

const metricConfig = {
  revenue: { field: "revenue", label: "příjmů" },
  expense: { field: "expense", label: "výdajů" },
  cash: { field: "cash", label: "peněz a vkladů" },
  "cash-to-expense": { field: "cashToExpense", label: "krytí výdajů hotovostí" },
  "capital-share": { field: "capitalShare", label: "investičního podílu" },
  "transfer-share": { field: "transferShare", label: "podílu transferů" },
  "balance-ratio": { field: "balanceRatio", label: "salda vůči příjmům" },
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
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
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
  count.textContent = `${visible.length} ${visible.length === 1 ? "subjekt" : visible.length < 5 ? "subjekty" : "subjektů"}`;
  metricLabel.textContent = filters.order === "name" ? "Řazeno podle názvu" : `Řazeno podle ${config.label}`;
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
