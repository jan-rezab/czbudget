#!/bin/sh
set -eu

project="${PROJECT_ID:-czbudget-janrezab}"
region="${REGION:-europe-west1}"
service="publicspending-umami"
domain="analytics.publicspendingdata.org"

if ! gcloud run services describe "$service" \
  --project="$project" \
  --region="$region" >/dev/null 2>&1; then
  echo "Deploy $service before creating its domain mapping." >&2
  exit 1
fi

if ! gcloud beta run domain-mappings describe \
  --project="$project" \
  --region="$region" \
  --domain="$domain" >/dev/null 2>&1; then
  gcloud beta run domain-mappings create \
    --project="$project" \
    --region="$region" \
    --service="$service" \
    --domain="$domain"
fi

gcloud beta run domain-mappings describe \
  --project="$project" \
  --region="$region" \
  --domain="$domain" \
  --format='yaml(status.resourceRecords,status.conditions)'

echo "Add every resourceRecords entry above at the DNS provider."
