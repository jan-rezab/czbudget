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
    const loaded = Array.isArray(provider?.facilities) || Boolean(provider?.records);
    country.modules.providers = {
      status: loaded ? "loaded" : "unavailable",
      coverage: loaded ? `${provider.facility_count} registered provider locations` : provider?.coverage || "not loaded",
      missing_dimensions: loaded ? [] : ["facility records"],
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
const providers = read("data/country-provider-networks.v1.json");
const municipalities = read("data/international-municipalities.v1.json");
const publicEntities = read("data/cz-public-entities-2024.json");
const demography = read("data/demography-social.v1.json");

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
const byCode = (rows, code, key = "code") => rows.find((row) => row[key] === code);
const metricYears = (series) => {
  const years = Object.values(series?.metrics || {}).flatMap((metric) => metric.values?.map((point) => point.year) || []);
  return years.length ? { from: Math.min(...years), to: Math.max(...years), years: new Set(years).size } : null;
};
const status = (loaded, coverage, missing = []) => ({ status: loaded ? "loaded" : "unavailable", coverage, missing_dimensions: missing });
const countrySlug = (code) => code.toLowerCase();

function warehouseVolume(code) {
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
    revenue: "data/country-cash-in.v1.json",
    administrative_spending: "data/country-spending-2025-2026.v1.json",
    common_spending: "data/country-spending-comparison.v1.json",
    functional_spending: "data/country-functional-budgets.v1.json",
    transport: "data/transport-budget-detail.v1.json",
    health: "data/country-health.v1.json",
    providers: "data/country-provider-networks.v1.json",
    municipalities: "data/international-municipalities.v1.json",
    public_entities_czechia: "data/cz-public-entities-2024.json",
    demography_czechia: "data/demography-social.v1.json",
  },
  warehouse_bundles: warehouseBundles.map((bundle) => ({
    label: bundle.label,
    source_manifest: bundle.path,
    countries: Object.keys(bundle.manifest.country_results || {}),
    output_rows: bundle.manifest.output_rows,
    validation: bundle.manifest.validation,
  })),
  countries: [],
};

for (const code of countryCodes) {
  const meta = sovereign.countries.find((country) => country.country_code === code);
  const series = sovereign.series.find((country) => country.country_code === code);
  const sourceCatalog = catalog.countries.find((country) => country.country_code === code);
  const admin = byCode(administrative.countries, code);
  const common = byCode(comparison.countries, code);
  const municipal = byCode(municipalities.countries, code);
  const provider = providers.countries[code];
  const healthProfile = health.countries[code];
  const functionProfile = functions.countries[code];
  const transportProfile = transport.countries[code];
  const municipalityRows = municipalities.entities.filter((entity) => entity.country === code);
  const publicEntityProfile = code === "CZE" ? publicEntities : null;
  const demographyProfile = code === "CZE" ? demography : null;
  const providerLoaded = Array.isArray(provider?.facilities) || Boolean(provider?.records);
  const providerSummary = providerLoaded ? Object.fromEntries(Object.entries(provider).filter(([key]) => key !== "facilities")) : null;
  const periods = metricYears(series);
  const missing = [];
  if (!municipal) missing.push("municipal_entity_finance");
  if (!providerLoaded) missing.push("provider_register");
  if (!publicEntityProfile) missing.push("public_entity_accounts");
  if (!demographyProfile) missing.push("national_demographic_projection");
  if (!healthProfile) missing.push("harmonised_health_financing");

  const modules = {
    sovereign: { ...status(Boolean(series), `${periods?.from}–${periods?.to}; ${Object.keys(series?.metrics || {}).length} metrics`), period: periods, metric_count: Object.keys(series?.metrics || {}).length },
    revenue: { ...status(Boolean(cashIn.countries[code]), cashIn.countries[code]?.layers ? "general government plus native institutional layers" : "general-government revenue and balance"), native_layers: Object.keys(cashIn.countries[code]?.layers || {}) },
    administrative_spending: { ...status(Boolean(admin), admin ? `${admin.rows.length} native classification rows; ${admin.periods.previous.label} and ${admin.periods.current.label}` : "not loaded"), row_count: admin?.rows.length || 0 },
    common_spending: { ...status(Boolean(common), common ? `${comparison.categories.length} harmonised categories` : "not loaded"), category_count: common ? comparison.categories.length : 0 },
    functional_spending: { ...status(Boolean(functionProfile), functionProfile ? `${Object.keys(functionProfile.categories).length} functions; ${functions.period.start}–${functions.period.end}` : "not loaded"), function_count: Object.keys(functionProfile?.categories || {}).length },
    transport: { ...status(Boolean(transportProfile), transportProfile ? "transport function and native detailed budget" : "not loaded") },
    health: { ...status(Boolean(healthProfile), healthProfile ? `SHA financing/provider shares; ${healthProfile.year}` : "functional expenditure only", healthProfile ? [] : ["SHA financing and provider split"]) },
    providers: { ...status(providerLoaded, providerLoaded ? `${provider.facility_count} registered inpatient locations` : provider?.coverage || "not loaded", providerLoaded ? [] : ["facility records"]), facility_count: provider?.facility_count || 0 },
    municipalities: { ...status(Boolean(municipal), municipal?.coverage_en || "not loaded", municipal ? [] : ["entity census", "budget facts"]), entity_count: municipal?.directory_count || 0, years: municipal?.years || [], stages: municipal?.stages || [], measures: municipal?.measures || [], directory: municipal ? `data/countries/${countrySlug(code)}/municipalities.v1.json` : null, warehouse: warehouseVolume(code) },
    public_entities: { ...status(Boolean(publicEntityProfile), publicEntityProfile ? `${publicEntityProfile.entities.length} selected controlled entities` : "not loaded", publicEntityProfile ? [] : ["ownership register", "entity accounts"]), entity_count: publicEntityProfile?.entities.length || 0 },
    demography: { ...status(Boolean(demographyProfile), demographyProfile ? `${demographyProfile.projection.from}–${demographyProfile.projection.to}` : "not loaded", demographyProfile ? [] : ["population projection", "age structure", "social-system model"]) },
  };
  const loadedCount = Object.values(modules).filter((module) => module.status === "loaded").length;
  const entry = {
    country_code: code,
    name_cs: meta.name_cs,
    name_en: meta.name_en,
    currency_code: meta.currency_code,
    profile: `data/countries/${countrySlug(code)}/profile.v1.json`,
    coverage: { loaded_modules: loadedCount, total_modules: Object.keys(modules).length, missing_dimensions: missing },
    modules,
    sources: sourceCatalog?.sources || [],
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
      revenue: cashIn.countries[code] || null,
      administrative_spending: admin || null,
      common_spending: common || null,
      functional_spending: functionProfile || null,
      transport: transportProfile || null,
      health: healthProfile || null,
      providers: providerSummary ? { ...providerSummary } : null,
      municipalities: municipal || null,
      public_entities: publicEntityProfile,
      demography: demographyProfile,
    },
    sources: sourceCatalog?.sources || [],
  };
  const directory = new URL(`data/countries/${countrySlug(code)}/`, root);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("profile.v1.json", directory), `${JSON.stringify(bundle, null, 2)}\n`);
  if (municipal) {
    const shard = { schema_version: "1.0.0", country_code: code, generated_at: manifest.generated_at, coverage: municipal, entities: municipalityRows };
    await writeFile(new URL("municipalities.v1.json", directory), `${JSON.stringify(shard)}\n`);
  }
}

if (manifest.countries.length !== 10) throw new Error(`Expected 10 countries, received ${manifest.countries.length}`);
for (const country of manifest.countries) {
  if (country.modules.sovereign.metric_count !== 15) throw new Error(`${country.country_code}: expected 15 sovereign metrics`);
  if (country.modules.administrative_spending.status !== "loaded") throw new Error(`${country.country_code}: native spending is not loaded`);
  if (country.modules.functional_spending.status !== "loaded") throw new Error(`${country.country_code}: functional spending is not loaded`);
  if (country.modules.transport.status !== "loaded") throw new Error(`${country.country_code}: transport detail is not loaded`);
}
await writeFile(new URL("data/country-parity.v1.json", root), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote parity manifest and ${manifest.countries.length} country bundles; ${manifest.countries.filter((country) => country.modules.municipalities.status === "loaded").length} municipal shards`);
