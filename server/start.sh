#!/usr/bin/env sh
set -eu

/docker-entrypoint.d/20-envsubst-on-templates.sh

node /app/server/index.mjs &
api_pid=$!

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
