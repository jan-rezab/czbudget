(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get("lang");
  const routeDefault = location.pathname.includes("/cz/municipalities/") ? "en" : "cs";
  // language-bootstrap.js already resolved URL param → stored preference → route
  // default. Never persist here: a merely defaulted value written on load would
  // pin this route's default as the visitor's sitewide preference.
  const lang = requested === "en" || requested === "cs" ? requested : (window.PSDLanguage?.current() || document.documentElement.lang || routeDefault);
  document.documentElement.lang = lang;
  const plzenContractSpecial = document.querySelector("[data-plzen-contract-special]");
  if (plzenContractSpecial) {
    plzenContractSpecial.href = `../../../deep-dives/plzen-contracts/?lang=${lang}`;
    plzenContractSpecial.textContent = lang === "en" ? "Special: contracts and payments ↗" : "Speciál: smlouvy a platby ↗";
  }

  const root = location.pathname.includes("/cz/municipalities/") || location.pathname.includes("/cz/obce/") || location.pathname.includes("/cz/kraje/")
    ? (location.pathname.split("/").filter(Boolean).length > 2 ? "../../../" : "../../")
    : "../../";
  if (!document.querySelector('link[href*="section-rail"]')) {
    const railStyles = document.createElement("link");
    railStyles.rel = "stylesheet"; railStyles.href = `${root}styles.css?v=20260822-section-rail`; document.head.append(railStyles);
  }
  if (!document.querySelector('link[href*="chart-system.css"]')) {
    const navigationStyles = document.createElement("link");
    navigationStyles.rel = "stylesheet";
    navigationStyles.href = `${root}chart-system.css?v=20260822-municipal-nav`;
    document.head.append(navigationStyles);
  }
  const header = document.querySelector("psd-site-header");

  const main = document.querySelector("main");
  if (main && !document.querySelector(".context-rail")) {
    const labels = lang === "en"
      ? { overview:"Overview", combined:"Combined", entities:"Entities", trend:"Trend", budget:"Budget", breakdown:"Breakdown", method:"Method" }
      : { overview:"Přehled", combined:"Součet", entities:"Subjekty", trend:"Vývoj", budget:"Rozpočet", breakdown:"Členění", method:"Metodika" };
    const firstSection = main.querySelector("section"); if (firstSection && !firstSection.id) firstSection.id = "overview";
    const combined = document.querySelector(".territorial-stack"); if (combined) combined.id = "combined";
    const directory = document.querySelector(".directory"); if (directory && !directory.id) directory.id = "entities";
    const budget = document.querySelector("#rozpocet");
    const history = document.querySelector("#history-explorer") || document.querySelector("#municipal-history-explorer");
    const method = document.querySelector("#metodika");
    const items = [["overview",labels.overview],["combined",labels.combined],[history?.id,labels.trend],[budget?.id,labels.budget],[directory?.id,labels.entities],[method?.id,labels.method]].filter(([id]) => id && document.getElementById(id));
    const rail = document.createElement("nav"); rail.className = "context-rail municipal-context-rail"; rail.setAttribute("aria-label", lang === "en" ? "Page sections" : "Sekce stránky");
    rail.innerHTML = items.map(([id,label]) => `<a href="#${id}">${label}</a>`).join("");
    const railAnchor = header;
    if (railAnchor) railAnchor.insertAdjacentElement("afterend", rail);
    else main.insertAdjacentElement("beforebegin", rail);
    const updateRail = () => {
      const current = [...items].reverse().map(([id]) => document.getElementById(id)).find((section) => section.getBoundingClientRect().top <= 150) || document.getElementById(items[0]?.[0]);
      rail.querySelectorAll("a").forEach((link) => link.toggleAttribute("aria-current", link.hash === `#${current?.id}`));
    };
    addEventListener("scroll", updateRail, { passive:true }); updateRail();
  }

  document.querySelectorAll(".territorial-stack .layer-row").forEach((row, index, rows) => {
    row.classList.add(index === rows.length - 1 ? "combined-layer" : index === 0 ? "municipal-layer" : "region-layer");
    const label = document.createElement("small"); label.className = "consolidation-badge";
    label.textContent = index === rows.length - 1
      ? (lang === "en" ? "Deduplicated view · Prague once" : "Deduplikovaný pohled · Praha jednou")
      : index === 0 ? (lang === "en" ? "Municipal layer" : "Obecní vrstva") : (lang === "en" ? "Regional layer" : "Krajská vrstva");
    row.querySelector(":scope > div")?.append(label);
  });

  const currencyRates = { CZK: 1, EUR: 1 / 24.179, USD: 1.1576 / 24.179 };
  const allowedCurrencies = Object.keys(currencyRates);
  let storedCurrency = null;
  try { storedCurrency = localStorage.getItem("psd-municipal-currency"); } catch {}
  const isDetailPage = document.body.classList.contains("detail-page");
  let selectedCurrency = isDetailPage && allowedCurrencies.includes(storedCurrency) ? storedCurrency : "CZK";
  const locale = lang === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const currencySymbol = { CZK: lang === "en" ? "CZK" : "Kč", EUR: "€", USD: "$" };
  const formatMunicipalMoney = (czk, { adaptive = false } = {}) => {
    if (!Number.isFinite(czk)) return "—";
    const converted = czk * currencyRates[selectedCurrency];
    const absolute = Math.abs(converted);
    const sign = converted < 0 ? "−" : "";
    let divisor = 1, suffix = "";
    if (adaptive && absolute >= 1e9) { divisor = 1e9; suffix = lang === "en" ? "bn" : " mld."; }
    else if (adaptive && absolute >= 1e6) { divisor = 1e6; suffix = lang === "en" ? "m" : " mil."; }
    else if (adaptive && absolute >= 1e3) { divisor = 1e3; suffix = lang === "en" ? "k" : " tis."; }
    const formatted = number(absolute / divisor, divisor === 1 ? 0 : 1);
    if (lang === "en") return `${sign}${selectedCurrency === "CZK" ? "CZK " : currencySymbol[selectedCurrency]}${formatted}${suffix}`;
    return `${sign}${formatted}${suffix} ${currencySymbol[selectedCurrency]}`;
  };
  window.MunicipalCurrency = {
    get current() { return selectedCurrency; },
    convert: (czk) => czk * currencyRates[selectedCurrency],
    format: formatMunicipalMoney,
    rates: { ...currencyRates },
  };

  const currencyTextNodes = [];
  const moneyPattern = /([+−-]?)(\d[\d\s]*(?:[,.]\d+)?)\s*(mld\.|mil\.)?\s*Kč/g;
  const parseCzk = (sign, raw, unit) => {
    const numeric = Number(raw.replace(/\s/g, "").replace(",", "."));
    const multiplier = unit === "mld." ? 1e9 : unit === "mil." ? 1e6 : 1;
    return (sign === "−" || sign === "-" ? -1 : 1) * numeric * multiplier;
  };
  const collectCurrencyText = () => {
    const moneyWalker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    while (moneyWalker.nextNode()) {
      const node = moneyWalker.currentNode;
      if (node.parentElement?.closest("#history-explorer,.municipal-breakdown-explorer,script,style")) continue;
      moneyPattern.lastIndex = 0;
      if (!moneyPattern.test(node.nodeValue)) continue;
      currencyTextNodes.push({ node, original: node.nodeValue });
    }
  };
  // An explicit "+" is editorial, not part of the value, so keep it.
  const formatCzkText = (value) => {
    moneyPattern.lastIndex = 0;
    return value.replace(moneyPattern, (_match, sign, raw, unit) => `${sign === "+" ? "+" : ""}${formatMunicipalMoney(parseCzk(sign, raw, unit), { adaptive: true })}`);
  };
  const refreshCurrencyText = () => {
    currencyTextNodes.forEach(({ node, original }) => { node.nodeValue = formatCzkText(original); });
  };
  const detailHero = document.querySelector(".detail-page .detail-hero");
  if (detailHero) {
    const control = document.createElement("label");
    control.className = "municipal-currency-control";
    control.innerHTML = `<span>${lang === "en" ? "Recalculate values" : "Přepočítat částky"}</span><select aria-label="${lang === "en" ? "Display currency" : "Měna zobrazení"}">${allowedCurrencies.map((currency) => `<option value="${currency}"${currency === selectedCurrency ? " selected" : ""}>${currency}</option>`).join("")}</select><small>${lang === "en" ? "Reference rates · 18 Aug 2026" : "Referenční kurzy · 18. 8. 2026"}</small>`;
    detailHero.querySelector(":scope > div")?.append(control);
    control.querySelector("select").addEventListener("change", (event) => {
      selectedCurrency = event.target.value;
      try { localStorage.setItem("psd-municipal-currency", selectedCurrency); } catch {}
      refreshCurrencyText();
      dispatchEvent(new CustomEvent("municipal-currency-change", { detail: { currency: selectedCurrency } }));
    });
  }

  const escapeBudgetHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  const renderBudgetBreakdown = (panel, entity, codebook, money) => {
    const breakdown = entity.budget_breakdown;
    if (!breakdown?.stages) return;
    const copy = lang === "en" ? {
      kicker: "Full FIN 2-12 M detail", title: "What sits behind the totals.",
      intro: "Switch between approved, amended and actual budgets. Every category reconciles to the consolidated headline above.",
      enacted: "Approved", revised: "Amended", actual: "Actual",
      purpose: "Where the city spends", purposeNote: "Functional paragraphs · purpose of expenditure",
      expense: "What the city buys", expenseNote: "Economic expenditure items",
      revenue: "Where revenue comes from", revenueNote: "Economic revenue items",
      financing: "Financing items", all: "Show every category", code: "Code", category: "Official Czech category", amount: "Amount", share: "Share",
      source: "FIN 2-12 M detail from BigQuery", method: "Internal-transfer rows and financing summary rows are excluded.",
      official: "Detailed labels use the official Czech budget classification.",
    } : {
      kicker: "Úplný detail FIN 2-12 M", title: "Co je uvnitř součtů.",
      intro: "Přepínejte mezi schváleným, upraveným a skutečným rozpočtem. Každá struktura se rovná konsolidovanému součtu výše.",
      enacted: "Schválený", revised: "Upravený", actual: "Skutečnost",
      purpose: "Kam město peníze dává", purposeNote: "Funkční paragrafy · účel výdajů",
      expense: "Za co město platí", expenseNote: "Ekonomické položky výdajů",
      revenue: "Odkud peníze přicházejí", revenueNote: "Ekonomické položky příjmů",
      financing: "Položky financování", all: "Zobrazit všechny kategorie", code: "Kód", category: "Oficiální kategorie", amount: "Částka", share: "Podíl",
      source: "Detail FIN 2-12 M z BigQuery", method: "Vnitřní převody a souhrnné řádky financování jsou vyloučeny.",
      official: "Názvy odpovídají oficiální české rozpočtové skladbě.",
    };
    const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const compact = { format: (value) => formatMunicipalMoney(value, { adaptive: true }) };
    const nameFor = (dimension, code) => codebook.dimensions?.[dimension]?.[code]?.[lang] || codebook.dimensions?.[dimension]?.[code]?.cs || `${copy.code} ${code}`;
    const panelMarkup = (title, note, entries, dimension, total) => {
      const maximum = Math.max(...entries.map(([, amount]) => Math.abs(amount)), 1);
      const rows = entries.slice(0, 9).map(([code, amount]) => {
        const ratio = total ? amount / total * 100 : 0;
        return `<div class="breakdown-rank-row"><div class="breakdown-rank-label"><code>${escapeBudgetHtml(code)}</code><strong>${escapeBudgetHtml(nameFor(dimension, code))}</strong><span>${compact.format(amount)} · ${percent.format(ratio)} %</span></div><div class="breakdown-rank-track"><i style="width:${Math.min(100, Math.abs(amount) / maximum * 100).toFixed(2)}%"></i></div></div>`;
      }).join("");
      const tableRows = entries.map(([code, amount]) => `<tr><td><code>${escapeBudgetHtml(code)}</code></td><th scope="row">${escapeBudgetHtml(nameFor(dimension, code))}</th><td>${money.format(amount)}</td><td>${total ? `${percent.format(amount / total * 100)} %` : "—"}</td></tr>`).join("");
      return `<article class="budget-breakdown-panel"><header><div><span>${escapeBudgetHtml(note)} · 2025</span><h3>${escapeBudgetHtml(title)} · 2025</h3></div><strong>${compact.format(total)}</strong></header><div class="breakdown-ranked">${rows}</div><details class="breakdown-full"><summary>${copy.all} (${entries.length})</summary><div><table><caption>${escapeBudgetHtml(title)} · 2025</caption><thead><tr><th>${copy.code}</th><th>${copy.category}</th><th>${copy.amount}</th><th>${copy.share}</th></tr></thead><tbody>${tableRows}</tbody></table></div></details></article>`;
    };
    const explorer = document.createElement("section");
    explorer.className = "municipal-breakdown-explorer";
    explorer.innerHTML = `<div class="breakdown-heading"><div><span class="kicker">${copy.kicker}</span><h2>${copy.title}</h2></div><p>${copy.intro}</p></div><div class="breakdown-stage-tabs" role="group" aria-label="${lang === "en" ? "Budget stage" : "Stav rozpočtu"}">${["enacted", "revised", "actual"].map((stage) => `<button type="button" data-breakdown-stage="${stage}" aria-pressed="${stage === "actual"}">${copy[stage]}</button>`).join("")}</div><div class="budget-breakdown-grid"></div><div class="budget-financing-detail"></div><p class="breakdown-method-note">${copy.source} · ${copy.method}${lang === "en" ? ` ${copy.official}` : ""} <code>${escapeBudgetHtml(breakdown.lineage?.ingestion_run_id || "")}</code></p>`;
    const detailGrid = document.querySelector("#rozpocet .detail-grid");
    (detailGrid || panel).insertAdjacentElement("afterend", explorer);

    const renderStage = (stageName) => {
      const stage = breakdown.stages[stageName];
      if (!stage) return;
      explorer.querySelectorAll("[data-breakdown-stage]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.breakdownStage === stageName)));
      explorer.querySelector(".budget-breakdown-grid").innerHTML = [
        panelMarkup(copy.purpose, copy.purposeNote, stage.purpose_expenditure, "purpose", stage.purpose_expenditure_total_czk),
        panelMarkup(copy.expense, copy.expenseNote, stage.economic_expenditure, "economic", stage.economic_expenditure_total_czk),
        panelMarkup(copy.revenue, copy.revenueNote, stage.economic_revenue, "economic", stage.economic_revenue_total_czk),
      ].join("");
      const financing = stage.economic_financing || [];
      explorer.querySelector(".budget-financing-detail").innerHTML = financing.length
        ? panelMarkup(copy.financing, copy.financing, financing, "economic", stage.economic_financing_total_czk)
        : "";
    };
    explorer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-breakdown-stage]");
      if (button) renderStage(button.dataset.breakdownStage);
    });
    renderStage("actual");
  };

  const renderBudgetStages = async () => {
    const panel = document.querySelector(".detail-page .plan-panel");
    const entityId = document.body.dataset.entityId;
    if (!panel || !entityId) return;
    document.querySelector(".municipal-breakdown-explorer")?.remove();
    const ico = entityId.split(":").at(-1);
    try {
      const response = await fetch(`../../../data/entities/${encodeURIComponent(ico)}.json?v=20260821-municipal-breakdown`);
      if (!response.ok) throw new Error(`Municipal profile returned ${response.status}`);
      const payload = await response.json();
      const entity = payload.entity;
      const a = entity.amounts;
      const fallback = [
        { stage: "enacted", revenue_czk: a.revenue_approved, expenditure_czk: a.expense_approved },
        { stage: "revised", revenue_czk: a.revenue_adjusted, expenditure_czk: a.expense_adjusted },
        { stage: "actual", revenue_czk: a.revenue_actual, expenditure_czk: a.expense_actual },
      ].map((row) => ({ ...row, balance_czk: row.revenue_czk - row.expenditure_czk }));
      const stages = entity.budget_stages?.length === 3 ? entity.budget_stages : fallback;
      const labels = lang === "en"
        ? { enacted: "Approved", revised: "Amended", actual: "Actual", stage: "Budget stage", revenue: "Revenue", expenditure: "Expenditure", balance: "Balance", heading: "Approved, amended and actual.", source: "BigQuery headline · FIN 2-12 M" }
        : { enacted: "Schválený", revised: "Upravený", actual: "Skutečnost", stage: "Stav rozpočtu", revenue: "Příjmy", expenditure: "Výdaje", balance: "Saldo", heading: "Schválený, upravený a skutečnost.", source: "BigQuery headline · FIN 2-12 M" };
      const money = { format: (value) => formatMunicipalMoney(value) };
      const ordered = ["enacted", "revised", "actual"].map((stage) => stages.find((row) => row.stage === stage));
      if (ordered.some((row) => !row)) throw new Error("Municipal profile has incomplete budget stages");
      panel.innerHTML = `<div class="budget-stage-scroll" tabindex="0"><table class="budget-stage-table"><caption>${labels.heading} · 2025</caption>
        <thead><tr><th scope="col">${labels.stage}</th><th scope="col">${labels.revenue}</th><th scope="col">${labels.expenditure}</th><th scope="col">${labels.balance}</th></tr></thead>
        <tbody>${ordered.map((row) => `<tr class="budget-stage-${row.stage}"><th scope="row">${labels[row.stage]}</th><td>${money.format(row.revenue_czk)}</td><td>${money.format(row.expenditure_czk)}</td><td class="${row.balance_czk >= 0 ? "positive" : "negative"}">${money.format(row.balance_czk)}</td></tr>`).join("")}</tbody>
      </table></div><p class="budget-stage-source">${labels.source}${entity.budget_stage_lineage ? ` · <code>${entity.budget_stage_lineage.ingestion_run_id}</code>` : ""}</p>`;
      const heading = document.querySelector("#rozpocet .detail-section-title h2");
      if (heading) heading.textContent = labels.heading;
      if (entity.budget_breakdown) {
        const codebookResponse = await fetch(`${root}data/municipal-budget-codebook.v1.json`);
        if (!codebookResponse.ok) throw new Error(`Municipal codebook returned ${codebookResponse.status}`);
        renderBudgetBreakdown(panel, entity, await codebookResponse.json(), money);
        const machineData = document.querySelector('.source-list a[href*="data/entities/"] strong');
        if (machineData) machineData.textContent = lang === "en" ? "Complete detail JSON ↗" : "Kompletní detail JSON ↗";
      }
    } catch (error) {
      console.error("Budget-stage integration failed", error);
    }
  };
  void renderBudgetStages();
  addEventListener("municipal-currency-change", () => { void renderBudgetStages(); });

  const appendBudgetYears = () => document.querySelectorAll(".detail-kpis article > span, .detail-panel .panel-title h3, .entity-card dt, .layer-row dt, .aggregate-cohort dt").forEach((label) => {
    if (!label.textContent.includes("2025")) label.append(" · 2025");
  });
  const simpleHeadings = new Map([
    ["Dvacet let\nv jednom trendu.", "Rozpočty měst v letech 2006–2025"],
    ["Detail každého města.", "Profily měst"],
    ["Auditovatelný profil.", "Zdroje a data"],
    ["Auditovatelný detail.", "Zdroje a data"],
    ["Rozpočet v čase.", "Rozpočet v čase"],
    ["Plán a skutečnost.", "Plán a skutečnost"],
    ["Odkud a kam.", "Struktura příjmů a výdajů"],
    ["Peníze na účtech.", "Peníze na účtech"],
    ["Pozice v kohortě.", "Pozice ve srovnatelné skupině"],
    ["Prozkoumejte příjmy a výdaje.", "Příjmy a výdaje v detailu"],
    ["Najděte libovolnou obec.", "Najděte obec"],
    ["Obecní rozpočty v čase.", "Obecní rozpočty v čase"],
    ["Kolik obce vydají na obyvatele.", "Výdaje obcí na obyvatele"],
    ["Výsledek, stav účtů i počet obyvatel.", "Výsledek, stav účtů i počet obyvatel"],
    ["Najděte a porovnejte.", "Vyhledávání a srovnání"],
    ["Výsledek hospodaření a stav účtů.", "Výsledek hospodaření a stav účtů"]
  ]);
  document.querySelectorAll("h1,h2,h3").forEach((heading) => {
    const replacement = simpleHeadings.get(heading.textContent.trim());
    if (replacement) heading.textContent = replacement;
  });
  if (lang !== "en") {
    const entityName = document.querySelector(".detail-page h1")?.textContent.trim();
    const czechDescription = entityName
      ? `${entityName}: rozpočet obce pro rok 2025, příjmy, výdaje, výsledek hospodaření, stav účtů a interaktivní historie.`
      : document.body.classList.contains("all-municipalities")
        ? "Vyhledávání a srovnání příjmů, výdajů, výsledků hospodaření, stavu účtů a výdajů na obyvatele všech českých obcí v letech 2010–2025."
        : null;
    if (entityName) document.title = `${entityName} — rozpočet obce 2025, příjmy, výdaje a stav účtů`;
    else if (document.body.classList.contains("all-municipalities")) document.title = "Rozpočty všech českých obcí — Public Spending Data";
    if (czechDescription) document.querySelector('meta[name="description"]')?.setAttribute("content", czechDescription);
    appendBudgetYears(); collectCurrencyText(); refreshCurrencyText(); return;
  }
  const dictionary = new Map(Object.entries({
    "Domů": "Home", "Obce": "Municipalities", "Obce a kraje": "Municipalities and regions", "Velká města": "Large cities", "Kraje": "Regions",
    "České územní rozpočty · skutečnost 2025": "Czech local government budgets · 2025 actuals",
    "Obce a kraje\nv jednom obrazu.": "Municipalities and regions\nin one view.", "v jednom obrazu.": "in one view.",
    "Všechny obecní účetní jednotky, kraje i společný součet. Praha je započtena jen jednou.": "Every municipal reporting entity, every region and a combined total. Prague is counted once.",
    "01 / Deduplikovaný součet": "01 / Deduplicated total",
    "6 254 obcí včetně Prahy + 13 krajů bez Prahy = 6 267 unikátních účetních jednotek.": "6,254 municipalities including Prague + 13 regions excluding Prague = 6,267 unique reporting entities.",
    "Obce a města": "Municipalities and cities", "Kraje bez Prahy": "Regions excluding Prague", "Celkem — Praha jen jednou": "Total · Prague counted once",
    "Praha je zde jako obec": "Prague is included as a municipality", "13 krajských účetních jednotek": "13 regional reporting entities", "6 267 unikátních jednotek": "6,267 unique entities",
    "Příjmy": "Revenue", "Výdaje": "Expenditure", "Skutečné příjmy": "Actual revenue", "Skutečné výdaje": "Actual expenditure", "Výsledek": "Balance", "Stav účtů": "Cash and deposits", "Peníze a vklady": "Cash and deposits", "Saldo": "Balance",
    "Pozor na interpretaci:": "Interpretation note:", "Praha není zdvojena, ale součet není konsolidovaný mezi obcemi a kraji — vzájemné transfery mohou zůstávat na obou stranách.": "Prague is not duplicated, but the combined total is not consolidated across municipalities and regions. Intergovernmental transfers may remain on both sides.",
    "02 / Co tvoří výsledek": "02 / What makes the balance",
    "01 / Snapshot 2025 · deduplikovaný součet": "01 / 2025 snapshot · deduplicated total", "02 / Celá země · 2010–2025": "02 / Nationwide · 2010–2025",
    "Obecní rozpočty v čase.": "Municipal budgets over time.", "Součet všech obcí dostupných v daném roce. Vybraný rok řídí také výdajový benchmark, rozdělení přebytků a schodků i celý adresář níže.": "Totals for all municipalities available in each year. The selected year also drives the spending benchmark, surplus/deficit analysis and the directory below.",
    "Vybraný rok": "Selected year", "6 254 obcí s rozpočtovými daty": "6,254 municipalities with budget data", "Obce v přebytku": "Municipalities in surplus",
    "Celostátní roční součty v tabulce": "Nationwide annual totals table", "Obce s daty": "Municipalities with data", "Historický adresář": "Historical directory",
    "03 / Výdajový benchmark": "03 / Spending benchmark", "Kolik obce vydají na obyvatele.": "How much municipalities spend per person.",
    "Roční skutečné výdaje dělíme počtem obyvatel k 1. červenci. Mediány podle velikosti obce oddělují malé obce od velkých měst.": "Annual actual expenditure is divided by mid-year population on 1 July. Medians by population band separate small municipalities from large cities.",
    "Vyšší výdaje na obyvatele samy o sobě neznamenají horší hospodaření. Mohou odrážet investice, spádové služby, turistickou zátěž nebo mimořádné transfery. Benchmark srovnává intenzitu výdajů, nikoli kvalitu služeb.": "Higher expenditure per person does not by itself mean worse management. It may reflect investment, regional services, tourism pressure or exceptional transfers. The benchmark compares spending intensity, not service quality.",
    "05 / Všechny obce ·": "05 / All municipalities ·", "Rok 2025": "Year 2025", "06 / Definice": "06 / Definitions",
    "Celkové příjmy a souhrnný výsledek podle toho, zda obec rok 2025 uzavřela v přebytku, nebo ve schodku.": "Total revenue and aggregate balance, split by whether each municipality closed 2025 in surplus or deficit.",
    "Přebytkové obce": "Surplus municipalities", "Schodkové obce": "Deficit municipalities", "Všechny obce čistě": "All municipalities · net",
    "všech obcí": "of all municipalities", "Celkové příjmy": "Total revenue", "Souhrnný výsledek": "Aggregate balance", "Výsledek po započtení": "Net balance", "příjmy": "revenue",
    "Pět největších schodků": "Five largest deficits",
    "Bez této pětice by obce dohromady skončily v přebytku": "Without these five, municipalities would have finished with a surplus of",
    "„Špatné“ zde znamená pouze největší schodek za jediný rok. Schodek může být plánovanou investicí hrazenou z dřívějších úspor; nejde o hodnocení kvality vedení ani platební schopnosti.": "“Bad” means only the largest deficit in this single year. A deficit may be planned investment funded from prior savings; it is not a judgment on management quality or solvency.",
    "03 / Všechny obce": "03 / All municipalities", "Najděte libovolnou obec.": "Find any municipality.",
    "Jednotná data FIN 2-12 M, rozvahy a ČSÚ pro vybraný rok. Stav účtů nezahrnuje samostatné příspěvkové organizace.": "Consistent FIN 2-12 M, balance-sheet and CZSO data for the selected year. Cash excludes separately reporting public organisations.",
    "Hledat": "Search", "Název nebo IČO…": "Name or registration ID…", "Kraj": "Region", "Všechny kraje": "All regions", "Přebytek i schodek": "Surplus and deficit", "Přebytek": "Surplus", "Schodek": "Deficit", "Řazení": "Sort", "Podle příjmů": "By revenue", "Podle výdajů": "By expenditure", "Podle výdajů na obyvatele": "By expenditure per person", "Podle počtu obyvatel": "By population", "Podle stavu účtů": "By cash", "Podle výsledku": "By balance", "Podle názvu": "By name", "Vymazat filtry": "Reset filters", "Načíst dalších 48 obcí": "Load 48 more municipalities",
    "Zobrazit 20letý trend velkých měst →": "View the 20-year large-city trend →", "Detail a data": "Profile and data", "Detail rozpočtu": "Budget profile",
    "Výsledek, stav účtů i počet obyvatel.": "Balance, cash and population.", "Výsledek = skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci. Stav účtů je součet účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze obce. Výdaje na obyvatele používají střední stav obyvatel k 1. červenci daného roku.": "Balance equals actual consolidated revenue minus actual consolidated expenditure. Cash is the sum of accounts 068, 231, 236, 241, 244, 261 and 262. Expenditure per person uses mid-year population on 1 July.", "Kompletní snapshot": "Complete snapshot", "Rozpočtový zdroj": "Budget source", "Počet obyvatel": "Population",
    "27 velkých měst · nominální CZK": "27 large cities · nominal CZK", "20 let": "20 years", "Rozpočty měst v letech 2006–2025": "City budgets, 2006–2025",
    "Každý rok od 2006 do 2025: příjmy, výdaje, výsledek hospodaření a stav účtů.": "Every year from 2006 to 2025: revenue, expenditure, fiscal balance and cash.",
    "20 let / 2006–2025": "20 years / 2006-2025", "16 let / 2010–2025": "16 years / 2010-2025", "Výsledek hospodaření a stav účtů.": "Fiscal balance and cash.", "Vyberte město": "Select a city",
    "Roční data v tabulce": "Annual data table", "Rok": "Year", "Profily": "Profiles", "Profily měst": "City profiles", "Nejnovější rok i celá časová řada na jedné trvalé adrese.": "The latest year and full time series on one permanent URL.",
    "Obecní účetní jednotka": "Municipal reporting entity", "Rozpočet 2025": "2025 budget", "Trend 20 let": "20-year trend", "Trend 16 let": "16-year trend", "Stáhnout JSON": "Download JSON",
    "ročních výdajů kryto stavem účtů": "of annual expenditure covered by cash", "upraveného rozpočtu": "of the amended budget", "meziročně": "year on year",
    "Plán a skutečnost.": "Budget and actuals.", "Struktura příjmů": "Revenue mix", "Struktura výdajů": "Expenditure mix", "Daňové příjmy": "Tax revenue", "Přijaté transfery": "Transfers received", "Nedaňové příjmy": "Non-tax revenue", "Kapitálové příjmy": "Capital revenue", "Běžné výdaje": "Current expenditure", "Kapitálové výdaje": "Capital expenditure",
    "Nominální Kč. Počet obcí odpovídá dnešním IČO nalezeným v ročním extraktu. Stav účtů 2010–2011 vychází z FIN 2-12 M; od roku 2012 z rozvahy, proto je v roce 2012 metodický zlom.": "Nominal CZK. Municipality counts reflect current registration IDs found in each annual extract. Cash for 2010–2011 comes from FIN 2-12 M and from the balance sheet from 2012, creating a methodological break in 2012.",
    "Rozpočtový výsledek je po konsolidaci v celé řadě. Stav účtů 2010–2011 vychází z běžných účtů ve FIN 2-12M; od 2012 z širšího součtu účtů rozvahy. Chybějící rok není nula — pro současné IČO tehdy nebyla nalezena data.": "The fiscal balance is consolidated throughout the series. Cash for 2010–2011 comes from current accounts in FIN 2-12 M and from a broader balance-sheet account total from 2012. A missing year is not zero—no data were found for the current registration ID in that year.",
    "Rozpočtový výsledek je po konsolidaci v celé řadě. Stav účtů 2006–2011 vychází z běžných účtů ve FIN 2-12M; od 2012 z širšího součtu účtů rozvahy. Rok 2012 je proto metodický zlom.": "The fiscal balance is consolidated throughout the series. Cash for 2006–2011 comes from current accounts in FIN 2-12 M and from a broader balance-sheet account total from 2012, creating a methodological break in 2012.",
    "Samostatná účetní jednotka obce; příspěvkové organizace nejsou přičítány. Výsledek je po konsolidaci uvnitř rozpočtu obce.": "A separate municipal reporting entity; subsidiary public organisations are not added. The balance is consolidated within the municipal budget.",
    "Zdroj: Monitor státní pokladny MF ČR · stav k 31. 12. 2025": "Source: Czech Ministry of Finance Treasury Monitor · as of 31 December 2025",
    "Data a metodika": "Data and methodology", "Zdroje a data": "Sources and data", "Rozpočet v čase": "Budget over time", "Plán a skutečnost": "Budget and actuals", "Struktura příjmů a výdajů": "Revenue and expenditure structure", "Peníze na účtech": "Cash position", "Pozice ve srovnatelné skupině": "Position among peers", "Příjmy a výdaje v detailu": "Revenue and spending in detail", "Najděte obec": "Find a municipality", "Obecní rozpočty v čase": "Municipal budgets over time", "Výdaje obcí na obyvatele": "Municipal spending per resident", "Výsledek, stav účtů i počet obyvatel": "Balance, cash and population", "Vyhledávání a srovnání": "Search and compare", "Výsledek hospodaření a stav účtů": "Fiscal balance and cash", "Rozpočty měst": "City budgets", "v jednom součtu": "in one total", "a jejich rozpočty": "and their budgets", "Kdo za rozpočet odpovídá": "Who answers for the budget", "Institucionální vrstva": "Institutional layer", "Rozpočet": "Budget", "Strojová data": "Machine-readable data", "Historická data": "Historical data",
    "České územní rozpočty": "Czech local government budgets",
    // portal-ui.js rewrites a few source headings into descriptive ones before
    // this dictionary is consulted, and it is injected dynamically, so its
    // ordering against this script is not guaranteed. Key the *normalized*
    // Czech form (as "Zdroje a data" above already is) and map it to the same
    // English string portal-ui produces from the English source heading. Both
    // orderings then converge on one result instead of leaving the heading
    // Czech on the English page:
    //   portal-ui first: "Výsledek hospodaření a stav účtů." -> "Vývoj rozpočtu a účtů" -> here
    //   i18n first:      "Výsledek hospodaření a stav účtů." -> "Fiscal balance and cash." -> portal-ui
    "Vývoj rozpočtu a účtů": "Budget and cash over time",
    "Plán a skutečné výsledky": "Budget and actual results"
  }));

  // Sentences that carry a data value must never be dictionary keys: the next
  // data refresh changes the amount, the literal key stops matching and the
  // English page silently falls back to Czech. Match the sentence by shape,
  // then re-inject the amount formatted for the active language and currency.
  const moneyToken = String.raw`[+−-]?\d[\d\s]*(?:[,.]\d+)?\s*(?:mld\.|mil\.)?\s*Kč`;
  const amountSentences = [
    ["^%M% příjmů\\.$", "%A% in revenue."],
    ["^%M% vytvořily přebytkové obce\\.$", "Surplus municipalities generated %A%."],
    ["^Pět „špatných prasátek“ ubralo %M%\\.$", "Five “bad piggies” took away %A%."],
    ["^namísto %M%\\.$", "instead of %A%."],
    // A bare amount is deliberately absent: collectCurrencyText below converts
    // those generically and keeps them switchable by the currency control.
  ].map(([source, template]) => [new RegExp(source.replace("%M%", `(${moneyToken})`)), template]);
  const translateAmountSentence = (value) => {
    for (const [pattern, template] of amountSentences) {
      const match = value.match(pattern);
      if (match) return template.replace("%A%", () => formatCzkText(match[1]));
    }
    return null;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const value = node.nodeValue.trim();
    if (!value) return;
    const translated = dictionary.get(value) || translateAmountSentence(value);
    if (translated) node.nodeValue = node.nodeValue.replace(value, translated);
  });
  const translatePhrases = (selector, replacements) => document.querySelectorAll(selector).forEach((node) => {
    for (const [source, translation] of replacements) node.textContent = node.textContent.replace(source, translation);
  });
  translatePhrases(".detail-hero .eyebrow, .detail-score small, .detail-kpis small", [
    ["Obecní účetní jednotka", "Municipal reporting entity"],
    ["IČO", "ID"],
    ["ročních výdajů kryto stavem účtů", "of annual expenditure covered by cash"],
    ["upraveného rozpočtu", "of the amended budget"],
    ["příjmů", "of revenue"],
    ["meziročně", "year on year"],
  ]);
  document.querySelectorAll(".detail-score strong, .detail-kpis small").forEach((node) => {
    node.textContent = node.textContent.replace(/(\d),(\d)/g, "$1.$2");
  });
  appendBudgetYears();
  document.querySelectorAll("input[placeholder]").forEach((input) => {
    const translated = dictionary.get(input.getAttribute("placeholder"));
    if (translated) input.setAttribute("placeholder", translated);
  });
  document.title = document.title
    .replace("Rozpočty všech obcí a krajů ČR", "Czech town and municipality budgets")
    .replace("Rozpočty měst a obcí ČR", "Czech town and municipality budgets")
    .replace("Rozpočty velkých měst", "Large-city budgets")
    .replace("Rozpočet obce", "Town and municipality budget")
    .replace("příjmy, výdaje a účty", "revenue, expenditure and cash")
    .replace("trend a stav účtů", "trend and cash");
  const entityName = document.querySelector(".detail-page h1")?.textContent.trim();
  if (entityName) document.title = `${entityName} town and municipality budget 2025 — revenue, expenditure and cash`;
  const englishDescription = entityName
    ? `${entityName} town and municipality budget for 2025: revenue, expenditure, fiscal balance, cash and a 16-year interactive history.`
    : document.body.classList.contains("all-municipalities")
      ? "Search and compare revenue, expenditure, fiscal balances, cash and per-person spending for every Czech town and municipality from 2010 to 2025."
      : null;
  if (englishDescription) {
    document.querySelector('meta[name="description"]')?.setAttribute("content", englishDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", englishDescription);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", englishDescription);
  }
  collectCurrencyText(); refreshCurrencyText();
})();
