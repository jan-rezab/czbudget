-- Run after standard billing export is enabled and its exact table is verified.
-- Replace VERIFIED_EXPORT_TABLE with the console-selected export table ID.
-- Currency stays explicit: never relabel USD or EUR rows as CZK.
SELECT DATE(usage_start_time) usage_date, invoice.month invoice_month,
 project.id project_id, service.description service, sku.id sku_id,
 sku.description sku, currency,
 SUM(cost) gross_cost,
 SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c),0)) credits,
 SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c),0)) net_cost,
 COUNTIF(cost_type='tax') tax_rows,
 COUNTIF(cost_type='adjustment') adjustment_rows
FROM `czbudget-janrezab.psd_cost_control.VERIFIED_EXPORT_TABLE`
WHERE project.id='czbudget-janrezab'
 AND usage_start_time>=@start_at AND usage_start_time<@end_at
GROUP BY usage_date,invoice_month,project_id,service,sku_id,sku,currency
ORDER BY usage_date,service,sku,currency;
