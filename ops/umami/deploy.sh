#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
state_file="$script_dir/.deployment.env"

if [ -f "$state_file" ]; then
  # This file contains secret version numbers, never secret values.
  # shellcheck disable=SC1090
  . "$state_file"
fi

project="${PROJECT_ID:-czbudget-janrezab}"
region="${REGION:-europe-west1}"
service="${SERVICE_NAME:-publicspending-umami}"
repository="${ARTIFACT_REPOSITORY:-cloud-run-source-deploy}"
database_version="${DATABASE_SECRET_VERSION:-}"
app_secret_version="${APP_SECRET_VERSION:-}"
two_factor_version="${TWO_FACTOR_SECRET_VERSION:-}"
service_account="publicspending-umami@${project}.iam.gserviceaccount.com"

if [ "$service" != "publicspending-umami" ]; then
  echo "Deployment blocked: service must be publicspending-umami." >&2
  exit 1
fi
case "$service" in
  czbudget-*)
    echo "Deployment blocked: analytics must never use a czbudget-* service name." >&2
    exit 1
    ;;
esac

if [ -z "$database_version" ] || [ -z "$app_secret_version" ] || [ -z "$two_factor_version" ]; then
  echo "Deployment state is incomplete. Run ops/umami/setup-gcp.sh first." >&2
  exit 1
fi

build_tag="umami-3.3.0-$(date -u +%Y%m%d%H%M%S)"
image_tag="${region}-docker.pkg.dev/${project}/${repository}/publicspending-umami:${build_tag}"

gcloud builds submit "$script_dir" \
  --project="$project" \
  --tag="$image_tag"

digest="$(gcloud artifacts docker images describe "$image_tag" \
  --project="$project" \
  --format='value(image_summary.digest)')"
if [ -z "$digest" ]; then
  echo "Deployment blocked: Artifact Registry returned no digest for $image_tag" >&2
  exit 1
fi

image="${image_tag%:*}@${digest}"
secret_bindings="DATABASE_URL=umami-database-url:${database_version},APP_SECRET=umami-app-secret:${app_secret_version},TWO_FACTOR_ENCRYPTION_KEY=umami-two-factor-encryption-key:${two_factor_version}"

set -- gcloud run deploy "$service" \
  --project="$project" \
  --region="$region" \
  --platform=managed \
  --image="$image" \
  --service-account="$service_account" \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=40 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-secrets="$secret_bindings" \
  --set-env-vars="DISABLE_TELEMETRY=1,PRIVATE_MODE=1" \
  --startup-probe="httpGet.path=/api/heartbeat,httpGet.port=3000,timeoutSeconds=5,periodSeconds=5,failureThreshold=24" \
  --labels="app=publicspending-umami,component=analytics" \
  --quiet

if [ -n "${UMAMI_CLOUD_SQL_INSTANCE:-}" ]; then
  set -- "$@" --set-cloudsql-instances="$UMAMI_CLOUD_SQL_INSTANCE"
fi

"$@"

service_url="$(gcloud run services describe "$service" \
  --project="$project" \
  --region="$region" \
  --format='value(status.url)')"

echo "Deployed immutable image $image"
echo "Umami URL: $service_url"
echo "Next: $script_dir/map-domain.sh"
