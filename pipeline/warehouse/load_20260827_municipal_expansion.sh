#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
workspace_root="$(cd "$(dirname "$0")/../../.." && pwd)"
loader="$workspace_root/website/pipeline/warehouse/load_international_municipal.sh"

bundles=(
  "outputs/20260827-international-municipal-uk-full"
  "outputs/20260827-international-municipal-germany-structured"
  "outputs/20260827-international-municipal-switzerland-structured"
  "outputs/20260827-international-municipal-france-2025-full"
  "outputs/20260827-international-municipal-france-enacted-2026"
  "outputs/20260827-international-municipal-paraguay-boost"
)

for relative in "${bundles[@]}"; do
  bundle="$workspace_root/$relative"
  if [[ ! -f "$bundle/international_municipal_manifest.json" ]]; then
    echo "Missing validated bundle manifest: $bundle" >&2
    exit 1
  fi
  "$loader" "$project_id" "$dataset_id" "$bundle"
done

echo "Loaded all validated 2026-08-27 municipal expansion bundles"
