# Cloud-side UN Comtrade warehouse loader

This is the second half of the UN Comtrade data architecture. The crawler writes
immutable raw responses and immutable SQLite checkpoints to the private
`czbudget-janrezab-un-comtrade-raw` bucket. This loader pins one checkpoint,
streams only its selected archived responses into an ephemeral Cloud Build
worker, normalizes them, and commits them to partitioned BigQuery tables.

The loader never mutates the crawler checkpoint. BigQuery table
`budget_detail.trade_source_responses` is the authoritative load ledger, keyed
by crawler task and source-response SHA-256. The ledger row is written in the
same BigQuery transaction as the observations, coverage and ingestion receipt,
and only after staged observation IDs validate. A retry therefore either skips
an acknowledged response or safely replays the same idempotent period load.

The production data flow is:

```text
UN Comtrade API
  -> immutable raw response objects + versioned SQLite checkpoint (private GCS)
  -> ephemeral Cloud Build normalization/staging (private GCS)
  -> atomic period transaction (BigQuery)
  -> observations + coverage + ingestion run + source-response ledger
  -> immutable completed.json receipt (private GCS)
```

Raw objects and checkpoints are the replayable source of truth. BigQuery is the
query layer. Processing receipts prove a particular checkpoint/period load, but
they do not replace either layer.

## Bootstrap and backfill

Run the reference/bootstrap build once before parallel period loads:

```sh
python3 pipeline/comtrade_warehouse_cloud/submit.py --references-only --wait
```

It creates the schema, refreshes reporter/product references and seeds the new
response ledger from rows already present in BigQuery. It does not infer that
other archived responses were loaded.

Load one immutable checkpoint period per build. Annual and monthly loads use the
same path and validation contract:

```sh
python3 pipeline/comtrade_warehouse_cloud/submit.py --frequency A --period 2024
python3 pipeline/comtrade_warehouse_cloud/submit.py --frequency M --period 202607
```

Independent period backfills may be distributed across the explicitly allowed
EU Cloud Build regions when one regional worker pool is constrained, for
example `--region europe-west4`. Keep only one build per period; routine
scheduled continuation stays in `europe-west1`.

Omit the frequency and period for a bounded automatic continuation. It selects
recent monthly periods first, then annual periods, and skips task/hash pairs
already recorded in BigQuery:

```sh
python3 pipeline/comtrade_warehouse_cloud/submit.py --max-periods 1 --max-tasks 20000
```

## Unattended continuation

The production Cloud Scheduler job is `un-comtrade-daily-load` in
`europe-west1`, scheduled for 06:30 Europe/Prague. This follows the crawler's
03:30 window and submits `scheduler-build.json` to the regional Cloud Build API
as `comtrade-scheduler`; execution itself uses the restricted
`comtrade-builder` identity. The request pins the exact source object and GCS
generation proven by the September 2026 zero-pending checkpoint audit. It
processes at most two pending periods per run and is safe when there is nothing
new to load.

When loader code changes, first submit it manually and verify its BigQuery
transaction plus immutable receipt. Then replace both the object and generation
in `scheduler-build.json` with that successful build's resolved storage source
before updating the Scheduler job. Never point the schedule at a mutable source
archive.

The job writes normalized staging files and a checksum-bearing
`completed.json` under
`gs://czbudget-janrezab-data-layers/processing-runs/un-comtrade/<build-id>/`.
No completed marker is published before the BigQuery transaction validates.
Temporary BigQuery staging tables expire after two days and are removed after a
successful commit.

The build may wait up to twelve hours for the constrained regional high-CPU
pool, while its execution remains capped independently at four hours. Historical
periods can therefore drain serially without expiring in the queue.

## Monthly trend semantics

`trade_observations` contains annual and monthly data in the same schema. Always
filter `frequency = 'M'` for a monthly series (or `frequency = 'A'` for annual)
and group monthly data by `period_start`; never add annual and monthly rows.
Likewise, select either bilateral partners (`is_world_partner = FALSE`) or the
separately labelled World total (`is_world_partner = TRUE`) rather than summing
both. The latest month can be incomplete because publication timing differs by
reporter, so join or inspect `trade_dataset_coverage` before presenting it as a
comparable trend point.

```sql
SELECT
  period_start,
  SUM(primary_value_usd) AS imports_usd
FROM `czbudget-janrezab.budget_detail.trade_observations`
WHERE period_start BETWEEN DATE '2025-11-01' AND DATE '2026-08-01'
  AND frequency = 'M'
  AND flow_code = 'M'
  AND is_world_partner
  AND reporter_code = 203
  AND product_type = 'C'
GROUP BY period_start
ORDER BY period_start;
```

The loader only replaces data for task IDs present in the pinned checkpoint and
selected period. This permits newly downloaded responses to extend a period
without deleting unrelated reporters. `no_data` tasks are recorded in
`trade_source_responses` with zero normalized rows so they are not confused with
unprocessed tasks.

Use `submit.py --audit-only --max-periods 20` to compare the pinned checkpoint
with the BigQuery response ledger without normalizing or writing data. The audit
prints per-period available, acknowledged and pending task/hash counts plus a
bounded mismatch sample. Run it after reconciliation to prove zero pending
responses against the exact checkpoint archive ID and SHA-256.

The loader explicitly raises the `bq query` JSON row limit for ledger reads.
The CLI defaults to 100 output rows even when the query itself returns more;
leaving that default in place would make committed task/hash pairs appear
pending and trigger redundant reprocessing.

## Concurrency and recovery

- A build pins the checkpoint URI and SHA-256 from the latest manifest at start.
- Period builds may normalize and stage in parallel because each uses unique
  GCS objects and BigQuery staging tables. BigQuery can still reject concurrent
  multi-statement writes to the same target table across different partitions;
  the loader applies bounded exponential backoff and retries the complete
  idempotent period transaction until commits serialize.
- Do not run two builds for the same period deliberately. The transaction and
  task/hash ledger make a retry safe, but duplicate work wastes Cloud Build and
  BigQuery resources.
- A build killed before commit leaves no response-ledger acknowledgement. Its
  immutable staging files can be inspected; the next run safely retries.
- A build killed after commit but before its completion marker is also safe: the
  BigQuery ledger causes the next run to skip the committed responses.
- Raw archives and crawler checkpoints remain immutable and are never deleted by
  this loader.
- A successful BigQuery transaction is authoritative even if the worker exits
  before writing `completed.json`; rerun the period and the response ledger will
  skip the committed task/hash pairs. A receipt without a successful transaction
  cannot be produced by the loader.

## Validation query

```sql
SELECT
  frequency,
  product_type,
  COUNT(*) AS row_count,
  COUNT(DISTINCT crawl_task_id) AS loaded_responses,
  COUNT(DISTINCT period) AS periods,
  MIN(period_start) AS first_period,
  MAX(period_start) AS last_period
FROM `czbudget-janrezab.budget_detail.trade_observations`
WHERE period_start BETWEEN DATE '1900-01-01' AND CURRENT_DATE()
GROUP BY frequency, product_type
ORDER BY frequency, product_type;
```
