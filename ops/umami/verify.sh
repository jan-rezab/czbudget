#!/bin/sh
set -eu

base_url="${1:-https://analytics.publicspendingdata.org}"
base_url="${base_url%/}"

command -v curl >/dev/null 2>&1 || {
  echo "curl is required." >&2
  exit 1
}

heartbeat="$(curl --fail --silent --show-error "$base_url/api/heartbeat")"
curl --fail --silent --show-error --head "$base_url/script.js" >/dev/null

echo "Heartbeat: $heartbeat"
echo "Tracker: OK"
echo "Verified $base_url"
