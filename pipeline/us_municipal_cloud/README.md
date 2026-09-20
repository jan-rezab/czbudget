# US major-city cloud acquisition

This job acquires reviewed official budget data for US cities with populations
over 500,000. It complements the nationwide comparable finance layer with each
city's more granular native budget records. It does not claim that local charts
of accounts are nationally standardized.

The source of truth is
`../config/us_major_cities_sources.json`. A URL is fetched only when its **source
object** has `status: "import_ready"`. A city's discovery or readiness status is
never sufficient. Each import-ready source needs a unique lowercase `id`, an
HTTPS `url` (or `download_url`), `source_kind` (`broad` or `granular`), and
`format` (`csv`, `json`, `jsonl`, `arcgis_json`, `xlsx`, `zip_csv`, or `zip_fixed_width`). City identity may be placed on
the source or inherited from its containing city. Optional `field_map` keys are
`fiscal_year`, `department`, `fund`, `category`, `description`, and `amount`.
Unmapped native fields remain losslessly represented in `record_json`. Socrata
resource JSON endpoints are detected and fetched in stable `:id` order using
`$limit`/`$offset` pages until a short final page is received; a raw run is never
mistaken for the API's default 1,000-row response.

ArcGIS FeatureServer layers use `arcgis_json`. The worker reads layer metadata,
uses the OID field for stable ordering when available, and follows
`resultOffset`/`resultRecordCount` until the service reports completion. It
requests all fields, retains every feature's attributes, and fails on ArcGIS
error objects or pagination that stops making progress.

For `zip_fixed_width`, optional `archive_member` selects ZIP members by regular
expression and reviewed `fixed_width_fields` supplies zero-based, end-exclusive
`name`/`start`/`end` slices. Without slices the complete native line is still
preserved only in the immutable raw archive. The run emits a ZIP member inventory
and marks that source `acquired_only`, not normalized; undocumented Census layouts
are never silently guessed. `completed.json` reports separate `normalized` and
`acquired_only` counts.

XLSX workbooks retain every non-empty row and cell (column letters plus sheet
and row coordinates) in `record_json`. A reviewed `sheet`/`worksheet` may be
declared; otherwise the import fails unless exactly one worksheet is non-empty.

## Cloud-only lifecycle

`submit.py` creates a temporary submission context containing only `worker.py`,
the pinned requirements, Cloud Build configuration, and a copy of the reviewed
registry. Cloud Build then:

1. downloads official sources into its ephemeral `/workspace`;
2. immediately stores each immutable raw payload and metadata receipt under
   `gs://czbudget-janrezab-data-layers/processing-runs/us-major-cities/<build-id>/raw/`;
3. parses it into source-preserving Parquet, validates non-empty output and
   checks hashes (records are streamed in bounded batches rather than retained
   as a bulk in-memory or local-Mac dataset);
4. publishes normalized files and receipts; and
5. writes `completed.json` last.

Consumers must reject any run without `completed.json`. Raw objects carry
SHA-256 custom metadata, and adjacent metadata JSON records requested and
resolved URLs, retrieval time, content type, byte count, source definition, and
hash. Runs are build-ID-addressed and must not overwrite or expire historical
cloud backups.

Submit only after registry review:

```sh
python3 website/pipeline/us_municipal_cloud/submit.py --dry-run
python3 website/pipeline/us_municipal_cloud/submit.py --account jan@ravineo.com
```

No real Cloud Build is part of the scaffold change. Local verification uses only
small synthetic fixtures:

```sh
python3 -m unittest discover -s website/pipeline/us_municipal_cloud/tests -v
```
