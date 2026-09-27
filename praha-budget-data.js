(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PrahaBudgetData = api;
}(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const CITY = Object.freeze({ name: "Praha", country: "CZE", ico: "00064581", territoryCode: "554782", currency: "CZK", cityvizorKey: "cityvizor.praha.eu/4" });
  const PATHS = Object.freeze({ history: "/data/municipal-history/00064581.json", entity: "/data/entities/00064581.json", codebook: "/data/municipal-budget-codebook.v1.json", integration: "/public-data/municipality-cityvizor?ico=00064581", paqIndex: "/data/paq/index.json", paqCatalog: "/data/paq/catalog.json.gz" });
  const YEAR_FIELDS = ["revenue_approved", "revenue_adjusted", "revenue_actual", "expense_approved", "expense_adjusted", "expense_actual", "tax_revenue", "nontax_revenue", "capital_revenue", "transfer_revenue", "current_expense", "capital_expense", "budget_balance", "cash_current", "cash_previous", "population_mid_year", "expense_per_capita"];
  const CONTEXT_KEYS = [
    ["podil_lidi_v_nezamestnanosti", "hodnoty", "Unemployment", "labour"],
    ["dlouhodoba_nezamestnanost", "hodnoty", "Long-term unemployment", "labour"],
    ["index_socialniho_vylouceni", "hodnoty", "Social exclusion index", "social"],
    ["podil_obyvatel_v_exekuci", "hodnoty", "Residents in enforcement proceedings", "social"],
    ["podil_lidi_s_mnohocetnymi_exekucemi", "hodnoty", "Residents with multiple enforcement proceedings", "social"],
    ["najemne_median_m2_mf", "2kk", "Median rent per m² · 2-room apartment", "housing"],
    ["vyplacene_prispevky_na_bydleni", "hodnoty", "Housing benefits paid in an average month", "housing"],
    ["prispevky_na_bydleni_1000_obyvatel", "hodnoty", "Housing benefits per 1,000 residents aged over 15", "housing"],
    ["prumerna_vyse_prispevku_na_bydleni", "hodnoty", "Average housing benefit", "housing"],
    ["odpady_plneni_cilu", "hodnoty", "Waste sorting target achievement", "environment"],
    ["odpady_produkce", "komunalniOdpad", "Municipal waste per resident", "environment"],
    ["odpady_separace", "papirPlastSkloKov", "Sorted paper, plastic, glass and metals per resident", "environment"],
    ["pocet_deti_skolni_vek", "vek_03_05", "Children aged 3–5", "education"],
    ["pocet_deti_skolni_vek", "vek_06_10", "Children aged 6–10", "education"],
    ["pocet_obyvatel", "hodnoty", "Population", "population"],
    ["podil_obyvatel_vek", "65_100", "Residents aged 65 and over", "population"],
    ["zive_narozeni", "hodnoty", "Live births", "population"],
    ["migracni_saldo", "hodnoty", "Net migration", "population"]
  ];
  const number = value => value === null || value === undefined || value === "" || typeof value === "boolean" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const cents = value => number(value) === null ? null : Number(value) / 100;
  const text = value => value === null || value === undefined ? "" : String(value);
  const strip = value => text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const exactYear = value => /^(19|20)\d{2}$/.test(text(value)) ? Number(value) : null;
  const errorInfo = error => ({ status: "unavailable", message: error.message, httpStatus: error.status || null });
  const monitorUrl = year => `https://monitor.statnipokladna.gov.cz/ucetni-jednotka/00064581/rozpocet/souhrnny?obdobi=${String(year).slice(-2)}12&rad=t`;

  function normalizeHistory(payload) {
    if (payload?.municipality?.national_id !== CITY.ico || !Array.isArray(payload.series)) throw new Error("Praha history identity or series is invalid");
    return payload.series.map(row => ({ ...Object.fromEntries(YEAR_FIELDS.map(key => [key, number(row[key])])), year: exactYear(row.year), source_kind: row.source_kind, comparability: row.comparability, unit: "CZK", priceBasis: "nominal", sourceUrl: monitorUrl(row.year), scope: "Prague reporting unit · FIN 2-12 M after consolidation" })).filter(row => row.year !== null).sort((a, b) => a.year - b.year);
  }

  function expandRows(payload) {
    if (!Array.isArray(payload?.rows)) throw new Error("Published layer has no row array");
    return Array.isArray(payload.columns) ? payload.rows.map(row => Object.fromEntries(payload.columns.map((key, index) => [key, row[index]]))) : payload.rows;
  }

  function normalizeBreakdown(entity, codebook) {
    const breakdown = entity?.budget_breakdown;
    if (!breakdown || entity.national_id !== CITY.ico) return [];
    const rows = [];
    for (const [nativeStage, groups] of Object.entries(breakdown.stages || {})) {
      const stage = ({ enacted: "approved", revised: "adjusted", actual: "actual" })[nativeStage];
      if (!stage) continue;
      for (const [key, dimension, side] of [["purpose_expenditure", "functional", "expenditure"], ["economic_expenditure", "economic", "expenditure"], ["economic_revenue", "economic", "revenue"], ["economic_financing", "economic", "financing"]]) {
        for (const [code, amount] of groups[key] || []) {
          const labels = codebook?.dimensions?.[dimension === "functional" ? "purpose" : "economic"]?.[code] || {};
          rows.push({ year: breakdown.fiscal_year, period: breakdown.fiscal_period, code: String(code), name: labels.cs || labels.en || String(code), name_cs: labels.cs || null, name_en: labels.en || null, dimension, side, stage, nativeStage, amount: number(amount), unit: "CZK", source: "monitor", scope: "FIN 2-12 M after consolidation", sourceUrl: monitorUrl(breakdown.fiscal_year) });
        }
      }
    }
    return rows;
  }

  function labelFor(codebook, dimension, code) { return codebook?.dimensions?.[dimension]?.[code]?.cs || text(code); }
  function normalizeAccounting(rows, year, codebook, events = []) {
    const eventNames = new Map(events.map(row => [text(row.event || row.id || row.code), text(row.name || row.title)]));
    return rows.map((row, index) => ({ id: `accounting-${year}-${index}`, year, type: text(row.type), paragraphCode: text(row.paragraph), paragraphName: labelFor(codebook, "purpose", row.paragraph), itemCode: text(row.item), itemName: labelFor(codebook, "economic", row.item), event: text(row.event), eventName: eventNames.get(text(row.event)) || text(row.event), organizationUnit: text(row.unit), income: cents(row.income_actual_cents), expenditure: cents(row.expenditure_actual_cents), budgetIncome: cents(row.income_budget_cents), budgetExpenditure: cents(row.expenditure_budget_cents), unit: "CZK", source: "cityvizor", scope: "Magistrate profile · published accounting slice" }));
  }
  function normalizePayments(rows, year, codebook, events = []) {
    const eventNames = new Map(events.map(row => [text(row.event || row.id || row.code), text(row.name || row.title)]));
    return rows.map((row, index) => ({ id: text(row.row_id || `${year}-${index}`), year, date: row.date || null, counterparty: text(row.counterparty_name), counterpartyId: text(row.counterparty_id), description: text(row.description), paragraphCode: text(row.paragraph), paragraphName: labelFor(codebook, "purpose", row.paragraph), itemCode: text(row.item), itemName: labelFor(codebook, "economic", row.item), event: text(row.event), eventName: eventNames.get(text(row.event)) || text(row.event), organizationUnit: text(row.unit), income: cents(row.income_cents), expenditure: cents(row.expenditure_cents), unit: "CZK", recordClass: "invoice_allocation", scope: "Magistrate invoice-view allocation; not proof of bank payment", source: "cityvizor" }));
  }

  function normalizeContext(index, catalog, shard) {
    const territory = index.regions?.["obec:554782"];
    if (territory?.code !== CITY.territoryCode || territory.level !== "obec" || territory.ico !== CITY.ico) throw new Error("PAQ Praha territory identity is invalid");
    const records = shard[territory.key];
    if (!records) throw new Error("PAQ Praha observations are missing");
    const wanted = new Map(CONTEXT_KEYS.map(([key, variant, name_en, theme]) => [`${key}:${variant}`, { name_en, theme }]));
    const groups = new Map();
    for (const [id, record] of Object.entries(records)) {
      const field = catalog.fields[id];
      if (!field) continue;
      const key = `${field.variable_key}:${field.values_type_key}`, selected = wanted.get(key), year = exactYear(field.period_key);
      if (!selected || year === null) continue;
      const variable = catalog.variables[field.variable_key];
      if (!variable) continue;
      const nativeName = field.values_type_key === "hodnoty" ? variable.name : `${variable.name} · ${field.values_type_name}`;
      if (!groups.has(key)) groups.set(key, { id: key, variableKey: field.variable_key, variant: field.values_type_key, variantName: field.values_type_name, name: nativeName, name_cs: nativeName, ...selected, unit: field.display_unit || "", decimals: field.display_decimal_digits, definition: strip(variable.description), sources: field.sources || variable.sources || [], geography: { level: "obec", code: CITY.territoryCode, name: CITY.name }, annual: true, points: [] });
      groups.get(key).points.push({ year, period: field.period_name, value: number(record.value), unit: field.display_unit || "", sourceUrl: `https://datapaq.cz/?g=obec&v1=${encodeURIComponent(field.variable_key)}&v1t=${encodeURIComponent(field.values_type_key)}&v1p=${encodeURIComponent(field.period_key)}&vis=table`, sourceFieldId: id, recordStatus: number(record.value) === null ? "reported_missing" : "observed", missingExplanation: field.too_little_data_explanation || null });
    }
    const series = [...groups.values()].filter(row => row.points.filter(point => point.value !== null).length >= 3).map(row => {
      row.points.sort((a, b) => a.year - b.year);
      const byYear = new Map(row.points.map(point => [point.year, point]));
      const first = row.points[0].year, last = row.points.at(-1).year;
      // Empty calendar slots preserve visible gaps and equal annual spacing; they are
      // explicitly not source observations or interpolated values.
      row.points = Array.from({ length: last - first + 1 }, (_, offset) => byYear.get(first + offset) || { year: first + offset, period: String(first + offset), value: null, unit: row.unit, sourceUrl: null, sourceFieldId: null, recordStatus: "not_reported", missingExplanation: "No annual observation is supplied for this calendar year." });
      return { ...row, latest: row.points.filter(point => point.value !== null).at(-1), observedYears: row.points.filter(point => point.value !== null).map(point => point.year) };
    }).sort((a, b) => [...wanted.keys()].indexOf(a.id) - [...wanted.keys()].indexOf(b.id));
    return { territory, series, availableObservationCount: Object.keys(records).length, snapshot: index.completed_at, license: index.license, licenseUrl: index.license_url, scope: "Reported municipality-level contextual observations; no causal effect is identified", evidence: { provider: "PAQ Research / DataPAQ", snapshot: index.completed_at, manifestSha256: index.raw_manifest_sha256, territoryKey: territory.key, sourceUrl: "https://datapaq.cz/?g=obec&vis=table" } };
  }

  function createClient(options = {}) {
    const request = options.fetch || globalThis.fetch?.bind(globalThis);
    const base = text(options.baseUrl).replace(/\/$/, "");
    const cache = new Map();
    const urlFor = path => /^https?:\/\//.test(path) ? path : base + path;
    async function json(path, gzip = false) {
      if (!request) throw new Error("Fetch is unavailable");
      const key = `${gzip ? "gzip:" : ""}${path}`;
      if (cache.has(key)) return cache.get(key);
      const pending = (async () => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
        try {
          const response = await request(urlFor(path), { signal: controller.signal, headers: { Accept: "application/json" } });
          if (!response.ok) { const error = new Error(`Published data returned HTTP ${response.status}`); error.status = response.status; throw error; }
          if (!gzip) return await response.json();
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > 8000000) throw new Error("Published context shard exceeds the viewer response limit");
          if (bytes[0] !== 31 || bytes[1] !== 139) return JSON.parse(new TextDecoder().decode(bytes));
          if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress published context data");
          return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).json();
        } finally { clearTimeout(timeout); }
      })();
      cache.set(key, pending);
      try { return await pending; } catch (error) { cache.delete(key); throw error; }
    }
    async function entityData() {
      const payload = await json(PATHS.entity);
      if (payload.entity?.national_id !== CITY.ico) throw new Error("Published Praha entity identity is invalid");
      return payload;
    }
    async function yearSummary(year) {
      if (exactYear(year) === null) throw new Error("A calendar year is required");
      const path = `/public-data/cityvizor/profile?key=${encodeURIComponent(CITY.cityvizorKey)}&year=${year}`;
      const payload = await json(path);
      if (payload.profile?.key !== CITY.cityvizorKey || payload.profile.ico !== CITY.ico) throw new Error("CityVizor Praha identity is invalid");
      const selected = payload.years?.find(row => Number(row.year) === Number(year));
      if (!selected) throw new Error("The selected year is not published");
      return { payload, selected, path };
    }
    async function layer(year, kind, summary) {
      const assets = summary.selected.assets?.[kind] || [];
      if (assets.length > 50) throw new Error("The requested layer exceeds the viewer response limit");
      const rows = [];
      for (const [index, asset] of assets.entries()) {
        const path = `/public-data/cityvizor/shard?key=${encodeURIComponent(CITY.cityvizorKey)}&year=${year}&layer=${kind}&part=${asset.part || index + 1}`;
        const payload = await json(path);
        if (payload.profile_key !== CITY.cityvizorKey || Number(payload.year) !== Number(year) || payload.kind !== kind) throw new Error("Published layer scope is invalid");
        rows.push(...expandRows(payload));
      }
      const expected = number(summary.selected[kind]?.rows);
      if (expected !== null && expected !== rows.length) throw new Error("Published layer does not match its declared row count");
      return rows;
    }
    async function loadOverview() {
      const [historyPayload, entityResult, integrationResult] = await Promise.all([json(PATHS.history), entityData().then(value => ({ value }), error => ({ error })), json(PATHS.integration).then(value => ({ value }), error => ({ error }))]);
      const history = normalizeHistory(historyPayload), entity = entityResult.value?.entity || null, integration = integrationResult.value || null;
      return { city: CITY, history, latest: history.at(-1), entity, definitions: historyPayload.definitions, cityvizor: integration, coverage: { budgetYears: history.map(row => row.year), detailYears: entity?.budget_breakdown ? [entity.budget_breakdown.fiscal_year] : [], invoiceYears: integration?.municipality_profiles?.find(row => row.key === CITY.cityvizorKey)?.payment_years || [], cityvizor: integrationResult.error ? errorInfo(integrationResult.error) : { status: "available", release: integration.release_id }, entity: entityResult.error ? errorInfo(entityResult.error) : { status: "available" }, contracts: { status: "held_not_published", joinedToBudget: false, acceptedRows: 115429, completedAt: "2026-09-21T00:52:20.294787+00:00", auditedAt: "2026-09-27", sourceQuery: "icoPlatce:00064581", receiptId: "628f5121-6622-4dab-a99b-47fb1f3f8dd5", normalizedSha256: "b96f132d6b8d23caf8267bf28ec514cd3504a4979aef35606d0486344b9c364d", parentCampaignStatus: "failed_after_partial_completion", publicationStatus: "not_published_individually" } }, evidence: [{ provider: "Czech Ministry of Finance · FIN 2-12 M", datasetId: historyPayload.dataset_id, generatedAt: historyPayload.generated_at, sourceUrl: monitorUrl(history.at(-1)?.year), unit: "CZK", scope: "Prague reporting unit, after consolidation; not a group balance sheet of all city-owned organizations" }, ...(entity?.budget_stage_lineage ? [{ provider: "Published budget detail", ...entity.budget_stage_lineage }] : [])] };
    }
    async function loadYearDetail(year) {
      year = exactYear(year);
      if (year === null) throw new Error("A calendar year is required");
      const [entityResult, codebook, summaryResult] = await Promise.all([entityData().then(value => ({ value }), error => ({ error })), json(PATHS.codebook).catch(() => null), yearSummary(year).then(value => ({ value }), error => ({ error }))]);
      const allRows = normalizeBreakdown(entityResult.value?.entity, codebook), rows = allRows.filter(row => row.year === year);
      let accountingRows = [], eventRows = [], layerError = null;
      if (summaryResult.value) {
        try {
          const [accounting, events] = await Promise.all([layer(year, "accounting", summaryResult.value), layer(year, "events", summaryResult.value)]);
          eventRows = events; accountingRows = normalizeAccounting(accounting, year, codebook, events);
        } catch (error) { layerError = errorInfo(error); }
      }
      const summary = summaryResult.value?.selected || null;
      return { year, rows, accountingRows, events: eventRows.map(row => ({ code: text(row.event || row.id || row.code), name: text(row.name || row.title), income: cents(row.income_actual_cents), expenditure: cents(row.expenditure_actual_cents), budgetIncome: cents(row.income_budget_cents), budgetExpenditure: cents(row.expenditure_budget_cents) })), paragraphs: (summary?.accounting?.by_paragraph || []).map(row => ({ code: text(row.key), name: row.label || labelFor(codebook, "purpose", row.key), income: cents(row.income_actual_cents), expenditure: cents(row.expenditure_actual_cents), budgetIncome: cents(row.income_budget_cents), budgetExpenditure: cents(row.expenditure_budget_cents) })), sourceValidity: summary?.source_validity || null, invoiceSummary: summary?.payments || null, accountingTotals: summary?.accounting?.totals || null, annualFinance: summary?.annual_finance || null, coverage: { fullBudgetBreakdown: rows.length > 0, fullBudgetYear: entityResult.value?.entity?.budget_breakdown?.fiscal_year || null, accounting: layerError || (summaryResult.error ? errorInfo(summaryResult.error) : { status: "available", rows: accountingRows.length }), reconciliation: "CityVizor is an overlapping magistrate publication with a different reporting scope; it is not added to or assumed to reconcile with FIN 2-12 M", crossClassification: "Only magistrate accounting rows have a reported paragraph × economic item relationship" }, evidence: { monitor: rows.length ? { ...entityResult.value.entity.budget_breakdown.lineage, sourceUrl: monitorUrl(year) } : null, cityvizor: summaryResult.value ? { releaseId: summaryResult.value.payload.release_id, profileKey: CITY.cityvizorKey, sourceValidity: summary?.source_validity, sourceUrl: "https://cityvizor.praha.eu/magistrat", sourceSha256: summary?.source_bulk_export?.sha256, receivedAt: summary?.source_bulk_export?.retrieved_at } : null } };
    }
    async function loadPayments(year) {
      year = exactYear(year);
      if (year === null) throw new Error("A calendar year is required");
      const [summary, codebook] = await Promise.all([yearSummary(year), json(PATHS.codebook).catch(() => null)]);
      const [payments, events] = await Promise.all([layer(year, "payments", summary), layer(year, "events", summary)]);
      return { year, rows: normalizePayments(payments, year, codebook, events), summary: summary.selected.payments, sourceValidity: summary.selected.source_validity, coverage: { status: "available", rows: payments.length, scope: "Magistrate published invoice allocations, not all municipal payments", canReconcileToBudget: false }, evidence: { provider: "CityVizor", releaseId: summary.payload.release_id, profileKey: CITY.cityvizorKey, sourceUrl: "https://cityvizor.praha.eu/magistrat", sourceSha256: summary.selected.source_bulk_export?.sha256, receivedAt: summary.selected.source_bulk_export?.retrieved_at } };
    }
    async function loadContext() {
      const [index, catalog] = await Promise.all([json(PATHS.paqIndex), json(PATHS.paqCatalog, true)]);
      const region = index.regions?.["obec:554782"];
      if (!region?.shard || !/^[A-Za-z0-9._/-]+\.json\.gz$/.test(region.shard) || region.shard.includes("..")) throw new Error("PAQ territory shard is invalid");
      return normalizeContext(index, catalog, await json(`/data/paq/${region.shard}`, true));
    }
    return { loadOverview, loadYearDetail, loadPayments, loadContext, clearCache: () => cache.clear() };
  }
  let defaultClient;
  return { CITY, PATHS, createClient, normalizeHistory, normalizeBreakdown, normalizeAccounting, normalizePayments, normalizeContext, number, loadOverview: (...args) => (defaultClient ||= createClient()).loadOverview(...args), loadYearDetail: (...args) => (defaultClient ||= createClient()).loadYearDetail(...args), loadPayments: (...args) => (defaultClient ||= createClient()).loadPayments(...args), loadContext: (...args) => (defaultClient ||= createClient()).loadContext(...args) };
}));
