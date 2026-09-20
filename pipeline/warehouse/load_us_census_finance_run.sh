#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <completed-ingestion-run-id>" >&2
  exit 2
fi

run_id="$1"
if [[ ! "$run_id" =~ ^[a-f0-9-]{36}$ ]]; then
  echo "Invalid ingestion run ID: $run_id" >&2
  exit 2
fi

project_id="czbudget-janrezab"
dataset_id="budget_detail"
bucket_root="gs://czbudget-janrezab-data-layers/processing-runs/us-major-cities/$run_id"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud storage cat "$bucket_root/completed.json" >/dev/null

bq query --project_id="$project_id" --location=EU --use_legacy_sql=false \
  < "$script_dir/us_city_budget_contract.sql"

for year in 2023 2024; do
  source_id="us-census-finance-${year}-individual-unit"
  parquet_uri="$bucket_root/normalized/${source_id}.parquet"

  bq load --project_id="$project_id" --location=EU --replace \
    --source_format=PARQUET \
    "$project_id:$dataset_id._us_census_budget_load" \
    "$parquet_uri"

  bq query --project_id="$project_id" --location=EU --use_legacy_sql=false \
    --parameter="source_id:STRING:$source_id" \
    --parameter="ingestion_run_id:STRING:$run_id" \
    --parameter="expected_year:INT64:$year" \
    < "$script_dir/stage_us_census_finance_run.sql"

  bq query --project_id="$project_id" --location=EU --use_legacy_sql=false \
    --parameter="source_id:STRING:$source_id" \
    --parameter="ingestion_run_id:STRING:$run_id" \
    --parameter="expected_year:INT64:$year" \
    --parameter="expected_entities:INT64:39" \
    < "$script_dir/promote_us_census_finance_run.sql"
done

bq rm --project_id="$project_id" --location=EU --table --force \
  "$project_id:$dataset_id._us_census_budget_load"

bq query --project_id="$project_id" --location=EU --use_legacy_sql=false \
  --parameter="ingestion_run_id:STRING:$run_id" \
  'SELECT fiscal_year, COUNT(*) AS fact_rows, COUNT(DISTINCT public_entity_id) AS entities,
          COUNTIF(is_imputed) AS imputed_rows
   FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
   WHERE fiscal_year IN (2023, 2024) AND ingestion_run_id = @ingestion_run_id
   GROUP BY fiscal_year ORDER BY fiscal_year'
