const form = document.querySelector("#municipality-filters");
const grid = document.querySelector("#municipality-grid");
const count = document.querySelector("#municipality-count");
const more = document.querySelector("#municipality-more");
const empty = document.querySelector("#municipality-empty");
const yearSelect = document.querySelector("#municipality-year");
const coverage = document.querySelector("#municipality-year-coverage");
const explorerKpis = document.querySelector("#nationwide-history-kpis");
const explorerChart = document.querySelector("#nationwide-history-chart");
const explorerTable = document.querySelector("#nationwide-history-table-body");
const aggregateStory = document.querySelector("#municipal-aggregate-story");
const directoryYear = document.querySelector("#municipality-directory-year");
const resultYear = document.querySelector("#municipality-result-year");
if (explorerChart) {
  explorerChart.tabIndex = 0;
  explorerChart.setAttribute("role", "region");
  explorerChart.setAttribute("aria-label", "Scrollable nationwide municipal history chart");
}

let municipalities = [];
let annual = [];
let rowsByYear = new Map();
let activeMetrics = new Map();
let activeYear = 2025;
let shown = 48;

const params = new URLSearchParams(location.search);
const english = params.get("lang") === "en" || localStorage.getItem("psd-lang") === "en";
const locale = english ? "en-GB" : "cs-CZ";
const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

const amount = (value) => {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (english) {
    if (absolute >= 1e9) return `${sign}CZK ${decimal.format(absolute / 1e9)}bn`;
    if (absolute >= 1e6) return `${sign}CZK ${decimal.format(absolute / 1e6)}m`;
    return `${sign}CZK ${integer.format(absolute)}`;
  }
  if (absolute >= 1e9) return `${sign}${decimal.format(absolute / 1e9)} mld. Kč`;
  if (absolute >= 1e6) return `${sign}${decimal.format(absolute / 1e6)} mil. Kč`;
  return `${sign}${integer.format(absolute)} Kč`;
};
const signedAmount = (value) => `${value > 0 ? "+" : ""}${amount(value)}`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const metric = (entity) => activeMetrics.get(entity.national_id);

const card = (entity) => {
  const values = metric(entity);
  const href = `${entity.seo.path}${english ? "?lang=en" : ""}`;
  const balanceClass = !values ? "" : values.budget_balance >= 0 ? "positive" : "negative";
  return `<article class="entity-card compact-entity-card">
    <div class="entity-card-top"><span>${escapeHtml(entity.territory.region_name || (english ? "Czechia" : "Česko"))}</span><small>${activeYear} · IČO ${escapeHtml(entity.national_id)}</small></div>
    <h2><a href="${escapeHtml(href)}">${escapeHtml(entity.short_name)}</a></h2>
    <dl><div><dt>${english ? "Revenue" : "Příjmy"}</dt><dd>${amount(values?.revenue_actual)}</dd></div><div><dt>${english ? "Expenditure" : "Výdaje"}</dt><dd>${amount(values?.expense_actual)}</dd></div><div><dt>${english ? "Cash and deposits" : "Stav účtů"}</dt><dd>${amount(values?.cash_current)}</dd></div><div><dt>${english ? "Balance" : "Výsledek"}</dt><dd class="${balanceClass}">${amount(values?.budget_balance)}</dd></div></dl>
    <a class="entity-detail-link" href="${escapeHtml(href)}">${english ? "Profile and data" : "Detail a data"} <span>↗</span></a>
  </article>`;
};

function filtered() {
  const query = document.querySelector("#municipality-query").value.trim().toLocaleLowerCase("cs");
  const region = document.querySelector("#municipality-region").value;
  const balance = document.querySelector("#municipality-balance").value;
  const sort = document.querySelector("#municipality-sort").value;
  const list = municipalities.filter((entity) => {
    const values = metric(entity);
    const searchText = `${entity.short_name} ${entity.name} ${entity.national_id}`.toLocaleLowerCase("cs");
    const balanceMatch = balance === "all" || (values && (balance === "surplus" ? values.budget_balance >= 0 : values.budget_balance < 0));
    return (!query || searchText.includes(query)) && (!region || entity.territory.region_name === region) && balanceMatch;
  });
  list.sort((a, b) => {
    if (sort === "name") return a.short_name.localeCompare(b.short_name, "cs");
    const left = metric(a)?.[sort];
    const right = metric(b)?.[sort];
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : a.short_name.localeCompare(b.short_name, "cs");
    if (!Number.isFinite(right)) return -1;
    return right - left;
  });
  return list;
}

function renderDirectory() {
  const list = filtered();
  const withData = list.filter((entity) => metric(entity)).length;
  grid.innerHTML = list.slice(0, shown).map(card).join("");
  count.textContent = english
    ? `${list.length.toLocaleString("en-US")} municipalities · ${withData.toLocaleString("en-US")} with ${activeYear} data`
    : `${list.length.toLocaleString("cs-CZ")} ${list.length === 1 ? "obec" : list.length < 5 ? "obce" : "obcí"} · ${withData.toLocaleString("cs-CZ")} s daty za ${activeYear}`;
  empty.hidden = list.length > 0;
  more.hidden = shown >= list.length;
}

function renderAggregateStory() {
  if (!aggregateStory) return;
  const entities = municipalities.map((entity) => ({ entity, values: metric(entity) })).filter((item) => item.values);
  const surplus = entities.filter((item) => item.values.budget_balance >= 0);
  const deficit = entities.filter((item) => item.values.budget_balance < 0);
  const total = (group, field) => group.reduce((sum, item) => sum + item.values[field], 0);
  const netBalance = total(entities, "budget_balance");
  const surplusBalance = total(surplus, "budget_balance");
  const deficitBalance = total(deficit, "budget_balance");
  const worst = [...deficit].sort((a, b) => a.values.budget_balance - b.values.budget_balance).slice(0, 5);
  const worstBalance = total(worst, "budget_balance");
  const withoutWorst = netBalance - worstBalance;
  const share = (group) => decimal.format(group.length / entities.length * 100);
  const countText = (value) => value.toLocaleString(locale);
  const worstCards = worst.map(({ entity, values }, index) => {
    const href = `${entity.seo.path}${english ? "?lang=en" : ""}`;
    return `<li><a href="${escapeHtml(href)}"><span>${index + 1}. ${escapeHtml(entity.short_name)}</span><strong>${amount(values.budget_balance)}</strong></a></li>`;
  }).join("");
  const copy = english ? {
    kicker: "03 / What makes the balance", title: `${amount(surplusBalance)} generated by surplus municipalities.`,
    intro: `Total revenue and aggregate balance depending on whether each municipality closed ${activeYear} in surplus or deficit.`,
    surplus: "Surplus municipalities", deficit: "Deficit municipalities", net: "All municipalities · net", all: "of municipalities with data",
    revenue: "Total revenue", result: "Aggregate balance", after: "Net balance", revenueShort: "revenue",
    worst: "Five largest deficits", worstTitle: `The five largest deficits reduced the result by ${amount(Math.abs(worstBalance))}.`,
    without: `Without these five, municipalities would have finished at ${signedAmount(withoutWorst)} instead of ${signedAmount(netBalance)}.`,
    caveat: "Largest deficit means only the largest negative balance in the selected year. It may reflect planned investment funded from earlier savings; it is not a judgment on management quality or solvency.",
  } : {
    kicker: "03 / Co tvoří výsledek", title: `${amount(surplusBalance)} vytvořily přebytkové obce.`,
    intro: `Celkové příjmy a souhrnný výsledek podle toho, zda obec rok ${activeYear} uzavřela v přebytku, nebo ve schodku.`,
    surplus: "Přebytkové obce", deficit: "Schodkové obce", net: "Všechny obce čistě", all: "obcí s daty",
    revenue: "Celkové příjmy", result: "Souhrnný výsledek", after: "Výsledek po započtení", revenueShort: "příjmy",
    worst: "Pět největších schodků", worstTitle: `Pět největších schodků ubralo ${amount(Math.abs(worstBalance))}.`,
    without: `Bez této pětice by obce dohromady skončily na ${signedAmount(withoutWorst)} namísto ${signedAmount(netBalance)}.`,
    caveat: "Největší schodek znamená pouze největší záporný výsledek ve vybraném roce. Může jít o plánovanou investici hrazenou z dřívějších úspor; nejde o hodnocení kvality vedení ani platební schopnosti.",
  };
  aggregateStory.innerHTML = `<div class="directory-title"><div><span class="kicker">${copy.kicker}</span><h2 id="aggregate-story-title">${copy.title}</h2></div><p>${copy.intro}</p></div>
    <div class="aggregate-equation"><article class="aggregate-cohort good-cohort"><span>${copy.surplus}</span><strong>${countText(surplus.length)}</strong><small>${share(surplus)} % <i>${copy.all}</i></small><dl><div><dt>${copy.revenue}</dt><dd>${amount(total(surplus, "revenue_actual"))}</dd></div><div><dt>${copy.result}</dt><dd class="positive">${signedAmount(surplusBalance)}</dd></div></dl></article><div class="equation-sign" aria-hidden="true">+</div>
    <article class="aggregate-cohort bad-cohort"><span>${copy.deficit}</span><strong>${countText(deficit.length)}</strong><small>${share(deficit)} % <i>${copy.all}</i></small><dl><div><dt>${copy.revenue}</dt><dd>${amount(total(deficit, "revenue_actual"))}</dd></div><div><dt>${copy.result}</dt><dd class="negative">${amount(deficitBalance)}</dd></div></dl></article><div class="equation-sign" aria-hidden="true">=</div>
    <article class="aggregate-cohort net-cohort"><span>${copy.net}</span><strong>${countText(entities.length)}</strong><small><i>${copy.revenueShort}</i> ${amount(total(entities, "revenue_actual"))}</small><dl><div><dt>${copy.after}</dt><dd class="${netBalance >= 0 ? "positive" : "negative"}">${signedAmount(netBalance)}</dd></div></dl></article></div>
    <div class="piggy-panel"><div class="piggy-copy"><span class="kicker">${copy.worst}</span><h3>${copy.worstTitle}</h3><p>${copy.without}</p><small>${copy.caveat}</small></div><ol>${worstCards}</ol></div>`;
}

function niceAxis(domainMax, targetSteps = 4) {
  const roughStep = domainMax / targetSteps;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / power;
  const multiplier = [1, 2, 2.5, 5, 10].find((candidate) => candidate >= fraction) || 10;
  const step = multiplier * power;
  const max = Math.ceil(domainMax / step) * step;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
}

function renderExplorer() {
  const selected = annual.find((row) => row.year === activeYear);
  if (!selected) return;
  coverage.textContent = english
    ? `${selected.entity_count.toLocaleString("en-US")} municipalities with budget data · cash for ${selected.cash_entity_count.toLocaleString("en-US")}`
    : `${selected.entity_count.toLocaleString("cs-CZ")} obcí s rozpočtovými daty · stav účtů u ${selected.cash_entity_count.toLocaleString("cs-CZ")}`;
  explorerKpis.innerHTML = `<article><span>${english ? "Revenue" : "Příjmy"} ${activeYear}</span><strong>${amount(selected.revenue_actual)}</strong></article><article><span>${english ? "Expenditure" : "Výdaje"} ${activeYear}</span><strong>${amount(selected.expense_actual)}</strong></article><article><span>${english ? "Balance" : "Výsledek"} ${activeYear}</span><strong class="${selected.budget_balance >= 0 ? "positive" : "negative"}">${signedAmount(selected.budget_balance)}</strong></article><article><span>${english ? "Municipalities in surplus" : "Obce v přebytku"}</span><strong>${selected.surplus_count.toLocaleString(locale)}</strong><small>${decimal.format(selected.surplus_count / selected.entity_count * 100)} %</small></article>`;

  const width = 1120, height = 450, left = 76, right = 28, top = 28, bottom = 58;
  const axis = niceAxis(Math.max(...annual.flatMap((row) => [row.revenue_actual, row.expense_actual, row.cash_current])) * 1.04);
  const x = (index) => left + (index + .5) * ((width - left - right) / annual.length);
  const y = (value) => top + (axis.max - value) / axis.max * (height - top - bottom);
  const gridLines = axis.ticks.map((value) => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end">${decimal.format(value / 1e9)}</text>`).join("");
  const line = (field) => annual.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
  const yearLabels = annual.map((row, index) => index % 2 === 0 || row.year === activeYear || index === annual.length - 1 ? `<text x="${x(index)}" y="${height - 24}" text-anchor="middle" class="${row.year === activeYear ? "selected-year-label" : ""}">${row.year}</text>` : "").join("");
  const selectedIndex = annual.findIndex((row) => row.year === activeYear);
  const hits = annual.map((row, index) => `<circle class="nationwide-year-hit" data-year="${row.year}" cx="${x(index)}" cy="${y(row.revenue_actual)}" r="15"><title>${row.year}: ${amount(row.revenue_actual)}</title></circle>`).join("");
  explorerChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${english ? "Nationwide municipal revenue, expenditure and cash from 2010 to 2025" : "Celostátní vývoj obecních příjmů, výdajů a stavu účtů 2010 až 2025"}"><g class="history-grid">${gridLines}${yearLabels}<text x="18" y="22">${english ? "CZK bn" : "mld. Kč"}</text></g><line class="nationwide-selected-year" x1="${x(selectedIndex)}" x2="${x(selectedIndex)}" y1="${top}" y2="${height - bottom}"/><path class="history-line revenue-line" d="${line("revenue_actual")}"/><path class="history-line expense-line" d="${line("expense_actual")}"/><path class="history-line cash-line" d="${line("cash_current")}"/>${hits}</svg>`;
  explorerTable.innerHTML = [...annual].reverse().map((row) => `<tr${row.year === activeYear ? ' class="selected-history-row"' : ""}><th>${row.year}</th><td>${row.entity_count.toLocaleString(locale)}</td><td>${amount(row.revenue_actual)}</td><td>${amount(row.expense_actual)}</td><td class="${row.budget_balance >= 0 ? "positive" : "negative"}">${signedAmount(row.budget_balance)}</td><td>${amount(row.cash_current)}</td></tr>`).join("");
}

function selectYear(year, updateUrl = true) {
  if (!rowsByYear.has(year)) return;
  activeYear = year;
  activeMetrics = rowsByYear.get(year);
  shown = 48;
  yearSelect.value = String(year);
  directoryYear.textContent = year;
  resultYear.textContent = english ? `Year ${year}` : `Rok ${year}`;
  if (updateUrl) {
    const next = new URL(location.href);
    next.searchParams.set("year", year);
    history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }
  renderExplorer();
  renderAggregateStory();
  renderDirectory();
}

form?.addEventListener("input", () => { shown = 48; renderDirectory(); });
form?.addEventListener("change", () => { shown = 48; renderDirectory(); });
form?.addEventListener("reset", () => setTimeout(() => { shown = 48; renderDirectory(); }));
more?.addEventListener("click", () => { shown += 48; renderDirectory(); });
yearSelect?.addEventListener("change", () => selectYear(Number(yearSelect.value)));
explorerChart?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-year]");
  if (target) selectYear(Number(target.dataset.year));
});

Promise.all([
  fetch("../../data/municipal-snapshot.v1.json").then((response) => {
    if (!response.ok) throw new Error(`Municipal snapshot returned ${response.status}`);
    return response.json();
  }),
  fetch("../../data/municipal-history-directory.v1.json").then((response) => {
    if (!response.ok) throw new Error(`Municipal history returned ${response.status}`);
    return response.json();
  }),
]).then(([snapshot, historyData]) => {
  municipalities = snapshot.municipalities;
  annual = historyData.annual;
  const index = Object.fromEntries(historyData.columns.map((column, position) => [column, position]));
  for (const row of historyData.rows) {
    const year = row[index.year];
    const yearRows = rowsByYear.get(year) || new Map();
    yearRows.set(row[index.national_id], {
      revenue_actual: row[index.revenue_actual],
      expense_actual: row[index.expense_actual],
      budget_balance: row[index.budget_balance],
      cash_current: row[index.cash_current],
    });
    rowsByYear.set(year, yearRows);
  }
  const requestedYear = Number(params.get("year"));
  selectYear(rowsByYear.has(requestedYear) ? requestedYear : 2025, false);
}).catch((error) => {
  console.error("Municipal directory history integration failed", error);
  count.textContent = english ? "Data could not be loaded" : "Data se nepodařilo načíst";
  coverage.textContent = english ? "Historical data could not be loaded" : "Historická data se nepodařilo načíst";
});
