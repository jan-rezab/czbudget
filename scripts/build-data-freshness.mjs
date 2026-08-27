import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const currentYear = new Date().getUTCFullYear();

const [
  municipalities,
  parity,
  itemized,
  structures,
  nationalBudgets,
  revenue,
  transportBudgets,
  transportPerformance,
  health,
  healthPerformance,
  providers,
  demography,
  economy,
  defense,
  migration,
  capitals,
  enterprises,
  sovereignBenchmark,
] = await Promise.all([
  read("data/international-municipalities.v1.json"),
  read("data/country-parity.v1.json"),
  read("data/municipal-itemized-coverage.v1.json"),
  read("data/municipal-budget-structure.v1.json"),
  read("data/country-spending-2025-2026.v1.json"),
  read("data/country-revenue.v1.json"),
  read("data/transport-budget-detail.v1.json"),
  read("data/transport-performance.v1.json"),
  read("data/country-health.v1.json"),
  read("data/country-health-performance.v1.json"),
  read("data/country-provider-networks.v1.json"),
  read("data/country-demography.v1.json"),
  read("data/economy/economy-deep-dive.v1.json"),
  read("data/defense-deep-dive.v1.json"),
  read("data/eu-migration.v1.json"),
  read("data/eu-capital-budgets.v1.json"),
  read("data/state-owned-enterprises.v1.json"),
  read("lib/data/sovereign-benchmark.v1.json"),
]);

const modules = [
  { id: "municipalities", family: "municipal", label_cs: "Obce · adresář a souhrny", label_en: "Municipalities · directory and headlines", order: 1 },
  { id: "municipal_detail", family: "municipal", label_cs: "Obce · položkové rozpočty", label_en: "Municipalities · itemized budgets", order: 2 },
  { id: "municipal_structure", family: "municipal", label_cs: "Struktura obcí", label_en: "Municipal structure", order: 3 },
  { id: "national_budget", family: "country", label_cs: "Národní rozpočet", label_en: "National budget", order: 4 },
  { id: "sovereign", family: "country", label_cs: "Vládní finance", label_en: "Sovereign fiscal", order: 5 },
  { id: "revenue", family: "country", label_cs: "Příjmy", label_en: "Revenue", order: 6 },
  { id: "transport", family: "deep_dive", label_cs: "Doprava", label_en: "Transport", order: 7 },
  { id: "health", family: "deep_dive", label_cs: "Zdraví", label_en: "Health", order: 8 },
  { id: "providers", family: "deep_dive", label_cs: "Poskytovatelé", label_en: "Providers", order: 9 },
  { id: "demography", family: "deep_dive", label_cs: "Demografie", label_en: "Demography", order: 10 },
  { id: "economy", family: "deep_dive", label_cs: "Ekonomika", label_en: "Economy", order: 11 },
  { id: "defense", family: "deep_dive", label_cs: "Obrana", label_en: "Defense", order: 12 },
  { id: "migration", family: "deep_dive", label_cs: "Migrace", label_en: "Migration", order: 13 },
  { id: "capital_cities", family: "municipal", label_cs: "Hlavní města", label_en: "Capital cities", order: 14 },
  { id: "state_enterprises", family: "country", label_cs: "Státní podniky", label_en: "State enterprises", order: 15 },
];

const countries = new Map();
const addCountry = (code, values = {}) => {
  if (!code) return;
  const previous = countries.get(code) || { code, iso2: null, name_cs: code, name_en: code };
  countries.set(code, {
    ...previous,
    ...Object.fromEntries(Object.entries(values).filter(([, value]) => value != null && value !== "")),
  });
};

municipalities.countries.forEach((country) => addCountry(country.code, {
  iso2: country.alpha2,
  name_cs: country.name_cs,
  name_en: country.name_en,
}));
parity.countries.forEach((country) => addCountry(country.country_code, {
  name_cs: country.name_cs,
  name_en: country.name_en,
}));
migration.countries.forEach((country) => addCountry(country.iso3, {
  iso2: country.eurostat_geo,
  name_cs: country.name_cs,
  name_en: country.name_en,
}));
economy.countries.forEach((country) => addCountry(country.code, {
  iso2: country.iso2,
  name_cs: country.name_cs,
  name_en: country.name_en,
}));
defense.countries.forEach((country) => addCountry(country.code, {
  name_cs: country.name_cs,
  name_en: country.name_en,
}));
enterprises.records.forEach((record) => addCountry(record.country_code, {
  name_cs: record.country_cs,
  name_en: record.country_en,
}));

const yearValues = (value) => String(value ?? "").match(/\b(?:19|20)\d{2}\b/g)?.map(Number) || [];
const max = (values) => values.filter(Number.isFinite).reduce((result, value) => Math.max(result, value), -Infinity);
const maxOrNull = (values) => {
  const value = max(values);
  return Number.isFinite(value) ? value : null;
};
const minOrNull = (values) => {
  const clean = values.filter(Number.isFinite);
  return clean.length ? Math.min(...clean) : null;
};
const recursiveYears = (value, results = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => recursiveYears(item, results));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["year", "fiscal_year", "reference_year", "latest_year", "bed_year"].includes(key) && Number.isFinite(Number(item))) results.push(Number(item));
      else recursiveYears(item, results);
    }
  }
  return results;
};
const generatedAt = (...values) => values.filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
const freshnessBand = (latestYear, vintageType) => {
  if (vintageType === "plan") return "planned";
  if (vintageType === "projection") return "projection";
  if (vintageType === "estimate" || vintageType === "actual_estimate") return latestYear >= currentYear - 1 ? "estimate_current" : "estimate_lag";
  if (vintageType === "register") return "live_register";
  if (vintageType === "mixed") return latestYear >= currentYear - 1 ? "mixed_current" : "mixed_lag";
  if (!latestYear) return "undated";
  if (latestYear >= currentYear - 1) return "current";
  if (latestYear === currentYear - 2) return "statistical_lag";
  return "older";
};
const headlineFiscalMetrics = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp"];
const sovereignSeriesByCode = new Map(sovereignBenchmark.series.map((country) => [country.country_code, country]));
const sovereignVintage = (code, year) => {
  const series = sovereignSeriesByCode.get(code);
  const statuses = new Set(headlineFiscalMetrics.map((metric) => series?.metrics?.[metric]?.values?.find((point) => point.year === year)?.status).filter(Boolean));
  if (statuses.size === 1) return statuses.has("estimate") ? "estimate" : "actual";
  return statuses.size > 1 ? "actual_estimate" : "actual";
};
const records = [];
const addRecord = (record) => {
  const latestYear = Number.isFinite(Number(record.latest_year)) ? Number(record.latest_year) : null;
  const firstYear = Number.isFinite(Number(record.first_year)) ? Number(record.first_year) : latestYear;
  records.push({
    country_code: record.country_code,
    module: record.module,
    latest_year: latestYear,
    first_year: firstYear,
    period_label: record.period_label || (latestYear ? String(latestYear) : null),
    vintage_type: record.vintage_type || "actual",
    freshness_band: freshnessBand(latestYear, record.vintage_type || "actual"),
    coverage_status: record.coverage_status || "full",
    coverage_cs: record.coverage_cs || "",
    coverage_en: record.coverage_en || "",
    entity_count: Number(record.entity_count) || null,
    row_count: Number(record.row_count) || null,
    artifact: record.artifact,
    artifact_generated_at: record.artifact_generated_at || null,
    source_url: record.source_url || null,
    view_url: record.view_url || null,
  });
};

for (const country of municipalities.countries) {
  const years = country.years || [];
  addRecord({
    country_code: country.code,
    module: "municipalities",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    vintage_type: "actual",
    coverage_status: country.status || "full",
    coverage_cs: country.coverage_cs,
    coverage_en: country.coverage_en,
    entity_count: country.directory_count,
    row_count: municipalities.entities.filter((entity) => entity.country === country.code).length,
    artifact: "data/international-municipalities.v1.json",
    artifact_generated_at: municipalities.generated_at,
    source_url: country.source,
    view_url: `/municipalities.html?country=${country.code}`,
  });
}

for (const country of itemized.countries) {
  const years = yearValues(country.period);
  addRecord({
    country_code: country.code,
    module: "municipal_detail",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    period_label: country.period,
    coverage_status: country.status,
    coverage_cs: country.detail_kind_cs,
    coverage_en: country.detail_kind_en,
    entity_count: country.profile_count,
    artifact: "data/municipal-itemized-coverage.v1.json",
    artifact_generated_at: itemized.generated_at,
    source_url: country.source_url,
    view_url: `/municipalities.html?country=${country.code}`,
  });
}

for (const country of structures.countries) {
  addRecord({
    country_code: country.code,
    module: "municipal_structure",
    latest_year: country.year,
    coverage_cs: country.scope_cs,
    coverage_en: country.scope_en,
    entity_count: country.profile_count,
    artifact: "data/municipal-budget-structure.v1.json",
    artifact_generated_at: structures.generated_at,
    source_url: municipalities.countries.find((item) => item.code === country.code)?.source,
    view_url: `/municipalities.html?country=${country.code}`,
  });
}

for (const country of nationalBudgets.countries) {
  const years = Object.values(country.periods || {}).flatMap((period) => yearValues(period.label));
  addRecord({
    country_code: country.code,
    module: "national_budget",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    period_label: Object.values(country.periods || {}).map((period) => period.label).join("–"),
    vintage_type: "plan",
    coverage_cs: country.scope_cs,
    coverage_en: country.scope_en,
    row_count: country.rows?.length,
    artifact: "data/country-spending-2025-2026.v1.json",
    artifact_generated_at: nationalBudgets.generated_at,
    view_url: `/country.html?code=${country.code}`,
  });
}

for (const country of parity.countries) {
  const sovereign = country.modules.sovereign;
  const vintageType = sovereignVintage(country.country_code, sovereign.period?.to);
  addRecord({
    country_code: country.country_code,
    module: "sovereign",
    first_year: sovereign.period?.from,
    latest_year: sovereign.period?.to,
    vintage_type: vintageType,
    coverage_cs: `${sovereign.coverage}; stav zdroje pro příjmy, výdaje a saldo v posledním roce: ${vintageType === "estimate" ? "odhad" : vintageType === "actual_estimate" ? "skutečnost + odhad" : "skutečnost"}`,
    coverage_en: `${sovereign.coverage}; source status for revenue, expenditure and balance in the latest year: ${vintageType === "estimate" ? "estimate" : vintageType === "actual_estimate" ? "actual + estimate" : "actual"}`,
    row_count: sovereign.metric_count,
    artifact: "lib/data/sovereign-benchmark.v1.json",
    artifact_generated_at: parity.generated_at,
    source_url: sovereignBenchmark.source.download_page,
    view_url: `/country.html?code=${country.country_code}`,
  });
}

for (const [code, country] of Object.entries(revenue.countries)) {
  const years = recursiveYears(country).filter((year) => year <= currentYear);
  addRecord({
    country_code: code,
    module: "revenue",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    coverage_cs: "Daňový mix, příjemce a obecní transfery",
    coverage_en: "Tax mix, initial recipient and municipal transfers",
    artifact: "data/country-revenue.v1.json",
    artifact_generated_at: revenue.generated_at,
    view_url: `/deep-dives/revenue/?code=${code}`,
  });
}

for (const [code, country] of Object.entries(transportBudgets.countries)) {
  const performanceYears = recursiveYears(transportPerformance.countries?.[code] || {});
  const years = [...(country.records || []).map((record) => record.year), ...performanceYears];
  addRecord({
    country_code: code,
    module: "transport",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    coverage_status: country.coverage === "available" ? "full" : country.coverage || "partial",
    coverage_cs: "Výdaje, síť a výkon dopravy",
    coverage_en: "Transport spending, network and performance",
    row_count: country.records?.length,
    artifact: "data/transport-budget-detail.v1.json + data/transport-performance.v1.json",
    artifact_generated_at: generatedAt(transportBudgets.generated_at, transportPerformance.generated_at),
    view_url: `/deep-dives/transportation/?code=${code}`,
  });
}

for (const [code, country] of Object.entries(health.countries)) {
  const years = [...recursiveYears(country), ...recursiveYears(healthPerformance.countries?.[code] || {})];
  addRecord({
    country_code: code,
    module: "health",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    coverage_cs: "Financování, kapacita a zdravotní výsledky",
    coverage_en: "Financing, capacity and health outcomes",
    artifact: "data/country-health.v1.json + data/country-health-performance.v1.json",
    artifact_generated_at: generatedAt(health.generated_at, healthPerformance.generated_at),
    source_url: country.official_url,
    view_url: `/deep-dives/health/?code=${code}`,
  });
}

for (const [code, country] of Object.entries(providers.countries)) {
  addRecord({
    country_code: code,
    module: "providers",
    vintage_type: "register",
    coverage_status: country.coverage === "facility_register" ? "full" : "partial",
    coverage_cs: `${country.facility_count || 0} míst poskytovatelů`,
    coverage_en: `${country.facility_count || 0} provider locations`,
    entity_count: country.facility_count,
    artifact: "data/country-provider-networks.v1.json",
    artifact_generated_at: providers.generated_at,
    source_url: country.source?.url,
    view_url: `/deep-dives/health/?code=${code}`,
  });
}

for (const [code, country] of Object.entries(demography.countries)) {
  addRecord({
    country_code: code,
    module: "demography",
    first_year: country.period?.from,
    latest_year: country.period?.to,
    period_label: `${country.period?.from || "—"}–${country.period?.to || "—"}`,
    vintage_type: "projection",
    coverage_cs: country.projection,
    coverage_en: country.projection,
    row_count: country.detail_row_count,
    artifact: "data/country-demography.v1.json",
    artifact_generated_at: demography.generated_at,
    view_url: `/deep-dives/ageing/?code=${code}`,
  });
}

for (const country of economy.countries) {
  const series = economy.series.filter((item) => item.country_code === country.code);
  const actualPeriods = series.flatMap((item) => item.values || []).filter((row) => row[2] === "actual").map((row) => Number(String(row[0]).slice(0, 4)));
  addRecord({
    country_code: country.code,
    module: "economy",
    first_year: minOrNull(actualPeriods),
    latest_year: maxOrNull(actualPeriods),
    coverage_cs: `${series.length} ekonomických řad v reportu`,
    coverage_en: `${series.length} economic series in the report`,
    row_count: series.length,
    artifact: "data/economy/economy-deep-dive.v1.json",
    artifact_generated_at: economy.generated_at,
    view_url: `/deep-dives/economy/?code=${country.code}`,
  });
}

for (const country of defense.countries) {
  const actualYear = country.comparison?.latest?.year;
  const planYears = yearValues(country.budget?.period);
  addRecord({
    country_code: country.code,
    module: "defense",
    first_year: country.comparison?.series?.[0]?.[0],
    latest_year: maxOrNull([actualYear, ...planYears]),
    period_label: planYears.length ? `${actualYear} actual · ${country.budget.period} plan` : String(actualYear || "—"),
    vintage_type: planYears.length ? "mixed" : "actual",
    coverage_cs: country.budget?.scope_cs || "Výdaje na obranu vůči HDP",
    coverage_en: country.budget?.scope_en || "Military expenditure relative to GDP",
    row_count: country.budget?.items?.length,
    artifact: "data/defense-deep-dive.v1.json",
    artifact_generated_at: defense.generated_at,
    view_url: `/deep-dives/defense/?code=${country.code}`,
  });
}

for (const country of migration.countries) {
  const years = country.rows.map((row) => row.year);
  addRecord({
    country_code: country.iso3,
    module: "migration",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    coverage_cs: "Přistěhování, vystěhování, saldo a populace",
    coverage_en: "Immigration, emigration, balance and population",
    row_count: country.rows.length,
    artifact: "data/eu-migration.v1.json",
    artifact_generated_at: migration.generated_at,
    source_url: migration.sources?.metadata_url,
    view_url: "/deep-dives/migration/",
  });
}

const iso2ToIso3 = new Map([...countries.values()].filter((country) => country.iso2).map((country) => [country.iso2, country.code]));
const capitalsByCountry = Map.groupBy(capitals.cities, (city) => iso2ToIso3.get(city.country_code));
for (const [code, cities] of capitalsByCountry) {
  if (!code) continue;
  const years = cities.flatMap((city) => yearValues(city.period));
  addRecord({
    country_code: code,
    module: "capital_cities",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    vintage_type: "plan",
    coverage_cs: `${cities.length} rozpočtových profilů hlavních měst`,
    coverage_en: `${cities.length} capital-city budget profiles`,
    entity_count: cities.length,
    artifact: "data/eu-capital-budgets.v1.json",
    artifact_generated_at: capitals.generated_at,
    source_url: cities[0].landing_page_url || cities[0].download_url,
    view_url: "/deep-dives/capital-cities/",
  });
}

const enterprisesByCountry = Map.groupBy(enterprises.records, (record) => record.country_code);
for (const [code, rows] of enterprisesByCountry) {
  const years = rows.flatMap((row) => yearValues(row.period));
  addRecord({
    country_code: code,
    module: "state_enterprises",
    first_year: minOrNull(years),
    latest_year: maxOrNull(years),
    coverage_cs: `${rows.length} největších celostátně ovládaných podniků`,
    coverage_en: `${rows.length} largest nationally controlled enterprises`,
    entity_count: rows.length,
    artifact: "data/state-owned-enterprises.v1.json",
    artifact_generated_at: enterprises.as_of,
    source_url: rows[0].source_url,
    view_url: "/deep-dives/state-owned-enterprises/",
  });
}

records.sort((a, b) => a.country_code.localeCompare(b.country_code) || modules.find((module) => module.id === a.module).order - modules.find((module) => module.id === b.module).order);
const publishedCountries = [...new Set(records.map((record) => record.country_code))];
const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  reference_year: currentYear,
  definitions: {
    latest_year: "Latest fiscal, reporting or observation year represented by the published artifact; it is not the file-generation date.",
    generated_at: "When the derived web artifact was built.",
    vintage_type: "actual, estimate, actual_estimate, plan, projection, register or mixed; these vintages must not be ranked as if they were equivalent.",
    estimate: "Estimate is the status carried by the source for the latest-year headline fiscal metrics; it is not relabelled as an actual observation.",
    statistical_lag: `An actual/statistical series ending in ${currentYear - 2}; a normal release lag for many international sources, not automatically stale.`,
  },
  totals: {
    countries: publishedCountries.length,
    modules: modules.length,
    records: records.length,
    municipal_units: municipalities.countries.reduce((sum, country) => sum + (Number(country.directory_count) || 0), 0),
    municipality_rows: municipalities.entities.length,
    municipal_country_coverage: municipalities.countries.length,
    itemized_municipal_country_coverage: itemized.countries.length,
    itemized_municipal_profiles: itemized.countries.reduce((sum, country) => sum + (Number(country.profile_count) || 0), 0),
  },
  modules,
  countries: [...countries.values()].filter((country) => publishedCountries.includes(country.code)).sort((a, b) => a.name_en.localeCompare(b.name_en)),
  records,
};

await writeFile(new URL("data/data-freshness.v1.json", root), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.records.length} country-layer records across ${output.totals.countries} countries and ${output.totals.modules} modules.`);
