# HDR 2025 original-provider source ingestion

This task corrects the earlier scope claim. UNDP's statistical files and survey
are already published, but they do not include every dataset cited in the report.
The audit directory maps figures and selected numerical prose to primary sources,
newer source releases, related sources, custom calculations and access gaps.
Narrative auditing is explicitly non-exhaustive; no complete-report claim is made.

Run the source worker only from this dedicated branch/worktree with
`cloudbuild.report_sources.yaml`, `europe-west4`, `psd-data-builder`, `plane-data`.
Raw and staging: private bucket processing-runs/hdr-report-sources/BUILD_ID/.
Warehouse: undp_human_development.report_source_records/report_source_catalog;
publication pointer: release_pointer dataset_id hdr_report_sources_2025.
No website deployment, route or public serving export is part of this task.

The worker preserves source records and original spreadsheet representations,
codebooks and missing-value semantics. They are not all canonical country metrics.
Formula and cached spreadsheet rows are distinct representations, never additive
observations. CSV fields are literal strings. Parquet IEEE special values retain
a tagged representation. SAV/DTA user missing codes and metadata remain explicit.

Every available source is downloaded on the cloud worker, immutably stored,
generation-pinned and SHA256 checked before parsing. Expected publisher SHA/MD5
are checked when available. Each source produces an isolated complete staging
file; a failed source contributes zero records. Metadata lists failures and
unparsed archive members. Supported members are parsed; code, restricted binary
research objects and unsupported formats remain in the private raw package.
The large Park archive is held raw pending component adapters/licence review;
its original compact Figure 2 XLSX is ingested independently.

Available validated source releases publish together only after per-source and
whole-bundle row counts and unique source/member/ordinal keys pass in BigQuery.
The atomic transaction inserts immutable records/catalogue and changes one release
pointer. A prepared immutable receipt permits recovery after a committed release.
Retries pin existing per-source raw checkpoints; unpublished staging tables are
specific to the build and can be replaced. Receipt publication is a separate status.
This is a collection of validated available source records, not certification that
all report dependencies or numerical calculations have been loaded.

WID enumerates every catalogue code with pretax-income variables from the author's
published R code-vector file, parsing it as text without executing R. Each country
or aggregate file is held in full raw; only adult equal-split pretax income,
richest 1% cells sptinc992j/p99p100 enter the source-record layer, with explicit
received/selected/excluded counts. Shares remain proportions. WDI/PIP household
quintiles and Gini have different welfare definitions and remain separate.

Reviewed factual claims have original unit, period, geography, denominator,
coverage, exact URL and correction rationale. Their original pages are acquired
before these rows enter current_verified_report_claims. Source years and revised
vintages are not collapsed. Withdrawn papers do not enter verified claim facts.

The local synthetic tests check exact decimal CSV strings, duplicate header
retention, missing values, safe archive paths, original formulas, complete API
pagination and non-executing GeoJSON parsing. Bulk originals never download to the
Mac. Cloud-side parsing and publication remain unverified until a completed receipt
and pointed release have been read back.
