# India City Finance cloud ingestion

Loads standardized coded income-statement accounts from the official City Finance
public API for 15 legal municipal corporations that anchor UN WUP 2025 million-plus
built-up areas. Values are conservatively staged as reported actuals; the source
does not establish an audit opinion through this API. Calculated totals and summary
rows are excluded. Coverage is anchor-only, never the full UN agglomeration.

Run `python pipeline/india_cityfinance_cloud/submit.py` from the website root.
