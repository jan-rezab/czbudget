(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "/";
  const profileUrl = document.body.dataset.profileUrl;
  const requested = new URLSearchParams(location.search).get("lang");
  const requestedProfileCode = new URLSearchParams(location.search).get("code");
  let lang = requested === "cs" || requested === "en" ? requested : (document.documentElement.lang === "en" ? "en" : "cs");
  let profile;
  let detailQuery = "";
  let detailStage = "all";
  let detailSide = "all";
  let detailShown = 160;

  const copy = {
    cs: {
      municipalities: "Obce", official: "oficiální obecní finance", code: "Národní kód", latest: "Poslední období",
      revenue: "Příjmy", expenditure: "Výdaje", balance: "Saldo", debt: "Dluh", cashBalance: "Stav účtů", executionRate: "Plnění výdajů", execution: "Čerpání",
      trend: "Vývoj", historyTitle: "Rozpočet v čase.", historyCopy: "Nominální hodnoty v místní měně. Jednotlivé fáze rozpočtu zůstávají oddělené.",
      onePeriod: "Jeden dostupný rok", onePeriodCopy: "Zdroj zatím poskytuje jeden srovnatelný roční profil. Další roky se zde objeví bez změny rozvržení stránky.",
      budgetKicker: "Rozpočet", budgetTitle: "Plán a skutečnost.", stage: "Fáze", enacted: "Schválený", revised: "Upravený",
      actual: "Skutečnost", cash: "Zaplaceno", committed: "Závazky", period: "V období", remaining: "Zbývá", allStages: "Všechny fáze",
      revenueMix: "Struktura příjmů", expenditureMix: "Struktura výdajů", nativeKicker: "Původní detail",
      nativeTitle: "Položkový detail.", docTitle: "{name} — rozpočet obce, {country} — Public Spending Data", docDesc: "{name}, {country}: oficiální obecní příjmy, výdaje, saldo, rozpočtové fáze a původní položkový detail.", nativeCopy: "Původní kódy, názvy a sloupce z národního zdroje; bez skrytého přemapování.", nativeTableLabel: "Tabulka položkového detailu, vodorovně posuvná",
      search: "Hledat položku", searchPlaceholder: "Kód nebo název…", side: "Strana", allSides: "Obě strany", amount: "Částka",
      account: "Kód / položka", year: "Rok", shown: "zobrazeno", more: "Načíst další položky", sourceKicker: "Data a metodika",
      sourceTitle: "Auditovatelný profil.", sourceCopy: "Rozsah odpovídá oficiálnímu obecnímu výkazu. Chybějící hotovost, dluh nebo historie se nedopočítávají.",
      officialSource: "Oficiální zdroj", profileData: "Strojová data", open: "Otevřít ↗", json: "JSON ↗", noValue: "Není v načtené národní vrstvě",
      sumOfResults: "Součet výsledků za {years} let", historyData: "Historická data", methodWarning: "Saldo je v celé řadě konsolidované. Stav účtů má metodický zlom v roce 2012. Chybějící rok není nula — pro dnešní IČO se v daném roce nenašla data.", latestPeriod: "Poslední období", overview: "Přehled", budget: "Rozpočet", detail: "Detail", method: "Metodika",
    },
    en: {
      municipalities: "Municipalities", official: "official municipal finance", code: "National code", latest: "Latest period",
      revenue: "Revenue", expenditure: "Expenditure", balance: "Balance", debt: "Debt", cashBalance: "Cash balance", executionRate: "Expenditure execution", execution: "Execution",
      trend: "Trend", historyTitle: "Budget over time.", historyCopy: "Nominal values in local currency. Budget stages remain separate.",
      onePeriod: "One year available", onePeriodCopy: "The source currently provides one comparable annual profile. Additional years can appear here without changing the page layout.",
      budgetKicker: "Budget", budgetTitle: "Plan and actual.", stage: "Budget stage", enacted: "Approved", revised: "Amended",
      actual: "Actual", cash: "Paid", committed: "Committed", period: "In period", remaining: "Remaining", allStages: "All stages",
      revenueMix: "Revenue mix", expenditureMix: "Expenditure mix", nativeKicker: "Native detail",
      nativeTitle: "Item-level detail.", docTitle: "{name} — {country} municipal budget — Public Spending Data", docDesc: "{name}, {country}: official municipal revenue, expenditure, balance, budget stages and native item-level detail.", nativeCopy: "Original codes, labels and columns from the national source, without hidden remapping.", nativeTableLabel: "Item-level detail table, scrolls horizontally",
      search: "Search items", searchPlaceholder: "Code or label…", side: "Side", allSides: "Both sides", amount: "Amount",
      account: "Code / item", year: "Year", shown: "shown", more: "Load more items", sourceKicker: "Data and methodology",
      sourceTitle: "An auditable profile.", sourceCopy: "Coverage follows the official municipal return. Missing cash, debt or history is not estimated.",
      officialSource: "Official source", profileData: "Machine-readable data", open: "Open ↗", json: "JSON ↗", noValue: "Not available in the loaded national layer",
      sumOfResults: "Sum of results over {years} years", historyData: "Historical data", methodWarning: "The fiscal balance is consolidated throughout the series. Cash has a methodological break in 2012. A missing year is not zero—no data were found for the current registration ID in that year.", latestPeriod: "Latest period", overview: "Overview", budget: "Budget", detail: "Detail", method: "Method",
    },
  };

  const countries = {
    DNK: { cs: "Dánsko", en: "Denmark", slug: "denmark" }, BRA: { cs: "Brazílie", en: "Brazil", slug: "brazil" },
    ESP: { cs: "Španělsko", en: "Spain", slug: "spain" }, JPN: { cs: "Japonsko", en: "Japan", slug: "japan" },
    COL: { cs: "Kolumbie", en: "Colombia", slug: "colombia" }, GEO: { cs: "Gruzie", en: "Georgia", slug: "georgia" },
    ITA: { cs: "Itálie", en: "Italy", slug: "italy" }, BOL: { cs: "Bolívie", en: "Bolivia", slug: "bolivia" },
    SLV: { cs: "Salvador", en: "El Salvador", slug: "el-salvador" }, MEX: { cs: "Mexiko", en: "Mexico", slug: "mexico" },
    CRI: { cs: "Kostarika", en: "Costa Rica", slug: "costa-rica" }, GTM: { cs: "Guatemala", en: "Guatemala", slug: "guatemala" },
    PER: { cs: "Peru", en: "Peru", slug: "peru" }, KOR: { cs: "Jižní Korea", en: "South Korea", slug: "south-korea" },
    CHL: { cs: "Chile", en: "Chile", slug: "chile" },
    NOR: { cs: "Norsko", en: "Norway", slug: "norway" }, NLD: { cs: "Nizozemsko", en: "Netherlands", slug: "netherlands" },
    FIN: { cs: "Finsko", en: "Finland", slug: "finland" },
    DEU: { cs: "Německo", en: "Germany", slug: "germany" },
    CZE: { cs: "Česko", en: "Czechia", slug: "czechia", profileRoot: "cz/municipalities" },
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  // Title and description are translated like any other string: interpolating a
  // hardcoded English fragment produced Czech pages titled "… Česko municipal budget".
  const fillTemplate = (template, values) => String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const percentage = (value) => Number.isFinite(value) ? new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value) : "—";
  const money = (value, compact = true) => {
    const amount = numeric(value);
    if (amount === null) return "—";
    return new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", {
      style: "currency", currency: profile.currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 2 : 0,
    }).format(amount);
  };

  function adaptProfile(data, historyData = null) {
    if (data.country?.code === "DEU" && data.defaults && Array.isArray(data.entities)) {
      const entity = data.entities.find((row) => row.code === requestedProfileCode);
      if (!entity) throw new Error(`Unknown German municipality ${requestedProfileCode || "(missing code)"}`);
      const year = Number((entity.years || data.defaults.years || []).at(-1));
      const revenue = numeric(entity.revenue);
      const expenditure = numeric(entity.expenditure);
      const balance = numeric(entity.balance) ?? (revenue !== null && expenditure !== null ? revenue - expenditure : null);
      const latest = { year, revenue, expenditure, balance };
      return {
        country: "DEU", code: entity.code, name: entity.name, region: entity.region || null,
        currency: entity.currency || data.defaults.currency || data.country.currency || "EUR",
        years: [year], history: [latest], latest, summaryOnly: true,
        detail: [
          { year, stage: "actual", side: "revenue", code: "ADJUSTED_RECEIPTS", name: "Adjusted receipts excluding financing", amount: revenue },
          { year, stage: "actual", side: "expenditure", code: "ADJUSTED_PAYMENTS", name: "Adjusted payments excluding financing", amount: expenditure },
        ].filter((row) => row.amount !== null),
      };
    }
    if (data.entity) {
      const entity = data.entity;
      const amounts = entity.amounts || {};
      let series = historyData?.series || [];
      if (Array.isArray(historyData?.cities)) {
        series = historyData.cities.find((city) => city.national_id === entity.national_id)?.series || [];
      }
      const history = series.map((row) => ({
        year: Number(row.year), revenue: row.revenue_actual, expenditure: row.expense_actual,
        balance: row.budget_balance, cash: row.cash_current,
      }));
      const year = Number(entity.fiscal_year || data.period?.fiscal_year);
      const detail = [
        ["enacted", "revenue", "TOTAL_REVENUE", "Total revenue", amounts.revenue_approved],
        ["revised", "revenue", "TOTAL_REVENUE", "Total revenue", amounts.revenue_adjusted],
        ["actual", "revenue", "TOTAL_REVENUE", "Total revenue", amounts.revenue_actual],
        ["enacted", "expenditure", "TOTAL_EXPENDITURE", "Total expenditure", amounts.expense_approved],
        ["revised", "expenditure", "TOTAL_EXPENDITURE", "Total expenditure", amounts.expense_adjusted],
        ["actual", "expenditure", "TOTAL_EXPENDITURE", "Total expenditure", amounts.expense_actual],
        ["actual", "revenue", "TAX_REVENUE", "Tax revenue", amounts.tax_revenue],
        ["actual", "revenue", "TRANSFER_REVENUE", "Transfers received", amounts.transfer_revenue],
        ["actual", "revenue", "NONTAX_REVENUE", "Non-tax revenue", amounts.nontax_revenue],
        ["actual", "revenue", "CAPITAL_REVENUE", "Capital revenue", amounts.capital_revenue],
        ["actual", "expenditure", "CURRENT_EXPENDITURE", "Current expenditure", amounts.current_expense],
        ["actual", "expenditure", "CAPITAL_EXPENDITURE", "Capital expenditure", amounts.capital_expense],
      ].filter((row) => numeric(row[4]) !== null).map(([stage, side, code, name, amount]) => ({ year, stage, side, code, name, amount }));
      const latest = {
        year, revenue: amounts.revenue_actual, expenditure: amounts.expense_actual,
        balance: amounts.budget_balance, cash: amounts.cash_current,
      };
      if (!history.some((row) => row.year === year)) history.push(latest);
      return {
        country: "CZE", code: entity.national_id, name: entity.short_name || entity.name,
        region: entity.territory?.region_name, currency: entity.currency_code || "CZK",
        years: history.map((row) => row.year), history, latest, detail,
      };
    }
    if (Array.isArray(data.detail)) return { ...data, detail: data.detail.map((row) => ({ ...row })) };
    if (!Array.isArray(data.breakdown)) return { ...data, detail: [] };

    const latestYear = Number(data.latest?.year || Math.max(...(data.years || []).map(Number)));
    const detail = [
      { year: latestYear, stage: "actual", side: "revenue", code: "TOTAL_REVENUE", name: "Total revenue", amount: data.latest?.revenue },
      { year: latestYear, stage: "actual", side: "expenditure", code: "TOTAL_EXPENDITURE", name: "Total expenditure", amount: data.latest?.expenditure },
    ].filter((row) => numeric(row.amount) !== null);

    data.breakdown.forEach((row) => {
      if (numeric(row.revenue) !== null || numeric(row.expenditure) !== null) {
        if (numeric(row.revenue) !== null) detail.push({ ...row, year: latestYear, stage: "actual", side: "revenue", amount: row.revenue });
        if (numeric(row.expenditure) !== null) detail.push({ ...row, year: latestYear, stage: "actual", side: "expenditure", amount: row.expenditure });
        return;
      }
      const label = `${row.code || ""} ${row.name || ""}`;
      const side = /expenditure|expense|cost|payment|wages|salar|investment/i.test(label)
        ? "expenditure"
        : /revenue|income|tax|grant|receipt|sales|fee|charge/i.test(label) ? "revenue" : "other";
      detail.push({ ...row, year: latestYear, stage: "actual", side });
    });
    return { ...data, detail };
  }

  function normalizeBrazilRows(rows) {
    if (profile.country !== "BRA") return rows.map((row) => ({ ...row }));
    const sideByAccount = new Map();
    rows.forEach((row) => {
      const column = String(row.column || "").toLocaleUpperCase();
      const label = String(row.name || "").toLocaleUpperCase();
      const key = `${row.code || ""}\u0000${row.name || ""}`;
      if (/PREVISÃO|REALIZADAS/.test(column) || /RECEITAS \(EXCETO/.test(label)) sideByAccount.set(key, "revenue");
      if (/DOTAÇÃO|EMPENHADAS|LIQUIDADAS|PAGAS/.test(column) || /DESPESAS \(EXCETO/.test(label)) sideByAccount.set(key, "expenditure");
    });
    return rows.map((row) => {
      const column = String(row.column || "").toLocaleUpperCase();
      const key = `${row.code || ""}\u0000${row.name || ""}`;
      let stage = row.stage;
      if (/PREVISÃO INICIAL|DOTAÇÃO INICIAL/.test(column)) stage = "enacted";
      else if (/PREVISÃO ATUALIZADA|DOTAÇÃO ATUALIZADA/.test(column)) stage = "revised";
      else if (/NO BIMESTRE/.test(column)) stage = "period";
      else if (/SALDO/.test(column)) stage = "remaining";
      else if (/PAGAS/.test(column)) stage = "cash";
      else if (/EMPENHADAS/.test(column)) stage = "committed";
      else if (/LIQUIDADAS|REALIZADAS|ATÉ O BIMESTRE/.test(column)) stage = "actual";
      return { ...row, side: sideByAccount.get(key) || row.side, stage };
    });
  }

  const stageOrder = ["enacted", "revised", "actual", "committed", "cash", "period", "remaining"];
  const headlinePatterns = {
    BRA: {
      revenue: /RECEITAS \(EXCETO INTRA-?ORÇAMENTÁRIAS\)/i,
      expenditure: /DESPESAS \(EXCETO INTRA-?ORÇAMENTÁRIAS\)/i,
    },
  };

  function headline(rows, stage, side) {
    const candidates = rows.filter((row) => row.stage === stage && row.side === side && numeric(row.amount) !== null);
    if (!candidates.length) return null;
    const canonicalTotal = candidates.find((row) => row.code === `TOTAL_${side.toLocaleUpperCase()}`);
    if (canonicalTotal) return numeric(canonicalTotal.amount);
    const pattern = headlinePatterns[profile.country]?.[side];
    const exact = pattern ? candidates.find((row) => pattern.test(String(row.name || ""))) : null;
    return numeric((exact || candidates.slice().sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))[0]).amount);
  }

  function mixRows(rows, side, latestYear) {
    const latest = rows.filter((row) => row.year === latestYear && row.stage === "actual" && row.side === side && numeric(row.amount) > 0);
    const patterns = profile.country === "BRA" ? (side === "revenue" ? [
      /^ReceitasCorrentes$/, /^ReceitasDeCapital$/, /^ReceitasIntraOrcamentarias$/,
    ] : [
      /^DespesasCorrentes$/, /^DespesasDeCapital$/, /^ReservaDeContingencia$/,
    ]) : [];
    let selected = patterns.map((pattern) => latest.find((row) => pattern.test(String(row.code || "")))).filter(Boolean);
    if (!selected.length) {
      const totalPattern = headlinePatterns[profile.country]?.[side];
      const unique = new Map();
      latest.forEach((row) => {
        if (String(row.code || "").startsWith("TOTAL_")) return;
        if (totalPattern?.test(String(row.name || ""))) return;
        const key = row.code || row.name;
        if (!unique.has(key)) unique.set(key, row);
      });
      selected = [...unique.values()].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
    }
    const total = headline(rows, "actual", side) || selected.reduce((sum, row) => sum + Number(row.amount), 0);
    return { rows: selected, total };
  }

  function mixMarkup(title, mix, palette) {
    return `<article class="detail-panel"><div class="panel-title"><h3>${escapeHtml(title)}</h3><strong>${money(mix.total)}</strong></div>${mix.rows.length ? mix.rows.map((row, index) => {
      const share = mix.total ? Math.max(0, Number(row.amount) / mix.total) : 0;
      return `<div class="mix-row"><div><i style="background:${palette[index % palette.length]}"></i><strong>${escapeHtml(row.name || row.code)}</strong><span>${money(row.amount)}</span></div><div class="mix-track"><i style="width:${Math.min(100, share * 100).toFixed(2)}%;background:${palette[index % palette.length]}"></i><b>${percentage(share)}</b></div></div>`;
    }).join("") : `<p class="profile-empty-note">${copy[lang].noValue}</p>`}</article>`;
  }

  function historyMarkup(history) {
    const t = copy[lang];
    const fourthLabel = history.some((row) => numeric(row.cash) !== null) ? t.cashBalance : t.debt;
    const fourthValue = (row) => numeric(row.cash) !== null ? row.cash : row.debt;
    if (history.length <= 1) {
      const row = history[0] || {};
      return `<section class="history-explorer single-period-history" id="history-explorer"><div class="directory-title"><div><span class="kicker">${t.onePeriod}</span><h2>${t.historyTitle}</h2></div><p>${t.onePeriodCopy}</p></div><div class="history-kpis">${[[t.revenue, row.revenue], [t.expenditure, row.expenditure], [t.balance, row.balance], [fourthLabel, fourthValue(row)]].map(([label, value]) => `<article><span>${label}</span><strong>${money(value)}</strong><small>${row.year || "—"}</small></article>`).join("")}</div></section>`;
    }
    return `<section class="history-explorer" id="history-explorer"><div class="directory-title"><div><span class="kicker">${t.trend} · ${history.at(0)?.year || ""}–${history.at(-1)?.year || ""}</span><h2>${t.historyTitle}</h2></div><p>${t.historyCopy}</p><p class="method-warning">${t.methodWarning}</p></div><div class="history-kpis" id="history-kpis"><article class="history-total"><span>${fillTemplate(t.sumOfResults, { years: history.length })}</span><strong>${money(history.reduce((sum, entry) => sum + (numeric(entry.balance) ?? 0), 0))}</strong><small>${history.at(0)?.year}–${history.at(-1)?.year}</small></article></div><details class="history-table" open><summary>${t.historyTitle}</summary><div class="profile-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(t.historyTitle)}"><table><thead><tr><th>${t.year}</th><th>${t.revenue}</th><th>${t.expenditure}</th><th>${t.balance}</th><th>${fourthLabel}</th></tr></thead><tbody id="history-table-body">${[...history].reverse().map((row) => `<tr><th>${row.year}</th><td>${money(row.revenue, false)}</td><td>${money(row.expenditure, false)}</td><td>${money(row.balance, false)}</td><td>${money(fourthValue(row), false)}</td></tr>`).join("")}</tbody></table></div></details></section>`;
  }

  function stageTableMarkup(rows, latestYear) {
    const t = copy[lang];
    const yearRows = rows.filter((row) => row.year === latestYear);
    const stages = ["enacted", "revised", "actual"].map((stage) => {
      const revenue = headline(yearRows, stage, "revenue");
      const expenditure = headline(yearRows, stage, "expenditure");
      return { stage, revenue, expenditure, balance: revenue !== null && expenditure !== null ? revenue - expenditure : null };
    }).filter((row) => row.revenue !== null || row.expenditure !== null);
    if (!stages.length) return `<p class="profile-empty-note">${t.noValue}</p>`;
    return `<div class="budget-stage-scroll" tabindex="0"><table class="budget-stage-table"><caption>${t.budgetTitle} · ${latestYear}</caption><thead><tr><th>${t.stage}</th><th>${t.revenue}</th><th>${t.expenditure}</th><th>${t.balance}</th></tr></thead><tbody>${stages.map((row) => `<tr class="budget-stage-${row.stage}"><th>${t[row.stage] || row.stage}</th><td>${money(row.revenue, false)}</td><td>${money(row.expenditure, false)}</td><td class="${numeric(row.balance) !== null && row.balance < 0 ? "negative" : "positive"}">${money(row.balance, false)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function detailRows() {
    const query = detailQuery.trim().toLocaleLowerCase();
    return profile.normalizedDetail.filter((row) => (detailStage === "all" || row.stage === detailStage) && (detailSide === "all" || row.side === detailSide) && (!query || [row.code, row.name, row.column, row.table_title, row.side].some((value) => String(value || "").toLocaleLowerCase().includes(query))));
  }

  function renderDetailTable() {
    if (!profile) return;
    const t = copy[lang];
    const rows = detailRows();
    const table = document.querySelector("#profile-detail");
    if (!table) return;
    table.innerHTML = `<thead><tr><th>${t.year}</th><th>${t.stage}</th><th>${t.side}</th><th>${t.account}</th><th>${t.amount}</th></tr></thead><tbody>${rows.slice(0, detailShown).map((row) => `<tr><td>${row.year}</td><td>${escapeHtml(t[row.stage] || row.stage)}</td><td>${escapeHtml(row.side === "revenue" ? t.revenue : row.side === "expenditure" ? t.expenditure : row.side || "")}</td><td><b>${escapeHtml(row.code)}</b><small>${escapeHtml(row.name || row.column || "")}${row.column && row.name ? ` · ${escapeHtml(row.column)}` : ""}</small></td><td>${money(row.amount, false)}</td></tr>`).join("")}</tbody>`;
    document.querySelector("#profile-detail-count").textContent = `${new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(Math.min(detailShown, rows.length))} / ${new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(rows.length)} ${t.shown}`;
    const more = document.querySelector("#profile-detail-more");
    more.textContent = t.more;
    more.hidden = detailShown >= rows.length;
  }

  function contextRail() {
    document.querySelector(".international-context-rail")?.remove();
    const t = copy[lang];
    const rail = document.createElement("nav");
    rail.className = "context-rail municipal-context-rail international-context-rail";
    rail.setAttribute("aria-label", lang === "en" ? "Page sections" : "Sekce stránky");
    rail.innerHTML = [["overview", t.overview], ["history-explorer", t.trend], ["rozpocet", t.budget], ["native-detail", t.detail], ["metodika", t.method]].map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");
    document.querySelector("psd-site-header")?.insertAdjacentElement("afterend", rail);
  }

  function bindControls() {
    document.querySelector("#profile-detail-search")?.addEventListener("input", (event) => { detailQuery = event.target.value; detailShown = 160; renderDetailTable(); });
    document.querySelector("#profile-detail-stage")?.addEventListener("change", (event) => { detailStage = event.target.value; detailShown = 160; renderDetailTable(); });
    document.querySelector("#profile-detail-side")?.addEventListener("change", (event) => { detailSide = event.target.value; detailShown = 160; renderDetailTable(); });
    document.querySelector("#profile-detail-more")?.addEventListener("click", () => { detailShown += 160; renderDetailTable(); });
    document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
      lang = button.dataset.lang;
      const next = new URL(location.href);
      next.searchParams.set("lang", lang);
      history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
      render();
    }, { once: true }));
  }

  function render() {
    const t = copy[lang];
    const country = countries[profile.country] || { cs: profile.country, en: profile.country, slug: String(profile.country || "").toLocaleLowerCase() };
    const history = [...(profile.history || [])].sort((a, b) => Number(a.year) - Number(b.year));
    const latest = [...history].reverse().find((row) => numeric(row.revenue) !== null || numeric(row.expenditure) !== null) || history.at(-1) || {};
    const latestYear = latest.year || Math.max(...(profile.years || []).map(Number));
    const yearRows = profile.normalizedDetail.filter((row) => row.year === latestYear);
    const revisedExpenditure = headline(yearRows, "revised", "expenditure");
    const actualExpenditure = numeric(latest.expenditure) ?? headline(yearRows, "actual", "expenditure");
    const executionRate = revisedExpenditure && actualExpenditure !== null ? actualExpenditure / revisedExpenditure : null;
    const fourthMetric = numeric(latest.cash) !== null ? [t.cashBalance, latest.cash, latestYear] : numeric(latest.debt) !== null ? [t.debt, latest.debt, latestYear] : [t.executionRate, executionRate, t.latestPeriod];
    const revenueMix = mixRows(profile.normalizedDetail, "revenue", latestYear);
    const expenditureMix = mixRows(profile.normalizedDetail, "expenditure", latestYear);
    const stages = [...new Set(profile.normalizedDetail.map((row) => row.stage).filter(Boolean))].sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

    document.documentElement.lang = lang;
    document.body.classList.add("cz-budget-page", "detail-page", "international-municipality-profile");
    document.title = fillTemplate(t.docTitle, { name: profile.name, country: country[lang] });
    document.querySelector('meta[name="description"]')?.setAttribute("content", fillTemplate(t.docDesc, { name: profile.name, country: country[lang] }));
    const summaryCanonical = profile.summaryOnly ? `https://publicspendingdata.org/municipalities/germany/profile/?code=${encodeURIComponent(profile.code)}` : null;
    if (summaryCanonical) {
      document.querySelector('link[rel="canonical"]')?.setAttribute("href", summaryCanonical);
      document.querySelector('link[rel="alternate"][hreflang="cs"]')?.setAttribute("href", `${summaryCanonical}&lang=cs`);
      document.querySelector('link[rel="alternate"][hreflang="en"]')?.setAttribute("href", `${summaryCanonical}&lang=en`);
      document.querySelector('meta[property="og:url"]')?.setAttribute("content", summaryCanonical);
    }
    // The static Dataset block is emitted once at build time, so without this it kept
    // inLanguage "cs" alongside an English name whichever language the reader chose.
    const ldNode = document.querySelector('script[type="application/ld+json"]');
    if (ldNode) {
      try {
        const ld = JSON.parse(ldNode.textContent);
        ld.inLanguage = lang;
        ld.name = fillTemplate(t.docTitle, { name: profile.name, country: country[lang] }).replace(" — Public Spending Data", "");
        ld.description = fillTemplate(t.docDesc, { name: profile.name, country: country[lang] });
        if (summaryCanonical) {
          ld.url = summaryCanonical;
          ld.spatialCoverage = { "@type": "AdministrativeArea", name: profile.name, addressCountry: country.en };
        }
        ldNode.textContent = JSON.stringify(ld);
      } catch {}
    }
    document.querySelectorAll("[data-lang]").forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const nativeKicker = profile.summaryOnly ? (lang === "en" ? "Published detail" : "Publikovaný detail") : t.nativeKicker;
    const nativeTitle = profile.summaryOnly ? (lang === "en" ? "National headline totals." : "Celostátní souhrnné hodnoty.") : t.nativeTitle;
    const nativeCopy = profile.summaryOnly ? (lang === "en" ? "The national 2025 layer publishes adjusted receipts and payments excluding financing. No item-level city budget is inferred from these totals." : "Celostátní vrstva za rok 2025 publikuje očištěné příjmy a výdaje bez financování. Z těchto součtů nedopočítáváme položkový rozpočet města.") : t.nativeCopy;
    document.querySelector("main").innerHTML = `<nav class="breadcrumbs"><a href="${assetRoot}municipalities/?lang=${lang}">${t.municipalities}</a><span>›</span><a href="${assetRoot}${country.profileRoot || `municipalities/${country.slug}`}/?lang=${lang}">${escapeHtml(country[lang])}</a><span>›</span><strong>${escapeHtml(profile.name)}</strong></nav>
      <section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>${escapeHtml(country[lang])} · ${t.official}</span><h1>${escapeHtml(profile.name)}</h1><p>${t.code} ${escapeHtml(profile.code)}${profile.region ? ` · ${escapeHtml(profile.region)}` : ""}. ${t.sourceCopy}</p><div class="detail-actions"><a class="primary-button" href="#rozpocet">${t.budget} ${latestYear} <b>↓</b></a><a href="#native-detail">${t.nativeKicker}</a><a href="${escapeHtml(profileUrl)}" download>${t.profileData}</a></div></div><aside class="detail-score"><span>${executionRate !== null ? t.executionRate : t.latest}</span><strong>${executionRate !== null ? percentage(executionRate) : latestYear || "—"}</strong><small>${executionRate !== null ? `${t.actual} / ${t.revised}` : escapeHtml(profile.currency)}</small></aside></section>
      <section class="detail-kpis">${[[t.revenue, latest.revenue, latestYear], [t.expenditure, latest.expenditure, latestYear], [t.balance, latest.balance, latestYear], fourthMetric].map(([label, value, note], index) => `<article><span>${label}</span><strong class="${index === 2 && numeric(value) !== null ? (Number(value) >= 0 ? "positive" : "negative") : ""}">${index === 3 && label === t.executionRate ? percentage(value) : money(value)}</strong><small>${numeric(value) !== null ? note : t.noValue}</small></article>`).join("")}</section>
      ${historyMarkup(history)}
      <section class="detail-analysis" id="rozpocet"><div class="detail-section-title"><div><span class="kicker">${t.budgetKicker} ${latestYear}</span><h2>${t.budgetTitle}</h2></div><p>${t.historyCopy}</p></div><article class="detail-panel plan-panel">${stageTableMarkup(profile.normalizedDetail, latestYear)}</article><div class="detail-grid">${mixMarkup(t.revenueMix, revenueMix, ["#a8b63f", "#86b6ff", "#ffb36b"])}${mixMarkup(t.expenditureMix, expenditureMix, ["#171a19", "#47735c", "#d2674d"])}</div>
        <section class="native-detail-explorer" id="native-detail"><div class="breakdown-heading"><div><span class="kicker">${nativeKicker}</span><h2>${nativeTitle}</h2></div><p>${nativeCopy}</p></div><div class="expanded-detail-controls"><label><span>${t.search}</span><input id="profile-detail-search" type="search" placeholder="${t.searchPlaceholder}" value="${escapeHtml(detailQuery)}"></label><label><span>${t.stage}</span><select id="profile-detail-stage"><option value="all">${t.allStages}</option>${stages.map((stage) => `<option value="${escapeHtml(stage)}"${stage === detailStage ? " selected" : ""}>${escapeHtml(t[stage] || stage)}</option>`).join("")}</select></label><label><span>${t.side}</span><select id="profile-detail-side"><option value="all">${t.allSides}</option><option value="revenue"${detailSide === "revenue" ? " selected" : ""}>${t.revenue}</option><option value="expenditure"${detailSide === "expenditure" ? " selected" : ""}>${t.expenditure}</option></select></label><b id="profile-detail-count"></b></div><div class="profile-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(t.nativeTableLabel)}"><table id="profile-detail"></table></div><button id="profile-detail-more" class="load-more" type="button"></button></section>
      </section>
      <section class="data-contract" id="metodika"><div><span class="kicker">${t.sourceKicker}</span><h2>${t.sourceTitle}</h2><p>${t.sourceCopy}</p></div><div class="source-list"><a href="${escapeHtml(document.body.dataset.source)}" target="_blank" rel="noopener"><span>${t.officialSource}</span><strong>${t.open}</strong></a><a href="${escapeHtml(profileUrl)}"><span>${t.profileData}</span><strong>${t.json}</strong></a>${document.body.dataset.historyUrl ? `<a href="${escapeHtml(document.body.dataset.historyUrl)}"><span>${t.historyData}</span><strong>${t.json}</strong></a>` : ""}</div></section>`;
    contextRail();
    renderDetailTable();
    bindControls();
  }

  const fetchJson = (url) => fetch(url).then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); });
  Promise.all([fetchJson(profileUrl), document.body.dataset.historyUrl ? fetchJson(document.body.dataset.historyUrl) : Promise.resolve(null)])
    .then(([data, historyData]) => {
      profile = adaptProfile(data, historyData);
      profile.normalizedDetail = normalizeBrazilRows(profile.detail || []);
      render();
    })
    .catch((error) => {
      console.error(error);
      document.querySelector("main").innerHTML = `<section class="detail-hero"><div><h1>Profile data could not be loaded.</h1></div></section>`;
    });
})();
