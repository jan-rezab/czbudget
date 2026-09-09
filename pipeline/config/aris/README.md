# ARIS report templates

The historical large-city importer previously depended on `/tmp/hist0.xml` and `/tmp/hist1.xml`. Those source query definitions were not retained in this checkout and were unavailable during the September 2026 audit.

Restore the original reviewed MONITOR ARIS budget and bank-account report XML as `budget.xml` and `cash.xml`, or specify existing reviewed files with `ARIS_BUDGET_QUERY` and `ARIS_CASH_QUERY`. The importer fails before requesting data if either template is absent. Do not reconstruct the measure definitions by guessing: record the report ID, unit, row-code semantics, retrieval date and checksum alongside restored XML before using it to regenerate history.
