# Four deferred national dashboards: source coverage release

This data-only job downloads health source responses for Ukraine, Brazil, Japan
and Norway. It does not deploy the website or claim that all missing health
dimensions have been filled. It publishes a private, versioned source audit and
candidate observations for later review.

## Submission contract

| Field | Value |
| --- | --- |
| Dataset | `health-four-source-coverage` |
| Sources | WHO GHED all-data XLSX; OECD SHA 2011 and hospital-beds SDMX CSV endpoints, 2022–2024 |
| Branch/worktree | `codex/health-four-data-20260921` / `work-health-four-data` |
| Build config | `pipeline/health_four_cloud/cloudbuild.yaml` |
| Region | `europe-west4` |
| Service account | `psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com` |
| Immutable raw | `gs://czbudget-janrezab-data-layers/processing-runs/health-four-source-coverage/<build-id>/raw/` |
| Staging | `gs://czbudget-janrezab-data-layers/processing-runs/health-four-source-coverage/<build-id>/staging/` |
| Publication pointer | `gs://czbudget-janrezab-data-layers/health-four-source-coverage/current.json` |
| Website destination | None; a later reviewed data release is required for dashboard use |

The worker checks source hashes, parses OECD observations with explicit years and
missing values, records WHO workbook country-row presence, and validates all
four countries before changing the private pointer. An immutable `completed.json`
records processing readiness; `published.json` records successful pointer
publication. Retrying the same build ID requires byte-identical immutable
objects. A failed validation leaves the prior pointer intact.

Run the local synthetic checks with
`python3 -m unittest pipeline.health_four_cloud.test_worker`, then submit from
this dedicated worktree with `python3 pipeline/health_four_cloud/submit.py --dry-run`
followed by `python3 pipeline/health_four_cloud/submit.py --account <account>`.
