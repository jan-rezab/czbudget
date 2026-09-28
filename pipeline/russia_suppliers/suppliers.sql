-- One pinned scan; parent baskets are calculated from original HS6 leaves.
WITH leaves AS (
 SELECT period, reporter_iso3, reporter_name, partner_iso3, primary_value_usd,
  product_code, ingestion_run_id, source_last_released, retrieved_at,
  COUNT(*) OVER (PARTITION BY period,reporter_iso3,partner_iso3,product_code) leaf_versions
 FROM `czbudget-janrezab.budget_detail.trade_observations` FOR SYSTEM_TIME AS OF @snapshot_at
 WHERE period_start BETWEEN DATE '2019-01-01' AND DATE(@snapshot_at)
  AND frequency='A' AND product_type='C' AND flow_code='X'
  AND reporter_area_code IN (
   SELECT DISTINCT area_code FROM `czbudget-janrezab.budget_detail.trade_areas`
   FOR SYSTEM_TIME AS OF @snapshot_at WHERE is_reporter AND NOT is_group)
  AND partner_iso3 IN ('RUS','KAZ','KGZ')
  AND aggregation_level=6 AND is_original_classification AND STARTS_WITH(classification_code,'H')
  AND (customs_code IS NULL OR customs_code='C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code=0)
  AND (partner2_area_code IS NULL OR partner2_area_code=0)
 QUALIFY ROW_NUMBER() OVER (PARTITION BY period,reporter_iso3,partner_iso3,product_code
  ORDER BY source_last_released DESC,loaded_at DESC,trade_observation_id)=1
), baskets AS (
 SELECT leaves.*, basket FROM leaves CROSS JOIN UNNEST([
  'TOTAL',SUBSTR(product_code,1,2),
  IF(product_code IN ('854231','847130','845710','848210'),product_code,NULL)]) basket
 WHERE basket IS NOT NULL
)
SELECT basket product, period, reporter_iso3, ANY_VALUE(reporter_name) reporter_name,
 partner_iso3, CAST(SUM(primary_value_usd) AS STRING) value_usd,
 COUNT(DISTINCT product_code) product_count,
 STRING_AGG(DISTINCT ingestion_run_id,'|' ORDER BY ingestion_run_id) release_ids,
 MAX(source_last_released) source_last_released, MAX(retrieved_at) retrieved_at,
 COUNT(*) accepted_source_rows, SUM(leaf_versions) received_source_rows,
 COUNTIF(primary_value_usd IS NULL) missing_money_rows
FROM baskets GROUP BY basket,period,reporter_iso3,partner_iso3
ORDER BY basket,period,reporter_iso3,partner_iso3
