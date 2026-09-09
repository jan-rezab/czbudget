# PAQ Research datasets on Public Spending Data

Snapshot: 9 September 2026. The public DataPAQ catalogue was downloaded in full:
539 variables, 15,908 variable/type/period/geography combinations, 15,889,230
observation cells, including 13,166,834 non-null values. Missing values remain null.

Native geography: 6,268 municipality-level records (including source territories
without a PSD municipal budget profile), 206 ORP, 77 districts, 14 regions and
one country. All 6,254 existing Czech municipal budget profiles join through
their official municipality code, not their name or IČO alone. Higher-level
observations are never assigned to the individual municipalities they contain.

`panels.json` additionally preserves 30 published chart datasets from Život k
nezaplacení (14) and Život během pandemie (16), including every published period
and respondent-group aggregate. These datasets are attached only to `stat:CZ`.
They do not represent respondents' microdata or municipality estimates.

## Use

- `/paq.html?level=obec&code=554791&lang=cs`: Plzeň municipality.
- `/paq.html?level=orp&code=3209&lang=cs`: ORP Plzeň, a distinct territory.
- `/paq.html?level=stat&code=CZ&lang=en`: Czechia and national household panels.
- `index.json`: geography, metadata counts, source/licence and payload checksums.
- `links.json`: existing PSD profile path to native PAQ territory key.
- `catalog.json.gz`: full variable metadata and field definitions.
- `000.json.gz`–`127.json.gz`: territory-keyed observation shards. A value record
  retains the original source JSON object; its field ID resolves in the catalogue.
- Each object page downloads self-contained JSON with values, relevant variable
  definitions, original sources, geography and licence information.

## Sources and rights

DataPAQ: <https://datapaq.cz/>, public `/api/bootstrap`, `/api/variables/{id}` and
`/api/compute`. PAQ's export interface specifies CC BY-NC 4.0:
<https://creativecommons.org/licenses/by-nc/4.0/>. Attribute PAQ Research / DataPAQ
and each original source recorded in the metadata. Original source conditions
also apply. Do not relicense this layer as unrestricted PSD data.

Partner panels: <https://data.irozhlas.cz/zivot/> and
<https://zivotbehempandemie.cz/>. Their published chart JSON is extracted from
the server-rendered `__NEXT_DATA__` payload, preserving titles, units, periods,
sample labels and respondent groups. Each chart links to its own methodology.
The DataPAQ licence is not automatically assigned to these partner datasets.

UI labels are bilingual; source indicator names and methodology remain in their
original Czech wording. Periods retain their source meanings: school years,
calendar years, quarters, multi-year windows and predictions are not collapsed.
Modelled savings and benefit expenditure do not become municipal budget spending.

## Reproduce and validate

```sh
python3 scripts/fetch-paq.py --output /path/to/raw-snapshot
python3 scripts/build-paq.py --snapshot /path/to/raw-snapshot --output data/paq
node scripts/validate-paq.mjs
```

The downloader is resumable, limits concurrency to three, and records request
bodies and SHA-256 hashes. Normalisation rejects incomplete snapshots, missing
catalogue combinations, conflicting duplicates and checksum changes. Validation
reconciles every cell, level and field, and checks independently sampled Plzeň
values plus the lengths of every panel time series.

Large serving files are absent from Git. `archive.json` pins their immutable GCS
archive, hydrated and verified in the existing canonical Cloud Build pipeline.
The serving runtime never needs to call PAQ. Updates require a new snapshot and
reviewed release; no background refresh was installed.

Public study pages and linked PDF/data attachments are archived separately by
`scripts/archive-paq-publications.py`; their manifest distinguishes successful
downloads from dead or restricted source links. These documents are not
republished on the site, and the catalogue is not a claim to possess private
research datasets or all data held by PAQ.
