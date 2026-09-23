CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_ownership_stage` (
  country_code STRING NOT NULL, period INT64 NOT NULL,
  isic_section STRING NOT NULL, employer_sector STRING NOT NULL,
  persons_thousands FLOAT64 NOT NULL, source_value STRING NOT NULL,
  obs_status STRING, source_code STRING NOT NULL, source_note STRING,
  source_url STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_ownership_observations` (
  release_id STRING NOT NULL, country_code STRING NOT NULL, period INT64 NOT NULL,
  isic_section STRING NOT NULL, employer_sector STRING NOT NULL,
  persons_thousands FLOAT64 NOT NULL, source_value STRING NOT NULL,
  obs_status STRING, source_code STRING NOT NULL, source_note STRING,
  source_url STRING NOT NULL, published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id, country_code, isic_section;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_labour_status_stage` (
  country_code STRING NOT NULL, period INT64 NOT NULL, metric STRING NOT NULL,
  value FLOAT64 NOT NULL, unit STRING NOT NULL, source_value STRING NOT NULL,
  age_group STRING NOT NULL, obs_status STRING, source_code STRING NOT NULL,
  source_note STRING, source_url STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_labour_status_observations` (
  release_id STRING NOT NULL, country_code STRING NOT NULL, period INT64 NOT NULL,
  metric STRING NOT NULL, value FLOAT64 NOT NULL, unit STRING NOT NULL,
  source_value STRING NOT NULL, age_group STRING NOT NULL, obs_status STRING,
  source_code STRING NOT NULL, source_note STRING, source_url STRING NOT NULL,
  published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id, country_code, metric;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_workforce_release_pointer` (
  dataset_id STRING NOT NULL, release_id STRING NOT NULL,
  period INT64 NOT NULL, published_at TIMESTAMP NOT NULL
);
