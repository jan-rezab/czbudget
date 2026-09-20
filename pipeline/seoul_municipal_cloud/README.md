# Seoul project-budget cloud adapter

This adapter loads the official Seoul finance portal's no-secret HTTPS Excel
export for FY2025 project-level budget and expenditure information. The portal
page issues a CSRF token, and its documented Excel-download action returns the
complete filtered workbook without an API credential. This avoids the separate
Open Data API's key requirement and insecure documented port-8088 transport.

The official catalogue says the source is updated daily and includes project,
account, department, function, current-budget, expenditure and remaining-balance
fields. It expressly excludes Seoul's 25 autonomous districts and affiliated
institutions; public-enterprise special-account expenditure is separately
accounted and absent. PSD therefore labels this only as the **Seoul Metropolitan
Government legal-government anchor**, never as the complete 22.49 million-person
UN Degree-of-Urbanization city.

The worker validates all 4,593 contiguous numbered project rows, emits separate
current-budget, actual-expenditure and unspent-balance facts, hashes raw and
normalized outputs, loads BigQuery transactionally, verifies stage counts, and
writes `completed.json` last with an immutable create-only upload.

Production build `b2137799-28c1-4ac3-ad33-e22573486db4` loaded 13,779 facts
(4,593 each for current budget, actual expenditure and unspent balance). Receipt:
`gs://czbudget-janrezab-data-layers/processing-runs/seoul-project-budget/b2137799-28c1-4ac3-ad33-e22573486db4/completed.json`.

Local tests use only synthetic fixtures:

```sh
python3 -m unittest discover -s pipeline/seoul_municipal_cloud/tests -v
python3 pipeline/seoul_municipal_cloud/submit.py --dry-run
```
