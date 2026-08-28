#!/usr/bin/env sh
set -eu

/docker-entrypoint.d/20-envsubst-on-templates.sh

api_ready_file=/tmp/public-spending-api-ready
rm -f "$api_ready_file"
API_READY_FILE="$api_ready_file" node /app/server/index.mjs &
api_pid=$!

attempt=0
while [ ! -f "$api_ready_file" ]; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    wait "$api_pid"
    exit 1
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 100 ]; then
    echo "API server did not become ready before the startup deadline" >&2
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
    exit 1
  fi
  sleep 0.1
done

nginx -g 'daemon off;' &
nginx_pid=$!

shutdown() {
  kill "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 2
done

exit 1
