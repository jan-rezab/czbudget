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

-- Product-centric trade edges use importer-reported bilateral observations only.
-- The partner is therefore an origin/supply proxy and the reporter is the import
-- market/demand proxy. Keeping a single reporting lens avoids double-counting
-- mirror export and import declarations for the same physical trade flow.
CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_product_import_flow_edges` AS
WITH latest_coverage AS (
  SELECT
    coverage_id,
    period_start,
    frequency,
    reporter_area_code,
    classification_code,
    crawl_status,
    assessed_at
  FROM `czbudget-janrezab.budget_detail.trade_dataset_coverage`
  WHERE period_start >= DATE '1900-01-01'
    AND product_type = 'C'
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY coverage_id
    ORDER BY assessed_at DESC
  ) = 1
)
SELECT
  observation.period_start,
  observation.period,
  observation.frequency,
  observation.classification_code,
  observation.product_code,
  ANY_VALUE(observation.product_name) AS product_name,
  observation.partner_area_code AS origin_area_code,
  observation.partner_iso3 AS origin_iso3,
  ANY_VALUE(observation.partner_name) AS origin_name,
  observation.reporter_area_code AS market_area_code,
  observation.reporter_iso3 AS market_iso3,
  ANY_VALUE(observation.reporter_name) AS market_name,
  'IMPORTER_REPORTED_ORIGIN' AS reporting_basis,
  coverage.crawl_status AS market_crawl_status,
  ANY_VALUE(observation.quantity_unit_abbr) AS quantity_unit_abbr,
  SUM(observation.primary_value_usd) AS primary_value_usd,
  SUM(observation.quantity) AS quantity,
  LOGICAL_OR(COALESCE(observation.quantity_is_estimated, FALSE)) AS quantity_is_estimated,
  SUM(observation.net_weight_kg) AS net_weight_kg,
  LOGICAL_OR(COALESCE(observation.net_weight_is_estimated, FALSE)) AS net_weight_is_estimated,
  SUM(observation.gross_weight_kg) AS gross_weight_kg,
  LOGICAL_OR(COALESCE(observation.gross_weight_is_estimated, FALSE)) AS gross_weight_is_estimated,
  SUM(observation.cif_value_usd) AS cif_value_usd,
  SUM(observation.fob_value_usd) AS fob_value_usd,
  MAX(observation.source_last_released) AS source_last_released,
  MAX(observation.retrieved_at) AS retrieved_at
FROM `czbudget-janrezab.budget_detail.trade_observations` AS observation
LEFT JOIN latest_coverage AS coverage
  ON coverage.period_start = observation.period_start
 AND coverage.frequency = observation.frequency
 AND coverage.reporter_area_code = observation.reporter_area_code
 AND coverage.classification_code = observation.classification_code
WHERE observation.period_start >= DATE '1900-01-01'
  AND observation.product_type = 'C'
  AND observation.aggregation_level = 6
  AND observation.is_leaf
  AND observation.flow_code = 'M'
  AND observation.partner_area_code != 0
  AND observation.reporter_iso3 IS NOT NULL
  AND observation.partner_iso3 IS NOT NULL
  AND (observation.customs_code IS NULL OR observation.customs_code = 'C00')
  AND (observation.mode_of_transport_code IS NULL OR observation.mode_of_transport_code = 0)
  AND (observation.partner2_area_code IS NULL OR observation.partner2_area_code = 0)
GROUP BY
  observation.period_start,
  observation.period,
  observation.frequency,
  observation.classification_code,
  observation.product_code,
  origin_area_code,
  origin_iso3,
  market_area_code,
  market_iso3,
  market_crawl_status;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_product_country_positions` AS
WITH roles AS (
  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    product_code,
    product_name,
    'ORIGIN_SUPPLY_PROXY' AS country_role,
    origin_area_code AS country_area_code,
    origin_iso3 AS country_iso3,
    origin_name AS country_name,
    market_area_code AS counterparty_area_code,
    primary_value_usd,
    quantity,
    net_weight_kg,
    source_last_released
  FROM `czbudget-janrezab.budget_detail.trade_product_import_flow_edges`
  WHERE period_start >= DATE '1900-01-01'

  UNION ALL

  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    product_code,
    product_name,
    'IMPORT_MARKET_DEMAND_PROXY' AS country_role,
    market_area_code AS country_area_code,
    market_iso3 AS country_iso3,
    market_name AS country_name,
    origin_area_code AS counterparty_area_code,
    primary_value_usd,
    quantity,
    net_weight_kg,
    source_last_released
  FROM `czbudget-janrezab.budget_detail.trade_product_import_flow_edges`
  WHERE period_start >= DATE '1900-01-01'
), aggregated AS (
  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    product_code,
    ANY_VALUE(product_name) AS product_name,
    country_role,
    country_area_code,
    country_iso3,
    ANY_VALUE(country_name) AS country_name,
    COUNT(DISTINCT counterparty_area_code) AS counterparty_count,
    SUM(primary_value_usd) AS primary_value_usd,
    SUM(quantity) AS quantity,
    SUM(net_weight_kg) AS net_weight_kg,
    MAX(source_last_released) AS source_last_released
  FROM roles
  GROUP BY
    period_start,
    period,
    frequency,
    classification_code,
    product_code,
    country_role,
    country_area_code,
    country_iso3
)
SELECT
  period_start,
  period,
  frequency,
  classification_code,
  product_code,
  product_name,
  country_role,
  country_area_code,
  country_iso3,
  country_name,
  counterparty_count,
  primary_value_usd,
  SAFE_DIVIDE(
    primary_value_usd,
    SUM(primary_value_usd) OVER (
      PARTITION BY period_start, frequency, classification_code, product_code, country_role
    )
  ) AS observed_value_share,
  DENSE_RANK() OVER (
    PARTITION BY period_start, frequency, classification_code, product_code, country_role
    ORDER BY primary_value_usd DESC
  ) AS observed_value_rank,
  quantity,
  SAFE_DIVIDE(primary_value_usd, NULLIF(quantity, 0)) AS value_per_quantity_unit_usd,
  net_weight_kg,
  source_last_released
FROM aggregated;

-- Curated product families for business-facing product intelligence. These
-- areas aggregate the detailed HS6 leaves while preserving the underlying
-- product count and bilateral reporting lens. EU27_AGGREGATED groups current
-- EU members into one comparable node; intra-EU trade remains present and is
-- explicitly flagged rather than silently removed.
CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_business_area_flow_edges` AS
WITH eu27 AS (
  SELECT iso3
  FROM UNNEST([
    'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN',
    'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX',
    'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'
  ]) AS iso3
), classified AS (
  SELECT
    edge.period_start,
    edge.period,
    edge.frequency,
    edge.classification_code,
    edge.product_code,
    edge.origin_iso3,
    edge.origin_name,
    edge.market_iso3,
    edge.market_name,
    edge.quantity_unit_abbr,
    edge.primary_value_usd,
    edge.quantity,
    edge.quantity_is_estimated,
    edge.net_weight_kg,
    edge.net_weight_is_estimated,
    edge.source_last_released,
    edge.retrieved_at,
    CASE
      WHEN edge.product_code = '851713' THEN 'SMARTPHONES'
      WHEN STARTS_WITH(edge.product_code, '8703') THEN 'PASSENGER_VEHICLES'
      WHEN STARTS_WITH(edge.product_code, '8542') THEN 'INTEGRATED_CIRCUITS'
      WHEN STARTS_WITH(edge.product_code, '3004') THEN 'MEDICAMENTS'
      WHEN STARTS_WITH(edge.product_code, '8507') THEN 'ELECTRIC_BATTERIES'
    END AS business_area_code,
    CASE
      WHEN edge.product_code = '851713' THEN 'Smartphones'
      WHEN STARTS_WITH(edge.product_code, '8703') THEN 'Passenger vehicles'
      WHEN STARTS_WITH(edge.product_code, '8542') THEN 'Integrated circuits'
      WHEN STARTS_WITH(edge.product_code, '3004') THEN 'Medicaments'
      WHEN STARTS_WITH(edge.product_code, '8507') THEN 'Electric batteries'
    END AS business_area_name,
    origin_eu.iso3 IS NOT NULL AS origin_is_eu27,
    market_eu.iso3 IS NOT NULL AS market_is_eu27
  FROM `czbudget-janrezab.budget_detail.trade_product_import_flow_edges` AS edge
  LEFT JOIN eu27 AS origin_eu
    ON origin_eu.iso3 = edge.origin_iso3
  LEFT JOIN eu27 AS market_eu
    ON market_eu.iso3 = edge.market_iso3
  WHERE edge.period_start >= DATE '1900-01-01'
    AND edge.frequency = 'A'
    AND (
      edge.product_code = '851713'
      OR STARTS_WITH(edge.product_code, '8703')
      OR STARTS_WITH(edge.product_code, '8542')
      OR STARTS_WITH(edge.product_code, '3004')
      OR STARTS_WITH(edge.product_code, '8507')
    )
), scoped AS (
  SELECT
    classified.period_start,
    classified.period,
    classified.frequency,
    classified.classification_code,
    classified.product_code,
    classified.origin_iso3,
    classified.origin_name,
    classified.market_iso3,
    classified.market_name,
    classified.quantity_unit_abbr,
    classified.primary_value_usd,
    classified.quantity,
    classified.quantity_is_estimated,
    classified.net_weight_kg,
    classified.net_weight_is_estimated,
    classified.source_last_released,
    classified.retrieved_at,
    classified.business_area_code,
    classified.business_area_name,
    classified.origin_is_eu27,
    classified.market_is_eu27,
    geography_rollup,
    IF(
      geography_rollup = 'EU27_AGGREGATED' AND origin_is_eu27,
      'EU27',
      origin_iso3
    ) AS origin_geo_code,
    IF(
      geography_rollup = 'EU27_AGGREGATED' AND origin_is_eu27,
      'European Union (EU-27)',
      origin_name
    ) AS origin_geo_name,
    IF(
      geography_rollup = 'EU27_AGGREGATED' AND market_is_eu27,
      'EU27',
      market_iso3
    ) AS market_geo_code,
    IF(
      geography_rollup = 'EU27_AGGREGATED' AND market_is_eu27,
      'European Union (EU-27)',
      market_name
    ) AS market_geo_name
  FROM classified
  CROSS JOIN UNNEST(['COUNTRY', 'EU27_AGGREGATED']) AS geography_rollup
)
SELECT
  period_start,
  period,
  frequency,
  classification_code,
  business_area_code,
  business_area_name,
  geography_rollup,
  origin_geo_code,
  ANY_VALUE(origin_geo_name) AS origin_geo_name,
  market_geo_code,
  ANY_VALUE(market_geo_name) AS market_geo_name,
  origin_geo_code = 'EU27' AND market_geo_code = 'EU27' AS is_intra_eu27,
  COUNT(DISTINCT product_code) AS hs6_product_code_count,
  COUNT(DISTINCT origin_iso3) AS origin_country_count,
  COUNT(DISTINCT market_iso3) AS market_country_count,
  COUNT(*) AS detailed_edge_count,
  SUM(primary_value_usd) AS primary_value_usd,
  IF(
    COUNT(DISTINCT quantity_unit_abbr) = 1,
    ANY_VALUE(quantity_unit_abbr),
    NULL
  ) AS quantity_unit_abbr,
  SUM(quantity) AS quantity,
  LOGICAL_OR(COALESCE(quantity_is_estimated, FALSE)) AS quantity_is_estimated,
  SUM(net_weight_kg) AS net_weight_kg,
  LOGICAL_OR(COALESCE(net_weight_is_estimated, FALSE)) AS net_weight_is_estimated,
  MAX(source_last_released) AS source_last_released,
  MAX(retrieved_at) AS retrieved_at
FROM scoped
GROUP BY
  period_start,
  period,
  frequency,
  classification_code,
  business_area_code,
  business_area_name,
  geography_rollup,
  origin_geo_code,
  market_geo_code;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.trade_business_area_positions` AS
WITH roles AS (
  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    business_area_code,
    business_area_name,
    geography_rollup,
    'ORIGIN_SUPPLY_PROXY' AS geography_role,
    origin_geo_code AS geography_code,
    origin_geo_name AS geography_name,
    market_geo_code AS counterparty_code,
    primary_value_usd,
    quantity,
    net_weight_kg,
    source_last_released
  FROM `czbudget-janrezab.budget_detail.trade_business_area_flow_edges`
  WHERE period_start >= DATE '1900-01-01'

  UNION ALL

  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    business_area_code,
    business_area_name,
    geography_rollup,
    'IMPORT_MARKET_DEMAND_PROXY' AS geography_role,
    market_geo_code AS geography_code,
    market_geo_name AS geography_name,
    origin_geo_code AS counterparty_code,
    primary_value_usd,
    quantity,
    net_weight_kg,
    source_last_released
  FROM `czbudget-janrezab.budget_detail.trade_business_area_flow_edges`
  WHERE period_start >= DATE '1900-01-01'
), aggregated AS (
  SELECT
    period_start,
    period,
    frequency,
    classification_code,
    business_area_code,
    ANY_VALUE(business_area_name) AS business_area_name,
    geography_rollup,
    geography_role,
    geography_code,
    ANY_VALUE(geography_name) AS geography_name,
    COUNT(DISTINCT counterparty_code) AS counterparty_count,
    SUM(primary_value_usd) AS primary_value_usd,
    SUM(quantity) AS quantity,
    SUM(net_weight_kg) AS net_weight_kg,
    MAX(source_last_released) AS source_last_released
  FROM roles
  GROUP BY
    period_start,
    period,
    frequency,
    classification_code,
    business_area_code,
    geography_rollup,
    geography_role,
    geography_code
)
SELECT
  period_start,
  period,
  frequency,
  classification_code,
  business_area_code,
  business_area_name,
  geography_rollup,
  geography_role,
  geography_code,
  geography_name,
  counterparty_count,
  primary_value_usd,
  SAFE_DIVIDE(
    primary_value_usd,
    SUM(primary_value_usd) OVER (
      PARTITION BY
        period_start,
        frequency,
        classification_code,
        business_area_code,
        geography_rollup,
        geography_role
    )
  ) AS observed_value_share,
  DENSE_RANK() OVER (
    PARTITION BY
      period_start,
      frequency,
      classification_code,
      business_area_code,
      geography_rollup,
      geography_role
    ORDER BY primary_value_usd DESC
  ) AS observed_value_rank,
  quantity,
  SAFE_DIVIDE(primary_value_usd, NULLIF(quantity, 0)) AS value_per_quantity_unit_usd,
  net_weight_kg,
  source_last_released
FROM aggregated;

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
