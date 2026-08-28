#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
input_dir="${3:-$(cd "$(dirname "$0")/../../.." && pwd)/outputs/international-regional}"
pipeline_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -s "$input_dir/international_regional_manifest.json" ]]; then
  echo "Missing international_regional_manifest.json in $input_dir" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$pipeline_root/warehouse/schema.sql"

source_file() {
  local table_name="$1"
  if [[ -s "$input_dir/${table_name}.jsonl.gz" ]]; then
    printf '%s\n' "$input_dir/${table_name}.jsonl.gz"
  else
    printf '%s\n' "$input_dir/${table_name}.jsonl"
  fi
}

load_stage() {
  local table_name="$1"
  local file
  file="$(source_file "$table_name")"
  if [[ ! -s "$file" ]]; then
    return 1
  fi
  local stage_name="_regional_load_${table_name}"
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\`
     LIKE \`${project_id}.${dataset_id}.${table_name}\`"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$file"
}

load_stage public_entities
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entities\` AS target
WHERE EXISTS (
  SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_public_entities\` AS source
  WHERE target.public_entity_id = source.public_entity_id
);
INSERT INTO \`${project_id}.${dataset_id}.public_entities\` (
  public_entity_id, entity_name, entity_type, country_code_alpha2, country_code_alpha3,
  national_entity_code, national_entity_code_type, is_eu_capital, is_extra_city,
  default_currency_code, eurostat_city_code, eurostat_geography_name,
  administrative_region_code, administrative_region_name, administrative_district_code,
  administrative_district_name, national_geography_code, national_geography_code_type,
  valid_from, valid_to, loaded_at
)
SELECT
  public_entity_id, entity_name, entity_type, country_code_alpha2, country_code_alpha3,
  national_entity_code, national_entity_code_type, is_eu_capital, is_extra_city,
  default_currency_code, eurostat_city_code, eurostat_geography_name,
  administrative_region_code, administrative_region_name, administrative_district_code,
  administrative_district_name, national_geography_code, national_geography_code_type,
  valid_from, valid_to, loaded_at
FROM \`${project_id}.${dataset_id}._regional_load_public_entities\`;
DROP TABLE \`${project_id}.${dataset_id}._regional_load_public_entities\`;"

load_stage regional_governments
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_governments\` AS target
WHERE EXISTS (
  SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_regional_governments\` AS source
  WHERE target.regional_government_id = source.regional_government_id
    AND target.valid_from IS NOT DISTINCT FROM source.valid_from
);
INSERT INTO \`${project_id}.${dataset_id}.regional_governments\` (
  regional_government_id, public_entity_id, country_code, national_region_code,
  national_region_code_type, government_type_code, tier_level, name_native, name_en,
  name_cs, nuts_code, parent_regional_government_id, is_capital_region, valid_from,
  valid_to, source_id, loaded_at
)
SELECT
  regional_government_id, public_entity_id, country_code, national_region_code,
  national_region_code_type, government_type_code, tier_level, name_native, name_en,
  name_cs, nuts_code, parent_regional_government_id, is_capital_region, valid_from,
  valid_to, source_id, loaded_at
FROM \`${project_id}.${dataset_id}._regional_load_regional_governments\`;
DROP TABLE \`${project_id}.${dataset_id}._regional_load_regional_governments\`;"

load_stage public_entity_sources
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entity_sources\` AS target
WHERE EXISTS (
  SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_public_entity_sources\` AS source
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
FROM \`${project_id}.${dataset_id}._regional_load_public_entity_sources\`;
DROP TABLE \`${project_id}.${dataset_id}._regional_load_public_entity_sources\`;"

if load_stage classification_versions; then
  bq query --project_id="$project_id" --use_legacy_sql=false "
  DELETE FROM \`${project_id}.${dataset_id}.classification_versions\` AS target
  WHERE EXISTS (
    SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_classification_versions\` AS source
    WHERE target.classification_id = source.classification_id
  );
  INSERT INTO \`${project_id}.${dataset_id}.classification_versions\` (
    classification_id, country_code, budget_side, government_scope,
    valid_from_year, valid_to_year, classification_name, legal_basis,
    source_url, notes, loaded_at
  )
  SELECT
    classification_id, country_code, budget_side, government_scope,
    valid_from_year, valid_to_year, classification_name, legal_basis,
    source_url, notes, loaded_at
  FROM \`${project_id}.${dataset_id}._regional_load_classification_versions\`;
  DROP TABLE \`${project_id}.${dataset_id}._regional_load_classification_versions\`;"
fi

if load_stage budget_nodes; then
  bq query --project_id="$project_id" --use_legacy_sql=false "
  DELETE FROM \`${project_id}.${dataset_id}.budget_nodes\` AS target
  WHERE EXISTS (
    SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_budget_nodes\` AS source
    WHERE target.budget_node_id = source.budget_node_id
  );
  INSERT INTO \`${project_id}.${dataset_id}.budget_nodes\` (
    budget_node_id, classification_id, country_code, budget_side,
    government_scope, node_code, node_name_native, node_name_en, node_name_cs,
    parent_budget_node_id, hierarchy_level, hierarchy_path, is_chapter,
    effective_from_year, effective_to_year, loaded_at
  )
  SELECT
    budget_node_id, classification_id, country_code, budget_side,
    government_scope, node_code, node_name_native, node_name_en, node_name_cs,
    parent_budget_node_id, hierarchy_level, hierarchy_path, is_chapter,
    effective_from_year, effective_to_year, loaded_at
  FROM \`${project_id}.${dataset_id}._regional_load_budget_nodes\`;
  DROP TABLE \`${project_id}.${dataset_id}._regional_load_budget_nodes\`;"
fi

if load_stage raw_budget_lines; then
  bq query --project_id="$project_id" --use_legacy_sql=false "
  DELETE FROM \`${project_id}.${dataset_id}.raw_budget_lines\` AS target
  WHERE target.fiscal_year BETWEEN 2000 AND 2100
    AND target.ingestion_run_id IN (
      SELECT DISTINCT ingestion_run_id
      FROM \`${project_id}.${dataset_id}._regional_load_raw_budget_lines\`
      WHERE fiscal_year BETWEEN 2000 AND 2100
    );
  INSERT INTO \`${project_id}.${dataset_id}.raw_budget_lines\` (
    country_code, fiscal_year, source_id, ingestion_run_id, source_row_number,
    source_sheet, source_payload, source_url, loaded_at
  )
  SELECT
    country_code, fiscal_year, source_id, ingestion_run_id, source_row_number,
    source_sheet, source_payload, source_url, loaded_at
  FROM \`${project_id}.${dataset_id}._regional_load_raw_budget_lines\`
  WHERE fiscal_year BETWEEN 2000 AND 2100;
  DROP TABLE \`${project_id}.${dataset_id}._regional_load_raw_budget_lines\`;"
fi

load_stage regional_budget_line_facts
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_budget_line_facts\` AS target
WHERE target.fiscal_year BETWEEN 2000 AND 2100
  AND target.ingestion_run_id IN (
    SELECT DISTINCT ingestion_run_id
    FROM \`${project_id}.${dataset_id}._regional_load_regional_budget_line_facts\`
    WHERE fiscal_year BETWEEN 2000 AND 2100
  );
INSERT INTO \`${project_id}.${dataset_id}.regional_budget_line_facts\` (
  public_entity_id, country_code, regional_tier_code, fiscal_year, fiscal_period,
  reporting_scope, budget_stage, budget_side, source_budget_item_type_code,
  functional_code, economic_code, functional_classification_id,
  economic_classification_id, amount_local, currency_code, amount_eur, fx_date,
  is_consolidation_item, is_financing, is_summary_row, source_row_number,
  source_sheet, source_id, ingestion_run_id, coverage_type, is_imputed,
  quality_flags, loaded_at
)
SELECT
  public_entity_id, country_code, regional_tier_code, fiscal_year, fiscal_period,
  reporting_scope, budget_stage, budget_side, source_budget_item_type_code,
  functional_code, economic_code, functional_classification_id,
  economic_classification_id, amount_local, currency_code, amount_eur, fx_date,
  is_consolidation_item, is_financing, is_summary_row, source_row_number,
  source_sheet, source_id, ingestion_run_id, coverage_type, is_imputed,
  quality_flags, loaded_at
FROM \`${project_id}.${dataset_id}._regional_load_regional_budget_line_facts\`
WHERE fiscal_year BETWEEN 2000 AND 2100;
DROP TABLE \`${project_id}.${dataset_id}._regional_load_regional_budget_line_facts\`;"

load_stage regional_budget_coverage
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.regional_budget_coverage\` AS target
WHERE target.fiscal_year BETWEEN 2000 AND 2100
  AND EXISTS (
    SELECT 1 FROM \`${project_id}.${dataset_id}._regional_load_regional_budget_coverage\` AS source
    WHERE target.coverage_id = source.coverage_id
      AND source.fiscal_year BETWEEN 2000 AND 2100
  );
INSERT INTO \`${project_id}.${dataset_id}.regional_budget_coverage\` (
  coverage_id, country_code, fiscal_year, regional_tier_code, source_ids,
  entity_expected_count, entity_source_count, entity_loaded_count, fact_count,
  budget_stages, budget_sides, coverage_type, validation_status, limitations, assessed_at
)
SELECT
  coverage_id, country_code, fiscal_year, regional_tier_code, source_ids,
  entity_expected_count, entity_source_count, entity_loaded_count, fact_count,
  budget_stages, budget_sides, coverage_type, validation_status, limitations, assessed_at
FROM \`${project_id}.${dataset_id}._regional_load_regional_budget_coverage\`
WHERE fiscal_year BETWEEN 2000 AND 2100;
DROP TABLE \`${project_id}.${dataset_id}._regional_load_regional_budget_coverage\`;"

load_stage ingestion_runs
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.ingestion_runs\` AS target
WHERE DATE(target.started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
  AND target.ingestion_run_id IN (
    SELECT ingestion_run_id
    FROM \`${project_id}.${dataset_id}._regional_load_ingestion_runs\`
    WHERE DATE(started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
  );
INSERT INTO \`${project_id}.${dataset_id}.ingestion_runs\` (
  ingestion_run_id, source_id, started_at, completed_at, status, source_vintage,
  source_sha256, rows_read, rows_loaded, warning_count, error_message
)
SELECT
  ingestion_run_id, source_id, started_at, completed_at, status, source_vintage,
  source_sha256, rows_read, rows_loaded, warning_count, error_message
FROM \`${project_id}.${dataset_id}._regional_load_ingestion_runs\`
WHERE DATE(started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31';
DROP TABLE \`${project_id}.${dataset_id}._regional_load_ingestion_runs\`;"

echo "Loaded international regional bundle from $input_dir"
