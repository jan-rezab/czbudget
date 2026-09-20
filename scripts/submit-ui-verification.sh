#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTEXT=$(mktemp -d "${TMPDIR:-/tmp}/psd-ui-context.XXXXXX")
cleanup() { rm -rf -- "$CONTEXT"; }
trap cleanup EXIT INT TERM

node "$ROOT/scripts/prepare-ui-build-context.mjs" "$CONTEXT"
gcloud builds submit "$CONTEXT" \
  --config="$CONTEXT/cloudbuild.ui.yaml" \
  --project=czbudget-janrezab \
  --region=europe-west1 \
  --service-account=projects/czbudget-janrezab/serviceAccounts/psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com \
  --async \
  --format='value(id)'
