-- Validate only keys touched by this bundle, with target partition pruning.
DECLARE first_period DATE DEFAULT (
  SELECT MIN(period_start) FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
  WHERE period_start >= DATE '1900-01-01'
);
DECLARE last_period DATE DEFAULT (
  SELECT MAX(period_start) FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
  WHERE period_start >= DATE '1900-01-01'
);

ASSERT (
  SELECT COUNT(*) FROM (
    SELECT s.trade_observation_id
    FROM (
      SELECT DISTINCT period_start, trade_observation_id
      FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_observations`
      WHERE period_start BETWEEN first_period AND last_period
    ) AS s
    LEFT JOIN `czbudget-janrezab.budget_detail.trade_observations` AS t
      ON t.period_start BETWEEN first_period AND last_period
      AND t.period_start = s.period_start
      AND t.trade_observation_id = s.trade_observation_id
    GROUP BY s.trade_observation_id
    HAVING COUNT(t.trade_observation_id) != 1
  )
) = 0 AS 'Loaded observation IDs must exist exactly once';

SELECT product_type, frequency, period, crawl_status,
       COUNT(DISTINCT reporter_iso3) AS reporting_areas,
       SUM(loaded_row_count) AS checkpoint_loaded_rows
FROM `czbudget-janrezab.budget_detail._un_comtrade_load_trade_dataset_coverage`
WHERE period_start >= DATE '1900-01-01'
GROUP BY product_type, frequency, period, crawl_status
ORDER BY period DESC, product_type, frequency, crawl_status;
