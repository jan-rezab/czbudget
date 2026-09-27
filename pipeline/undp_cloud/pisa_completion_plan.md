# PISA existing-load completion plan

This is prepared code, not an execution approval or a submitted cloud build.
The original 179-minute checkpoint and eight cumulative failed builds remain
recorded. Obtain the required explicit extension and honor automatic review
before running `cloudbuild.complete_pisa.yaml`; do not reset the clock/count.

Dataset: original OECD PISA2022 student questionnaire, one complete native file.
Dedicated branch/worktree: `codex/undp-human-development-20260926` at
`/Users/johnwick/dev/czbudget/work-undp-human-development`.
Cloud build: `pipeline/undp_cloud/cloudbuild.complete_pisa.yaml`,
`europe-west4`, `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com`,
`plane-data` tag. No Cloud Run, website trigger or public bucket writes.

Original processing build `83c540f4-1b3a-408b-9f72-a2dc14054d02` timed out while
waiting for warehouse admission. Its parser SHA remains
`bb09ff1ba356efa6e45906f4fbc68da177acb175`; completion validator SHA is the
separately pinned full Git SHA of the submitted code. The new completion build
ID is the new release ID. No original build result is rewritten.

Existing BigQuery LOAD `e04e63ee-493d-48e3-9010-2381875af683` has now completed
successfully, with 613,745 output records: 613,744 native cases plus one metadata
record; zero bad records, one input file. It completed at Unix milliseconds
1790473340259. Its existing private destination is
`czbudget-janrezab.undp_human_development.stage_report_records_83c540f4_1b3a_408b_9f72_a2dc14054d02`.
Native input file count and full job configuration are pinned by the tested pure
contract. BigQuery reports 15,647,027,956 expanded input bytes. This differs from
the gzip object's 3,152,627,132 compressed bytes; each is validated separately.
The current PISA release pointer is absent: successful LOAD is not publication.

Reuse the exact existing job, never issue a replacement respondent LOAD. Verify
its source URI, EU location, destination, seven-field schema, WRITE_TRUNCATE,
maxBadRecords=0, successful terminal state and full output count. On an existing
job error, stop; do not silently retry the source or warehouse load.

Pinned source checkpoint:
`gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/83c540f4-1b3a-408b-9f72-a2dc14054d02/processed/oecd_pisa2022_1.json`.
The source raw URL/hash/generation are in `receipts/pisa-processed-checkpoint.json`.
Existing stage:
`gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/83c540f4-1b3a-408b-9f72-a2dc14054d02/staging/1790472465967860737/oecd_pisa2022_1.jsonl.gz`,
generation 1790472497895342,
SHA256 `a8eb3c6803d2b8c5c26e244451902c37713ea281dc11654a73c7bfdfbf4075da`.
The completion worker streams this cloud-only compressed object to SHA256 and
checks latest generation before and after; it does not decompress, parse SAV,
or re-download original raw data.

Only the 2,574-byte source catalog needs admission:
`gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/83c540f4-1b3a-408b-9f72-a2dc14054d02/staging/1790472501449015320/catalog.jsonl`,
generation 1790472501519716,
SHA256 `4d66154d808e7cfcdd91b8cd7a0679fee304de44d28fd7a9737eda0ed0af47a0`.
Its one metadata row is loaded with a deterministic job ID into a tiny
completion-specific catalog table. No respondent values are loaded again.

Validate existing physical rows: exactly 613,745 unique source/member/row keys,
all original release/source URL/hash identities, exactly one native metadata
row declaring 613,744 source cases. Require existing private serving views.
Atomic transaction inserts records and catalog using SELECT * REPLACE(new
release ID), records a completion receipt and flips only
`hdr_report_sources_2025:pisa`. Assert the previous pointer has not changed.
The existing transaction retry helper retries only confirmed aborted
transactions and verifies uncertain commits. Same completion build ID is
idempotent through prepared receipt hash and ingestion-run verification.

Receipt/raw destination for the completion:
`gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-sources/NEW_BUILD_ID/`;
no new source raw file is produced. Original raw and processed stage remain
immutable. The completion's only temporary warehouse stage is its tiny catalog;
original PISA stage is preserved. Publication exposes provider records only to
private warehouse consumers; report filtering, weights and aggregates require
separate verified transformations. No public microdata export is authorized.

Focused proof: six synthetic contract/worker-boundary tests pass. The contract
also passed against actual terminal BigQuery job metadata. Read-only warehouse
validation returned613745 rows/unique keys, zero wrong source identities and one
metadata row declaring613744 native cases (`receipts/pisa-warehouse-stage-validation.json`).
No cloud continuation
has been submitted.
