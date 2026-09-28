# Russia supplier serving export

Dedicated branch `codex/bq-cost-safeguards-20260927`, worktree
`work-bq-cost-safeguards`; config `pipeline/russia_suppliers/cloudbuild.yaml`.
Submit in europe-west4 as psd-data-builder, tagged plane-data. This worker
never deploys or modifies Cloud Run and never runs from a website build.

One bounded scan pins published budget_detail.trade_observations and trade_areas
to a warehouse UTC timestamp. Source selection, deduplication and sums match
the existing annual exporter-reported Russia supplier query. All 104 supported
product baskets are calculated together. Annual/monthly grains remain separate;
World and group rows are excluded. Empty baskets disclose absent observations.
Exact decimal money and source provenance survive the export.

Private immutable raw SQL/extract, staging and receipts live at
gs://czbudget-janrezab-data-layers/processing-runs/russia-trade-suppliers/<build-id>/.
Generation/hash-verified serving files live under the existing private serving
bucket prefix static-assets/russia-trade-suppliers/releases/<build-id>/.
The sole publication pointer is static-assets/russia-trade-suppliers/current.json
in czbudget-janrezab-public-snapshots; it changes with a generation compare-and-swap
only after all controls and readbacks pass. Source/normalized row counts and
USD totals by reporter/partner/annual period are in the completion receipt.

Per-query and cumulative scan admission is 96 GiB (the time-pinned dry run estimated 94,896,623,957 bytes;
less than USD 0.59 gross at USD 6.25/TiB). A missing estimate or breached
limit holds publication. A retry reuses immutable raw data; competing releases
cannot overwrite the pointer. No raw/staging deletion, schedule or website
release is installed. Refresh explicitly after a verified warehouse update.

Submit an explicit small source bundle of this directory plus
pipeline/undp_cloud/query_costs.py, with _LOADER_SHA set to its exact committed
Git SHA. The consumer is /api/v1/trade/russia-aggregate. Its hub totals retain
their independent narrow queries; this export replaces the broad supplier scan.
