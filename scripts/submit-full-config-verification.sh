#!/bin/sh
set -eu

# The regular full trigger reads cloudbuild.verify.yaml from main. A change to
# that file uses one connected-repository full run with the candidate's YAML.
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "Commit the candidate before submitting verifier-config validation." >&2
  exit 2
fi
candidate=$(git -C "$ROOT" rev-parse HEAD)
base="${1:-$(git -C "$ROOT" rev-parse origin/main)}"
plan=$(cd "$ROOT" && node scripts/verification-plan.mjs "$base" "$candidate")
if ! node -e 'const plan=JSON.parse(process.argv[1]); process.exit(plan.lane === "full" && plan.files.includes("cloudbuild.verify.yaml") ? 0 : 1)' "$plan"; then
  echo "The candidate must change cloudbuild.verify.yaml and select the full lane." >&2
  exit 2
fi

(cd "$ROOT" && node scripts/validate-build-planes.mjs && node scripts/validate-ui-environment.mjs)
config_sha=$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$ROOT/cloudbuild.verify.yaml")
gcloud builds submit \
  projects/czbudget-janrezab/locations/europe-west1/connections/czbudget-github/repositories/czbudget \
  --revision="$candidate" \
  --config="$ROOT/cloudbuild.verify.yaml" \
  --account="${PSD_GCLOUD_ACCOUNT:-jan@ravineo.com}" \
  --project=czbudget-janrezab \
  --region=europe-west1 \
  --service-account=projects/czbudget-janrezab/serviceAccounts/psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com \
  --async \
  --substitutions="_CANDIDATE_SHA=$candidate,_BASE_SHA=$base,_VERIFY_CONFIG_SHA=$config_sha" \
  --format='value(id)'
