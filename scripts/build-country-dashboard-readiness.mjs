import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = name => path.join(root, "data", name);
const read = name => JSON.parse(fs.readFileSync(dataPath(name), "utf8"));

const parity = read("country-parity.v1.json");
const revenue = read("country-revenue.v1.json").countries;
const cashIn = read("country-cash-in.v1.json").countries;
const spendingRows = Object.fromEntries(
  read("country-spending-2025-2026.v1.json").countries.map(country => [country.code, country]),
);
const spendingCommon = Object.fromEntries(
  read("country-spending-comparison.v1.json").countries.map(country => [country.code, country]),
);
const functional = read("country-functional-budgets.v1.json").countries;
const demography = read("country-demography.v1.json").countries;
const health = read("country-health.v1.json").countries;
const healthPerformance = read("country-health-performance.v1.json").countries;

const requiredHealthFields = ["health_gdp_pct", "per_capita_ppp", "per_capita_local", "beds_per_1000"];
const requiredHealthSplits = {
  financing: ["public_compulsory", "out_of_pocket", "voluntary_other"],
  providers: ["hospitals", "residential_ltc", "ambulatory", "retailers", "other"],
};

function healthProfileGaps(profile) {
  if (!profile) return ["health_financing_profile_absent"];
  const gaps = requiredHealthFields.filter(field => profile[field] == null);
  for (const [group, fields] of Object.entries(requiredHealthSplits)) {
    for (const field of fields) if (profile[group]?.[field] == null) gaps.push(`${group}.${field}`);
  }
  return gaps;
}

function healthPerformanceGaps(profile) {
  if (!profile) return ["health_performance_profile_absent"];
  const gaps = [];
  for (const [group, metrics] of Object.entries(profile)) {
    for (const [metric, observation] of Object.entries(metrics)) {
      if (observation?.value == null) gaps.push(`${group}.${metric}`);
    }
  }
  return gaps;
}

function moduleStatus(gaps, partial = false) {
  if (!gaps.length) return "ready";
  return partial ? "partial" : "blocked";
}

const fullCountries = parity.countries.filter(country => country.profile_tier === "full");
const countries = {};

for (const country of fullCountries) {
  const code = country.country_code;
  const profile = read(`countries/${code.toLowerCase()}/profile.v1.json`);
  const unemployment = profile.data.sovereign.series.metrics.unemployment_pct;
  const revenueProfile = revenue[code];
  const cashProfile = cashIn[code];
  const spendingProfile = spendingRows[code];
  const commonProfile = spendingCommon[code];
  const functionalProfile = functional[code];
  const demographyProfile = demography[code];
  const healthProfile = health[code];
  const performanceProfile = healthPerformance[code];
  const baseHealthGaps = healthProfileGaps(healthProfile);
  const performanceGaps = healthPerformanceGaps(performanceProfile);
  const hasHealthCore = baseHealthGaps.length === 0;
  const hasFunctionalHistory = Boolean(functionalProfile);
  const currentSpendingYear = spendingProfile?.periods?.current?.label ?? null;
  const harmonisedOnly = spendingProfile?.scope_en?.includes("COFOG") ?? false;

  const coreBlockers = [];
  if (!revenueProfile || !cashProfile) coreBlockers.push("revenue");
  if (!spendingProfile || !commonProfile) coreBlockers.push("spending");
  if (!demographyProfile) coreBlockers.push("demography");
  if (!unemployment?.values?.some(point => point.value != null)) coreBlockers.push("unemployment");
  if (!hasHealthCore) coreBlockers.push("health");

  countries[code] = {
    name_en: country.name_en,
    name_cs: country.name_cs,
    dashboard_scaffold_ready: coreBlockers.length === 0,
    czech_depth_status: coreBlockers.length ? "blocked" : performanceGaps.length ? "ready_with_gaps" : "ready",
    core_blockers: coreBlockers,
    modules: {
      revenue: {
        status: revenueProfile && cashProfile ? "ready" : "blocked",
        latest_tax_year: revenueProfile?.latest_year ?? null,
        tax_timeline_points: revenueProfile?.timeline?.length ?? 0,
        tax_detail_categories: Object.keys(revenueProfile?.tax_detail ?? {}).length,
        consolidated_year: cashProfile?.consolidated?.year ?? null,
        native_layers: Object.keys(cashProfile?.layers ?? {}),
        gaps: code === "CZE" ? [] : ["native_revenue_layers_not_loaded"],
      },
      spending: {
        status: spendingProfile && commonProfile ? "ready" : "blocked",
        source_dimension: spendingProfile?.dimension ?? null,
        source_row_count: spendingProfile?.rows?.length ?? 0,
        common_category_count: commonProfile?.groups?.length ?? 0,
        previous_period: spendingProfile?.periods?.previous?.label ?? null,
        current_period: currentSpendingYear,
        functional_history: hasFunctionalHistory
          ? { status: "ready", functions: Object.keys(functionalProfile.categories), period: "2015-2024" }
          : { status: "blocked", functions: [], period: null },
        gaps: [
          ...(harmonisedOnly ? ["native_budget_classification_not_loaded"] : []),
          ...(["2023", "2024"].includes(currentSpendingYear) ? ["budget_pair_ends_in_2024"] : []),
          ...(!hasFunctionalHistory ? ["functional_history_absent"] : []),
        ],
      },
      demography: {
        status: demographyProfile ? "ready" : "blocked",
        common_year_count: demographyProfile?.years?.length ?? 0,
        detail_row_count: demographyProfile?.detail_row_count ?? 0,
        projection_period: demographyProfile?.period ?? null,
        age_sex_detail: Boolean(demographyProfile?.detail),
        gaps: [],
      },
      unemployment: {
        status: unemployment?.values?.some(point => point.value != null) ? "ready" : "blocked",
        observation_count: unemployment?.values?.filter(point => point.value != null).length ?? 0,
        series_period: unemployment?.values?.length
          ? { from: unemployment.values[0].year, to: unemployment.values.at(-1).year }
          : null,
        latest_actual_year: unemployment?.latest_actual_year ?? null,
        gaps: unemployment?.latest_actual_year < 2024 ? ["latest_actual_pre_2024"] : [],
      },
      health: {
        status: moduleStatus(baseHealthGaps, Boolean(healthProfile)),
        profile_year: healthProfile?.year ?? null,
        profile_gaps: baseHealthGaps,
        performance_status: moduleStatus(performanceGaps, Boolean(performanceProfile)),
        performance_metric_count: performanceProfile
          ? Object.values(performanceProfile).reduce((sum, metrics) => sum + Object.keys(metrics).length, 0)
          : 0,
        performance_gaps: performanceGaps,
      },
    },
    optional_deferred: {
      municipalities: { required_for_readiness: false, source_status: country.modules.municipalities.status },
      public_entities: { required_for_readiness: false, source_status: country.modules.public_entities.status },
      providers: { required_for_readiness: false, source_status: country.modules.providers.status },
    },
    reusable_insights: [
      "revenue_mix_and_tax_timeline",
      "consolidated_revenue_expenditure_balance",
      "largest_spending_category_top_three_and_share_change",
      "population_working_age_over_80_and_dependency_change_2025_2045",
      "unemployment_level_and_twenty_year_trend",
      ...(performanceProfile ? ["health_spending_capacity_workforce_utilisation_and_outcomes"] : []),
    ],
  };
}

const manifest = {
  schema_version: "1.0.0",
  generated_at: parity.generated_at,
  purpose: "Readiness and precise data-gap audit for parallel Czech-style dashboards for the 17 full-profile countries.",
  completeness_policy: {
    required_modules: ["revenue", "spending", "demography", "unemployment", "health"],
    optional_deferred_modules: ["municipalities", "public_entities", "providers"],
    dashboard_scaffold_ready_definition: "All five required modules have enough data to render their core section.",
    czech_depth_status_definition: "ready means complete core health and health-performance fields; ready_with_gaps means only non-core health-performance fields are absent; blocked means at least one required core module is incomplete.",
    note: "Native institutional revenue layers and native budget classifications are reported as depth gaps, but do not block a harmonised dashboard scaffold.",
  },
  source_artifacts: [
    "data/country-parity.v1.json",
    "data/country-revenue.v1.json",
    "data/country-cash-in.v1.json",
    "data/country-spending-2025-2026.v1.json",
    "data/country-spending-comparison.v1.json",
    "data/country-functional-budgets.v1.json",
    "data/country-demography.v1.json",
    "data/country-health.v1.json",
    "data/country-health-performance.v1.json",
    "data/countries/{iso3-lower}/profile.v1.json",
  ],
  country_count: Object.keys(countries).length,
  countries,
};

const output = `${JSON.stringify(manifest, null, 2)}\n`;
const outputPath = dataPath("country-dashboard-readiness.v1.json");

if (process.argv.includes("--check")) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== output) {
    console.error("country-dashboard-readiness.v1.json is stale; run node scripts/build-country-dashboard-readiness.mjs");
    process.exit(1);
  }
} else {
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${path.relative(root, outputPath)} for ${manifest.country_count} countries.`);
}
