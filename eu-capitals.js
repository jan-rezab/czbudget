const $ = (selector) => document.querySelector(selector);
const DATA_URL = "data/eu-capital-budgets.v1.json";
const requestedLanguage = new URLSearchParams(location.search).get("lang");
const storedLanguage = localStorage.getItem("psd-lang");
const state = {
  lang: ["cs", "en"].includes(requestedLanguage) ? requestedLanguage : (["cs", "en"].includes(storedLanguage) ? storedLanguage : "cs"),
  currency: "eur", sort: "city", coverage: "all", query: "", selected: null, data: null
};

const I = {
  cs: {
    eyebrow: "27 hlavních měst EU + Londýn", hero1: "Města v číslech.", hero2: "Rozpočet i kontext.", heroCopy: "Nejnovější oficiální rozpočty evropských metropolí, přepínatelné mezi eurem a místní měnou. Vedle nich počet obyvatel a turistická přenocování.", heroCta: "Otevřít atlas měst",
    ledgerTitle: "Datový výřez", statCities: "Města", statCurrencies: "Měny", statEu: "Členské státy EU", statTourism: "Turistika", ledgerNote: "Rozpočtové období je 2026, s označenými výjimkami pro Vallettu a Londýn.",
    warningLabel: "Čtěte rozsah.", warningCopy: "Městské struktury a účetní definice se liší. Částky zachovávají nejširší oficiální výdajový údaj každého města; nejsou bez dalšího vhodné jako žebříček.",
    atlasKicker: "01 / Městský atlas", atlasTitle: "Jedno místo. Čtyři měřítka.", atlasCopy: "Rozpočet, obyvatelé, turistická přenocování a intenzita cestovního ruchu. Kliknutím na řádek otevřete přesný rozsah a původ hodnoty.",
    searchLabel: "Hledat město nebo zemi", searchPlaceholder: "Praha, France…", currencyLabel: "Zobrazená měna", currencyEur: "EUR", currencyLocal: "Místní měna", sortLabel: "Seřadit podle", sortCity: "Města A–Z", sortBudget: "Rozpočtu", sortPopulation: "Počtu obyvatel", sortNights: "Přenocování", sortIntensity: "Přenocování / obyv.", coverageLabel: "Výběr", coverageAll: "EU + Londýn", coverageEu: "Pouze EU", resultNote: "Hodnoty rozpočtu jsou nominální.",
    thCity: "Město", thBudget: "Rozpočet", thPopulation: "Obyvatelé", thNights: "Přenocování", thIntensity: "Noci / obyv.", thDetail: "Detail", emptyTitle: "Nic jsme nenašli.", emptyCopy: "Zkuste jiné město nebo zemi.",
    detailKicker: "02 / Detail města", detailInitial: "Vyberte město v tabulce.", officialSource: "Primární zdroj ↗", budgetLabel: "Rozpočet", populationLabel: "Obyvatelé", nightsLabel: "Přenocování", foreignShareLabel: "Podíl zahraničních nocí", exactScope: "Přesný rozsah", lineage: "Zdroj a původ", period: "období", referenceYear: "referenční rok", extraLondon: "Londýn / srovnávací město mimo EU", euCapital: "Hlavní město členského státu EU", broaderSource: "širší místní turistický zdroj", stalePopulation: "starší populační údaj", unavailable: "neuvedeno",
    methodKicker: "03 / Jak data číst", methodTitle: "Srovnání s přiznanými hranicemi.", methodCopy: "Každá hodnota si nese rok, územní vymezení a primární zdroj. To umožní později stavět městské profily bez ztráty původního významu.", methodBudgetTitle: "Rozpočty", methodBudgetCopy: "Nejširší oficiální výdajová částka dostupná k 20. srpnu 2026. Přesná definice a rozsah jsou v detailu města.", methodFxTitle: "Přepočet měn", methodFxCopy: "EUR hodnoty používají referenční kurzy ECB z 20. srpna 2026. Místní částka zůstává uložená beze změny.", methodPopulationTitle: "Obyvatelé", methodPopulationCopy: "Nejnovější dostupný údaj Eurostatu. Rok a případné širší území „greater city“ zobrazujeme přímo u hodnoty.", methodTourismTitle: "Cestovní ruch", methodTourismCopy: "Přenocování za rok 2024. Dublin a Londýn používají širší místní zdroje, proto jsou v detailu zvlášť označené.", footerScope: "Evropská města", footerSource: "Zdroje: rozpočty měst · Eurostat · ECB", backTop: "Nahoru ↑", citiesCount: (n) => `${n} ${n === 1 ? "město" : n < 5 ? "města" : "měst"}`
  },
  en: {
    eyebrow: "27 EU capitals + London", hero1: "Cities in numbers.", hero2: "Budget in context.", heroCopy: "The latest official budgets of European capitals, switchable between euros and local currency. Alongside them: population and tourist nights.", heroCta: "Open the city atlas",
    ledgerTitle: "Data snapshot", statCities: "Cities", statCurrencies: "Currencies", statEu: "EU member states", statTourism: "Tourism", ledgerNote: "The budget period is 2026, with flagged exceptions for Valletta and London.",
    warningLabel: "Read the scope.", warningCopy: "Municipal structures and accounting definitions differ. The figures retain each city's broadest official expenditure measure; they are not a league table without further adjustment.",
    atlasKicker: "01 / City atlas", atlasTitle: "One place. Four measures.", atlasCopy: "Budget, population, tourist nights and tourism intensity. Select a row to see the exact scope and source behind the value.",
    searchLabel: "Search city or country", searchPlaceholder: "Prague, France…", currencyLabel: "Display currency", currencyEur: "EUR", currencyLocal: "Local currency", sortLabel: "Sort by", sortCity: "City A–Z", sortBudget: "Budget", sortPopulation: "Population", sortNights: "Tourist nights", sortIntensity: "Nights / resident", coverageLabel: "Coverage", coverageAll: "EU + London", coverageEu: "EU only", resultNote: "Budget values are nominal.",
    thCity: "City", thBudget: "Budget", thPopulation: "Population", thNights: "Tourist nights", thIntensity: "Nights / resident", thDetail: "Detail", emptyTitle: "No results.", emptyCopy: "Try another city or country.",
    detailKicker: "02 / City detail", detailInitial: "Select a city in the table.", officialSource: "Primary source ↗", budgetLabel: "Budget", populationLabel: "Population", nightsLabel: "Tourist nights", foreignShareLabel: "Non-resident share", exactScope: "Exact scope", lineage: "Source and lineage", period: "period", referenceYear: "reference year", extraLondon: "London / non-EU comparator", euCapital: "Capital of an EU member state", broaderSource: "broader local tourism source", stalePopulation: "older population observation", unavailable: "not available",
    methodKicker: "03 / How to read the data", methodTitle: "Comparison with visible boundaries.", methodCopy: "Every value retains its year, geographic definition and primary source. Future city profiles can build on it without losing the original meaning.", methodBudgetTitle: "Budgets", methodBudgetCopy: "The broadest official expenditure figure available on 20 August 2026. The exact definition and scope appear in each city detail.", methodFxTitle: "Currency conversion", methodFxCopy: "EUR values use ECB reference rates from 20 August 2026. The original local-currency amount remains stored unchanged.", methodPopulationTitle: "Population", methodPopulationCopy: "Latest available Eurostat observation. The year and any wider ‘greater city’ boundary are shown alongside the value.", methodTourismTitle: "Tourism", methodTourismCopy: "Tourist nights for 2024. Dublin and London use broader local sources and are explicitly flagged in the city detail.", footerScope: "European cities", footerSource: "Sources: city budgets · Eurostat · ECB", backTop: "Back to top ↑", citiesCount: (n) => `${n} ${n === 1 ? "city" : "cities"}`
  }
};

const CZECH_CITY_NAMES = {
  "amsterdam-nl":"Amsterdam","athens-gr":"Athény","berlin-de":"Berlín","bratislava-sk":"Bratislava","brussels-be":"Brusel","bucharest-ro":"Bukurešť","budapest-hu":"Budapešť","copenhagen-dk":"Kodaň","dublin-ie":"Dublin","helsinki-fi":"Helsinky","lisbon-pt":"Lisabon","ljubljana-si":"Lublaň","luxembourg-lu":"Lucemburk","madrid-es":"Madrid","nicosia-cy":"Nikósie","paris-fr":"Paříž","prague-cz":"Praha","riga-lv":"Riga","rome-it":"Řím","sofia-bg":"Sofie","stockholm-se":"Stockholm","tallinn-ee":"Tallinn","valletta-mt":"Valletta","vienna-at":"Vídeň","vilnius-lt":"Vilnius","warsaw-pl":"Varšava","zagreb-hr":"Záhřeb","london-gb":"Londýn"
};

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
const cityName = (city) => state.lang === "cs" ? (CZECH_CITY_NAMES[city.city_id] || city.city) : city.city;
const countryName = (city) => new Intl.DisplayNames([locale()], {type:"region"}).of(city.country_code) || city.country;
const compactNumber = (value, digits = 1) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {notation:"compact", maximumFractionDigits:digits}).format(value) : "—";
const decimal = (value, digits = 1) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {maximumFractionDigits:digits, minimumFractionDigits:digits}).format(value) : "—";
const money = (city) => {
  const amount = state.currency === "eur" ? city.budget.eur_amount : city.budget.local_amount;
  const currency = state.currency === "eur" ? "EUR" : city.budget.local_currency;
  return Number.isFinite(amount) ? new Intl.NumberFormat(locale(), {style:"currency", currency, notation:"compact", maximumFractionDigits:amount < 10000000 ? 1 : 2}).format(amount) : "—";
};
const isStalePopulation = (city) => city.benchmarks.population.reference_year < 2022 || city.benchmarks.population.quality_flags?.length > 0;
const tourismIsLocal = (city) => !String(city.benchmarks.tourism.comparability_group).startsWith("eurostat");

function translate() {
  document.documentElement.lang = state.lang;
  document.title = state.lang === "en" ? "European capitals — budgets, population and tourism" : "Evropská hlavní města — rozpočty, obyvatelé a cestovní ruch";
  document.querySelectorAll("[data-i18n]").forEach((node) => { const value = I[state.lang][node.dataset.i18n]; if (typeof value === "string") node.textContent = value; });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => node.placeholder = I[state.lang][node.dataset.i18nPlaceholder]);
  document.querySelectorAll("[data-lang]").forEach((button) => { const active = button.dataset.lang === state.lang; button.classList.toggle("active", active); button.setAttribute("aria-pressed", active ? "true" : "false"); });
  document.querySelector(".brand").href = `index.html?lang=${state.lang}`;
}

function filteredCities() {
  const query = state.query.trim().toLocaleLowerCase(locale());
  const cities = state.data.cities.filter((city) => {
    if (state.coverage === "eu" && !city.eu_capital) return false;
    if (!query) return true;
    return [city.city, cityName(city), city.country, countryName(city), city.country_code].some((value) => value.toLocaleLowerCase(locale()).includes(query));
  });
  const extractors = {budget:(city)=>city.budget.eur_amount,population:(city)=>city.benchmarks.population.value,nights:(city)=>city.benchmarks.tourism.nights_total,intensity:(city)=>city.benchmarks.tourism.nights_per_resident};
  return cities.sort((a,b) => state.sort === "city" ? cityName(a).localeCompare(cityName(b), locale()) : (extractors[state.sort](b) ?? -Infinity) - (extractors[state.sort](a) ?? -Infinity));
}

function renderTable() {
  const cities = filteredCities();
  $("#capital-count").textContent = I[state.lang].citiesCount(cities.length);
  $("#capital-empty").hidden = cities.length > 0;
  $(".capital-table-wrap").hidden = cities.length === 0;
  $("#capital-table-body").innerHTML = cities.map((city) => {
    const population = city.benchmarks.population, tourism = city.benchmarks.tourism, selected = city.city_id === state.selected;
    return `<tr data-city-id="${esc(city.city_id)}" class="${selected ? "active" : ""}" tabindex="0" aria-selected="${selected}">
      <td class="capital-city-cell"><div class="capital-city"><span class="capital-city-code">${esc(city.country_code)}</span><strong>${esc(cityName(city))}</strong><small>${esc(countryName(city))}${city.extra_city ? " · UK" : ""}</small></div></td>
      <td><strong class="capital-value">${esc(money(city))}</strong><small class="capital-period">${esc(city.period)} · ${esc(city.currency_code)}</small></td>
      <td><strong class="capital-value">${esc(compactNumber(population.value))}</strong><small class="capital-period ${isStalePopulation(city) ? "data-warning" : ""}">${esc(population.reference_year)}${isStalePopulation(city) ? " · !" : ""}</small></td>
      <td><strong class="capital-value">${esc(compactNumber(tourism.nights_total))}</strong><small class="capital-period ${tourismIsLocal(city) ? "data-warning" : ""}">${esc(tourism.reference_year)}${tourismIsLocal(city) ? " · *" : ""}</small></td>
      <td><strong class="capital-value">${esc(decimal(tourism.nights_per_resident))}</strong><small class="capital-period">${esc(tourism.geography_name)}</small></td><td class="row-arrow" aria-hidden="true">→</td></tr>`;
  }).join("");
  $("#capital-table-body").querySelectorAll("tr").forEach((row) => {
    const select = () => selectCity(row.dataset.cityId, true);
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(); } });
  });
}

function selectCity(cityId, scroll = false) {
  const city = state.data.cities.find((item) => item.city_id === cityId);
  if (!city) return;
  state.selected = cityId; renderTable(); renderDetail(city);
  if (scroll) $("#city-detail").scrollIntoView({behavior:"smooth", block:"start"});
}

function renderDetail(city) {
  const t = I[state.lang], population = city.benchmarks.population, tourism = city.benchmarks.tourism;
  const flags = [city.eu_capital ? t.euCapital : t.extraLondon];
  if (isStalePopulation(city)) flags.push(t.stalePopulation);
  if (tourismIsLocal(city)) flags.push(t.broaderSource);
  const foreignShare = Number.isFinite(tourism.nights_nonresident_share_pct) ? `${decimal(tourism.nights_nonresident_share_pct)} %` : t.unavailable;
  $("#city-detail").innerHTML = `<div class="capital-detail-head"><div><span class="kicker">${esc(t.detailKicker)} · ${esc(city.country_code)}</span><h2>${esc(cityName(city))}</h2><p>${esc(countryName(city))} · ${esc(flags.join(" · "))}</p></div><a href="${esc(city.landing_page_url)}" target="_blank" rel="noopener">${esc(t.officialSource)}</a></div>
    <div class="capital-detail-grid"><article><span>${esc(t.budgetLabel)}</span><strong>${esc(money(city))}</strong><small>${esc(t.period)} ${esc(city.period)} · ${esc(city.status.replaceAll("_", " "))}</small></article><article><span>${esc(t.populationLabel)}</span><strong>${esc(compactNumber(population.value))}</strong><small>${esc(t.referenceYear)} ${esc(population.reference_year)} · ${esc(population.geography_name)}</small></article><article><span>${esc(t.nightsLabel)}</span><strong>${esc(compactNumber(tourism.nights_total))}</strong><small>${esc(t.referenceYear)} ${esc(tourism.reference_year)} · ${esc(tourism.geography_name)}</small></article><article><span>${esc(t.foreignShareLabel)}</span><strong>${esc(foreignShare)}</strong><small>${esc(decimal(tourism.nights_per_resident))} ${esc(t.thIntensity.toLocaleLowerCase(locale()))}</small></article></div>
    <div class="capital-lineage"><div><h3>${esc(t.exactScope)}</h3></div><div><p>${esc(city.scope)}</p><hr><p>${esc(city.notes)}</p></div><div><h3>${esc(t.lineage)}</h3></div><div><p><strong>${esc(city.source_name)}</strong><br><code>${esc(city.measure)} · ${esc(city.amount_precision)}</code></p></div></div>`;
}

function render() {
  translate(); if (!state.data) return;
  $("#stat-cities").textContent = state.data.coverage.city_count;
  $("#stat-currencies").textContent = new Set(state.data.cities.map((city) => city.currency_code)).size;
  renderTable(); if (state.selected) renderDetail(state.data.cities.find((city) => city.city_id === state.selected));
}

function bindControls() {
  $("#capital-search").addEventListener("input", (event) => { state.query = event.target.value; renderTable(); });
  $("#capital-sort").addEventListener("change", (event) => { state.sort = event.target.value; renderTable(); });
  $("#capital-coverage").addEventListener("change", (event) => { state.coverage = event.target.value; renderTable(); });
  document.querySelectorAll("[data-currency]").forEach((button) => button.addEventListener("click", () => { state.currency = button.dataset.currency; document.querySelectorAll("[data-currency]").forEach((item) => item.classList.toggle("active", item === button)); renderTable(); if (state.selected) renderDetail(state.data.cities.find((city) => city.city_id === state.selected)); }));
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => { state.lang = button.dataset.lang; localStorage.setItem("psd-lang", state.lang); const url = new URL(location.href); url.searchParams.set("lang", state.lang); history.replaceState(null, "", `${url.pathname}?${url.searchParams}${url.hash}`); render(); }));
}

fetch(DATA_URL).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => { state.data = data; bindControls(); render(); selectCity(state.lang === "cs" ? "prague-cz" : "amsterdam-nl"); }).catch((error) => { console.error(error); $("#capital-table-body").innerHTML = `<tr><td colspan="6">Data could not be loaded.</td></tr>`; });
