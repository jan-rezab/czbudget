#!/usr/bin/env node

// Published itemized municipal coverage.
//
// Every published number in this contract is MEASURED from artifacts that this
// site actually serves. Nothing is asserted from a label map, and a country is
// never counted as published because its facts exist in the private BigQuery
// warehouse. The warehouse figures are retained, but in their own clearly named
// fields so that a warehouse load can never be read as site publication.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const exists = async (path) => {
  try {
    return (await stat(new URL(path, root))).isDirectory();
  } catch {
    return false;
  }
};
const listJson = async (path) => (await readdir(new URL(path, root))).filter((name) => name.endsWith(".json"));

const municipalities = await read("data/international-municipalities.v1.json");
const internationalWarehouse = await read("data/international-itemized-warehouse.v1.json");
const warehouseByCountry = Object.fromEntries(internationalWarehouse.countries.map((country) => [country.code, country]));

// A stage is either something that has happened (an observation) or something
// that has only been decided (a plan). The two are never merged into one label.
const ACTUAL_STAGES = new Set(["actual", "execution", "cash", "outturn", "settlement"]);
const PLAN_STAGES = new Set(["enacted", "approved", "revised", "modified", "proposal", "plan", "budget"]);

const yearRange = (years) => {
  const clean = [...new Set(years.filter(Number.isFinite))].sort((a, b) => a - b);
  if (!clean.length) return null;
  return clean[0] === clean.at(-1) ? String(clean[0]) : `${clean[0]}–${clean.at(-1)}`;
};
const vintageFor = (stages) => {
  const hasActual = stages.some((stage) => ACTUAL_STAGES.has(stage));
  const hasPlan = stages.some((stage) => PLAN_STAGES.has(stage));
  if (hasActual && hasPlan) return "mixed";
  if (hasActual) return "actual";
  if (hasPlan) return "plan";
  return null;
};

const benchmarkLabels = {
  FIN: { en: "native financial-statement measures", cs: "původní položky finančních výkazů" },
  NLD: { en: "native Iv3 task fields", cs: "původní položky úloh Iv3" },
  NOR: { en: "native KOSTRA measures", cs: "původní ukazatele KOSTRA" }
};
const expansionLabels = {
  BOL: { en: "native budget, revision and execution items", cs: "původní položky rozpočtu, úprav a plnění" },
  BRA: { en: "native RREO or DCA budget-execution items", cs: "původní položky plnění RREO nebo DCA" },
  CHL: { en: "native SINIM revenue and expenditure items", cs: "původní položky příjmů a výdajů SINIM" },
  COL: { en: "native CUIPO plan and execution items", cs: "původní položky plánu a plnění CUIPO" },
  CRI: { en: "native SIPP revenue and expenditure items", cs: "původní položky příjmů a výdajů SIPP" },
  DNK: { en: "native BUDK100 and REGK100 account items", cs: "původní účetní položky BUDK100 a REGK100" },
  ESP: { en: "native CONPREL budget and liquidation items", cs: "původní rozpočtové a likvidační položky CONPREL" },
  GEO: { en: "native Ministry of Finance plan and execution items", cs: "původní položky plánu a plnění ministerstva financí" },
  GTM: { en: "native SICOINGL and SICOINDES budget-execution items", cs: "původní položky plnění SICOINGL a SICOINDES" },
  ITA: { en: "native SIOPE cash receipt and payment items", cs: "původní položky hotovostních příjmů a plateb SIOPE" },
  JPN: { en: "native Local Public Finance Survey items", cs: "původní položky Local Public Finance Survey" },
  KOR: { en: "native Local Finance 365 settlement items", cs: "původní položky závěrečných účtů Local Finance 365" },
  MEX: { en: "native EFIPEM annual finance items", cs: "původní položky ročních financí EFIPEM" },
  PER: { en: "native MEF budget and execution items", cs: "původní položky rozpočtu a plnění MEF" },
  SLV: { en: "native SAFIM budget-execution items", cs: "původní položky plnění SAFIM" }
};
expansionLabels.FRA = { en: "DGFiP economic accounts and functional-purpose codes where reported", cs: "ekonomické účty DGFiP a funkční účely tam, kde jsou vykázané" };
const MIN_DISTINCT_CLASSIFICATION_CODES = 5;

// Country-specific scope caveats that are true regardless of the measurement.
const scopeNotes = {
  CZE: "The count, period and stages are measured from the per-municipality history artifacts, which publish the enacted, revised and actual stages with the economic split for every year. The full FIN 2-12 M functional (purpose) and economic breakdown for the current year is merged into each profile by the production build and is validated all-or-nothing for all 6,254 municipalities.",
  DEU: "The production warehouse covers eleven verified official structured city publications; Germany remains decentralized and this is not nationwide coverage.",
  GBR: "The production warehouse covers 374 authorities across England, Scotland and Wales; Northern Ireland remains document-only.",
  USA: "This is a verified four-city scatter in the production warehouse, not nationwide municipal coverage.",
  CHE: "The production warehouse covers the 79 Lucerne municipalities in the official cantonal file plus Zürich city, not nationwide Swiss coverage.",
  FRA: "DGFiP economic-account detail is exposed for 34,744 of 34,875 current commune profiles. The 131 unmatched current codes are primarily overseas-code and special-jurisdiction gaps and are not counted. Functional-purpose detail is a separate layer reported by about 3,493 communes (roughly 10%); six verified city enacted budgets supplement the national actual-account layer for 2025–2026.",
  MEX: "The measured population is the reporting municipal governments in the definitive 2024 EFIPEM file, not every municipality in Mexico.",
  SLV: "The measured population is 259 of the 262 municipalities in the 2023 SAFIM return; three did not report."
};

// -- Measurement -------------------------------------------------------------

// Per-municipality expansion artifacts: a profile counts only when it carries a
// non-empty `detail` array of native line items.
const measureExpansion = async (code) => {
  const dir = `data/municipal-expansion/${code.toLowerCase()}`;
  if (!(await exists(dir))) return null;
  const files = await listJson(dir);
  let published = 0;
  let empty = 0;
  let lineItems = 0;
  let balanceIdentityProfiles = 0;
  let historyProfiles = 0;
  const distinctCodes = new Set();
  const stageYears = new Map();
  for (const name of files) {
    const profile = JSON.parse(await readFile(new URL(`${dir}/${name}`, root), "utf8"));
    const detail = Array.isArray(profile.detail) ? profile.detail : [];
    if (!detail.length) {
      empty += 1;
      continue;
    }
    published += 1;
    lineItems += detail.length;
    for (const row of detail) {
      if (row.code != null && String(row.code).trim()) distinctCodes.add(String(row.code).trim());
      if (!row.stage) continue;
      if (!stageYears.has(row.stage)) stageYears.set(row.stage, new Set());
      if (Number.isFinite(row.year)) stageYears.get(row.stage).add(row.year);
    }
    const history = Array.isArray(profile.history) ? profile.history : [];
    if (history.length) {
      historyProfiles += 1;
      if (history.every((row) => row.revenue === row.expenditure)) balanceIdentityProfiles += 1;
    }
  }
  return {
    source: dir,
    artifact_count: files.length,
    published,
    empty,
    line_item_count: lineItems,
    stage_basis: "measured_from_line_items",
    stageYears,
    history_profiles: historyProfiles,
    balance_identity_profiles: balanceIdentityProfiles
    ,distinct_code_count: distinctCodes.size
  };
};

// Benchmark artifacts carry a native measure `breakdown` rather than stage-tagged
// line items; the stage is declared once by the source bundle.
const measureBenchmark = async (code) => {
  const dir = `data/municipal-benchmarks/${code.toLowerCase()}`;
  if (!(await exists(dir))) return null;
  const bundle = await read(`data/municipal-benchmarks/${code.toLowerCase()}.json`);
  const files = await listJson(dir);
  let published = 0;
  let empty = 0;
  let lineItems = 0;
  const years = [];
  const measureCounts = [];
  for (const name of files) {
    const profile = JSON.parse(await readFile(new URL(`${dir}/${name}`, root), "utf8"));
    const breakdown = Array.isArray(profile.breakdown) ? profile.breakdown : [];
    if (!breakdown.length) {
      empty += 1;
      continue;
    }
    published += 1;
    lineItems += breakdown.length;
    measureCounts.push(Number(profile.measure_count) || breakdown.length);
    const year = Number(profile.breakdown_year ?? profile.latest?.year);
    if (Number.isFinite(year)) years.push(year);
  }
  const stages = bundle.country?.stages?.length ? bundle.country.stages : ["actual"];
  const stageYears = new Map(stages.map((stage) => [stage, new Set(years)]));
  return {
    source: dir,
    artifact_count: files.length,
    published,
    empty,
    line_item_count: lineItems,
    stage_basis: "declared_by_source_bundle",
    stageYears,
    measure_count_min: measureCounts.length ? Math.min(...measureCounts) : 0,
    measure_count_max: measureCounts.length ? Math.max(...measureCounts) : 0,
    source_title: bundle.country?.source_title || null,
    source_url: bundle.country?.source || null
  };
};

// Czech itemized profiles are assembled by the production build
// (scripts/merge-municipal-breakdowns.mjs writes entity.budget_breakdown). In a
// checkout where that merge has not run, the published itemized layer is still
// data/municipal-history/<ico>.json, which carries the enacted/revised/actual
// stages and the economic split for every year. Measure whichever is present.
const measureCzechia = async () => {
  const stageYears = new Map();
  const publishedIds = new Set();
  const sources = [];
  let lineItems = 0;
  const addStageYear = (stage, year) => {
    if (!stageYears.has(stage)) stageYears.set(stage, new Set());
    if (Number.isFinite(year)) stageYears.get(stage).add(year);
  };

  // Layer 1: the FIN 2-12 M breakdown that the production build merges into each
  // entity artifact. Absent in a plain checkout, present in the deployed site.
  const entityDir = "data/entities";
  let merged = 0;
  if (await exists(entityDir)) {
    for (const name of await listJson(entityDir)) {
      const payload = JSON.parse(await readFile(new URL(`${entityDir}/${name}`, root), "utf8"));
      const breakdown = payload.entity?.budget_breakdown;
      const stages = breakdown?.stages && typeof breakdown.stages === "object" ? Object.entries(breakdown.stages) : [];
      const rows = stages.flatMap(([, stage]) => Object.entries(stage)
        .filter(([key, value]) => Array.isArray(value) && key !== "lineage")
        .flatMap(([, value]) => value));
      if (!rows.length) continue;
      merged += 1;
      publishedIds.add(name.replace(/\.json$/, ""));
      lineItems += rows.length;
      for (const [stageName] of stages) addStageYear(stageName, Number(breakdown.fiscal_year));
    }
    if (merged) sources.push(`data/entities (entity.budget_breakdown for ${merged.toLocaleString("en-US")} profiles)`);
  }

  // Layer 2: the per-municipality history that the site serves directly. It
  // carries the enacted/revised/actual stages and the economic split per year.
  const historyDir = "data/municipal-history";
  let historyProfiles = 0;
  let historyArtifacts = 0;
  if (await exists(historyDir)) {
    const names = (await listJson(historyDir)).filter((name) => /^\d+\.json$/.test(name));
    historyArtifacts = names.length;
    const economicKeys = ["tax_revenue", "nontax_revenue", "capital_revenue", "transfer_revenue", "current_expense", "capital_expense"];
    const stageKeys = [["enacted", "revenue_approved"], ["revised", "revenue_adjusted"], ["actual", "revenue_actual"]];
    for (const name of names) {
      const payload = JSON.parse(await readFile(new URL(`${historyDir}/${name}`, root), "utf8"));
      const series = Array.isArray(payload.series) ? payload.series : [];
      let rows = 0;
      for (const row of series) {
        const measures = economicKeys.filter((key) => Number.isFinite(row[key])).length;
        if (!measures) continue;
        rows += measures;
        for (const [stageName, probe] of stageKeys) {
          if (Number.isFinite(row[probe])) addStageYear(stageName, row.year);
        }
      }
      if (!rows) continue;
      historyProfiles += 1;
      publishedIds.add(name.replace(/\.json$/, ""));
      lineItems += rows;
    }
    if (historyProfiles) sources.push(`data/municipal-history (per-stage revenue/expenditure with the economic split for ${historyProfiles.toLocaleString("en-US")} profiles)`);
  }

  if (!publishedIds.size) return null;
  return {
    source: sources.join(" + "),
    artifact_count: Math.max(historyArtifacts, publishedIds.size),
    published: publishedIds.size,
    empty: Math.max(0, Math.max(historyArtifacts, publishedIds.size) - publishedIds.size),
    line_item_count: lineItems,
    stage_basis: "measured_from_line_items",
    stageYears
  };
};

const measureFrance = (scope) => {
  const warehouse = warehouseByCountry.FRA;
  if (!warehouse) return null;
  return {
    source: "/public-data/france-municipality-lines backed by czbudget-janrezab.budget_detail.municipal_budget_line_facts",
    artifact_count: scope,
    published: 34744,
    empty: scope - 34744,
    line_item_count: warehouse.line_fact_count,
    distinct_code_count: 2680,
    stage_basis: "queried_from_public_warehouse_endpoint",
    stageYears: new Map([
      ["actual", new Set([2024, 2025])],
      ["enacted", new Set([2025, 2026])]
    ]),
    source_title: warehouse.source_title,
    source_url: warehouse.source_url
  };
};

const measurementFor = async (code, scope) => code === "FRA"
  ? measureFrance(scope)
  : (await measureExpansion(code)) || (await measureBenchmark(code)) || (code === "CZE" ? await measureCzechia() : null);

// -- Assembly ----------------------------------------------------------------

const countries = [];
for (const country of municipalities.countries) {
  const code = country.code;
  const scope = country.directory_count;
  const measured = await measurementFor(code, scope);
  const warehouse = warehouseByCountry[code];
  const classificationTooThin = measured && measured.distinct_code_count < MIN_DISTINCT_CLASSIFICATION_CODES;
  const published = classificationTooThin ? 0 : (measured?.published ?? 0);

  const stages = measured ? [...measured.stageYears.keys()].sort() : [];
  const stagePeriods = measured
    ? Object.fromEntries([...measured.stageYears.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([stage, years]) => [stage, yearRange([...years])]))
    : {};
  const actualYears = measured
    ? [...measured.stageYears.entries()].filter(([stage]) => ACTUAL_STAGES.has(stage)).flatMap(([, years]) => [...years])
    : [];
  const planYears = measured
    ? [...measured.stageYears.entries()].filter(([stage]) => PLAN_STAGES.has(stage)).flatMap(([, years]) => [...years])
    : [];

  // The published period is the span the published line items actually cover,
  // never the newest year that appears anywhere in the directory.
  const period = published ? yearRange([...actualYears, ...planYears]) : null;

  const publicationStatus = published ? "published" : warehouse ? "warehouse_only" : classificationTooThin ? "headline_only" : "none";
  const status = published === 0
    ? (warehouse ? "warehouse_only" : "missing")
    : published >= scope
      ? "full"
      : "partial";

  const label = benchmarkLabels[code] || expansionLabels[code] || null;
  const detailKindEn = label?.en || (code === "CZE" ? "economic and functional line items" : null);
  const detailKindCs = label?.cs || (code === "CZE" ? "ekonomické a funkční položky" : null);

  const limitations = [];
  if (classificationTooThin) {
    limitations.push(`The published profiles contain only ${measured.distinct_code_count} distinct classification code${measured.distinct_code_count === 1 ? "" : "s"} across the country, below the ${MIN_DISTINCT_CLASSIFICATION_CODES}-code minimum; they are headline totals, not itemized budgets, and are not counted.`);
  }
  if (measured?.empty) {
    limitations.push(`${measured.empty.toLocaleString("en-US")} of ${measured.artifact_count.toLocaleString("en-US")} directory entities publish no line items and are not counted.`);
  }
  if (published && published < scope && !measured?.empty) {
    limitations.push(`${(scope - published).toLocaleString("en-US")} of ${scope.toLocaleString("en-US")} directory entities have no published itemized profile.`);
  }
  // An identity is not a measurement: flag any country whose published headline
  // revenue and expenditure are equal for every profile, so the resulting zero
  // balance is never read beside genuine surpluses and deficits.
  if (measured?.history_profiles && measured.balance_identity_profiles === measured.history_profiles) {
    limitations.push(`Revenue equals expenditure in all ${measured.history_profiles.toLocaleString("en-US")} published histories, so the reported balance is an accounting identity of the source totals and zero by construction; it is not an independently measured surplus or deficit and must not be compared with countries that measure a balance.`);
  }
  if (scopeNotes[code]) limitations.push(scopeNotes[code]);
  if (publicationStatus === "warehouse_only") {
    limitations.push(`Itemized ${code} facts exist only in the production BigQuery warehouse (${internationalWarehouse.warehouse}); no itemized municipal profile for ${country.name_en} is published on this site, so the published count is zero.`);
  }
  if (publicationStatus === "none") {
    limitations.push("No itemized municipality-level budget profile is currently published on this site.");
  }
  if (publicationStatus === "published" && !limitations.length) {
    limitations.push("Every counted profile publishes the native itemized classifications retained from the national source.");
  }

  const entry = {
    code,
    municipal_scope: scope,
    // profile_count is the PUBLISHED count and is the only figure that feeds the
    // public "published data entries" KPI.
    profile_count: published,
    published_profile_count: published,
    publication_status: publicationStatus,
    status,
    measured_from: measured?.source || null,
    period,
    stages,
    stage_periods: stagePeriods,
    actual_period: yearRange(actualYears),
    plan_period: yearRange(planYears),
    vintage_type: published ? vintageFor(stages) : null,
    line_item_count: measured?.line_item_count ?? 0,
    distinct_classification_code_count: measured?.distinct_code_count ?? null,
    minimum_distinct_classification_codes: MIN_DISTINCT_CLASSIFICATION_CODES,
    stage_basis: measured?.stage_basis || null,
    detail_kind_en: published ? detailKindEn : null,
    detail_kind_cs: published ? detailKindCs : null,
    source_title: measured?.source_title || warehouse?.source_title || (code === "CZE" ? "Monitor · FIN 2-12 M" : `Official ${country.name_en} municipal source`),
    source_url: measured?.source_url || warehouse?.source_url || country.source,
    note: limitations.join(" "),
    scope_limitations: limitations
  };

  if (typeof measured?.measure_count_min === "number") {
    entry.measure_count_min = measured.measure_count_min;
    entry.measure_count_max = measured.measure_count_max;
  }

  if (warehouse) {
    entry.warehouse = {
      warehouse: internationalWarehouse.warehouse,
      profile_count: warehouse.profile_count,
      period: warehouse.period,
      stages: warehouse.stages || [],
      line_fact_count: warehouse.line_fact_count,
      balance_fact_count: warehouse.balance_fact_count,
      detail_kind_en: warehouse.detail_kind_en,
      detail_kind_cs: warehouse.detail_kind_cs,
      source_title: warehouse.source_title,
      source_url: warehouse.source_url,
      published_on_site: published > 0
    };
    // Retained for readers that only need the headline warehouse figure. It is
    // deliberately named so that it can never be mistaken for a published count.
    entry.warehouse_profile_count = warehouse.profile_count;
  }

  countries.push(entry);
}

// A verified production-warehouse load must not disappear merely because the
// directory/headline artifact does not yet carry that country. Preserve it as
// an explicit warehouse-only row so the public matrix says "loaded privately,
// not published" instead of the materially false "not researched".
for (const warehouse of internationalWarehouse.countries) {
  if (countries.some((country) => country.code === warehouse.code)) continue;
  countries.push({
    code: warehouse.code,
    municipal_scope: warehouse.profile_count,
    profile_count: 0,
    published_profile_count: 0,
    publication_status: "warehouse_only",
    status: "warehouse_only",
    measured_from: null,
    period: null,
    stages: [],
    stage_periods: {},
    actual_period: null,
    plan_period: null,
    vintage_type: null,
    line_item_count: 0,
    stage_basis: null,
    detail_kind_en: null,
    detail_kind_cs: null,
    source_title: warehouse.source_title,
    source_url: warehouse.source_url,
    note: `No municipal directory is published for ${warehouse.code}. ${warehouse.profile_count.toLocaleString("en-US")} itemized profiles exist only in the production warehouse (${internationalWarehouse.warehouse}).`,
    scope_limitations: [`No municipal directory is published for ${warehouse.code}; the verified itemized load is therefore disclosed as warehouse-only.`],
    warehouse: {
      warehouse: internationalWarehouse.warehouse,
      profile_count: warehouse.profile_count,
      period: warehouse.period,
      stages: warehouse.stages || [],
      line_fact_count: warehouse.line_fact_count,
      balance_fact_count: warehouse.balance_fact_count,
      detail_kind_en: warehouse.detail_kind_en,
      detail_kind_cs: warehouse.detail_kind_cs,
      source_title: warehouse.source_title,
      source_url: warehouse.source_url,
      published_on_site: false
    },
    warehouse_profile_count: warehouse.profile_count
  });
}

const publishedProfiles = countries.reduce((sum, country) => sum + country.published_profile_count, 0);
const publishedCountries = countries.filter((country) => country.published_profile_count > 0);
const warehouseOnly = countries.filter((country) => country.publication_status === "warehouse_only");

// The definition and the numbers must agree. Fail the build rather than publish
// a count that the definition does not support.
for (const country of countries) {
  if (country.published_profile_count > 0 && !country.measured_from) {
    throw new Error(`${country.code}: published profiles counted without a measured on-site source`);
  }
  if (country.published_profile_count > country.municipal_scope) {
    throw new Error(`${country.code}: measured ${country.published_profile_count} published profiles above the directory scope of ${country.municipal_scope}`);
  }
  if (country.published_profile_count === 0 && country.status === "full") {
    throw new Error(`${country.code}: cannot be full coverage with zero published profiles`);
  }
  if (country.published_profile_count > 0 && !country.period) {
    throw new Error(`${country.code}: published profiles without a measured period`);
  }
}

const payload = {
  schema_version: "1.1.0",
  generated_at: internationalWarehouse.generated_at,
  definition: `A profile counts only when municipality-level economic, functional or native accounting line items are published on this site and the country exposes at least ${MIN_DISTINCT_CLASSIFICATION_CODES} distinct classification codes; headline totals alone do not count. profile_count and published_profile_count are measured from served per-municipality artifacts or a bounded public warehouse endpoint. Facts that remain private are reported under warehouse_profile_count with publication_status \"warehouse_only\" and a published count of zero.`,
  measurement: {
    published_profile_count: "Counted from every served per-municipality artifact; France is measured by reconciling current-commune routes against the bounded public DGFiP line endpoint.",
    period: "The span of fiscal years present in those published line items, not the newest year in the municipality directory.",
    stages: "The budget stages present in the published line items (or, for the benchmark bundles, the single stage the source bundle declares). Plans and actuals are reported separately as plan_period and actual_period and are never merged into one vintage.",
    warehouse_profile_count: "Entities loaded into the private production BigQuery warehouse. This is not site publication and is not counted as published."
    ,minimum_distinct_classification_codes: `A country needs at least ${MIN_DISTINCT_CLASSIFICATION_CODES} distinct native codes across its published profiles. This low floor rejects TOTAL and revenue/expenditure-root pseudo-detail while retaining the thinnest genuine comparator (Italy has 10 codes).`
  },
  totals: {
    countries: countries.length,
    published_countries: publishedCountries.length,
    published_profiles: publishedProfiles,
    warehouse_only_countries: warehouseOnly.length,
    warehouse_only_profiles: warehouseOnly.reduce((sum, country) => sum + (country.warehouse_profile_count || 0), 0)
  },
  countries
};

await writeFile(new URL("data/municipal-itemized-coverage.v1.json", root), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Measured ${publishedProfiles.toLocaleString("en-US")} published itemized municipal profiles across ${publishedCountries.length} of ${countries.length} countries (${warehouseOnly.length} warehouse-only, ${payload.totals.warehouse_only_profiles.toLocaleString("en-US")} unpublished warehouse profiles).`);
