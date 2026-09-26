CREATE SCHEMA IF NOT EXISTS `czbudget-janrezab.undp_human_development` OPTIONS(location='EU');
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.release_pointer` (dataset_id STRING, release_id STRING, published_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.ingestion_runs` (release_id STRING, loader_git_sha STRING, published_at TIMESTAMP, receipt_uri STRING, receipt_sha256 STRING, summary_json STRING);
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.metric_observations` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, source_vintage STRING,
 country_code STRING NOT NULL, country_name STRING, geography_kind STRING,
 year INT64 NOT NULL, metric STRING NOT NULL, sex STRING,
 source_value STRING, value BIGNUMERIC, unit STRING, source_column STRING,
 source_url STRING, source_sha256 STRING, source_record_json STRING
) PARTITION BY RANGE_BUCKET(year,GENERATE_ARRAY(1900,2110,1)) CLUSTER BY country_code,metric,source_id,release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.source_records` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, row_number INT64 NOT NULL,
 country_code STRING, country_name STRING, source_record_json STRING,
 source_url STRING, source_sha256 STRING
) CLUSTER BY source_id,country_code,release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.workbook_cells` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, source_vintage STRING,
 sheet STRING NOT NULL, row_number INT64 NOT NULL, column_number INT64 NOT NULL,
 cell_address STRING, country_code STRING, country_name STRING, row_kind STRING,
 source_value STRING, source_formula STRING, value BIGNUMERIC,
 column_context STRING, number_format STRING, source_url STRING, source_sha256 STRING
) CLUSTER BY source_id,sheet,country_code,release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.survey_respondents` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, respondent_id STRING NOT NULL,
 country STRING, survey_weight BIGNUMERIC, source_record_json STRING,
 source_url STRING, source_sha256 STRING
) CLUSTER BY country,release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.survey_answers` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, respondent_id STRING NOT NULL,
 country STRING, survey_weight BIGNUMERIC, variable STRING NOT NULL,
 source_value STRING, value BIGNUMERIC, value_label STRING, missing_kind STRING
) CLUSTER BY variable,country,release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.variable_metadata` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, variable STRING NOT NULL,
 label STRING, unit STRING, metadata_json STRING
) CLUSTER BY source_id,variable,release_id;

CREATE TABLE IF NOT EXISTS `czbudget-janrezab.undp_human_development.table_observations` (
 release_id STRING NOT NULL, source_id STRING NOT NULL, source_vintage STRING,
 sheet STRING NOT NULL, row_number INT64 NOT NULL, column_number INT64 NOT NULL,
 country_code STRING, country_name STRING, geography_kind STRING, metric STRING,
 period STRING, sex STRING, unit STRING, source_value STRING, value BIGNUMERIC,
 source_notes STRING, source_url STRING, source_sha256 STRING
) CLUSTER BY source_id,sheet,country_code,release_id;
