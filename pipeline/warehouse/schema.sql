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
  quality_flags ARRAY<STRING>,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(fiscal_year, GENERATE_ARRAY(2000, 2101, 1))
CLUSTER BY public_entity_id, budget_stage, functional_paragraph_code, economic_item_code
OPTIONS(description = 'Detailed municipal budget facts at entity × year/period × stage × paragraph × item grain.');

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
  ADD COLUMN IF NOT EXISTS is_summary_row BOOL;

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts`
  ADD COLUMN IF NOT EXISTS statement_line_code STRING,
  ADD COLUMN IF NOT EXISTS balance_measure STRING,
  ADD COLUMN IF NOT EXISTS source_row_number INT64,
  ADD COLUMN IF NOT EXISTS source_sheet STRING;

ALTER TABLE `czbudget-janrezab.budget_detail.public_entity_cash_facts`
  ADD COLUMN IF NOT EXISTS source_row_number INT64,
  ADD COLUMN IF NOT EXISTS source_sheet STRING;

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
