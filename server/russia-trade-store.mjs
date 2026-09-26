import { TradeStore, TradeError } from './trade-store.mjs';
import { parameter } from './france-municipal-lines.mjs';
import { shareInFlight } from './in-flight.mjs';

export const EXPORTERS = ['DEU','CZE','POL','FRA','ITA','NLD','GBR','USA','JPN','KOR','CHN','TUR'];
export const INTERMEDIARIES = ['KAZ','KGZ','ARM','GEO','TUR','UZB','ARE','CHN','BLR'];
export const PRODUCTS = ['854231','847130','845710','848210'];
export const RUSSIA_ROUTES_SQL = `
WITH ranked AS (
 SELECT period, reporter_iso3, partner_iso3, primary_value_usd,
  classification_code, source_last_released, retrieved_at, ingestion_run_id,
  source_response_sha256, trade_observation_id,
  ROW_NUMBER() OVER (PARTITION BY period, reporter_iso3, partner_iso3, product_code
   ORDER BY source_last_released DESC, loaded_at DESC, trade_observation_id) AS rank
 FROM \`czbudget-janrezab.budget_detail.trade_observations\`
 WHERE period_start BETWEEN DATE '2019-02-01' AND CURRENT_DATE()
  AND frequency = 'M' AND product_type = 'C' AND flow_code = 'X'
  AND product_code = @product AND aggregation_level = 6
  AND is_original_classification AND classification_code IN ('H5','H6')
  AND ((reporter_iso3 = @exporter AND partner_iso3 IN ('RUS', @via))
    OR (reporter_iso3 = @via AND partner_iso3 = 'RUS'))
  AND partner_area_code != 0
  AND (customs_code IS NULL OR customs_code = 'C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
  AND (partner2_area_code IS NULL OR partner2_area_code = 0)
)
SELECT period, reporter_iso3, partner_iso3, CAST(primary_value_usd AS STRING) AS value_usd,
 classification_code, source_last_released, retrieved_at, ingestion_run_id,
 source_response_sha256, trade_observation_id
FROM ranked WHERE rank = 1 ORDER BY period, reporter_iso3, partner_iso3
`;

export class RussiaTradeStore extends TradeStore {
 async routes(exporter = 'DEU', via = 'KAZ', product = '854231') {
  exporter ||= 'DEU'; via ||= 'KAZ'; product ||= '854231';
  if (!EXPORTERS.includes(exporter) || !INTERMEDIARIES.includes(via) || !PRODUCTS.includes(product) || exporter === via)
   throw new TradeError(400, 'invalid_russia_trade_filter', 'Choose a supported exporter, different intermediary and HS6 product.');
  const key = `russia:${exporter}:${via}:${product}`;
  const cached = this.cache.get(key);
  if (cached?.expiresAt > this.now()) return cached.value;
  return shareInFlight(this.pending, key, async () => {
   const rows = await this.query(RUSSIA_ROUTES_SQL, [parameter('exporter','STRING',exporter), parameter('via','STRING',via), parameter('product','STRING',product)], { maxResults:'5000', maximumBytesBilled:'8000000000' });
   const value = { schema_version:'russia-trade-routes.v1', exporter, via, product,
    frequency:'M', reporting_basis:'EXPORTER_REPORTED', unit:'current USD',
    start_period:'201902', end_period:new Date(this.now()).toISOString().slice(0,7).replace('-',''),
    observations:rows.map(row => ({ ...row, reported_value_usd:row.value_usd, value_usd:row.value_usd == null ? null : Number(row.value_usd) })),
    source:{ title:'UN Comtrade', table:'czbudget-janrezab.budget_detail.trade_observations',
     url:`https://comtradeplus.un.org/TradeFlow?Frequency=M&Flows=X&CommodityCodes=${product}`, retrieved_at:rows.map(row=>row.retrieved_at).filter(Boolean).sort().at(-1) || null,
     release_ids:[...new Set(rows.map(row=>row.ingestion_run_id).filter(Boolean))],
     release_note:'Published warehouse observations; ingestion IDs identify contributing loads, not an immutable snapshot.' },
    note:'Three separately reported export legs. They are not linked shipments. Missing observations are not zero. The latest month may be incomplete.' };
   this.put(key,value); return value;
  });
 }
}
