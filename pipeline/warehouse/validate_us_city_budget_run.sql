-- Read-only validation for one exact native-budget source/run.
DECLARE validate_source_id STRING DEFAULT @source_id;
DECLARE validate_run_id STRING DEFAULT @ingestion_run_id;

ASSERT validate_source_id IS NOT NULL AND LENGTH(TRIM(validate_source_id)) > 0 AS 'source_id must be explicit';
ASSERT validate_run_id IS NOT NULL AND LENGTH(TRIM(validate_run_id)) > 0 AS 'ingestion_run_id must be explicit';

ASSERT (
  SELECT COUNT(*) > 0
  FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
  WHERE fiscal_year BETWEEN 1900 AND 2100 AND source_id = validate_source_id AND ingestion_run_id = validate_run_id
) AS 'No promoted facts for exact source/run';

ASSERT (
  SELECT COUNT(*) = COUNT(DISTINCT fact_id)
  FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
  WHERE fiscal_year BETWEEN 1900 AND 2100 AND source_id = validate_source_id AND ingestion_run_id = validate_run_id
) AS 'Duplicate fact IDs';

ASSERT (
  SELECT COUNT(*) = 0
  FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
  WHERE fiscal_year BETWEEN 1900 AND 2100 AND source_id = validate_source_id AND ingestion_run_id = validate_run_id
    AND (source_line_sha256 IS NULL OR snapshot_id IS NULL OR source_url IS NULL)
) AS 'Incomplete source-line lineage';

SELECT public_entity_id, fiscal_year, budget_stage, budget_side, measure_type, view_id,
       additive_group_id, is_additive, COUNT(*) AS fact_rows,
       SUM(IF(is_additive AND NOT is_summary_row, measure_value, NULL)) AS additive_value
FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
WHERE fiscal_year BETWEEN 1900 AND 2100 AND source_id = validate_source_id AND ingestion_run_id = validate_run_id
GROUP BY public_entity_id, fiscal_year, budget_stage, budget_side, measure_type, view_id,
         additive_group_id, is_additive
ORDER BY public_entity_id, fiscal_year, budget_stage, budget_side, view_id, additive_group_id;
