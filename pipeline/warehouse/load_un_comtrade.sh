#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
input_dir="${3:-$(cd "$(dirname "$0")/../../.." && pwd)/outputs/un-comtrade/warehouse}"
warehouse_root="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -s "$input_dir/manifest.json" ]]; then
  echo "Missing UN Comtrade warehouse manifest: $input_dir/manifest.json" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$warehouse_root/un_comtrade_schema.sql"

load_stage() {
  local table_name="$1"
  local source_file="$input_dir/${table_name}.jsonl.gz"
  local stage_name="_un_comtrade_load_${table_name}"
  if [[ ! -s "$source_file" ]]; then
    echo "Missing or empty $source_file" >&2
    exit 1
  fi
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\` LIKE \`${project_id}.${dataset_id}.${table_name}\`"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$source_file"
}

load_stage trade_areas
load_stage trade_products
load_stage trade_observations
load_stage trade_dataset_coverage
load_stage trade_ingestion_runs

bq query --project_id="$project_id" --use_legacy_sql=false < "$warehouse_root/merge_un_comtrade.sql"

for table_name in trade_areas trade_products trade_observations trade_dataset_coverage trade_ingestion_runs; do
  bq rm --project_id="$project_id" --force --table "${dataset_id}._un_comtrade_load_${table_name}"
done

echo "Loaded UN Comtrade warehouse bundle from $input_dir"
