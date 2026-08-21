#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

bq query --project_id="$project_id" --use_legacy_sql=false < "$repo_root/gcp/bigquery/schema.sql"

for table_name in public_entities public_entity_sources public_entity_budget_headlines public_entity_metric_observations; do
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "TRUNCATE TABLE \`${project_id}.${dataset_id}.${table_name}\`"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${table_name}" "$repo_root/gcp/seed/${table_name}.jsonl"
done
