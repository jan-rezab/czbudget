#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
input_dir="${3:-$(cd "$(dirname "$0")/../../.." && pwd)/outputs/oecd-regofi}"
pipeline_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -s "$input_dir/oecd_regofi_manifest.json" ]]; then
  echo "Missing oecd_regofi_manifest.json in $input_dir" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$pipeline_root/warehouse/schema.sql"

load_stage() {
  local table_name="$1"
  local file="$input_dir/${table_name}.jsonl.gz"
  local stage_name="_regofi_load_${table_name}"
  if [[ ! -s "$file" ]]; then
    echo "Missing $file" >&2
    exit 1
  fi
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\`
     LIKE \`${project_id}.${dataset_id}.${table_name}\`"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$file"
}

load_stage regional_source_entities
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_source_entities\` AS target
WHERE EXISTS (
  SELECT 1
  FROM \`${project_id}.${dataset_id}._regofi_load_regional_source_entities\` AS source
  WHERE target.source_entity_id = source.source_entity_id
);
INSERT INTO \`${project_id}.${dataset_id}.regional_source_entities\` (
  source_entity_id, source_id, source_entity_code, entity_name, country_code,
  regional_tier_code, institutional_sector_code, institutional_sector_name,
  first_observation_year, last_observation_year, canonical_regional_government_id,
  crosswalk_status, source_id_namespace, loaded_at
)
SELECT
  source_entity_id, source_id, source_entity_code, entity_name, country_code,
  regional_tier_code, institutional_sector_code, institutional_sector_name,
  first_observation_year, last_observation_year, canonical_regional_government_id,
  crosswalk_status, source_id_namespace, loaded_at
FROM \`${project_id}.${dataset_id}._regofi_load_regional_source_entities\`;
DROP TABLE \`${project_id}.${dataset_id}._regofi_load_regional_source_entities\`;"

load_stage regional_comparable_finance_observations
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_comparable_finance_observations\` AS target
WHERE target.fiscal_year BETWEEN 2000 AND 2100
  AND target.source_id IN (
    SELECT DISTINCT source_id
    FROM \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_observations\`
    WHERE fiscal_year BETWEEN 2000 AND 2100
  );
INSERT INTO \`${project_id}.${dataset_id}.regional_comparable_finance_observations\` (
  source_entity_id, country_code, fiscal_year, measure_code, measure_name,
  institutional_sector_code, institutional_sector_name, function_code,
  function_name, unit_code, unit_name, observation_value, observation_status,
  unit_multiplier_code, confidentiality_status, decimals_code, source_id,
  ingestion_run_id, loaded_at
)
SELECT
  source_entity_id, country_code, fiscal_year, measure_code, measure_name,
  institutional_sector_code, institutional_sector_name, function_code,
  function_name, unit_code, unit_name, observation_value, observation_status,
  unit_multiplier_code, confidentiality_status, decimals_code, source_id,
  ingestion_run_id, loaded_at
FROM \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_observations\`
WHERE fiscal_year BETWEEN 2000 AND 2100;
DROP TABLE \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_observations\`;"

load_stage regional_comparable_finance_coverage
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_comparable_finance_coverage\` AS target
WHERE target.fiscal_year BETWEEN 2000 AND 2100
  AND target.source_id IN (
    SELECT DISTINCT source_id
    FROM \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_coverage\`
    WHERE fiscal_year BETWEEN 2000 AND 2100
  );
INSERT INTO \`${project_id}.${dataset_id}.regional_comparable_finance_coverage\` (
  coverage_id, source_id, country_code, fiscal_year, regional_tier_code,
  entity_source_count, observation_count, non_null_observation_count,
  measure_count, function_count, coverage_type, validation_status,
  limitations, assessed_at
)
SELECT
  coverage_id, source_id, country_code, fiscal_year, regional_tier_code,
  entity_source_count, observation_count, non_null_observation_count,
  measure_count, function_count, coverage_type, validation_status,
  limitations, assessed_at
FROM \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_coverage\`
WHERE fiscal_year BETWEEN 2000 AND 2100;
DROP TABLE \`${project_id}.${dataset_id}._regofi_load_regional_comparable_finance_coverage\`;"

load_stage public_entity_sources
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entity_sources\` AS target
WHERE EXISTS (
  SELECT 1
  FROM \`${project_id}.${dataset_id}._regofi_load_public_entity_sources\` AS source
  WHERE target.source_id = source.source_id
    AND target.public_entity_id IS NOT DISTINCT FROM source.public_entity_id
);
INSERT INTO \`${project_id}.${dataset_id}.public_entity_sources\` (
  source_id, public_entity_id, source_type, source_name, source_url, dataset_code,
  archive_file, archive_sha256, retrieved_at, notes, loaded_at
)
SELECT
  source_id, public_entity_id, source_type, source_name, source_url, dataset_code,
  archive_file, archive_sha256, retrieved_at, notes, loaded_at
FROM \`${project_id}.${dataset_id}._regofi_load_public_entity_sources\`;
DROP TABLE \`${project_id}.${dataset_id}._regofi_load_public_entity_sources\`;"

load_stage ingestion_runs
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.ingestion_runs\` AS target
WHERE DATE(target.started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
  AND target.ingestion_run_id IN (
    SELECT ingestion_run_id
    FROM \`${project_id}.${dataset_id}._regofi_load_ingestion_runs\`
    WHERE DATE(started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
  );
INSERT INTO \`${project_id}.${dataset_id}.ingestion_runs\` (
  ingestion_run_id, source_id, started_at, completed_at, status, source_vintage,
  source_sha256, rows_read, rows_loaded, warning_count, error_message
)
SELECT
  ingestion_run_id, source_id, started_at, completed_at, status, source_vintage,
  source_sha256, rows_read, rows_loaded, warning_count, error_message
FROM \`${project_id}.${dataset_id}._regofi_load_ingestion_runs\`
WHERE DATE(started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31';
DROP TABLE \`${project_id}.${dataset_id}._regofi_load_ingestion_runs\`;"

echo "Loaded OECD/EU REGOFI bundle from $input_dir"
