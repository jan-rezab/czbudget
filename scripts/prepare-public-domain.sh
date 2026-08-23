#!/bin/sh
set -eu

project="czbudget-janrezab"
region="europe-west1"
service="czbudget-public"
domain="publicspendingdata.org"
www_domain="www.publicspendingdata.org"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Google Cloud CLI is required: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

account="$(gcloud config get-value account 2>/dev/null)"
if [ -z "$account" ] || [ "$account" = "(unset)" ]; then
  echo "Sign in first with: gcloud auth login" >&2
  exit 1
fi

gcloud run services describe "$service" \
  --project="$project" \
  --region="$region" \
  --format='value(status.url)' >/dev/null

if ! gcloud domains list-user-verified --format='value(id)' | grep -Fxq "$domain"; then
  echo "Opening Google's one-time ownership verification for $domain..."
  gcloud domains verify "$domain"
fi

if ! gcloud domains list-user-verified --format='value(id)' | grep -Fxq "$domain"; then
  echo "Domain ownership is not verified yet. Complete the browser flow, then run this script again." >&2
  exit 2
fi

for hostname in "$domain" "$www_domain"; do
  if ! gcloud beta run domain-mappings describe --domain="$hostname" \
    --project="$project" \
    --region="$region" >/dev/null 2>&1; then
    gcloud beta run domain-mappings create \
      --project="$project" \
      --region="$region" \
      --service="$service" \
      --domain="$hostname" \
      --quiet
  fi
done

echo
echo "Add the following records in Cloudflare DNS with Proxy status set to DNS only:"
gcloud beta run domain-mappings list \
  --project="$project" \
  --region="$region" \
  --filter="metadata.name:$domain" \
  --flatten='status.resourceRecords[]' \
  --format='table[box,title="Cloudflare DNS records"](metadata.name:label=HOST,status.resourceRecords.type:label=TYPE,status.resourceRecords.rrdata:label=VALUE)'

echo
echo "After the records are saved, check readiness with:"
echo "  ./scripts/check-public-domain.sh"
