# Held UN data warehouse releases

This data-only branch adds two cloud workers. Neither runs from the canonical
website checkout, regenerates website files, submits web builds, or modifies
Cloud Run. Use the existing operator `jan@ravineo.com`; run only in
`europe-west4` with the `plane-data` tag.

## Comtrade reconciliation

`pipeline/comtrade_warehouse_cloud/readiness.py` pins and verifies the preflight
checkpoint SHA, compares **every** available period with the BigQuery task/hash
ledger in one query, and reconciles all missing completed/no-data responses.
Three independent cloud processes have separate SQLite connections and scratch
directories. Each period uses the existing validated, idempotent transaction;
its response acknowledgements and observations commit together. A response is
never acknowledged just because it was downloaded or normalized.

The final audit must find zero pending responses and zero source-row-count
mismatches. It records source errors separately; loading all available raw
responses does not imply complete UN source coverage. An immutable receipt is
published only after the warehouse audit pointer transaction succeeds:

- Tables: `budget_detail.trade_observations`, `trade_dataset_coverage`,
  `trade_source_responses`, `trade_ingestion_runs`, `trade_areas`, `trade_products`.
- Readiness history and pointer: `budget_detail.un_warehouse_audits` and
  `budget_detail.un_warehouse_audit_pointer`. This pointer certifies the pinned
  checkpoint reconciliation; it is not a snapshot pointer for observation rows.
- Receipts: `gs://czbudget-janrezab-data-layers/processing-runs/un-comtrade/<run>/readiness/`.
- Identity: `comtrade-builder@czbudget-janrezab.iam.gserviceaccount.com`.
- Config: `pipeline/comtrade_warehouse_cloud/cloudbuild.readiness.yaml`.

Annual and monthly grains remain separate. World totals and bilateral partners
must not be added together. Old reporter codes, reported classifications and
coverage gaps remain visible. The current website profile adapter begins at
2000 and filters H6/HS; loading older classifications into BQ does not by itself
expand that adapter's UI coverage.

## Population

`worker.py` restores the existing generation-pinned cloud backup on the worker,
checks its complete SHA-256, reads only the selected regular WPP member and
checks that member's SHA-256. No source download or bulk local restore is needed.
Every source CSV field is retained in `source_record_json`; exact population
texts in thousands remain beside NUMERIC values converted to persons.

The held demographic indicators are ingested from the tracked serving extract,
with exact existing decimal values and `value_origin=existing_serving_extract`.
Their upstream CSV precision is unavailable in that extract and is not invented.
The raw serving extract is preserved in the immutable cloud receipt. Estimates
through 2023 and medium-variant projections from 2024 remain distinct.

Staging validates hashes, source-precision sex reconciliation, complete
location/year/age grids, unique natural keys, row counts and a normalized control
sum. One BigQuery transaction inserts both data layers and changes the release
pointer; only then is `completed.json` written. Previous releases are retained.

- Dataset: `czbudget-janrezab.un_population`, location `EU`.
- Published views: `current_population_age_sex`,
  `current_country_population_age_sex`, `current_demographic_indicators`.
- Release pointer: `un_population.release_pointer`, dataset `un_wpp_2024`.
- Provenance: `un_population.ingestion_runs` and private cloud completion receipt.
- Raw/staging/receipts: `gs://czbudget-janrezab-data-layers/processing-runs/un-population/<build-id>/`.
- Identity: `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com`.
- Config: `pipeline/un_population_cloud/cloudbuild.yaml`.
- Dataset reader: existing `psd-web-runtime` website identity. Existing population
  pages still read their serving JSON; this task makes their held UN data
  queryable in BQ without coupling it to a website deployment.

Population regions and country/area rows overlap. Use the country-only view when
comparing countries; never sum regional aggregates with country rows. Even then,
the source's territory definitions and time/reference-date semantics matter.

## Serving permission repair

The live trade API required read permission on both `trade_dataset_coverage`
and `trade_products`, in addition to its existing `trade_observations` and
`trade_areas` permissions. The repair grants only `roles/bigquery.dataViewer`
to the existing runtime on those tables. Curated trade views and the three
published ILO views plus their five observation/pointer dependencies receive
the same scoped read permission. Ingestion receipts, raw source-response
metadata, staging tables and unrelated warehouse tables are excluded.
