CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.czech_healthcare_procedure_observations` (
  year INT64 NOT NULL,
  provider_ico STRING NOT NULL OPTIONS(description = 'Eight-character Czech IČO, left-padded where the source serialized it numerically'),
  procedure_code STRING NOT NULL,
  diagnosis_code STRING OPTIONS(description = 'Three-character main diagnosis from the source; null when the source leaves it empty'),
  procedure_quantity FLOAT64 NOT NULL,
  unique_patients INT64 NOT NULL,
  healthcare_contacts INT64 NOT NULL,
  source_id STRING NOT NULL,
  source_url STRING NOT NULL,
  source_sha256 STRING NOT NULL,
  source_vintage STRING NOT NULL,
  ingestion_run_id STRING NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  loaded_at TIMESTAMP NOT NULL
)
PARTITION BY RANGE_BUCKET(year, GENERATE_ARRAY(2010, 2031, 1))
CLUSTER BY provider_ico, procedure_code, diagnosis_code
OPTIONS(
  description = 'Aggregated NRHZS reported procedures by year, provider IČO, procedure and main diagnosis; not cash payments or patient-level records.',
  require_partition_filter = TRUE
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.czech_healthcare_procedure_ingestion_runs` (
  ingestion_run_id STRING NOT NULL,
  source_id STRING NOT NULL,
  source_url STRING NOT NULL,
  source_sha256 STRING NOT NULL,
  source_vintage STRING NOT NULL,
  source_bytes INT64 NOT NULL,
  rows_loaded INT64 NOT NULL,
  first_year INT64 NOT NULL,
  last_year INT64 NOT NULL,
  provider_count INT64 NOT NULL,
  retrieved_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  raw_object_uri STRING NOT NULL,
  raw_object_generation STRING
)
PARTITION BY DATE(completed_at)
CLUSTER BY source_id
OPTIONS(description = 'Immutable run receipts for the Czech NRHZS provider-procedure layer.');
