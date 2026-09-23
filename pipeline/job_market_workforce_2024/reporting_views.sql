-- All current views require published release pointers. Source URLs and
-- source_value are kept for exact report attribution.
CREATE OR REPLACE VIEW `czbudget-janrezab.job_market.current_service_divisions` AS
SELECT o.* EXCEPT(published_at), o.published_at
FROM `czbudget-janrezab.job_market.job_market_service_observations` AS o
JOIN `czbudget-janrezab.job_market.job_market_service_release_pointer` AS p
  ON p.dataset_id = 'job_market_services' AND o.release_id = p.release_id;

CREATE OR REPLACE VIEW `czbudget-janrezab.job_market.current_ownership` AS
SELECT o.* EXCEPT(published_at), o.published_at
FROM `czbudget-janrezab.job_market.job_market_ownership_observations` AS o
JOIN `czbudget-janrezab.job_market.job_market_workforce_release_pointer` AS p
  ON p.dataset_id = 'job_market_workforce' AND o.release_id = p.release_id;

CREATE OR REPLACE VIEW `czbudget-janrezab.job_market.current_labour_status` AS
SELECT o.* EXCEPT(published_at), o.published_at
FROM `czbudget-janrezab.job_market.job_market_labour_status_observations` AS o
JOIN `czbudget-janrezab.job_market.job_market_workforce_release_pointer` AS p
  ON p.dataset_id = 'job_market_workforce' AND o.release_id = p.release_id;

CREATE OR REPLACE VIEW `czbudget-janrezab.job_market.public_employer_share` AS
SELECT
  t.country_code, t.period, t.isic_section,
  p.persons_thousands AS public_persons_thousands,
  p.source_value AS public_source_value,
  t.persons_thousands AS total_persons_thousands,
  t.source_value AS total_source_value,
  100 * SAFE_DIVIDE(p.persons_thousands, t.persons_thousands) AS public_percent,
  t.source_code, t.source_url, t.source_note,
  p.obs_status AS public_obs_status, t.obs_status AS total_obs_status,
  t.release_id
FROM `czbudget-janrezab.job_market.current_ownership` AS t
JOIN `czbudget-janrezab.job_market.current_ownership` AS p
  USING (release_id, country_code, period, isic_section)
WHERE t.employer_sector = 'total' AND p.employer_sector = 'public';

CREATE OR REPLACE VIEW `czbudget-janrezab.job_market.labour_population_profile` AS
WITH profile_values AS (
  SELECT country_code, period, release_id,
    MAX(IF(metric = 'employed', value, NULL)) AS employed_thousands,
    MAX(IF(metric = 'unemployed', value, NULL)) AS unemployed_thousands,
    MAX(IF(metric = 'labour_force', value, NULL)) AS labour_force_thousands,
    MAX(IF(metric = 'outside_labour_force', value, NULL)) AS outside_labour_force_thousands,
    MAX(IF(metric = 'unemployment_rate', value, NULL)) AS source_unemployment_rate_pct,
    MAX(IF(metric = 'unemployment_rate', source_value, NULL)) AS source_unemployment_rate_text,
    MAX(IF(metric = 'unemployment_rate', source_url, NULL)) AS unemployment_rate_source_url,
    MAX(IF(metric = 'employed', source_url, NULL)) AS employment_source_url,
    MAX(IF(metric = 'unemployed', source_url, NULL)) AS unemployment_source_url,
    MAX(IF(metric = 'outside_labour_force', source_url, NULL)) AS outside_labour_force_source_url
  FROM `czbudget-janrezab.job_market.current_labour_status`
  GROUP BY country_code, period, release_id
)
SELECT *,
  100 * SAFE_DIVIDE(employed_thousands, labour_force_thousands + outside_labour_force_thousands)
    AS employed_pct_working_age,
  100 * SAFE_DIVIDE(unemployed_thousands, labour_force_thousands + outside_labour_force_thousands)
    AS unemployed_pct_working_age,
  100 * SAFE_DIVIDE(outside_labour_force_thousands, labour_force_thousands + outside_labour_force_thousands)
    AS outside_pct_working_age
FROM profile_values;
