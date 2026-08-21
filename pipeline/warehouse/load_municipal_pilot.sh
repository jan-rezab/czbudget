#!/usr/bin/env bash
set -euo pipefail

project_id="${1:-czbudget-janrezab}"
dataset_id="${2:-budget_detail}"
pilot_dir="${3:-$(cd "$(dirname "$0")/../.." && pwd)/outputs/20260820-municipal-bigquery-pilot}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
finm_run_id="$(jq -r 'select(.source_id == "cz-monitor-finm-2025-12") | .ingestion_run_id' "$pilot_dir/ingestion_runs.jsonl")"
rozv_run_id="$(jq -r 'select(.source_id == "cz-monitor-rozv-2025-12") | .ingestion_run_id' "$pilot_dir/ingestion_runs.jsonl")"

if [[ -z "$finm_run_id" || -z "$rozv_run_id" ]]; then
  echo "Missing FINM or ROZV ingestion run ID in $pilot_dir/ingestion_runs.jsonl" >&2
  exit 1
fi

bq query --project_id="$project_id" --use_legacy_sql=false < "$repo_root/gcp/bigquery/schema.sql"

stage_and_merge() {
  local table_name="$1"
  local merge_sql="$2"
  local stage_name="_municipal_load_${table_name}"
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "CREATE OR REPLACE TABLE \`${project_id}.${dataset_id}.${stage_name}\` AS SELECT * FROM \`${project_id}.${dataset_id}.${table_name}\` WHERE FALSE"
  bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
    "${dataset_id}.${stage_name}" "$pilot_dir/${table_name}.jsonl"
  bq query --project_id="$project_id" --use_legacy_sql=false "$merge_sql"
  bq query --project_id="$project_id" --use_legacy_sql=false \
    "DROP TABLE \`${project_id}.${dataset_id}.${stage_name}\`"
}

stage_and_merge "public_entities" "
MERGE \`${project_id}.${dataset_id}.public_entities\` AS target
USING \`${project_id}.${dataset_id}._municipal_load_public_entities\` AS source
ON target.public_entity_id = source.public_entity_id
WHEN MATCHED THEN UPDATE SET
  entity_name = source.entity_name,
  entity_type = source.entity_type,
  country_code_alpha2 = source.country_code_alpha2,
  country_code_alpha3 = source.country_code_alpha3,
  national_entity_code = source.national_entity_code,
  national_entity_code_type = source.national_entity_code_type,
  is_eu_capital = source.is_eu_capital,
  is_extra_city = source.is_extra_city,
  default_currency_code = source.default_currency_code,
  eurostat_city_code = COALESCE(source.eurostat_city_code, target.eurostat_city_code),
  eurostat_geography_name = COALESCE(source.eurostat_geography_name, target.eurostat_geography_name),
  administrative_region_code = source.administrative_region_code,
  administrative_region_name = source.administrative_region_name,
  administrative_district_code = source.administrative_district_code,
  administrative_district_name = source.administrative_district_name,
  national_geography_code = source.national_geography_code,
  national_geography_code_type = source.national_geography_code_type,
  valid_from = COALESCE(source.valid_from, target.valid_from),
  valid_to = source.valid_to,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  public_entity_id, entity_name, entity_type, country_code_alpha2, country_code_alpha3,
  national_entity_code, national_entity_code_type, is_eu_capital, is_extra_city,
  default_currency_code, eurostat_city_code, eurostat_geography_name,
  administrative_region_code, administrative_region_name, administrative_district_code,
  administrative_district_name, national_geography_code, national_geography_code_type,
  valid_from, valid_to, loaded_at
) VALUES (
  source.public_entity_id, source.entity_name, source.entity_type, source.country_code_alpha2,
  source.country_code_alpha3, source.national_entity_code, source.national_entity_code_type,
  source.is_eu_capital, source.is_extra_city, source.default_currency_code,
  source.eurostat_city_code, source.eurostat_geography_name, source.administrative_region_code,
  source.administrative_region_name, source.administrative_district_code,
  source.administrative_district_name, source.national_geography_code,
  source.national_geography_code_type, source.valid_from, source.valid_to, source.loaded_at
)"

stage_and_merge "public_entity_sources" "
MERGE \`${project_id}.${dataset_id}.public_entity_sources\` AS target
USING \`${project_id}.${dataset_id}._municipal_load_public_entity_sources\` AS source
ON target.source_id = source.source_id
   AND target.public_entity_id IS NOT DISTINCT FROM source.public_entity_id
WHEN MATCHED THEN UPDATE SET
  source_type = source.source_type,
  source_name = source.source_name,
  source_url = source.source_url,
  dataset_code = source.dataset_code,
  archive_file = source.archive_file,
  archive_sha256 = source.archive_sha256,
  retrieved_at = source.retrieved_at,
  notes = source.notes,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  source_id, public_entity_id, source_type, source_name, source_url, dataset_code,
  archive_file, archive_sha256, retrieved_at, notes, loaded_at
) VALUES (
  source.source_id, source.public_entity_id, source.source_type, source.source_name,
  source.source_url, source.dataset_code, source.archive_file, source.archive_sha256,
  source.retrieved_at, source.notes, source.loaded_at
)"

stage_and_merge "classification_versions" "
MERGE \`${project_id}.${dataset_id}.classification_versions\` AS target
USING \`${project_id}.${dataset_id}._municipal_load_classification_versions\` AS source
ON target.classification_id = source.classification_id
WHEN MATCHED THEN UPDATE SET
  country_code = source.country_code,
  budget_side = source.budget_side,
  government_scope = source.government_scope,
  valid_from_year = source.valid_from_year,
  valid_to_year = source.valid_to_year,
  classification_name = source.classification_name,
  legal_basis = source.legal_basis,
  source_url = source.source_url,
  notes = source.notes,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  classification_id, country_code, budget_side, government_scope, valid_from_year,
  valid_to_year, classification_name, legal_basis, source_url, notes, loaded_at
) VALUES (
  source.classification_id, source.country_code, source.budget_side, source.government_scope,
  source.valid_from_year, source.valid_to_year, source.classification_name, source.legal_basis,
  source.source_url, source.notes, source.loaded_at
)"

stage_and_merge "budget_nodes" "
MERGE \`${project_id}.${dataset_id}.budget_nodes\` AS target
USING \`${project_id}.${dataset_id}._municipal_load_budget_nodes\` AS source
ON target.budget_node_id = source.budget_node_id
WHEN MATCHED THEN UPDATE SET
  classification_id = source.classification_id,
  country_code = source.country_code,
  budget_side = source.budget_side,
  government_scope = source.government_scope,
  node_code = source.node_code,
  node_name_native = source.node_name_native,
  node_name_en = source.node_name_en,
  node_name_cs = source.node_name_cs,
  parent_budget_node_id = source.parent_budget_node_id,
  hierarchy_level = source.hierarchy_level,
  hierarchy_path = source.hierarchy_path,
  is_chapter = source.is_chapter,
  effective_from_year = source.effective_from_year,
  effective_to_year = source.effective_to_year,
  loaded_at = source.loaded_at
WHEN NOT MATCHED THEN INSERT (
  budget_node_id, classification_id, country_code, budget_side, government_scope,
  node_code, node_name_native, node_name_en, node_name_cs, parent_budget_node_id,
  hierarchy_level, hierarchy_path, is_chapter, effective_from_year, effective_to_year, loaded_at
) VALUES (
  source.budget_node_id, source.classification_id, source.country_code, source.budget_side,
  source.government_scope, source.node_code, source.node_name_native, source.node_name_en,
  source.node_name_cs, source.parent_budget_node_id, source.hierarchy_level,
  source.hierarchy_path, source.is_chapter, source.effective_from_year,
  source.effective_to_year, source.loaded_at
)"

run_date="$(jq -r '.started_at[0:10]' "$pilot_dir/ingestion_runs.jsonl" | head -n 1)"
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.ingestion_runs\`
WHERE started_at >= TIMESTAMP('${run_date}')
  AND started_at < TIMESTAMP(DATE_ADD(DATE('${run_date}'), INTERVAL 1 DAY))
  AND ingestion_run_id IN ('${finm_run_id}', '${rozv_run_id}')"
bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
  "${dataset_id}.ingestion_runs" "$pilot_dir/ingestion_runs.jsonl"

bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.raw_budget_lines\`
WHERE fiscal_year = 2025
  AND ingestion_run_id IN ('${finm_run_id}', '${rozv_run_id}')"
bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
  "${dataset_id}.raw_budget_lines" "$pilot_dir/raw_budget_lines.jsonl"

bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.municipal_budget_line_facts\`
WHERE fiscal_year = 2025 AND ingestion_run_id = '${finm_run_id}'"
bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
  "${dataset_id}.municipal_budget_line_facts" "$pilot_dir/municipal_budget_line_facts.jsonl"

# Publish one comparable headline per municipality and budget stage. The
# expenditure total is the headline measure; revenue, financing and balance
# remain available as typed JSON components, while full paragraph/item detail
# stays in municipal_budget_line_facts.
bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entity_budget_headlines\`
WHERE fiscal_year = 2025
  AND ingestion_run_id = '${finm_run_id}';

INSERT INTO \`${project_id}.${dataset_id}.public_entity_budget_headlines\` (
  public_entity_id,
  fiscal_year,
  fiscal_period,
  period_label,
  period_type,
  reporting_scope,
  budget_stage,
  status,
  measure_code,
  amount_local,
  currency_code,
  amount_eur,
  local_currency_units_per_eur,
  fx_date,
  amount_precision,
  components,
  is_provisional,
  comparability_notes,
  source_id,
  ingestion_run_id,
  loaded_at
)
WITH totals AS (
  SELECT
    public_entity_id,
    fiscal_year,
    reporting_scope,
    budget_stage,
    currency_code,
    ANY_VALUE(source_id) AS source_id,
    SUM(IF(
      budget_side = 'revenue'
      AND NOT is_consolidation_item
      AND NOT is_summary_row,
      amount_local,
      0
    )) AS revenue_total,
    SUM(IF(
      budget_side = 'expenditure'
      AND NOT is_consolidation_item
      AND NOT is_summary_row,
      amount_local,
      0
    )) AS expenditure_total,
    SUM(IF(
      budget_side = 'financing'
      AND NOT is_consolidation_item
      AND NOT is_summary_row,
      amount_local,
      0
    )) AS financing_total
  FROM \`${project_id}.${dataset_id}.municipal_budget_line_facts\`
  WHERE fiscal_year = 2025
    AND ingestion_run_id = '${finm_run_id}'
  GROUP BY
    public_entity_id,
    fiscal_year,
    reporting_scope,
    budget_stage,
    currency_code
)
SELECT
  public_entity_id,
  fiscal_year,
  'FY' AS fiscal_period,
  CAST(fiscal_year AS STRING) AS period_label,
  'calendar_year' AS period_type,
  reporting_scope,
  budget_stage,
  budget_stage AS status,
  'total_expenditure' AS measure_code,
  expenditure_total AS amount_local,
  currency_code,
  CAST(NULL AS NUMERIC) AS amount_eur,
  CAST(NULL AS NUMERIC) AS local_currency_units_per_eur,
  CAST(NULL AS DATE) AS fx_date,
  'exact' AS amount_precision,
  TO_JSON(STRUCT(
    revenue_total AS revenue_total_czk,
    expenditure_total AS expenditure_total_czk,
    financing_total AS financing_total_czk,
    revenue_total - expenditure_total AS budget_balance_czk
  )) AS components,
  FALSE AS is_provisional,
  'FIN 2-12 M; standalone accounting unit; internal consolidation items and reported financing summary rows excluded.' AS comparability_notes,
  source_id,
  '${finm_run_id}' AS ingestion_run_id,
  CURRENT_TIMESTAMP() AS loaded_at
FROM totals;"

bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entity_balance_sheet_facts\`
WHERE statement_date BETWEEN DATE '2024-01-01' AND DATE '2025-12-31'
  AND ingestion_run_id = '${rozv_run_id}'"
bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
  "${dataset_id}.public_entity_balance_sheet_facts" "$pilot_dir/public_entity_balance_sheet_facts.jsonl"

bq query --project_id="$project_id" --use_legacy_sql=false "
DELETE FROM \`${project_id}.${dataset_id}.public_entity_cash_facts\`
WHERE statement_date BETWEEN DATE '2024-01-01' AND DATE '2025-12-31'
  AND ingestion_run_id = '${rozv_run_id}'"
bq load --project_id="$project_id" --source_format=NEWLINE_DELIMITED_JSON \
  "${dataset_id}.public_entity_cash_facts" "$pilot_dir/public_entity_cash_facts.jsonl"

echo "Municipal dataset loaded from $pilot_dir"
