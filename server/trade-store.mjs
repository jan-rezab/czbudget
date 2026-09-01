import fs from "node:fs/promises";
import path from "node:path";
import { decodeRows, metadataToken, parameter, requestJSON } from "./france-municipal-lines.mjs";

const DEFAULT_PROJECT = "czbudget-janrezab";
const DEFAULT_LOCATION = "EU";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_TRADE_DATE = "2000-01-01";

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
  QUALIFY DENSE_RANK() OVER (PARTITION BY flow_code ORDER BY value_usd DESC) <= 20
)
SELECT * FROM totals
UNION ALL SELECT * FROM partner_rows
UNION ALL SELECT * FROM product_rows
ORDER BY row_kind, period_start, flow_code, value_usd DESC
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
  }

  async countries() {
    const cached = this.cache.get("countries");
    if (cached?.expiresAt > this.now()) return cached.value;
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
      for (const [key, flow] of [["imports", "import"], ["exports", "export"]]) {
        const value = Number(country?.flows?.[key]?.total_value_usd);
        if (Number.isFinite(value) && !totals.some((row) => row.frequency === "A" && row.period === seed.period && row.flow === flow)) {
          totals.push({ period: String(seed.period), period_start: `${seed.period}-01-01`, year: Number(seed.period), month: 52, frequency: "A", flow, value_usd: value, source_last_released: null, retrieved_at: seed.generated_at || null });
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

  put(key, value) {
    this.cache.set(key, { value, expiresAt: this.now() + CACHE_TTL_MS });
    while (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value);
  }

  async query(sql, queryParameters) {
    const token = await this.tokenProvider();
    const endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(this.project)}/queries`;
    const body = {
      query: sql,
      useLegacySql: false,
      location: this.location,
      timeoutMs: 8_000,
      maxResults: "1000",
      maximumBytesBilled: "5000000000",
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
        payload = await requestJSON(this.fetchImpl, `${endpoint}/${encodeURIComponent(job.jobId)}?location=${encodeURIComponent(job.location || this.location)}&timeoutMs=5000&maxResults=1000`, {
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
