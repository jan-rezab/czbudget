-- Canonical current-vs-cumulative coverage numbers for the public coverage UI.
-- Do not derive these by summing bundle manifests: one bundle can be referenced
-- by multiple countries and historical releases can overlap current rows.

WITH current_release AS (
  SELECT release_id
  FROM `czbudget-janrezab.budget_detail.public_dataset_inventory`
  ORDER BY generated_at DESC
  LIMIT 1
),
inventory AS (
  SELECT inventory.*
  FROM `czbudget-janrezab.budget_detail.public_dataset_inventory` AS inventory
  JOIN current_release USING (release_id)
)
SELECT
  MAX(IF(metric_scope = 'cumulative', nested_record_count, NULL)) AS cumulative_structured_rows_processed,
  MAX(IF(metric_scope = 'global', validated_fact_count, NULL)) AS current_validated_financial_facts,
  MAX(IF(metric_scope = 'global', profile_count, NULL)) AS current_public_profiles,
  MAX(IF(metric_scope = 'global', nested_record_count, NULL)) AS current_public_profile_nested_records,
  MAX(IF(metric_scope = 'global', payload_bytes, NULL)) AS current_public_profile_payload_bytes,
  ANY_VALUE(release_id) AS release_id,
  MAX(generated_at) AS generated_at
FROM inventory;
