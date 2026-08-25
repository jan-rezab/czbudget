#!/bin/sh
set -eu

project="${PROJECT_ID:-czbudget-janrezab}"
region="${REGION:-europe-west1}"
repository="${ARTIFACT_REPOSITORY:-cloud-run-source-deploy}"
service_account_name="publicspending-umami"
service_account="${service_account_name}@${project}.iam.gserviceaccount.com"
state_file="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/.deployment.env"

command -v gcloud >/dev/null 2>&1 || {
  echo "gcloud is required." >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required." >&2
  exit 1
}

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project="$project"

if ! gcloud artifacts repositories describe "$repository" \
  --project="$project" \
  --location="$region" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$repository" \
    --project="$project" \
    --location="$region" \
    --repository-format=docker \
    --description="Cloud Run deployment images"
fi

if ! gcloud iam service-accounts describe "$service_account" \
  --project="$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$service_account_name" \
    --project="$project" \
    --display-name="Public Spending Data Umami"
fi

ensure_secret() {
  secret_name="$1"
  if ! gcloud secrets describe "$secret_name" --project="$project" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$project" \
      --replication-policy=automatic >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$project" \
    --member="serviceAccount:${service_account}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

add_secret_version() {
  secret_name="$1"
  secret_value="$2"
  version_name="$(printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" \
    --project="$project" \
    --data-file=- \
    --format='value(name)')"
  printf '%s' "${version_name##*/}"
}

ensure_generated_secret() {
  secret_name="$1"
  ensure_secret "$secret_name"
  current_version="$(gcloud secrets versions list "$secret_name" \
    --project="$project" \
    --filter='state=ENABLED' \
    --sort-by='~createTime' \
    --limit=1 \
    --format='value(name)')"
  if [ -n "$current_version" ]; then
    printf '%s' "${current_version##*/}"
  else
    generated_value="$(openssl rand -hex 32)"
    add_secret_version "$secret_name" "$generated_value"
  fi
}

input_hidden=0
restore_input_echo() {
  if [ "$input_hidden" -eq 1 ]; then
    stty echo
  fi
}
trap restore_input_echo 0 1 2 15

printf 'PostgreSQL DATABASE_URL (input is hidden): ' >&2
if [ -t 0 ]; then
  stty -echo
  input_hidden=1
fi
IFS= read -r database_url
restore_input_echo
input_hidden=0
trap - 0 1 2 15
printf '\n' >&2
case "$database_url" in
  postgresql://*|postgres://*) ;;
  *)
    echo "DATABASE_URL must start with postgresql:// or postgres://" >&2
    exit 1
    ;;
esac

ensure_secret "umami-database-url"
database_version="$(add_secret_version "umami-database-url" "$database_url")"
unset database_url

app_secret_version="$(ensure_generated_secret "umami-app-secret")"
two_factor_version="$(ensure_generated_secret "umami-two-factor-encryption-key")"

umask 077
{
  printf "PROJECT_ID='%s'\n" "$project"
  printf "REGION='%s'\n" "$region"
  printf "ARTIFACT_REPOSITORY='%s'\n" "$repository"
  printf "DATABASE_SECRET_VERSION='%s'\n" "$database_version"
  printf "APP_SECRET_VERSION='%s'\n" "$app_secret_version"
  printf "TWO_FACTOR_SECRET_VERSION='%s'\n" "$two_factor_version"
} > "$state_file"

echo "GCP prerequisites and pinned secret versions are ready."
echo "Local deployment state: $state_file"
