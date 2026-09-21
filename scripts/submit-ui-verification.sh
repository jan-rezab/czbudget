#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "Commit the candidate before submitting cloud UI verification." >&2
  exit 2
fi
candidate=$(git -C "$ROOT" rev-parse HEAD)
base="${1:-$(git -C "$ROOT" rev-parse origin/main)}"
plan=$(cd "$ROOT" && node scripts/verification-plan.mjs "$base" "$candidate")
lane=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).lane)' "$plan")
if [ "$lane" != component ]; then
  echo "The candidate selects the full verification lane; skip the duplicate fast UI build." >&2
  exit 2
fi

CONTEXT=$(mktemp -d "${TMPDIR:-/tmp}/psd-ui-context.XXXXXX")
cleanup() { rm -rf -- "$CONTEXT"; }
trap cleanup EXIT INT TERM
node "$ROOT/scripts/prepare-ui-build-context.mjs" "$CONTEXT"
printf '%s\n' "$plan" > "$CONTEXT/verification-plan.json"
# Check the exact packaged files before paying for a queued cloud worker.
(cd "$CONTEXT" && node scripts/validate-ui-environment.mjs && node scripts/validate-release-contract.mjs)
gcloud builds submit "$CONTEXT" \
  --account="${PSD_GCLOUD_ACCOUNT:-jan@ravineo.com}" \
  --config="$CONTEXT/cloudbuild.ui.yaml" \
  --project=czbudget-janrezab \
  --region=europe-west1 \
  --service-account=projects/czbudget-janrezab/serviceAccounts/psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com \
  --async \
  --substitutions="_CANDIDATE_SHA=$candidate,_BASE_SHA=$base" \
  --format='value(id)'
