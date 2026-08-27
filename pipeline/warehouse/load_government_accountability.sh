#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
input_dir="${3:-$(cd "$(dirname "$0")/../.." && pwd)/data/accountability/warehouse}"
pipeline_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -s "$input_dir/government_accountability_coverage.jsonl" ]]; then
  echo "Missing generated accountability bundle in $input_dir" >&2
  echo "Run: python3 pipeline/transforms/build_government_accountability.py" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$pipeline_root/warehouse/schema.sql"

stage_and_merge() {
  local table_name="$1"
  local key_expression="$2"
  local source_file="$input_dir/${table_name}.jsonl"
  local stage_name="_accountability_load_${table_name}"

  if [[ ! -s "$source_file" ]]; then
    echo "Missing or empty $source_file" >&2
    exit 1
  fi

  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\` AS
     SELECT * FROM \`${project_id}.${dataset_id}.${table_name}\` WHERE FALSE"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$source_file"
  bq query --project_id="$project_id" --use_legacy_sql=false "
    DELETE FROM \`${project_id}.${dataset_id}.${table_name}\` AS target
    WHERE EXISTS (
      SELECT 1
      FROM \`${project_id}.${dataset_id}.${stage_name}\` AS source
      WHERE ${key_expression}
    );
    INSERT INTO \`${project_id}.${dataset_id}.${table_name}\`
    SELECT * FROM \`${project_id}.${dataset_id}.${stage_name}\`;
    DROP TABLE \`${project_id}.${dataset_id}.${stage_name}\`;"
}

stage_and_merge "government_accountability_sources" "target.source_id = source.source_id"
stage_and_merge "government_tiers" "target.tier_id = source.tier_id AND target.valid_from IS NOT DISTINCT FROM source.valid_from"
stage_and_merge "government_tier_relations" "target.relation_id = source.relation_id AND target.valid_from IS NOT DISTINCT FROM source.valid_from"
stage_and_merge "government_entity_tier_assignments" "target.public_entity_id = source.public_entity_id AND target.tier_id = source.tier_id AND target.valid_from = source.valid_from"
stage_and_merge "government_responsibility_assignments" "target.assignment_id = source.assignment_id"
stage_and_merge "government_revenue_instruments" "target.instrument_id = source.instrument_id AND target.valid_from = source.valid_from"
stage_and_merge "government_accountability_mechanisms" "target.mechanism_id = source.mechanism_id AND target.valid_from = source.valid_from"
stage_and_merge "intergovernmental_transfer_facts" "target.transfer_fact_id = source.transfer_fact_id"
stage_and_merge "government_accountability_coverage" "target.coverage_id = source.coverage_id"

echo "Loaded reviewed government accountability bundle from $input_dir"
