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
const benchmarkSummary = document.querySelector("#spending-benchmark-summary");
const benchmarkChart = document.querySelector("#spending-benchmark-chart");
const municipalSizeBenchmark = (() => {
  const section = document.createElement("section");
  section.id = "municipal-size-benchmark";
  section.className = "municipal-size-benchmark";
  section.setAttribute("aria-label", "International municipality-size benchmark");
  section.innerHTML = '<p class="benchmark-loading">Načítám mezinárodní benchmark…</p>';
  document.querySelector(".nationwide-history")?.insertAdjacentElement("afterend", section);
  return section;
})();
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
const perPerson = (value) => Number.isFinite(value)
  ? (english ? `CZK ${integer.format(value)} / person` : `${integer.format(value)} Kč / obyv.`)
  : "—";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const metric = (entity) => activeMetrics.get(entity.national_id);
const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const peerBands = [
  { max: 499, cs: "Do 499", en: "Under 500" },
  { max: 999, cs: "500–999", en: "500–999" },
  { max: 2499, cs: "1 000–2 499", en: "1,000–2,499" },
  { max: 4999, cs: "2 500–4 999", en: "2,500–4,999" },
  { max: 9999, cs: "5 000–9 999", en: "5,000–9,999" },
  { max: 19999, cs: "10 000–19 999", en: "10,000–19,999" },
  { max: 49999, cs: "20 000–49 999", en: "20,000–49,999" },
  { max: Infinity, cs: "50 000 a více", en: "50,000 and over" },
];
const bandFor = (population) => peerBands.find((band) => population <= band.max);

const card = (entity) => {
  const values = metric(entity);
  const href = `${entity.seo.path}${english ? "?lang=en" : ""}`;
  const balanceClass = !values ? "" : values.budget_balance >= 0 ? "positive" : "negative";
  const residents = Number.isFinite(values?.population_mid_year) ? `${integer.format(values.population_mid_year)} ${english ? "people" : "obyvatel"}` : "—";
  const peerDelta = Number.isFinite(values?.peer_delta_pct)
    ? `${values.peer_delta_pct > 0 ? "+" : ""}${decimal.format(values.peer_delta_pct)} % ${english ? "vs similar-sized municipalities" : "proti podobně velkým obcím"}`
    : (english ? "No per-person comparison" : "Bez srovnání na obyvatele");
  return `<article class="entity-card compact-entity-card">
    <div class="entity-card-top"><span>${escapeHtml(entity.territory.region_name || (english ? "Czechia" : "Česko"))}</span><small>${activeYear} · IČO ${escapeHtml(entity.national_id)}</small></div>
    <h2><a href="${escapeHtml(href)}">${escapeHtml(entity.short_name)}</a></h2>
    <p class="entity-spending-benchmark"><span>${residents}</span><strong>${perPerson(values?.expense_per_capita)}</strong><small>${peerDelta}</small></p>
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

function enrichBenchmarks() {
  const groups = new Map(peerBands.map((band) => [band, []]));
  for (const values of activeMetrics.values()) {
    values.expense_per_capita = values.population_mid_year > 0 ? values.expense_actual / values.population_mid_year : null;
    const band = bandFor(values.population_mid_year);
    if (band && Number.isFinite(values.expense_per_capita)) groups.get(band).push(values.expense_per_capita);
  }
  for (const [band, values] of groups) band.median = median(values);
  for (const values of activeMetrics.values()) {
    const peerMedian = bandFor(values.population_mid_year)?.median;
    values.peer_median = peerMedian;
    values.peer_delta_pct = Number.isFinite(values.expense_per_capita) && peerMedian
      ? (values.expense_per_capita / peerMedian - 1) * 100
      : null;
  }
}

function renderSpendingBenchmark(selected) {
  if (!benchmarkSummary || !benchmarkChart) return;
  const valid = [...activeMetrics.values()].filter((values) => Number.isFinite(values.expense_per_capita));
  const municipalMedian = median(valid.map((values) => values.expense_per_capita));
  benchmarkSummary.innerHTML = `<article><span>${english ? "National weighted average" : "Celostátní vážený průměr"}</span><strong>${perPerson(selected.expense_per_capita)}</strong><small>${activeYear}</small></article><article><span>${english ? "Median municipality" : "Medián obce"}</span><strong>${perPerson(municipalMedian)}</strong><small>${english ? "Each municipality has equal weight" : "Každá obec má stejnou váhu"}</small></article><article><span>${english ? "Population coverage" : "Pokrytí populace"}</span><strong>${selected.population_entity_count.toLocaleString(locale)}</strong><small>${integer.format(selected.population_total)} ${english ? "people" : "obyvatel"}</small></article>`;
  const maximum = Math.max(...peerBands.map((band) => band.median || 0), 1);
  benchmarkChart.innerHTML = peerBands.map((band) => {
    const values = valid.filter((item) => bandFor(item.population_mid_year) === band);
    return `<article><header><span>${english ? band.en : band.cs} ${english ? "people" : "obyvatel"}</span><strong>${perPerson(band.median)}</strong><small>${values.length.toLocaleString(locale)} ${english ? "municipalities" : "obcí"}</small></header><div><i style="width:${((band.median || 0) / maximum * 100).toFixed(2)}%"></i></div></article>`;
  }).join("");
}

function renderMunicipalSizeBenchmark(dataset, expanded = false) {
  const czech = dataset.countries.find((country) => country.iso3 === "CZE");
  const regular = dataset.countries.filter((country) => country.mean < 70000);
  const visible = expanded ? regular : regular.slice(0, 13);
  const outliers = dataset.countries.filter((country) => country.mean >= 70000);
  const width = 1080, left = 178, right = 100, top = 54, rowHeight = 34, bottom = 34;
  const height = top + visible.length * rowHeight + bottom, max = 70000;
  const x = (value) => left + value / max * (width - left - right);
  const ticks = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000];
  const axis = ticks.map((value) => `<g><line x1="${x(value)}" x2="${x(value)}" y1="${top - 22}" y2="${height - bottom + 4}"/><text x="${x(value)}" y="${top - 31}" text-anchor="middle">${value ? integer.format(value / 1000) + (english ? "k" : " tis.") : "0"}</text></g>`).join("");
  const rows = visible.map((country, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const active = country.iso3 === "CZE";
    const name = english ? country.name_en : country.name_cs;
    return `<g class="municipal-size-row${active ? " active" : ""}">
      <text class="municipal-size-rank" x="0" y="${y + 4}">${String(index + 1).padStart(2, "0")}</text>
      <text class="municipal-size-name" x="30" y="${y + 4}">${escapeHtml(name)}</text>
      <rect class="municipal-size-track" x="${left}" y="${y - 6}" width="${width - left - right}" height="12"/>
      <rect class="municipal-size-mean" x="${left}" y="${y - 6}" width="${Math.max(2, x(country.mean) - left)}" height="12"><title>${escapeHtml(name)} · ${integer.format(country.mean)} ${english ? "people per municipality" : "obyvatel na obec"}</title></rect>
      <circle class="municipal-size-median" cx="${x(country.median)}" cy="${y}" r="5"><title>${english ? "Median" : "Medián"}: ${integer.format(country.median)}</title></circle>
      <text class="municipal-size-value" x="${width - 2}" y="${y + 4}" text-anchor="end">${integer.format(country.mean)}</text>
    </g>`;
  }).join("");
  const cards = outliers.map((country) => `<article><span>${escapeHtml(english ? country.name_en : country.name_cs)}</span><strong>${integer.format(country.mean)}</strong><small>${english ? "people per municipality · outside chart scale" : "obyvatel na obec · mimo měřítko grafu"}</small></article>`).join("");
  const copy = english ? {
    kicker: `04 / International benchmark · OECD ${dataset.reference_year}`,
    title: "Czechia has Europe's smallest municipalities.",
    intro: "The average municipality has 1,741 people. The median is only 453 — a clearer picture of how fragmented the system really is.",
    mean: "People per municipality", median: "Median municipality", small: "Municipalities under 2,000", eu: "Of the EU27 average",
    meanLegend: "Average population", medianLegend: "Median", euLegend: "EU27 average",
    more: "Show all countries", less: "Show compact view",
    note: "A smaller value means a more fragmented municipal structure. This indicator does not measure staff numbers, service quality or administrative efficiency. Competences differ across countries.",
    source: "Source: OECD · Municipal level government by population size"
  } : {
    kicker: `04 / Mezinárodní benchmark · OECD ${dataset.reference_year}`,
    title: "Česko má nejmenší obce v Evropě.",
    intro: "Průměrná obec má 1 741 obyvatel. Medián je jen 453 — a ukazuje ještě přesněji, jak roztříštěný český systém je.",
    mean: "Obyvatel na obec", median: "Medián obce", small: "Obcí pod 2 000 obyvatel", eu: "Průměru EU27",
    meanLegend: "Průměrný počet obyvatel", medianLegend: "Medián", euLegend: "Průměr EU27",
    more: "Zobrazit všechny země", less: "Zobrazit kratší výběr",
    note: "Nižší hodnota znamená roztříštěnější obecní strukturu. Ukazatel neměří počet úředníků, kvalitu služeb ani efektivitu správy. Kompetence obcí se mezi zeměmi liší.",
    source: "Zdroj: OECD · Municipal level government by population size"
  };
  municipalSizeBenchmark.innerHTML = `<div class="municipal-size-heading"><div><span class="kicker">${copy.kicker}</span><h2>${copy.title}</h2></div><p>${copy.intro}</p></div>
    <div class="municipal-size-kpis"><article><span>${copy.mean}</span><strong>${integer.format(czech.mean)}</strong><small>№ 1 / ${dataset.countries.length}</small></article><article><span>${copy.median}</span><strong>${integer.format(czech.median)}</strong><small>${english ? "people" : "obyvatel"}</small></article><article><span>${copy.small}</span><strong>${integer.format(czech.under_2000_pct)} %</strong><small>${english ? "of all municipalities" : "všech obcí"}</small></article><article><span>${copy.eu}</span><strong>${integer.format(czech.mean / dataset.eu27_mean * 100)} %</strong><small>EU27 · ${integer.format(dataset.eu27_mean)}</small></article></div>
    <div class="municipal-size-chart-card"><div class="municipal-size-legend"><span><i class="mean-key"></i>${copy.meanLegend}</span><span><i class="median-key"></i>${copy.medianLegend}</span><span><i class="eu-key"></i>${copy.euLegend}</span></div><div class="municipal-size-chart-scroll" tabindex="0" role="region" aria-label="${escapeHtml(copy.title)}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(copy.title)}"><g class="municipal-size-axis">${axis}</g><line class="municipal-size-eu" x1="${x(dataset.eu27_mean)}" x2="${x(dataset.eu27_mean)}" y1="${top - 22}" y2="${height - bottom + 4}"/>${rows}</svg></div><button class="municipal-size-toggle" type="button">${expanded ? copy.less : copy.more}</button></div>
    <div class="municipal-size-outliers">${cards}</div><div class="municipal-size-method"><p>${copy.note}</p><a href="${escapeHtml(dataset.source.explorer_url)}" target="_blank" rel="noopener">${copy.source} ↗</a></div>`;
  municipalSizeBenchmark.querySelector(".municipal-size-toggle")?.addEventListener("click", () => renderMunicipalSizeBenchmark(dataset, !expanded));
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
    ? `${selected.entity_count.toLocaleString("en-US")} municipalities with budget data · population for ${selected.population_entity_count.toLocaleString("en-US")} · cash for ${selected.cash_entity_count.toLocaleString("en-US")}`
    : `${selected.entity_count.toLocaleString("cs-CZ")} obcí s rozpočtovými daty · populace u ${selected.population_entity_count.toLocaleString("cs-CZ")} · stav účtů u ${selected.cash_entity_count.toLocaleString("cs-CZ")}`;
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
  renderSpendingBenchmark(selected);
}

function selectYear(year, updateUrl = true) {
  if (!rowsByYear.has(year)) return;
  activeYear = year;
  activeMetrics = rowsByYear.get(year);
  enrichBenchmarks();
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
      population_mid_year: row[index.population_mid_year],
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

fetch("../../data/municipal-size-benchmark.v1.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Municipal size benchmark returned ${response.status}`);
    return response.json();
  })
  .then((dataset) => renderMunicipalSizeBenchmark(dataset))
  .catch((error) => {
    console.error("Municipal size benchmark failed", error);
    municipalSizeBenchmark.innerHTML = `<p class="benchmark-loading">${english ? "International benchmark could not be loaded." : "Mezinárodní benchmark se nepodařilo načíst."}</p>`;
  });
