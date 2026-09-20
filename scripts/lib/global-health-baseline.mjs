export const WDI_BASE = "https://api.worldbank.org/v2";

export const HEALTH_INDICATORS = Object.freeze({
  health_gdp_pct: { source_code: "SH.XPD.CHEX.GD.ZS", group: "financing", unit: "percent_of_gdp", custodian: "WHO GHED" },
  per_capita_ppp: { source_code: "SH.XPD.CHEX.PP.CD", group: "financing", unit: "international_dollars_per_person", custodian: "WHO GHED" },
  government_share_pct: { source_code: "SH.XPD.GHED.CH.ZS", group: "financing", unit: "percent_of_current_health_expenditure", custodian: "WHO GHED" },
  out_of_pocket_pct: { source_code: "SH.XPD.OOPC.CH.ZS", group: "financing", unit: "percent_of_current_health_expenditure", custodian: "WHO GHED" },
  beds_per_1000: { source_code: "SH.MED.BEDS.ZS", group: "capacity", unit: "per_1000_people", custodian: "WHO and national statistical systems" },
  physicians_per_1000: { source_code: "SH.MED.PHYS.ZS", group: "workforce", unit: "per_1000_people", custodian: "WHO and national statistical systems" },
  nurses_per_1000: { source_code: "SH.MED.NUMW.P3", group: "workforce", unit: "per_1000_people", custodian: "WHO and national statistical systems" },
  life_expectancy_years: { source_code: "SP.DYN.LE00.IN", group: "outcomes", unit: "years", custodian: "UN Population Division" },
  premature_ncd_mortality_pct: { source_code: "SH.DYN.NCOM.ZS", group: "outcomes", unit: "percent", custodian: "WHO" },
  suicide_rate_per_100k: { source_code: "SH.STA.SUIC.P5", group: "outcomes", unit: "per_100000_people", custodian: "WHO" },
  under5_mortality_per_1000: { source_code: "SH.DYN.MORT", group: "outcomes", unit: "per_1000_live_births", custodian: "UN IGME" },
});

const numeric = (value) => value === null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

export function sourceUrl(sourceCode, startYear, endYear, page = 1) {
  const query = new URLSearchParams({ format: "json", per_page: "20000", date: `${startYear}:${endYear}`, page: String(page) });
  return `${WDI_BASE}/country/all/indicator/${sourceCode}?${query}`;
}

export function normalizeEnvelope(payload, sourceCode) {
  if (payload && Array.isArray(payload.records)) return payload;
  if (Array.isArray(payload) && Array.isArray(payload[1])) {
    return { source_code: sourceCode, pages: 1, records: payload[1] };
  }
  throw new Error(`Invalid World Bank payload for ${sourceCode}`);
}

export function buildGlobalHealth({ registry, payloads, generatedAt, startYear, endYear }) {
  const codes = registry.countries.map((country) => country.iso3);
  if (new Set(codes).size !== codes.length) throw new Error("Duplicate ISO3 code in sovereign registry");
  const allowed = new Set(codes);
  const byMetric = {};

  for (const [metric, definition] of Object.entries(HEALTH_INDICATORS)) {
    const envelope = normalizeEnvelope(payloads[definition.source_code], definition.source_code);
    const countrySeries = new Map(codes.map((code) => [code, []]));
    for (const record of envelope.records) {
      const code = record.countryiso3code;
      const value = numeric(record.value);
      const year = Number(record.date);
      if (!allowed.has(code) || value === null || !Number.isInteger(year) || year < startYear || year > endYear) continue;
      countrySeries.get(code).push({ year, value });
    }
    for (const series of countrySeries.values()) series.sort((a, b) => a.year - b.year || a.value - b.value);
    byMetric[metric] = countrySeries;
  }

  const countries = {};
  for (const code of codes) {
    const groups = { financing: {}, workforce: {}, capacity: {}, outcomes: {} };
    const available = [];
    const missing = [];
    for (const [metric, definition] of Object.entries(HEALTH_INDICATORS)) {
      const series = byMetric[metric].get(code);
      const observation = series.length ? { ...series.at(-1), series } : null;
      groups[definition.group][metric] = observation;
      (observation ? available : missing).push(metric);
    }
    countries[code] = {
      status: available.length ? "loaded" : "not_loaded",
      available_metrics: available,
      missing_metrics: missing,
      ...groups,
    };
  }

  const metrics = Object.fromEntries(Object.entries(HEALTH_INDICATORS).map(([metric, definition]) => {
    const loaded = codes.filter((code) => countries[code].available_metrics.includes(metric));
    return [metric, { ...definition, loaded_count: loaded.length, missing_count: codes.length - loaded.length, missing_countries: codes.filter((code) => !loaded.includes(code)) }];
  }));
  const anyLoaded = codes.filter((code) => countries[code].status === "loaded");
  const financingMetrics = Object.entries(HEALTH_INDICATORS).filter(([, value]) => value.group === "financing").map(([key]) => key);
  const financingComplete = codes.filter((code) => financingMetrics.every((metric) => countries[code].available_metrics.includes(metric)));

  const artifact = {
    schema_version: "1.0.0",
    contract: "global-health-baseline.v1",
    generated_at: generatedAt,
    period: { from: startYear, to: endYear },
    country_count: codes.length,
    methodology: "Latest available observation per metric is published with its year and full retained series. Missing observations remain null; no interpolation or zero filling is applied.",
    sources: [{ id: "world-bank-wdi", publisher: "World Bank", dataset: "World Development Indicators", api: `${WDI_BASE}/indicator`, upstream_custodians: ["WHO Global Health Expenditure Database", "WHO", "UN Population Division", "UN IGME"] }],
    indicators: HEALTH_INDICATORS,
    countries,
  };
  const coverage = {
    schema_version: "1.0.0",
    contract: "global-health-coverage.v1",
    generated_at: generatedAt,
    country_count: codes.length,
    countries_with_any_metric: anyLoaded.length,
    countries_without_any_metric: codes.filter((code) => !anyLoaded.includes(code)),
    countries_with_complete_financing: financingComplete.length,
    countries_missing_complete_financing: codes.filter((code) => !financingComplete.includes(code)),
    metrics,
  };
  return { artifact, coverage };
}
