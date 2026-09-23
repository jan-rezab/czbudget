# 2024 job-market serving export

The warehouse remains authoritative. This data-plane job reads only five
published-pointer views in `czbudget-janrezab.job_market`, validates all 493
rows and expected market counts, stages a JSON object under the immutable
private `processing-runs/job-market-serving-2024/<build-id>/` prefix, and
publishes a checksum-pinned copy under
`gs://czbudget-janrezab-public-snapshots/static-assets/job-market/releases/`.
It then atomically updates `static-assets/job-market/current.json`. The website
reads that pointer at runtime through its own read-only service identity. No
website build queries BigQuery or regenerates data.

The export runs in `europe-west4` as `psd-data-builder` with `plane-data` and
has an immutable completion receipt. The first verified release is
`569ea124-a61b-4616-ac86-9061ea684998`; its SHA-256 is
`fc6afe8bbd4f875b6e47ba8d5f608fa958a64d4c895475317b755ff663aff8ad`.
