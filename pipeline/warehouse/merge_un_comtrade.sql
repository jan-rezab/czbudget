-- Incremental UN Comtrade load. Stage inputs are deduplicated before every
-- MERGE so a retried or overlapping crawl slice cannot create multi-match
-- failures or duplicate source observations.

DECLARE min_observation_date DATE;
DECLARE max_observation_date DATE;
DECLARE min_coverage_date DATE;
DECLARE max_coverage_date DATE;
SET min_observation_date = (
  SELECT MIN(period_start)
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
  WHERE period_start >= DATE '1900-01-01'
);
SET max_observation_date = (
  SELECT MAX(period_start)
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
  WHERE period_start >= DATE '1900-01-01'
);
SET min_coverage_date = (
  SELECT MIN(period_start)
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_dataset_coverage`
  WHERE period_start >= DATE '1900-01-01'
);
SET max_coverage_date = (
  SELECT MAX(period_start)
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_dataset_coverage`
  WHERE period_start >= DATE '1900-01-01'
);

MERGE `czbudget-janrezab.budget_detail.trade_areas` AS target
USING (
  SELECT
    area_code, iso2, iso3, name, note, is_group, is_reporter, is_partner,
    effective_from, effective_to, loaded_at
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_areas`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY area_code ORDER BY loaded_at DESC) = 1
) AS source
ON target.area_code = source.area_code
WHEN MATCHED THEN UPDATE SET
  iso2 = source.iso2, iso3 = source.iso3, name = source.name, note = source.note,
  is_group = source.is_group, is_reporter = source.is_reporter, is_partner = source.is_partner,
  effective_from = source.effective_from, effective_to = source.effective_to, loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  area_code, iso2, iso3, name, note, is_group, is_reporter, is_partner,
  effective_from, effective_to, loaded_at
) VALUES (
  source.area_code, source.iso2, source.iso3, source.name, source.note, source.is_group,
  source.is_reporter, source.is_partner, source.effective_from, source.effective_to, source.loaded_at
);

MERGE `czbudget-janrezab.budget_detail.trade_products` AS target
USING (
  SELECT
    product_type, classification_code, product_code, product_name,
    parent_product_code, aggregation_level, is_leaf, standard_unit_abbr,
    source_url, loaded_at
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_products`
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY product_type, classification_code, product_code ORDER BY loaded_at DESC
  ) = 1
) AS source
ON target.product_type = source.product_type
 AND target.classification_code = source.classification_code
 AND target.product_code = source.product_code
WHEN MATCHED THEN UPDATE SET
  product_name = source.product_name, parent_product_code = source.parent_product_code,
  aggregation_level = source.aggregation_level, is_leaf = source.is_leaf,
  standard_unit_abbr = source.standard_unit_abbr, source_url = source.source_url,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  product_type, classification_code, product_code, product_name,
  parent_product_code, aggregation_level, is_leaf, standard_unit_abbr,
  source_url, loaded_at
) VALUES (
  source.product_type, source.classification_code, source.product_code, source.product_name,
  source.parent_product_code, source.aggregation_level, source.is_leaf,
  source.standard_unit_abbr, source.source_url, source.loaded_at
);

MERGE `czbudget-janrezab.budget_detail.trade_observations` AS target
USING (
  SELECT
    trade_observation_id, period_start, period_end, period, ref_year, ref_month,
    frequency, product_type, reporter_area_code, reporter_iso3, reporter_name,
    flow_code, flow_name, partner_area_code, partner_iso3, partner_name,
    partner2_area_code, partner2_iso3, partner2_name, classification_code,
    classification_search_code, is_original_classification, product_code,
    product_name, aggregation_level, is_leaf, customs_code, customs_name,
    mode_of_transport_code, mode_of_transport_name, quantity_unit_code,
    quantity_unit_abbr, quantity, quantity_is_estimated,
    alternate_quantity_unit_code, alternate_quantity_unit_abbr,
    alternate_quantity, alternate_quantity_is_estimated, net_weight_kg,
    net_weight_is_estimated, gross_weight_kg, gross_weight_is_estimated,
    cif_value_usd, fob_value_usd, primary_value_usd, legacy_estimation_flag,
    is_reported, is_aggregate, source_dataset_code, source_dataset_checksum,
    source_last_released, source_response_sha256, crawl_task_id,
    ingestion_run_id, retrieved_at, loaded_at
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
  WHERE period_start BETWEEN min_observation_date AND max_observation_date
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY trade_observation_id ORDER BY retrieved_at DESC, loaded_at DESC
  ) = 1
) AS source
ON target.period_start BETWEEN min_observation_date AND max_observation_date
 AND target.trade_observation_id = source.trade_observation_id
WHEN MATCHED AND source.retrieved_at >= target.retrieved_at THEN UPDATE SET
  period_start = source.period_start,
  period_end = source.period_end,
  period = source.period,
  ref_year = source.ref_year,
  ref_month = source.ref_month,
  frequency = source.frequency,
  product_type = source.product_type,
  reporter_area_code = source.reporter_area_code,
  reporter_iso3 = source.reporter_iso3,
  reporter_name = source.reporter_name,
  flow_code = source.flow_code,
  flow_name = source.flow_name,
  partner_area_code = source.partner_area_code,
  partner_iso3 = source.partner_iso3,
  partner_name = source.partner_name,
  partner2_area_code = source.partner2_area_code,
  partner2_iso3 = source.partner2_iso3,
  partner2_name = source.partner2_name,
  classification_code = source.classification_code,
  classification_search_code = source.classification_search_code,
  is_original_classification = source.is_original_classification,
  product_code = source.product_code,
  product_name = source.product_name,
  aggregation_level = source.aggregation_level,
  is_leaf = source.is_leaf,
  customs_code = source.customs_code,
  customs_name = source.customs_name,
  mode_of_transport_code = source.mode_of_transport_code,
  mode_of_transport_name = source.mode_of_transport_name,
  quantity_unit_code = source.quantity_unit_code,
  quantity_unit_abbr = source.quantity_unit_abbr,
  quantity = source.quantity,
  quantity_is_estimated = source.quantity_is_estimated,
  alternate_quantity_unit_code = source.alternate_quantity_unit_code,
  alternate_quantity_unit_abbr = source.alternate_quantity_unit_abbr,
  alternate_quantity = source.alternate_quantity,
  alternate_quantity_is_estimated = source.alternate_quantity_is_estimated,
  net_weight_kg = source.net_weight_kg,
  net_weight_is_estimated = source.net_weight_is_estimated,
  gross_weight_kg = source.gross_weight_kg,
  gross_weight_is_estimated = source.gross_weight_is_estimated,
  cif_value_usd = source.cif_value_usd,
  fob_value_usd = source.fob_value_usd,
  primary_value_usd = source.primary_value_usd,
  legacy_estimation_flag = source.legacy_estimation_flag,
  is_reported = source.is_reported,
  is_aggregate = source.is_aggregate,
  source_dataset_code = source.source_dataset_code,
  source_dataset_checksum = source.source_dataset_checksum,
  source_last_released = source.source_last_released,
  source_response_sha256 = source.source_response_sha256,
  crawl_task_id = source.crawl_task_id,
  ingestion_run_id = source.ingestion_run_id,
  retrieved_at = source.retrieved_at,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  trade_observation_id, period_start, period_end, period, ref_year, ref_month,
  frequency, product_type, reporter_area_code, reporter_iso3, reporter_name,
  flow_code, flow_name, partner_area_code, partner_iso3, partner_name,
  partner2_area_code, partner2_iso3, partner2_name, classification_code,
  classification_search_code, is_original_classification, product_code,
  product_name, aggregation_level, is_leaf, customs_code, customs_name,
  mode_of_transport_code, mode_of_transport_name, quantity_unit_code,
  quantity_unit_abbr, quantity, quantity_is_estimated,
  alternate_quantity_unit_code, alternate_quantity_unit_abbr,
  alternate_quantity, alternate_quantity_is_estimated, net_weight_kg,
  net_weight_is_estimated, gross_weight_kg, gross_weight_is_estimated,
  cif_value_usd, fob_value_usd, primary_value_usd, legacy_estimation_flag,
  is_reported, is_aggregate, source_dataset_code, source_dataset_checksum,
  source_last_released, source_response_sha256, crawl_task_id,
  ingestion_run_id, retrieved_at, loaded_at
) VALUES (
  source.trade_observation_id, source.period_start, source.period_end, source.period,
  source.ref_year, source.ref_month, source.frequency, source.product_type,
  source.reporter_area_code, source.reporter_iso3, source.reporter_name,
  source.flow_code, source.flow_name, source.partner_area_code, source.partner_iso3,
  source.partner_name, source.partner2_area_code, source.partner2_iso3,
  source.partner2_name, source.classification_code, source.classification_search_code,
  source.is_original_classification, source.product_code, source.product_name,
  source.aggregation_level, source.is_leaf, source.customs_code, source.customs_name,
  source.mode_of_transport_code, source.mode_of_transport_name, source.quantity_unit_code,
  source.quantity_unit_abbr, source.quantity, source.quantity_is_estimated,
  source.alternate_quantity_unit_code, source.alternate_quantity_unit_abbr,
  source.alternate_quantity, source.alternate_quantity_is_estimated,
  source.net_weight_kg, source.net_weight_is_estimated, source.gross_weight_kg,
  source.gross_weight_is_estimated, source.cif_value_usd, source.fob_value_usd,
  source.primary_value_usd, source.legacy_estimation_flag, source.is_reported,
  source.is_aggregate, source.source_dataset_code, source.source_dataset_checksum,
  source.source_last_released, source.source_response_sha256, source.crawl_task_id,
  source.ingestion_run_id, source.retrieved_at, source.loaded_at
);

MERGE `czbudget-janrezab.budget_detail.trade_dataset_coverage` AS target
USING (
  SELECT
    coverage_id, period_start, period, frequency, product_type,
    reporter_area_code, reporter_iso3, classification_code, source_dataset_code,
    source_dataset_checksum, source_total_records, source_first_released,
    source_last_released, crawl_status, queued_task_count, completed_task_count,
    no_data_task_count, split_task_count, error_task_count, loaded_row_count,
    assessed_at, loaded_at
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_dataset_coverage`
  WHERE period_start BETWEEN min_coverage_date AND max_coverage_date
  QUALIFY ROW_NUMBER() OVER (PARTITION BY coverage_id ORDER BY assessed_at DESC) = 1
) AS source
ON target.period_start BETWEEN min_coverage_date AND max_coverage_date
 AND target.coverage_id = source.coverage_id
WHEN MATCHED THEN UPDATE SET
  period_start = source.period_start, period = source.period, frequency = source.frequency,
  product_type = source.product_type, reporter_area_code = source.reporter_area_code,
  reporter_iso3 = source.reporter_iso3, classification_code = source.classification_code,
  source_dataset_code = source.source_dataset_code, source_dataset_checksum = source.source_dataset_checksum,
  source_total_records = source.source_total_records, source_first_released = source.source_first_released,
  source_last_released = source.source_last_released, crawl_status = source.crawl_status,
  queued_task_count = source.queued_task_count, completed_task_count = source.completed_task_count,
  no_data_task_count = source.no_data_task_count, split_task_count = source.split_task_count,
  error_task_count = source.error_task_count, loaded_row_count = source.loaded_row_count,
  assessed_at = source.assessed_at, loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  coverage_id, period_start, period, frequency, product_type,
  reporter_area_code, reporter_iso3, classification_code, source_dataset_code,
  source_dataset_checksum, source_total_records, source_first_released,
  source_last_released, crawl_status, queued_task_count, completed_task_count,
  no_data_task_count, split_task_count, error_task_count, loaded_row_count,
  assessed_at, loaded_at
) VALUES (
  source.coverage_id, source.period_start, source.period, source.frequency,
  source.product_type, source.reporter_area_code, source.reporter_iso3,
  source.classification_code, source.source_dataset_code, source.source_dataset_checksum,
  source.source_total_records, source.source_first_released, source.source_last_released,
  source.crawl_status, source.queued_task_count, source.completed_task_count,
  source.no_data_task_count, source.split_task_count, source.error_task_count,
  source.loaded_row_count, source.assessed_at, source.loaded_at
);

MERGE `czbudget-janrezab.budget_detail.trade_ingestion_runs` AS target
USING (
  SELECT
    ingestion_run_id, started_at, completed_at, status, source_id, source_vintage,
    queue_database_sha256, raw_response_count, rows_read, rows_loaded,
    warning_count, error_count, loaded_at
  FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_ingestion_runs`
  WHERE DATE(started_at) >= DATE '1900-01-01'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ingestion_run_id ORDER BY loaded_at DESC) = 1
) AS source
ON DATE(target.started_at) >= DATE '1900-01-01'
 AND target.ingestion_run_id = source.ingestion_run_id
WHEN MATCHED THEN UPDATE SET
  started_at = source.started_at, completed_at = source.completed_at, status = source.status,
  source_id = source.source_id, source_vintage = source.source_vintage,
  queue_database_sha256 = source.queue_database_sha256,
  raw_response_count = source.raw_response_count, rows_read = source.rows_read,
  rows_loaded = source.rows_loaded, warning_count = source.warning_count,
  error_count = source.error_count, loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  ingestion_run_id, started_at, completed_at, status, source_id, source_vintage,
  queue_database_sha256, raw_response_count, rows_read, rows_loaded,
  warning_count, error_count, loaded_at
) VALUES (
  source.ingestion_run_id, source.started_at, source.completed_at, source.status,
  source.source_id, source.source_vintage, source.queue_database_sha256,
  source.raw_response_count, source.rows_read, source.rows_loaded,
  source.warning_count, source.error_count, source.loaded_at
);
