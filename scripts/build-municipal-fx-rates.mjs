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
      method: "IMF WEO nominal local GDP divided by USD GDP",
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

// Prefer the archived official annual series over GDP-implied euro rates.
const ecb = JSON.parse(await readFile(new URL("../data/fx-eur-annual.v1.json", import.meta.url), "utf8"));
const ecbYears=[];
for(const point of ecb.values||[]) {
  if(!(Number(point.usd_per_eur)>0)) continue;
  const year=Number(point.year), direct=rounded(1/Number(point.usd_per_eur));
  eurPerUsd[year]=direct;ecbYears.push(year);
  for(const entry of Object.values(rates)) if(entry.currency==="EUR") {
    entry.years[year]={local_per_usd:direct,status:"actual",method:"ECB annual average USD per EUR, inverted",source_url:ecb.source.url};
  }
}

const direct = JSON.parse(await readFile(new URL("../data/ecb-annual-exchange-rates.v1.json", import.meta.url), "utf8"));
const usdByYear = new Map(direct.observations.filter(row => row.currency === "USD").map(row => [row.year, row]));
for (const [year, usd] of usdByYear) {
  eurPerUsd[year] = rounded(1 / usd.value);
  if (!ecbYears.includes(year)) ecbYears.push(year);
  for (const entry of Object.values(rates)) if (entry.currency === "EUR") {
    entry.years[year] = {local_per_usd: eurPerUsd[year], status: "actual", method: "ECB annual average USD per EUR, inverted", source_url: direct.source.url};
  }
}
let directCount = 0;
for (const row of direct.observations) {
  const usd = usdByYear.get(row.year);
  if (!usd || !(row.value > 0) || !(usd.value > 0)) continue;
  for (const entry of Object.values(rates)) if (entry.currency === row.currency) {
    entry.years[row.year] = {local_per_usd: rounded(row.value / usd.value), status: "actual",
      method: "Ratio of ECB annual mean local per EUR to annual mean USD per EUR", observation_status: row.observation_status,
      source_url: direct.source.url};
    directCount++;
  }
}
const finalYears = [...new Set(Object.values(rates).flatMap(entry => Object.keys(entry.years).map(Number)))].sort((a,b)=>a-b);
const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  method: "ECB annual reference rates are preferred where available. Local per USD is the ratio of annual mean local per EUR and USD per EUR, not the mean of daily cross-rates. Uncovered currencies/years retain explicitly labeled GDP-implied rates.",
  direct_ecb_years: ecbYears.sort((a,b)=>a-b),
  sources: [direct.source, ecb.source, source.source],
  direct_ecb_country_years: directCount,
  fallback_policy: "Use the nearest available annual rate and disclose the rate year in the interface.",
  source: source.source,
  period: { start_year: finalYears[0], end_year: finalYears.at(-1), year_count: finalYears.length },
  eur_per_usd: eurPerUsd,
  rates,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ countries: Object.keys(rates).length, years: output.period, output: outputPath.pathname }));
