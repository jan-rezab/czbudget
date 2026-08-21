#!/bin/sh
set -eu

canonical_project="czbudget-janrezab"
canonical_region="europe-west1"
canonical_service="czbudget-public"

build_project="${1:-}"
build_region="${2:-}"
build_service="${3:-}"

if [ "$build_project" != "$canonical_project" ] || [ "$build_region" != "$canonical_region" ] || [ "$build_service" != "$canonical_service" ]; then
  echo "Deployment blocked: expected ${canonical_project}/${canonical_region}/${canonical_service}." >&2
  exit 1
fi

unexpected_services="$(
  gcloud run services list \
    --project="$canonical_project" \
    --platform=managed \
    --format='value(metadata.name)' \
  | awk '$0 ~ /^czbudget-/ && $0 != "czbudget-public"'
)"

if [ -n "$unexpected_services" ]; then
  echo "Deployment blocked: non-canonical CZ Budget Cloud Run service(s) exist:" >&2
  printf '%s\n' "$unexpected_services" >&2
  exit 1
fi

echo "Canonical deployment target verified: ${canonical_project}/${canonical_region}/${canonical_service}."
