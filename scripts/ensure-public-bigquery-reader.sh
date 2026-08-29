#!/usr/bin/env bash
set -euo pipefail

project="${1:?project is required}"
dataset="${2:-budget_detail}"
service="${3:-czbudget-public}"
region="${4:-europe-west1}"

service_account="$(gcloud run services describe "$service" --project="$project" --region="$region" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$service_account" ]]; then
  project_number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
  service_account="${project_number}-compute@developer.gserviceaccount.com"
fi

gcloud projects add-iam-policy-binding "$project" \
  --member="serviceAccount:${service_account}" \
  --role=roles/bigquery.jobUser \
  --condition=None \
  --quiet >/dev/null

bq query \
  --project_id="$project" \
  --location=EU \
  --use_legacy_sql=false \
  "GRANT \`roles/bigquery.dataViewer\` ON SCHEMA \`${project}.${dataset}\` TO \"serviceAccount:${service_account}\""

echo "Cloud Run can read the municipal detail dataset: ${service_account}"

