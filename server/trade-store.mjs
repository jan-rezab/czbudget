import { TRADE_EXPLORER_SQL, tradeExplorerDataset } from './trade-explorer.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import { shareInFlight } from "./in-flight.mjs";
import { decodeRows, metadataToken, parameter, requestJSON } from "./france-municipal-lines.mjs";

const DEFAULT_PROJECT = "czbudget-janrezab";
const DEFAULT_LOCATION = "EU";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_TRADE_DATE = "2000-01-01";
const ENERGY_MIN_DATE = "2019-01-01";

export const ENERGY_PRODUCTS = Object.freeze({
  petroleum: { code: "270900", name: "Crude petroleum" },
  lng: { code: "271111", name: "Liquefied natural gas" },
  gas: { code: "271121", name: "Natural gas in gaseous state" },
});

export const TRADE_COUNTRIES_SQL = `
WITH latest AS (
  SELECT reporter_iso3, product_type, frequency, crawl_status, loaded_row_count,
    period, source_last_released, assessed_at
  FROM \`czbudget-janrezab.budget_detail.trade_dataset_coverage\`
  WHERE period_start >= DATE '2020-01-01'
    AND reporter_iso3 IS NOT NULL
    AND product_type = 'C'
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY reporter_iso3, frequency
    ORDER BY period_start DESC, assessed_at DESC
  ) = 1
)
SELECT
  latest.reporter_iso3,
  ARRAY_AGG(areas.name IGNORE NULLS ORDER BY (areas.effective_to IS NULL) DESC, LENGTH(areas.name), areas.name LIMIT 1)[SAFE_OFFSET(0)] AS reporter_name,
  MAX(IF(frequency = 'A' AND loaded_row_count > 0, period, NULL)) AS latest_annual_period,
  MAX(IF(frequency = 'M' AND loaded_row_count > 0, period, NULL)) AS latest_monthly_period,
  LOGICAL_OR(loaded_row_count > 0) AS has_loaded_data,
  MAX(source_last_released) AS source_last_released
FROM latest
LEFT JOIN \`czbudget-janrezab.budget_detail.trade_areas\` AS areas
  ON areas.iso3 = latest.reporter_iso3 AND areas.is_reporter
GROUP BY latest.reporter_iso3
HAVING has_loaded_data
ORDER BY reporter_name, reporter_iso3
`;

export const TRADE_PROFILE_SQL = `
WITH scoped AS (
  SELECT period_start, period, ref_year, ref_month, frequency, reporter_iso3,
    reporter_name, flow_code, partner_area_code, partner_iso3, partner_name,
    product_code, product_name, aggregation_level, primary_value_usd,
    source_last_released, retrieved_at
  FROM \`czbudget-janrezab.budget_detail.trade_observations\`
  WHERE period_start BETWEEN @min_date AND CURRENT_DATE()
    AND reporter_iso3 = @reporter_iso3
    AND product_type = 'C'
    AND classification_code IN ('H6', 'HS')
    AND flow_code IN ('M', 'X')
    AND (customs_code IS NULL OR customs_code = 'C00')
    AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
    AND (partner2_area_code IS NULL OR partner2_area_code = 0)
),
total_candidates AS (
  SELECT scoped.*, IF(partner_area_code = 0, 0, 1) AS source_priority
  FROM scoped
  WHERE aggregation_level BETWEEN 2 AND 6
    AND (
      partner_area_code = 0
      OR partner_area_code IN (
        SELECT DISTINCT area_code
        FROM \`czbudget-janrezab.budget_detail.trade_areas\`
        WHERE is_partner AND NOT is_group
      )
    )
  QUALIFY source_priority = MIN(source_priority) OVER (
    PARTITION BY period, frequency, flow_code
  )
),
totals_at_finest_grain AS (
  SELECT * EXCEPT(source_priority)
  FROM total_candidates
  QUALIFY aggregation_level = MAX(aggregation_level) OVER (
    PARTITION BY period, frequency, flow_code
  )
),
totals AS (
  SELECT 'total' AS row_kind, period_start, period, ref_year, ref_month, frequency,
    flow_code, CAST(NULL AS INT64) AS partner_area_code,
    CAST(NULL AS STRING) AS partner_iso3, CAST(NULL AS STRING) AS partner_name,
    CAST(NULL AS STRING) AS product_code, CAST(NULL AS STRING) AS product_name,
    SUM(primary_value_usd) AS value_usd,
    MAX(source_last_released) AS source_last_released,
    MAX(retrieved_at) AS retrieved_at
  FROM totals_at_finest_grain
  GROUP BY period_start, period, ref_year, ref_month, frequency, flow_code
),
latest_annual AS (
  SELECT MAX(ref_year) AS ref_year FROM totals WHERE frequency = 'A'
),
partner_rows AS (
  SELECT 'partner' AS row_kind, MIN(period_start) AS period_start, ANY_VALUE(period) AS period,
    ref_year, CAST(NULL AS INT64) AS ref_month, 'A' AS frequency, flow_code,
    partner_area_code, ANY_VALUE(partner_iso3) AS partner_iso3,
    ANY_VALUE(partner_name) AS partner_name,
    CAST(NULL AS STRING) AS product_code, CAST(NULL AS STRING) AS product_name,
    SUM(primary_value_usd) AS value_usd,
    MAX(source_last_released) AS source_last_released,
    MAX(retrieved_at) AS retrieved_at
  FROM scoped
  WHERE frequency = 'A'
    AND ref_year = (SELECT ref_year FROM latest_annual)
    AND partner_area_code != 0
    AND aggregation_level = 6
  GROUP BY ref_year, flow_code, partner_area_code
  QUALIFY DENSE_RANK() OVER (PARTITION BY flow_code ORDER BY value_usd DESC) <= 20
),
product_at_finest_grain AS (
  SELECT *
  FROM scoped
  WHERE frequency = 'A'
    AND ref_year = (SELECT ref_year FROM latest_annual)
    AND partner_area_code = 0
    AND aggregation_level BETWEEN 2 AND 6
  QUALIFY aggregation_level = MAX(aggregation_level) OVER (PARTITION BY flow_code)
),
product_aggregates AS (
  SELECT MIN(period_start) AS period_start, ANY_VALUE(period) AS period,
    ref_year, CAST(NULL AS INT64) AS ref_month, 'A' AS frequency, flow_code,
    CAST(NULL AS INT64) AS partner_area_code, CAST(NULL AS STRING) AS partner_iso3,
    CAST(NULL AS STRING) AS partner_name, SUBSTR(product_code, 1, 2) AS product_code,
    SUM(primary_value_usd) AS value_usd,
    MAX(source_last_released) AS source_last_released,
    MAX(retrieved_at) AS retrieved_at
  FROM product_at_finest_grain
  GROUP BY ref_year, flow_code, product_code
),
product_names AS (
  SELECT product_code, ANY_VALUE(product_name) AS product_name
  FROM \`czbudget-janrezab.budget_detail.trade_products\`
  WHERE product_type = 'C' AND aggregation_level = 2
  GROUP BY product_code
),
product_rows AS (
  SELECT 'product' AS row_kind, product_aggregates.* EXCEPT(value_usd, source_last_released, retrieved_at),
    product_names.product_name, value_usd, source_last_released, retrieved_at
  FROM product_aggregates
  LEFT JOIN product_names USING (product_code)
)
SELECT * FROM totals
UNION ALL SELECT * FROM partner_rows
UNION ALL SELECT * FROM product_rows
ORDER BY row_kind, period_start, flow_code, value_usd DESC
`;

// Both windows run over the same scope. Including ref_year in the grain window
// preserves the latest-year result without a separate MAX(year) subquery scan.
export const TRADE_PRODUCT_PARTNERS_SQL = `
WITH scoped AS (
  SELECT period_start, ref_year, flow_code, partner_area_code, partner_iso3,
    partner_name, product_code, aggregation_level, primary_value_usd,
    source_last_released, retrieved_at
  FROM \`czbudget-janrezab.budget_detail.trade_observations\`
  WHERE period_start BETWEEN @min_date AND CURRENT_DATE()
    AND reporter_iso3 = @reporter_iso3
    AND product_type = 'C'
    AND classification_code IN ('H6', 'HS')
    AND frequency = 'A'
    AND flow_code IN ('M', 'X')
    AND STARTS_WITH(product_code, @product_code)
    AND partner_area_code != 0
    AND (customs_code IS NULL OR customs_code = 'C00')
    AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
    AND (partner2_area_code IS NULL OR partner2_area_code = 0)
    AND partner_area_code IN (
      SELECT DISTINCT area_code
      FROM \`czbudget-janrezab.budget_detail.trade_areas\`
      WHERE is_partner AND NOT is_group
    )
),
finest AS (
  SELECT scoped.*
  FROM scoped
  QUALIFY ref_year = MAX(ref_year) OVER ()
    AND aggregation_level = MAX(aggregation_level) OVER (
    PARTITION BY ref_year, flow_code, partner_area_code
  )
),
partners AS (
  SELECT ref_year, flow_code, partner_area_code,
    ANY_VALUE(partner_iso3) AS partner_iso3,
    ANY_VALUE(partner_name) AS partner_name,
    SUM(primary_value_usd) AS value_usd,
    MAX(source_last_released) AS source_last_released,
    MAX(retrieved_at) AS retrieved_at
  FROM finest
  GROUP BY ref_year, flow_code, partner_area_code
)
SELECT *
FROM partners
QUALIFY DENSE_RANK() OVER (PARTITION BY flow_code ORDER BY value_usd DESC) <= 20
ORDER BY flow_code, value_usd DESC
`;

export const ENERGY_PERIODS_SQL = `
SELECT
  product_code,
  frequency,
  period,
  MIN(period_start) AS period_start,
  COUNT(DISTINCT reporter_area_code) AS reporting_markets,
  COUNT(DISTINCT partner_area_code) AS reported_origins,
  SUM(primary_value_usd) AS observed_value_usd,
  SUM(net_weight_kg) AS observed_net_weight_kg,
  MAX(source_last_released) AS source_last_released,
  MAX(retrieved_at) AS retrieved_at
FROM \`czbudget-janrezab.budget_detail.trade_observations\` AS observation
WHERE period_start BETWEEN @min_date AND CURRENT_DATE()
  AND product_type = 'C'
  AND product_code IN ('270900', '271111', '271121')
  AND flow_code = 'M'
  AND partner_area_code != 0
  AND is_original_classification
  AND reporter_iso3 IS NOT NULL
  AND partner_iso3 IS NOT NULL
  AND (customs_code IS NULL OR customs_code = 'C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
  AND (partner2_area_code IS NULL OR partner2_area_code = 0)
  AND reporter_area_code IN (
    SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\`
    WHERE is_reporter AND NOT is_group
  )
  AND partner_area_code IN (
    SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\`
    WHERE is_partner AND NOT is_group
  )
GROUP BY product_code, frequency, period
ORDER BY product_code, frequency, period
`;

export const ENERGY_FLOWS_SQL = `
WITH scoped AS (
  SELECT
    observation.period,
    observation.frequency,
    observation.partner_area_code,
    observation.partner_iso3 AS origin_iso3,
    observation.partner_name AS origin_name,
    observation.reporter_area_code,
    observation.reporter_iso3 AS market_iso3,
    observation.reporter_name AS market_name,
    observation.primary_value_usd,
    observation.net_weight_kg,
    observation.net_weight_is_estimated,
    observation.source_last_released,
    observation.retrieved_at
  FROM \`czbudget-janrezab.budget_detail.trade_observations\` AS observation
  WHERE observation.period_start = @period_start
    AND observation.frequency = @frequency
    AND observation.period = @period
    AND observation.product_type = 'C'
    AND observation.product_code = @product_code
    AND observation.flow_code = 'M'
    AND observation.partner_area_code != 0
    AND observation.is_original_classification
    AND observation.reporter_iso3 IS NOT NULL
    AND observation.partner_iso3 IS NOT NULL
    AND (observation.customs_code IS NULL OR observation.customs_code = 'C00')
    AND (observation.mode_of_transport_code IS NULL OR observation.mode_of_transport_code = 0)
    AND (observation.partner2_area_code IS NULL OR observation.partner2_area_code = 0)
    AND observation.reporter_area_code IN (
      SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\`
      WHERE is_reporter AND NOT is_group
    )
    AND observation.partner_area_code IN (
      SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\`
      WHERE is_partner AND NOT is_group
    )
), areas AS (
  SELECT area_code,
    ARRAY_AGG(STRUCT(iso2, name) ORDER BY (effective_to IS NULL) DESC, LENGTH(name), name LIMIT 1)[OFFSET(0)] AS area
  FROM \`czbudget-janrezab.budget_detail.trade_areas\`
  WHERE NOT is_group
  GROUP BY area_code
)
SELECT
  ANY_VALUE(scoped.period) AS period,
  ANY_VALUE(scoped.frequency) AS frequency,
  scoped.origin_iso3,
  ANY_VALUE(origin.area.iso2) AS origin_iso2,
  ANY_VALUE(scoped.origin_name) AS origin_name,
  scoped.market_iso3,
  ANY_VALUE(market.area.iso2) AS market_iso2,
  ANY_VALUE(scoped.market_name) AS market_name,
  SUM(scoped.primary_value_usd) AS value_usd,
  SUM(scoped.net_weight_kg) AS net_weight_kg,
  LOGICAL_OR(COALESCE(scoped.net_weight_is_estimated, FALSE)) AS net_weight_is_estimated,
  MAX(scoped.source_last_released) AS source_last_released,
  MAX(scoped.retrieved_at) AS retrieved_at
FROM scoped
LEFT JOIN areas AS origin ON origin.area_code = scoped.partner_area_code
LEFT JOIN areas AS market ON market.area_code = scoped.reporter_area_code
GROUP BY scoped.origin_iso3, scoped.market_iso3
HAVING value_usd > 0
ORDER BY value_usd DESC, origin_iso3, market_iso3
`;

export class TradeError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class TradeStore {
  constructor({
    fetchImpl = globalThis.fetch,
    tokenProvider = null,
    project = process.env.BQ_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT,
    location = process.env.BQ_LOCATION || DEFAULT_LOCATION,
    now = () => Date.now(),
    seedPath = path.join(path.resolve(process.env.SITE_ROOT || "/usr/share/nginx/html"), "data/trade/annual-hs2-2024.v1.json"),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.tokenProvider = tokenProvider || (() => metadataToken(this.fetchImpl));
    this.project = project;
    this.location = location;
    this.now = now;
    this.seedPath = seedPath;
    this.cache = new Map();
    this.pending = new Map();
  }

  async explorer(value) {
    const countries = [...new Set(String(value || 'CZE,DEU,GBR,USA').split(',').map(normalizeCountryCode))];
    if (!countries.length || countries.length > 4) throw new TradeError(400, 'invalid_trade_countries', 'Select one to four countries.');
    const endYear = new Date(this.now()).getUTCFullYear() - 1;
    const cacheKey = `explorer:${countries.join(',')}:${endYear}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, cacheKey, async () => {
      const params = countries.map((code, index) => parameter(`country${index}`, 'STRING', code));
      while (params.length < 4) params.push(parameter(`country${params.length}`, 'STRING', countries[0]));
      params.push(parameter('end_date', 'DATE', `${endYear}-12-31`));
      const rows = await this.query(TRADE_EXPLORER_SQL, params);
      if (!rows.length) throw new TradeError(404, 'trade_history_not_found', 'No loaded annual history is available for this comparison.');
      const result = tradeExplorerDataset(rows, countries, endYear);
      this.put(cacheKey, result);
      return result;
    });
  }

  async countries() {
    const cached = this.cache.get("countries");
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, "countries", () => this.loadCountries());
  }

  async loadCountries() {
    const rows = await this.query(TRADE_COUNTRIES_SQL, []);
    const value = {
      schema_version: "1.0.0",
      countries: rows.map((row) => ({
        code: row.reporter_iso3,
        name: row.reporter_name || row.reporter_iso3,
        latest_annual_period: row.latest_annual_period || null,
        latest_monthly_period: row.latest_monthly_period || null,
        source_last_released: row.source_last_released || null,
      })),
    };
    this.put("countries", value);
    return value;
  }

  async profile(countryCode) {
    const code = normalizeCountryCode(countryCode);
    const cached = this.cache.get(code);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, code, () => this.loadProfile(code));
  }

  async loadProfile(code) {
    const rows = await this.query(TRADE_PROFILE_SQL, [
      parameter("reporter_iso3", "STRING", code),
      parameter("min_date", "DATE", MIN_TRADE_DATE),
    ]);
    const number = (value) => value === null ? null : Number(value);
    const normalize = (row) => ({
      period: row.period,
      period_start: row.period_start,
      year: number(row.ref_year),
      month: number(row.ref_month),
      frequency: row.frequency,
      flow: row.flow_code === "X" ? "export" : "import",
      value_usd: number(row.value_usd),
      source_last_released: row.source_last_released || null,
      retrieved_at: row.retrieved_at || null,
    });
    const totals = rows.filter((row) => row.row_kind === "total").map(normalize);
    try {
      const seed = JSON.parse(await fs.readFile(this.seedPath, "utf8"));
      const country = seed.countries?.find((item) => item.country_code === code && item.status === "loaded");
      const seedYear = Number(seed.period?.year ?? seed.period);
      for (const [key, flow] of [["imports", "import"], ["exports", "export"]]) {
        const value = Number(country?.flows?.[key]?.total_value_usd);
        if (Number.isFinite(seedYear) && Number.isFinite(value) && !totals.some((row) => row.frequency === "A" && row.year === seedYear && row.flow === flow)) {
          totals.push({ period: String(seedYear), period_start: `${seedYear}-01-01`, year: seedYear, month: 52, frequency: "A", flow, value_usd: value, source_last_released: null, retrieved_at: seed.generated_at || null });
        }
      }
      totals.sort((a, b) => String(a.period).localeCompare(String(b.period)) || a.flow.localeCompare(b.flow));
    } catch {
      // The seed is an optional earlier public snapshot. Live BigQuery rows remain authoritative.
    }
    if (!totals.length) throw new TradeError(404, "trade_country_not_found", "No loaded UN Comtrade observations are available for this country.");
    const rankings = (kind) => rows.filter((row) => row.row_kind === kind).map((row) => ({
      ...normalize(row),
      ...(kind === "partner" ? {
        code: row.partner_iso3 || String(row.partner_area_code),
        name: row.partner_name || row.partner_iso3 || String(row.partner_area_code),
      } : {
        code: row.product_code,
        name: row.product_name || `HS ${row.product_code}`,
      }),
    }));
    const value = {
      schema_version: "1.0.0",
      country: code,
      currency: "USD",
      valuation: { imports: "CIF", exports: "FOB" },
      totals,
      partners: rankings("partner"),
      products: rankings("product"),
      source: {
        title: "United Nations Comtrade Database",
        url: "https://comtrade.un.org/",
        table: "budget_detail.trade_observations + data/trade/annual-hs2-2024.v1.json",
        retrieved_at: totals.map((row) => row.retrieved_at).filter(Boolean).sort().at(-1) || null,
      },
      note: "Imports are generally valued CIF and exports FOB. Missing periods are omitted, never rendered as zero.",
    };
    this.put(code, value);
    return value;
  }

  async productPartners(countryCode, productCode) {
    const code = normalizeCountryCode(countryCode);
    const product = normalizeProductCode(productCode);
    const cacheKey = `product-partners:${code}:${product}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, cacheKey, () => this.loadProductPartners(code, product, cacheKey));
  }

  async loadProductPartners(code, product, cacheKey) {
    const rows = await this.query(TRADE_PRODUCT_PARTNERS_SQL, [
      parameter("reporter_iso3", "STRING", code),
      parameter("product_code", "STRING", product),
      parameter("min_date", "DATE", MIN_TRADE_DATE),
    ]);
    if (!rows.length) throw new TradeError(404, "trade_product_not_found", "No partner observations are available for this product chapter.");
    const value = {
      schema_version: "1.0.0",
      country: code,
      product_code: product,
      year: Number(rows[0].ref_year),
      partners: rows.map((row) => ({
        year: Number(row.ref_year),
        flow: row.flow_code === "X" ? "export" : "import",
        code: row.partner_iso3 || String(row.partner_area_code),
        name: row.partner_name || row.partner_iso3 || String(row.partner_area_code),
        value_usd: Number(row.value_usd),
        source_last_released: row.source_last_released || null,
        retrieved_at: row.retrieved_at || null,
      })),
    };
    this.put(cacheKey, value);
    return value;
  }

  async energyPeriods() {
    const cacheKey = "energy-periods";
    const cached = this.cache.get(cacheKey);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, cacheKey, async () => {
      // Global history spans all markets and seven annual partitions. Its
      // measured scan is 23 GB; country and single-period queries retain 5 GB.
      const rows = await this.query(ENERGY_PERIODS_SQL, [parameter("min_date", "DATE", ENERGY_MIN_DATE)], {
        maximumBytesBilled: "32000000000",
      });
      const products = Object.entries(ENERGY_PRODUCTS).map(([id, product]) => ({
        id,
        ...product,
        periods: rows.filter((row) => row.product_code === product.code).map((row) => ({
          frequency: row.frequency,
          period: row.period,
          period_start: row.period_start,
          reporting_markets: Number(row.reporting_markets),
          reported_origins: Number(row.reported_origins),
          observed_value_usd: Number(row.observed_value_usd),
          observed_net_weight_kg: row.observed_net_weight_kg === null ? null : Number(row.observed_net_weight_kg),
          source_last_released: row.source_last_released || null,
          retrieved_at: row.retrieved_at || null,
        })),
      }));
      const value = {
        schema_version: "energy-trade-periods.v1",
        products,
        source: { title: "United Nations Comtrade Database", url: "https://comtrade.un.org/", table: "budget_detail.trade_observations" },
        note: "Importer-reported bilateral trade at the original reported HS classification. Groups and World totals are excluded.",
      };
      this.put(cacheKey, value);
      return value;
    });
  }

  async energyFlows(productValue, frequencyValue, periodValue) {
    const { id, code, name } = normalizeEnergyProduct(productValue);
    const frequency = normalizeEnergyFrequency(frequencyValue);
    const period = normalizeEnergyPeriod(periodValue, frequency);
    const periodStart = frequency === "A" ? `${period}-01-01` : `${period.slice(0, 4)}-${period.slice(4)}-01`;
    const cacheKey = `energy-flows:${id}:${frequency}:${period}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, cacheKey, async () => {
      const rows = await this.query(ENERGY_FLOWS_SQL, [
        parameter("period_start", "DATE", periodStart),
        parameter("frequency", "STRING", frequency),
        parameter("period", "STRING", period),
        parameter("product_code", "STRING", code),
      ], { maxResults: "5000" });
      if (!rows.length) throw new TradeError(404, "energy_trade_not_found", "No loaded importer-reported routes are available for this product and period.");
      const routes = rows.map((row) => ({
        origin: { code: row.origin_iso3, iso2: row.origin_iso2, name: row.origin_name || row.origin_iso3 },
        market: { code: row.market_iso3, iso2: row.market_iso2, name: row.market_name || row.market_iso3 },
        value_usd: Number(row.value_usd),
        net_weight_kg: row.net_weight_kg === null ? null : Number(row.net_weight_kg),
        net_weight_is_estimated: row.net_weight_is_estimated === "true" || row.net_weight_is_estimated === true,
      }));
      const value = {
        schema_version: "energy-trade-flows.v1",
        product: { id, code, name },
        frequency,
        period,
        reporting_basis: "IMPORTER_REPORTED_ORIGIN",
        valuation: "Primary trade value; imports are generally CIF",
        routes,
        totals: {
          observed_value_usd: routes.reduce((sum, row) => sum + row.value_usd, 0),
          reporting_markets: new Set(routes.map((row) => row.market.code)).size,
          reported_origins: new Set(routes.map((row) => row.origin.code)).size,
        },
        source: {
          title: "United Nations Comtrade Database",
          url: "https://comtrade.un.org/",
          table: "budget_detail.trade_observations",
          retrieved_at: rows.map((row) => row.retrieved_at).filter(Boolean).sort().at(-1) || null,
          source_last_released: rows.map((row) => row.source_last_released).filter(Boolean).sort().at(-1) || null,
        },
        note: "Routes run from the origin reported by the importing market to that market. They are customs trade, not physical pipeline or shipping paths.",
      };
      this.put(cacheKey, value);
      return value;
    });
  }

  put(key, value) {
    this.cache.set(key, { value, expiresAt: this.now() + CACHE_TTL_MS });
    while (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value);
  }

  async query(sql, queryParameters, { maxResults = "1000", maximumBytesBilled = "5000000000" } = {}) {
    const token = await this.tokenProvider();
    const endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(this.project)}/queries`;
    const body = {
      query: sql,
      useLegacySql: false,
      location: this.location,
      timeoutMs: 8_000,
      maxResults,
      maximumBytesBilled,
      parameterMode: "NAMED",
      queryParameters,
    };
    let payload;
    try {
      payload = await requestJSON(this.fetchImpl, endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!payload.jobComplete) {
        const job = payload.jobReference;
        if (!job?.jobId) throw new TradeError(504, "trade_query_timeout", "The trade query did not complete in time.");
        payload = await requestJSON(this.fetchImpl, `${endpoint}/${encodeURIComponent(job.jobId)}?location=${encodeURIComponent(job.location || this.location)}&timeoutMs=5000&maxResults=${encodeURIComponent(maxResults)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      if (error instanceof TradeError) throw error;
      throw new TradeError(error.status || 502, "trade_upstream_failed", "The UN Comtrade warehouse is temporarily unavailable.");
    }
    if (!payload.jobComplete) throw new TradeError(504, "trade_query_timeout", "The trade query did not complete in time.");
    if (payload.errors?.length) throw new TradeError(502, "trade_query_failed", "The UN Comtrade warehouse returned an error.");
    return decodeRows(payload);
  }
}

export function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new TradeError(400, "invalid_trade_country", "Expected an ISO-3 country code.");
  return code;
}

export function normalizeProductCode(value) {
  const code = String(value || "").trim();
  if (!/^\d{2}$/.test(code)) throw new TradeError(400, "invalid_trade_product", "Expected a two-digit HS chapter code.");
  return code;
}

export function normalizeEnergyProduct(value) {
  const id = String(value || "petroleum").trim().toLowerCase();
  const product = ENERGY_PRODUCTS[id];
  if (!product) throw new TradeError(400, "invalid_energy_product", "Expected petroleum, lng or gas.");
  return { id, ...product };
}

export function normalizeEnergyFrequency(value) {
  const frequency = String(value || "A").trim().toUpperCase();
  if (!["A", "M"].includes(frequency)) throw new TradeError(400, "invalid_energy_frequency", "Expected A for annual or M for monthly.");
  return frequency;
}

export function normalizeEnergyPeriod(value, frequency) {
  const period = String(value || "").trim();
  const valid = frequency === "A" ? /^20\d{2}$/ : /^20\d{2}(?:0[1-9]|1[0-2])$/;
  if (!valid.test(period)) throw new TradeError(400, "invalid_energy_period", frequency === "A" ? "Expected an annual YYYY period." : "Expected a monthly YYYYMM period.");
  return period;
}
