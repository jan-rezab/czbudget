# Universal country demography cloud build

This job builds annual age-by-sex projections for the 195-country sovereign
universe. UN World Population Prospects 2024 medium projections are the default
backbone. The existing Czech, UK, US and EUROPOP2023 national/European sources
remain preferred for the 14 configured countries; a preferred-source failure is
reported and fails the run instead of silently changing provenance.

The Mac submits only code and the small sovereign-universe registry. The Cloud
Build worker downloads the official source, builds and validates all country
shards, and writes the raw source, derived output, source receipt and final
completion manifest under:

`gs://czbudget-janrezab-data-layers/processing-runs/country-demography/<build-id>/`

Submit the job:

```sh
python3 pipeline/demography_cloud/submit.py --account jan@ravineo.com
```

Inspect the package without submitting:

```sh
python3 pipeline/demography_cloud/submit.py --dry-run
```

Consumers must pin a reviewed run and require `completed.json`. Older runs and
the archived workspace objects are never overwritten or expired. Do not run the
universal build on a workstation; local tests use the small fixture in
`tests/fixtures/demography/`.

For targeted fixture or diagnostics without network access:

```sh
python3 scripts/build-country-demography.py \
  --countries AFG,CZE --source-policy un-wpp \
  --un-wpp-file tests/fixtures/demography/wpp-medium-mini.csv \
  --output-root /tmp/country-demography-fixture --allow-missing
```
