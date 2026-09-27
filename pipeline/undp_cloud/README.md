# UNDP human-development cloud data

This dedicated data branch loads every source listed in `sources.json` from the
UNDP website. Comtrade is a separate trade API and is not an upstream source.
No website build, deploy, Cloud Run modification or local bulk download occurs.

## Report query cost safeguards

`publish_reports.py` dry-runs every query before execution. The default limits
are 32 GiB per query and 64 GiB admitted scans per report run (about USD 0.39 at
USD 6.25/TiB, before allowances). `maximum_bytes_billed` also bounds execution;
unknown estimates or budget overruns hold publication. Deliberate allowance
changes use `PSD_REPORT_MAX_QUERY_BYTES` and `PSD_REPORT_MAX_RUN_BYTES`.
Prepared/completed receipts record query IDs, estimates, billed bytes and limits.

Provider records are fetched once using exact bound release/source pairs and
explicit provenance columns. An ephemeral SQLite spool on the cloud worker
serves later source iterations without rescanning BigQuery. Every source hash
and accepted row count must match its pinned catalogue before any source is
served. Source JSON text and original values are retained unchanged. The spool
has a 32 GiB limit and is removed at completion or process exit; a failed spool
cannot retry its scan inside the same run. No bulk spool runs on this Mac.

The 27 September audit found 242 uncached per-source scans across report build
attempts, billing 2,792,477,425,664 bytes. The replacement source query was
validated by a BigQuery dry run at 11,554,155,834 bytes on that table inventory.
That is one source-table scan per report attempt; future table growth can stop a
run at its budget rather than silently increasing the bill.

- Branch/worktree: `codex/undp-human-development-20260926`, `work-undp-human-development`.
- Acquisition: `cloudbuild.acquire.yaml`, Python 3.12 with pinned requirements.
- Warehouse publication: `cloudbuild.publish.yaml`.
- Region / identity: `europe-west4`, `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com`, `plane-data`.
- Raw inputs: private `gs://czbudget-janrezab-data-layers/processing-runs/undp/<raw-build-id>/raw/`.
- Staging/receipts: same bucket, `processing-runs/undp/<publication-build-id>/`.
- BigQuery: EU dataset `czbudget-janrezab.undp_human_development`.
- Atomic pointer: `release_pointer`, dataset ID `undp_bundle_2025`.

The acquisition build writes immutable original files, generation/hash-pinned
`raw-manifest.json` and a schema preview. Acquisition success is not publication.
Publication must verify every source generation/hash, normalize to isolated
staging tables, pass coverage/key/value/count controls, then change the pointer
in a single transaction. A `completed.json` receipt and matching pointed release
are required. Prior releases remain readable. Stage tables expire automatically.
Retrying the exact pinned source manifest is safe; no source or previous release
is overwritten.

HDR2025, MPI2025 October and AIHDS2025 remain separate source vintages. The
October MPI update is not silently called the report's original MPI edition.
Country rows and regional/development aggregates remain distinguishable.
Missing values and unavailable country/year/metric coverage are not imputed.
All source values, spreadsheet cells, formulas, labels, footnotes, metadata and
survey codes are retained with exact source URLs and hashes. Survey rows are
respondents, not administrative counts; weighted estimates require the supplied
survey design and cannot be extended to countries outside the survey.

Website destination: new warehouse layer for future country comparisons and
human-development reports. No existing route consumes it yet. These published
BQ views do not by themselves add charts to the website.

The acquisition receipt's loader ref is the named branch; its resolved immutable
source commit is `bd6cdd02486f0bcad507c8d3d463dae4ff696718`, recorded in the
publication receipt beside that original ref. The first acquisition attempt
failed on UTF-8 decoding of UNDP's CP1252 CSV; original bytes were preserved.
The corrected acquisition used strict CP1252 decoding and completed successfully.

The original MPI2024 workbook is acquired and preserved by the publication
worker before any staging. It is not merged with MPI2025 or labelled as an
identical report table: publication retains the official edition, survey year,
all source cells and later source revisions separately.

Query `current_country_metrics` for country/area time series; use
`current_table_observations` for income shares, adjusted component indices and
MPI tables, retaining `source_id`, `sheet`, `period` and `source_notes`.
`current_workbook_cells` provides all original footnotes and column contexts.
`current_survey_answers` is a long respondent/variable table, not a country
estimate. Join `current_variable_metadata` for questionnaire labels; use
`survey_weight` and explicit nonresponse/missing codes when calculating results.
