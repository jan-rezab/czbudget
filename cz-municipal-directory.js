const form = document.querySelector("#municipality-filters");
const grid = document.querySelector("#municipality-grid");
const count = document.querySelector("#municipality-count");
const more = document.querySelector("#municipality-more");
const empty = document.querySelector("#municipality-empty");
let municipalities = [];
let shown = 48;
const english = new URLSearchParams(location.search).get("lang") === "en" || localStorage.getItem("psd-lang") === "en";

const money = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const amount = (value) => {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1e9) return `${sign}${money.format(absolute / 1e9)} mld. Kč`;
  if (absolute >= 1e6) return `${sign}${money.format(absolute / 1e6)} mil. Kč`;
  return `${sign}${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(absolute)} Kč`;
};
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const card = (entity) => {
  const a = entity.amounts;
  const href = `${entity.seo.path}${english ? "?lang=en" : ""}`;
  return `<article class="entity-card compact-entity-card">
    <div class="entity-card-top"><span>${escapeHtml(entity.territory.region_name || "Česko")}</span><small>IČO ${escapeHtml(entity.national_id)}</small></div>
    <h2><a href="${escapeHtml(href)}">${escapeHtml(entity.short_name)}</a></h2>
    <dl><div><dt>${english ? "Revenue" : "Příjmy"}</dt><dd>${amount(a.revenue_actual)}</dd></div><div><dt>${english ? "Expenditure" : "Výdaje"}</dt><dd>${amount(a.expense_actual)}</dd></div><div><dt>${english ? "Cash and deposits" : "Stav účtů"}</dt><dd>${amount(a.cash_current)}</dd></div><div><dt>${english ? "Balance" : "Výsledek"}</dt><dd class="${a.budget_balance >= 0 ? "positive" : "negative"}">${amount(a.budget_balance)}</dd></div></dl>
    <a class="entity-detail-link" href="${escapeHtml(href)}">${english ? "Profile and data" : "Detail a data"} <span>↗</span></a>
  </article>`;
};

function filtered() {
  const query = document.querySelector("#municipality-query").value.trim().toLocaleLowerCase("cs");
  const region = document.querySelector("#municipality-region").value;
  const balance = document.querySelector("#municipality-balance").value;
  const sort = document.querySelector("#municipality-sort").value;
  const list = municipalities.filter((entity) => {
    const searchText = `${entity.short_name} ${entity.name} ${entity.national_id}`.toLocaleLowerCase("cs");
    return (!query || searchText.includes(query)) && (!region || entity.territory.region_name === region) &&
      (balance === "all" || (balance === "surplus" ? entity.amounts.budget_balance >= 0 : entity.amounts.budget_balance < 0));
  });
  list.sort((a, b) => {
    if (sort === "name") return a.short_name.localeCompare(b.short_name, "cs");
    const left = a.amounts[sort];
    const right = b.amounts[sort];
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
    if (!Number.isFinite(right)) return -1;
    return right - left;
  });
  return list;
}

function render() {
  const list = filtered();
  grid.innerHTML = list.slice(0, shown).map(card).join("");
  count.textContent = english ? `${list.length.toLocaleString("en-US")} municipalities` : `${list.length.toLocaleString("cs-CZ")} ${list.length === 1 ? "obec" : list.length < 5 ? "obce" : "obcí"}`;
  empty.hidden = list.length > 0;
  more.hidden = shown >= list.length;
}

form?.addEventListener("input", () => { shown = 48; render(); });
form?.addEventListener("change", () => { shown = 48; render(); });
form?.addEventListener("reset", () => setTimeout(() => { shown = 48; render(); }));
more?.addEventListener("click", () => { shown += 48; render(); });

fetch("../../data/municipal-snapshot.v1.json")
  .then((response) => response.json())
  .then((data) => { municipalities = data.municipalities; render(); })
  .catch(() => { count.textContent = english ? "Data could not be loaded" : "Data se nepodařilo načíst"; });
