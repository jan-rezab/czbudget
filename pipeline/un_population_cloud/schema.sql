CREATE TABLE IF NOT EXISTS `czbudget-janrezab.un_population.population_age_sex` (
 release_id STRING NOT NULL, location_id INT64 NOT NULL, location_name STRING,
 location_type STRING, country_code STRING, year INT64 NOT NULL, variant_id INT64,
 variant STRING, reference_date STRING, observation_kind STRING,
 age_start INT64 NOT NULL, age_end INT64, age_label STRING,
 source_unit STRING, unit STRING, source_male STRING, source_female STRING,
 source_total STRING, male NUMERIC, female NUMERIC, total NUMERIC,
 source_record_json STRING, source_url STRING, source_sha256 STRING
)
PARTITION BY RANGE_BUCKET(year, GENERATE_ARRAY(1900, 2110, 1))
CLUSTER BY country_code, location_id, age_start, release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.un_population.demographic_indicators` (
 release_id STRING NOT NULL, country_code STRING NOT NULL, year INT64 NOT NULL,
 metric STRING NOT NULL, observation_kind STRING, source_value STRING,
 source_unit STRING, value NUMERIC, unit STRING, source_url STRING,
 value_origin STRING, precision_note STRING
)
PARTITION BY RANGE_BUCKET(year, GENERATE_ARRAY(1900, 2110, 1))
CLUSTER BY country_code, metric, release_id;
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.un_population.ingestion_runs` (
 release_id STRING, loader_git_sha STRING, published_at TIMESTAMP,
 population_age_sex_rows INT64, demographic_indicator_rows INT64,
 receipt_uri STRING, receipt_sha256 STRING
);
CREATE TABLE IF NOT EXISTS `czbudget-janrezab.un_population.release_pointer` (
 dataset_id STRING, release_id STRING, published_at TIMESTAMP
);
CREATE OR REPLACE VIEW `czbudget-janrezab.un_population.current_population_age_sex` AS
SELECT s.* FROM `czbudget-janrezab.un_population.population_age_sex` s
JOIN `czbudget-janrezab.un_population.release_pointer` p USING(release_id)
WHERE p.dataset_id='un_wpp_2024';
CREATE OR REPLACE VIEW `czbudget-janrezab.un_population.current_country_population_age_sex` AS
SELECT * FROM `czbudget-janrezab.un_population.current_population_age_sex`
WHERE country_code IS NOT NULL;
CREATE OR REPLACE VIEW `czbudget-janrezab.un_population.current_demographic_indicators` AS
SELECT s.* FROM `czbudget-janrezab.un_population.demographic_indicators` s
JOIN `czbudget-janrezab.un_population.release_pointer` p USING(release_id)
WHERE p.dataset_id='un_wpp_2024';
