#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTEXT=$(mktemp -d "${TMPDIR:-/tmp}/psd-ui-context.XXXXXX")
cleanup() { rm -rf -- "$CONTEXT"; }
trap cleanup EXIT INT TERM

node "$ROOT/scripts/prepare-ui-build-context.mjs" "$CONTEXT"
# Check the exact packaged files before paying for a queued cloud worker.
(cd "$CONTEXT" && node scripts/validate-ui-environment.mjs && node scripts/validate-release-contract.mjs)
candidate=uncommitted
base="${1:-$(git -C "$ROOT" rev-parse origin/main)}"
if [ -z "$(git -C "$ROOT" status --porcelain)" ]; then
  candidate=$(git -C "$ROOT" rev-parse HEAD)
  (cd "$ROOT" && node scripts/verification-plan.mjs "$base" "$candidate") > "$CONTEXT/verification-plan.json"
fi
gcloud builds submit "$CONTEXT" \
  --account="${PSD_GCLOUD_ACCOUNT:-jan@ravineo.com}" \
  --config="$CONTEXT/cloudbuild.ui.yaml" \
  --project=czbudget-janrezab \
  --region=europe-west1 \
  --service-account=projects/czbudget-janrezab/serviceAccounts/psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com \
  --async \
  --substitutions="_CANDIDATE_SHA=$candidate,_BASE_SHA=$base" \
  --format='value(id)'
