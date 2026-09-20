-- Copy a uniquely named raw Parquet load table into durable exact-run staging.
-- Required named parameters: source_id, ingestion_run_id, expected_year.
DECLARE stage_source_id STRING DEFAULT @source_id;
DECLARE stage_run_id STRING DEFAULT @ingestion_run_id;
DECLARE stage_year INT64 DEFAULT @expected_year;

DELETE FROM `czbudget-janrezab.budget_detail._us_census_budget_fact_stage`
WHERE fiscal_year = stage_year
  AND source_id = stage_source_id
  AND ingestion_run_id = stage_run_id;

INSERT INTO `czbudget-janrezab.budget_detail._us_census_budget_fact_stage`
SELECT
  source_id, stage_run_id, public_entity_id, census_government_id, city_slug, city_name,
  state, census_entity_name, pid_population, pid_population_year, fiscal_year_ending,
  fiscal_year, fiscal_period, reporting_scope, budget_stage, budget_side,
  economic_item_code, amount_local, currency_code, imputation_flag, is_imputed,
  source_row_number, source_sheet, source_line_sha256, raw_sha256, source_url,
  TIMESTAMP(retrieved_at), coverage_type, CURRENT_TIMESTAMP()
FROM `czbudget-janrezab.budget_detail._us_census_budget_load`
WHERE source_id = stage_source_id AND fiscal_year = stage_year;

ASSERT (
  SELECT COUNT(*) > 0
  FROM `czbudget-janrezab.budget_detail._us_census_budget_fact_stage`
  WHERE fiscal_year = stage_year AND source_id = stage_source_id AND ingestion_run_id = stage_run_id
) AS 'No Census rows staged';
