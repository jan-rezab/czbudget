CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.national_public_employment_stage` (
  country_code STRING NOT NULL, period INT64 NOT NULL, metric STRING NOT NULL,
  source_value STRING NOT NULL, value NUMERIC NOT NULL, unit STRING NOT NULL,
  reference_basis STRING NOT NULL, source_url STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.national_public_employment_observations` (
  release_id STRING NOT NULL, country_code STRING NOT NULL, period INT64 NOT NULL,
  metric STRING NOT NULL, source_value STRING NOT NULL, value NUMERIC NOT NULL,
  unit STRING NOT NULL, reference_basis STRING NOT NULL,
  source_url STRING NOT NULL, published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id, country_code;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.national_public_employment_release_pointer` (
  dataset_id STRING NOT NULL, release_id STRING NOT NULL,
  period INT64 NOT NULL, published_at TIMESTAMP NOT NULL
);
