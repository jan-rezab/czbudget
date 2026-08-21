(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get("lang");
  const lang = requested === "en" || requested === "cs" ? requested : (localStorage.getItem("psd-lang") || "cs");
  localStorage.setItem("psd-lang", lang);
  document.documentElement.lang = lang;

  const withLang = (code) => {
    const next = new URL(location.href);
    next.searchParams.set("lang", code);
    return `${next.pathname}${next.search}${next.hash}`;
  };
  const root = location.pathname.includes("/cz/obce/") || location.pathname.includes("/cz/kraje/")
    ? (location.pathname.split("/").filter(Boolean).length > 2 ? "../../../" : "../../")
    : "../../";
  const header = document.querySelector(".cz-header");
  if (header) {
    const nav = header.querySelector("nav");
    if (nav) nav.innerHTML = lang === "en"
      ? `<a href="${root}index.html?lang=en">Overview</a><a href="${root}cesko.html?lang=en">Czechia</a><a href="${root}cz/obce/?lang=en" aria-current="page">Municipalities &amp; regions</a>`
      : `<a href="${root}index.html?lang=cs">Přehled</a><a href="${root}cesko.html?lang=cs">Česko</a><a href="${root}cz/obce/?lang=cs" aria-current="page">Obce a kraje</a>`;
    const switcher = document.createElement("div");
    switcher.className = "lang-switch municipal-lang-switch";
    switcher.setAttribute("aria-label", lang === "en" ? "Language" : "Jazyk");
    switcher.innerHTML = `<a href="${withLang("cs")}"${lang === "cs" ? ' aria-current="true"' : ""}>CZ</a><a href="${withLang("en")}"${lang === "en" ? ' aria-current="true"' : ""}>EN</a>`;
    const datasetPill = header.querySelector(".dataset-pill");
    if (datasetPill) datasetPill.replaceWith(switcher);
    else header.append(switcher);
  }

  const renderBudgetStages = async () => {
    const panel = document.querySelector(".detail-page .plan-panel");
    const entityId = document.body.dataset.entityId;
    if (!panel || !entityId) return;
    const ico = entityId.split(":").at(-1);
    try {
      const response = await fetch(`../../../data/entities/${encodeURIComponent(ico)}.json`);
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
      const money = new Intl.NumberFormat(lang === "en" ? "en-GB" : "cs-CZ", {
        style: "currency", currency: "CZK", maximumFractionDigits: 0,
      });
      const ordered = ["enacted", "revised", "actual"].map((stage) => stages.find((row) => row.stage === stage));
      if (ordered.some((row) => !row)) throw new Error("Municipal profile has incomplete budget stages");
      panel.innerHTML = `<div class="budget-stage-scroll"><table class="budget-stage-table">
        <thead><tr><th scope="col">${labels.stage}</th><th scope="col">${labels.revenue}</th><th scope="col">${labels.expenditure}</th><th scope="col">${labels.balance}</th></tr></thead>
        <tbody>${ordered.map((row) => `<tr class="budget-stage-${row.stage}"><th scope="row">${labels[row.stage]}</th><td>${money.format(row.revenue_czk)}</td><td>${money.format(row.expenditure_czk)}</td><td class="${row.balance_czk >= 0 ? "positive" : "negative"}">${money.format(row.balance_czk)}</td></tr>`).join("")}</tbody>
      </table></div><p class="budget-stage-source">${labels.source}${entity.budget_stage_lineage ? ` · <code>${entity.budget_stage_lineage.ingestion_run_id}</code>` : ""}</p>`;
      const heading = document.querySelector("#rozpocet .detail-section-title h2");
      if (heading) heading.textContent = labels.heading;
    } catch (error) {
      console.error("Budget-stage integration failed", error);
    }
  };
  void renderBudgetStages();

  if (lang !== "en") return;
  const dictionary = new Map(Object.entries({
    "Domů": "Home", "Obce": "Municipalities", "Obce a kraje": "Municipalities and regions", "Velká města": "Large cities", "Kraje": "Regions",
    "České územní rozpočty · skutečnost 2025": "Czech local government budgets · 2025 actuals",
    "Obce a kraje\nv jednom obrazu.": "Municipalities and regions\nin one view.", "v jednom obrazu.": "in one view.",
    "Všechny obecní účetní jednotky, kraje i společný součet. Praha je započtena jen jednou.": "Every municipal reporting entity, every region and a combined total. Prague is counted once.",
    "01 / Deduplikovaný součet": "01 / Deduplicated total", "901,9 mld. Kč příjmů.": "CZK 901.9bn in revenue.",
    "6 254 obcí včetně Prahy + 13 krajů bez Prahy = 6 267 unikátních účetních jednotek.": "6,254 municipalities including Prague + 13 regions excluding Prague = 6,267 unique reporting entities.",
    "Obce a města": "Municipalities and cities", "Kraje bez Prahy": "Regions excluding Prague", "Celkem — Praha jen jednou": "Total · Prague counted once",
    "Praha je zde jako obec": "Prague is included as a municipality", "13 krajských účetních jednotek": "13 regional reporting entities", "6 267 unikátních jednotek": "6,267 unique entities",
    "Příjmy": "Revenue", "Výdaje": "Expenditure", "Výsledek": "Balance", "Stav účtů": "Cash and deposits", "Peníze a vklady": "Cash and deposits", "Saldo": "Balance",
    "Pozor na interpretaci:": "Interpretation note:", "Praha není zdvojena, ale součet není konsolidovaný mezi obcemi a kraji — vzájemné transfery mohou zůstávat na obou stranách.": "Prague is not duplicated, but the combined total is not consolidated across municipalities and regions. Intergovernmental transfers may remain on both sides.",
    "02 / Všechny obce": "02 / All municipalities", "Najděte libovolnou obec.": "Find any municipality.",
    "Jednotná data FIN 2-12M a rozvahy za rok 2025. Stav účtů nezahrnuje samostatné příspěvkové organizace.": "Consistent FIN 2-12M and balance-sheet data for 2025. Cash excludes separately reporting public organisations.",
    "Hledat": "Search", "Název nebo IČO…": "Name or registration ID…", "Kraj": "Region", "Všechny kraje": "All regions", "Přebytek i schodek": "Surplus and deficit", "Přebytek": "Surplus", "Schodek": "Deficit", "Řazení": "Sort", "Podle příjmů": "By revenue", "Podle výdajů": "By expenditure", "Podle stavu účtů": "By cash", "Podle výsledku": "By balance", "Podle názvu": "By name", "Vymazat filtry": "Reset filters", "Načíst dalších 48 obcí": "Load 48 more municipalities",
    "Zobrazit 20letý trend velkých měst →": "View the 20-year large-city trend →", "Detail a data": "Profile and data", "Detail rozpočtu": "Budget profile",
    "03 / Definice": "03 / Definitions", "Výsledek i stav účtů.": "Balance and cash.", "Kompletní snapshot": "Complete snapshot", "Primární zdroj": "Primary source",
    "27 velkých měst · nominální CZK": "27 large cities · nominal CZK", "20 let": "20 years", "Dvacet let\nv jednom trendu.": "Twenty years\nin one trend.",
    "Každý rok od 2006 do 2025: příjmy, výdaje, výsledek hospodaření a stav účtů.": "Every year from 2006 to 2025: revenue, expenditure, fiscal balance and cash.",
    "20 let / 2006–2025": "20 years / 2006-2025", "Výsledek hospodaření a stav účtů.": "Fiscal balance and cash.", "Vyberte město": "Select a city",
    "Roční data v tabulce": "Annual data table", "Rok": "Year", "Profily": "Profiles", "Detail každého města.": "Every city in detail.", "Nejnovější rok i celá časová řada na jedné trvalé adrese.": "The latest year and full time series on one permanent URL.",
    "Obecní účetní jednotka": "Municipal reporting entity", "Rozpočet 2025": "2025 budget", "Trend 20 let": "20-year trend", "Stáhnout JSON": "Download JSON",
    "ročních výdajů kryto stavem účtů": "of annual expenditure covered by cash", "upraveného rozpočtu": "of the amended budget", "meziročně": "year on year",
    "Plán a skutečnost.": "Budget and actuals.", "Struktura příjmů": "Revenue mix", "Struktura výdajů": "Expenditure mix", "Daňové příjmy": "Tax revenue", "Přijaté transfery": "Transfers received", "Nedaňové příjmy": "Non-tax revenue", "Kapitálové příjmy": "Capital revenue", "Běžné výdaje": "Current expenditure", "Kapitálové výdaje": "Capital expenditure",
    "Data a metodika": "Data and methodology", "Auditovatelný profil.": "An auditable profile.", "Rozpočet": "Budget", "Strojová data": "Machine-readable data",
    "České územní rozpočty": "Czech local government budgets"
  }));

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const value = node.nodeValue.trim();
    if (!value) return;
    const translated = dictionary.get(value);
    if (translated) node.nodeValue = node.nodeValue.replace(value, translated);
  });
  document.querySelectorAll("input[placeholder]").forEach((input) => {
    const translated = dictionary.get(input.getAttribute("placeholder"));
    if (translated) input.setAttribute("placeholder", translated);
  });
  document.title = document.title
    .replace("Rozpočty všech obcí a krajů ČR", "Budgets of all Czech municipalities and regions")
    .replace("Rozpočty velkých měst", "Large-city budgets")
    .replace("Rozpočet obce", "Municipal budget")
    .replace("příjmy, výdaje a účty", "revenue, expenditure and cash")
    .replace("trend a stav účtů", "trend and cash");
})();
