# Source-specific 2024 public employment totals

This load preserves the official 2024 Czech public-sector satellite-account
figures and German public-employer personnel figures. It is a separate national
series, **not** a replacement for missing ILOSTAT industry-by-ownership cells.
The Czech figures are annual FTE jobs. German public-employer figures are a
30 June 2024 headcount snapshot, while the German total-employment denominator
is an annual domestic-concept average; their ratio is indicative only.

The three official HTML sources in `manifest.json` are captured as immutable
raw objects in `processing-runs/job-market-national-public-2024/<build-id>/raw/`.
The Cloud Build in `europe-west4` runs as `psd-data-builder` with `plane-data`,
parses exact source-table cells, validates the Czech reported share and German
component sum, stages eight observations in the EU `job_market` dataset, and
atomically publishes one release pointer. Each row retains the printed source
value, unit, reference basis and exact URL. No website deploy is involved.

```sh
CLOUDSDK_CORE_ACCOUNT=jan@ravineo.com bq --project_id=czbudget-janrezab --location=EU query --use_legacy_sql=false < pipeline/job_market_national_public_2024/bootstrap.sql
python3 pipeline/job_market_national_public_2024/submit.py --dry-run
CLOUDSDK_CORE_ACCOUNT=jan@ravineo.com python3 pipeline/job_market_national_public_2024/submit.py --account jan@ravineo.com
```
