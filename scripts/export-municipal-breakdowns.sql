WITH filtered_facts AS (
  SELECT
    fact.public_entity_id,
    entity.national_entity_code AS ico,
    fact.fiscal_period,
    fact.budget_stage,
    fact.budget_side,
    fact.functional_paragraph_code,
    fact.economic_item_code,
    fact.amount_local,
    fact.is_consolidation_item,
    fact.is_summary_row,
    fact.source_id,
    fact.ingestion_run_id
  FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` AS fact
  JOIN `czbudget-janrezab.budget_detail.public_entities` AS entity
    USING (public_entity_id)
  WHERE fact.fiscal_year = 2025
    AND fact.ingestion_run_id = "cz-finm-2025-all-municipalities-v1"
),
aggregated AS (
  SELECT
    public_entity_id,
    ico,
    fiscal_period,
    budget_stage,
    'purpose_expenditure' AS dimension,
    functional_paragraph_code AS code,
    SUM(amount_local) AS amount_local,
    ANY_VALUE(source_id) AS source_id,
    ANY_VALUE(ingestion_run_id) AS ingestion_run_id
  FROM filtered_facts
  WHERE budget_side = 'expenditure'
    AND functional_paragraph_code IS NOT NULL
    AND NOT is_consolidation_item
  GROUP BY public_entity_id, ico, fiscal_period, budget_stage, code
  HAVING amount_local != 0

  UNION ALL

  SELECT
    public_entity_id,
    ico,
    fiscal_period,
    budget_stage,
    CONCAT('economic_', budget_side) AS dimension,
    economic_item_code AS code,
    SUM(amount_local) AS amount_local,
    ANY_VALUE(source_id) AS source_id,
    ANY_VALUE(ingestion_run_id) AS ingestion_run_id
  FROM filtered_facts
  WHERE NOT is_consolidation_item
    AND (budget_side != 'financing' OR NOT is_summary_row)
  GROUP BY public_entity_id, ico, fiscal_period, budget_stage, budget_side, code
  HAVING amount_local != 0
)
SELECT
  public_entity_id,
  ico,
  fiscal_period,
  budget_stage,
  dimension,
  TO_JSON_STRING(
    ARRAY_AGG(
      STRUCT(code, CAST(amount_local AS STRING) AS amount_czk)
      ORDER BY ABS(amount_local) DESC, code
    )
  ) AS entries_json,
  CAST(SUM(amount_local) AS STRING) AS total_czk,
  ANY_VALUE(source_id) AS source_id,
  ANY_VALUE(ingestion_run_id) AS ingestion_run_id
FROM aggregated
GROUP BY public_entity_id, ico, fiscal_period, budget_stage, dimension
ORDER BY ico, budget_stage, dimension;
