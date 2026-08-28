#!/bin/sh
set -eu

project="${1:?project is required}"
region="${2:?region is required}"
service="${3:?service is required}"
tag="${4:?image tag is required}"
deploy_marker="${5:?current-main deployment marker is required}"
snapshot_base="${6:-}"

if [ ! -f "$deploy_marker" ]; then
  echo "Skipping deployment because this build is no longer the current main commit"
  exit 0
fi

digest="$(gcloud artifacts docker images describe "$tag" --project="$project" --format='value(image_summary.digest)')"
if [ -z "$digest" ]; then
  echo "Deployment blocked: registry did not return an image digest for $tag" >&2
  exit 1
fi

repository="${tag%:*}"
set -- gcloud run deploy "$service" \
  --project="$project" \
  --image="${repository}@${digest}" \
  --region="$region" \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=80 \
  --timeout=30s \
  --labels=app=czbudget-public,source=github \
  --quiet
if [ -n "$snapshot_base" ]; then
  set -- "$@" --update-env-vars="PUBLIC_SNAPSHOT_BASE_URL=${snapshot_base}"
fi
"$@"

echo "Deployed immutable image ${repository}@${digest}"
