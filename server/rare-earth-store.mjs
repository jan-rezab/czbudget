import { TradeError, TradeStore, normalizeCountryCode } from './trade-store.mjs';
import { parameter } from './france-municipal-lines.mjs';
import { shareInFlight } from './in-flight.mjs';

// These stable HS6 codes cover metals and compounds, not ores or magnets.
export const RARE_EARTH_CODES = ['280530', '284610', '284690'];
const SCOPE = `
    AND product_type = 'C' AND frequency = @frequency
    AND reporter_iso3 = @country
    AND product_code IN ('280530', '284610', '284690')
    AND aggregation_level = 6 AND STARTS_WITH(classification_code, 'H')
    AND flow_code IN ('X', 'M')
    AND (customs_code IS NULL OR customs_code = 'C00')
    AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
    AND (partner2_area_code IS NULL OR partner2_area_code = 0)`;
const DEDUP = `QUALIFY ROW_NUMBER() OVER (
    PARTITION BY period, flow_code, partner_area_code, product_code
    ORDER BY is_original_classification DESC, source_last_released DESC,
      retrieved_at DESC, classification_code DESC, trade_observation_id
  ) = 1`;

export const RARE_EARTH_HISTORY_SQL = `
WITH observations AS (
  SELECT period, product_code, flow_code, primary_value_usd AS value_usd,
    net_weight_kg, net_weight_is_estimated AS weight_estimated,
    source_last_released, retrieved_at
  FROM \`czbudget-janrezab.budget_detail.trade_observations\`
  WHERE period_start BETWEEN @min_date AND CURRENT_DATE()
    AND partner_area_code = 0 ${SCOPE}
  ${DEDUP}
), coverage AS (
  SELECT period, classification_code, crawl_status, source_last_released
  FROM \`czbudget-janrezab.budget_detail.trade_dataset_coverage\`
  WHERE period_start BETWEEN @min_date AND CURRENT_DATE()
    AND reporter_iso3 = @country AND product_type = 'C' AND frequency = @frequency
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY period, classification_code ORDER BY assessed_at DESC, loaded_at DESC
  ) = 1
)
SELECT 'totals' AS kind, TO_JSON_STRING(ARRAY_AGG(observations ORDER BY period, product_code, flow_code)) AS payload FROM observations
UNION ALL
SELECT 'coverage' AS kind, TO_JSON_STRING(ARRAY_AGG(coverage ORDER BY period, classification_code)) AS payload FROM coverage
`;

export const RARE_EARTH_PARTNERS_SQL = `
WITH observations AS (
  SELECT product_code, flow_code, partner_area_code, partner_iso3, partner_name,
    primary_value_usd AS value_usd, net_weight_kg,
    net_weight_is_estimated AS weight_estimated, source_last_released, retrieved_at
  FROM \`czbudget-janrezab.budget_detail.trade_observations\`
  WHERE period_start = @period_start ${SCOPE}
    AND partner_area_code != 0
    AND partner_area_code IN (
      SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\`
      WHERE is_partner AND NOT is_group
    )
  ${DEDUP}
)
SELECT 'partners' AS kind,
  TO_JSON_STRING(ARRAY_AGG(observations ORDER BY value_usd DESC, partner_area_code, product_code, flow_code)) AS payload
FROM observations
`;

export function rareEarthSelection(country, frequency = 'A', period = '') {
  const code = normalizeCountryCode(country);
  if (!['A', 'M'].includes(frequency)) throw new TradeError(400, 'invalid_trade_frequency', 'Expected A or M.');
  const selected = String(period || '');
  const valid = frequency === 'A' ? /^20\d{2}$/.test(selected) : /^20\d{2}(0[1-9]|1[0-2])$/.test(selected);
  if (selected && (!valid || Number(selected.slice(0, 4)) < 2020 || Number(selected.slice(0, 4)) > new Date().getUTCFullYear())) {
    throw new TradeError(400, 'invalid_trade_period', 'Expected a period from 2020 onward matching the selected frequency.');
  }
  return { country: code, frequency, period: selected };
}

function unpack(rows, kind) {
  return JSON.parse(rows.find(row => row.kind === kind)?.payload || 'null') || [];
}
const numeric = value => value === null || value === undefined ? null : Number(value);
function observation(row) {
  return { ...row, flow: row.flow_code === 'X' ? 'export' : 'import',
    value_usd: numeric(row.value_usd), net_weight_kg: numeric(row.net_weight_kg) };
}

export class RareEarthStore extends TradeStore {
  async profile(country, frequency = 'A', period = '') {
    const selection = rareEarthSelection(country, frequency, period);
    const key = `rare-earths:${selection.country}:${frequency}:${selection.period}`;
    const cached = this.cache.get(key);
    if (cached?.expiresAt > this.now()) return cached.value;
    return shareInFlight(this.pending, key, async () => {
      const parameters = [parameter('country', 'STRING', selection.country), parameter('frequency', 'STRING', frequency)];
      const historyKey = `rare-earth-history:${selection.country}:${frequency}`;
      const cachedHistory = this.cache.get(historyKey);
      const history = cachedHistory?.expiresAt > this.now() ? cachedHistory.value : await shareInFlight(this.pending, historyKey, async () => {
        const result = await this.query(RARE_EARTH_HISTORY_SQL, [...parameters, parameter('min_date', 'DATE', '2020-01-01')]);
        const value = { totals: unpack(result, 'totals').map(observation), coverage: unpack(result, 'coverage') };
        this.put(historyKey, value);
        return value;
      });
      const periods = [...new Set(history.totals.map(row => row.period))].sort();
      const selected = selection.period || periods.at(-1) || null;
      // Explicitly requested missing periods remain empty; never substitute another year.
      const start = selected ? `${selected.slice(0, 4)}-${frequency === 'M' ? selected.slice(4) : '01'}-01` : null;
      const partners = start ? unpack(await this.query(RARE_EARTH_PARTNERS_SQL,
        [...parameters, parameter('period_start', 'DATE', start)]), 'partners').map(observation) : [];
      const value = {
        schema_version: '1.0.0', country: selection.country, frequency, period: selected,
        periods, product_codes: RARE_EARTH_CODES, totals: history.totals, partners, coverage: history.coverage,
        source: { title: 'United Nations Comtrade Database', url: 'https://comtrade.un.org/',
          table: 'budget_detail.trade_observations',
          retrieved_at: [...history.totals, ...partners].map(row => row.retrieved_at).filter(Boolean).sort().at(-1) || null },
      };
      this.put(key, value);
      return value;
    });
  }
}
