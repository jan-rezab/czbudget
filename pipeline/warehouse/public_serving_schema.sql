-- Rebuildable serving layer for public municipality profiles.
--
-- The normalized fact tables remain the analytical source of truth. This table
-- stores the exact public profile contract produced from those facts (or from a
-- reviewed legacy profile while that source is being normalized). It lets data
-- releases move independently from the application image without turning raw
-- fact tables into a request-time web backend.

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_profile_snapshots` (
  profile_id STRING NOT NULL,
  country_code STRING NOT NULL,
  entity_code STRING NOT NULL,
  country_slug STRING NOT NULL,
  profile_slug STRING NOT NULL,
  canonical_path STRING NOT NULL,
  entity_name STRING NOT NULL,
  currency_code STRING,
  first_year INT64,
  latest_year INT64,
  source_kind STRING NOT NULL,
  source_url STRING,
  profile_payload JSON NOT NULL,
  history_payload JSON,
  payload_sha256 STRING NOT NULL,
  payload_bytes INT64 NOT NULL,
  nested_record_count INT64 NOT NULL,
  release_id STRING NOT NULL,
  generated_at TIMESTAMP NOT NULL
)
CLUSTER BY country_code, country_slug, profile_slug
OPTIONS(
  description = 'Current rebuildable public profile payloads; one row per canonical municipality route.'
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_dataset_inventory` (
  release_id STRING NOT NULL,
  dataset_id STRING NOT NULL,
  metric_scope STRING NOT NULL,
  country_code STRING,
  profile_count INT64 NOT NULL,
  nested_record_count INT64 NOT NULL,
  payload_bytes INT64 NOT NULL,
  validated_fact_count INT64,
  validation_status STRING NOT NULL,
  source_kind STRING NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  notes STRING
)
CLUSTER BY metric_scope, country_code, dataset_id
OPTIONS(
  description = 'Canonical coverage and scale inventory used to generate public coverage metrics.'
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.public_serving_releases` (
  release_id STRING NOT NULL,
  profile_count INT64 NOT NULL,
  nested_record_count INT64 NOT NULL,
  payload_bytes INT64 NOT NULL,
  route_index_sha256 STRING NOT NULL,
  manifest_sha256 STRING NOT NULL,
  published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id
OPTIONS(
  description = 'Append-only audit ledger for immutable public snapshot releases.'
);

CREATE OR REPLACE VIEW `czbudget-janrezab.budget_detail.public_profile_coverage` AS
SELECT
  country_code,
  COUNT(*) AS profile_count,
  SUM(nested_record_count) AS nested_record_count,
  SUM(payload_bytes) AS payload_bytes,
  MIN(first_year) AS first_year,
  MAX(latest_year) AS latest_year,
  ARRAY_AGG(DISTINCT source_kind ORDER BY source_kind) AS source_kinds,
  ARRAY_AGG(release_id ORDER BY generated_at DESC LIMIT 1)[OFFSET(0)] AS release_id,
  MAX(generated_at) AS generated_at
FROM `czbudget-janrezab.budget_detail.public_profile_snapshots`
GROUP BY country_code;
