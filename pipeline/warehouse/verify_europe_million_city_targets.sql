-- Read-only evidence query for the Europe UN WUP 2025 million-city target set.
-- It verifies legal-government anchor rows; it does not measure an urban area.
SELECT
  public_entity_id,
  COUNT(*) AS line_count,
  MIN(fiscal_year) AS first_year,
  MAX(fiscal_year) AS last_year,
  ARRAY_AGG(DISTINCT budget_stage ORDER BY budget_stage) AS stages
FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts`
WHERE fiscal_year BETWEEN 2000 AND 2100
  AND public_entity_id IN (
    'FR:69123', 'FR:75056',
    'GB:E08000003', 'GB:E08000012', 'GB:E08000025', 'GB:E08000035', 'GB:E12000007',
    'PL:1465000', 'SE:0180', 'UA:2055400000', 'UA:2600000000'
  )
GROUP BY public_entity_id
ORDER BY public_entity_id;
