#!/usr/bin/env bash
set -euo pipefail

project="${BQ_PROJECT:-czbudget-janrezab}"
dataset="${BQ_DATASET:-budget_detail}"
location="${BQ_LOCATION:-EU}"
bucket_uri="${PUBLIC_SNAPSHOT_GCS_URI:-}"
output=""
release_id=""
processed_rows=""
local_only=false
use_prepared=false
skip_validation=false

while (($#)); do
  case "$1" in
    --output) output="${2:?--output requires a directory}"; shift 2 ;;
    --release-id) release_id="${2:?--release-id requires a value}"; shift 2 ;;
    --processed-structured-rows) processed_rows="${2:?--processed-structured-rows requires a value}"; shift 2 ;;
    --bucket) bucket_uri="${2:?--bucket requires a gs:// URI}"; shift 2 ;;
    --local-only) local_only=true; shift ;;
    --use-prepared) use_prepared=true; shift ;;
    --skip-validation) skip_validation=true; shift ;;
    --help)
      echo "Usage: publish_public_serving.sh --output DIR --release-id ID [--processed-structured-rows N] [--bucket gs://BUCKET/PREFIX] [--local-only] [--use-prepared]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$output" || -z "$release_id" ]]; then
  echo "--output and --release-id are required" >&2
  exit 2
fi
if [[ "$use_prepared" == true ]]; then
  [[ -f "$output/current.json" && -f "$output/staging/public_profile_snapshots.jsonl" ]] || {
    echo "Prepared release is incomplete: $output" >&2
    exit 1
  }
else
  prepare_args=(--output "$output" --release-id "$release_id")
  if [[ -n "$processed_rows" ]]; then
    prepare_args+=(--processed-structured-rows "$processed_rows")
  fi
  node scripts/prepare-public-serving-snapshots.mjs "${prepare_args[@]}"
fi

if [[ "$skip_validation" != true ]]; then
  node scripts/validate-public-serving-snapshot.mjs "$output"
fi
if [[ "$local_only" == true ]]; then
  echo "Validated local serving release $release_id at $output"
  exit 0
fi
if [[ ! "$bucket_uri" =~ ^gs://[^/]+(/.*)?$ ]]; then
  echo "Set --bucket or PUBLIC_SNAPSHOT_GCS_URI to a gs:// bucket or prefix" >&2
  exit 2
fi

bq query --project_id="$project" --location="$location" --use_legacy_sql=false \
  < pipeline/warehouse/public_serving_schema.sql

bq query --project_id="$project" --location="$location" --use_legacy_sql=false \
  "CREATE OR REPLACE TABLE \`${project}.${dataset}._public_profile_snapshots_stage\` LIKE \`${project}.${dataset}.public_profile_snapshots\`;"
bq load --project_id="$project" --location="$location" --source_format=NEWLINE_DELIMITED_JSON \
  "${project}:${dataset}._public_profile_snapshots_stage" "$output/staging/public_profile_snapshots.jsonl"

bq query --project_id="$project" --location="$location" --use_legacy_sql=false \
  "CREATE OR REPLACE TABLE \`${project}.${dataset}._public_dataset_inventory_stage\` LIKE \`${project}.${dataset}.public_dataset_inventory\`;"
bq load --project_id="$project" --location="$location" --source_format=NEWLINE_DELIMITED_JSON \
  "${project}:${dataset}._public_dataset_inventory_stage" "$output/staging/public_dataset_inventory.jsonl"

bq query --project_id="$project" --location="$location" --use_legacy_sql=false \
  < pipeline/warehouse/refresh_public_serving.sql

manifest="$output/releases/$release_id/manifest.v1.json"
IFS=$'\t' read -r profile_count nested_record_count payload_bytes route_sha manifest_sha < <(
  python3 -c 'import json,sys; value=json.load(open(sys.argv[1])); print(value["profile_count"], value["nested_record_count"], value["payload_bytes"], value["route_index_sha256"], value["manifest_sha256"], sep="\t")' "$manifest"
)

# Upload immutable objects before recording the publication. The mutable pointer
# still moves last, after both storage and BigQuery have succeeded.
gcloud storage rsync --recursive "$output/releases/$release_id" "$bucket_uri/releases/$release_id"

bq query --project_id="$project" --location="$location" --use_legacy_sql=false \
  --parameter="release_id::${release_id}" \
  --parameter="profile_count:INT64:${profile_count}" \
  --parameter="nested_record_count:INT64:${nested_record_count}" \
  --parameter="payload_bytes:INT64:${payload_bytes}" \
  --parameter="route_sha::${route_sha}" \
  --parameter="manifest_sha::${manifest_sha}" \
  'ASSERT NOT EXISTS (
     SELECT 1 FROM `czbudget-janrezab.budget_detail.public_serving_releases`
     WHERE release_id = @release_id AND manifest_sha256 != @manifest_sha
   ) AS "A release ID cannot be reused for different content";
   INSERT INTO `czbudget-janrezab.budget_detail.public_serving_releases`
   (release_id, profile_count, nested_record_count, payload_bytes, route_index_sha256, manifest_sha256, published_at)
   SELECT @release_id, @profile_count, @nested_record_count, @payload_bytes, @route_sha, @manifest_sha, CURRENT_TIMESTAMP()
   FROM UNNEST([1])
   WHERE NOT EXISTS (
     SELECT 1 FROM `czbudget-janrezab.budget_detail.public_serving_releases`
     WHERE release_id = @release_id
   )'

# The pointer is the only mutable object and moves last.
gcloud storage cp "$output/current.json" "$bucket_uri/current.json"

bq rm --project_id="$project" --force --table "${dataset}._public_profile_snapshots_stage"
bq rm --project_id="$project" --force --table "${dataset}._public_dataset_inventory_stage"
echo "Published serving release $release_id to BigQuery and $bucket_uri"
