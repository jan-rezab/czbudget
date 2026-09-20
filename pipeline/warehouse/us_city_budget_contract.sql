-- Additive warehouse contract for dual-layer United States city budgets.
--
-- Layer 1 remains the existing standardized municipal facts (for example the
-- Census of Governments classification). Layer 2 preserves every published
-- native city dimension. Nothing in this migration rewrites an existing table.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_aliases` (
  alias_system STRING NOT NULL OPTIONS(description = 'Identifier namespace, for example US_CENSUS_GOV_ID, US_GNIS or NYC_OPEN_DATA'),
  alias_value STRING NOT NULL,
  public_entity_id STRING NOT NULL,
  alias_label STRING,
  valid_from DATE,
  valid_to DATE,
  source_id STRING NOT NULL,
  evidence_url STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY alias_system, alias_value, public_entity_id
OPTIONS(description = 'Audited crosswalk from source-native government identifiers and aliases to the stable public entity.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.municipal_source_snapshots` (
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  snapshot_id STRING NOT NULL OPTIONS(description = 'Deterministic SHA-256 identifier for the retrieved source snapshot or API result set'),
  public_entity_id STRING NOT NULL,
  dataset_layer STRING NOT NULL OPTIONS(description = 'broad_standardized or native_granular'),
  source_name STRING NOT NULL,
  source_url STRING NOT NULL,
  landing_page_url STRING,
  source_dataset_id STRING,
  source_vintage STRING,
  published_at TIMESTAMP,
  retrieved_at TIMESTAMP NOT NULL,
  content_sha256 STRING NOT NULL,
  archive_uri STRING,
  archive_generation STRING,
  row_count INT64,
  schema_json JSON,
  completed_marker_uri STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY public_entity_id, source_id, ingestion_run_id
OPTIONS(description = 'Immutable source-snapshot evidence. Cloud archive generations are recorded, never overwritten.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.municipal_native_budget_facts` (
  fact_id STRING NOT NULL OPTIONS(description = 'Uppercase hexadecimal SHA-256 of canonical fact_identity; stable across identical reloads'),
  fact_identity JSON NOT NULL OPTIONS(description = 'Canonical ordered identity object hashed as TO_HEX(SHA256(TO_JSON_STRING(fact_identity)))'),
  public_entity_id STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING NOT NULL,
  period_start DATE,
  period_end DATE,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL OPTIONS(description = 'proposal, enacted, adopted, revised, forecast or actual'),
  budget_side STRING NOT NULL OPTIONS(description = 'revenue, expenditure, financing, balance_sheet or staffing'),
  measure_type STRING NOT NULL OPTIONS(description = 'currency_amount, fte, headcount, quantity, rate or source-defined measure'),
  measure_value NUMERIC NOT NULL,
  measure_unit STRING NOT NULL,
  currency_code STRING OPTIONS(description = 'ISO 4217 for currency_amount; NULL for non-currency measures'),
  amount_scale INT64 DEFAULT 1 NOT NULL,
  native_dimensions JSON NOT NULL OPTIONS(description = 'Object of losslessly preserved source dimension keys and values'),
  native_dimension_signature STRING NOT NULL OPTIONS(description = 'SHA-256 of canonical sorted native_dimensions JSON'),
  native_line_code STRING,
  native_line_name STRING,
  parent_native_line_code STRING,
  view_id STRING NOT NULL OPTIONS(description = 'Source-defined budget view/version whose rows can be compared together'),
  additive_group_id STRING NOT NULL OPTIONS(description = 'Rows may only be summed inside the same group when is_additive is true'),
  is_additive BOOL NOT NULL,
  non_additive_reason STRING,
  is_summary_row BOOL NOT NULL,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  snapshot_id STRING NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  source_record_id STRING,
  source_line_locator STRING OPTIONS(description = 'Stable source row, cell range, API key or document page locator'),
  source_line_sha256 STRING NOT NULL,
  source_url STRING NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  coverage_type STRING NOT NULL OPTIONS(description = 'census, survey, published_subset or administrative_return'),
  is_imputed BOOL NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(1900, 2101, 1))
CLUSTER BY public_entity_id, source_id, budget_stage, view_id
OPTIONS(
  description = 'Lossless source-native city budget facts. Parallel views and totals are explicitly non-additive.',
  require_partition_filter = TRUE
);

-- Load jobs write only to this staging contract. Promotion is separately
-- parameterized by the exact source_id + ingestion_run_id pair.
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage` (
  fact_id STRING NOT NULL,
  fact_identity JSON NOT NULL,
  public_entity_id STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING NOT NULL,
  period_start DATE,
  period_end DATE,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL,
  budget_side STRING NOT NULL,
  measure_type STRING NOT NULL,
  measure_value NUMERIC NOT NULL,
  measure_unit STRING NOT NULL,
  currency_code STRING,
  amount_scale INT64 NOT NULL,
  native_dimensions JSON NOT NULL,
  native_dimension_signature STRING NOT NULL,
  native_line_code STRING,
  native_line_name STRING,
  parent_native_line_code STRING,
  view_id STRING NOT NULL,
  additive_group_id STRING NOT NULL,
  is_additive BOOL NOT NULL,
  non_additive_reason STRING,
  is_summary_row BOOL NOT NULL,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  snapshot_id STRING NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  source_record_id STRING,
  source_line_locator STRING,
  source_line_sha256 STRING NOT NULL,
  source_url STRING NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  coverage_type STRING NOT NULL,
  is_imputed BOOL NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(1900, 2101, 1))
CLUSTER BY source_id, ingestion_run_id, public_entity_id
OPTIONS(require_partition_filter = TRUE, description = 'Validated staging rows awaiting exact-run promotion.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail._us_census_budget_fact_stage` (
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  public_entity_id STRING NOT NULL,
  census_government_id STRING NOT NULL,
  city_slug STRING NOT NULL,
  city_name STRING NOT NULL,
  state STRING NOT NULL,
  census_entity_name STRING NOT NULL,
  pid_population INT64,
  pid_population_year STRING,
  fiscal_year_ending STRING,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING NOT NULL,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL,
  budget_side STRING NOT NULL,
  economic_item_code STRING NOT NULL,
  amount_local INT64 NOT NULL,
  currency_code STRING NOT NULL,
  imputation_flag STRING,
  is_imputed BOOL NOT NULL,
  source_row_number INT64 NOT NULL,
  source_sheet STRING NOT NULL,
  source_line_sha256 STRING NOT NULL,
  raw_sha256 STRING NOT NULL,
  source_url STRING NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  coverage_type STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY source_id, ingestion_run_id, public_entity_id, economic_item_code
OPTIONS(description = 'Exact-run staging for decoded Census individual-unit municipal finance records.');

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.municipal_budget_dual_layer` AS
SELECT
  TO_HEX(SHA256(CONCAT(
    'broad_standardized', '\x1f', public_entity_id, '\x1f', CAST(fiscal_year AS STRING), '\x1f',
    fiscal_period, '\x1f', reporting_scope, '\x1f', budget_stage, '\x1f', budget_side, '\x1f',
    COALESCE(functional_paragraph_code, ''), '\x1f', economic_item_code, '\x1f', source_id, '\x1f',
    ingestion_run_id, '\x1f', COALESCE(CAST(source_row_number AS STRING), '')
  ))) AS fact_id,
  'broad_standardized' AS dataset_layer,
  public_entity_id, fiscal_year, fiscal_period, reporting_scope, budget_stage, budget_side,
  'currency_amount' AS measure_type, amount_local AS measure_value, currency_code AS measure_unit,
  currency_code, TO_JSON(STRUCT(
    functional_paragraph_code AS functional_code,
    economic_item_code AS economic_code,
    source_budget_item_type_code AS item_type_code
  )) AS native_dimensions,
  'standardized' AS view_id,
  CONCAT('standardized:', public_entity_id, ':', CAST(fiscal_year AS STRING), ':', fiscal_period, ':', budget_stage) AS additive_group_id,
  NOT is_summary_row AND NOT is_consolidation_item AS is_additive,
  is_summary_row, source_id, ingestion_run_id, CAST(NULL AS STRING) AS snapshot_id,
  source_row_number, source_sheet, CAST(NULL AS STRING) AS source_line_locator,
  quality_flags
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
WHERE fiscal_year BETWEEN 1900 AND 2100
UNION ALL
SELECT
  fact_id, 'native_granular', public_entity_id, fiscal_year, fiscal_period, reporting_scope,
  budget_stage, budget_side, measure_type, measure_value, measure_unit, currency_code,
  native_dimensions, view_id, additive_group_id, is_additive, is_summary_row, source_id,
  ingestion_run_id, snapshot_id, source_row_number, source_sheet, source_line_locator, quality_flags
FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
WHERE fiscal_year BETWEEN 1900 AND 2100;
