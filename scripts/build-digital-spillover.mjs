import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import readline from "node:readline";

const ROOT = new URL("../", import.meta.url);
const COUNTRY_CODES = ["CZE", "DEU", "FRA", "ITA", "ESP", "POL", "GBR", "USA", "CHN", "IND"];
const WDI_INDICATORS = new Set([
  "gross_saving",
  "research_development_spending",
  "gross_fixed_capital_formation",
]);

const sovereign = JSON.parse(await readFile(new URL("lib/data/sovereign-benchmark.v1.json", ROOT), "utf8"));
const countryMeta = new Map(sovereign.countries.map((country) => [country.country_code, country]));
const sovereignSeries = new Map(sovereign.series.map((country) => [country.country_code, country.metrics]));
const observations = new Map();

const input = createReadStream(new URL("data/economy/economic-observations.v1.csv.gz", ROOT)).pipe(createGunzip());
const lines = readline.createInterface({ input, crlfDelay: Infinity });
let isHeader = true;
for await (const line of lines) {
  if (isHeader) { isHeader = false; continue; }
  const columns = line.split(",");
  const code = columns[0];
  const indicator = columns[1];
  if (!COUNTRY_CODES.includes(code) || !WDI_INDICATORS.has(indicator)) continue;
  const candidate = {
    value: Number(columns[8]),
    period: columns[6],
    unit: columns[9],
    source_id: columns[13],
    source_url: columns[14],
    source_vintage: columns[15],
    retrieved_at: columns[16],
  };
  if (!Number.isFinite(candidate.value)) continue;
  const key = `${code}|${indicator}`;
  if (!observations.has(key) || candidate.period > observations.get(key).period) observations.set(key, candidate);
}

function actualGDP(code) {
  const values = sovereignSeries.get(code)?.nominal_gdp_usd_bn?.values || [];
  const row = values.find((value) => value.year === 2024 && value.status === "actual");
  if (!row) throw new Error(`${code}: missing 2024 actual nominal GDP in USD`);
  return { value: row.value, period: String(row.year), unit: "USD_bn", status: row.status };
}

function indicator(code, name) {
  const row = observations.get(`${code}|${name}`);
  if (!row) throw new Error(`${code}: missing ${name}`);
  return row;
}

const countries = COUNTRY_CODES.map((code) => {
  const meta = countryMeta.get(code);
  if (!meta) throw new Error(`${code}: missing country metadata`);
  return {
    code,
    iso2: meta.iso2,
    name_cs: meta.name_cs,
    name_en: meta.name_en,
    nominal_gdp_usd_bn: actualGDP(code),
    gross_saving_pct_gdp: indicator(code, "gross_saving"),
    research_development_pct_gdp: indicator(code, "research_development_spending"),
    gross_fixed_capital_formation_pct_gdp: indicator(code, "gross_fixed_capital_formation"),
  };
});

const payload = {
  schema_version: "1.0.0",
  dataset_id: "digital_value_capture_ten_country_scenario",
  generated_at: new Date().toISOString(),
  scope: {
    country_codes: COUNTRY_CODES,
    comparison_currency: "current USD billions",
    interpretation: "Scenario model. Digital-sector share, foreign-platform dominance and multiplier are assumptions, not observed country estimates.",
  },
  default_scenario: {
    digital_sector_share_pct: 12,
    foreign_platform_dominance_pct: 72,
    investment_multiplier: 1.5,
    policy_proxy_anchor_research_development_pct_gdp: 3,
  },
  model: {
    digital_output: "nominal_gdp_usd_bn * digital_sector_share",
    policy_proxy: "min(1, research_development_pct_gdp / 3)",
    leakage_intensity: "0.58 - policy_proxy * 0.18",
    leakage: "digital_output * foreign_platform_dominance * leakage_intensity",
    retained_value: "digital_output - leakage",
    effective_reinvestment_rate: "gross_saving_pct_gdp * (0.85 + policy_proxy * 0.35)",
    domestic_reinvestment: "retained_value * effective_reinvestment_rate",
    gdp_supported: "domestic_reinvestment * investment_multiplier",
    incremental_multiplier_effect: "domestic_reinvestment * (investment_multiplier - 1)",
  },
  sources: [
    {
      source_id: "imf_weo",
      label: "IMF World Economic Outlook, April 2026",
      url: sovereign.source.url,
      metric: "Nominal GDP in current USD",
      period: "2024 actual",
    },
    {
      source_id: "world_bank_wdi",
      label: "World Bank World Development Indicators",
      url: "https://data.worldbank.org/indicator",
      metrics: ["Gross saving", "Research and development expenditure", "Gross fixed capital formation"],
      note: "Latest available observation is retained separately for every country and metric.",
    },
  ],
  countries,
};

await writeFile(new URL("data/digital-spillover.v1.json", ROOT), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${countries.length} countries to data/digital-spillover.v1.json`);
