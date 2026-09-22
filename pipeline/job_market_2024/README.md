# One-year job-market comparison pilot

This data-plane job loads 2024 employment **shares of people**, not counts of
jobs, for Czechia, Germany, France, the United Kingdom, Poland and the United
States. It uses three ILO-modelled sectors published through World Bank WDI:
agriculture, industry and services. All six markets use the same three source
series and year. The series is comparable at this broad level; it cannot be
joined directly to Eurostat's detailed NACE counts as a detailed jobs series.

Submit from this dedicated branch/worktree:

```sh
python3 pipeline/job_market_2024/submit.py --dry-run
python3 pipeline/job_market_2024/submit.py
```

The Cloud Build runs in `europe-west4` as
`psd-job-market-builder@czbudget-janrezab.iam.gserviceaccount.com` with the
`plane-data` tag. Each source JSON is preserved without modification under
`gs://czbudget-janrezab-data-layers/processing-runs/job-market-2024/<build-id>/raw/`.
The normalized JSONL is staged under the same run's `staging/`. The build
validates a complete 6 × 3 grid and 100% sector sums before loading staging
into BigQuery. It atomically writes the release rows and changes
`budget_detail.job_market_release_pointer` in one transaction. A completed
receipt is written only after that transaction succeeds. The website does not
read this dataset yet and no website release is part of this job.

Published query:

```sql
SELECT s.country_code, s.sector, s.share_pct
FROM `czbudget-janrezab.budget_detail.job_market_employment_shares` s
JOIN `czbudget-janrezab.budget_detail.job_market_release_pointer` p
  ON s.release_id = p.release_id
WHERE p.dataset_id = 'job_market_employment_shares'
ORDER BY s.country_code, s.sector;
```
