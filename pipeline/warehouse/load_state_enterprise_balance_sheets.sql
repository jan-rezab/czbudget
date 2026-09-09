-- Parameter: payload JSON from cz-state-enterprise-balance-sheets-2024.v1.json.
-- Reviewed summary rows, not every line of the original statements.
DECLARE as_of DATE DEFAULT DATE '2024-12-31';
DECLARE run_id STRING DEFAULT CONCAT('soe_balance_2024_', GENERATE_UUID());
CREATE TEMP TABLE incoming AS
SELECT JSON_VALUE(e, '$.ico') AS ico, JSON_VALUE(e, '$.name') AS entity_name,
       CONCAT('CZ:', JSON_VALUE(e, '$.ico')) AS public_entity_id,
       CONCAT('cz_soe_balance_2024_', JSON_VALUE(e, '$.ico')) AS source_id,
       e AS detail
FROM UNNEST(JSON_QUERY_ARRAY(@payload, '$.entities')) e;
ASSERT (SELECT COUNT(*) = 38 AND COUNT(DISTINCT ico) = 38 FROM incoming) AS 'Expected 38 distinct entities';
ASSERT (SELECT COUNTIF(JSON_VALUE(detail, '$.as_of') != '2024-12-31') = 0 FROM incoming) AS 'Wrong statement date';
ASSERT NOT EXISTS (
 SELECT 1 FROM incoming i JOIN `czbudget-janrezab.budget_detail.public_entities` d
 ON d.public_entity_id = i.public_entity_id
 WHERE d.national_entity_code IS DISTINCT FROM i.ico
) AS 'Entity ID collision';
-- Prefer the existing dimension key if the entity already exists.
ASSERT NOT EXISTS (
 SELECT i.ico FROM incoming i JOIN `czbudget-janrezab.budget_detail.public_entities` d
 ON d.national_entity_code = i.ico AND d.country_code_alpha3 = 'CZE'
 GROUP BY i.ico HAVING COUNT(*) > 1
) AS 'Ambiguous entity identifier';
UPDATE incoming i SET public_entity_id = d.public_entity_id
FROM `czbudget-janrezab.budget_detail.public_entities` d
WHERE d.national_entity_code = i.ico AND d.country_code_alpha3 = 'CZE';
CREATE TEMP TABLE balance_rows AS
SELECT i.public_entity_id, i.source_id, metric.code, metric.label, metric.amount,
       TO_JSON_STRING(JSON_QUERY(i.detail, '$.source.pdf_pages')) AS pdf_pages,
       ARRAY_CONCAT(['reviewed_summary','selected_strategic_portfolio','not_consolidated','not_available_budget_cash'],
         IF(metric.code = 'derived_non_equity_funding', ['derived_assets_minus_equity','not_interest_bearing_debt'], []),
         IF(LAX_BOOL(i.detail.separate_financial_institution), ['bank_or_egap_cash_definition'], [])) AS flags
FROM incoming i CROSS JOIN UNNEST([
 STRUCT('reported_cash' AS code, JSON_VALUE(i.detail, '$.cash_label') AS label, CAST(JSON_VALUE(i.detail, '$.cash_czk') AS NUMERIC) AS amount),
 STRUCT('total_assets_net', 'Aktiva netto celkem', CAST(JSON_VALUE(i.detail, '$.total_assets_czk') AS NUMERIC)),
 STRUCT('equity', 'Vlastní kapitál', CAST(JSON_VALUE(i.detail, '$.equity_czk') AS NUMERIC)),
 STRUCT('derived_non_equity_funding', 'Ostatní pasiva: aktiva minus vlastní kapitál', CAST(JSON_VALUE(i.detail, '$.non_equity_funding_czk') AS NUMERIC))
]) metric;
ASSERT (SELECT COUNT(*) = 152 AND COUNTIF(amount IS NULL) = 0 FROM balance_rows) AS 'Missing balance facts';
ASSERT (SELECT SUM(amount) = 129545428000 FROM balance_rows WHERE code = 'reported_cash') AS 'Unexpected cash total';
BEGIN TRANSACTION;
MERGE `czbudget-janrezab.budget_detail.public_entities` t USING incoming s
ON t.public_entity_id = s.public_entity_id
WHEN NOT MATCHED THEN INSERT
(public_entity_id, entity_name, entity_type, country_code_alpha2, country_code_alpha3, national_entity_code, national_entity_code_type, is_eu_capital, is_extra_city, default_currency_code, loaded_at)
VALUES (s.public_entity_id, s.entity_name, 'strategic_state_entity', 'CZ', 'CZE', s.ico, 'CZ_ICO', FALSE, FALSE, 'CZK', CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_sources` t USING incoming s
ON t.source_id = s.source_id
WHEN MATCHED THEN UPDATE SET source_url = JSON_VALUE(s.detail, '$.source.url'), archive_sha256 = JSON_VALUE(s.detail, '$.source.sha256'), notes = TO_JSON_STRING(s.detail), loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(source_id, public_entity_id, source_type, source_name, source_url, dataset_code, archive_sha256, retrieved_at, notes, loaded_at)
VALUES (s.source_id, s.public_entity_id, 'balance_sheet', CONCAT(s.entity_name, ' — individuální rozvaha 31. 12. 2024'), JSON_VALUE(s.detail, '$.source.url'), 'cz_state_enterprise_balance_sheets_2024_v1', JSON_VALUE(s.detail, '$.source.sha256'), TIMESTAMP(JSON_VALUE(s.detail, '$.source.accessed_on')), TO_JSON_STRING(s.detail), CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts` t USING balance_rows s
ON t.statement_date = as_of AND t.public_entity_id = s.public_entity_id
AND t.source_id = s.source_id AND t.statement_line_code = s.code
AND t.account_code = '-' AND t.balance_measure = 'current_net' AND t.reporting_scope = 'individual_legal_entity'
WHEN MATCHED THEN UPDATE SET amount_local = s.amount, account_name = s.label, source_sheet = CONCAT('PDF pages ', s.pdf_pages), quality_flags = s.flags, ingestion_run_id = run_id, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(public_entity_id, statement_date, reporting_scope, statement_line_code, account_code, account_name, balance_measure, amount_local, currency_code, source_id, ingestion_run_id, source_sheet, coverage_type, is_imputed, quality_flags, loaded_at)
VALUES (s.public_entity_id, as_of, 'individual_legal_entity', s.code, '-', s.label, 'current_net', s.amount, 'CZK', s.source_id, run_id, CONCAT('PDF pages ', s.pdf_pages), 'selected_portfolio', FALSE, s.flags, CURRENT_TIMESTAMP());
MERGE `czbudget-janrezab.budget_detail.public_entity_cash_facts` t
USING (SELECT public_entity_id, source_id, label, amount, pdf_pages, flags FROM balance_rows WHERE code = 'reported_cash') s
ON t.statement_date = as_of AND t.public_entity_id = s.public_entity_id AND t.source_id = s.source_id
AND t.cash_category_code = 'reported_balance_sheet_cash' AND t.reporting_scope = 'individual_legal_entity'
WHEN MATCHED THEN UPDATE SET amount_local = s.amount, cash_category_name = s.label, source_sheet = CONCAT('PDF pages ', s.pdf_pages), quality_flags = s.flags, ingestion_run_id = run_id, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
(public_entity_id, statement_date, reporting_scope, cash_category_code, cash_category_name, amount_local, currency_code, source_id, ingestion_run_id, source_sheet, coverage_type, is_imputed, quality_flags, loaded_at)
VALUES (s.public_entity_id, as_of, 'individual_legal_entity', 'reported_balance_sheet_cash', s.label, s.amount, 'CZK', s.source_id, run_id, CONCAT('PDF pages ', s.pdf_pages), 'selected_portfolio', FALSE, s.flags, CURRENT_TIMESTAMP());
ASSERT (SELECT COUNT(*) = 152 FROM `czbudget-janrezab.budget_detail.public_entity_balance_sheet_facts` WHERE statement_date = as_of AND source_id IN (SELECT source_id FROM incoming)) AS 'Stored balance row count mismatch';
ASSERT (SELECT COUNT(*) = 38 AND COUNT(DISTINCT public_entity_id) = 38 AND SUM(amount_local) = 129545428000 FROM `czbudget-janrezab.budget_detail.public_entity_cash_facts` WHERE statement_date = as_of AND source_id IN (SELECT source_id FROM incoming)) AS 'Stored cash verification failed';
COMMIT TRANSACTION;
SELECT run_id AS ingestion_run_id, COUNT(*) AS cash_rows, COUNT(DISTINCT public_entity_id) AS entities, SUM(amount_local) AS cash_czk
FROM `czbudget-janrezab.budget_detail.public_entity_cash_facts`
WHERE statement_date = as_of AND source_id IN (SELECT source_id FROM incoming);
