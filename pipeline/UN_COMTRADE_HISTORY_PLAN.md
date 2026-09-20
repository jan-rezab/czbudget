# Historical UN Comtrade execution plan

## Cloud-worker mode — current default

The crawler executes on an ephemeral Google Cloud Build worker, not on the Mac.
The submitted source contains only the reviewed crawler and its configuration.
The worker restores the verified control checkpoint from the private Comtrade
bucket, reads twenty-six numbered Secret Manager slots (retired slot 01 plus
twenty-five active keys), streams verified gzip responses back to the bucket and
publishes versioned checkpoint manifests.
Google Cloud Scheduler job `un-comtrade-daily-crawl` is configured for 03:30
Europe/Prague using dedicated `comtrade-scheduler` and `comtrade-builder`
service accounts, so scheduled execution has no dependency on a human OAuth
login. It is paused during the v2 production proof and must not be resumed until
that build publishes a verified final checkpoint and its immutable source is
pinned in the Scheduler payload.
The manual fallback is:

```sh
python3 pipeline/comtrade_cloud/submit.py --account jan@ravineo.com --max-calls-per-account 500
```

Each active account is bounded by its own atomic 500-attempt UTC ledger within a
shared 120-minute run. One lane per key keeps twenty-five accounts in parallel while
avoiding the observed same-key concurrency limit. Lanes consume ten-call
chunks behind a shared per-key start limiter. The worker uses the existing
released-data queue and preserves annual-before-monthly priority. This crawling
stage archives raw data; it does not claim those rows are loaded in BigQuery.
When the ready queue is empty, the cloud worker discovers released annual goods
periods from 2023 back to 1988, archives their availability responses and queues
the resulting work before starting account lanes.

## Direct-to-cloud v2 architecture

`run_un_comtrade_direct.py` is the cloud worker runtime and must not be launched
for bulk crawling on the Mac. Cloud Build invokes it with:

```sh
python3 pipeline/transforms/run_un_comtrade_direct.py --max-calls-per-account 500 --batch-rows 1000000 --max-minutes 120 --lanes-per-account 1 --chunk-calls 10 --checkpoint-seconds 60
```

No raw response or warehouse bundle is created on the Mac. Each uncapped UN
response is gzipped in memory and sent with one authenticated Cloud Storage JSON
API request. Immutable content-addressed objects use a generation-zero write
precondition. Before marking a task completed, require matching returned size,
MD5 and object generation and retain SHA-256. Upload failures leave the task
queued. The coordinator publishes an online SQLite backup and versioned manifest
every 60 seconds and at shutdown before moving the cloud latest-manifest pointer.
The cached service-account token replaces the former two-`gcloud`-subprocesses-
per-response path.

This mode archives source data but does **not** load it into BigQuery. The
separate `comtrade_warehouse_cloud` build pins a checkpoint, verifies the raw
response hashes, normalizes selected annual or monthly periods and commits them
with a task/hash ledger. Do not run the legacy local prepare/rolling runners
after the cloud-only migration: they restore or create bulk data on this Mac.
Their documentation below describes the earlier implementation, not the current
default.

Keep 500 daily attempted requests per key, 100,000-row cap rejection/splits,
atomic task claims and quota reservations, a 128 MiB maximum compressed single
response, and a 120-minute run bound. Pause a key on rate limits or auth failure;
direct cloud uploads do not increase UN quota.

## Rolling mode — retired local history

The 2026-09-12 rolling mode is retained only as historical recovery documentation.
Do not use it for new downloads on this Mac under the current cloud-only policy.
Its former command was:

```sh
python3 pipeline/transforms/run_un_comtrade_rolling.py --batch-rows 1000000 --max-calls 480 --max-batches 50 --max-minutes 120
```

This holds the pipeline and crawler locks throughout the run. Download batches
stop at a one-million-row target (whole source responses can overshoot by fewer
than 100,000 rows), 100 responses, or a hard 128 MiB compressed spool limit.
Raw JSON is gzipped immediately; it is never accumulated uncompressed on disk.
The special rolling-mode disk reserve is 3 GiB, with 3.25 GiB required to start
a batch or its warehouse preparation. Preparation also checks the 3 GiB reserve
every 10,000 rows. The ordinary crawler still requires 20 GiB free.

Each batch uploads to the existing private GCS bucket and verifies its raw
checksums before loading only the new, locally present responses into BigQuery.
The existing load validation and task/hash acknowledgement remain mandatory.
Local raw copies are deleted only after verified archival, and only if their
hashes still match. If space is insufficient for warehouse preparation, the
batch is archived and removed locally but stays pending for BigQuery. A failed
archive stops the run; failed loads do not advance the load ledger. A later run
archives an interrupted local spool before downloading more. No-data is not zero.

The rolling mode does not replay the old warehouse backlog before downloading.
It consumes the existing released-data queue, annual before monthly. Historical
availability discovery remains the separate quota-counted `history` command.
The shared 500-attempt daily cap includes all metadata and retries. No parallel
workers or higher subscription quota is implied. The run stops at UTC rollover.

Target: complete the configured released HS6 bilateral import/export reporting
areas for recent annual data, then older annual periods down to 1988 and monthly
periods down to 2000 as discovery confirms releases. These are intended bounds,
not a claim that every country reports every period. World totals are separate
from bilateral rows. Services remain lower priority. Full inventory size and
completion date remain unmeasured; the ~5.2 billion estimate is not a row count.

Measured gzip density: 11,697,998 raw rows in 758,745,708 bytes (~65 bytes/row).
One million rows is therefore about 65 MB in this sample, excluding warehouse
outputs, references and checkpoints. This varies by reporter and product mix.

Live rolling proof on 2026-09-12: 341,794 new rows in 27 source responses,
22,610,279 compressed bytes, uploaded and checksum-verified, successfully merged
into BigQuery with touched-ID validation, then 27 local raw copies and six
reproducible bundle files removed. Run stopped on HTTP 429 after 28 attempts,
before reaching the one-million-row target. No quota increase is assumed.
Checkpoint total afterward: 23,878,655 raw rows, 3,290 completed tasks,
18 no-data tasks, 16 split parents and 8,583 queued tasks. There are some
downloaded annual 2025 rows for 68 of 99 discovered reporting areas; this is
not a completeness claim. BigQuery's new load ledger is still being populated
and does not yet account for all pre-ledger warehouse loads.

Authorized 2026-09-10: expand beyond latest releases to historical merchandise
trade, HS6, imports and exports, bilateral partners plus separately labelled World
totals. Annual first, then monthly; services remain a lower-priority existing queue.
Do not sum World and bilateral rows or annual and monthly observations together.

## Scope and sizing

- Discover annual periods from 2025 back to 1988 and completed monthly periods
  from July 2026 back to January 2000. Bounds advance with the calendar and can
  be overridden explicitly. These are discovery bounds, not coverage claims.
- Only schedule reporter-period datasets returned by live availability. Include
  non-sovereign reporting areas and historical partners, excluding partner groups.
- Prioritize goods, annual, then existing/new queue priority; new work orders
  periods newest first and countries by GDP within each period. Existing work
  and all split descendants are preserved, without partner overlap on discovery.
- Markie's 13 million records × 400 periods implies roughly 5.2 billion rows.
  This is a planning estimate, not a measured HS6 bilateral inventory. One free
  account's theoretical 50 million/day maximum would take at least 104 days;
  twenty-five currently valid accounts raise the theoretical ceiling to 1.25 billion rows/day,
  although practical throughput is lower because of sparse batches, splitting, retries,
  load time and pauses. Exact count-only inventory remains a follow-up; do not
  present the estimate or availability totals as exact requested-grain counts.

## Implemented operating envelope

- One Cloud Build crawl owns the process lock, with one dynamically refilled
  fetch lane per active credential sharing a persistent SQLite WAL queue. After
  annual 2025, roughly 80% of lanes prioritize complete YTD monthly goods plus
  the prior October-December comparison window; the remaining lanes continue
  annual 2023 and older work.
- Each credential has its own atomic ledger capped at 500 attempted HTTP requests
  per UTC day, including retries. Reserve before sending; failed local network
  attempts conservatively count too. Twenty-five active keys provide at most 12,500
  attempted calls/day.
- Start requests no faster than one every 0.22 seconds per credential, below the
  published five-calls/second authenticated rate. Stop a key on 401/403; defer it
  on 429. The UTC boundary is a conservative internal ledger convention because
  the UN documentation does not publish its quota-reset timezone.
- Claim queue tasks and reserve quota atomically across lanes. Use ten-call chunks
  so fast lanes refill immediately without waiting for slow accounts.
- Reject/split responses at 100,000 rows. Never accept a capped single product
  as complete. Historical splits require the correct HS revision reference.
- Gzip responses in memory and upload directly with the authenticated Cloud
  Storage JSON API. Immutable content-addressed raw objects use generation-zero
  preconditions and returned size/MD5/generation verification. No local raw spool.
- Publish an online SQLite backup plus versioned manifest every 60 seconds and at
  shutdown. Only the coordinator updates `latest.json`.
- Prepare at most 50 responses per normal warehouse bundle (hard maximum 100).
  Verify source and bundle SHA-256 hashes. After successful idempotent BigQuery
  MERGE, acknowledge exact task/hash pairs in `warehouse_commits`. Failed loads
  never advance that ledger. Missing responses restore individually from GCS,
  never by mirroring the complete archive locally.
- Private GCS archive remains the raw source of truth; BigQuery stores structured
  observations. Delete local raw only after remote size/MD5 verification and
  checkpoint/manifest upload. These are different storage layers.
- Drain pending warehouse data before more downloads. First adoption replays
  old responses through the existing deduplicating MERGE because prior successful
  loads have no per-task ledger; it does not guess they were loaded.
- Cloud crawler defaults: 120-minute time cap, 500 calls per active account and
  the proven default ephemeral worker pool. No parallel full rebuild, persistent
  local service, quota evasion, or paid subscription change.

## Commands

Manual fallback entry point (the normal scheduled path is Cloud Scheduler to
Cloud Build):

```sh
python3 pipeline/comtrade_cloud/submit.py --account jan@ravineo.com --max-calls-per-account 500
```

Metadata-only discovery, safe even when downloads are disk-blocked:

```sh
python3 pipeline/transforms/crawl_un_comtrade.py history --max-periods 10 --daily-limit 500
```

## Verified on 2026-09-10

- Checkpoint: 3,263 completed, 18 no-data, 16 split, zero error tasks;
  23,536,861 raw records. Prior bounded crawl added 10,896,725 records.
- First historical discovery: 2025 (99 reporting areas), 2024 (141 reporting
  areas), 4,728 new queued tasks; queue now 8,610 tasks.
- Shared quota ledger reached 500 including four failed local DNS attempts.
- Incremental smoke bundle: two real source responses, 67 normalized rows;
  not loaded or acknowledged in BigQuery.
- Bulk execution remains blocked by Google Cloud reauthentication for
  `jan@ravineo.com` and low local disk (approximately 11 GiB free). UN API
  authentication works. Do not claim these new local rows are already in BQ.

## Current rollout state (2026-09-20)

Both cloud layers are now implemented and deliberately separate:

1. `comtrade_cloud` downloads API responses directly to immutable private GCS
   objects and publishes versioned SQLite checkpoints.
2. `comtrade_warehouse_cloud` pins one checkpoint, verifies every selected raw
   object against its stored SHA-256/task metadata, stages normalized NDJSON in
   private GCS and commits one period at a time in BigQuery.

The BigQuery transaction writes `trade_observations`,
`trade_dataset_coverage`, `trade_ingestion_runs` and the
`trade_source_responses` task/hash ledger together. It asserts unique staged
observation IDs and expected row counts before commit. Only afterward does the
worker write an immutable `completed.json` processing receipt. Queue lifetime
is twelve hours because this project currently drains the regional high-CPU
worker pool serially.

The 20 September 2026 reconciliation pins checkpoint archive
`20260920T060727102072Z-direct` (SHA-256
`bc948a2ec984665e6491a7e64dbe9f64602f825414524b95d3eb387a0e99daba`).
All 32,175 downloaded source responses in that checkpoint are acknowledged in
BigQuery: annual 2019-2025 contains 123,262,668 distinct observations from
19,294 responses, and monthly October 2025-August 2026 contains 63,583,204
distinct observations from 12,881 responses. A read-only ledger audit reports
zero pending task/hash pairs across all 18 periods. This proves processing
completeness for downloaded responses; it does not claim source acquisition is
complete. In particular, 2019 coverage still records 73 queued reporter
datasets and one partial reporter dataset, so those remain an upstream crawl
backlog rather than unprocessed downloaded data.

Routine continuation runs daily through `un-comtrade-daily-load`. Its request
pins the exact immutable loader source generation proven by the reconciliation,
processes at most two new periods per run and safely exits when the latest
checkpoint has no unacknowledged responses. After each backfill or recovery,
run `comtrade_warehouse_cloud/submit.py --audit-only --max-periods 20` and retain
the checkpoint archive ID, SHA-256 and per-period zero-pending result as the
completion receipt.

BigQuery monthly series must filter `frequency = 'M'`; annual and monthly rows
must never be added. World totals and bilateral partner rows are also separate
grains. Use `trade_dataset_coverage` to disclose reporter coverage and treat the
latest released month as potentially partial.
