WITH used_codes AS (
  SELECT
    'purpose' AS dimension,
    functional_paragraph_code AS code,
    ANY_VALUE(functional_paragraph_name) AS name_cs
  FROM `czbudget-janrezab.budget_detail.municipal_budget_line_details`
  WHERE fiscal_year = 2025
    AND functional_paragraph_code IS NOT NULL
  GROUP BY code

  UNION ALL

  SELECT
    'economic' AS dimension,
    economic_item_code AS code,
    ANY_VALUE(economic_item_name) AS name_cs
  FROM `czbudget-janrezab.budget_detail.municipal_budget_line_details`
  WHERE fiscal_year = 2025
  GROUP BY code
)
SELECT
  dimension,
  code,
  COALESCE(name_cs, CONCAT('Kód ', code)) AS name_cs
FROM used_codes
ORDER BY dimension, code;
