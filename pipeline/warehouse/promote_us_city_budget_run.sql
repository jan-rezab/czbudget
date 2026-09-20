-- Promote one already-validated native city budget run.
-- Pass these as BigQuery named query parameters. Never infer "latest".
DECLARE promote_source_id STRING DEFAULT @source_id;
DECLARE promote_run_id STRING DEFAULT @ingestion_run_id;

ASSERT promote_source_id IS NOT NULL AND LENGTH(TRIM(promote_source_id)) > 0
  AS 'source_id must be explicit';
ASSERT promote_run_id IS NOT NULL AND LENGTH(TRIM(promote_run_id)) > 0
  AS 'ingestion_run_id must be explicit';

CREATE TEMP TABLE selected_stage AS
SELECT *
FROM `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage`
WHERE fiscal_year BETWEEN 1900 AND 2100
  AND source_id = promote_source_id
  AND ingestion_run_id = promote_run_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY fact_id ORDER BY retrieved_at DESC, loaded_at DESC) = 1;

ASSERT (SELECT COUNT(*) FROM selected_stage) > 0 AS 'Exact source/run has no staged rows';
ASSERT (SELECT COUNT(*) = COUNT(DISTINCT fact_id) FROM selected_stage) AS 'Duplicate fact_id in selected run';
ASSERT (
  SELECT COUNT(*) = 0 FROM selected_stage
  WHERE TO_HEX(SHA256(TO_JSON_STRING(fact_identity))) != fact_id
) AS 'fact_id does not match canonical fact_identity';
ASSERT (
  SELECT COUNT(*) = 0 FROM selected_stage
  WHERE TO_HEX(SHA256(TO_JSON_STRING(native_dimensions))) != native_dimension_signature
) AS 'native_dimension_signature mismatch';
ASSERT (
  SELECT COUNT(*) = 0 FROM selected_stage
  WHERE measure_type = 'currency_amount' AND currency_code IS NULL
) AS 'Currency facts require currency_code';
ASSERT (
  SELECT COUNT(*) = 0 FROM selected_stage
  WHERE is_additive = FALSE AND NULLIF(TRIM(non_additive_reason), '') IS NULL
) AS 'Non-additive facts require a reason';
ASSERT (
  SELECT COUNT(*) = 0
  FROM selected_stage AS staged
  LEFT JOIN `czbudget-janrezab.budget_detail.municipal_source_snapshots` AS snapshot
    ON snapshot.source_id = staged.source_id
   AND snapshot.ingestion_run_id = staged.ingestion_run_id
   AND snapshot.snapshot_id = staged.snapshot_id
  WHERE snapshot.snapshot_id IS NULL
) AS 'Every staged fact must reference its exact source snapshot';

MERGE `czbudget-janrezab.budget_detail.municipal_native_budget_facts` AS target
USING selected_stage AS source
ON target.fiscal_year BETWEEN 1900 AND 2100
 AND target.fact_id = source.fact_id
WHEN MATCHED AND target.source_id = promote_source_id
  AND target.ingestion_run_id = promote_run_id THEN UPDATE SET
  public_entity_id = source.public_entity_id,
  fact_identity = source.fact_identity,
  fiscal_period = source.fiscal_period,
  period_start = source.period_start,
  period_end = source.period_end,
  reporting_scope = source.reporting_scope,
  budget_stage = source.budget_stage,
  budget_side = source.budget_side,
  measure_type = source.measure_type,
  measure_value = source.measure_value,
  measure_unit = source.measure_unit,
  currency_code = source.currency_code,
  amount_scale = source.amount_scale,
  native_dimensions = source.native_dimensions,
  native_dimension_signature = source.native_dimension_signature,
  native_line_code = source.native_line_code,
  native_line_name = source.native_line_name,
  parent_native_line_code = source.parent_native_line_code,
  view_id = source.view_id,
  additive_group_id = source.additive_group_id,
  is_additive = source.is_additive,
  non_additive_reason = source.non_additive_reason,
  is_summary_row = source.is_summary_row,
  snapshot_id = source.snapshot_id,
  source_row_number = source.source_row_number,
  source_sheet = source.source_sheet,
  source_record_id = source.source_record_id,
  source_line_locator = source.source_line_locator,
  source_line_sha256 = source.source_line_sha256,
  source_url = source.source_url,
  retrieved_at = source.retrieved_at,
  coverage_type = source.coverage_type,
  is_imputed = source.is_imputed,
  quality_flags = source.quality_flags,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT ROW;

ASSERT (
  SELECT COUNT(*) = (SELECT COUNT(*) FROM selected_stage)
  FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
  WHERE fiscal_year BETWEEN 1900 AND 2100
    AND source_id = promote_source_id
    AND ingestion_run_id = promote_run_id
) AS 'Promoted target row count does not reconcile to selected stage';

ASSERT (
  SELECT COUNT(*) = 0 FROM (
    SELECT fact_id
    FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
    WHERE fiscal_year BETWEEN 1900 AND 2100
      AND source_id = promote_source_id
      AND ingestion_run_id = promote_run_id
    GROUP BY fact_id HAVING COUNT(*) != 1
  )
) AS 'Promoted fact IDs must be unique in the exact source/run';

SELECT promote_source_id AS source_id, promote_run_id AS ingestion_run_id,
       COUNT(*) AS promoted_rows, COUNT(DISTINCT public_entity_id) AS entities,
       COUNT(DISTINCT snapshot_id) AS snapshots
FROM `czbudget-janrezab.budget_detail.municipal_native_budget_facts`
WHERE fiscal_year BETWEEN 1900 AND 2100
  AND source_id = promote_source_id
  AND ingestion_run_id = promote_run_id;
