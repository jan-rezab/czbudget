#!/bin/sh
set -eu

project="czbudget-janrezab"
region="europe-west1"
domain="publicspendingdata.org"
www_domain="www.publicspendingdata.org"

gcloud beta run domain-mappings list \
  --project="$project" \
  --region="$region" \
  --filter="metadata.name:$domain" \
  --format='table(metadata.name:label=DOMAIN,status.conditions[0].status:label=READY,status.conditions[0].message:label=STATUS)'

echo
for url in "https://$domain/" "https://$www_domain/"; do
  status="$(curl -L -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
  final_url="$(curl -L -sS -o /dev/null -w '%{url_effective}' --max-time 20 "$url" || true)"
  printf '%-40s HTTP %-3s -> %s\n' "$url" "${status:-000}" "${final_url:-unreachable}"
done
