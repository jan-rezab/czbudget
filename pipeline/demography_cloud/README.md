# Universal demography data plane

This loader creates one comparable demographic structure for the 195-state PSD
universe without writing generated data into the website checkout. It uses UN
World Population Prospects 2024 as the universal baseline and preserves national
statistics as a later, parallel enrichment rather than mixing definitions into
the cross-country comparison.

## Canonical observation model

The irreducible population observation is:

`country × year × age interval × sex × estimate/projection status × scenario`

The normalized country shards cover 1950–2100 annually, five-year age groups
through 95–99 and an open 100+ group. Years through 2023 are labelled estimates;
2024 onward is explicitly the UN medium projection. Derived fields never replace
the source rows.

Common fiscal-demography bands are derived from the same rows:

- 0–4 early childhood
- 5–14 school age
- 15–24 youth
- 25–54 prime working age
- 55–64 mature working age
- 65–79 older population
- 80+ oldest population

The index also carries standard 0–14, 15–64 and 65+ totals; child, old-age and
total dependency ratios; the ageing index; sex ratio; population growth,
fertility, births, deaths, life expectancy and migration where supplied in the
same WPP revision.

## Mandatory preflight

| Item | Contract |
|---|---|
| Dataset | `country-demography`, UN WPP 2024 |
| Source registry | `pipeline/demography_cloud/sources.json` |
| Dedicated branch | `codex/demography-loader-v2` |
| Dedicated worktree | `/Users/johnwick/dev/czbudget/work-demography-loader` |
| Build config | `pipeline/demography_cloud/cloudbuild.yaml` |
| Region | `europe-west4` |
| Service account | `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com` |
| Raw destination | `gs://czbudget-janrezab-data-layers/raw/country-demography/un-wpp-2024/<sha256>/...` |
| Staging destination | `gs://czbudget-janrezab-data-layers/processing-runs/country-demography/<build-id>/staging/...` |
| Immutable release | `gs://czbudget-janrezab-data-layers/published/country-demography/releases/<release-id>/...` |
| Publication pointer | `gs://czbudget-janrezab-data-layers/published/country-demography/current.json` |
| Website destinations | `/data/country-demography.v1.json`, `/data/demography/index.v2.json`, `/data/countries/{iso3_lower}/demography.v2.json`, `/api/data/demography?country={ISO3}` |

The website adapter is a separate web-plane release. Until that adapter consumes
the published pointer, production continues to serve its previous embedded
demography file. Publishing this dataset never invokes or modifies Cloud Run.

## Validation and publication

The build requires exactly 195 countries, annual continuity from 1950 through
2100, male/female reconciliation, complete age-band reconciliation and agreement
between age totals and headline WPP population within 0.1%. Raw responses are
content-addressed and create-only. Staging and release objects are immutable.
Only the final `current.json` pointer changes, using a generation-match compare
and swap.

The immutable release receipt distinguishes `processing_status` from
`publication_status` and records source hashes, loader Git SHA, Cloud Build ID,
identity, region, timestamps, row accounting, totals, coverage, validation,
release ID and website destinations.

Dry-run the code-only submission package:

```sh
python3 pipeline/demography_cloud/submit.py --dry-run --account jan@ravineo.com
```

Submitting is permitted only after the preflight above has been reported in the
active task:

```sh
python3 pipeline/demography_cloud/submit.py --account jan@ravineo.com
```
