import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../lib/data/sovereign-benchmark.v1.json", import.meta.url);
const municipalitiesPath = new URL("../data/international-municipalities.v1.json", import.meta.url);
const outputPath = new URL("../data/municipal-fx-rates.v1.json", import.meta.url);
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const municipalities = JSON.parse(await readFile(municipalitiesPath, "utf8"));
const countries = new Map((source.countries || []).map((country) => [country.country_code, country]));
const municipalCurrencies = new Map((municipalities.countries || []).map((country) => [country.code, country.currency]));
const rounded = (value) => Number(Number(value).toPrecision(12));
const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const rates = {};
for (const series of source.series || []) {
  const country = countries.get(series.country_code);
  const currency = municipalCurrencies.get(series.country_code) || country?.currency_code;
  const local = new Map((series.metrics?.nominal_gdp_local_bn?.values || []).map((row) => [Number(row.year), row]));
  const usd = new Map((series.metrics?.nominal_gdp_usd_bn?.values || []).map((row) => [Number(row.year), row]));
  const years = {};
  for (const [year, localRow] of local) {
    const usdRow = usd.get(year);
    const localValue = Number(localRow?.value);
    const usdValue = Number(usdRow?.value);
    if (!(localValue > 0) || !(usdValue > 0)) continue;
    years[year] = {
      local_per_usd: rounded(localValue / usdValue),
      status: localRow.status === "actual" && usdRow.status === "actual" ? "actual" : "estimate",
    };
  }
  if (currency && Object.keys(years).length) rates[series.country_code] = { currency, years };
}

const allYears = [...new Set(Object.values(rates).flatMap((entry) => Object.keys(entry.years).map(Number)))].sort((a, b) => a - b);
const eurPerUsd = {};
for (const year of allYears) {
  const implied = Object.values(rates)
    .filter((entry) => entry.currency === "EUR")
    .map((entry) => Number(entry.years[year]?.local_per_usd));
  const rate = median(implied);
  if (rate) eurPerUsd[year] = rounded(rate);
}

const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  method: "Implied annual market exchange rate: nominal GDP in local currency divided by nominal GDP in USD. EUR cross-rates use the median implied EUR-per-USD rate across euro-area countries in the same dataset.",
  fallback_policy: "Use the nearest available annual rate and disclose the rate year in the interface.",
  source: source.source,
  period: { start_year: allYears[0], end_year: allYears.at(-1), year_count: allYears.length },
  eur_per_usd: eurPerUsd,
  rates,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ countries: Object.keys(rates).length, years: output.period, output: outputPath.pathname }));
