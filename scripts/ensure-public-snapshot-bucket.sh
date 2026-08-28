#!/usr/bin/env bash
set -euo pipefail

project="${1:?project is required}"
bucket="${2:?bucket URI is required}"
location="${3:-EU}"
service="${4:-czbudget-public}"
region="${5:-europe-west1}"

if [[ ! "$bucket" =~ ^gs://[^/]+$ ]]; then
  echo "Bucket must be a root gs:// URI without a path: $bucket" >&2
  exit 2
fi
if ! gcloud storage buckets describe "$bucket" --project="$project" >/dev/null 2>&1; then
  gcloud storage buckets create "$bucket" --project="$project" --location="$location" --uniform-bucket-level-access
fi

service_account="$(gcloud run services describe "$service" --project="$project" --region="$region" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$service_account" ]]; then
  project_number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
  service_account="${project_number}-compute@developer.gserviceaccount.com"
fi
gcloud storage buckets add-iam-policy-binding "$bucket" \
  --member="serviceAccount:${service_account}" \
  --role=roles/storage.objectViewer \
  --project="$project"

echo "Snapshot bucket ready for private Cloud Run reads: $bucket"
