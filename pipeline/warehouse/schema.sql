CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.countries` (
  country_code STRING NOT NULL OPTIONS(description = 'ISO 3166-1 alpha-3'),
  name_cs STRING NOT NULL,
  name_en STRING NOT NULL,
  currency_code STRING NOT NULL,
  role STRING NOT NULL,
  national_scope STRING,
  benchmark_reason STRING,
  benchmark_evidence_url STRING,
  loaded_at TIMESTAMP NOT NULL
)
OPTIONS(description = 'Země zahrnuté do detailního rozpočtového benchmarku.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.source_registry` (
  source_id STRING NOT NULL,
  country_code STRING NOT NULL,
  source_name STRING NOT NULL,
  source_url STRING NOT NULL,
  coverage STRING,
  formats ARRAY<STRING>,
  purpose STRING,
  active BOOL NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code
OPTIONS(description = 'Ověřené oficiální portály a datové zdroje.');

-- Global econometric layer. The source series remains intact and is never
-- overwritten by the curated indicator code used in reports.
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.economic_countries` (
  country_code STRING NOT NULL OPTIONS(description = 'ISO 3166-1 alpha-3 or source-compatible economy code'),
  country_code_alpha2 STRING,
  name_cs STRING,
  name_en STRING NOT NULL,
  region STRING,
  income_level STRING,
  is_benchmark_country BOOL NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code
OPTIONS(description = 'Country/economy dimension; aggregate regions are excluded.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.economic_indicators` (
  indicator_code STRING NOT NULL,
  source_id STRING NOT NULL,
  source_code STRING NOT NULL,
  label_cs STRING,
  label_en STRING NOT NULL,
  topic STRING NOT NULL,
  canonical_unit STRING,
  supported_frequencies ARRAY<STRING>,
  definition_notes STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY topic, indicator_code, source_id
OPTIONS(description = 'Report-facing econometric definitions with explicit source mappings.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.economic_observations` (
  observation_date DATE NOT NULL,
  period STRING NOT NULL OPTIONS(description = 'Source period, such as 2024, 2024-Q3 or 2024-09'),
  frequency STRING NOT NULL OPTIONS(description = 'A, Q or M'),
  country_code STRING NOT NULL,
  indicator_code STRING NOT NULL,
  source_series STRING NOT NULL,
  source_key STRING NOT NULL OPTIONS(description = 'Full source-dimensional series key'),
  topic STRING NOT NULL,
  value FLOAT64 NOT NULL,
  unit STRING,
  seasonal_adjustment STRING,
  transformation STRING,
  observation_status STRING,
  source_id STRING NOT NULL,
  source_url STRING NOT NULL,
  source_vintage STRING,
  retrieved_at TIMESTAMP NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY observation_date
CLUSTER BY country_code, indicator_code, source_id, frequency
OPTIONS(
  description = 'One untouched econometric source observation per country, series and period.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.economic_series_coverage` (
  country_code STRING NOT NULL,
  indicator_code STRING NOT NULL,
  frequency STRING NOT NULL,
  source_id STRING NOT NULL,
  first_period STRING NOT NULL,
  last_period STRING NOT NULL,
  observation_count INT64 NOT NULL,
  series_count INT64 NOT NULL,
  assessed_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, indicator_code, frequency, source_id
OPTIONS(description = 'Precomputed availability and history for report planning.');

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.latest_economic_observations` AS
SELECT
  country_code,
  indicator_code,
  source_id,
  frequency,
  source_key,
  period,
  observation_date,
  value,
  unit,
  seasonal_adjustment,
  transformation,
  observation_status,
  source_vintage
FROM `czbudget-janrezab.budget_detail.economic_observations`
WHERE observation_date >= DATE '1900-01-01'
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY country_code, indicator_code, source_id, frequency, source_key
  ORDER BY observation_date DESC, retrieved_at DESC
) = 1;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.ingestion_runs` (
  ingestion_run_id STRING NOT NULL,
  source_id STRING NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status STRING NOT NULL,
  source_vintage STRING,
  source_sha256 STRING,
  rows_read INT64,
  rows_loaded INT64,
  warning_count INT64,
  error_message STRING
)
PARTITION BY DATE(started_at)
CLUSTER BY source_id, status
OPTIONS(
  description = 'Auditní stopa každého stažení a transformace.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.raw_budget_lines` (
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  source_payload JSON NOT NULL,
  source_url STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, source_id
OPTIONS(
  description = 'Neměnný řádkový otisk původního zdroje před normalizací.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.classification_versions` (
  classification_id STRING NOT NULL,
  country_code STRING NOT NULL,
  budget_side STRING NOT NULL OPTIONS(description = 'revenue nebo expenditure'),
  government_scope STRING NOT NULL,
  valid_from_year INT64 NOT NULL,
  valid_to_year INT64,
  classification_name STRING NOT NULL,
  legal_basis STRING,
  source_url STRING,
  notes STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, budget_side
OPTIONS(description = 'Verze národních rozpočtových klasifikací a jejich platnost.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.budget_nodes` (
  budget_node_id STRING NOT NULL,
  classification_id STRING NOT NULL,
  country_code STRING NOT NULL,
  budget_side STRING NOT NULL,
  government_scope STRING NOT NULL,
  node_code STRING NOT NULL,
  node_name_native STRING NOT NULL,
  node_name_en STRING,
  node_name_cs STRING,
  parent_budget_node_id STRING,
  hierarchy_level INT64 NOT NULL,
  hierarchy_path ARRAY<STRUCT<node_code STRING, node_name STRING>>,
  is_chapter BOOL NOT NULL,
  effective_from_year INT64 NOT NULL,
  effective_to_year INT64,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, budget_side, classification_id
OPTIONS(description = 'Stabilní uzly původních národních stromů příjmů a výdajů.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.budget_amounts` (
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING DEFAULT 'FY' NOT NULL,
  government_scope STRING NOT NULL,
  budget_side STRING NOT NULL OPTIONS(description = 'revenue nebo expenditure'),
  budget_stage STRING NOT NULL OPTIONS(description = 'proposal, enacted, revised nebo actual'),
  budget_node_id STRING NOT NULL,
  chapter_code STRING,
  amount_native NUMERIC,
  currency_code STRING NOT NULL,
  amount_scale INT64 DEFAULT 1 NOT NULL,
  accounting_basis STRING,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  source_document_date DATE,
  is_provisional BOOL DEFAULT FALSE NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, budget_side, budget_stage, chapter_code
OPTIONS(
  description = 'Fakta plánu, změn a skutečnosti v nativní měně na národních rozpočtových uzlech.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.canonical_categories` (
  canonical_category_id STRING NOT NULL,
  taxonomy STRING NOT NULL OPTIONS(description = 'cofog, economic, revenue nebo policy_outcome'),
  category_code STRING NOT NULL,
  category_name_cs STRING NOT NULL,
  category_name_en STRING,
  parent_category_id STRING,
  hierarchy_level INT64 NOT NULL,
  polarity STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY taxonomy, category_code
OPTIONS(description = 'Společné analytické taxonomie oddělené od národních osnov.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.budget_mappings` (
  budget_node_id STRING NOT NULL,
  canonical_category_id STRING NOT NULL,
  valid_from_year INT64 NOT NULL,
  valid_to_year INT64,
  allocation_share NUMERIC NOT NULL,
  mapping_method STRING NOT NULL OPTIONS(description = 'official, deterministic_rule nebo reviewed_model'),
  confidence NUMERIC,
  reviewer STRING,
  evidence_url STRING,
  notes STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY canonical_category_id, mapping_method
OPTIONS(description = 'Verzované mapování národních kapitol na společné kategorie; nikdy nepřepisuje originál.');

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.chapter_amounts` AS
SELECT
  amount.country_code,
  amount.fiscal_year,
  amount.government_scope,
  amount.budget_side,
  amount.budget_stage,
  amount.chapter_code,
  node.node_name_native AS chapter_name_native,
  node.node_name_cs AS chapter_name_cs,
  amount.currency_code,
  SUM(amount.amount_native * amount.amount_scale) AS amount_native
FROM `czbudget-janrezab.budget_detail.budget_amounts` AS amount
JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS node
  ON amount.budget_node_id = node.budget_node_id
WHERE node.is_chapter
GROUP BY
  amount.country_code,
  amount.fiscal_year,
  amount.government_scope,
  amount.budget_side,
  amount.budget_stage,
  amount.chapter_code,
  chapter_name_native,
  chapter_name_cs,
  amount.currency_code;

-- Shared municipal/public-entity layer. EU-capital headlines and Czech FIN 2-12M
-- line detail share public_entity_id and lineage, but remain separate fact grains.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entities` (
  public_entity_id STRING NOT NULL OPTIONS(description = 'Stable cross-source key, for example prague-cz or CZ:00253537'),
  entity_name STRING NOT NULL,
  entity_type STRING NOT NULL OPTIONS(description = 'municipality, capital_city_authority, city_state or metropolitan_authority'),
  country_code_alpha2 STRING NOT NULL,
  country_code_alpha3 STRING NOT NULL,
  national_entity_code STRING OPTIONS(description = 'National public-entity identifier, for example Czech IČO'),
  national_entity_code_type STRING OPTIONS(description = 'Identifier system, for example CZ_ICO'),
  is_eu_capital BOOL NOT NULL,
  is_extra_city BOOL NOT NULL,
  default_currency_code STRING NOT NULL,
  eurostat_city_code STRING,
  eurostat_geography_name STRING,
  administrative_region_code STRING,
  administrative_region_name STRING,
  administrative_district_code STRING,
  administrative_district_name STRING,
  national_geography_code STRING OPTIONS(description = 'National territorial identifier, for example Czech municipality code'),
  national_geography_code_type STRING OPTIONS(description = 'Identifier system, for example CZ_MUNICIPALITY_CODE'),
  valid_from DATE,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code_alpha3, public_entity_id
OPTIONS(description = 'Shared public-entity dimension for capitals and detailed Czech municipalities.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_sources` (
  source_id STRING NOT NULL,
  public_entity_id STRING,
  source_type STRING NOT NULL OPTIONS(description = 'budget_headline, budget_detail, population, tourism, balance_sheet, cash, fx or methodology'),
  source_name STRING NOT NULL,
  source_url STRING NOT NULL,
  dataset_code STRING,
  archive_file STRING,
  archive_sha256 STRING,
  retrieved_at TIMESTAMP,
  notes STRING,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY source_type, public_entity_id
OPTIONS(description = 'Official municipal, accounting and statistical sources used by the public-entity layer.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_budget_headlines` (
  public_entity_id STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING NOT NULL OPTIONS(description = 'FY, month, quarter or source period label'),
  period_label STRING NOT NULL OPTIONS(description = 'Display label such as 2026 or 2026-27'),
  period_type STRING NOT NULL,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL,
  status STRING NOT NULL,
  measure_code STRING NOT NULL,
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  amount_eur NUMERIC,
  local_currency_units_per_eur NUMERIC,
  fx_date DATE,
  amount_precision STRING NOT NULL,
  components JSON,
  is_provisional BOOL NOT NULL,
  comparability_notes STRING,
  source_id STRING NOT NULL,
  ingestion_run_id STRING,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY public_entity_id, budget_stage, status
OPTIONS(description = 'Annual or period headline budget totals; no paragraph/item detail is stored at this grain.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.municipal_budget_line_facts` (
  public_entity_id STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING DEFAULT 'FY' NOT NULL,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL OPTIONS(description = 'enacted, revised or actual'),
  budget_side STRING NOT NULL OPTIONS(description = 'revenue, expenditure or financing'),
  source_budget_item_type_code STRING,
  functional_paragraph_code STRING OPTIONS(description = 'Functional paragraph on the same fact row as economic item'),
  economic_item_code STRING NOT NULL OPTIONS(description = 'Economic item on the same fact row as functional paragraph'),
  functional_classification_id STRING OPTIONS(description = 'Country-specific classification version for functional_paragraph_code'),
  economic_classification_id STRING OPTIONS(description = 'Country-specific classification version for economic_item_code'),
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  amount_eur NUMERIC,
  fx_date DATE,
  is_consolidation_item BOOL NOT NULL OPTIONS(description = 'TRUE for an internal-transfer/consolidation item row that must be excluded from consolidated totals'),
  is_financing BOOL NOT NULL,
  is_summary_row BOOL NOT NULL OPTIONS(description = 'TRUE for a reported subtotal/total such as FINM202 row 8000; exclude when summing detailed financing items'),
  source_row_number INT64,
  source_sheet STRING,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  coverage_type STRING DEFAULT 'census' NOT NULL OPTIONS(description = 'census, survey, published_subset or administrative_return'),
  is_imputed BOOL DEFAULT FALSE NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY public_entity_id, budget_stage, functional_paragraph_code, economic_item_code
OPTIONS(description = 'Detailed municipal budget facts at entity × year/period × stage × paragraph × item grain.');

-- Regional governments are a distinct tier and a distinct fact grain. They
-- share public_entity_id with the generic entity dimension, but never share a
-- fact table with municipalities. Geographic containment is represented by
-- dimensions/relations, not by adding municipal amounts to a regional budget.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_governments` (
  regional_government_id STRING NOT NULL OPTIONS(description = 'Stable regional jurisdiction key; currently equal to the shared public_entity_id'),
  public_entity_id STRING NOT NULL,
  country_code STRING NOT NULL,
  national_region_code STRING NOT NULL,
  national_region_code_type STRING NOT NULL,
  government_type_code STRING NOT NULL OPTIONS(description = 'Source-country type such as region, department, voivodeship, canton, Land or state'),
  tier_level INT64 NOT NULL OPTIONS(description = 'Administrative/government level within the country; lower number is closer to central government'),
  name_native STRING NOT NULL,
  name_en STRING,
  name_cs STRING,
  nuts_code STRING,
  parent_regional_government_id STRING,
  is_capital_region BOOL NOT NULL,
  valid_from DATE,
  valid_to DATE,
  source_id STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, government_type_code, regional_government_id
OPTIONS(description = 'Regional-government jurisdiction dimension separate from municipalities; supports multiple elected regional tiers in one country.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_budget_line_facts` (
  public_entity_id STRING NOT NULL,
  country_code STRING NOT NULL,
  regional_tier_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  fiscal_period STRING DEFAULT 'FY' NOT NULL,
  reporting_scope STRING NOT NULL,
  budget_stage STRING NOT NULL OPTIONS(description = 'proposal, enacted, revised or actual; unavailable stages remain missing'),
  budget_side STRING NOT NULL OPTIONS(description = 'revenue, expenditure or financing'),
  source_budget_item_type_code STRING,
  functional_code STRING,
  economic_code STRING NOT NULL,
  functional_classification_id STRING,
  economic_classification_id STRING NOT NULL,
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  amount_eur NUMERIC,
  fx_date DATE,
  is_consolidation_item BOOL NOT NULL,
  is_financing BOOL NOT NULL,
  is_summary_row BOOL NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  coverage_type STRING NOT NULL,
  is_imputed BOOL NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, public_entity_id, budget_stage, functional_code
OPTIONS(
  description = 'Source-native regional budget facts at jurisdiction × year/period × stage × function × economic-item grain.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_budget_coverage` (
  coverage_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  regional_tier_code STRING NOT NULL,
  source_ids ARRAY<STRING>,
  entity_expected_count INT64,
  entity_source_count INT64 NOT NULL,
  entity_loaded_count INT64 NOT NULL,
  fact_count INT64 NOT NULL,
  budget_stages ARRAY<STRING>,
  budget_sides ARRAY<STRING>,
  coverage_type STRING NOT NULL,
  validation_status STRING NOT NULL,
  limitations ARRAY<STRING>,
  assessed_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, regional_tier_code
OPTIONS(
  description = 'Measured completeness by country, regional tier and year; a successful load is not automatically complete coverage.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_source_entities` (
  source_entity_id STRING NOT NULL OPTIONS(description = 'Stable entity key inside one source, for example oecd-regofi:CZ010'),
  source_id STRING NOT NULL,
  source_entity_code STRING NOT NULL,
  entity_name STRING NOT NULL,
  country_code STRING NOT NULL,
  regional_tier_code STRING NOT NULL,
  institutional_sector_code STRING NOT NULL,
  institutional_sector_name STRING,
  first_observation_year INT64 NOT NULL,
  last_observation_year INT64 NOT NULL,
  canonical_regional_government_id STRING OPTIONS(description = 'Reviewed link to regional_governments; NULL means that the source identity has not been reconciled yet'),
  crosswalk_status STRING NOT NULL OPTIONS(description = 'unmatched, reviewed_match or historical_entity'),
  source_id_namespace STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, regional_tier_code, source_entity_id
OPTIONS(description = 'Source-specific regional identities kept separate from canonical government entities until a crosswalk is reviewed.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_comparable_finance_observations` (
  source_entity_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  measure_code STRING NOT NULL,
  measure_name STRING NOT NULL,
  institutional_sector_code STRING NOT NULL,
  institutional_sector_name STRING,
  function_code STRING NOT NULL,
  function_name STRING,
  unit_code STRING NOT NULL,
  unit_name STRING,
  observation_value FLOAT64,
  observation_status STRING,
  unit_multiplier_code STRING,
  confidentiality_status STRING,
  decimals_code STRING,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, source_entity_id, measure_code, function_code
OPTIONS(
  description = 'Harmonised regional finance indicators such as OECD/EU REGOFI; distinct from source-native budget line items.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.regional_comparable_finance_coverage` (
  coverage_id STRING NOT NULL,
  source_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  regional_tier_code STRING NOT NULL,
  entity_source_count INT64 NOT NULL,
  observation_count INT64 NOT NULL,
  non_null_observation_count INT64 NOT NULL,
  measure_count INT64 NOT NULL,
  function_count INT64 NOT NULL,
  coverage_type STRING NOT NULL,
  validation_status STRING NOT NULL,
  limitations ARRAY<STRING>,
  assessed_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY source_id, country_code, regional_tier_code
OPTIONS(
  description = 'Measured source coverage for harmonised regional finance observations; source presence is not treated as legal or census completeness.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts` (
  public_entity_id STRING NOT NULL,
  statement_date DATE NOT NULL,
  reporting_scope STRING NOT NULL,
  statement_line_code STRING NOT NULL,
  account_code STRING NOT NULL OPTIONS(description = 'Synthetic account code; may be dash when the statement line has no synthetic-account breakdown'),
  account_name STRING,
  balance_measure STRING NOT NULL OPTIONS(description = 'current_gross, current_correction, current_net or prior_net'),
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  amount_eur NUMERIC,
  fx_date DATE,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  coverage_type STRING DEFAULT 'census' NOT NULL,
  is_imputed BOOL DEFAULT FALSE NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY statement_date
CLUSTER BY public_entity_id, account_code
OPTIONS(description = 'Balance-sheet observations kept separate from budget execution facts.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_cash_facts` (
  public_entity_id STRING NOT NULL,
  statement_date DATE NOT NULL,
  reporting_scope STRING NOT NULL,
  cash_category_code STRING NOT NULL OPTIONS(description = 'Source cash account or reviewed cash aggregate'),
  cash_category_name STRING,
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  amount_eur NUMERIC,
  fx_date DATE,
  source_id STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  source_row_number INT64,
  source_sheet STRING,
  coverage_type STRING DEFAULT 'census' NOT NULL,
  is_imputed BOOL DEFAULT FALSE NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY statement_date
CLUSTER BY public_entity_id, cash_category_code
OPTIONS(description = 'Cash and bank observations kept separate from both budgets and the full balance sheet.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_entity_metric_observations` (
  public_entity_id STRING NOT NULL,
  metric_code STRING NOT NULL,
  reference_year INT64 NOT NULL,
  value FLOAT64 NOT NULL,
  unit STRING NOT NULL,
  geography_code STRING,
  geography_name STRING NOT NULL,
  geography_scope STRING NOT NULL,
  comparability_group STRING NOT NULL,
  source_method STRING NOT NULL OPTIONS(description = 'reported or derived'),
  source_id STRING NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(reference_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY metric_code, public_entity_id, comparability_group
OPTIONS(description = 'Independently dated population, tourism and other profile observations.');

-- Idempotent migrations for datasets created before the municipal pilot.
ALTER TABLE `czbudget-janrezab.budget_detail.public_entities`
  ADD COLUMN IF NOT EXISTS administrative_region_code STRING,
  ADD COLUMN IF NOT EXISTS administrative_region_name STRING,
  ADD COLUMN IF NOT EXISTS administrative_district_code STRING,
  ADD COLUMN IF NOT EXISTS administrative_district_name STRING,
  ADD COLUMN IF NOT EXISTS national_geography_code STRING,
  ADD COLUMN IF NOT EXISTS national_geography_code_type STRING;

ALTER TABLE `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
  ADD COLUMN IF NOT EXISTS source_budget_item_type_code STRING,
  ADD COLUMN IF NOT EXISTS is_summary_row BOOL,
  ADD COLUMN IF NOT EXISTS functional_classification_id STRING,
  ADD COLUMN IF NOT EXISTS economic_classification_id STRING,
  ADD COLUMN IF NOT EXISTS coverage_type STRING,
  ADD COLUMN IF NOT EXISTS is_imputed BOOL;

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts`
  ADD COLUMN IF NOT EXISTS statement_line_code STRING,
  ADD COLUMN IF NOT EXISTS balance_measure STRING,
  ADD COLUMN IF NOT EXISTS source_row_number INT64,
  ADD COLUMN IF NOT EXISTS source_sheet STRING,
  ADD COLUMN IF NOT EXISTS coverage_type STRING,
  ADD COLUMN IF NOT EXISTS is_imputed BOOL;

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_cash_facts`
  ADD COLUMN IF NOT EXISTS source_row_number INT64,
  ADD COLUMN IF NOT EXISTS source_sheet STRING,
  ADD COLUMN IF NOT EXISTS coverage_type STRING,
  ADD COLUMN IF NOT EXISTS is_imputed BOOL;

ALTER TABLE `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
  SET OPTIONS (require_partition_filter = TRUE);

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts`
  SET OPTIONS (require_partition_filter = TRUE);

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_cash_facts`
  SET OPTIONS (require_partition_filter = TRUE);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.municipal_budget_line_details` AS
SELECT
  fact.public_entity_id,
  entity.entity_name,
  entity.national_entity_code AS ico,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.budget_side,
  fact.functional_paragraph_code,
  paragraph.node_name_cs AS functional_paragraph_name,
  fact.economic_item_code,
  item.node_name_cs AS economic_item_name,
  fact.amount_local,
  fact.currency_code,
  fact.is_consolidation_item,
  fact.is_financing,
  fact.is_summary_row,
  fact.source_id,
  fact.ingestion_run_id,
  fact.quality_flags
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.public_entities` AS entity
  USING (public_entity_id)
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS paragraph
  ON paragraph.classification_id = 'CZ_RS_PARAGRAPH_2025'
  AND paragraph.node_code = fact.functional_paragraph_code
  AND fact.fiscal_year BETWEEN paragraph.effective_from_year AND COALESCE(paragraph.effective_to_year, 9999)
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS item
  ON item.classification_id = 'CZ_RS_ITEM_2025'
  AND item.node_code = fact.economic_item_code
  AND fact.fiscal_year BETWEEN item.effective_from_year AND COALESCE(item.effective_to_year, 9999);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.municipal_budget_year_summary` AS
SELECT
  fact.public_entity_id,
  entity.entity_name,
  entity.national_entity_code AS ico,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.budget_stage,
  fact.currency_code,
  SUM(IF(fact.budget_side = 'revenue' AND NOT fact.is_consolidation_item, fact.amount_local, 0)) AS revenue_amount,
  SUM(IF(fact.budget_side = 'expenditure' AND NOT fact.is_consolidation_item, fact.amount_local, 0)) AS expenditure_amount,
  SUM(IF(fact.budget_side = 'financing' AND NOT fact.is_summary_row, fact.amount_local, 0)) AS financing_amount,
  SUM(IF(fact.budget_side = 'revenue' AND NOT fact.is_consolidation_item, fact.amount_local, 0))
    - SUM(IF(fact.budget_side = 'expenditure' AND NOT fact.is_consolidation_item, fact.amount_local, 0)) AS budget_balance
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.public_entities` AS entity
  USING (public_entity_id)
GROUP BY
  fact.public_entity_id,
  entity.entity_name,
  ico,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.budget_stage,
  fact.currency_code;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.international_municipal_budget_line_details` AS
SELECT
  fact.public_entity_id,
  entity.entity_name,
  entity.country_code_alpha3 AS country_code,
  entity.national_entity_code,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.budget_side,
  fact.functional_classification_id,
  fact.functional_paragraph_code,
  function_node.node_name_native AS functional_name_native,
  fact.economic_classification_id,
  fact.economic_item_code,
  economic_node.node_name_native AS economic_name_native,
  fact.amount_local,
  fact.currency_code,
  fact.coverage_type,
  fact.is_imputed,
  fact.source_id,
  fact.ingestion_run_id,
  fact.quality_flags
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.public_entities` AS entity
  USING (public_entity_id)
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS function_node
  ON function_node.classification_id = fact.functional_classification_id
  AND function_node.node_code = fact.functional_paragraph_code
  AND fact.fiscal_year BETWEEN function_node.effective_from_year AND COALESCE(function_node.effective_to_year, 9999)
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS economic_node
  ON economic_node.classification_id = fact.economic_classification_id
  AND economic_node.node_code = fact.economic_item_code
  AND fact.fiscal_year BETWEEN economic_node.effective_from_year AND COALESCE(economic_node.effective_to_year, 9999);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.regional_budget_line_details` AS
SELECT
  fact.country_code,
  fact.public_entity_id,
  region.name_native AS regional_government_name,
  region.government_type_code,
  region.tier_level,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.budget_side,
  fact.functional_classification_id,
  fact.functional_code,
  function_node.node_name_native AS functional_name_native,
  fact.economic_classification_id,
  fact.economic_code,
  economic_node.node_name_native AS economic_name_native,
  fact.amount_local,
  fact.currency_code,
  fact.is_consolidation_item,
  fact.is_summary_row,
  fact.coverage_type,
  fact.source_id,
  fact.ingestion_run_id,
  fact.quality_flags
FROM `czbudget-janrezab.budget_detail.regional_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.regional_governments` AS region
  ON region.public_entity_id = fact.public_entity_id
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS function_node
  ON function_node.classification_id = fact.functional_classification_id
  AND function_node.node_code = fact.functional_code
  AND fact.fiscal_year BETWEEN function_node.effective_from_year AND COALESCE(function_node.effective_to_year, 9999)
LEFT JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS economic_node
  ON economic_node.classification_id = fact.economic_classification_id
  AND economic_node.node_code = fact.economic_code
  AND fact.fiscal_year BETWEEN economic_node.effective_from_year AND COALESCE(economic_node.effective_to_year, 9999);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.regional_budget_year_summary` AS
SELECT
  fact.country_code,
  fact.public_entity_id,
  region.name_native AS regional_government_name,
  region.government_type_code,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.currency_code,
  SUM(IF(fact.budget_side = 'revenue', fact.amount_local, 0)) AS revenue_amount,
  SUM(IF(fact.budget_side = 'expenditure', fact.amount_local, 0)) AS expenditure_amount,
  SUM(IF(fact.budget_side = 'financing', fact.amount_local, 0)) AS financing_amount,
  SUM(IF(fact.budget_side = 'revenue', fact.amount_local, 0))
    - SUM(IF(fact.budget_side = 'expenditure', fact.amount_local, 0)) AS budget_balance
FROM `czbudget-janrezab.budget_detail.regional_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.regional_governments` AS region
  ON region.public_entity_id = fact.public_entity_id
WHERE NOT fact.is_summary_row
  AND NOT fact.is_consolidation_item
GROUP BY
  fact.country_code,
  fact.public_entity_id,
  regional_government_name,
  region.government_type_code,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.currency_code;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.regional_budget_canonical_facts` AS
SELECT
  fact.country_code,
  fact.public_entity_id,
  region.government_type_code,
  fact.fiscal_year,
  fact.fiscal_period,
  fact.reporting_scope,
  fact.budget_stage,
  fact.budget_side,
  category.taxonomy,
  category.canonical_category_id,
  category.category_code,
  category.category_name_cs,
  category.category_name_en,
  mapping.allocation_share,
  fact.amount_local * mapping.allocation_share AS mapped_amount_local,
  fact.currency_code,
  mapping.mapping_method,
  mapping.confidence,
  fact.source_id
FROM `czbudget-janrezab.budget_detail.regional_budget_line_facts` AS fact
JOIN `czbudget-janrezab.budget_detail.regional_governments` AS region
  ON region.public_entity_id = fact.public_entity_id
JOIN `czbudget-janrezab.budget_detail.budget_nodes` AS function_node
  ON function_node.classification_id = fact.functional_classification_id
  AND function_node.node_code = fact.functional_code
JOIN `czbudget-janrezab.budget_detail.budget_mappings` AS mapping
  ON mapping.budget_node_id = function_node.budget_node_id
  AND fact.fiscal_year BETWEEN mapping.valid_from_year AND COALESCE(mapping.valid_to_year, 9999)
JOIN `czbudget-janrezab.budget_detail.canonical_categories` AS category
  USING (canonical_category_id)
WHERE NOT fact.is_summary_row;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.regional_comparable_finance_details` AS
SELECT
  observation.country_code,
  observation.source_entity_id,
  entity.source_entity_code,
  entity.entity_name,
  entity.regional_tier_code,
  entity.canonical_regional_government_id,
  entity.crosswalk_status,
  observation.fiscal_year,
  observation.measure_code,
  observation.measure_name,
  observation.institutional_sector_code,
  observation.institutional_sector_name,
  observation.function_code,
  observation.function_name,
  observation.unit_code,
  observation.unit_name,
  observation.observation_value,
  observation.observation_status,
  observation.source_id
FROM `czbudget-janrezab.budget_detail.regional_comparable_finance_observations` AS observation
JOIN `czbudget-janrezab.budget_detail.regional_source_entities` AS entity
  USING (source_entity_id);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.city_latest_metrics` AS
SELECT
  public_entity_id AS city_id,
  metric_code,
  reference_year,
  value,
  unit,
  geography_code,
  geography_name,
  geography_scope,
  comparability_group,
  source_method,
  source_id,
  quality_flags
FROM `czbudget-janrezab.budget_detail.public_entity_metric_observations`
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY public_entity_id, metric_code
  ORDER BY reference_year DESC, loaded_at DESC
) = 1;

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.city_profiles` AS
WITH latest_budget AS (
  SELECT
    public_entity_id,
    fiscal_year,
    period_label,
    status,
    measure_code,
    reporting_scope,
    amount_local,
    currency_code,
    amount_eur,
    fx_date,
    comparability_notes
  FROM `czbudget-janrezab.budget_detail.public_entity_budget_headlines`
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY public_entity_id
    ORDER BY
      fiscal_year DESC,
      CASE budget_stage
        WHEN 'actual' THEN 1
        WHEN 'revised' THEN 2
        WHEN 'enacted' THEN 3
        ELSE 4
      END,
      loaded_at DESC
  ) = 1
), metric_pivot AS (
  SELECT
    city_id,
    MAX(IF(metric_code = 'population', value, NULL)) AS population,
    MAX(IF(metric_code = 'population', reference_year, NULL)) AS population_year,
    MAX(IF(metric_code = 'tourist_nights_total', value, NULL)) AS tourist_nights_total,
    MAX(IF(metric_code = 'tourist_nights_total', reference_year, NULL)) AS tourism_year,
    MAX(IF(metric_code = 'tourist_nights_nonresident_share_pct', value, NULL)) AS tourist_nights_nonresident_share_pct,
    MAX(IF(metric_code = 'tourist_nights_per_resident', value, NULL)) AS tourist_nights_per_resident
  FROM `czbudget-janrezab.budget_detail.city_latest_metrics`
  GROUP BY city_id
)
SELECT
  entity.public_entity_id AS city_id,
  entity.entity_name AS city_name,
  entity.country_code_alpha2,
  entity.country_code_alpha3,
  entity.national_entity_code,
  entity.national_entity_code_type,
  entity.is_eu_capital,
  entity.is_extra_city,
  budget.fiscal_year AS budget_year,
  budget.period_label AS budget_period_label,
  budget.status AS budget_status,
  budget.measure_code AS budget_measure_code,
  budget.reporting_scope AS budget_reporting_scope,
  budget.amount_local AS budget_amount_local,
  budget.currency_code AS budget_currency_code,
  budget.amount_eur AS budget_amount_eur,
  budget.fx_date,
  metric.population,
  metric.population_year,
  metric.tourist_nights_total,
  metric.tourism_year,
  metric.tourist_nights_nonresident_share_pct,
  metric.tourist_nights_per_resident,
  budget.comparability_notes
FROM `czbudget-janrezab.budget_detail.public_entities` AS entity
LEFT JOIN latest_budget AS budget USING (public_entity_id)
LEFT JOIN metric_pivot AS metric ON entity.public_entity_id = metric.city_id
WHERE entity.entity_type IN ('municipality', 'capital_city_authority', 'city_state', 'metropolitan_authority');

-- Government accountability layer. Geography, constitutional authority,
-- responsibility assignments and money flows are deliberately separate. A
-- geographic parent is not automatically a budget parent, and a received
-- transfer is not consolidation-matchable until both counterparties exist.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_accountability_sources` (
  source_id STRING NOT NULL,
  country_code STRING NOT NULL,
  source_type STRING NOT NULL,
  publisher STRING NOT NULL,
  title STRING NOT NULL,
  url STRING NOT NULL,
  supports ARRAY<STRING>,
  reviewed_at DATE NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, source_type, source_id
OPTIONS(description = 'Reviewed legal, methodological and financial sources for government accountability assignments.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_tiers` (
  tier_id STRING NOT NULL,
  country_code STRING NOT NULL,
  tier_code STRING NOT NULL,
  level INT64,
  name_cs STRING NOT NULL,
  name_en STRING NOT NULL,
  constitutional_type STRING NOT NULL,
  is_geographic_government BOOL NOT NULL,
  is_self_governing BOOL NOT NULL,
  is_elected BOOL NOT NULL,
  primary_legislative_power BOOL NOT NULL,
  subordinate_rulemaking_power BOOL NOT NULL,
  general_tax_rate_power BOOL NOT NULL,
  budget_approval_power BOOL NOT NULL,
  borrowing_power BOOL NOT NULL,
  asset_ownership_power BOOL NOT NULL,
  source_ids ARRAY<STRING>,
  valid_from DATE,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, tier_code, tier_id
OPTIONS(description = 'Versioned government tiers and their legal/fiscal powers; statistical areas are excluded unless they are actual governments.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_tier_relations` (
  relation_id STRING NOT NULL,
  country_code STRING NOT NULL,
  from_tier_id STRING NOT NULL,
  to_tier_id STRING NOT NULL,
  relation_type STRING NOT NULL,
  is_budget_parent BOOL NOT NULL,
  is_geographic_parent BOOL NOT NULL,
  note_cs STRING NOT NULL,
  note_en STRING NOT NULL,
  source_ids ARRAY<STRING>,
  valid_from DATE,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, from_tier_id, to_tier_id
OPTIONS(description = 'Relations between tiers with budget and geographic parenthood represented independently.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_entity_tier_assignments` (
  public_entity_id STRING NOT NULL,
  tier_id STRING NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_dual_role BOOL NOT NULL,
  source_id STRING NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY tier_id, public_entity_id
OPTIONS(description = 'Valid-time link from an accounting entity to a constitutional government tier; supports dual-role entities such as Prague.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_responsibility_assignments` (
  assignment_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  function_code STRING NOT NULL,
  function_name_cs STRING NOT NULL,
  function_name_en STRING NOT NULL,
  actor_id STRING NOT NULL,
  responsibility_role STRING NOT NULL OPTIONS(description = 'Atomic role such as sets_rules, funds, owns, commissions, delivers, supervises or audits'),
  legal_capacity STRING NOT NULL OPTIONS(description = 'Self-government, delegated state administration, national competence, social insurance or provider capacity'),
  source_ids ARRAY<STRING>,
  valid_from DATE NOT NULL,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, function_code, actor_id
OPTIONS(description = 'Atomic who-does-what assignments; financing, regulation, ownership, commissioning, delivery and oversight are never collapsed into one owner.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_revenue_instruments` (
  instrument_id STRING NOT NULL,
  country_code STRING NOT NULL,
  instrument_type STRING NOT NULL,
  name_cs STRING NOT NULL,
  name_en STRING NOT NULL,
  budget_category STRING NOT NULL,
  rate_setter_actor_id STRING NOT NULL,
  collector_actor_id STRING NOT NULL,
  allocator_actor_id STRING NOT NULL,
  recipient_tier_id STRING NOT NULL,
  allocation_basis STRING NOT NULL,
  earmarking STRING NOT NULL,
  regional_rate_discretion STRING NOT NULL,
  regional_use_discretion STRING NOT NULL,
  is_own_source_revenue BOOL NOT NULL,
  source_ids ARRAY<STRING>,
  valid_from DATE NOT NULL,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, recipient_tier_id, instrument_type
OPTIONS(description = 'Legal and operational authority over taxes, shared taxes, transfers, fees, property income and financing.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_accountability_mechanisms` (
  mechanism_id STRING NOT NULL,
  country_code STRING NOT NULL,
  answerable_actor_id STRING NOT NULL,
  forum_actor_id STRING NOT NULL,
  mechanism_type STRING NOT NULL,
  frequency STRING NOT NULL,
  scope STRING NOT NULL,
  source_ids ARRAY<STRING>,
  valid_from DATE NOT NULL,
  valid_to DATE,
  loaded_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, mechanism_type, answerable_actor_id
OPTIONS(description = 'Who must explain or justify action to whom, through elections, assemblies, audit, supervision, transparency or courts.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.intergovernmental_transfer_facts` (
  transfer_fact_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  budget_stage STRING NOT NULL,
  sender_public_entity_id STRING OPTIONS(description = 'Nullable only when the source publishes a mixed received total without counterparties'),
  recipient_public_entity_id STRING NOT NULL,
  transfer_program_id STRING,
  transfer_type STRING NOT NULL,
  earmarking STRING NOT NULL,
  amount_local NUMERIC NOT NULL,
  currency_code STRING NOT NULL,
  is_consolidation_matchable BOOL NOT NULL OPTIONS(description = 'TRUE only when payer, recipient, programme, period, stage and amount can be matched'),
  source_id STRING NOT NULL,
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, recipient_public_entity_id, sender_public_entity_id
OPTIONS(description = 'Intergovernmental money flows. Unknown counterparties remain explicit and may not be eliminated during consolidation.');

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.government_accountability_coverage` (
  coverage_id STRING NOT NULL,
  country_code STRING NOT NULL,
  fiscal_year INT64 NOT NULL,
  tier_id STRING NOT NULL,
  entity_expected_count INT64 NOT NULL,
  entity_loaded_count INT64 NOT NULL,
  budget_coverage STRING NOT NULL,
  responsibility_coverage STRING NOT NULL,
  transfer_counterparty_coverage STRING NOT NULL,
  validation_status STRING NOT NULL,
  limitations ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY country_code, tier_id
OPTIONS(description = 'Machine-readable completeness declaration so integrity cannot be confused with tier or counterparty coverage.');

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.government_responsibility_matrix` AS
SELECT
  assignment.country_code,
  assignment.fiscal_year,
  assignment.function_code,
  assignment.function_name_cs,
  assignment.function_name_en,
  assignment.actor_id,
  ARRAY_AGG(assignment.responsibility_role ORDER BY assignment.responsibility_role) AS responsibility_roles,
  ARRAY_AGG(DISTINCT assignment.legal_capacity ORDER BY assignment.legal_capacity) AS legal_capacities,
  ARRAY_CONCAT_AGG(assignment.source_ids) AS source_ids
FROM `czbudget-janrezab.budget_detail.government_responsibility_assignments` AS assignment
GROUP BY
  assignment.country_code,
  assignment.fiscal_year,
  assignment.function_code,
  assignment.function_name_cs,
  assignment.function_name_en,
  assignment.actor_id;
