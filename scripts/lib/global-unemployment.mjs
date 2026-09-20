export const IMF_METRIC = "unemployment_pct";
export const WORLD_BANK_INDICATOR = "unemployment_rate_annual";
export const WORLD_BANK_SERIES = "SL.UEM.TOTL.ZS";

export function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else value += character;
  }
  values.push(value);
  return values;
}

const numericSeries = (values = []) => values
  .filter((point) => point.value != null && Number.isFinite(Number(point.value)))
  .map((point) => ({ year: Number(point.year), value: Number(point.value), observation_status: point.status || "" }))
  .sort((a, b) => a.year - b.year);

export function buildGlobalUnemployment({ sovereign, worldBankRows, generatedAt }) {
  const worldBankByCountry = new Map();
  for (const row of worldBankRows) {
    if (row.indicator_code !== WORLD_BANK_INDICATOR || row.source_series !== WORLD_BANK_SERIES) continue;
    const value = Number(row.value);
    const year = Number(row.period);
    if (!row.country_code || !Number.isFinite(value) || !Number.isInteger(year)) continue;
    const series = worldBankByCountry.get(row.country_code) || [];
    series.push({
      year,
      value,
      observation_status: row.observation_status || "",
      source_vintage: row.source_vintage || "",
      quality_flags: row.quality_flags || "",
    });
    worldBankByCountry.set(row.country_code, series);
  }
  for (const series of worldBankByCountry.values()) series.sort((a, b) => a.year - b.year);

  const countries = {};
  const counts = { imf_weo: 0, world_bank_fallback: 0, unavailable: 0 };
  for (const country of sovereign.countries) {
    const code = country.country_code;
    const sovereignSeries = sovereign.series.find((entry) => entry.country_code === code);
    const imf = numericSeries(sovereignSeries?.metrics?.[IMF_METRIC]?.values);
    const worldBank = worldBankByCountry.get(code) || [];
    let source = null;
    let series = [];
    if (imf.length) {
      source = "imf_weo";
      series = imf;
      counts.imf_weo += 1;
    } else if (worldBank.length) {
      source = "world_bank_wdi";
      series = worldBank;
      counts.world_bank_fallback += 1;
    } else counts.unavailable += 1;
    countries[code] = {
      status: series.length ? "loaded" : "unavailable",
      preferred_source: source,
      fallback_used: source === "world_bank_wdi",
      latest: series.at(-1) || null,
      period: series.length ? { from: series[0].year, to: series.at(-1).year } : null,
      observation_count: series.length,
      series,
    };
  }
  const codes = sovereign.countries.map((country) => country.country_code);
  const missing = codes.filter((code) => countries[code].status !== "loaded");
  return {
    schema_version: "1.0.0",
    contract: "global-unemployment.v1",
    generated_at: generatedAt,
    country_count: codes.length,
    metric: { id: "unemployment_pct", unit: "percent_of_total_labour_force", selection_rule: "Use the IMF WEO LUR series whenever the country has any numeric IMF observation; use World Bank SL.UEM.TOTL.ZS only when the IMF country series is empty." },
    sources: [
      { id: "imf_weo", publisher: sovereign.source.provider, dataset: sovereign.source.dataset, metric: "LUR", url: sovereign.source.download_page || sovereign.source.url },
      { id: "world_bank_wdi", publisher: "World Bank", dataset: "World Development Indicators", metric: WORLD_BANK_SERIES, url: `https://data.worldbank.org/indicator/${WORLD_BANK_SERIES}` },
    ],
    coverage: { loaded_count: codes.length - missing.length, missing_count: missing.length, source_counts: counts, missing_countries: missing },
    countries,
  };
}
