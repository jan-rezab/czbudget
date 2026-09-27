
SELECT
  product_code,
  frequency,
  period,
  MIN(period_start) AS period_start,
  COUNT(*) AS source_record_count,
  COUNT(DISTINCT reporter_area_code) AS reporting_markets,
  COUNT(DISTINCT partner_area_code) AS reported_origins,
  SUM(primary_value_usd) AS observed_value_usd,
  SUM(net_weight_kg) AS observed_net_weight_kg,
  MAX(source_last_released) AS source_last_released,
  MAX(retrieved_at) AS retrieved_at
FROM `czbudget-janrezab.budget_detail.trade_observations` AS observation FOR SYSTEM_TIME AS OF @snapshot_at
WHERE period_start BETWEEN @min_date AND @max_date
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
    SELECT DISTINCT area_code FROM `czbudget-janrezab.budget_detail.trade_areas` FOR SYSTEM_TIME AS OF @snapshot_at
    WHERE is_reporter AND NOT is_group
  )
  AND partner_area_code IN (
    SELECT DISTINCT area_code FROM `czbudget-janrezab.budget_detail.trade_areas` FOR SYSTEM_TIME AS OF @snapshot_at
    WHERE is_partner AND NOT is_group
  )
GROUP BY product_code, frequency, period
ORDER BY product_code, frequency, period
;
