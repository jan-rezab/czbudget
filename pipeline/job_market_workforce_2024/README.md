# 2024 public employer and labour-status warehouse load

Dataset: ILOSTAT 2024 employer ownership by ISIC Rev. 4 section and annual labour-force status. The official source endpoints and six-country coverage are pinned in `manifest.json`. Ownership by industry is reported for USA, FRA, GBR and POL; CZE and DEU are deliberately missing. All six markets have employed, unemployed, labour-force, outside-labour-force and unemployment-rate observations. Source values are retained as exact strings alongside numeric query values.

Execution: dedicated `codex/job-market-2024` worktree; `cloudbuild.yaml` in `europe-west4`, `plane-data` tag, `psd-data-builder`; immutable raw CSV and normalized JSONL under `gs://czbudget-janrezab-data-layers/processing-runs/job-market-workforce-2024/<build-id>/`; two BigQuery staging tables; validated atomic write to observations and `job_market_workforce_release_pointer`. No website destination or deployment.

Bootstrap after creating the dedicated EU `job_market` dataset and granting
`psd-data-builder` WRITER access to that dataset with `jan@ravineo.com`:

```sh
CLOUDSDK_CORE_ACCOUNT=jan@ravineo.com bq --project_id=czbudget-janrezab --location=EU query --use_legacy_sql=false < pipeline/job_market_workforce_2024/bootstrap.sql
```

Source-only validation and submit from this worktree:

```sh
python3 pipeline/job_market_workforce_2024/submit.py --dry-run
CLOUDSDK_CORE_ACCOUNT=jan@ravineo.com python3 pipeline/job_market_workforce_2024/submit.py --account jan@ravineo.com
```

The receipt exists only after publication; consumers select the pointed release. Country-specific survey age and source notes remain in each row. The Czech FTE and German administrative totals in `../job_market_services_2024/PUBLIC_EMPLOYMENT_RESEARCH.md` use different measurement bases and are not filled into absent ILO ownership cells.

Run `reporting_views.sql` as the dataset owner after the service and workforce
releases are published. The views select only pointed releases and expose source
values, URLs and the arithmetic used for report percentages.
