#!/usr/bin/env node
// Slims lib/data/sovereign-benchmark.v1.json (7.8 MB) down to the slice the homepage,
// the comparison page and the Czech budget page actually read, so first paint no longer
// waits on the full twenty-year, fifteen-metric payload.
//
// Kept: countries (full metadata — the architecture table reads most of it), metrics,
// summaries, period, and series limited to the ten metrics those pages plot.
// Dropped: five unused metrics, the per-observation "status" flag, national_source_registry,
// universe, fiscal_perimeters and benchmark_policy — all country-profile material.
//
// The full file stays authoritative: country.js still loads it because a profile needs the
// complete series, and every server-side build step keeps reading the original.
//
//   lib/data/sovereign-benchmark.v1.json  ->  data/sovereign-benchmark-slim.v1.json

import { readFile, writeFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = "lib/data/sovereign-benchmark.v1.json";
const target = "data/sovereign-benchmark-slim.v1.json";
// homepage-v2.js `keys` plus the two per-capita series the macro rows convert.
const metricKeys = ["expenditure_pct_gdp", "revenue_pct_gdp", "balance_pct_gdp", "primary_balance_pct_gdp", "gross_debt_pct_gdp", "real_gdp_growth_pct", "unemployment_pct", "inflation_pct", "nominal_gdp_usd_bn", "gdp_per_capita_usd", "gdp_per_capita_ppp"];

const data = JSON.parse(await readFile(new URL(source, root), "utf8"));
const slim = {
  schema_version: data.schema_version,
  dataset_id: `${data.dataset_id}-slim`,
  generated_at: data.generated_at,
  source_artifact: source,
  slice: { metrics: metricKeys, note: "First-paint slice. The complete series, per-observation status flags and the national source registry live in the source artifact." },
  period: data.period,
  scope: data.scope,
  source: data.source,
  countries: data.countries,
  metrics: data.metrics.filter((metric) => metricKeys.includes(metric.metric_code)),
  series: data.series.map((entry) => ({
    country_code: entry.country_code,
    metrics: Object.fromEntries(metricKeys.filter((key) => entry.metrics[key]).map((key) => [key, { latest_actual_year: entry.metrics[key].latest_actual_year, values: entry.metrics[key].values.map((point) => ({ year: point.year, value: point.value })) }]))
  })),
  summaries: data.summaries
};

const text = JSON.stringify(slim);
await writeFile(new URL(target, root), text);
const before = (await stat(new URL(source, root))).size, after = Buffer.byteLength(text);
console.log(`${source} ${(before / 1048576).toFixed(2)} MB -> ${target} ${(after / 1048576).toFixed(2)} MB (${Math.round((1 - after / before) * 100)} % smaller)`);
console.log(`countries ${slim.countries.length} · metrics ${slim.metrics.length}/${data.metrics.length} · series ${slim.series.length} · summaries ${slim.summaries.length}`);
