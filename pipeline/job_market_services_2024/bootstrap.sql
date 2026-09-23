CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.job_market_service_stage` (
  country_code STRING NOT NULL,
  period INT64 NOT NULL,
  isic_section STRING NOT NULL,
  isic_division STRING NOT NULL,
  persons_thousands FLOAT64 NOT NULL,
  obs_status STRING,
  source_name STRING NOT NULL,
  source_note STRING,
  source_url STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.job_market_service_observations` (
  release_id STRING NOT NULL,
  country_code STRING NOT NULL,
  period INT64 NOT NULL,
  isic_section STRING NOT NULL,
  isic_division STRING NOT NULL,
  persons_thousands FLOAT64 NOT NULL,
  obs_status STRING,
  source_name STRING NOT NULL,
  source_note STRING,
  source_url STRING NOT NULL,
  published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id, country_code, isic_section;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.budget_detail.job_market_service_release_pointer` (
  dataset_id STRING NOT NULL,
  release_id STRING NOT NULL,
  period INT64 NOT NULL,
  published_at TIMESTAMP NOT NULL
);
