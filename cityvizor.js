(() => {
  "use strict";

  const PAGE_SIZE = 50;
  const state = { index: null, codelists: {}, profile: null, profileData: null, year: null, payload: null, payments: [], filtered: [], page: 1, language: "cs" };
  const $ = (id) => document.getElementById(id);
  const copy = {
    cs: {
      breadcrumb: "Drobečková navigace", municipalities: "České obce", eyebrow: "Česko · fakturační pohled CityVizoru", title: "Řádky fakturačního pohledu CityVizoru", titleLead: "Řádky fakturačního pohledu", titleAccent: "CityVizoru",
      intro: "Projděte řádky fakturačního pohledu CityVizoru podle roku, protistrany, částky a klasifikace. Řádek není účtenkou a nemusí být unikátní fakturou ani potvrzením bankovní úhrady.", profileSearchLabel: "Najít organizaci", profileSearchPlaceholder: "Název nebo IČO…", clear: "Vymazat", organizations: "Organizace",
      year: "Rok", openSource: "Otevřít v CityVizoru ↗", summary: "Souhrn vybraných záznamů", records: "Řádky fakturačního pohledu", expenditure: "Výdaje", income: "Příjmy", counterparties: "Protistrany", sumDisplayed: "součet vybraných řádků", uniqueNamesIds: "unikátní názvy nebo identifikátory",
      overviewKicker: "Složení výdajů", overviewTitle: "Největší rozpočtové skupiny", overviewCopy: "Výdaje seskupené podle paragrafu. Sloupec ukazuje podíl na právě vybraných záznamech.",
      layersKicker: "Celý profil", layersTitle: "Rozpočet, účetnictví a akce", layersCopy: "Každá záložka zachovává význam původní vrstvy CityVizoru. Účetní obraty, rozpočtové plány, akce a platby se překrývají a nesčítají se.", layers: "Datové vrstvy CityVizoru", accounting: "Účetnictví", events: "Akce a projekty", plans: "Plány organizace",
      accountingDefinition: "Účetní nebo rozpočtové řádky v klasifikaci zdroje. Plán, upravený rozpočet a skutečnost zůstávají oddělené.", eventsDefinition: "Akce a projekty jsou analytické štítky zdroje. Jejich částky mohou být obsaženy také v účetnictví a platbách.", plansDefinition: "Plán ukazuje zamýšlené rozpočtové nebo akruální hodnoty příspěvkové organizace. Nejde o uskutečněné platby.",
      stage: "Typ", account: "Účet / položka", value: "Hodnota", unit: "Jednotka", incomeActual: "Příjem · skutečnost", incomeBudget: "Příjem · rozpočet", expenditureActual: "Výdaj · skutečnost", expenditureBudget: "Výdaj · rozpočet", notices: "Úřední deska", noticesDefinition: "Metadata veřejné úřední desky jsou samostatná publikační vrstva. Odkazy vedou na zdrojové dokumenty; nejde o účetní záznamy.", noNotices: "Tento profil v archivním snímku nemá záznamy úřední desky.", openDocument: "Otevřít dokument ↗", noAccounting: "Tento profil pro vybraný rok nezveřejnil účetní řádky.", noEvents: "Tento profil pro vybraný rok nezveřejnil akce ani projekty.", noPlans: "Tento profil pro vybraný rok nezveřejnil plán organizace.",
      paymentsKicker: "Fakturační pohled", paymentsTitle: "Řádky a jejich rozúčtování", paymentsCopy: "Řádky pocházejí z fakturačního pohledu CityVizoru. Nejde o unikátní faktury ani potvrzení bankovní úhrady. Filtry se kombinují; částky zachovávají původní znaménka.", searchPayment: "Protistrana nebo popis", searchPaymentPlaceholder: "Název, identifikátor, účel…", direction: "Typ částky", allDirections: "Příjmy i výdaje", expenditureOnly: "Pouze výdaje", incomeOnly: "Pouze příjmy", dateFrom: "Datum od", dateTo: "Datum do", amountMin: "Částka od", amountMax: "Částka do", paragraph: "Paragraf", item: "Položka", pboItem: "Účet", event: "Akce / organizace", all: "Vše", resetFilters: "Zrušit filtry", sort: "Řazení", newest: "Nejnovější", oldest: "Nejstarší", largest: "Nejvyšší částka", smallest: "Nejnižší částka", date: "Datum", counterparty: "Protistrana", description: "Popis", classification: "Klasifikace", noPayments: "Žádný záznam neodpovídá zvoleným filtrům.", pagination: "Stránkování plateb", previous: "← Předchozí", next: "Další →",
      methodKicker: "Jak data číst", methodTitle: "Řádek nepotvrzuje bankovní úhradu", definitionRecord: "Řádek fakturačního pohledu", definitionRecordCopy: "Řádek fakturačního pohledu CityVizoru může být účetním rozúčtováním. Není identifikátorem unikátní faktury ani potvrzením bankovní úhrady.", definitionAmounts: "Příjem a výdaj", definitionAmountsCopy: "Částky zachovávají členění zdroje. Nulová hodnota není chybějící údaj. Příjmy a výdaje nesčítáme do jedné hodnoty.", definitionOverlap: "Překryv dat", definitionOverlapCopy: "Rozpočty, účetnictví, plány, platby a smlouvy se mohou vztahovat ke stejné ekonomické události. Jejich součty se nesčítají.", sourceNote: "Zdroj: veřejné exporty CityVizor. Zobrazená data jsou archivním snímkem; živý zdroj se může změnit.", sourceCatalogue: "Katalog zdrojů a kontrolní součty →", sourceArchive: "Celý zdrojový archiv ZIP →", normalizedArchive: "Normalizovaná data TAR.GZ →", startKicker: "Začněte organizací", startTitle: "Vyhledejte obec nebo její organizaci", startCopy: "Průzkumník zobrazí veřejnou strukturu profilu po jednotlivých letech. Dostupnost účetnictví, akcí, plánů a plateb se mezi organizacemi liší.",
      loadingIndex: "Načítám seznam organizací…", indexError: "Seznam organizací se nepodařilo načíst.", loadingYear: "Načítám záznamy za rok {year}…", shardError: "Data tohoto profilu a roku se nepodařilo načíst.", loaded: "Archivní snímek · {year} · načteno {records} řádků fakturačního pohledu", profileMatches: "Nalezeno organizací: {count}", profilePrompt: "Začněte psát název nebo IČO. V katalogu je {count} profilů.", municipality: "Samospráva", pbo: "Příspěvková organizace", id: "IČO", counterpartyIdentifier: "Identifikátor", availableYears: "dostupné roky", selectedRecords: "Vybráno {shown} z {total} záznamů", page: "Strana {page} z {pages}", rows: "{count} řádků", categoriesUnavailable: "Pro vybrané záznamy nejsou výdaje s rozpočtovým paragrafem.", uncategorized: "Bez uvedeného paragrafu", actual: "Skutečnost", plan: "Plán", adjusted: "Upravený rozpočet", currency: "CZK", noDescription: "Bez popisu", unknownCounterparty: "Neuvedená protistrana", code: "Kód", openProfile: "Otevřít profil", damagedText: "Zdroj obsahuje poškozený znak"
    },
    en: {
      breadcrumb: "Breadcrumb", municipalities: "Czech municipalities", eyebrow: "Czechia · CityVizor invoice view", title: "CityVizor invoice-view rows", titleLead: "Invoice-view rows", titleAccent: "in CityVizor",
      intro: "Explore CityVizor invoice-view rows by year, counterparty, amount and classification. A row is not a receipt and need not be a unique invoice or confirmation of a bank payment.", profileSearchLabel: "Find an organization", profileSearchPlaceholder: "Name or organization ID…", clear: "Clear", organizations: "Organizations",
      year: "Year", openSource: "Open in CityVizor ↗", summary: "Selected records summary", records: "Invoice-view rows", expenditure: "Expenditure", income: "Income", counterparties: "Counterparties", sumDisplayed: "sum of selected rows", uniqueNamesIds: "unique names or identifiers",
      overviewKicker: "Expenditure composition", overviewTitle: "Largest budget groups", overviewCopy: "Expenditure grouped by budget paragraph. Each bar is a share of the currently selected records.",
      layersKicker: "Complete profile", layersTitle: "Budget, accounts and events", layersCopy: "Each tab retains the meaning of its native CityVizor layer. Accounting turnover, budget plans, events and payments overlap and must not be added together.", layers: "CityVizor data layers", accounting: "Accounting", events: "Events and projects", plans: "Organization plans",
      accountingDefinition: "Accounting or budget rows in the source classification. Plan, adjusted budget and actual remain separate.", eventsDefinition: "Events and projects are analytical source labels. Their amounts may also appear in accounting and payment records.", plansDefinition: "A plan shows intended budget or accrual values for a municipal organization. It does not represent completed payments.",
      stage: "Type", account: "Account / item", value: "Value", unit: "Unit", incomeActual: "Income · actual", incomeBudget: "Income · budget", expenditureActual: "Expenditure · actual", expenditureBudget: "Expenditure · budget", notices: "Noticeboard", noticesDefinition: "Public noticeboard metadata is a separate publication layer. Links open the source documents; these are not accounting records.", noNotices: "This profile has no noticeboard records in the archived snapshot.", openDocument: "Open document ↗", noAccounting: "This profile published no accounting rows for the selected year.", noEvents: "This profile published no events or projects for the selected year.", noPlans: "This profile published no organization plan for the selected year.",
      paymentsKicker: "Invoice view", paymentsTitle: "Rows and their allocations", paymentsCopy: "These rows come from CityVizor's invoice view. They are neither unique invoices nor confirmations of bank payment. Filters combine and amounts retain their source signs.", searchPayment: "Counterparty or description", searchPaymentPlaceholder: "Name, identifier, purpose…", direction: "Amount type", allDirections: "Income and expenditure", expenditureOnly: "Expenditure only", incomeOnly: "Income only", dateFrom: "Date from", dateTo: "Date to", amountMin: "Amount from", amountMax: "Amount to", paragraph: "Paragraph", item: "Item", pboItem: "Account", event: "Event / organization", all: "All", resetFilters: "Reset filters", sort: "Sort", newest: "Newest", oldest: "Oldest", largest: "Largest amount", smallest: "Smallest amount", date: "Date", counterparty: "Counterparty", description: "Description", classification: "Classification", noPayments: "No record matches the selected filters.", pagination: "Payment pagination", previous: "← Previous", next: "Next →",
      methodKicker: "How to read the data", methodTitle: "A row does not confirm bank payment", definitionRecord: "Invoice-view row", definitionRecordCopy: "A row from CityVizor's invoice view can be an accounting allocation. It is neither a unique invoice identifier nor confirmation of bank payment.", definitionAmounts: "Income and expenditure", definitionAmountsCopy: "Amounts retain the source structure. A zero is not a missing value. Income and expenditure are not combined into one total.", definitionOverlap: "Overlapping data", definitionOverlapCopy: "Budgets, accounting, plans, payments and contracts can describe the same economic event. Their totals must not be added together.", sourceNote: "Source: public CityVizor exports. Displayed data is an archived snapshot; the live source can change.", sourceCatalogue: "Source catalogue and checksums →", sourceArchive: "Complete source archive ZIP →", normalizedArchive: "Normalized data TAR.GZ →", startKicker: "Start with an organization", startTitle: "Search for a municipality or its organization", startCopy: "The explorer shows each public profile by year. Availability of accounting, events, plans and payments differs between organizations.",
      loadingIndex: "Loading organizations…", indexError: "The organization list could not be loaded.", loadingYear: "Loading records for {year}…", shardError: "Data for this profile and year could not be loaded.", loaded: "Archived snapshot · {year} · loaded {records} invoice-view rows", profileMatches: "Organizations found: {count}", profilePrompt: "Start typing a name or organization ID. The catalogue has {count} profiles.", municipality: "Municipality or region", pbo: "Municipal organization", id: "ID", counterpartyIdentifier: "Identifier", availableYears: "available years", selectedRecords: "Selected {shown} of {total} records", page: "Page {page} of {pages}", rows: "{count} rows", categoriesUnavailable: "Selected records have no expenditure with a budget paragraph.", uncategorized: "No paragraph supplied", actual: "Actual", plan: "Plan", adjusted: "Adjusted budget", currency: "CZK", noDescription: "No description", unknownCounterparty: "Counterparty not supplied", code: "Code", openProfile: "Open profile", damagedText: "The source contains a damaged character"
    }
  };

  const text = (key, values = {}) => String(copy[state.language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
  const number = (value) => new Intl.NumberFormat(state.language === "en" ? "en-GB" : "cs-CZ").format(Number(value) || 0);
  const money = (value) => new Intl.NumberFormat(state.language === "en" ? "en-GB" : "cs-CZ", { style: "currency", currency: "CZK", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const normalizeText = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const slugify = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const read = (object, ...keys) => {
    for (const key of keys) {
      const value = key.split(".").reduce((current, part) => current?.[part], object);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  };
  const asNumber = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.+-]/g, "");
    return Number(cleaned) || 0;
  };
  const rows = (payload, name) => {
    const candidate = payload?.[name] ?? payload?.datasets?.[name] ?? payload?.data?.[name];
    if (Array.isArray(candidate)) return candidate;
    return [candidate?.rows, candidate?.records, candidate?.items].find(Array.isArray) || [];
  };
  const profileSlug = (profile) => profile.key || profile.data_slug || profile.slug || `${new URL(profile.instance || "https://cityvizor.cz").hostname}-${profile.id}`;
  const yearValue = (year) => Number(typeof year === "object" ? year.year : year);

  function applyLanguage() {
    state.language = document.documentElement.lang === "en" ? "en" : "cs";
    document.title = `${text("title")} — Public Spending Data`;
    document.querySelectorAll("[data-copy]").forEach((node) => { node.textContent = text(node.dataset.copy); });
    document.querySelectorAll("[data-copy-placeholder]").forEach((node) => { node.placeholder = text(node.dataset.copyPlaceholder); });
    document.querySelectorAll("[data-copy-aria]").forEach((node) => { node.setAttribute("aria-label", text(node.dataset.copyAria)); });
    document.querySelectorAll("[data-lang-link]").forEach((node) => {
      const url = new URL(node.href, location.href); url.searchParams.set("lang", state.language); node.href = url.href;
    });
    updateItemTerminology();
    if (state.index) renderProfileResults();
    if (state.payload) { renderLayers(); renderAll(); }
  }

  function normalizeProfiles(index) {
    return (index.profiles || []).map((profile) => ({
      ...profile,
      name: profile.name || profile.profile_name || "—",
      ico: profile.ico || profile.organization_id || "",
      type: profile.type || profile.profile_type || "municipality",
      years: profile.years || profile.available_years || [],
      data_slug: profile.data_slug || profile.slug || null
    }));
  }

  async function loadIndex() {
    $("profile-result-count").textContent = text("loadingIndex");
    try {
      const response = await fetch("/public-data/cityvizor/index");
      if (!response.ok) throw new Error(String(response.status));
      const value = await response.json();
      if (!Array.isArray(value.profiles)) throw new Error("Invalid CityVizor index");
      state.index = { ...value, profiles: normalizeProfiles(value) };
      await loadCodelists(); renderProfileResults(); openFromUrl();
    } catch (_) { $("profile-result-count").textContent = text("indexError"); }
  }

  async function loadCodelists() {
    try {
      const response = await fetch("/public-data/cityvizor/codelists");
      if (response.ok) { const payload = await response.json(); state.codelists = payload.codelists || {}; return; }
    } catch (_) { /* labels remain optional; source codes are still displayed */ }
    state.codelists = {};
  }

  function codeLabel(kind, code) {
    if (!code) return ""; const year = Number(state.year); const dictionary = kind === "items" && state.profile?.type === "pbo" ? "pbo-su" : kind; const records = state.codelists[dictionary] || [];
    const record = records.find((item) => String(item.id) === String(code) && (!item.validFrom || Number(String(item.validFrom).slice(0, 4)) <= year) && (!item.validTill || Number(String(item.validTill).slice(0, 4)) >= year));
    return record?.name || "";
  }

  function profilePaymentCount(profile) {
    const indexed = read(profile, "record_counts.payments");
    if (indexed !== null) return asNumber(indexed);
    return (profile.years || []).reduce((sum, year) => sum + asNumber(read(year, "records.payments", "payment_rows", "payments")), asNumber(profile.pbo_payment_rows));
  }

  function renderProfileResults() {
    if (!state.index) return;
    const query = normalizeText($("profile-query").value.trim());
    const allMatches = state.index.profiles
      .filter((profile) => !query || normalizeText(`${profile.name} ${profile.ico} ${profile.instance || ""}`).includes(query))
      .sort((a, b) => profilePaymentCount(b) - profilePaymentCount(a) || a.name.localeCompare(b.name, state.language));
    const matches = allMatches.slice(0, query ? 40 : 12);
    $("profile-result-count").textContent = query ? text("profileMatches", { count: number(allMatches.length) }) : text("profilePrompt", { count: number(state.index.profile_count || state.index.profiles.length) });
    const list = $("profile-results"); list.replaceChildren();
    matches.forEach((profile) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "cv-profile-result"; button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(profile === state.profile));
      const strong = document.createElement("strong"); strong.textContent = profile.name;
      const small = document.createElement("small"); small.textContent = `${text(profile.type === "pbo" ? "pbo" : "municipality")} · ${text("id")} ${profile.ico || "—"}`;
      const count = document.createElement("span"); count.textContent = number(profilePaymentCount(profile)); count.title = text("records");
      button.append(strong, small, count); button.addEventListener("click", () => selectProfile(profile)); list.append(button);
    });
  }

  function openFromUrl() {
    const params = new URLSearchParams(location.search); const wanted = params.get("profile") || params.get("ico");
    if (!wanted || !state.index) return;
    const profile = state.index.profiles.find((item) => [profileSlug(item), item.key, String(item.id), item.ico].includes(wanted));
    if (profile) selectProfile(profile, Number(params.get("year")) || null, true);
  }

  function availableYears(profile) {
    return (profile.years || []).map(yearValue).filter(Number.isFinite).sort((a, b) => b - a);
  }

  function selectProfile(profile, requestedYear = null, push = true) {
    state.profile = profile; state.profileData = null; renderProfileResults();
    updateItemTerminology();
    $("profile-name").textContent = profile.name;
    $("profile-kind").textContent = text(profile.type === "pbo" ? "pbo" : "municipality");
    $("profile-meta").textContent = `${text("id")} ${profile.ico || "—"} · ${new URL(profile.instance || profile.profile_url || "https://cityvizor.cz").hostname}`;
    $("profile-source").href = profile.profile_url || profile.instance || "https://cityvizor.cz";
    const years = availableYears(profile); const selected = years.includes(requestedYear) ? requestedYear : years[0];
    const select = $("profile-year"); select.replaceChildren(); years.forEach((year) => { const option = new Option(String(year), String(year)); select.add(option); });
    select.value = String(selected || ""); $("welcome").hidden = true; $("explorer").hidden = false;
    if (selected) loadYear(selected, push); else showLoadError();
  }

  function itemTerm() { return text(state.profile?.type === "pbo" ? "pboItem" : "item"); }

  function updateItemTerminology() {
    const label = $("filter-item-label"); if (label) label.textContent = itemTerm();
  }

  async function fetchYear(profile, year) {
    if (!profile.key) throw new Error("Missing normalized CityVizor profile key");
    const profileUrl = `/public-data/cityvizor/profile?key=${encodeURIComponent(profile.key)}&year=${year}`;
    const response = await fetch(profileUrl); if (!response.ok) throw new Error(`${response.status} ${profileUrl}`); state.profileData = await response.json();
    const selected = (state.profileData.years || []).find((item) => Number(item.year) === Number(year));
    if (!selected) throw new Error("Year is missing from the profile response");
    const result = { profile_year: selected, notices: state.profileData.noticeboard, contracts: state.profileData.contracts };
    for (const kind of ["accounting", "events", "plans", "payments"]) {
      const assets = selected.assets?.[kind] || [];
      const shards = await Promise.all(assets.map(async (asset, index) => {
        const part = asset.part || index + 1; const url = `/public-data/cityvizor/shard?key=${encodeURIComponent(profile.key)}&year=${year}&layer=${kind}&part=${part}`;
        const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json();
      }));
      result[kind] = shards.flatMap(expandColumnRows);
    }
    return result;
  }

  function expandColumnRows(shard) {
    if (!Array.isArray(shard?.rows)) return [];
    if (!Array.isArray(shard.columns)) return shard.rows;
    return shard.rows.map((values) => Object.fromEntries(shard.columns.map((column, index) => [column, values[index]])));
  }

  async function loadYear(year, push = true) {
    state.year = Number(year); state.profileData = null; state.payload = null; state.payments = []; state.filtered = []; state.page = 1;
    $("data-status").classList.remove("is-error"); $("data-status").textContent = text("loadingYear", { year });
    if (push) updateUrl();
    try {
      state.payload = await fetchYear(state.profile, year);
      state.payments = rows(state.payload, "payments").map(normalizePayment);
      populateFilters(); renderLayers(); applyFilters();
      $("data-status").textContent = text("loaded", { year, records: number(state.payments.length) });
    } catch (_) { showLoadError(); }
  }

  function showLoadError() {
    $("data-status").classList.add("is-error"); $("data-status").textContent = text("shardError");
    state.payload = {}; state.payments = []; populateFilters(); renderLayers(); applyFilters();
  }

  function normalizePayment(row) {
    const direction = String(read(row, "direction", "type", "payment_type") || "").toLowerCase();
    let income = read(row, "income_cents") !== null ? asNumber(row.income_cents) / 100 : asNumber(read(row, "income", "income_czk", "amount_income", "prijem", "prijmy"));
    let expenditure = read(row, "expenditure_cents") !== null ? asNumber(row.expenditure_cents) / 100 : asNumber(read(row, "expenditure", "expenditure_czk", "amount_expenditure", "vydaj", "vydaje"));
    const generic = asNumber(read(row, "amount", "amount_czk", "value"));
    if (!income && !expenditure && generic) direction.includes("income") || direction.includes("prij") ? income = generic : expenditure = generic;
    const paragraphCode = read(row, "paragraph.code", "paragraph_code", "paragraph", "paragraf", "paragraf_code") || "";
    const paragraphName = read(row, "paragraph.name", "paragraph_name", "paragraf_name") || codeLabel("paragraphs", paragraphCode);
    const itemCode = read(row, "item.code", "item_code", "item", "polozka", "polozka_code") || "";
    const itemName = read(row, "item.name", "item_name", "polozka_name") || codeLabel("items", itemCode);
    const event = read(row, "event.name", "event_name", "event", "akce", "organization_unit", "organizational_unit") || "";
    const counterparty = read(row, "counterparty.name", "counterparty_name", "partner_name", "recipient_name", "supplier_name", "protistrana", "nazev_protistrany") || "";
    const counterpartyId = read(row, "counterparty.ico", "counterparty.id", "counterparty_id", "partner_id", "recipient_ico", "supplier_ico", "ico_protistrany") || "";
    return { raw: row, date: String(read(row, "date", "payment_date", "accounting_date", "datum") || ""), counterparty: String(counterparty), counterpartyId: String(counterpartyId), description: String(read(row, "description", "purpose", "note", "message", "popis", "ucel") || ""), income, expenditure, paragraphCode: String(paragraphCode), paragraphName: String(paragraphName), itemCode: String(itemCode), itemName: String(itemName), event: String(event) };
  }

  function populateFilters() {
    const fields = [["filter-paragraph", "paragraphCode", "paragraphName"], ["filter-item", "itemCode", "itemName"], ["filter-event", "event", null]];
    fields.forEach(([id, codeKey, nameKey]) => {
      const select = $(id); const current = select.value; select.replaceChildren(new Option(text("all"), ""));
      const values = new Map(); state.payments.forEach((row) => { const code = row[codeKey]; if (code) values.set(code, nameKey && row[nameKey] ? `${code} · ${row[nameKey]}` : code); });
      [...values].sort((a, b) => a[1].localeCompare(b[1], state.language, { numeric: true })).forEach(([value, label]) => select.add(new Option(label, value)));
      if (values.has(current)) select.value = current;
    });
  }

  function applyFilters() {
    const query = normalizeText($("filter-query").value); const direction = $("filter-direction").value; const from = $("filter-from").value; const to = $("filter-to").value;
    const min = $("filter-min").value === "" ? null : Number($("filter-min").value); const max = $("filter-max").value === "" ? null : Number($("filter-max").value);
    const paragraph = $("filter-paragraph").value; const item = $("filter-item").value; const event = $("filter-event").value;
    state.filtered = state.payments.filter((row) => {
      const amount = Math.max(Math.abs(row.income), Math.abs(row.expenditure));
      return (!query || normalizeText(`${row.counterparty} ${row.counterpartyId} ${row.description}`).includes(query)) &&
        (!direction || (direction === "income" ? row.income !== 0 : row.expenditure !== 0)) && (!from || row.date >= from) && (!to || row.date <= to) &&
        (min === null || amount >= min) && (max === null || amount <= max) && (!paragraph || row.paragraphCode === paragraph) && (!item || row.itemCode === item) && (!event || row.event === event);
    });
    sortPayments(); state.page = 1; renderAll();
  }

  function sortPayments() {
    const sort = $("payment-sort").value; const amount = (row) => Math.max(Math.abs(row.income), Math.abs(row.expenditure));
    state.filtered.sort((a, b) => sort === "date-asc" ? a.date.localeCompare(b.date) : sort === "amount-desc" ? amount(b) - amount(a) : sort === "amount-asc" ? amount(a) - amount(b) : b.date.localeCompare(a.date));
  }

  function renderAll() { renderKpis(); renderCategories(); renderPayments(); }

  function renderKpis() {
    const expenditure = state.filtered.reduce((sum, row) => sum + row.expenditure, 0); const income = state.filtered.reduce((sum, row) => sum + row.income, 0);
    const counterparties = new Set(state.filtered.map((row) => row.counterpartyId || normalizeText(row.counterparty)).filter(Boolean));
    $("kpi-records").textContent = number(state.filtered.length); $("kpi-records-note").textContent = text("selectedRecords", { shown: number(state.filtered.length), total: number(state.payments.length) });
    $("kpi-expenditure").textContent = money(expenditure); $("kpi-income").textContent = money(income); $("kpi-counterparties").textContent = number(counterparties.size);
    $("payment-result-count").textContent = text("selectedRecords", { shown: number(state.filtered.length), total: number(state.payments.length) });
  }

  function renderCategories() {
    const sums = new Map(); state.filtered.forEach((row) => { if (!row.expenditure) return; const key = row.paragraphCode || "—"; const current = sums.get(key) || { label: row.paragraphName || text("uncategorized"), amount: 0 }; current.amount += row.expenditure; sums.set(key, current); });
    const categories = [...sums].sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount)).slice(0, 8); const max = Math.max(0, ...categories.map(([, item]) => Math.abs(item.amount)));
    const container = $("category-bars"); container.replaceChildren();
    if (!categories.length) { const p = document.createElement("p"); p.className = "cv-empty"; p.textContent = text("categoriesUnavailable"); container.append(p); return; }
    categories.forEach(([code, item]) => { const row = document.createElement("div"); row.className = "cv-category-row"; const label = document.createElement("span"); const b = document.createElement("b"); b.textContent = item.label; const small = document.createElement("small"); small.textContent = `${text("paragraph")} ${code}`; label.append(b, small); const track = document.createElement("span"); track.className = "cv-category-track"; const bar = document.createElement("i"); bar.style.width = `${max ? Math.abs(item.amount) / max * 100 : 0}%`; track.append(bar); const value = document.createElement("strong"); value.textContent = money(item.amount); row.append(label, track, value); container.append(row); });
  }

  function renderPayments() {
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE)); state.page = Math.min(state.page, pages); const start = (state.page - 1) * PAGE_SIZE;
    const body = $("payment-rows"); body.replaceChildren(); state.filtered.slice(start, start + PAGE_SIZE).forEach((row) => {
      const tr = document.createElement("tr"); const date = document.createElement("td"); date.textContent = row.date || "—";
      const counterparty = document.createElement("td"); counterparty.textContent = row.counterparty || text("unknownCounterparty"); if (row.counterpartyId) { const small = document.createElement("small"); small.textContent = `${text("counterpartyIdentifier")} ${row.counterpartyId}`; counterparty.append(small); } markDamaged(counterparty, `${row.counterparty} ${row.counterpartyId}`);
      const description = document.createElement("td"); description.textContent = row.description || text("noDescription"); markDamaged(description, row.description);
      const classification = document.createElement("td"); classification.className = "cv-classification"; [[text("paragraph"), row.paragraphCode, row.paragraphName], [itemTerm(), row.itemCode, row.itemName], [text("event"), row.event, ""]].forEach(([label, code, name]) => { if (!code) return; const span = document.createElement("span"); span.textContent = `${label} ${code}${name ? ` · ${name}` : ""}`; classification.append(span); }); if (!classification.childNodes.length) classification.textContent = "—";
      const income = document.createElement("td"); income.textContent = row.income ? money(row.income) : "—"; const expenditure = document.createElement("td"); expenditure.textContent = row.expenditure ? money(row.expenditure) : "—";
      tr.append(date, counterparty, description, classification, income, expenditure); body.append(tr);
    });
    $("payment-empty").hidden = state.filtered.length > 0; $("page-state").textContent = text("page", { page: number(state.page), pages: number(pages) }); $("page-prev").disabled = state.page <= 1; $("page-next").disabled = state.page >= pages;
  }

  function renderLayers() {
    const accounting = rows(state.payload, "accounting"); const events = rows(state.payload, "events"); const plans = rows(state.payload, "plans"); const notices = rows(state.payload, "notices");
    renderAnnualFinance(); renderAccounting(accounting); renderEvents(events); renderPlans(plans); renderNotices(notices);
  }

  function centsMoney(value) { return money(asNumber(value) / 100); }

  function renderAnnualFinance() {
    const container = $("annual-finance"); container.replaceChildren();
    const profileYears = state.profileData?.years || (state.payload?.profile_year ? [state.payload.profile_year] : []);
    profileYears.slice().sort((a, b) => Number(b.year) - Number(a.year)).forEach((year) => {
      const totals = year.annual_finance?.recomputed_from_accounting || year.accounting?.totals || {}; const article = document.createElement("article"); if (Number(year.year) === state.year) article.className = "selected";
      const heading = document.createElement("b"); heading.textContent = String(year.year); const dl = document.createElement("dl");
      [["incomeActual", totals.income_actual_cents], ["expenditureActual", totals.expenditure_actual_cents], ["incomeBudget", totals.income_budget_cents], ["expenditureBudget", totals.expenditure_budget_cents]].forEach(([label, value]) => { const wrap = document.createElement("div"); const dt = document.createElement("dt"); dt.textContent = text(label); const dd = document.createElement("dd"); dd.textContent = centsMoney(value); wrap.append(dt, dd); dl.append(wrap); });
      article.append(heading, dl); container.append(article);
    });
  }

  function renderAccounting(items) {
    $("accounting-count").textContent = text("rows", { count: number(items.length) }); $("accounting-empty").hidden = items.length > 0; const body = $("accounting-rows"); body.replaceChildren();
    items.forEach((row) => { const tr = document.createElement("tr"); const classification = document.createElement("td"); const codes = [[text("paragraph"), row.paragraph, codeLabel("paragraphs", row.paragraph)], [itemTerm(), row.item, codeLabel("items", row.item)], [text("event"), row.event, ""], [text("unit"), row.unit, ""]].filter(([, value]) => value).map(([label, value, name]) => `${label} ${value}${name ? ` · ${name}` : ""}`); classification.textContent = codes.join(" · ") || String(read(row, "classification_name", "name", "description") || "—"); const stage = document.createElement("td"); stage.textContent = String(read(row, "type", "stage", "value_type", "budget_stage") || "—"); const values = ["income_actual_cents", "income_budget_cents", "expenditure_actual_cents", "expenditure_budget_cents"].map((key) => { const td = document.createElement("td"); td.textContent = centsMoney(row[key]); return td; }); tr.append(classification, stage, ...values); body.append(tr); });
  }

  function renderEvents(items) {
    $("events-count").textContent = text("rows", { count: number(items.length) }); $("events-empty").hidden = items.length > 0; const container = $("event-cards"); container.replaceChildren();
    items.forEach((row) => { const article = document.createElement("article"); const code = document.createElement("span"); code.textContent = String(read(row, "event", "code", "id", "event_id") || text("event")); const title = document.createElement("h4"); title.textContent = String(read(row, "name", "title", "description") || "—"); markDamaged(title, title.textContent); const description = document.createElement("p"); description.textContent = `${text("incomeActual")}: ${centsMoney(row.income_actual_cents)} · ${text("expenditureActual")}: ${centsMoney(row.expenditure_actual_cents)}`; const amount = document.createElement("strong"); amount.textContent = `${text("incomeBudget")}: ${centsMoney(row.income_budget_cents)} · ${text("expenditureBudget")}: ${centsMoney(row.expenditure_budget_cents)}`; article.append(code, title, description, amount); container.append(article); });
  }

  function renderPlans(items) {
    $("plans-count").textContent = text("rows", { count: number(items.length) }); $("plans-empty").hidden = items.length > 0; const body = $("plan-rows"); body.replaceChildren();
    items.forEach((row) => { const tr = document.createElement("tr"); const account = document.createElement("td"); account.textContent = String(read(row, "analytic_label", "account_name", "item_name", "name", "description") || "—"); const small = document.createElement("small"); small.textContent = [row.synthetic_account, row.analytic_account].filter(Boolean).join(" / "); if (small.textContent) account.append(small); const values = ["income_actual_cents", "income_budget_cents", "expenditure_actual_cents", "expenditure_budget_cents"].map((key) => { const td = document.createElement("td"); td.textContent = centsMoney(row[key]); return td; }); tr.append(account, ...values); body.append(tr); });
  }

  function renderNotices(items) {
    $("notices-count").textContent = text("rows", { count: number(items.length) }); $("notices-empty").hidden = items.length > 0; const container = $("notice-cards"); container.replaceChildren();
    items.forEach((row) => { const article = document.createElement("article"); const date = document.createElement("span"); date.textContent = row.date || "—"; const title = document.createElement("h4"); title.textContent = row.title || "—"; markDamaged(title, title.textContent); const category = document.createElement("p"); category.textContent = row.category || ""; const link = document.createElement("a"); link.href = row.document_url || row.edesky_url || row.preview_url || "#"; link.target = "_blank"; link.rel = "noopener"; link.textContent = text("openDocument"); article.append(date, title, category, link); container.append(article); });
  }

  function markDamaged(node, value) { if (!String(value || "").includes("�")) return; const warning = document.createElement("small"); warning.className = "cv-damaged-text"; warning.textContent = `⚠ ${text("damagedText")}`; node.append(warning); }

  function stageLabel(value) { const key = normalizeText(value); if (key.includes("adjust") || key.includes("upraven")) return text("adjusted"); if (key.includes("plan") || key.includes("schval")) return text("plan"); if (key.includes("actual") || key.includes("skutec")) return text("actual"); return value || "—"; }

  function updateUrl() { const url = new URL(location.href); url.searchParams.set("profile", profileSlug(state.profile)); url.searchParams.set("year", state.year); url.searchParams.set("lang", state.language); history.replaceState(null, "", url); }

  $("profile-query").addEventListener("input", renderProfileResults);
  $("profile-search").addEventListener("reset", () => setTimeout(renderProfileResults));
  $("profile-year").addEventListener("change", (event) => loadYear(event.target.value));
  $("payment-filters").addEventListener("input", applyFilters);
  $("payment-filters").addEventListener("change", applyFilters);
  $("payment-filters").addEventListener("reset", () => setTimeout(applyFilters));
  $("payment-sort").addEventListener("change", () => { sortPayments(); state.page = 1; renderPayments(); });
  $("page-prev").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderPayments(); $("payments-title").scrollIntoView(); } });
  $("page-next").addEventListener("click", () => { if (state.page * PAGE_SIZE < state.filtered.length) { state.page += 1; renderPayments(); $("payments-title").scrollIntoView(); } });
  document.querySelectorAll("[data-layer]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-layer]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    document.querySelectorAll(".cv-layer-panel").forEach((panel) => { panel.hidden = panel.id !== `panel-${button.dataset.layer}`; });
  }));
  new MutationObserver(applyLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  applyLanguage(); loadIndex();
})();
