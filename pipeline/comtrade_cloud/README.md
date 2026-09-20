# Cloud-hosted UN Comtrade crawler

## Current data-plane continuation contract

The current manual continuation uses `cloudbuild-38key.yaml`, runs only in
`europe-west4` as `psd-data-builder`, and carries the `plane-data` tag. Its 38
active credential slots are 02-29 and 32-41. Slots 01, 30 and 31 are excluded.
The older rollout and Scheduler notes below are historical; the raw Scheduler
remains paused.

All lanes prioritize the complete monthly window from January 2024 through the
latest complete month (currently August 2026). This fills January-September
2025 and all of 2024 before resuming deep annual history. Annual work remains in
the queue and resumes automatically when no focused monthly task is ready.

The build writes immutable, content-addressed responses below
`gs://czbudget-janrezab-un-comtrade-raw/raw/`, versioned SQLite checkpoints
below `checkpoints/<archive-id>/`, and advances only
`manifests/latest.json` after raw objects and checkpoint state verify. It has no
website destination and does not load BigQuery. Every checkpoint records the
Cloud Build ID, loader Git SHA, region, service account, source configuration
hash, per-task row counts, object hashes and generations. Monthly and annual
tasks remain separate; consumers must never add World totals to bilateral rows.

This submission moves crawler execution and raw persistence off the Mac. An
ephemeral Cloud Build worker restores the latest verified SQLite checkpoint and
reference metadata from `gs://czbudget-janrezab-un-comtrade-raw`, downloads only
released tasks already in the queue, gzips each response in memory, uploads it
with the Cloud Storage JSON API, verifies the returned size, MD5 and generation,
and publishes a versioned checkpoint every 60 seconds and at shutdown.

The source upload contains only six reviewed crawler/configuration files. Bulk
raw data never enters the build source or the local workstation. Twenty-nine Secret
Manager slots are injected; slots 01 and 27-29 are excluded after live authentication
failures, leaving twenty-five active API keys. They are available
as `UN_COMTRADE_API_KEY_01` through `UN_COMTRADE_API_KEY_29` from
correspondingly numbered Secret Manager secrets. Their values are never included
in source, logs or manifests. The accounts share one WAL-backed task queue but
keep separate UTC quota ledgers. Each active credential keeps one API request in
flight at a time, yielding twenty-five parallel account lanes without triggering the
endpoint's observed same-key concurrency limit. Lanes take ten-call chunks and
are refilled as soon as each chunk finishes; a 429 honors its retry delay and
then resumes rather than retiring the key. One slow account no longer stalls
the others. Task claims and per-key quota
reservations are atomic, raw objects are content-addressed and generation-zero
protected, and only the coordinator publishes checkpoints, so parallel responses
cannot duplicate a task, overspend a ledger or race the latest manifest.

Uploads do not spawn `gcloud` once per object. The worker caches its short-lived
Cloud Build service-account token and performs one authenticated JSON API upload
per response. A retry that finds an immutable object already present verifies the
existing checksum instead of overwriting it. The `latest.json` pointer is the only
mutable object.

Before deployment, create `un-comtrade-api-key-01` through
`un-comtrade-api-key-29`, add one active API key as the `latest` version of each active slot,
and grant the existing `comtrade-builder` service account Secret Accessor on
those secrets. Do not pass key values in command arguments or build files.
The previous `un-comtrade-api-key` secret can become slot 01 through a
non-logging administrative workflow, then be retired after a successful pool run.

Run after authenticating the existing project account:

```sh
python3 pipeline/comtrade_cloud/submit.py \
  --account jan@ravineo.com \
  --max-calls-per-account 500
```

## Unattended daily execution

The production schedule is Google Cloud Scheduler job
`un-comtrade-daily-crawl` in `europe-west1`, running at 03:30 Europe/Prague.
It authenticates as the dedicated service account
`comtrade-scheduler@czbudget-janrezab.iam.gserviceaccount.com` and posts the
checked-in `scheduler-build.json` request to the regional Cloud Build API. The
request pins the already successful build source object by bucket, object name
and immutable generation. Daily execution therefore does not use a human OAuth
session or download crawler data to the Mac.

During the v2 rollout, `scheduler-build.json` intentionally remains a rollback
payload compatible with its previously proven source generation. The live
`un-comtrade-daily-crawl` job is currently paused while a manual v2 build is
finishing. Submit the candidate through `submit.py`; only after that build
publishes a verified final checkpoint should the candidate source
object/generation and v2 arguments replace the pinned scheduler payload and the
schedule be resumed.

The scheduler identity has only Cloud Build creation permission plus permission
to run the dedicated `comtrade-builder` service account. That builder identity
is the only identity used by this job to read the Comtrade Secret Manager value,
write raw objects/checkpoints in the private Comtrade bucket and emit build
logs. Retire the older Codex heartbeat after verifying a forced Scheduler run
so two daily submitters cannot race.

After the v2 promotion, the job is bounded to 500 HTTP attempts per account
(12,500 with twenty-five active keys) and 120 minutes. It checkpoints every 60
seconds instead of waiting for a global batch barrier. SQLite's atomic per-account
UTC ledger is authoritative and also hard-caps each credential at 500 attempts.
The crawl accepts only released data present in the checkpoint queue. When that
queue is empty, the worker discovers released
annual goods periods from 2023 back to 1988, archives the availability evidence,
and schedules the resulting tasks before crawling. Each UTC day it also refreshes
the complete year-to-date monthly window plus October-December of the prior year.
After the remaining annual 2025 work, approximately 80% of account lanes prioritize
that monthly window while 20% continue annual 2023 and older work. A capped
100,000-row response is split and never accepted
as complete. Missing data is not converted to zero.

This job archives raw source responses only. It reports zero BigQuery-loaded
rows. The separate loader in `pipeline/comtrade_warehouse_cloud/` pins a
published checkpoint, verifies and normalizes the selected raw responses, then
commits observations, coverage and task/hash acknowledgements atomically in
BigQuery. Keeping these jobs separate prevents downloaded rows from being
reported as loaded before validation succeeds.
