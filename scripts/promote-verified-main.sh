#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: scripts/promote-verified-main.sh STARTED_AT BUDGET_MINUTES FAILED_GATES" >&2
  exit 2
fi

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
if [ -n "$(git status --porcelain)" ]; then
  echo "Promotion requires a clean committed candidate." >&2
  exit 2
fi

candidate=$(git rev-parse HEAD)
base=$(git ls-remote origin refs/heads/main | awk '{print $1}')
if [ -z "$base" ] || [ "$base" = "$candidate" ]; then
  echo "Expected a distinct current origin/main and candidate commit." >&2
  exit 2
fi
if ! git merge-base --is-ancestor "$base" "$candidate"; then
  echo "Candidate does not fast-forward current origin/main. Fetch and reconcile first." >&2
  exit 2
fi

guard=${PSD_DELIVERY_GUARD:-"$(dirname "$root")/tools/delivery_guard.py"}
python3 "$guard" --started-at "$1" --budget-minutes "$2" --failed-gates "$3"
plan=$(mktemp "${TMPDIR:-/tmp}/psd-promotion-plan.XXXXXX")
trap 'rm -f -- "$plan"' EXIT HUP INT TERM
node scripts/verification-plan.mjs "$base" "$candidate" > "$plan"
python3 scripts/check-cloud-verification.py --plan "$plan"

# A GitHub PR merge creates a new, unverified SHA. Push the verified SHA itself.
# The pre-push hook repeats the source and exact-commit receipt checks.
git push origin "$candidate:refs/heads/main"
echo "Promoted verified commit $candidate to main. Resolve and inspect its production build ID."
