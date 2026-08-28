-- Full-refresh the small serving layer after staging files have passed local
-- validation. The fact warehouse is not modified by this transaction.

BEGIN TRANSACTION;

DELETE FROM `czbudget-janrezab.budget_detail.public_profile_snapshots` WHERE TRUE;
INSERT INTO `czbudget-janrezab.budget_detail.public_profile_snapshots` (
  profile_id,
  country_code,
  entity_code,
  country_slug,
  profile_slug,
  canonical_path,
  entity_name,
  currency_code,
  first_year,
  latest_year,
  source_kind,
  source_url,
  profile_payload,
  history_payload,
  payload_sha256,
  payload_bytes,
  nested_record_count,
  release_id,
  generated_at
)
SELECT
  profile_id,
  country_code,
  entity_code,
  country_slug,
  profile_slug,
  canonical_path,
  entity_name,
  currency_code,
  first_year,
  latest_year,
  source_kind,
  source_url,
  profile_payload,
  history_payload,
  payload_sha256,
  payload_bytes,
  nested_record_count,
  release_id,
  generated_at
FROM `czbudget-janrezab.budget_detail._public_profile_snapshots_stage`;

DELETE FROM `czbudget-janrezab.budget_detail.public_dataset_inventory` WHERE TRUE;
INSERT INTO `czbudget-janrezab.budget_detail.public_dataset_inventory` (
  release_id,
  dataset_id,
  metric_scope,
  country_code,
  profile_count,
  nested_record_count,
  payload_bytes,
  validated_fact_count,
  validation_status,
  source_kind,
  generated_at,
  notes
)
SELECT
  release_id,
  dataset_id,
  metric_scope,
  country_code,
  profile_count,
  nested_record_count,
  payload_bytes,
  validated_fact_count,
  validation_status,
  source_kind,
  generated_at,
  notes
FROM `czbudget-janrezab.budget_detail._public_dataset_inventory_stage`;

COMMIT TRANSACTION;
