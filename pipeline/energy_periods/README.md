# Energy period serving release

Refresh the small period index after a verified Comtrade warehouse publication.
Page requests read this release, rather than repeatedly aggregating the entire
warehouse. Individual period/flow requests retain their existing narrow queries.
The export is an operator-run data release; it does not install a schedule.

- Dedicated branch/worktree: `codex/bq-cost-safeguards-20260927`, `work-bq-cost-safeguards`.
- Config: `pipeline/energy_periods/cloudbuild.yaml`.
- Worker: `europe-west4`, `psd-data-builder`, `plane-data`.
- Source: the published `budget_detail.trade_observations` and `trade_areas`
  tables, both pinned to the same UTC timestamp with `FOR SYSTEM_TIME AS OF`.
- Immutable raw extract, SQL and private staging: EU bucket
  `gs://czbudget-janrezab-data-layers/processing-runs/energy-trade-periods/<build-id>/`.
- Immutable serving release: `gs://czbudget-janrezab-public-snapshots/static-assets/energy-trade-periods/releases/<build-id>/periods.json`.
- Atomic pointer: `static-assets/energy-trade-periods/current.json` in that bucket.
- Consumer: `/api/v1/trade/energy/periods`.

Each run admits at most 64 GiB of estimated scans and enforces the same execution
cap (at most USD 0.39 gross at USD 6.25/TiB). Estimates unavailable or above the
allowance hold publication. Receipts retain query ID/bytes, source SQL hash,
timestamp, original decimal aggregate text, source row counts, per-period
geographic coverage, hashes and generations. No totals mix annual and monthly
grains. This index describes loaded observed bilateral records; it does not
certify full checkpoint reconciliation or globally complete trade coverage.

Raw extract -> private stage -> validation -> immutable serving object -> pointer
compare-and-swap -> completion receipt. Failed or competing runs preserve the
previous pointer. A retry of the same build ID reuses its immutable raw extract;
a completed retry verifies its existing object and does not run another query.
Do not overwrite sources, staging artifacts, receipts or prior releases.

Submit only a small explicit source bundle containing this directory and
`pipeline/undp_cloud/query_costs.py`. Set `_LOADER_SHA` to the exact committed
source SHA and pass the data service account explicitly. Never submit the whole
checkout and never run this exporter from the website, a pre-push hook or this Mac.
No website deployment is needed for later data refreshes. Keep the release's
`snapshot_as_of` visible when assessing freshness and refresh it after future
verified ingestion; the website cannot publish a replacement itself.
