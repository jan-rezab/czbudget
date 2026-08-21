#!/bin/sh
set -eu

project="${1:?project is required}"
region="${2:?region is required}"
service="${3:?service is required}"
tag="${4:?image tag is required}"

digest="$(gcloud artifacts docker images describe "$tag" --project="$project" --format='value(image_summary.digest)')"
if [ -z "$digest" ]; then
  echo "Deployment blocked: registry did not return an image digest for $tag" >&2
  exit 1
fi

repository="${tag%:*}"
gcloud run deploy "$service" \
  --project="$project" \
  --image="${repository}@${digest}" \
  --region="$region" \
  --platform=managed \
  --allow-unauthenticated \
  --labels=app=czbudget-public,source=github \
  --quiet

echo "Deployed immutable image ${repository}@${digest}"
