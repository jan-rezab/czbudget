#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
input_dir="${3:-$(cd "$(dirname "$0")/../../.." && pwd)/outputs/international-municipal}"
pipeline_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$input_dir/international_municipal_manifest.json" ]]; then
  echo "Missing international_municipal_manifest.json in $input_dir" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$pipeline_root/warehouse/schema.sql"

load_stage() {
  local table_name="$1"
  local source_file="$input_dir/${table_name}.jsonl"
  if [[ -s "${source_file}.gz" ]]; then
    source_file="${source_file}.gz"
  fi
  local stage_name="_international_load_${table_name}"
  if [[ ! -s "$source_file" ]]; then
    return
  fi
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\` AS SELECT * FROM \`${project_id}.${dataset_id}.${table_name}\` WHERE FALSE"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$source_file"
}

merge_dimension() {
  local table_name="$1"
  local key="$2"
  load_stage "$table_name"
  if [[ ! -s "$input_dir/${table_name}.jsonl" && ! -s "$input_dir/${table_name}.jsonl.gz" ]]; then
    return
  fi
  bq query --project_id="$project_id" --use_legacy_sql=false "
    DELETE FROM \`${project_id}.${dataset_id}.${table_name}\` AS target
    WHERE EXISTS (
      SELECT 1 FROM \`${project_id}.${dataset_id}._international_load_${table_name}\` AS source
      WHERE ${key}
    );
    INSERT INTO \`${project_id}.${dataset_id}.${table_name}\`
    SELECT * FROM \`${project_id}.${dataset_id}._international_load_${table_name}\`;
    DROP TABLE \`${project_id}.${dataset_id}._international_load_${table_name}\`;"
}

merge_fact() {
  local table_name="$1"
  local partition_filter="$2"
  load_stage "$table_name"
  if [[ ! -s "$input_dir/${table_name}.jsonl" && ! -s "$input_dir/${table_name}.jsonl.gz" ]]; then
    return
  fi
  bq query --project_id="$project_id" --use_legacy_sql=false "
    DELETE FROM \`${project_id}.${dataset_id}.${table_name}\` AS target
    WHERE ${partition_filter}
      AND target.ingestion_run_id IN (
      SELECT DISTINCT ingestion_run_id
      FROM \`${project_id}.${dataset_id}._international_load_${table_name}\`
    );
    INSERT INTO \`${project_id}.${dataset_id}.${table_name}\`
    SELECT * FROM \`${project_id}.${dataset_id}._international_load_${table_name}\`;
    DROP TABLE \`${project_id}.${dataset_id}._international_load_${table_name}\`;"
}

merge_dimension "public_entities" "target.public_entity_id = source.public_entity_id"
merge_dimension "public_entity_sources" "target.source_id = source.source_id AND target.public_entity_id IS NOT DISTINCT FROM source.public_entity_id"
merge_dimension "classification_versions" "target.classification_id = source.classification_id"
merge_dimension "budget_nodes" "target.budget_node_id = source.budget_node_id"

merge_fact "raw_budget_lines" "target.fiscal_year BETWEEN 2000 AND 2100"
merge_fact "municipal_budget_line_facts" "target.fiscal_year BETWEEN 2000 AND 2100"
merge_fact "public_entity_balance_sheet_facts" "target.statement_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'"
merge_fact "public_entity_cash_facts" "target.statement_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'"

load_stage "ingestion_runs"
if [[ -s "$input_dir/ingestion_runs.jsonl" || -s "$input_dir/ingestion_runs.jsonl.gz" ]]; then
  bq query --project_id="$project_id" --use_legacy_sql=false "
    DELETE FROM \`${project_id}.${dataset_id}.ingestion_runs\` AS target
    WHERE DATE(target.started_at) BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
      AND target.ingestion_run_id IN (
      SELECT ingestion_run_id
      FROM \`${project_id}.${dataset_id}._international_load_ingestion_runs\`
    );
    INSERT INTO \`${project_id}.${dataset_id}.ingestion_runs\`
    SELECT * FROM \`${project_id}.${dataset_id}._international_load_ingestion_runs\`;
    DROP TABLE \`${project_id}.${dataset_id}._international_load_ingestion_runs\`;"
fi

echo "Loaded international municipal bundle from $input_dir"
