# CityVizor normalized explorer layer

This layer turns the verified CityVizor source snapshot into bounded, immutable
objects that an organization page and invoice explorer can query. It includes
all downloaded financial record types: annual accounting rows, event/project
rows, invoice-view rows, PBO plan-versus-actual rows, PBO's alternate raw
invoice view, current noticeboard records and versioned source codelists.

## What a payment row means

CityVizor's official import specification describes `KDF` as an incoming
invoice and `KOF` as an outgoing invoice. CityVizor processes date,
counterparty, description and identifier fields for these types. The public
payment export does not expose a source invoice number.

PSD treats each payment record as a row from the KDF/KOF invoice view that
preserves the source allocation. It is not a receipt, proof of bank settlement
or a unique invoice identifier. An invoice split over multiple paragraph, item
or event combinations may appear in multiple rows. Exact duplicate rows and
negative corrections remain present. The generated `row_id` is a hash of
exposed fields plus an occurrence number; it is a stable PSD row key, not an
invoice ID. The date is the source-published date from the invoice view: null
remains null, and a populated date does not prove settlement.

PBO profiles expose two representations of the same rows. The preferred public
payments API maps expense accounts to expenditure and omits the analytic unit.
The annual bulk export retains the import-side amount fields and analytic unit.
Both are published as explicitly alternate views and must never be added.

Accounting totals, event/project aggregates, plans, invoices, parent profiles
and child PBO profiles are also overlapping views. None can be summed together
to produce a consolidated spending total.

Primary source documentation:
<https://cityvizor.cz/landing/dokumentace>

## Build

From any website checkout inside the `czbudget` workspace:

```sh
python3 scripts/build-cityvizor-explorer.py \
  --snapshot ../data/source_cache/cityvizor/2026-09-09 \
  --output ../outputs/cityvizor-explorer-2026-09-09/release \
  --descriptor data/cityvizor-explorer-release.v1.json

python3 scripts/validate-cityvizor-explorer.py \
  ../outputs/cityvizor-explorer-2026-09-09/release
```

The builder first requires the complete snapshot manifest and its full
verification report. It rechecks source archive hashes and all annual accounting
controls, requires exact-cent amounts, validates row identity, uses deterministic
gzip (`mtime=0`) and replaces the release directory atomically.

## Serving contract

The serving tree belongs in object storage under the descriptor's immutable
`release_prefix`; it must not be copied into the application image. The GCS base
is the CityVizor dataset root, so object keys in the pointer are relative:

```json
{
  "schema_version": "1.0.0",
  "dataset_id": "cityvizor-normalized-financial-records",
  "release_id": "20260909-2294793cff54",
  "index": "releases/20260909-2294793cff54/index.<content-hash>.json.gz",
  "published_at": "publisher-assigned ISO 8601 timestamp"
}
```

Publish every release object first and replace `current.json` only after remote
hash validation. The committed descriptor has `published_at: null` and status
`prepared_not_published`; it records the exact candidate pointer and checksums
but is not evidence that publication happened.

The compressed index lists all 557 profiles and points to one small profile
asset each. A profile asset contains organization metadata, noticeboard records
and a compact year list. Each year has `year_summary_asset`; the server or client
loads it only for the selected year. That summary contains annual controls,
counterparty/category/month summaries and descriptors for detail shards.

Every descriptor has:

```json
{
  "path": "profiles/cityvizor-cz/8/2013/payments-0001.<content-hash>.json.gz",
  "rows": 4807,
  "bytes": 220395,
  "uncompressed_bytes": 741429,
  "sha256": "hash of compressed object",
  "content_sha256": "hash of decompressed JSON"
}
```

Detail payloads use a column declaration plus arrays to keep transfer size low:

```json
{
  "schema_version": "1.0.0",
  "kind": "payments",
  "profile_key": "cityvizor.cz/8",
  "year": 2013,
  "columns": ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"],
  "rows": []
}
```

Money is signed integer CZK cents. Clients resolve paragraph, item and PBO
synthetic-account labels with the release codelist asset, respecting validity
dates. Event and PBO analytic labels are profile/year-specific and already
included in year summaries or plan rows.
