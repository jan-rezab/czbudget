# Human development report publication

`publish_reports.py` is cloud-only data-plane code. It reads the core and all currently published report-source group pointers once, then pins physical warehouse queries to those release IDs. Survey questions aggregate in BigQuery, source providers stream individually, and the complete core CSV streams to cloud temporary disk. No survey respondent records are exported publicly.

The JSON contract matches `server/human-development-store.mjs`: bilingual metadata, registered geographies, finite numeric chart fields, exact source release/URL/hash, edition, period, units, method, denominator and original reference ledger. HDRO trends and common-year calculated ranks are distinguished from official annex ranks. GDI has no welfare ranking. Components show the latest common period. Czechia has core indicators but is explicitly absent from the 21-country AI survey; `SURVEY21` is distinct from `WLD`.

The full PDF caption census is retained. Ready source topic charts do not assert the original forecasts, grouped estimates or figure recodes have been recreated. Raw provider records are not a verified chart binding. Additional providers require a published source pointer and reviewed native schema. The chapter5/6 helper adds reviewed complete HadCRUT annual/monthly native-baseline series, historical Rupp observations, an explicitly defined newer Epoch model scenario, and occupational taxonomy counts. These are source panels, not claims that the original figures or labour shares were recreated. GCP requires explicit workbook SHA/header/unit contracts. Ambiguous core units remain in the complete CSV with definition status and are excluded from charts.

Public immutable objects:

- `gs://czbudget-janrezab-public-snapshots/static-assets/human-development/releases/RELEASE/reports.json` (strict <=2MB)
- `.../observations.csv` (displayed chart rows)
- `.../core-observations.csv` (all pinned time-series metric cells, nulls, source values, aggregates and original units)
- `.../annex-observations.csv` (all pinned numeric table cells, original headers/units/notes, coordinates and source precision; original MPI2024 and newer MPI2025 remain separate vintages)

Anonymous HEAD access is checked separately for every download; failed CSV access is recorded and its public link suppressed, without changing IAM. Actual JSON access status is in the private receipt.

Successful roundtrip hashes and semantic/schema validation precede a generation-CAS update to `static-assets/human-development/current.json`. Private prepared/completed receipts live under `processing-runs/undp-human-development-reports/RELEASE/`. Interrupted runs reuse the prepared immutable object and original generation precondition; a changed pointer holds publication. No website deployment is invoked.

Root submits `cloudbuild.publish_reports.yaml` in `europe-west4` with `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com`, `plane-data`, exact `_UNDP_RELEASE` and loader SHA. This module does not submit builds. Source groups still processing remain absent from this release and are explicit gaps. Oversized JSON fails validation and leaves the prior pointer unchanged; observations are never silently truncated.

Four small synthetic tests cover common-year rank ties, GDI parity, component period selection, exact survey missing bins/Czechia gap, geography/provenance/nonfinite rejection, and full caption census separation from recreated figures.

## Private review mode

`--private-only` never opens the public bucket, writes a public object or pointer, or performs anonymous HEAD requests. It retains all semantic/count/hash validation and produces the report, chart CSV, complete core CSV and complete annex CSV exclusively under `gs://czbudget-janrezab-data-layers/processing-runs/hdr-report-review/BUILD_ID/`. Download references are authenticated `gs://` URIs labelled private, and the receipt records `publication_status=not_published` with no publication pointer.

The immutable `validated-report-manifest.json` pins private report SHA256, object generation and byte length. The PDF step accepts that manifest and renders private proof artifacts without reading a public pointer. `cloudbuild.review_reports.yaml` is a separate fail-closed data-plane configuration; root controls any submission in `europe-west4` under the data identity. A synthetic end-to-end mocked run asserts that only the private bucket is opened, no `current.json` is written, and no HTTP request occurs. No public permissions or IAM changes are introduced.
