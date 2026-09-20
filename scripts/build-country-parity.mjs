#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workspace = new URL("../../", import.meta.url);
const read = (path, base = root) => JSON.parse(readFileSync(new URL(path, base), "utf8"));
const exists = async (path, base = root) => { try { await stat(new URL(path, base)); return true; } catch { return false; } };

if (process.argv.includes("--providers-only")) {
  const parity = read("data/country-parity.v1.json");
  const providerData = read("data/country-provider-networks.v1.json");
  for (const country of parity.countries) {
    const provider = providerData.countries[country.country_code];
    const loaded = Boolean(provider && provider.coverage !== "source_adapter_pending");
    country.modules.providers = {
      status: loaded ? "loaded" : "unavailable",
      coverage: loaded ? `${provider.facility_count} registered provider locations` : provider?.coverage || "not loaded",
      missing_dimensions: loaded ? (provider.missing_dimensions || []) : ["facility records"],
      facility_count: provider?.facility_count || 0,
    };
    country.coverage.loaded_modules = Object.values(country.modules).filter((module) => module.status === "loaded").length;
    country.coverage.missing_dimensions = country.coverage.missing_dimensions.filter((item) => item !== "provider_register");
    if (!loaded && !country.coverage.missing_dimensions.includes("provider_register")) country.coverage.missing_dimensions.push("provider_register");
    const profile = read(country.profile);
    const summary = loaded ? Object.fromEntries(Object.entries(provider).filter(([key]) => key !== "facilities")) : null;
    profile.modules.providers = country.modules.providers;
    profile.coverage = country.coverage;
    profile.data.providers = summary ? { ...summary } : null;
    await writeFile(new URL(country.profile, root), `${JSON.stringify(profile, null, 2)}\n`);
  }
  parity.generated_at = new Date().toISOString();
  await writeFile(new URL("data/country-parity.v1.json", root), `${JSON.stringify(parity, null, 2)}\n`);
  console.log("Refreshed provider coverage in parity manifest and country bundles");
  process.exit(0);
}

const sovereign = read("lib/data/sovereign-benchmark.v1.json");
const catalog = read("data/catalog.v1.json");
const cashIn = read("data/country-cash-in.v1.json");
const administrative = read("data/country-spending-2025-2026.v1.json");
const comparison = read("data/country-spending-comparison.v1.json");
const functions = read("data/country-functional-budgets.v1.json");
const transport = read("data/transport-budget-detail.v1.json");
const health = read("data/country-health.v1.json");
const globalHealth = read("data/global-health-baseline.v1.json");
const globalUnemployment = read("data/global-unemployment.v1.json");
const providers = read("data/country-provider-networks.v1.json");
const municipalities = read("data/international-municipalities.v1.json");
const publicEntityCoverage = read("data/public-entity-coverage.v1.json");
const publicEntityDirectory = read("data/public-entity-directory/manifest.v1.json");
const demography = read("data/country-demography.v1.json");
const previousParity = read("data/country-parity.v1.json");

const volumeBundles = [
  ["international core", "outputs/20260822-international-municipal-2024-2025-full/international_municipal_manifest.json"],
  ["France census", "outputs/20260822-international-municipal-france-complete/international_municipal_manifest.json"],
  ["Ukraine communities", "outputs/20260822-ukraine-municipal-2024-2025-final/international_municipal_manifest.json"],
];
const warehouseBundles = [];
for (const [label, path] of volumeBundles) {
  if (await exists(path, workspace)) warehouseBundles.push({ label, path, manifest: read(path, workspace) });
}

const countryCodes = sovereign.countries.map((country) => country.country_code);
const fullProfileCountries = new Set(["CZE","UKR","POL","DEU","GBR","FRA","USA","CHE","SWE","DNK","FIN","BRA","ESP","JPN","NLD","NOR","GRC"]);
const byCode = (rows, code, key = "code") => rows.find((row) => row[key] === code);
const metricYears = (series) => {
  const years = Object.values(series?.metrics || {}).flatMap((metric) => metric.values?.filter((point) => point.value != null).map((point) => point.year) || []);
  return years.length ? { from: Math.min(...years), to: Math.max(...years), years: new Set(years).size } : null;
};
const metricCoverage = (series, metricCode) => {
  const points = series?.metrics?.[metricCode]?.values?.filter((point) => point.value != null) || [];
  const years = points.map((point) => point.year);
  return {
    loaded: points.length > 0,
    observation_count: points.length,
    period: points.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
  };
};
const baselineModule = (series, metricCode, label) => {
  const metric = metricCoverage(series, metricCode);
  return {
    ...status(metric.loaded, metric.loaded ? `${label}; IMF WEO; ${metric.period.from}–${metric.period.to}` : `${label}; no numeric IMF WEO observation`, metric.loaded ? [] : [metricCode]),
    metric_code: metricCode,
    source_id: "imf-weo-2026-04",
    period: metric.period,
    observation_count: metric.observation_count,
    scope: "general_government",
  };
};
const unemploymentModule = (profile) => ({
  ...status(profile?.status === "loaded", profile?.status === "loaded" ? `Unemployment rate; ${profile.preferred_source === "imf_weo" ? "IMF WEO" : "World Bank WDI fallback"}; ${profile.period.from}–${profile.period.to}` : "No numeric IMF WEO or World Bank WDI unemployment observation", profile?.status === "loaded" ? [] : ["unemployment_pct"]),
  metric_code: "unemployment_pct",
  source_id: profile?.preferred_source || null,
  fallback_used: profile?.fallback_used || false,
  period: profile?.period || null,
  observation_count: profile?.observation_count || 0,
  latest: profile?.latest || null,
  dataset: "data/global-unemployment.v1.json",
});
const status = (loaded, coverage, missing = []) => ({ status: loaded ? "loaded" : "unavailable", coverage, missing_dimensions: missing });
const countrySlug = (code) => code.toLowerCase();

function warehouseVolume(code) {
  if (!warehouseBundles.length) {
    const previousCountry = previousParity.countries.find((country) => country.country_code === code);
    if (!previousCountry?.profile) return [];
    return read(previousCountry.profile).modules?.municipalities?.warehouse || [];
  }
  const results = [];
  for (const bundle of warehouseBundles) {
    const country = bundle.manifest.country_results?.[code];
    if (!country) continue;
    results.push({
      bundle: bundle.label,
      years: Object.fromEntries(Object.entries(country).map(([year, value]) => [year, value.entities ?? null])),
      output_rows: bundle.manifest.output_rows,
      validation: bundle.manifest.validation?.status || null,
    });
  }
  return results;
}

const manifest = {
  schema_version: "1.0.0",
  contract: "country-parity.v1",
  generated_at: new Date().toISOString(),
  country_count: countryCodes.length,
  rules: {
    native_first: "National classifications, stages, currencies and accounting scopes are retained without coercion.",
    harmonised_layer: "Cross-country comparisons use separately identified IMF, OECD/COFOG or SHA observations.",
    missingness: "Unavailable, pending and not-applicable values are explicit and are never encoded as zero.",
    non_additivity: "National, local, social-insurance and public-corporation layers must not be added without eliminating internal transfers.",
    lineage: "Every module names its production artifact and official source registry.",
  },
  datasets: {
    sovereign: "lib/data/sovereign-benchmark.v1.json",
    unemployment: "data/global-unemployment.v1.json",
    revenue: "data/country-cash-in.v1.json",
    administrative_spending: "data/country-spending-2025-2026.v1.json",
    common_spending: "data/country-spending-comparison.v1.json",
    functional_spending: "data/country-functional-budgets.v1.json",
    transport: "data/transport-budget-detail.v1.json",
    health: "data/country-health.v1.json",
    health_baseline: "data/global-health-baseline.v1.json",
    providers: "data/country-provider-networks.v1.json",
    municipalities: "data/international-municipalities.v1.json",
    public_entities: "data/public-entity-coverage.v1.json",
    public_entity_directory: "data/public-entity-directory/manifest.v1.json",
    public_entity_aggregates: "data/public-entity-aggregates.v1.json",
    demography: "data/country-demography.v1.json",
  },
  warehouse_bundles: warehouseBundles.length ? warehouseBundles.map((bundle) => ({
    label: bundle.label,
    source_manifest: bundle.path,
    countries: Object.keys(bundle.manifest.country_results || {}),
    output_rows: bundle.manifest.output_rows,
    validation: bundle.manifest.validation,
  })) : previousParity.warehouse_bundles,
  countries: [],
};

for (const code of countryCodes) {
  const meta = sovereign.countries.find((country) => country.country_code === code);
  const series = sovereign.series.find((country) => country.country_code === code);
  const sourceCatalog = catalog.countries.find((country) => country.country_code === code);
  const registeredSources = sovereign.national_source_registry?.find((country) => country.country_code === code)?.sources || [];
  const admin = byCode(administrative.countries, code);
  const common = byCode(comparison.countries, code);
  const municipal = byCode(municipalities.countries, code);
  const provider = providers.countries[code];
  const healthProfile = health.countries[code];
  const globalHealthProfile = globalHealth.countries[code];
  const globalUnemploymentProfile = globalUnemployment.countries[code];
  const functionProfile = functions.countries[code];
  const transportProfile = transport.countries[code];
  const municipalityRows = municipalities.entities.filter((entity) => entity.country === code);
  const publicEntityProfile = publicEntityCoverage.countries[code] || null;
  const publicEntityRows = publicEntityDirectory.countries.find((country) => country.country_code === code) || null;
  const demographyProfile = demography.countries[code] || null;
  const providerLoaded = Boolean(provider && provider.coverage !== "source_adapter_pending");
  const providerSummary = providerLoaded ? Object.fromEntries(Object.entries(provider).filter(([key]) => key !== "facilities")) : null;
  const periods = metricYears(series);
  const missing = [];
  if (!municipal) missing.push("municipal_entity_finance");
  if (!providerLoaded) missing.push("provider_register");
  if (!publicEntityProfile) missing.push("public_entity_accounts");
  if (!demographyProfile) missing.push("national_demographic_projection");
  if (!healthProfile || healthProfile.status === "not_loaded") missing.push("harmonised_health_financing");
  if (globalHealthProfile?.status !== "loaded") missing.push("global_health_baseline");
  if (globalUnemploymentProfile?.status !== "loaded") missing.push("harmonised_unemployment");

  const modules = {
    sovereign: { ...status(meta.data_status !== "not_loaded", periods ? `${periods.from}–${periods.to}; ${Object.keys(series?.metrics || {}).length} metrics` : "WEO profile not available", meta.missing_dimensions || []), period: periods, metric_count: Object.keys(series?.metrics || {}).length },
    baseline_revenue: baselineModule(series, "revenue_pct_gdp", "General-government revenue as % of GDP"),
    baseline_spending: baselineModule(series, "expenditure_pct_gdp", "General-government expenditure as % of GDP"),
    baseline_unemployment: unemploymentModule(globalUnemploymentProfile),
    revenue: { ...status(Boolean(cashIn.countries[code]), cashIn.countries[code]?.layers ? "general government plus native institutional layers" : "native revenue detail not loaded"), native_layers: Object.keys(cashIn.countries[code]?.layers || {}), detail_level: cashIn.countries[code] ? "native_detail" : "none" },
    administrative_spending: { ...status(Boolean(admin), admin ? `${admin.rows.length} native classification rows; ${admin.periods.previous.label} and ${admin.periods.current.label}` : "not loaded"), row_count: admin?.rows.length || 0 },
    common_spending: { ...status(Boolean(common), common ? `${comparison.categories.length} harmonised categories` : "not loaded"), category_count: common ? comparison.categories.length : 0 },
    functional_spending: { ...status(Boolean(functionProfile), functionProfile ? `${Object.keys(functionProfile.categories).length} functions; ${functions.period.start}–${functions.period.end}` : "not loaded"), function_count: Object.keys(functionProfile?.categories || {}).length },
    transport: { ...status(Boolean(transportProfile), transportProfile ? (transportProfile.coverage === "available" ? `transport function and native detailed budget through ${transportProfile.latest_year}` : "official transport sources registered; harmonised detailed budget not loaded") : "not loaded", transportProfile?.coverage === "unavailable" ? ["harmonised transport budget", "government-level transport breakdown"] : []) },
    health: { ...status(Boolean(healthProfile) && healthProfile.status !== "not_loaded", healthProfile?.status === "not_loaded" ? healthProfile.unavailable_reason_en : healthProfile ? `SHA financing profile; ${healthProfile.year}` : "functional expenditure only", healthProfile?.missing_dimensions || (healthProfile ? [] : ["SHA financing and provider split"])) },
    health_baseline: { ...status(globalHealthProfile?.status === "loaded", globalHealthProfile?.status === "loaded" ? `${globalHealthProfile.available_metrics.length} global health financing, capacity, workforce and outcome metrics` : "global health baseline not loaded", globalHealthProfile?.missing_metrics || ["global health baseline"]), metric_count: globalHealthProfile?.available_metrics?.length || 0, source_id: "world-bank-wdi-who-ghed-2026-09-20", dataset: "data/global-health-baseline.v1.json" },
    providers: { ...status(providerLoaded, providerLoaded ? `${provider.facility_count ?? "official bulk"} registered provider locations` : provider?.coverage || "not loaded", providerLoaded ? (provider.missing_dimensions || []) : ["facility records"]), facility_count: provider?.facility_count ?? null, coverage_level: provider?.coverage || null },
    municipalities: { ...status(Boolean(municipal), municipal?.coverage_en || "not loaded", municipal?.missing_dimensions || (municipal ? [] : ["entity census", "budget facts"])), entity_count: municipal?.directory_count || 0, fact_count: municipal?.counts?.[municipal?.years?.at(-1)] ?? 0, years: municipal?.years || [], stages: municipal?.stages || [], measures: municipal?.measures || [], coverage_level: municipal?.status || null, directory: municipal ? `data/countries/${countrySlug(code)}/municipalities.v1.json` : null, warehouse: warehouseVolume(code) },
    public_entities: { ...status(Boolean(publicEntityProfile && publicEntityRows), publicEntityProfile ? `${publicEntityRows.record_count} registry rows; ${publicEntityRows.financial_record_count} with economic fields; reference perimeter ${publicEntityProfile.comparison_perimeter}` : "not loaded", publicEntityProfile?.unresolved_layers || (publicEntityProfile ? [] : ["ownership register", "entity accounts"])), entity_count: publicEntityRows?.record_count || 0, represented_entity_count: publicEntityRows?.represented_entity_count || 0, broad_entity_count: publicEntityProfile?.broad_entity_count ?? null, financial_statement_count: publicEntityRows?.financial_record_count || 0, coverage_level: Object.values(publicEntityProfile?.perimeters || {}).some((perimeter) => perimeter.coverage_status === "aggregate_only") ? "aggregate_and_entity_registry" : "entity_registry" },
    demography: { ...status(Boolean(demographyProfile), demographyProfile ? `${demographyProfile.period.from}–${demographyProfile.period.to}; annual age/sex detail plus ${demographyProfile.years.length} common-year aggregates` : "not loaded", demographyProfile ? [] : ["population projection", "annual age structure", "sex breakdown"]), projection: demographyProfile?.projection || null, detail: demographyProfile?.detail || null, detail_row_count: demographyProfile?.detail_row_count || 0 },
  };
  const loadedCount = Object.values(modules).filter((module) => module.status === "loaded").length;
  const entry = {
    country_code: code,
    iso2: meta.iso2 || null,
    weo_country_code: meta.weo_country_code || code,
    profile_tier: meta.profile_tier || "full",
    name_cs: meta.name_cs,
    name_en: meta.name_en,
    currency_code: meta.currency_code,
    profile: `data/countries/${countrySlug(code)}/profile.v1.json`,
    coverage: { loaded_modules: loadedCount, total_modules: Object.keys(modules).length, missing_dimensions: missing },
    modules,
    sources: sourceCatalog?.sources?.length ? sourceCatalog.sources : (registeredSources.length ? registeredSources : [{
      source_id: "imf-weo-2026-04",
      source_name: `${sovereign.source.provider} · ${sovereign.source.dataset}`,
      source_url: sovereign.source.download_page,
      coverage: `${sovereign.period.start_year}–${sovereign.period.end_year}`,
      formats: ["XLSX"],
      purpose: "Harmonised general-government macro-fiscal series",
      active: true,
    }]),
  };
  manifest.countries.push(entry);

  const bundle = {
    schema_version: "1.0.0",
    contract: "country-profile.v1",
    generated_at: manifest.generated_at,
    country: { country_code: code, name_cs: meta.name_cs, name_en: meta.name_en, currency_code: meta.currency_code, fiscal_architecture: meta.fiscal_architecture },
    coverage: entry.coverage,
    modules,
    data: {
      sovereign: { series, summary: sovereign.summaries.find((country) => country.country_code === code) },
      unemployment_baseline: globalUnemploymentProfile || null,
      revenue: cashIn.countries[code] || null,
      administrative_spending: admin || null,
      common_spending: common || null,
      functional_spending: functionProfile || null,
      transport: transportProfile || null,
      health: healthProfile || null,
      health_baseline: globalHealthProfile ? { status: globalHealthProfile.status, available_metrics: globalHealthProfile.available_metrics, missing_metrics: globalHealthProfile.missing_metrics, dataset: "data/global-health-baseline.v1.json" } : null,
      providers: providerSummary ? { ...providerSummary } : null,
      municipalities: municipal || null,
      public_entities: publicEntityProfile && publicEntityRows ? {coverage:publicEntityProfile,directory:publicEntityRows} : null,
      demography: demographyProfile,
    },
    sources: entry.sources,
  };
  const directory = new URL(`data/countries/${countrySlug(code)}/`, root);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("profile.v1.json", directory), `${JSON.stringify(bundle, null, 2)}\n`);
  if (municipal) {
    const shard = { schema_version: "1.0.0", country_code: code, generated_at: manifest.generated_at, coverage: municipal, entities: municipalityRows };
    await writeFile(new URL("municipalities.v1.json", directory), `${JSON.stringify(shard)}\n`);
  }
}

if (manifest.countries.length !== sovereign.universe.weo_profile_count) throw new Error(`Expected ${sovereign.universe.weo_profile_count} countries, received ${manifest.countries.length}`);
const establishedDeepDiveCountries = new Set(["CZE","DEU","DNK","FRA","GBR","POL","SWE","CHE","UKR","USA"]);
for (const country of manifest.countries) {
  if (country.modules.sovereign.metric_count !== 15) throw new Error(`${country.country_code}: expected 15 sovereign metrics`);
  if (fullProfileCountries.has(country.country_code) && country.modules.administrative_spending.status !== "loaded") throw new Error(`${country.country_code}: native spending is not loaded`);
  if (fullProfileCountries.has(country.country_code) && country.country_code !== "BRA" && country.modules.functional_spending.status !== "loaded") throw new Error(`${country.country_code}: functional spending is not loaded`);
  if (establishedDeepDiveCountries.has(country.country_code) && country.modules.transport.status !== "loaded") throw new Error(`${country.country_code}: transport detail is not loaded`);
}
await writeFile(new URL("data/country-parity.v1.json", root), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote parity manifest and ${manifest.countries.length} country bundles; ${manifest.countries.filter((country) => country.modules.municipalities.status === "loaded").length} municipal shards`);
