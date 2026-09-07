# Direct national industrial production downloads

The initial reference-year-2026 extraction uses the project's familiar cohort:
CZE, UKR, POL, DEU, GBR, FRA, USA, CHE, SWE, DNK. Six are EU members.
Raw and generated observations belong outside the website repository.

The governing federation design is
[Metodika federace průmyslových statistik](METHODOLOGY_industrial_federation.md),
version 1.0.0. It separates implemented source ingestion from the semantic
mapping, vintage history and selection rules required before automatic merging.

## Eurostat alongside national sources

Download a separate immutable snapshot, then assemble both source channels:

```sh
python3 scripts/fetch-industrial-eurostat-2026.py --output ../outputs/federation-new/eurostat
python3 scripts/assemble-industrial-federation.py --national ../outputs/industrial-new --eurostat ../outputs/federation-new/eurostat --output ../outputs/federation-new/overlay
python3 -m unittest discover -s tests -p 'test_industrial_eurostat.py'
```

The national input is the combined directory produced below. Eurostat uses
`sts_inpr_m`, preserving all returned industry codes, units, adjustments and
original status flags. An empty response means no observations in this query;
an endpoint error remains an explicit error, never zero. Dataset update time is
not assigned as the publication or vintage time of each observation.

The overlay retains both observations with `source_channel` and provenance.
`mapping_status=not_assessed` is deliberate: matching names/codes do not establish
equivalent population, territorial coverage, vintage or seasonal treatment.
No cross-source average, preferred value or agreement score is computed.

## Reproduce the snapshot

Use Python 3 with `openpyxl` and working system CA certificates. The other
dependencies are standard-library modules; the Anglo downloader also uses curl.
Choose a **new** output directory for each run. Some national endpoints always
return their latest vintage; rerunning cannot reconstruct a previous release.

```sh
python3 scripts/fetch-industrial-central-2026.py --output ../outputs/industrial-new/central
python3 scripts/fetch-industrial-north-2026.py --output ../outputs/industrial-new/north
python3 scripts/fetch-industrial-anglo-2026.py --output ../outputs/industrial-new/anglo
python3 scripts/fetch-industrial-east-alpine-2026.py --output ../outputs/industrial-new/east-alpine
python3 scripts/combine-industrial-direct-2026.py --input ../outputs/industrial-new
```

These are 2026 extractors, not yet a scheduled ingestion service. Swiss asset IDs
select the 19 August 2026 release. Polish release URLs select January–July 2026.
When expanding to a later release, update discovery and verify the file layout
before treating the extraction as current. Do not silently label old assets current.

## Sources

| Country | Direct source |
|---|---|
| CZE | ČSÚ open data PRU01B and PRU01C |
| POL | GUS monthly sold-production XLSX release tables |
| DEU | Destatis production tables; national Bundesbank series where documented |
| GBR | ONS DIOP CSV and series metadata |
| FRA | INSEE BDM SDMX IPI-2021 |
| USA | Federal Reserve G.17 `ip_sa.txt` and `ip_nsa.txt` |
| CHE | BFS DAM publication 2026-0246 monthly XLSX assets |
| SWE | SCB PxWeb IPI2010KedjM |
| DNK | Statistics Denmark StatBank IPOP21 |
| UKR | SSSU dataflow DF_IND_SHORT_STAT_INDUSTR_PROD, national region only |

Every output group has a raw directory, SHA256 manifest including requests and
retrieval times, observations.jsonl, and coverage.json. The combined output adds
a Czech README and a compressed JSONL copy. The combiner checks provenance,
hashes, numeric values, keys, reference periods and country coverage. It reports
missing months per series instead of filling them.

## Meaning and limits

The normalized schema preserves publisher, dataset, series ID, industry code and
label, frequency, period, measure, adjustment, unit, base period, numeric value,
revision status where known, source URL, retrieval timestamp and raw path.
Codes and coverage remain national. Aggregates overlap their component sectors.

`NSA` is unadjusted, `CA` calendar adjusted, `SA` seasonally adjusted, and `SCA`
seasonally/calendar adjusted as explicitly identified by the publisher.
Unknown metadata stays unknown. A UK index based on 2023 and a US index based on
2017 cannot be compared as absolute levels. The Ukrainian `yoy_index`,
`mom_index` and `ytd_yoy_index` are ratios with comparison=100; subtract 100 to
express growth. Cumulative indices must not be interpreted as single-month growth.

Poland covers sold production of businesses employing at least ten people, from
individual monthly releases. Switzerland releases monthly detail quarterly.
Ukraine excludes occupied and some combat-affected territories. France includes
construction series in its IPI family, and some German aggregates include
construction. Czech quarterly observations are retained separately from monthly
observations. These national extracts are not a harmonized cross-country panel.

## All-country explorer — 7 September 2026

The native `/deep-dives/industry/` section now serves 38 countries with monthly
2026 observations and four separately identified European aggregates. National
coverage remains ten countries; the additional countries come from Eurostat,
not newly implemented national crawlers. Annual 2020–2025 observations are
published separately by Eurostat in `sts_inpr_a`.

The all-country Eurostat snapshot has 192,946 observations (102,576 monthly,
90,370 annual). Discovery covers 37 countries and five aggregates; 36 countries
have monthly 2026 data. Adding national UK and US observations gives 38.
The public explorer contains 195,160 observations after explicit serving filters.
It retains current Eurostat index base 2021, excludes quarterly and cumulative
measures, and preserves national index bases. Raw snapshots retain all inputs.

Rebuild from the repository root (choose a new output folder for new snapshots):

```sh
python3 scripts/fetch-industrial-eurostat-all.py --help
python3 scripts/derive-industrial-anglo-growth.py --help
python3 scripts/build-industrial-explorer.py \
  --national ../outputs/20260907-industrial-direct/observations.jsonl \
  --derived ../outputs/20260907-industrial-all/anglo-derived/observations.jsonl \
  --eurostat ../outputs/20260907-industrial-all/eurostat/observations.jsonl
python3 -m unittest discover -s tests -p 'test_industrial*.py'
```

The explorer loads country files on demand, separates source channels and
adjustments, supports month/year selection, industry trends, table/CSV/PNG and
source citations. Missing periods remain unavailable. UK/US changes are derived
from same-series published indices and explicitly marked. Polish release URLs
are preserved per observation. No scheduled refresh or deployment is included.
Consult snapshot `coverage.json` for actual periods and endpoint failures.


## Historical extension — September 2026

`fetch-industrial-eurostat-all.py` now requests monthly observations separately
for every month from January 2010 through the current month, plus official annual
observations from 2010 through the last completed year. Whole historical years
exceed the API response limit, so requests are partitioned by month without
removing any geography, industry, adjustment or unit. Use a fresh snapshot path.
The previous 2026 snapshot remains intact. National inputs still cover 2026.

The explorer offers year buttons and uses absolute month positions in its trend
chart; January in different years is no longer the same x-coordinate. Missing
months do not get connecting line segments. Availability is source-specific.
The serving test checks all 192 monthly periods and 16 annual periods in
2010–2025 for the EU27 total-industry, calendar-adjusted, 2021-base index.


Historical download completed: 217 successful source requests, 6,875,373
observations (6,554,334 monthly and 321,039 annual), 37 countries and five
European aggregates with historical observations. Raw API responses total
141,395,977 bytes; all SHA256 manifest checks pass. The normalized JSONL is much
larger because each observation carries full provenance and dimensions.
Snapshot: `../outputs/20260907-industrial-history-monthly/eurostat/`.
Use its `observations.jsonl` as `--eurostat` when rebuilding the serving layer.


## Gzip storage and deployment

Normalized source snapshots are now retained as `observations.jsonl.gz` only.
Each uncompressed copy was removed only after comparing its SHA256 against the
fully decompressed gzip. The archive audit is stored beside the historical
snapshot as `gzip-archive-manifest.json`. The explorer builder accepts `.gz`
inputs directly; append `.gz` to historical rebuild input paths above.
Country serving payloads are committed as `.json.gz`, with uncompressed SHA256
and sizes in `data/industry/archive-manifest.json`. Cloud Build runs
`scripts/hydrate-industry.mjs` before release validation; any checksum failure
stops the release. Raw source archives are not shipped in the website image.
