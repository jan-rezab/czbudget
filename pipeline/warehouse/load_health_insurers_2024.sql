-- @payload is the reviewed cz-health-insurers-2024.json. Amounts stored in CZK.
DECLARE as_of DATE DEFAULT DATE '2024-12-31';
DECLARE run_id STRING DEFAULT CONCAT('health_insurers_2024_', GENERATE_UUID());
CREATE TEMP TABLE incoming AS
SELECT CONCAT('CZ:', JSON_VALUE(e, '$.ico')) AS public_entity_id,
       JSON_VALUE(e, '$.ico') AS ico, JSON_VALUE(e, '$.name') AS entity_name, e AS detail
FROM UNNEST(JSON_QUERY_ARRAY(@payload, '$.entities')) e;
ASSERT (SELECT COUNT(*) = 7 AND COUNT(DISTINCT ico) = 7 FROM incoming) AS 'Expected seven distinct insurers';
ASSERT (SELECT COUNTIF(LAX_INT64(detail.year) IS DISTINCT FROM 2024) = 0 FROM incoming) AS 'Wrong year';
ASSERT NOT EXISTS (
 SELECT 1 FROM incoming i JOIN `czbudget-janrezab.budget_detail.public_entities` d
 ON d.public_entity_id = i.public_entity_id WHERE d.national_entity_code IS DISTINCT FROM i.ico
) AS 'Entity ID collision';
ASSERT NOT EXISTS (
 SELECT i.ico FROM incoming i JOIN `czbudget-janrezab.budget_detail.public_entities` d
 ON d.national_entity_code = i.ico AND d.country_code_alpha3 = 'CZE'
 GROUP BY i.ico HAVING COUNT(*) > 1
) AS 'Ambiguous existing entity';
UPDATE incoming i SET public_entity_id = d.public_entity_id
FROM `czbudget-janrezab.budget_detail.public_entities` d
WHERE d.national_entity_code = i.ico AND d.country_code_alpha3 = 'CZE';
CREATE TEMP TABLE sources AS
SELECT i.public_entity_id, CONCAT('cz_health_insurers_2024_', i.ico, '_', kind) AS source_id,
 i.entity_name, i.detail, kind, source
FROM incoming i CROSS JOIN UNNEST([
 STRUCT('finance' AS kind, JSON_QUERY(@payload, '$.sources[0]') AS source),
 STRUCT('care', JSON_QUERY(@payload, '$.sources[1]'))
]);
CREATE TEMP TABLE metrics AS
SELECT i.public_entity_id, CONCAT('cz_health_insurers_2024_', i.ico, '_', metric.source_kind) AS source_id,
 metric.code, metric.value, metric.unit
FROM incoming i CROSS JOIN UNNEST([
 STRUCT('health_insurance_cash_receipts' AS code, ROUND(LAX_FLOAT64(i.detail.receipts_mczk) * 1000000) AS value, 'CZK' AS unit, 'finance' AS source_kind),
 STRUCT('health_insurance_cash_expenditure', ROUND(LAX_FLOAT64(i.detail.expenditure_mczk) * 1000000), 'CZK', 'finance'),
 STRUCT('health_insurance_cash_balance', ROUND(LAX_FLOAT64(i.detail.cash_balance_mczk) * 1000000), 'CZK', 'finance'),
 STRUCT('health_insurance_healthcare_cost', ROUND(LAX_FLOAT64(i.detail.healthcare_cost_mczk) * 1000000), 'CZK', 'care'),
 STRUCT('health_insurance_insured_persons', LAX_FLOAT64(i.detail.insured_persons), 'persons', 'finance'),
 STRUCT('health_insurance_employees_fte', LAX_FLOAT64(i.detail.employees_fte), 'FTE', 'finance')
]) metric;
CREATE TEMP TABLE balances AS
SELECT i.public_entity_id, CONCAT('cz_health_insurers_2024_', i.ico, '_finance') AS source_id,
 metric.code, metric.label, metric.amount,
 JSON_VALUE(i.detail, '$.source_cells.balance_sheet') AS source_cells
FROM incoming i CROSS JOIN UNNEST([
 STRUCT('total_assets_net' AS code, 'Aktiva netto celkem' AS label, CAST(JSON_VALUE(i.detail, '$.assets_mczk') AS NUMERIC) * 1000000 AS amount),
 STRUCT('accounting_current_result', 'Výsledek hospodaření běžného účetního období', CAST(JSON_VALUE(i.detail, '$.accounting_net_result_mczk') AS NUMERIC) * 1000000)
]) metric;
ASSERT (SELECT COUNT(*) = 42 AND COUNTIF(value IS NULL) = 0 FROM metrics) AS 'Missing metrics';
ASSERT (SELECT COUNT(*) = 14 AND COUNTIF(amount IS NULL) = 0 FROM balances) AS 'Missing balances';
ASSERT (SELECT SUM(value) = -7518507000 FROM metrics WHERE code = 'health_insurance_cash_balance') AS 'Cash balance total mismatch';
BEGIN TRANSACTION;
MERGE `czbudget-janrezab.budget_detail.public_entities` t USING incoming s
ON t.public_entity_id = s.public_entity_id
WHEN NOT MATCHED THEN INSERT
(public_entity_id,entity_name,entity_type,country_code_alpha2,country_code_alpha3,national_entity_code,national_entity_code_type,is_eu_capital,is_extra_city,default_currency_code,loaded_at)
VALUES(s.public_entity_id,s.entity_name,'public_health_insurer','CZ','CZE',s.ico,'CZ_ICO',FALSE,FALSE,'CZK',CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_sources` t USING sources s
ON t.source_id = s.source_id
WHEN MATCHED THEN UPDATE SET source_url = JSON_VALUE(s.source, '$.url'), archive_sha256 = JSON_VALUE(s.source, '$.sha256'), notes = TO_JSON_STRING(s.detail), loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(source_id,public_entity_id,source_type,source_name,source_url,dataset_code,archive_sha256,notes,loaded_at)
VALUES(s.source_id,s.public_entity_id,'health_insurance_statement',CONCAT(s.entity_name,' — MZ/MF 2024 ',s.kind),JSON_VALUE(s.source,'$.url'),'cz_health_insurers_2024_v1',JSON_VALUE(s.source,'$.sha256'),TO_JSON_STRING(s.detail),CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_metric_observations` t USING metrics s
ON t.reference_year = 2024 AND t.public_entity_id = s.public_entity_id AND t.metric_code = s.code AND t.source_id = s.source_id
WHEN MATCHED THEN UPDATE SET value = s.value, unit = s.unit, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(public_entity_id,metric_code,reference_year,value,unit,geography_code,geography_name,geography_scope,comparability_group,source_method,source_id,quality_flags,loaded_at)
VALUES(s.public_entity_id,s.code,2024,s.value,s.unit,'CZE','Česko','national','cze_public_health_insurers','reported',s.source_id,['actual_2024','individual_legal_entity','cash_balance_is_not_profit','not_company_revenue'],CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts` t USING balances s
ON t.statement_date = as_of AND t.public_entity_id = s.public_entity_id AND t.source_id = s.source_id
AND t.statement_line_code = s.code AND t.account_code = '-' AND t.balance_measure = 'current_net' AND t.reporting_scope = 'individual_legal_entity'
WHEN MATCHED THEN UPDATE SET amount_local = s.amount, source_sheet = s.source_cells, ingestion_run_id = run_id, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(public_entity_id,statement_date,reporting_scope,statement_line_code,account_code,account_name,balance_measure,amount_local,currency_code,source_id,ingestion_run_id,source_sheet,coverage_type,is_imputed,quality_flags,loaded_at)
VALUES(s.public_entity_id,as_of,'individual_legal_entity',s.code,'-',s.label,'current_net',s.amount,'CZK',s.source_id,run_id,s.source_cells,'census',FALSE,['actual_2024','cash_balance_is_not_profit'],CURRENT_TIMESTAMP());
ASSERT (SELECT COUNT(*) = 42 FROM `czbudget-janrezab.budget_detail.public_entity_metric_observations` WHERE reference_year = 2024 AND source_id IN (SELECT source_id FROM sources)) AS 'Stored metric count mismatch';
ASSERT (SELECT COUNT(*) = 14 FROM `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts` WHERE statement_date = as_of AND source_id IN (SELECT source_id FROM sources)) AS 'Stored balance count mismatch';
COMMIT TRANSACTION;
SELECT metric_code, COUNT(*) AS entities, SUM(value) AS total, ANY_VALUE(unit) AS unit
FROM `czbudget-janrezab.budget_detail.public_entity_metric_observations`
WHERE reference_year = 2024 AND source_id IN (SELECT source_id FROM sources)
GROUP BY metric_code ORDER BY metric_code;
