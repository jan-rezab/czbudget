CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_2024_stage` (
  country_code STRING NOT NULL,
  period INT64 NOT NULL,
  sector STRING NOT NULL,
  share_pct FLOAT64 NOT NULL,
  source_value STRING NOT NULL,
  source_id STRING NOT NULL,
  source_url STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_employment_shares` (
  release_id STRING NOT NULL,
  country_code STRING NOT NULL,
  period INT64 NOT NULL,
  sector STRING NOT NULL,
  share_pct FLOAT64 NOT NULL,
  source_value STRING NOT NULL,
  source_id STRING NOT NULL,
  source_url STRING NOT NULL,
  published_at TIMESTAMP NOT NULL
)
CLUSTER BY release_id, country_code;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.job_market.job_market_release_pointer` (
  dataset_id STRING NOT NULL,
  release_id STRING NOT NULL,
  period INT64 NOT NULL,
  published_at TIMESTAMP NOT NULL
);
