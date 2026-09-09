# CityVizor public archive

The downloader follows the visible profile directory on `https://cityvizor.cz`
and its advertised external CityVizor instances. The September 2026 discovery
includes the national and Prague instances. It does not guess private profile
IDs or access administrative endpoints.

From the repository parent directory:

```sh
python3 website/scripts/download-cityvizor.py --workers 4
python3 website/scripts/verify-cityvizor.py
python3 website/scripts/build-cityvizor-catalogue.py
```

The default snapshot is `data/source_cache/cityvizor/2026-09-09/`, outside the
website's Git repository. Use `--output` for another downloader destination and
`--snapshot` for the verifier/catalogue builder. A new dated destination is
preferable to refreshing an existing historical snapshot. Resume reuses a file
only when its requested URL and SHA256 match its metadata.

## Scope and interpretation

- Every visible financial profile, including municipality/region profiles and
  contributory organizations (`pbo`), and every year advertised by accounting,
  payment-month or plan indexes.
- Original annual ZIPs: `accounting.csv`, `events.csv`, `payments.csv`.
- Public organization plans and their account labels, full paginated PBO
  payments, contracts metadata, noticeboard metadata, profile directories and
  codebooks. JSON responses are compressed without normalizing their fields.
- Linked document binaries, images, hidden profiles and administrative data are
  outside this financial-record archive. Derived dashboard views do not create
  additional accounting records.

A payment row is an accounting allocation, not necessarily a unique invoice,
receipt or bank settlement. Preserve split allocations and identical rows.
The bulk payment export and the PBO payment API are overlapping classification
views of the same underlying records. **Do not add their row counts or amounts
as if they were disjoint transactions.** Plans, cash budgets, accrual accounts,
contracts and payments represent different financial concepts. Parent and child
profiles may also overlap; the archive is not a consolidated spending total.

CityVizor coverage is voluntary and differs by profile and year. A visible
profile can have historical plans but no published payment records. The native
`municipality` category also includes a region; it is not a count of distinct
Czech municipalities.

## Integrity and pagination

Each response has retrieval time, source URL, byte size and SHA256. Source
validity is retained separately from retrieval time. Downloads are atomic at
the file level, bounded by retries and a free-disk guard. Contract pagination
uses the native unique ID; PBO payments use the complete exposed ordering tuple
because their view has no unique payment ID. Pagination continues to an empty
page even if a server returns fewer rows than requested. Indistinguishable
duplicates are retained. The source provides no atomic snapshot across requests;
ordering and checksums do not eliminate that limitation.

The verifier checks archived hashes, ZIP members, row identities, pagination
controls and native accounting/plan sums against separately retrieved API
controls using decimal arithmetic with CZK 0.01 tolerance. Source discrepancies
remain explicit. `--partial` creates a progress report; it cannot authorize a
complete published catalogue.

## Malformed source CSV recovery

The national profile 8 (Uherský Brod), 2021 `payments.csv`, contains an unquoted
carriage return in a description. Its original ZIP is retained unchanged. The
JSON recovery utility retrieves the native payment API, retains all duplicate
rows, and reconciles valid CSV rows and monetary totals by year:

```sh
python3 website/scripts/recover-cityvizor-payments-json.py --help
```

Recovery files live under `json-payment-recovery/` in the snapshot. Their
manifests identify the original ZIP hash, malformed CSV line, replacement row
counts and exact-cent controls. Prefer the recovered JSON for that payment
table; never concatenate it with the CSV. The verifier only accepts explicitly
identified malformed rows with a verified matching recovery. It does not
silently discard arbitrary malformed source rows.

The website catalogue is compact metadata with checksums and live source export
links. Those live URLs may change after the local archived snapshot. The local
archive is the reproducible copy; publishing the catalogue does not publish all
raw archive bytes through the website.
