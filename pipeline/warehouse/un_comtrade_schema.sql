-- UN Comtrade warehouse layer. Facts are partitioned by source period and
-- clustered for the dominant reporter/partner/product access paths.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.trade_areas` (
  area_code INT64 NOT NULL,
  iso2 STRING,
  iso3 STRING,
  name STRING NOT NULL,
  note STRING,
  is_group BOOL NOT NULL,
  is_reporter BOOL NOT NULL,
  is_partner BOOL NOT NULL,
  effective_from DATE,
  effective_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY iso3, area_code
OPTIONS(description = 'UN Comtrade reporter and partner areas, including World and explicitly labelled groups.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.trade_products` (
  product_type STRING NOT NULL OPTIONS(description = 'C merchandise or S services'),
  classification_code STRING NOT NULL,
  product_code STRING NOT NULL,
  product_name STRING NOT NULL,
  parent_product_code STRING,
  aggregation_level INT64,
  is_leaf BOOL NOT NULL,
  standard_unit_abbr STRING,
  source_url STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY product_type, classification_code, product_code
OPTIONS(description = 'HS and EBOPS product/service classifications exactly as published by UN Comtrade.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.trade_observations` (
  trade_observation_id STRING NOT NULL OPTIONS(description = 'SHA-256 of the complete source-dimensional natural key'),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period STRING NOT NULL,
  ref_year INT64 NOT NULL,
  ref_month INT64,
  frequency STRING NOT NULL OPTIONS(description = 'A annual or M monthly'),
  product_type STRING NOT NULL OPTIONS(description = 'C merchandise or S services'),
  reporter_area_code INT64 NOT NULL,
  reporter_iso3 STRING,
  reporter_name STRING,
  flow_code STRING NOT NULL,
  flow_name STRING,
  partner_area_code INT64 NOT NULL,
  partner_iso3 STRING,
  partner_name STRING,
  partner2_area_code INT64,
  partner2_iso3 STRING,
  partner2_name STRING,
  classification_code STRING NOT NULL,
  classification_search_code STRING,
  is_original_classification BOOL,
  product_code STRING NOT NULL,
  product_name STRING,
  aggregation_level INT64,
  is_leaf BOOL,
  customs_code STRING,
  customs_name STRING,
  mode_of_transport_code INT64,
  mode_of_transport_name STRING,
  quantity_unit_code INT64,
  quantity_unit_abbr STRING,
  quantity NUMERIC,
  quantity_is_estimated BOOL,
  alternate_quantity_unit_code INT64,
  alternate_quantity_unit_abbr STRING,
  alternate_quantity NUMERIC,
  alternate_quantity_is_estimated BOOL,
  net_weight_kg NUMERIC,
  net_weight_is_estimated BOOL,
  gross_weight_kg NUMERIC,
  gross_weight_is_estimated BOOL,
  cif_value_usd NUMERIC,
  fob_value_usd NUMERIC,
  primary_value_usd NUMERIC NOT NULL,
  legacy_estimation_flag INT64,
  is_reported BOOL,
  is_aggregate BOOL,
  source_dataset_code STRING,
  source_dataset_checksum INT64,
  source_last_released TIMESTAMP,
  source_response_sha256 STRING NOT NULL,
  crawl_task_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY period_start
CLUSTER BY reporter_iso3, partner_iso3, classification_code, product_code
OPTIONS(
  description = 'Detailed annual/monthly bilateral UN Comtrade goods and services observations; no missing value is represented as zero.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.trade_dataset_coverage` (
  coverage_id STRING NOT NULL,
  period_start DATE NOT NULL,
  period STRING NOT NULL,
  frequency STRING NOT NULL,
  product_type STRING NOT NULL,
  reporter_area_code INT64 NOT NULL,
  reporter_iso3 STRING,
  classification_code STRING NOT NULL,
  source_dataset_code STRING,
  source_dataset_checksum INT64,
  source_total_records INT64,
  source_first_released TIMESTAMP,
  source_last_released TIMESTAMP,
  crawl_status STRING NOT NULL OPTIONS(description = 'available, queued, partial, loaded, no_data or error'),
  queued_task_count INT64 NOT NULL,
  completed_task_count INT64 NOT NULL,
  no_data_task_count INT64 NOT NULL,
  split_task_count INT64 NOT NULL,
  error_task_count INT64 NOT NULL,
  loaded_row_count INT64 NOT NULL,
  assessed_at TIMESTAMP NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY period_start
CLUSTER BY reporter_iso3, product_type, frequency, classification_code
OPTIONS(
  description = 'Availability and crawl completeness by source reporter dataset; source absence remains distinct from zero trade.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.trade_ingestion_runs` (
  ingestion_run_id STRING NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status STRING NOT NULL,
  source_id STRING NOT NULL,
  source_vintage STRING,
  queue_database_sha256 STRING,
  raw_response_count INT64,
  rows_read INT64,
  rows_loaded INT64,
  warning_count INT64,
  error_count INT64,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(started_at)
CLUSTER BY source_id, status
OPTIONS(
  description = 'Audit trail for UN Comtrade queue exports and BigQuery loads.',
  require_partition_filter = TRUE
);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.latest_trade_dataset_coverage` AS
SELECT
  coverage_id,
  period_start,
  period,
  frequency,
  product_type,
  reporter_area_code,
  reporter_iso3,
  classification_code,
  source_dataset_code,
  source_total_records,
  source_last_released,
  crawl_status,
  queued_task_count,
  completed_task_count,
  no_data_task_count,
  split_task_count,
  error_task_count,
  loaded_row_count,
  assessed_at
FROM `czbudget-janrezab.budget_detail.trade_dataset_coverage`
WHERE period_start >= DATE '1900-01-01'
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY product_type, frequency, reporter_area_code, classification_code
  ORDER BY period_start DESC, source_last_released DESC, assessed_at DESC
) = 1;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_goods_bilateral_hs6` AS
SELECT
  period_start,
  period,
  frequency,
  reporter_iso3,
  reporter_name,
  partner_iso3,
  partner_name,
  flow_code,
  flow_name,
  classification_code,
  product_code,
  product_name,
  primary_value_usd,
  net_weight_kg,
  source_last_released,
  retrieved_at
FROM `czbudget-janrezab.budget_detail.trade_observations`
WHERE period_start >= DATE '1900-01-01'
  AND product_type = 'C'
  AND aggregation_level = 6
  AND partner_area_code != 0;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_goods_country_totals` AS
SELECT
  period_start,
  period,
  frequency,
  reporter_iso3,
  reporter_name,
  flow_code,
  flow_name,
  classification_code,
  SUM(primary_value_usd) AS primary_value_usd,
  SUM(net_weight_kg) AS net_weight_kg,
  MAX(source_last_released) AS source_last_released,
  MAX(retrieved_at) AS retrieved_at
FROM `czbudget-janrezab.budget_detail.trade_observations`
WHERE period_start >= DATE '1900-01-01'
  AND product_type = 'C'
  AND aggregation_level = 6
  AND partner_area_code = 0
  AND (customs_code IS NULL OR customs_code = 'C00')
  AND (mode_of_transport_code IS NULL OR mode_of_transport_code = 0)
GROUP BY
  period_start,
  period,
  frequency,
  reporter_iso3,
  reporter_name,
  flow_code,
  flow_name,
  classification_code;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_services_bilateral_leaf` AS
SELECT
  period_start,
  period,
  frequency,
  reporter_iso3,
  reporter_name,
  partner_iso3,
  partner_name,
  flow_code,
  flow_name,
  classification_code,
  product_code,
  product_name,
  primary_value_usd,
  source_last_released,
  retrieved_at
FROM `czbudget-janrezab.budget_detail.trade_observations`
WHERE period_start >= DATE '1900-01-01'
  AND product_type = 'S'
  AND is_leaf
  AND partner_area_code != 0;
