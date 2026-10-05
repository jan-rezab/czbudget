(function (root, factory) {
  "use strict";
  const extensions = typeof module === "object" && module.exports ? require("./municipal-budget-extensions.js") : root.MunicipalBudgetExtensions;
  const api = factory(extensions);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MunicipalBudgetData = api;
}(typeof globalThis === "object" ? globalThis : this, function (extensions) {
  "use strict";

  // One published-data client for every Czech municipality, keyed by IČO. Three tiers:
  // every municipality has the MONITOR history, the budget breakdown and PAQ context;
  // a few dozen also publish CityVizor records; a few carry an extension (Prague).
  const PATHS = Object.freeze({ codebook: "/data/municipal-budget-codebook.v1.json", paqIndex: "/data/paq/index.json", paqCatalog: "/data/paq/catalog.json.gz", cityvizorIndex: "/public-data/cityvizor/index" });
  const pathsFor = ico => ({ history: `/data/municipal-history/${ico}.json`, entity: `/data/entities/${ico}.json`, integration: `/public-data/municipality-cityvizor?ico=${ico}` });
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
  const IT_CODES = ["5042", "5168", "5172", "6111", "6125", "5162"];
  const number = value => value === null || value === undefined || value === "" || typeof value === "boolean" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const cents = value => number(value) === null ? null : Number(value) / 100;
  const text = value => value === null || value === undefined ? "" : String(value);
  const strip = value => text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const exactYear = value => /^(19|20)\d{2}$/.test(text(value)) ? Number(value) : null;
  const validIco = value => /^\d{8}$/.test(text(value));
  const errorInfo = error => ({ status: "unavailable", message: error.message, httpStatus: error.status || null });
  const monitorUrl = (ico, year) => `https://monitor.statnipokladna.gov.cz/ucetni-jednotka/${ico}/rozpocet/souhrnny?obdobi=${String(year).slice(-2)}12&rad=t`;
  const balanceSheetUrl = (ico, year) => `https://monitor.statnipokladna.gov.cz/ucetni-jednotka/${ico}/prehled?obdobi=${String(year).slice(-2)}12`;

  function normalizeHistory(payload, ico) {
    if (!validIco(ico) || payload?.municipality?.national_id !== ico || !Array.isArray(payload.series)) throw new Error("Municipal history identity or series is invalid");
    return payload.series.map(row => ({ ...Object.fromEntries(YEAR_FIELDS.map(key => [key, number(row[key])])), year: exactYear(row.year), source_kind: row.source_kind, comparability: row.comparability, unit: "CZK", priceBasis: "nominal", sourceUrl: monitorUrl(ico, row.year), scope: "Reporting unit · FIN 2-12 M after consolidation" })).filter(row => row.year !== null).sort((a, b) => a.year - b.year);
  }

  function expandRows(payload) {
    if (!Array.isArray(payload?.rows)) throw new Error("Published layer has no row array");
    return Array.isArray(payload.columns) ? payload.rows.map(row => Object.fromEntries(payload.columns.map((key, index) => [key, row[index]]))) : payload.rows;
  }

  function normalizeBreakdown(entity, codebook, ico, labels) {
    const breakdown = entity?.budget_breakdown;
    if (!breakdown || entity.national_id !== ico) return [];
    const rows = [];
    for (const [nativeStage, groups] of Object.entries(breakdown.stages || {})) {
      const stage = ({ enacted: "approved", revised: "adjusted", actual: "actual" })[nativeStage];
      if (!stage) continue;
      for (const [key, dimension, side] of [["purpose_expenditure", "functional", "expenditure"], ["economic_expenditure", "economic", "expenditure"], ["economic_revenue", "economic", "revenue"], ["economic_financing", "economic", "financing"]]) {
        for (const [code, amount] of groups[key] || []) {
          const dictionary = dimension === "functional" ? "purpose" : "economic";
          const cs = codebook?.dimensions?.[dictionary]?.[code]?.cs || null;
          const en = codebook?.dimensions?.[dictionary]?.[code]?.en || labels?.[dictionary]?.[code] || null;
          rows.push({ year: breakdown.fiscal_year, period: breakdown.fiscal_period, code: String(code), name: cs || en || String(code), name_cs: cs, name_en: en, dimension, side, stage, nativeStage, amount: number(amount), unit: "CZK", source: "monitor", scope: "FIN 2-12 M after consolidation", sourceUrl: monitorUrl(ico, breakdown.fiscal_year) });
        }
      }
    }
    return rows;
  }

  function labelFor(codebook, dimension, code) { return codebook?.dimensions?.[dimension]?.[code]?.cs || text(code); }
  function eventNamesFor(events) { return new Map(events.map(row => [text(row.event || row.id || row.code), text(row.name || row.title)])); }
  function normalizeAccounting(rows, year, codebook, events = []) {
    const eventNames = eventNamesFor(events);
    return rows.map((row, index) => ({ id: `accounting-${year}-${index}`, year, type: text(row.type), paragraphCode: text(row.paragraph), paragraphName: labelFor(codebook, "purpose", row.paragraph), itemCode: text(row.item), itemName: labelFor(codebook, "economic", row.item), event: text(row.event), eventName: eventNames.get(text(row.event)) || text(row.event), organizationUnit: text(row.unit), income: cents(row.income_actual_cents), expenditure: cents(row.expenditure_actual_cents), budgetIncome: cents(row.income_budget_cents), budgetExpenditure: cents(row.expenditure_budget_cents), unit: "CZK", source: "cityvizor", scope: "Published accounting slice of one CityVizor profile" }));
  }
  function normalizePayments(rows, year, codebook, events = []) {
    const eventNames = eventNamesFor(events);
    return rows.map((row, index) => ({ id: text(row.row_id || `${year}-${index}`), year, date: row.date || null, counterparty: text(row.counterparty_name), counterpartyId: text(row.counterparty_id), description: text(row.description), paragraphCode: text(row.paragraph), paragraphName: labelFor(codebook, "purpose", row.paragraph), itemCode: text(row.item), itemName: labelFor(codebook, "economic", row.item), event: text(row.event), eventName: eventNames.get(text(row.event)) || text(row.event), organizationUnit: text(row.unit), income: cents(row.income_cents), expenditure: cents(row.expenditure_cents), unit: "CZK", recordClass: "invoice_allocation", scope: "Invoice-view allocation; not proof of bank payment", source: "cityvizor" }));
  }

  function normalizeJoint(payload, ico, year, codebook, labels) {
    if (payload?.country !== "CZE" || payload.entity_code !== ico || !Array.isArray(payload.joint_lines)) throw new Error("Joint budget identity or publication is invalid");
    return payload.joint_lines.filter(row => Number(row.year) === year).map(row => {
      if (row.dimension !== "joint" || !["revenue", "expenditure"].includes(row.side) || !["enacted", "revised", "actual"].includes(row.stage) || row.reporting_scope !== "standalone_accounting_unit" || row.currency !== "CZK" || !/^\d{4}$/.test(String(row.economic_code)) || (row.functional_code && !/^\d{4}$/.test(String(row.functional_code))) || number(row.amount) === null) throw new Error("Joint budget row scope is invalid");
      return { ...row, stage: ({ enacted: "approved", revised: "adjusted", actual: "actual" })[row.stage], amount: number(row.amount), purposeName: labels?.purpose?.[row.functional_code] || labelFor(codebook, "purpose", row.functional_code), itemName: labels?.economic?.[row.economic_code] || labelFor(codebook, "economic", row.economic_code) };
    });
  }
  function reconcileJoint(joint, marginal) {
    if (!joint.length) return { status: "not_published", checks: [] };
    const checks = [];
    for (const stage of ["approved", "adjusted", "actual"]) for (const [side, dimension, field] of [["expenditure", "economic", "economic_code"], ["expenditure", "functional", "functional_code"], ["revenue", "economic", "economic_code"]]) {
      const parents = marginal.filter(row => row.stage === stage && row.side === side && row.dimension === dimension);
      const cells = joint.filter(row => row.stage === stage && row.side === side);
      const sums = new Map();
      for (const row of cells) { const code = row[field]; if (code) sums.set(code, (sums.get(code) || 0) + Math.round(row.amount * 100)); }
      const expected = new Map(parents.map(row => [row.code, Math.round(row.amount * 100)]));
      const codes = new Set([...sums.keys(), ...expected.keys()]);
      const residuals = [...codes].filter(code => (sums.get(code) || 0) !== (expected.get(code) || 0));
      checks.push({ stage, side, dimension, passed: parents.length > 0 && cells.length > 0 && residuals.length === 0, mismatchedCodes: residuals });
    }
    return { status: checks.every(check => check.passed) ? "reconciled" : "unreconciled", checks };
  }

  function normalizeContext(index, catalog, shard, city) {
    const key = `obec:${city.territoryCode}`, territory = index.regions?.[key];
    if (territory?.code !== city.territoryCode || territory.level !== "obec" || territory.ico !== city.ico) throw new Error("PAQ territory identity is invalid");
    const records = shard[territory.key];
    if (!records) throw new Error("PAQ observations are missing");
    const wanted = new Map(CONTEXT_KEYS.map(([variable, variant, name_en, theme]) => [`${variable}:${variant}`, { name_en, theme }]));
    const groups = new Map();
    for (const [id, record] of Object.entries(records)) {
      const field = catalog.fields[id];
      if (!field) continue;
      const fieldKey = `${field.variable_key}:${field.values_type_key}`, selected = wanted.get(fieldKey), year = exactYear(field.period_key);
      if (!selected || year === null) continue;
      const variable = catalog.variables[field.variable_key];
      if (!variable) continue;
      const nativeName = field.values_type_key === "hodnoty" ? variable.name : `${variable.name} · ${field.values_type_name}`;
      if (!groups.has(fieldKey)) groups.set(fieldKey, { id: fieldKey, variableKey: field.variable_key, variant: field.values_type_key, variantName: field.values_type_name, name: nativeName, name_cs: nativeName, ...selected, unit: field.display_unit || "", decimals: field.display_decimal_digits, definition: strip(variable.description), sources: field.sources || variable.sources || [], geography: { level: "obec", code: city.territoryCode, name: city.name }, annual: true, points: [] });
      groups.get(fieldKey).points.push({ year, period: field.period_name, value: number(record.value), unit: field.display_unit || "", sourceUrl: `https://datapaq.cz/?g=obec&v1=${encodeURIComponent(field.variable_key)}&v1t=${encodeURIComponent(field.values_type_key)}&v1p=${encodeURIComponent(field.period_key)}&vis=table`, sourceFieldId: id, recordStatus: number(record.value) === null ? "reported_missing" : "observed", missingExplanation: field.too_little_data_explanation || null });
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

  // The municipality's own records profile: the extension's pinned key, else the one
  // CityVizor profile under exactly this IČO whose name is the municipality's own.
  // Districts of statutory cities can publish under the city's IČO (Brno - Medlánky
  // under Brno); their records are not the city's, so a name mismatch attaches nothing.
  const bareName = value => text(value).toLocaleLowerCase("cs").replace(/^(statutární město|hlavní město|město|městys|obec)\s+/, "").replace(/\s+/g, " ").trim();
  function resolveRecordsProfile(integration, ico, extension, names = []) {
    const profiles = (integration?.municipality_profiles || []).filter(profile => profile.type === "municipality" && profile.ico === ico);
    if (extension?.cityvizorKey) return profiles.find(profile => profile.key === extension.cityvizorKey) || null;
    const own = new Set(names.map(bareName).filter(Boolean));
    const matches = profiles.filter(profile => own.has(bareName(profile.name)));
    return matches.length === 1 ? matches[0] : null;
  }

  function createClient(options = {}) {
    const ico = text(options.ico);
    if (!validIco(ico)) throw new Error("An eight-digit IČO is required");
    const paths = pathsFor(ico), extension = extensions.forIco(ico);
    const request = options.fetch || globalThis.fetch?.bind(globalThis);
    const base = text(options.baseUrl).replace(/\/$/, "");
    const labels = options.labels || globalThis.CzBudgetLabels || null;
    const cache = new Map();
    let overview = null;
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
      const payload = await json(paths.entity);
      if (payload.entity?.national_id !== ico) throw new Error("Published entity identity is invalid");
      return payload;
    }
    async function profileYear(year, profileKey, profileIco) {
      if (exactYear(year) === null) throw new Error("A calendar year is required");
      const path = `/public-data/cityvizor/profile?key=${encodeURIComponent(profileKey)}&year=${year}`;
      const payload = await json(path);
      if (payload.profile?.key !== profileKey || (profileIco && payload.profile.ico !== profileIco)) throw new Error("CityVizor profile identity is invalid");
      const selected = payload.years?.find(row => Number(row.year) === Number(year));
      if (!selected) throw new Error("The selected year is not published");
      return { payload, selected, path };
    }
    async function layer(year, kind, summary) {
      const metadata = kind === "pbo_payment_source_rows" ? summary.selected.alternate_pbo_payment_source_view : summary.selected[kind];
      const assets = kind === "pbo_payment_source_rows" ? metadata?.assets || [] : summary.selected.assets?.[kind] || [];
      if (assets.length > 50) throw new Error("The requested layer exceeds the viewer response limit");
      const rows = [];
      for (const [index, asset] of assets.entries()) {
        const profileKey = summary.payload.profile.key;
        const path = `/public-data/cityvizor/shard?key=${encodeURIComponent(profileKey)}&year=${year}&layer=${kind}&part=${asset.part || index + 1}`;
        const payload = await json(path);
        if (payload.profile_key !== profileKey || Number(payload.year) !== Number(year) || payload.kind !== (kind === "pbo_payment_source_rows" ? "pbo-payment-source" : kind)) throw new Error("Published layer scope is invalid");
        rows.push(...expandRows(payload));
      }
      const expected = number(metadata?.rows);
      if (expected !== null && expected !== rows.length) throw new Error("Published layer does not match its declared row count");
      return rows;
    }
    async function recordsProfile() {
      const current = overview || await loadOverview();
      if (!current.records) throw new Error("This municipality publishes no records profile");
      return current.records;
    }
    async function loadOverview() {
      if (overview) return overview;
      const [historyPayload, entityResult, integrationResult] = await Promise.all([json(paths.history), entityData().then(value => ({ value }), error => ({ error })), json(paths.integration).then(value => ({ value }), error => ({ error }))]);
      const history = normalizeHistory(historyPayload, ico), entity = entityResult.value?.entity || null, integration = integrationResult.value || null;
      const records = resolveRecordsProfile(integration, ico, extension, [entity?.short_name, entity?.name, historyPayload.municipality?.name]);
      const city = { ico, name: entity?.short_name || historyPayload.municipality?.name || ico, officialName: entity?.name || historyPayload.municipality?.name || ico, type: entity?.entity_type || "municipality", region: entity?.territory?.region_name || null, district: entity?.territory?.district_name || null, territoryCode: text(entity?.territory?.municipality_code) || null, profilePath: entity?.seo?.path || null, population: number(entity?.population?.value), currency: "CZK" };
      overview = {
        city, extension, history, latest: history.at(-1), entity, definitions: historyPayload.definitions, cityvizor: integration, records,
        coverage: {
          budgetYears: history.map(row => row.year),
          detailYears: entity?.budget_breakdown ? [entity.budget_breakdown.fiscal_year] : [],
          recordYears: records?.available_years || [],
          invoiceYears: records?.payment_years || [],
          cityvizor: integrationResult.error ? errorInfo(integrationResult.error) : { status: records ? "available" : "not_published", release: integration?.release_id || null },
          entity: entityResult.error ? errorInfo(entityResult.error) : { status: "available" },
          contracts: extension?.contracts || null,
        },
        evidence: [{ provider: "Czech Ministry of Finance · FIN 2-12 M", datasetId: historyPayload.dataset_id, generatedAt: historyPayload.generated_at, sourceUrl: monitorUrl(ico, history.at(-1)?.year), unit: "CZK", scope: "Reporting unit after consolidation; not a group balance sheet of all city-owned organisations" }, ...(entity?.budget_stage_lineage ? [{ provider: "Published budget detail", ...entity.budget_stage_lineage }] : [])],
      };
      return overview;
    }
    async function loadYearDetail(year) {
      year = exactYear(year);
      if (year === null) throw new Error("A calendar year is required");
      const current = await loadOverview();
      const records = current.records;
      const [entityResult, codebook, summaryResult] = await Promise.all([entityData().then(value => ({ value }), error => ({ error })), json(PATHS.codebook).catch(() => null), records && records.available_years?.includes(year) ? profileYear(year, records.key, records.ico).then(value => ({ value }), error => ({ error })) : Promise.resolve({ none: true })]);
      const rows = normalizeBreakdown(entityResult.value?.entity, codebook, ico, labels).filter(row => row.year === year);
      let accountingRows = [], eventRows = [], layerError = null;
      if (summaryResult.value) {
        try {
          const [accounting, events] = await Promise.all([layer(year, "accounting", summaryResult.value), layer(year, "events", summaryResult.value)]);
          eventRows = events; accountingRows = normalizeAccounting(accounting, year, codebook, events);
        } catch (error) { layerError = errorInfo(error); }
      }
      let jointRows = [], jointCoverage = { status: "not_published", checks: [] };
      if (extension?.connectedResults && rows.length) {
        try {
          const payload = await json(`/public-data/municipality-lines?country=CZE&code=${ico}&detail=purpose-cost-v1`);
          jointRows = normalizeJoint(payload, ico, year, codebook, labels);
          jointCoverage = reconcileJoint(jointRows, rows);
        } catch (error) { jointCoverage = errorInfo(error); }
      }
      let sourceReconciliation = null;
      if (extension?.reconciliationApi && year === 2025) {
        try {
          const value = await json(extension.reconciliationApi);
          if (value.municipality_ico !== ico || value.year !== year) throw new Error("Reconciliation identity or year differs");
          sourceReconciliation = value;
        } catch (error) { sourceReconciliation = errorInfo(error); }
      }
      const summary = summaryResult.value?.selected || null;
      const accountingStatus = layerError || (summaryResult.error ? errorInfo(summaryResult.error) : summaryResult.none ? { status: "not_published" } : { status: "available", rows: accountingRows.length });
      return { year, rows, jointRows, jointCoverage, sourceReconciliation, accountingRows, events: eventRows.map(row => ({ code: text(row.event || row.id || row.code), name: text(row.name || row.title), income: cents(row.income_actual_cents), expenditure: cents(row.expenditure_actual_cents), budgetIncome: cents(row.income_budget_cents), budgetExpenditure: cents(row.expenditure_budget_cents) })), sourceValidity: summary?.source_validity || null, invoiceSummary: summary?.payments || null, accountingTotals: summary?.accounting?.totals || null, annualFinance: summary?.annual_finance || null, coverage: { fullBudgetBreakdown: rows.length > 0, fullBudgetYear: entityResult.value?.entity?.budget_breakdown?.fiscal_year || null, accounting: accountingStatus, reconciliation: "CityVizor is an overlapping publication with a different reporting scope; it is not added to or assumed to reconcile with FIN 2-12 M", crossClassification: jointCoverage.status === "reconciled" ? "Native budget purpose × economic item cells reconcile to every marginal; CityVizor remains a separate overlapping scope" : "No verified native budget purpose × economic item connection for this year; accounting rows are a separate scope" }, evidence: { monitor: rows.length ? { ...entityResult.value.entity.budget_breakdown.lineage, sourceUrl: monitorUrl(ico, year) } : null, cityvizor: summaryResult.value ? { releaseId: summaryResult.value.payload.release_id, profileKey: records.key, sourceValidity: summary?.source_validity, sourceUrl: records.profile_url || extension?.recordsUrl || null, sourceSha256: summary?.source_bulk_export?.sha256, receivedAt: summary?.source_bulk_export?.retrieved_at } : null } };
    }
    async function loadPayments(year) {
      year = exactYear(year);
      if (year === null) throw new Error("A calendar year is required");
      const records = await recordsProfile();
      const [summary, codebook] = await Promise.all([profileYear(year, records.key, records.ico), json(PATHS.codebook).catch(() => null)]);
      const [payments, events] = await Promise.all([layer(year, "payments", summary), layer(year, "events", summary)]);
      return { year, rows: normalizePayments(payments, year, codebook, events), profile: records, summary: summary.selected.payments, sourceValidity: summary.selected.source_validity, coverage: { status: "available", rows: payments.length, scope: "Published invoice allocations of one profile, not all municipal payments", canReconcileToBudget: false }, evidence: { provider: "CityVizor", releaseId: summary.payload.release_id, profileKey: records.key, sourceUrl: records.profile_url || extension?.recordsUrl || null, sourceSha256: summary.selected.source_bulk_export?.sha256, receivedAt: summary.selected.source_bulk_export?.retrieved_at } };
    }
    async function loadStatement(year, expectedRelease) {
      const records = await recordsProfile();
      const result = await profileYear(year, records.key, records.ico);
      if (expectedRelease && result.payload.release_id !== expectedRelease) throw new Error("Publication changed; reload before comparing annual statements");
      return { year: Number(year), summary: result.selected, releaseId: result.payload.release_id, profile: result.payload.profile };
    }
    async function loadLivingCost() {
      if (!extension?.livingCostApi) return { status: "not_supported" };
      const value = await json(extension.livingCostApi);
      if (value.municipality_ico !== ico) throw new Error("Living-cost territory mismatch");
      if (value.status !== "available") return { status: "not_published" };
      if (!value.release_id || !Array.isArray(value.observations) || !Array.isArray(value.sources) || value.validation?.passed !== true || value.observations.some(o => o.metric !== "average_monthly_housing_cost" || !Number.isInteger(o.year) || o.currency !== "CZK" || o.denominator !== "household" || o.frequency !== "month" || o.geography !== "Prague" || !/^\d+(\.\d+)?$/.test(o.amount_exact) || !value.sources.some(s => s.id === o.source_id && /^https:\/\//.test(s.url)))) throw new Error("Invalid published living-cost observation");
      return value;
    }
    async function loadContext() {
      const current = await loadOverview();
      if (!current.city.territoryCode) throw new Error("The municipality territory code is not published");
      const [index, catalog] = await Promise.all([json(PATHS.paqIndex), json(PATHS.paqCatalog, true)]);
      const region = index.regions?.[`obec:${current.city.territoryCode}`];
      if (!region?.shard || !/^[A-Za-z0-9._/-]+\.json\.gz$/.test(region.shard) || region.shard.includes("..")) throw new Error("PAQ territory shard is invalid");
      return normalizeContext(index, catalog, await json(`/data/paq/${region.shard}`, true), current.city);
    }
    // Authorities whose IT spending can be investigated: the extension's instance
    // (Prague's districts), else the municipality's own records profiles.
    async function loadAuthorities() {
      const current = await loadOverview();
      const scope = current.extension?.authorities;
      if (!scope) {
        const profiles = (current.cityvizor?.municipality_profiles || []).filter(profile => profile.type === "municipality" && profile.ico === ico);
        if (!profiles.length) throw new Error("No published authority profiles");
        return { releaseId: current.cityvizor.release_id, profiles };
      }
      const directory = await json(PATHS.cityvizorIndex);
      if (!directory.complete || !directory.release_id || !Array.isArray(directory.profiles)) throw new Error("Published profile directory is incomplete");
      const pattern = new RegExp(scope.keyPattern);
      const profiles = directory.profiles.filter(profile => profile.type === "municipality" && profile.instance === scope.instance && pattern.test(profile.key));
      if (new Set(profiles.map(profile => profile.key)).size !== profiles.length) throw new Error("Duplicate district identities");
      return { releaseId: directory.release_id, profiles };
    }
    async function loadAuthoritySummary(profileKey, year) {
      const directory = await loadAuthorities();
      const profile = directory.profiles.find(item => item.key === profileKey);
      if (!profile || !profile.available_years.includes(year)) throw new Error("Selected authority or year is not published");
      const summary = await profileYear(year, profileKey, profile.ico);
      if (summary.payload.release_id !== directory.releaseId) throw new Error("Publication changed; reload before comparing records");
      const items = (summary.selected.accounting?.by_item || []).filter(row => IT_CODES.includes(String(row.key))).map(row => ({ code: String(row.key), name: row.label, actualCents: number(row.expenditure_actual_cents), budgetCents: number(row.expenditure_budget_cents), amount: cents(row.expenditure_actual_cents), budget: cents(row.expenditure_budget_cents) }));
      return { profile, year, items, summary, sourceValidity: summary.selected.source_validity, evidence: { releaseId: directory.releaseId, profileKey, sourceUrl: profile.profile_url, sourceSha256: summary.selected.source_bulk_export?.sha256, receivedAt: summary.selected.source_bulk_export?.retrieved_at } };
    }
    async function loadAuthorityPayments(profileKey, year) {
      const result = await loadAuthoritySummary(profileKey, year);
      if (!Array.isArray(result.summary.selected.assets?.payments) || !Number.isInteger(result.summary.selected.payments?.rows)) throw new Error("Invoice coverage is not declared");
      const [raw, events, codebook] = await Promise.all([layer(year, "payments", result.summary), layer(year, "events", result.summary), json(PATHS.codebook).catch(() => null)]);
      const rows = normalizePayments(raw, year, codebook, events).map((row, index) => ({ ...row, expenditureCents: number(raw[index].expenditure_cents), invoiceNumber: null, profileKey, scope: result.profile.name + " · published invoice allocations" })).filter(row => IT_CODES.includes(row.itemCode));
      return { ...result, rows, totalPublishedRows: raw.length };
    }
    async function loadOrganizationRecords(profileKey, year, kind = "plans") {
      const current = await loadOverview();
      const profile = (current.cityvizor?.organizations || []).find(row => row.key === profileKey);
      const parents = new Set((current.cityvizor?.municipality_profiles || []).map(row => row.key));
      if (!profile || !parents.has(profile.parent_profile_key) || !profile.available_years?.includes(year) || !["accounting", "payments", "plans", "events", "pbo_payment_source_rows"].includes(kind)) throw new Error("Organization, parent, year or layer is not published");
      if (kind === "payments" && !profile.payment_years?.includes(year)) throw new Error("Organization payments are not published for this year");
      const summary = await profileYear(year, profile.key, profile.ico);
      if (summary.payload.release_id !== current.cityvizor.release_id) throw new Error("Publication changed; reload before comparing organization records");
      const metadata = kind === "pbo_payment_source_rows" ? summary.selected.alternate_pbo_payment_source_view : summary.selected[kind];
      const assets = kind === "pbo_payment_source_rows" ? metadata?.assets : summary.selected.assets?.[kind];
      if (!Number.isInteger(metadata?.rows) || !Array.isArray(assets)) throw new Error("Organization layer coverage is not declared");
      return { profile, year, kind, rows: await layer(year, kind, summary), summary: summary.selected, releaseId: summary.payload.release_id };
    }
    return { ico, paths, extension, loadOverview, loadYearDetail, loadPayments, loadStatement, loadContext, loadLivingCost, loadAuthorities, loadAuthoritySummary, loadAuthorityPayments, loadOrganizationRecords, clearCache: () => { cache.clear(); overview = null; } };
  }
  return { PATHS, IT_CODES, pathsFor, monitorUrl, balanceSheetUrl, validIco, createClient, resolveRecordsProfile, normalizeHistory, normalizeBreakdown, normalizeAccounting, normalizePayments, normalizeJoint, reconcileJoint, normalizeContext, number };
}));
