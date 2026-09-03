#!/bin/sh
set -eu

deploy_marker="${1:?current-main deployment marker is required}"
pointer="${2:?snapshot pointer is required}"
destination="${3:?snapshot destination is required}"

if [ ! -f "$deploy_marker" ]; then
  echo "Skipping snapshot activation because this build is no longer current main"
  exit 0
fi
if [ ! -s "$pointer" ]; then
  echo "Snapshot pointer is absent or empty: $pointer" >&2
  exit 1
fi

# Releases are immutable. Publishing this single object is the release switch;
# the previous pointer remains available in Cloud Storage object history.
gcloud storage cp "$pointer" "$destination"
echo "Activated public snapshot from $pointer"
