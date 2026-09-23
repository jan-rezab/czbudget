# 2024 service employment by industry

One-year ILOSTAT pilot for the US, Czechia, Germany, France, the United Kingdom
and Poland. The source is the ILOSTAT annual employment-by-sex-and-economic-
activity table at two-digit ISIC Rev. 4 level. The loader selects total sex,
all 45 divisions in service sections G–S, and the source's 2024 observations
in thousands of employed persons. It keeps the original survey source and
notes, including the US Current Population Survey minimum age of 16.
Seven small Czech and Polish divisions carry ILOSTAT's `U` (unreliable) flag;
they are retained with the flag and must be disclosed in section aggregates.

The six country sources share ISIC Rev. 4 division codes, but survey frames
and age coverage differ. This is a comparison of employed people, not jobs or
full-time equivalents. Sections T and U are excluded because 2024 Czech
values include a missing U division; the reported service shares use G–S only.

Data contract:

- Dedicated branch/worktree: `codex/job-market-2024` in
  `work-job-market-2024/`.
- Build config: `pipeline/job_market_services_2024/cloudbuild.yaml`.
- Region: `europe-west4`; service account: `psd-data-builder`; tag:
  `plane-data`.
- Immutable raw CSV: `gs://czbudget-janrezab-data-layers/processing-runs/job-market-services-2024/<build-id>/raw/`.
- Normalized staging JSONL: same run under `staging/`, then
  `job_market.job_market_service_stage`.
- Atomic publication: `job_market.job_market_service_observations` and
  `job_market.job_market_service_release_pointer` in one BigQuery
  transaction. The website does not consume this release yet.

Submit from the dedicated worktree after bootstrap in the EU `job_market`
dataset and granting `psd-data-builder` WRITER access to that dataset:

```sh
python3 pipeline/job_market_services_2024/submit.py --dry-run
python3 pipeline/job_market_services_2024/submit.py
```

Published query:

```sql
SELECT o.country_code, o.isic_section, o.isic_division, o.persons_thousands
FROM `czbudget-janrezab.job_market.job_market_service_observations` o
JOIN `czbudget-janrezab.job_market.job_market_service_release_pointer` p
  ON o.release_id = p.release_id
WHERE p.dataset_id = 'job_market_services';
```
