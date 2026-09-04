(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "/";
  const requested = new URLSearchParams(location.search).get("lang");
  const requestedProfileCode = new URLSearchParams(location.search).get("code");
  const franceDepartment = (code) => /^(971|972|973|974|976)/.test(code || "") ? code.slice(0, 3) : (code || "").slice(0, 2);
  // Which country and municipality this page is. Snapshot-served pages name it outright; the
  // 29,597 static pages carry it in the profile URL they fetch, and are read that way rather
  // than regenerated to add an attribute. Either way a null here means no warehouse detail.
  const warehouseTarget = (() => {
    const { warehouseCountry, warehouseCode } = document.body.dataset;
    if (warehouseCountry && warehouseCode) return { country: warehouseCountry, code: warehouseCode };
    const match = /\/municipal-expansion\/([a-z]{3})\/([^/]+)\.json(?:\?|$)/.exec(document.body.dataset.profileUrl || "");
    return match ? { country: match[1].toUpperCase(), code: decodeURIComponent(match[2]) } : null;
  })();
  const profileUrl = document.body.dataset.profileRoot
    ? `${document.body.dataset.profileRoot}${franceDepartment(requestedProfileCode)}.v1.json`
    : document.body.dataset.profileUrl;
  let lang = requested === "cs" || requested === "en" ? requested : (document.documentElement.lang === "en" ? "en" : "cs");
  let profile;
  let detailQuery = "";
  let detailStage = "all";
  let detailSide = "expenditure";
  let detailDimension = "economic";
  let detailYear = "all";
  let visualShown = 12;
  let detailShown = 160;
  let fxData = null;
  let displayCurrency = "EUR";
  try {
    const storedCurrency = localStorage.getItem("psd-international-municipal-currency");
    if (["native", "EUR", "USD"].includes(storedCurrency)) displayCurrency = storedCurrency;
  } catch {}

  const copy = {
    cs: {
      municipalities: "Obce", official: "oficiální obecní finance", code: "Národní kód", latest: "Poslední období",
      revenue: "Příjmy", expenditure: "Výdaje", balance: "Saldo", debt: "Dluh", cashBalance: "Stav účtů", executionRate: "Plnění výdajů", execution: "Čerpání",
      trend: "Vývoj", historyTitle: "Rozpočet v čase", historyCopy: "Nominální hodnoty v místní měně. Jednotlivé fáze rozpočtu zůstávají oddělené.",
      onePeriod: "Jeden dostupný rok", onePeriodCopy: "Zdroj zatím poskytuje jeden srovnatelný roční profil. Další roky se zde objeví bez změny rozvržení stránky.",
      budgetKicker: "Rozpočet", budgetTitle: "Plán a skutečnost.", stage: "Fáze", enacted: "Schválený", revised: "Upravený",
      actual: "Skutečnost", cash: "Zaplaceno", paid: "Zaplaceno", committed: "Závazky",
      carried_over: "Převedené závazky", period: "V období", remaining: "Zbývá", allStages: "Všechny fáze",
      revenueMix: "Struktura příjmů", expenditureMix: "Struktura výdajů", nativeKicker: "Kam peníze jdou",
      nativeTitle: "Příjmy a výdaje v detailu", docTitle: "{name} — rozpočet obce, {country} — Public Spending Data", docDesc: "{name}, {country}: oficiální obecní příjmy, výdaje, saldo, rozpočtové fáze a původní položkový detail.", nativeCopy: "Přepněte mezi příjmy a výdaji a procházejte konkrétní účely. Délka pruhu porovnává velikost vykázaných položek; původní názvy a kódy zůstávají zachované.", nativeTableLabel: "Tabulka zdrojových položek, vodorovně posuvná",
      search: "Hledat položku", searchPlaceholder: "Kód nebo název…", side: "Strana", allSides: "Obě strany", amount: "Částka",
      incomeTab: "Příjmy", spendingTab: "Výdaje", specificItems: "Konkrétní položky", compareNote: "Pruhy porovnávají absolutní velikost vykázaných řádků, nikoli podíl z uměle sečteného celku.", noItems: "Pro zvolené filtry nejsou dostupné žádné položky.", rawRows: "Zdrojové řádky", rawRowsOpen: "Otevřít auditní tabulku", visualMore: "Zobrazit další položky",
      account: "Kód / položka", year: "Rok", allYears: "Všechny roky", shown: "zobrazeno", more: "Načíst další zdrojové řádky", sourceKicker: "Data a metodika",
      sourceTitle: "Zdroje a data", sourceCopy: "Rozsah odpovídá oficiálnímu obecnímu výkazu. Chybějící hotovost, dluh nebo historie se nedopočítávají.",
      officialSource: "Oficiální zdroj", approvedBudget: "Zveřejněný schválený rozpočet", regionalAccounts: "Oficiální účty regionů", profileData: "Strojová data", open: "Otevřít ↗", json: "JSON ↗", noValue: "Není v načtené národní vrstvě",
      displayCurrency: "Měna zobrazení", nativeCurrency: "Původní", fxCopy: "Přepočet pouze pro zobrazení; zdrojová data zůstávají v původní měně.", fxRate: "Roční kurz IMF WEO", fxLatest: "nejbližší dostupný rok",
      sumOfResults: "Součet výsledků za {years} let", historyData: "Historická data", methodWarning: "Saldo je v celé řadě konsolidované. Stav účtů má metodický zlom v roce 2012. Chybějící rok není nula — pro dnešní IČO se v daném roce nenašla data.", latestPeriod: "Poslední období", overview: "Přehled", budget: "Rozpočet", accounts: "Účty", detail: "Detail", coverage: "Rozsah", method: "Metodika", plzenSpecial: "Speciál: smlouvy a platby ↗",
    },
    en: {
      municipalities: "Municipalities", official: "official municipal finance", code: "National code", latest: "Latest period",
      revenue: "Revenue", expenditure: "Expenditure", balance: "Balance", debt: "Debt", cashBalance: "Cash balance", executionRate: "Expenditure execution", execution: "Execution",
      trend: "Trend", historyTitle: "Budget over time", historyCopy: "Nominal values in local currency. Budget stages remain separate.",
      onePeriod: "One year available", onePeriodCopy: "The source currently provides one comparable annual profile. Additional years can appear here without changing the page layout.",
      budgetKicker: "Budget", budgetTitle: "Plan and actual.", stage: "Budget stage", enacted: "Approved", revised: "Amended",
      actual: "Actual", cash: "Paid", paid: "Paid", committed: "Committed",
      carried_over: "Carried-over payables", period: "In period", remaining: "Remaining", allStages: "All stages",
      revenueMix: "Revenue mix", expenditureMix: "Expenditure mix", nativeKicker: "Where the money goes",
      nativeTitle: "Revenue and spending in detail", docTitle: "{name} — {country} municipal budget — Public Spending Data", docDesc: "{name}, {country}: official municipal revenue, expenditure, balance, budget stages and native item-level detail.", nativeCopy: "Switch between income and spending, then explore the specific purposes reported by the source. Bar length compares reported line magnitude; native labels and codes stay intact.", nativeTableLabel: "Source item table, scrolls horizontally",
      search: "Search items", searchPlaceholder: "Code or label…", side: "Side", allSides: "Both sides", amount: "Amount",
      incomeTab: "Income / revenue", spendingTab: "Spending / expenditure", specificItems: "Specific items", compareNote: "Bars compare the absolute magnitude of reported lines, not a share of an artificially summed total.", noItems: "No items are available for these filters.", rawRows: "Source rows", rawRowsOpen: "Open raw audit table", visualMore: "Show more items",
      account: "Code / item", year: "Year", allYears: "All years", shown: "shown", more: "Load more source rows", sourceKicker: "Data and methodology",
      sourceTitle: "Sources and data", sourceCopy: "Coverage follows the official municipal return. Missing cash, debt or history is not estimated.",
      officialSource: "Official source", approvedBudget: "Published approved budget", regionalAccounts: "Official regional accounts", profileData: "Machine-readable data", open: "Open ↗", json: "JSON ↗", noValue: "Not available in the loaded national layer",
      displayCurrency: "Display currency", nativeCurrency: "Native", fxCopy: "Display conversion only; source data remain in the native currency.", fxRate: "IMF WEO annual rate", fxLatest: "nearest available year",
      sumOfResults: "Sum of results over {years} years", historyData: "Historical data", methodWarning: "The fiscal balance is consolidated throughout the series. Cash has a methodological break in 2012. A missing year is not zero—no data were found for the current registration ID in that year.", latestPeriod: "Latest period", overview: "Overview", budget: "Budget", accounts: "Accounts", detail: "Detail", coverage: "Coverage", method: "Method", plzenSpecial: "Special: contracts and payments ↗",
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
    FRA: { cs: "Francie", en: "France", slug: "france" },
    CZE: { cs: "Česko", en: "Czechia", slug: "czechia", profileRoot: "cz/municipalities" },
    POL: { cs: "Polsko", en: "Poland", slug: "poland" },
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  // Title and description are translated like any other string: interpolating a
  // hardcoded English fragment produced Czech pages titled "… Česko municipal budget".
  const fillTemplate = (template, values) => String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const percentage = (value) => Number.isFinite(value) ? new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value) : "—";
  const nearestAnnual = (values, requestedYear) => {
    const years = Object.keys(values || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!years.length) return null;
    const target = Number(requestedYear);
    const year = Number.isFinite(target) ? years.reduce((best, candidate) => Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best, years[0]) : years.at(-1);
    return { year, value: values[year] };
  };
  const conversion = (year) => {
    const sourceCurrency = profile?.currency || "EUR";
    const targetCurrency = displayCurrency === "native" ? sourceCurrency : displayCurrency;
    if (sourceCurrency === targetCurrency) return { factor: 1, currency: targetCurrency, rateYear: Number(year) || null, status: "native" };
    if (!fxData) return { factor: 1, currency: sourceCurrency, rateYear: null, status: "unavailable" };
    const euro = nearestAnnual(fxData.eur_per_usd, year);
    if (!euro) return { factor: 1, currency: sourceCurrency, rateYear: null, status: "unavailable" };
    if (sourceCurrency === "USD") return { factor: euro.value, currency: "EUR", rateYear: euro.year, status: "actual" };
    if (sourceCurrency === "EUR") return { factor: 1 / euro.value, currency: "USD", rateYear: euro.year, status: "actual" };
    let countryRates = fxData.rates?.[profile.country];
    if (countryRates?.currency !== sourceCurrency) countryRates = Object.values(fxData.rates || {}).find((entry) => entry.currency === sourceCurrency);
    const local = nearestAnnual(countryRates?.years, year);
    if (!local?.value?.local_per_usd) return { factor: 1, currency: sourceCurrency, rateYear: null, status: "unavailable" };
    const factor = targetCurrency === "USD" ? 1 / local.value.local_per_usd : euro.value / local.value.local_per_usd;
    return { factor, currency: targetCurrency, rateYear: local.year, status: local.value.status || "estimate" };
  };
  const formatMoney = (value, currency, compact = true) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", {
    style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 2 : 0,
  }).format(value);
  const money = (value, compact = true, year = null) => {
    const amount = numeric(value);
    if (amount === null) return "—";
    const applied = conversion(year ?? profile.latest?.year ?? profile.years?.at(-1));
    return formatMoney(amount * applied.factor, applied.currency, compact);
  };

  function adaptProfile(data, historyData = null, frenchLines = null, warehouseLines = null, itemLabels = null) {
    const warehouseDetail = (warehouseLines?.lines || []).map((row) => {
      const labels = itemLabels?.countries?.[warehouseLines.country] || {};
      const polishLabel = warehouseLines.country === "POL"
        ? itemLabels?.localized?.POL?.[row.side]?.[String(row.code || "").slice(0, 3)]
        : null;
      const nativeName = row.name_native || polishLabel?.pl || labels[row.code] || row.code;
      const englishName = row.name_en || polishLabel?.en || null;
      return {
        year: row.year,
        stage: row.stage,
        side: row.side,
        code: row.code,
        name_native: nativeName,
        name_en: englishName,
        name_cs: row.name_cs || null,
        name: englishName || nativeName,
        amount: row.amount,
        ...(row.dimension ? { dimension: row.dimension } : {}),
        ...(row.period && row.period !== "FY" ? { period: row.period } : {}),
      };
    });
    if (data.country?.code === "FRA" && data.profiles) {
      const entity = data.profiles[requestedProfileCode];
      if (!entity) throw new Error(`Unknown French commune ${requestedProfileCode || "(missing code)"}`);
      const history = [...(entity.history || [])].sort((a, b) => Number(a.year) - Number(b.year));
      const latest = history.at(-1) || {};
      const detail = [];
      history.forEach((row) => {
        const otherRevenue = numeric(row.revenue) !== null && numeric(row.operating_revenue) !== null ? Number(row.revenue) - Number(row.operating_revenue) : null;
        const otherExpenditure = numeric(row.expenditure) !== null && numeric(row.operating_expenditure) !== null ? Number(row.expenditure) - Number(row.operating_expenditure) : null;
        [
          ["revenue", "TOTAL_REVENUE", "Total revenue", row.revenue],
          ["revenue", "OPERATING_REVENUE", "Operating revenue", row.operating_revenue],
          ["revenue", "OTHER_RECEIPTS", "Other receipts, including investment and financing", otherRevenue],
          ["expenditure", "TOTAL_EXPENDITURE", "Total expenditure", row.expenditure],
          ["expenditure", "OPERATING_EXPENDITURE", "Operating expenditure", row.operating_expenditure],
          ["expenditure", "OTHER_PAYMENTS", "Other payments, including investment and financing", otherExpenditure],
        ].filter((item) => numeric(item[3]) !== null).forEach(([side, code, name, amount]) => detail.push({ year: Number(row.year), stage: "actual", side, code, name, amount }));
      });
      const lineDetail = [
        ...(frenchLines?.economic || []).map((row) => ({ ...row, dimension: "economic", code: row.code, name: row.name_en })),
        ...(frenchLines?.functional || []).map((row) => ({ ...row, dimension: "functional", code: row.code, name: row.name_en })),
      ];
      return {
        ...entity, country: "FRA", currency: entity.currency || data.country.currency || "EUR", history, latest,
        detail: [...detail.map((row) => ({ ...row, dimension: "summary" })), ...lineDetail], summaryOnly: true,
        franceLineCoverage: frenchLines?.coverage || null,
        detail_url: frenchLines ? `/public-data/france-municipality-lines?code=${encodeURIComponent(requestedProfileCode)}` : null,
        detail_source_url: frenchLines?.source_url || null,
        functional_source_url: frenchLines?.functional_source_url || null,
      };
    }
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
        years: history.map((row) => row.year), history, latest,
        detail: warehouseDetail.length
          ? [...detail.map((row) => ({ ...row, dimension: "summary" })), ...warehouseDetail]
          : detail,
        source_url: entity.sources?.budget || data.sources?.budget || warehouseLines?.source_url || null,
        ...(warehouseDetail.length ? {
          classificationCoverage: warehouseLines.coverage || null,
          detail_source: "warehouse",
          detail_url: `/public-data/municipality-lines?country=${encodeURIComponent(warehouseLines.country)}&code=${encodeURIComponent(warehouseLines.entity_code)}`,
          detail_source_url: warehouseLines.source_url || data.sources?.budget || null,
        } : {}),
      };
    }
    if (Array.isArray(data.detail) || warehouseLines) {
      // Prefer the warehouse. It is the same layer the static file holds, on one grain
      // shared with every other country, with published totals and intra-budgetary
      // transfers already excluded — so a reader summing what is shown cannot double-count.
      // Item names live in the label registry rather than being repeated on every row,
      // which is what made the per-municipality files 580 MB.
      if (warehouseLines?.lines?.length) {
        return {
          ...data,
          detail: warehouseDetail,
          classificationCoverage: warehouseLines.coverage?.dimensions ? warehouseLines.coverage : null,
          detail_source: "warehouse",
          detail_url: `/public-data/municipality-lines?country=${encodeURIComponent(warehouseLines.country)}&code=${encodeURIComponent(warehouseLines.entity_code)}`,
          detail_source_url: warehouseLines.source_url || null,
        };
      }
      return { ...data, detail: (data.detail || []).map((row) => ({ ...row })) };
    }
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

  function normalizeRows(rows) {
    if (profile.country === "JPN") return rows.map((row) => {
      if (row.side) return { ...row };
      const label = `${row.name || ""} ${row.table_title || ""}`;
      const side = /歳入/.test(label) ? "revenue" : /歳出|経費|人件費/.test(label) ? "expenditure" : "other";
      return { ...row, side };
    });
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

  function localizedRows(rows) {
    return normalizeRows(rows).map((row) => ({
      ...row,
      name: row[`name_${lang}`] || row.name_native || row.name || row.code,
    }));
  }

  function itemLabelMarkup(row, fallback) {
    const primary = row.name || row.column || row.code || fallback;
    const native = row.name_native && row.name_native !== primary ? row.name_native : null;
    return { primary, native };
  }

  // Brazil's execution lifecycle in the order money moves through it, so the selector reads
  // as a sequence rather than an alphabetical list.
  const stageOrder = ["enacted", "revised", "committed", "actual", "paid", "cash", "carried_over", "period", "remaining"];
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
    // Denmark's authorized-account cube contains overlapping groups and
    // financing flows, so a native line must never be promoted to a total.
    if (profile.country === "DNK") return null;
    // Poland's headline rule is authored as the gross sum of a side at one stage, and its
    // Rb-27S/Rb-28S paragraphs do not nest, so the sum is the total. Checked against the
    // server's own figure: the actual rows for 0202062 add to 71,792,317 against a published
    // 71,792,316.59. Falling through to the largest single line instead read 14.4m as the
    // amended budget and put a 497.8% execution rate on the page.
    if (profile.country === "POL") return candidates.reduce((sum, row) => sum + Number(row.amount), 0);
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

  function currencyControlMarkup(latestYear) {
    if (!fxData) return "";
    const t = copy[lang];
    const applied = conversion(latestYear);
    const converted = displayCurrency !== "native" && applied.currency === displayCurrency;
    const fallback = converted && Number(applied.rateYear) !== Number(latestYear) ? ` · ${t.fxLatest}` : "";
    const method = converted ? `${t.fxRate} ${applied.rateYear}${fallback}` : `${t.nativeCurrency} · ${profile.currency}`;
    const sourceUrl = fxData.source?.download_page || fxData.source?.url || "";
    return `<section class="profile-currency-converter" aria-label="${escapeHtml(t.displayCurrency)}"><div><span>${t.displayCurrency}</span><strong>${escapeHtml(method)}</strong><small>${t.fxCopy}</small></div><div class="profile-currency-options" role="group" aria-label="${escapeHtml(t.displayCurrency)}">${[["native", `${t.nativeCurrency} · ${profile.currency}`], ["EUR", "EUR"], ["USD", "USD"]].map(([currency, label]) => `<button type="button" data-profile-currency="${currency}" class="${displayCurrency === currency ? "active" : ""}" aria-pressed="${displayCurrency === currency}">${escapeHtml(label)}</button>`).join("")}</div>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(fxData.source?.provider || "IMF")} ↗</a>` : ""}</section>`;
  }

  function historyMarkup(history) {
    const t = copy[lang];
    const methodWarning = profile.country === "FRA"
      ? (lang === "en" ? "These are OFGL main-budget executed-account aggregates. The 2025 accounts are provisional; a missing year is not zero." : "Jde o souhrny OFGL ze skutečných účtů hlavního rozpočtu. Účty za rok 2025 jsou předběžné; chybějící rok není nula.")
      : t.methodWarning;
    const fourthLabel = history.some((row) => numeric(row.cash) !== null) ? t.cashBalance : t.debt;
    const fourthValue = (row) => numeric(row.cash) !== null ? row.cash : row.debt;
    if (history.length <= 1) {
      const row = history[0] || {};
      return `<section class="history-explorer single-period-history" id="history-explorer"><div class="directory-title"><div><span class="kicker">${t.onePeriod}</span><h2>${t.historyTitle}</h2></div><p>${t.onePeriodCopy}</p></div><div class="history-kpis">${[[t.revenue, row.revenue], [t.expenditure, row.expenditure], [t.balance, row.balance], [fourthLabel, fourthValue(row)]].map(([label, value]) => `<article><span>${label}</span><strong>${money(value, true, row.year)}</strong><small>${row.year || "—"}</small></article>`).join("")}</div></section>`;
    }
    const convertedTotal = history.reduce((sum, entry) => {
      const amount = numeric(entry.balance);
      if (amount === null) return sum;
      return sum + amount * conversion(entry.year).factor;
    }, 0);
    const totalCurrency = conversion(history.at(-1)?.year).currency;
    return `<section class="history-explorer" id="history-explorer"><div class="directory-title"><div><span class="kicker">${t.trend} · ${history.at(0)?.year || ""}–${history.at(-1)?.year || ""}</span><h2>${t.historyTitle}</h2></div><p>${t.historyCopy}</p><p class="method-warning">${methodWarning}</p></div><div class="history-kpis" id="history-kpis"><article class="history-total"><span>${fillTemplate(t.sumOfResults, { years: history.length })}</span><strong>${formatMoney(convertedTotal, totalCurrency)}</strong><small>${history.at(0)?.year}–${history.at(-1)?.year}</small></article></div><details class="history-table" open><summary>${t.historyTitle}</summary><div class="profile-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(t.historyTitle)}"><table><thead><tr><th>${t.year}</th><th>${t.revenue}</th><th>${t.expenditure}</th><th>${t.balance}</th><th>${fourthLabel}</th></tr></thead><tbody id="history-table-body">${[...history].reverse().map((row) => `<tr><th>${row.year}</th><td>${money(row.revenue, false, row.year)}</td><td>${money(row.expenditure, false, row.year)}</td><td>${money(row.balance, false, row.year)}</td><td>${money(fourthValue(row), false, row.year)}</td></tr>`).join("")}</tbody></table></div></details></section>`;
  }

  function stageTableMarkup(rows, latestYear) {
    const t = copy[lang];
    const yearRows = rows.filter((row) => row.year === latestYear);
    const actual = profile.history?.find((row) => Number(row.year) === Number(latestYear));
    const stages = ["enacted", "revised", "actual"].map((stage) => {
      // Warehouse detail excludes some totals and intra-budgetary transfers.
      // Keep audited snapshot totals consistent with the headline cards.
      const revenue = stage === "actual" && actual ? numeric(actual.revenue) : headline(yearRows, stage, "revenue");
      const expenditure = stage === "actual" && actual ? numeric(actual.expenditure) : headline(yearRows, stage, "expenditure");
      return { stage, revenue, expenditure, balance: revenue !== null && expenditure !== null ? revenue - expenditure : null };
    }).filter((row) => row.revenue !== null || row.expenditure !== null);
    if (!stages.length) return `<p class="profile-empty-note">${t.noValue}</p>`;
    const note = profile.detail_source === "warehouse" ? `<p class="native-visual-note">${lang === "en" ? "Actual totals follow the audited profile. Detailed source rows retain their original scope and execution stages and may not reconcile to these totals." : "Skutečné součty odpovídají ověřenému profilu. Detailní zdrojové řádky zachovávají původní rozsah a fáze plnění a nemusí se s těmito součty shodovat."}</p>` : "";
    return `${note}<div class="budget-stage-scroll" tabindex="0"><table class="budget-stage-table"><caption>${t.budgetTitle} · ${latestYear}</caption><thead><tr><th>${t.stage}</th><th>${t.revenue}</th><th>${t.expenditure}</th><th>${t.balance}</th></tr></thead><tbody>${stages.map((row) => `<tr class="budget-stage-${row.stage}"><th>${t[row.stage] || row.stage}</th><td>${money(row.revenue, false)}</td><td>${money(row.expenditure, false)}</td><td class="${numeric(row.balance) !== null && row.balance < 0 ? "negative" : "positive"}">${money(row.balance, false)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function detailRows() {
    const query = detailQuery.trim().toLocaleLowerCase();
    return profile.normalizedDetail.filter((row) => {
      const dimensionMatches = !(profile.franceLineCoverage || profile.classificationCoverage?.dimensions)
        || row.dimension === detailDimension;
      return dimensionMatches && (detailYear === "all" || String(row.year) === detailYear) && (detailStage === "all" || row.stage === detailStage) && row.side === detailSide && (!query || [row.code, row.name, row.name_native, row.column, row.table_title, row.side].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
    });
  }

  function visualDetailRows() {
    const totals = headlinePatterns[profile.country]?.[detailSide];
    const unique = new Map();
    detailRows().forEach((row) => {
      if (numeric(row.amount) === null) return;
      if (String(row.code || "").startsWith("TOTAL_")) return;
      if (totals?.test(String(row.name || ""))) return;
      const key = [row.year, row.stage, row.side, row.code, row.name, row.column, row.table_title, row.amount].join("\u0000");
      if (!unique.has(key)) unique.set(key, row);
    });
    return [...unique.values()].sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
  }

  function visualDetailMarkup() {
    const t = copy[lang];
    const rows = visualDetailRows();
    const maximum = rows.reduce((max, row) => Math.max(max, Math.abs(Number(row.amount))), 0);
    const visible = rows.slice(0, visualShown);
    const items = visible.map((row, index) => {
      const width = maximum ? Math.max(1.5, Math.abs(Number(row.amount)) / maximum * 100) : 0;
      const label = itemLabelMarkup(row, t.specificItems);
      const meta = [label.native, row.code, row.table_title, row.column && row.column !== row.name ? row.column : null].filter(Boolean).join(" · ");
      return `<article class="native-visual-row"><div class="native-visual-rank">${String(index + 1).padStart(2, "0")}</div><div class="native-visual-body"><div class="native-visual-label"><div><strong>${escapeHtml(label.primary)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</div><b>${money(Math.abs(Number(row.amount)), true, row.year)}</b></div><div class="native-visual-track"><i style="width:${width.toFixed(2)}%"></i></div></div></article>`;
    }).join("");
    return `<div class="native-visual-summary"><span>${t.specificItems}</span><strong>${new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(rows.length)}</strong></div><div class="native-visual-list" id="profile-detail-visual">${items || `<p class="profile-empty-note">${t.noItems}</p>`}</div><p class="native-visual-note">${t.compareNote}</p><button id="profile-visual-more" class="load-more" type="button"${visualShown >= rows.length ? " hidden" : ""}>${t.visualMore}</button>`;
  }

  function renderDetailTable() {
    if (!profile) return;
    const t = copy[lang];
    const rows = detailRows();
    const table = document.querySelector("#profile-detail");
    if (!table) return;
    table.innerHTML = `<thead><tr><th>${t.year}</th><th>${t.stage}</th><th>${t.side}</th><th>${t.account}</th><th>${t.amount}</th></tr></thead><tbody>${rows.slice(0, detailShown).map((row) => {
      const label = itemLabelMarkup(row, "");
      const secondary = [label.native, row.column && row.column !== row.name ? row.column : null].filter(Boolean).join(" · ");
      return `<tr><td>${row.year}</td><td>${escapeHtml(t[row.stage] || row.stage)}</td><td>${escapeHtml(row.side === "revenue" ? t.revenue : row.side === "expenditure" ? t.expenditure : row.side || "")}</td><td><b>${escapeHtml(row.code)} · ${escapeHtml(label.primary)}</b>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ""}</td><td>${money(row.amount, false, row.year)}</td></tr>`;
    }).join("")}</tbody>`;
    document.querySelector("#profile-detail-count").textContent = `${new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(Math.min(detailShown, rows.length))} / ${new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB").format(rows.length)} ${t.shown}`;
    const more = document.querySelector("#profile-detail-more");
    more.textContent = t.more;
    more.hidden = detailShown >= rows.length;
  }

  function refreshDetailExplorer() {
    const visual = document.querySelector("#profile-detail-visual-wrap");
    if (visual) visual.innerHTML = visualDetailMarkup();
    renderDetailTable();
    document.querySelector("#profile-visual-more")?.addEventListener("click", () => { visualShown += 12; refreshDetailExplorer(); });
  }

  function contextRail() {
    document.querySelector(".international-context-rail")?.remove();
    const t = copy[lang];
    const history = profile.history || [];
    const hasHistory = history.some((row) => ["revenue", "expenditure", "balance", "cash", "debt"].some((key) => numeric(row[key]) !== null));
    const hasDetail = profile.normalizedDetail.length > 0;
    const hasPlan = profile.normalizedDetail.some((row) => row.stage === "enacted" || row.stage === "revised");
    const hasFinance = hasDetail || history.some((row) => numeric(row.revenue) !== null || numeric(row.expenditure) !== null);
    const links = [["overview", t.overview]];
    if (hasHistory) links.push(["history-explorer", t.trend]);
    if (hasFinance) links.push(["rozpocet", hasPlan ? t.budget : t.accounts]);
    if (hasDetail) links.push(["native-detail", profile.summaryOnly ? t.coverage : t.detail]);
    links.push(["metodika", t.method]);
    const rail = document.createElement("nav");
    rail.className = "context-rail municipal-context-rail international-context-rail";
    rail.setAttribute("aria-label", lang === "en" ? "Page sections" : "Sekce stránky");
    rail.innerHTML = links.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");
    document.querySelector("psd-site-header")?.insertAdjacentElement("afterend", rail);
  }

  function franceDetailPresentation() {
    const t = copy[lang];
    const frenchSummary = profile.summaryOnly && profile.country === "FRA";
    if (!frenchSummary || !profile.franceLineCoverage) return {
      kicker: profile.summaryOnly ? (lang === "en" ? "Published detail" : "Publikovaný detail") : t.nativeKicker,
      title: frenchSummary ? (lang === "en" ? "Official OFGL aggregates" : "Oficiální souhrny OFGL") : profile.summaryOnly ? (lang === "en" ? "National headline totals" : "Celostátní souhrnné hodnoty") : t.nativeTitle,
      body: frenchSummary
        ? (lang === "en" ? "OFGL computes these main-budget aggregates from DGFiP accounts. Operating amounts and the remaining investment and financing flows are shown without inventing item-level detail." : "OFGL tyto souhrny hlavního rozpočtu počítá z účtů DGFiP. Provozní hodnoty a zbývající investiční a finanční toky ukazujeme bez domýšlení položkového detailu.")
        : profile.summaryOnly ? (lang === "en" ? "The national 2025 layer publishes adjusted receipts and payments excluding financing. No item-level city budget is inferred from these totals." : "Celostátní vrstva za rok 2025 publikuje očištěné příjmy a výdaje bez financování. Z těchto součtů nedopočítáváme položkový rozpočet města.") : t.nativeCopy,
      controls: "",
    };
    const coverage = profile.franceLineCoverage;
    const number = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB");
    const title = detailDimension === "functional"
      ? (lang === "en" ? "Spending by public purpose" : "Výdaje podle veřejného účelu")
      : (lang === "en" ? "Spending by economic account" : "Výdaje podle ekonomického účtu");
    const body = detailDimension === "functional"
      ? (lang === "en" ? "Functional codes answer which public purpose the money served. This layer appears only for communes that report the nature-by-function cross-classification." : "Funkční kódy ukazují, jakému veřejnému účelu peníze sloužily. Tato vrstva je dostupná jen u obcí, které vykazují křížovou klasifikaci podle druhu a funkce.")
      : (lang === "en" ? "Economic accounts show what kind of input, service, transfer or asset the commune paid for. They are official executed-account entries, not inferred categories." : "Ekonomické účty ukazují, za jaký druh vstupu, služby, transferu nebo majetku obec zaplatila. Jde o oficiální položky skutečných účtů, nikoli dopočítané kategorie.");
    const functionalStatus = coverage.functional_purpose_detail
      ? `${number.format(coverage.functional_line_count)} ${lang === "en" ? "reported lines" : "vykázaných položek"}`
      : (lang === "en" ? "Not reported for this commune" : "Tato obec jej nevykazuje");
    return {
      kicker: lang === "en" ? "DGFiP executed-account lines" : "Položky skutečných účtů DGFiP",
      title,
      body,
      controls: `<div class="france-detail-contract"><div><strong>${lang === "en" ? "Economic-account detail" : "Detail ekonomických účtů"}</strong><span>${number.format(coverage.economic_line_count)} ${lang === "en" ? "reported lines" : "vykázaných položek"}</span></div><div class="${coverage.functional_purpose_detail ? "available" : "unavailable"}"><strong>${lang === "en" ? "Functional-purpose detail" : "Detail veřejného účelu"}</strong><span>${functionalStatus}</span></div></div><div class="detail-dimension-tabs" role="group" aria-label="${lang === "en" ? "Detail classification" : "Klasifikace detailu"}"><button type="button" data-detail-dimension="economic" class="${detailDimension === "economic" ? "active" : ""}" aria-pressed="${detailDimension === "economic"}">${lang === "en" ? "Economic account" : "Ekonomický účet"}</button><button type="button" data-detail-dimension="functional" class="${detailDimension === "functional" ? "active" : ""}" aria-pressed="${detailDimension === "functional"}"${coverage.functional_purpose_detail ? "" : " disabled"}>${lang === "en" ? "Public purpose" : "Veřejný účel"}</button></div>`,
    };
  }

  function czechDetailPresentation() {
    const coverage = profile.country === "CZE" ? profile.classificationCoverage : null;
    if (!coverage?.dimensions) return null;
    const number = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB");
    const functional = detailDimension === "functional";
    const title = functional
      ? (lang === "en" ? "Spending by public purpose" : "Výdaje podle veřejného účelu")
      : (lang === "en" ? "Revenue and spending by economic item" : "Příjmy a výdaje podle rozpočtové položky");
    const body = functional
      ? (lang === "en" ? "Functional paragraphs show which public service or purpose the municipality funded. These are official FIN 2-12 M classifications, with consolidation transfers removed." : "Funkční paragrafy ukazují, kterou veřejnou službu nebo účel obec financovala. Jde o oficiální klasifikaci FIN 2-12 M bez konsolidačních převodů.")
      : (lang === "en" ? "Economic items show what kind of receipt, input, transfer or asset was reported. Switch classifications without adding the two views together." : "Rozpočtové položky ukazují druh příjmu, vstupu, transferu nebo majetku. Obě klasifikace jsou dva pohledy na stejné peníze a nesčítají se.");
    const economicCount = Number(coverage.dimensions.economic || 0);
    const functionalCount = Number(coverage.dimensions.functional || 0);
    return {
      kicker: lang === "en" ? "Ministry of Finance line items" : "Položky Ministerstva financí",
      title,
      body,
      controls: `<div class="france-detail-contract"><div><strong>${lang === "en" ? "Economic-item detail" : "Detail rozpočtových položek"}</strong><span>${number.format(economicCount)} ${lang === "en" ? "reported lines" : "vykázaných řádků"}</span></div><div class="available"><strong>${lang === "en" ? "Functional-purpose detail" : "Detail veřejného účelu"}</strong><span>${number.format(functionalCount)} ${lang === "en" ? "reported lines" : "vykázaných řádků"}</span></div></div><div class="detail-dimension-tabs" role="group" aria-label="${lang === "en" ? "Detail classification" : "Klasifikace detailu"}"><button type="button" data-detail-dimension="functional" class="${functional ? "active" : ""}" aria-pressed="${functional}">${lang === "en" ? "Public purpose" : "Veřejný účel"}</button><button type="button" data-detail-dimension="economic" class="${functional ? "" : "active"}" aria-pressed="${!functional}">${lang === "en" ? "Economic item" : "Rozpočtová položka"}</button></div>`,
    };
  }

  function detailSourceLinks(t) {
    if (profile.franceLineCoverage) {
      return `${profile.detail_source_url ? `<a href="${escapeHtml(profile.detail_source_url)}" target="_blank" rel="noopener"><span>${lang === "en" ? "DGFiP accounting balances" : "Účetní bilance DGFiP"}</span><strong>${t.open}</strong></a>` : ""}${profile.detail_url ? `<a href="${escapeHtml(profile.detail_url)}"><span>${lang === "en" ? "Detailed account data" : "Detailní účetní data"}</span><strong>${t.json}</strong></a>` : ""}`;
    }
    return profile.detail_url
      ? `<a href="${escapeHtml(profile.detail_url)}"><span>${lang === "en" ? "Detailed line-item data" : "Detailní položková data"}</span><strong>${t.json}</strong></a>`
      : "";
  }

  function bindControls() {
    const resetAndRefresh = () => { visualShown = 12; detailShown = 160; refreshDetailExplorer(); };
    document.querySelectorAll("[data-profile-currency]").forEach((button) => button.addEventListener("click", () => {
      displayCurrency = button.dataset.profileCurrency;
      try { localStorage.setItem("psd-international-municipal-currency", displayCurrency); } catch {}
      render();
    }));
    document.querySelector("#profile-detail-search")?.addEventListener("input", (event) => { detailQuery = event.target.value; resetAndRefresh(); });
    document.querySelector("#profile-detail-stage")?.addEventListener("change", (event) => { detailStage = event.target.value; resetAndRefresh(); });
    document.querySelector("#profile-detail-year")?.addEventListener("change", (event) => { detailYear = event.target.value; resetAndRefresh(); });
    document.querySelectorAll("[data-detail-side]").forEach((button) => button.addEventListener("click", () => {
      detailSide = button.dataset.detailSide;
      document.querySelectorAll("[data-detail-side]").forEach((candidate) => {
        const active = candidate.dataset.detailSide === detailSide;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      resetAndRefresh();
    }));
    document.querySelectorAll("[data-detail-dimension]").forEach((button) => button.addEventListener("click", () => {
      detailDimension = button.dataset.detailDimension;
      visualShown = 12;
      detailShown = 160;
      render();
    }));
    document.querySelector("#profile-detail-more")?.addEventListener("click", () => { detailShown += 160; renderDetailTable(); });
    document.querySelector("#profile-visual-more")?.addEventListener("click", () => { visualShown += 12; refreshDetailExplorer(); });
    document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
      lang = button.dataset.lang;
      const next = new URL(location.href);
      next.searchParams.set("lang", lang);
      history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
      profile.normalizedDetail = localizedRows(profile.detail || []);
      render();
    }, { once: true }));
  }

  function render() {
    const t = copy[lang];
    const country = countries[profile.country] || { cs: profile.country, en: profile.country, slug: String(profile.country || "").toLocaleLowerCase() };
    const history = [...(profile.history || [])].sort((a, b) => Number(a.year) - Number(b.year));
    const latest = [...history].reverse().find((row) => numeric(row.revenue) !== null || numeric(row.expenditure) !== null) || history.at(-1) || {};
    const latestYear = latest.year || Math.max(...(profile.years || []).map(Number));
    // The Czech endpoint publishes two complete views over the same facts. Headline cards and
    // mixes continue to use the reconciled snapshot rows; the two itemised dimensions belong in
    // the explorer and must never be summed into those totals.
    const financialDetail = profile.country === "CZE" && profile.classificationCoverage?.dimensions
      ? profile.normalizedDetail.filter((row) => row.dimension === "summary")
      : profile.normalizedDetail.filter((row) => row.dimension !== "functional");
    const yearRows = financialDetail.filter((row) => row.year === latestYear);
    const revisedExpenditure = headline(yearRows, "revised", "expenditure");
    const actualExpenditure = numeric(latest.expenditure) ?? headline(yearRows, "actual", "expenditure");
    const executionRate = revisedExpenditure && actualExpenditure !== null ? actualExpenditure / revisedExpenditure : null;
    const fourthMetric = numeric(latest.cash) !== null ? [t.cashBalance, latest.cash, latestYear] : numeric(latest.debt) !== null ? [t.debt, latest.debt, latestYear] : [t.executionRate, executionRate, t.latestPeriod];
    const revenueMix = mixRows(financialDetail, "revenue", latestYear);
    const expenditureMix = mixRows(financialDetail, "expenditure", latestYear);
    const classifiedDetail = profile.normalizedDetail.filter((row) => !(profile.franceLineCoverage || profile.classificationCoverage?.dimensions) || row.dimension === detailDimension);
    const stages = [...new Set(classifiedDetail.map((row) => row.stage).filter(Boolean))].sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));
    const detailYears = [...new Set(classifiedDetail.map((row) => Number(row.year)).filter(Number.isFinite))].sort((a, b) => b - a);

    document.documentElement.lang = lang;
    document.body.classList.add("cz-budget-page", "detail-page", "international-municipality-profile");
    document.title = fillTemplate(t.docTitle, { name: profile.name, country: country[lang] });
    document.querySelector('meta[name="description"]')?.setAttribute("content", fillTemplate(t.docDesc, { name: profile.name, country: country[lang] }));
    const summaryCanonical = profile.summaryOnly ? `https://publicspendingdata.org/municipalities/${country.slug}/profile/?code=${encodeURIComponent(profile.code)}` : null;
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

    const frenchSummary = profile.summaryOnly && profile.country === "FRA";
    const presentation = czechDetailPresentation() || franceDetailPresentation();
    const nativeKicker = presentation.kicker || (profile.summaryOnly ? (lang === "en" ? "Published detail" : "Publikovaný detail") : t.nativeKicker);
    const nativeTitle = presentation.title || (profile.summaryOnly ? (lang === "en" ? "National headline totals" : "Celostátní souhrnné hodnoty") : t.nativeTitle);
    const nativeCopy = presentation.body || (profile.summaryOnly ? (lang === "en" ? "The national 2025 layer publishes adjusted receipts and payments excluding financing. No item-level city budget is inferred from these totals." : "Celostátní vrstva za rok 2025 publikuje očištěné příjmy a výdaje bez financování. Z těchto součtů nedopočítáváme položkový rozpočet města.") : t.nativeCopy);
    const plzenSpecial = profile.country === "CZE" && profile.code === "00075370"
      ? `<a href="${assetRoot}deep-dives/plzen-contracts/?lang=${lang}">${t.plzenSpecial}</a>`
      : "";
    document.querySelector("main").innerHTML = `<nav class="breadcrumbs"><a href="${assetRoot}municipalities/?lang=${lang}">${t.municipalities}</a><span>›</span><a href="${assetRoot}${country.profileRoot || `municipalities/${country.slug}`}/?lang=${lang}">${escapeHtml(country[lang])}</a><span>›</span><strong>${escapeHtml(profile.name)}</strong></nav>
      <section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>${escapeHtml(country[lang])} · ${t.official}</span><h1>${escapeHtml(profile.name)}</h1><p>${t.code} ${escapeHtml(profile.code)}${profile.region ? ` · ${escapeHtml(profile.region)}` : ""}. ${t.sourceCopy}</p><div class="detail-actions"><a class="primary-button" href="#rozpocet">${t.budget} ${latestYear} <b>↓</b></a><a href="#native-detail">${t.nativeKicker}</a>${plzenSpecial}<a href="${escapeHtml(profileUrl)}" download>${t.profileData}</a></div></div><aside class="detail-score"><span>${executionRate !== null ? t.executionRate : t.latest}</span><strong>${executionRate !== null ? percentage(executionRate) : latestYear || "—"}</strong><small>${executionRate !== null ? `${t.actual} / ${t.revised}` : escapeHtml(profile.currency)}</small></aside></section>
      <section class="detail-kpis">${[[t.revenue, latest.revenue, latestYear], [t.expenditure, latest.expenditure, latestYear], [t.balance, latest.balance, latestYear], fourthMetric].map(([label, value, note], index) => `<article><span>${label}</span><strong class="${index === 2 && numeric(value) !== null ? (Number(value) >= 0 ? "positive" : "negative") : ""}">${index === 3 && label === t.executionRate ? percentage(value) : money(value)}</strong><small>${numeric(value) !== null ? note : t.noValue}</small></article>`).join("")}</section>
      ${currencyControlMarkup(latestYear)}
      ${historyMarkup(history)}
      <section class="detail-analysis" id="rozpocet"><div class="detail-section-title"><div><span class="kicker">${t.budgetKicker} ${latestYear}</span><h2>${t.budgetTitle}</h2></div><p>${t.historyCopy}</p></div><article class="detail-panel plan-panel">${stageTableMarkup(financialDetail, latestYear)}</article><div class="detail-grid">${mixMarkup(t.revenueMix, revenueMix, ["#a8b63f", "#86b6ff", "#ffb36b"])}${mixMarkup(t.expenditureMix, expenditureMix, ["#171a19", "#47735c", "#d2674d"])}</div>
        <section class="native-detail-explorer" id="native-detail"><div class="breakdown-heading"><div><span class="kicker">${nativeKicker}</span><h2>${nativeTitle}</h2></div><p>${nativeCopy}</p></div>${presentation.controls}<div class="detail-side-tabs" role="group" aria-label="${escapeHtml(t.side)}"><button type="button" data-detail-side="expenditure" class="${detailSide === "expenditure" ? "active" : ""}" aria-pressed="${detailSide === "expenditure"}">${t.spendingTab}</button><button type="button" data-detail-side="revenue" class="${detailSide === "revenue" ? "active" : ""}" aria-pressed="${detailSide === "revenue"}">${t.incomeTab}</button></div><div class="expanded-detail-controls"><label><span>${t.search}</span><input id="profile-detail-search" type="search" placeholder="${t.searchPlaceholder}" value="${escapeHtml(detailQuery)}"></label><label><span>${t.year}</span><select id="profile-detail-year"><option value="all">${t.allYears}</option>${detailYears.map((year) => `<option value="${year}"${String(year) === detailYear ? " selected" : ""}>${year}</option>`).join("")}</select></label><label><span>${t.stage}</span><select id="profile-detail-stage"><option value="all">${t.allStages}</option>${stages.map((stage) => `<option value="${escapeHtml(stage)}"${stage === detailStage ? " selected" : ""}>${escapeHtml(t[stage] || stage)}</option>`).join("")}</select></label></div><div id="profile-detail-visual-wrap">${visualDetailMarkup()}</div><details class="raw-detail-audit"><summary><span>${t.rawRows}</span><strong>${t.rawRowsOpen} · <b id="profile-detail-count"></b></strong></summary><div class="profile-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(t.nativeTableLabel)}"><table id="profile-detail"></table></div><button id="profile-detail-more" class="load-more" type="button"></button></details></section>
      </section>
      <section class="data-contract" id="metodika"><div><span class="kicker">${t.sourceKicker}</span><h2>${t.sourceTitle}</h2><p>${t.sourceCopy}</p></div><div class="source-list"><a href="${escapeHtml(profile.source_url || document.body.dataset.source)}" target="_blank" rel="noopener"><span>${t.officialSource}</span><strong>${t.open}</strong></a>${detailSourceLinks(t)}${profile.approved_budget_url ? `<a href="${escapeHtml(profile.approved_budget_url)}" target="_blank" rel="noopener"><span>${t.approvedBudget} ${escapeHtml(profile.approved_budget_year)}</span><strong>${t.open}</strong></a>` : ""}${profile.region_source_url ? `<a href="${escapeHtml(profile.region_source_url)}" target="_blank" rel="noopener"><span>${t.regionalAccounts}</span><strong>${t.open}</strong></a>` : ""}<a href="${escapeHtml(profileUrl)}"><span>${t.profileData}</span><strong>${t.json}</strong></a>${document.body.dataset.historyUrl ? `<a href="${escapeHtml(document.body.dataset.historyUrl)}"><span>${t.historyData}</span><strong>${t.json}</strong></a>` : ""}</div></section>`;
    contextRail();
    renderDetailTable();
    bindControls();
  }

  const fetchJson = (url) => fetch(url).then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); });
  Promise.all([
    fetchJson(profileUrl),
    document.body.dataset.historyUrl ? fetchJson(document.body.dataset.historyUrl) : Promise.resolve(null),
    fetchJson(new URL("data/municipal-fx-rates.v1.json", assetRoot).href).catch(() => null),
    document.body.dataset.profileRoot && requestedProfileCode
      ? fetchJson(`/public-data/france-municipality-lines?code=${encodeURIComponent(requestedProfileCode)}`).catch((error) => { console.error("French municipal line detail", error); return null; })
      : Promise.resolve(null),
    // The warehouse view of this municipality, and the labels its codes resolve through.
    // Both fail soft: a country not yet loaded, or an endpoint that is down, leaves the
    // committed profile serving the page exactly as before.
    warehouseTarget
      ? fetchJson(`/public-data/municipality-lines?country=${encodeURIComponent(warehouseTarget.country)}&code=${encodeURIComponent(warehouseTarget.code)}`).catch(() => null)
      : Promise.resolve(null),
    warehouseTarget
      ? fetchJson(new URL("data/registry/municipal-item-labels.v1.json?v=20260902-polish-labels", assetRoot).href).catch(() => null)
      : Promise.resolve(null),
  ])
    .then(([data, historyData, rates, frenchLines, warehouseLines, itemLabels]) => {
      fxData = rates;
      profile = adaptProfile(data, historyData, frenchLines, warehouseLines, itemLabels);
      if (profile.country === "CZE" && profile.classificationCoverage?.dimensions?.functional) detailDimension = "functional";
      if (displayCurrency !== "native" && conversion(profile.latest?.year ?? profile.years?.at(-1)).currency !== displayCurrency) displayCurrency = "native";
      profile.normalizedDetail = localizedRows(profile.detail || []);
      const availableSides = new Set(profile.normalizedDetail.map((row) => row.side));
      detailSide = availableSides.has("expenditure") ? "expenditure" : availableSides.has("revenue") ? "revenue" : "other";
      const years = profile.normalizedDetail.map((row) => Number(row.year)).filter(Number.isFinite);
      detailYear = years.length ? String(Math.max(...years)) : "all";
      const sideYearRows = profile.normalizedDetail.filter((row) => row.side === detailSide && String(row.year) === detailYear);
      detailStage = sideYearRows.some((row) => row.stage === "actual") ? "actual" : sideYearRows[0]?.stage || "all";
      render();
    })
    .catch((error) => {
      console.error(error);
      document.querySelector("main").innerHTML = `<section class="detail-hero"><div><h1>Profile data could not be loaded.</h1></div></section>`;
    });
})();
