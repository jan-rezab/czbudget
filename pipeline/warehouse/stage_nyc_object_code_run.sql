-- Normalize the reviewed NYC object-code source from the first cloud run.
-- Keep only the newest publication snapshot within each fiscal year so a
-- public query cannot accidentally sum successive revisions together.
DECLARE source_run_id STRING DEFAULT '2da4e580-7cb9-4d9f-ad62-b4fcd6f66014';
DECLARE source_snapshot_id STRING DEFAULT '4ae98aa6dfc444554391602293d140f302453e8d35bc896a9d24ede7cb393299';
DECLARE source_name STRING DEFAULT 'NYC Expense Budget — Object Code';
DECLARE source_url STRING DEFAULT 'https://data.cityofnewyork.us/resource/mwzb-yiwb.json';
DECLARE archive_uri STRING DEFAULT 'gs://czbudget-janrezab-data-layers/processing-runs/us-major-cities/2da4e580-7cb9-4d9f-ad62-b4fcd6f66014/raw/nyc-expense-budget-object-code.json';
DECLARE completed_uri STRING DEFAULT 'gs://czbudget-janrezab-data-layers/processing-runs/us-major-cities/2da4e580-7cb9-4d9f-ad62-b4fcd6f66014/completed.json';

MERGE `czbudget-janrezab.budget_detail.public_entity_aliases` AS target
USING (
  SELECT 'US_CENSUS_GOV_ID' AS alias_system, '362061194805' AS alias_value,
         'US:NYC' AS public_entity_id, 'New York City' AS alias_label,
         'us-major-cities-vintage-2025' AS source_id,
         'https://www2.census.gov/programs-surveys/gov-finances/tables/2022/2022_Individual_Unit_File.zip' AS evidence_url
) AS source
ON target.alias_system = source.alias_system AND target.alias_value = source.alias_value
WHEN NOT MATCHED THEN INSERT (
  alias_system, alias_value, public_entity_id, alias_label, valid_from, valid_to,
  source_id, evidence_url, loaded_at
) VALUES (
  source.alias_system, source.alias_value, source.public_entity_id, source.alias_label,
  NULL, NULL, source.source_id, source.evidence_url, CURRENT_TIMESTAMP()
);

MERGE `czbudget-janrezab.budget_detail.municipal_source_snapshots` AS target
USING (
  SELECT 'nyc-expense-budget-object-code' AS source_id, source_run_id AS ingestion_run_id,
         source_snapshot_id AS snapshot_id, 'US:NYC' AS public_entity_id,
         'native_granular' AS dataset_layer, source_name AS source_name,
         source_url AS source_url,
         'https://data.cityofnewyork.us/City-Government/Expense-Budget/mwzb-yiwb' AS landing_page_url,
         'mwzb-yiwb' AS source_dataset_id, 'retrieved-2026-09-19' AS source_vintage,
         TIMESTAMP('2026-09-19T20:19:21.841635Z') AS retrieved_at,
         source_snapshot_id AS content_sha256, archive_uri AS archive_uri,
         1137678 AS row_count, completed_uri AS completed_marker_uri
) AS source
ON target.source_id = source.source_id
 AND target.ingestion_run_id = source.ingestion_run_id
 AND target.snapshot_id = source.snapshot_id
 AND target.public_entity_id = source.public_entity_id
WHEN NOT MATCHED THEN INSERT (
  source_id, ingestion_run_id, snapshot_id, public_entity_id, dataset_layer,
  source_name, source_url, landing_page_url, source_dataset_id, source_vintage,
  published_at, retrieved_at, content_sha256, archive_uri, archive_generation,
  row_count, schema_json, completed_marker_uri, loaded_at
) VALUES (
  source.source_id, source.ingestion_run_id, source.snapshot_id, source.public_entity_id,
  source.dataset_layer, source.source_name, source.source_url, source.landing_page_url,
  source.source_dataset_id, source.source_vintage, NULL, source.retrieved_at,
  source.content_sha256, source.archive_uri, NULL, source.row_count, NULL,
  source.completed_marker_uri, CURRENT_TIMESTAMP()
);

DELETE FROM `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage`
WHERE fiscal_year BETWEEN 2017 AND 2027
  AND source_id = 'nyc-expense-budget-object-code'
  AND ingestion_run_id = source_run_id;

INSERT INTO `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage`
WITH parsed AS (
  SELECT
    record_ordinal,
    record_json,
    SAFE_CAST(JSON_VALUE(record_json, '$.fiscal_year') AS INT64) AS fiscal_year,
    JSON_VALUE(record_json, '$.publication_date') AS publication_date,
    JSON_VALUE(record_json, '$.agency_number') AS agency_number,
    JSON_VALUE(record_json, '$.agency_name') AS agency_name,
    JSON_VALUE(record_json, '$.unit_appropriation_number') AS unit_appropriation_number,
    JSON_VALUE(record_json, '$.unit_appropriation_name') AS unit_appropriation_name,
    JSON_VALUE(record_json, '$.responsibility_center_code') AS responsibility_center_code,
    JSON_VALUE(record_json, '$.responsibility_center_name') AS responsibility_center_name,
    JSON_VALUE(record_json, '$.budget_code_number') AS budget_code_number,
    JSON_VALUE(record_json, '$.budget_code_name') AS budget_code_name,
    JSON_VALUE(record_json, '$.object_class_number') AS object_class_number,
    JSON_VALUE(record_json, '$.object_class_name') AS object_class_name,
    JSON_VALUE(record_json, '$.object_code') AS object_code,
    JSON_VALUE(record_json, '$.object_code_name') AS object_code_name,
    JSON_VALUE(record_json, '$.personal_service_other_than_personal_service_indicator') AS service_type,
    JSON_VALUE(record_json, '$.financial_plan_savings_flag') AS savings_flag,
    retrieved_at,
    COUNT(*) OVER (PARTITION BY record_json) AS exact_duplicate_count
  FROM `czbudget-janrezab.processing_us_major_cities.source_rows_2da4e580`
  WHERE source_id = 'nyc-expense-budget-object-code'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY record_json ORDER BY record_ordinal) = 1
),
latest AS (
  SELECT * FROM parsed
  WHERE fiscal_year BETWEEN 2017 AND 2027
  QUALIFY publication_date = MAX(publication_date) OVER (PARTITION BY fiscal_year)
),
measures AS (
  SELECT latest.*, measure.stage AS budget_stage, measure.amount_string
  FROM latest
  CROSS JOIN UNNEST([
    STRUCT('adopted' AS stage, JSON_VALUE(record_json, '$.adopted_budget_amount') AS amount_string),
    STRUCT('revised' AS stage, JSON_VALUE(record_json, '$.current_modified_budget_amount') AS amount_string),
    STRUCT('forecast' AS stage, JSON_VALUE(record_json, '$.financial_plan_amount') AS amount_string)
  ]) AS measure
  WHERE SAFE_CAST(measure.amount_string AS NUMERIC) IS NOT NULL
),
shaped AS (
  SELECT
    *,
    TO_JSON(STRUCT(
      agency_number, agency_name, unit_appropriation_number, unit_appropriation_name,
      responsibility_center_code, responsibility_center_name, budget_code_number,
      budget_code_name, object_class_number, object_class_name, object_code,
      object_code_name, service_type, savings_flag, publication_date
    )) AS native_dimensions,
    TO_JSON(STRUCT(
      'US:NYC' AS public_entity_id, fiscal_year, publication_date,
      budget_stage, agency_number, unit_appropriation_number,
      responsibility_center_code, budget_code_number, object_class_number,
      object_code, service_type, TO_HEX(SHA256(record_json)) AS source_line_sha256
    )) AS fact_identity
  FROM measures
)
SELECT
  TO_HEX(SHA256(TO_JSON_STRING(fact_identity))) AS fact_id,
  fact_identity,
  'US:NYC' AS public_entity_id,
  fiscal_year,
  'FY' AS fiscal_period,
  DATE(fiscal_year - 1, 7, 1) AS period_start,
  DATE(fiscal_year, 6, 30) AS period_end,
  'city_government_expense_budget' AS reporting_scope,
  budget_stage,
  'expenditure' AS budget_side,
  'currency_amount' AS measure_type,
  SAFE_CAST(amount_string AS NUMERIC) AS measure_value,
  'USD' AS measure_unit,
  'USD' AS currency_code,
  1 AS amount_scale,
  native_dimensions,
  TO_HEX(SHA256(TO_JSON_STRING(native_dimensions))) AS native_dimension_signature,
  object_code AS native_line_code,
  object_code_name AS native_line_name,
  object_class_number AS parent_native_line_code,
  CONCAT('object_code:', publication_date) AS view_id,
  CONCAT('nyc:expense_object_code:', CAST(fiscal_year AS STRING), ':', publication_date, ':', budget_stage) AS additive_group_id,
  TRUE AS is_additive,
  CAST(NULL AS STRING) AS non_additive_reason,
  FALSE AS is_summary_row,
  'nyc-expense-budget-object-code' AS source_id,
  source_run_id AS ingestion_run_id,
  source_snapshot_id AS snapshot_id,
  record_ordinal AS source_row_number,
  CAST(NULL AS STRING) AS source_sheet,
  TO_HEX(SHA256(record_json)) AS source_record_id,
  CONCAT('record:', CAST(record_ordinal AS STRING)) AS source_line_locator,
  TO_HEX(SHA256(record_json)) AS source_line_sha256,
  source_url AS source_url,
  TIMESTAMP(retrieved_at) AS retrieved_at,
  'published_subset' AS coverage_type,
  FALSE AS is_imputed,
  IF(
    exact_duplicate_count > 1,
    ['source_exact_duplicate_collapsed'],
    CAST([] AS ARRAY<STRING>)
  ) AS quality_flags,
  CURRENT_TIMESTAMP() AS loaded_at
FROM shaped;

ASSERT (
  SELECT COUNT(*) > 0
  FROM `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage`
  WHERE fiscal_year BETWEEN 2017 AND 2027
    AND source_id = 'nyc-expense-budget-object-code'
    AND ingestion_run_id = source_run_id
) AS 'NYC object-code stage is empty';

ASSERT (
  SELECT COUNT(*) = COUNT(DISTINCT fact_id)
  FROM `czbudget-janrezab.budget_detail._municipal_native_budget_fact_stage`
  WHERE fiscal_year BETWEEN 2017 AND 2027
    AND source_id = 'nyc-expense-budget-object-code'
    AND ingestion_run_id = source_run_id
) AS 'NYC object-code stage contains duplicate facts';
