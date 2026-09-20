-- Promote one validated Census individual-unit source/run into standardized facts.
-- Required named parameters: source_id, ingestion_run_id, expected_year,
-- expected_entities. Never infer a latest run.
DECLARE promote_source_id STRING DEFAULT @source_id;
DECLARE promote_run_id STRING DEFAULT @ingestion_run_id;
DECLARE promote_year INT64 DEFAULT @expected_year;
DECLARE promote_entities INT64 DEFAULT @expected_entities;

CREATE TEMP TABLE selected_stage AS
SELECT *
FROM `czbudget-janrezab.budget_detail._us_census_budget_fact_stage`
WHERE fiscal_year = promote_year
  AND source_id = promote_source_id
  AND ingestion_run_id = promote_run_id;

ASSERT (SELECT COUNT(*) FROM selected_stage) > 0 AS 'Exact Census source/run has no staged rows';
ASSERT (SELECT COUNT(DISTINCT public_entity_id) FROM selected_stage) = promote_entities
  AS 'Census target-city count does not match the reviewed registry';
ASSERT (SELECT COUNT(DISTINCT fiscal_year) = 1 AND MIN(fiscal_year) = promote_year FROM selected_stage)
  AS 'Census stage contains the wrong fiscal year';
ASSERT (
  SELECT COUNT(*) = COUNT(DISTINCT CONCAT(public_entity_id, '\x1f', economic_item_code))
  FROM selected_stage
) AS 'Duplicate entity/item rows in exact Census source/run';
ASSERT (
  SELECT COUNT(*) = 0 FROM selected_stage
  WHERE budget_side NOT IN ('revenue', 'expenditure')
     OR currency_code != 'USD'
     OR NOT REGEXP_CONTAINS(census_government_id, r'^\d{12}$')
) AS 'Invalid standardized Census fact';

MERGE `czbudget-janrezab.budget_detail.public_entities` AS target
USING (
  SELECT DISTINCT public_entity_id, city_name, census_government_id, state
  FROM selected_stage
) AS source
ON target.public_entity_id = source.public_entity_id
WHEN MATCHED THEN UPDATE SET
  entity_name = source.city_name,
  national_entity_code = source.census_government_id,
  national_entity_code_type = 'US_CENSUS_GOV_ID',
  administrative_region_code = source.state,
  loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  public_entity_id, entity_name, entity_type, country_code_alpha2, country_code_alpha3,
  national_entity_code, national_entity_code_type, is_eu_capital, is_extra_city,
  default_currency_code, administrative_region_code, loaded_at
) VALUES (
  source.public_entity_id, source.city_name, 'municipality', 'US', 'USA',
  source.census_government_id, 'US_CENSUS_GOV_ID', FALSE, TRUE, 'USD', source.state,
  CURRENT_TIMESTAMP()
);

MERGE `czbudget-janrezab.budget_detail.public_entity_aliases` AS target
USING (
  SELECT DISTINCT census_government_id, public_entity_id, city_name, source_id, source_url
  FROM selected_stage
) AS source
ON target.alias_system = 'US_CENSUS_GOV_ID'
 AND target.alias_value = source.census_government_id
 AND target.public_entity_id = source.public_entity_id
WHEN MATCHED THEN UPDATE SET
  alias_label = source.city_name, source_id = source.source_id,
  evidence_url = source.source_url, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  alias_system, alias_value, public_entity_id, alias_label, source_id, evidence_url, loaded_at
) VALUES (
  'US_CENSUS_GOV_ID', source.census_government_id, source.public_entity_id,
  source.city_name, source.source_id, source.source_url, CURRENT_TIMESTAMP()
);

DELETE FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
WHERE fiscal_year = promote_year
  AND source_id = promote_source_id
  AND ingestion_run_id = promote_run_id;

INSERT INTO `czbudget-janrezab.budget_detail.municipal_budget_line_facts` (
  public_entity_id, fiscal_year, fiscal_period, reporting_scope, budget_stage, budget_side,
  source_budget_item_type_code, functional_paragraph_code, economic_item_code,
  functional_classification_id, economic_classification_id, amount_local, currency_code,
  amount_eur, fx_date, is_consolidation_item, is_financing, is_summary_row,
  source_row_number, source_sheet, source_id, ingestion_run_id, coverage_type,
  is_imputed, quality_flags, loaded_at
)
SELECT
  public_entity_id, fiscal_year, fiscal_period, reporting_scope, budget_stage, budget_side,
  NULLIF(imputation_flag, ''), NULL, economic_item_code,
  NULL, CONCAT('US_CENSUS_GOV_FINANCE_', CAST(fiscal_year AS STRING)),
  CAST(amount_local AS NUMERIC), currency_code,
  NULL, NULL, FALSE, FALSE, FALSE,
  source_row_number, source_sheet, source_id, ingestion_run_id, coverage_type,
  is_imputed,
  ARRAY_CONCAT(
    ['official_us_census_individual_unit', 'source_unit_usd_thousands_scaled_to_usd',
     CONCAT('source_line_sha256:', source_line_sha256), CONCAT('raw_sha256:', raw_sha256)],
    IF(NULLIF(imputation_flag, '') IS NULL, [], [CONCAT('census_data_flag:', imputation_flag)]),
    IF(amount_local < 0, ['negative_reported_amount'], [])
  ),
  CURRENT_TIMESTAMP()
FROM selected_stage;

ASSERT (
  SELECT COUNT(*) = (SELECT COUNT(*) FROM selected_stage)
  FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
  WHERE fiscal_year = promote_year
    AND source_id = promote_source_id
    AND ingestion_run_id = promote_run_id
) AS 'Promoted Census row count does not reconcile';

SELECT fiscal_year, COUNT(*) AS fact_rows, COUNT(DISTINCT public_entity_id) AS entities,
       COUNTIF(is_imputed) AS imputed_rows,
       SUM(IF(budget_side = 'revenue', amount_local, 0)) AS revenue_amount,
       SUM(IF(budget_side = 'expenditure', amount_local, 0)) AS expenditure_amount
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
WHERE fiscal_year = promote_year
  AND source_id = promote_source_id
  AND ingestion_run_id = promote_run_id
GROUP BY fiscal_year;
