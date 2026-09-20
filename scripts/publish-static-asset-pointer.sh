#!/bin/sh
set -eu

approval_marker="${1:?approval marker is required}"
lock_file="${2:?asset lock is required}"
base="${3:?static asset base is required}"
release_id="${4:?release id is required}"

gcloud storage cp --no-clobber "$lock_file" "$base/releases/$release_id.json"
if [ ! -f "$approval_marker" ]; then
  echo "Skipping static asset activation because this release is not approved"
  exit 0
fi
gcloud storage cp "$lock_file" "$base/current.json"
echo "Activated static asset release $release_id"
