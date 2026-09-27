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
 async aggregate(frequency = 'A', product = 'TOTAL') {
  frequency ||= 'A'; product ||= 'TOTAL';
  if (!['A','M'].includes(frequency) || !(product === 'TOTAL' || /^(0[1-9]|[1-8][0-9]|9[0-9])$/.test(product) || PRODUCTS.includes(product)))
   throw new TradeError(400, 'invalid_russia_aggregate_filter', 'Choose annual or monthly, and all goods, an HS chapter or a supported HS6 code.');
  const key = `russia-aggregate:${frequency}:${product}`;
  const cached = this.cache.get(key);
  if (cached?.expiresAt > this.now()) return cached.value;
  return shareInFlight(this.pending, key, async () => {
   const params = [parameter('frequency','STRING',frequency),parameter('product','STRING',product)];
   const [rows, suppliers, countries] = await Promise.all([
    this.query(RUSSIA_AGGREGATE_SQL,params,{maxResults:'25000',maximumBytesBilled:'40000000000'}),
    this.query(RUSSIA_SUPPLIERS_SQL,[parameter('product','STRING',product)],{maxResults:'10000',maximumBytesBilled:'40000000000'}),
    this.query("SELECT DISTINCT iso3, LOWER(iso2) iso2, name FROM `czbudget-janrezab.budget_detail.trade_areas` WHERE NOT is_group AND iso3 IS NOT NULL",[],{maxResults:'1000'})
   ]);
   const convert = row => ({...row, reported_value_usd:row.value_usd, value_usd:row.value_usd==null?null:Number(row.value_usd), product_count:Number(row.product_count)});
   const value = {schema_version:'russia-trade-aggregate.v1',frequency,product,unit:'current USD',
    observations:rows.map(convert),suppliers:suppliers.map(convert),countries,
    source:{title:'UN Comtrade',table:'czbudget-janrezab.budget_detail.trade_observations',
     url:'https://comtradeplus.un.org/',retrieved_at:rows.map(r=>r.retrieved_at).filter(Boolean).sort().at(-1)||null,
     release_ids:[...new Set([...rows,...suppliers].flatMap(r=>(r.release_ids||'').split('|')).filter(Boolean))],
     method:'Calculated sums of deduplicated, originally reported HS6 observations. World partner rows are kept separate from bilateral rows. Annual and monthly grains are never combined.',
     release_note:'Ingestion IDs identify contributing loads, not an immutable snapshot. Product counts describe observed coverage, not completeness.'}};
   this.put(key,value);return value;
  });
 }
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

// Keep only one original observation per leaf, partner and period before any sum.
// TOTAL/HS2 below are calculated baskets, not a second sum over parent aggregates.
export const RUSSIA_AGGREGATE_SQL = `
WITH leaves AS (
 SELECT period, reporter_iso3, flow_code, partner_area_code, partner_iso3, partner_name,
  product_code, primary_value_usd, classification_code, source_last_released,
  retrieved_at, ingestion_run_id, source_response_sha256
 FROM \`czbudget-janrezab.budget_detail.trade_observations\`
 WHERE period_start BETWEEN DATE '2019-01-01' AND CURRENT_DATE()
  AND frequency=@frequency AND product_type='C' AND reporter_iso3 IN ('KAZ','KGZ')
  AND (partner_area_code=0 OR partner_area_code IN (SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\` WHERE is_partner AND NOT is_group))
  AND flow_code IN ('M','X') AND aggregation_level=6 AND is_original_classification
  AND STARTS_WITH(classification_code,'H')
  AND (customs_code IS NULL OR customs_code='C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code=0)
  AND (partner2_area_code IS NULL OR partner2_area_code=0)
  AND (flow_code='M' OR partner_area_code=0 OR partner_iso3='RUS')
 QUALIFY ROW_NUMBER() OVER (PARTITION BY period,reporter_iso3,flow_code,partner_area_code,product_code
  ORDER BY source_last_released DESC,loaded_at DESC,trade_observation_id)=1
), baskets AS (
 SELECT leaves.*, basket FROM leaves CROSS JOIN UNNEST(['TOTAL',SUBSTR(product_code,1,2),product_code]) basket
 WHERE ((partner_area_code=0 OR (flow_code='X' AND partner_iso3='RUS')) AND LENGTH(basket)!=6)
  OR (basket=@product AND flow_code='M' AND partner_area_code!=0)
  OR (basket=@product AND (partner_area_code=0 OR (flow_code='X' AND partner_iso3='RUS')))
)
SELECT period,reporter_iso3,flow_code,partner_area_code,ANY_VALUE(partner_iso3) partner_iso3,
 ANY_VALUE(partner_name) partner_name,basket product_code,CAST(SUM(primary_value_usd) AS STRING) value_usd,
 COUNT(DISTINCT product_code) product_count,STRING_AGG(DISTINCT classification_code,'|') classifications,
 MAX(source_last_released) source_last_released,MAX(retrieved_at) retrieved_at,
 STRING_AGG(DISTINCT ingestion_run_id,'|') release_ids,
 STRING_AGG(DISTINCT source_response_sha256,'|') source_hashes
FROM baskets GROUP BY period,reporter_iso3,flow_code,partner_area_code,basket
ORDER BY period,reporter_iso3,flow_code,partner_area_code,basket
`;

// Independent exporter-reported annual comparison. Never mix these mirror
// declarations into the hub-reported totals or infer an absent bilateral as zero.
export const RUSSIA_SUPPLIERS_SQL = `
WITH leaves AS (
 SELECT period,reporter_iso3,reporter_name,partner_iso3,primary_value_usd,product_code,
  ingestion_run_id,source_last_released,retrieved_at
 FROM \`czbudget-janrezab.budget_detail.trade_observations\`
 WHERE period_start BETWEEN DATE '2019-01-01' AND CURRENT_DATE()
  AND frequency='A' AND product_type='C' AND flow_code='X'
  AND reporter_area_code IN (SELECT DISTINCT area_code FROM \`czbudget-janrezab.budget_detail.trade_areas\` WHERE is_reporter AND NOT is_group)
  AND partner_iso3 IN ('RUS','KAZ','KGZ')
  AND aggregation_level=6 AND is_original_classification AND STARTS_WITH(classification_code,'H')
  AND (@product='TOTAL' OR SUBSTR(product_code,1,2)=@product OR product_code=@product)
  AND (customs_code IS NULL OR customs_code='C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code=0)
  AND (partner2_area_code IS NULL OR partner2_area_code=0)
 QUALIFY ROW_NUMBER() OVER (PARTITION BY period,reporter_iso3,partner_iso3,product_code
  ORDER BY source_last_released DESC,loaded_at DESC,trade_observation_id)=1
)
SELECT period,reporter_iso3,ANY_VALUE(reporter_name) reporter_name,partner_iso3,
 CAST(SUM(primary_value_usd) AS STRING) value_usd,COUNT(DISTINCT product_code) product_count,
 STRING_AGG(DISTINCT ingestion_run_id,'|') release_ids,MAX(source_last_released) source_last_released,
 MAX(retrieved_at) retrieved_at
FROM leaves GROUP BY period,reporter_iso3,partner_iso3 ORDER BY period,reporter_iso3,partner_iso3
`;
