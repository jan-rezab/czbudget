# Monthly automotive report

The report compares the **origins of imports**, using UN Comtrade monthly H6
reports from the same destination markets throughout the series. It does not
combine exporter FOB reports with importer CIF reports or estimate world exports.

`build.py` runs only on an ephemeral Google Cloud Build worker. It reads a
checksum-pinned copy of the current crawler checkpoint, requires completed leaf
tasks for every included market/month and coverage of World, USA, China and
all EU-27 origins, and verifies every selected compressed response against its
checkpoint SHA-256. World rows and bilateral rows are kept separate. Rest of
world is the residual after subtracting the three named origins, including
unspecified origin; the explicit EU-origin contribution to EU destinations is
then removed. EU membership is fixed at 27, with the UK outside the bloc.

The latest eligible month must have at least 20 complete reporting markets;
the intersection across up to 12 months must also have at least 20. Missing
World product observations remain absent and cause a gap in the chart, not zero.
A zero named-origin contribution means no recorded trade in the complete
requested origin/product scope. Non-reporting countries are never filled.

The three disjoint HS6 selections are declared in `build.py` and exposed in the
report. Parts deliberately cover HS 8708 only. Electric goods vehicles without a
weight split (870460) and other goods vehicles (870490) are omitted from both
vehicle categories. This is not an exact reproduction of USITC's HTS10 basket.

Submit the small worker bundle from the repository:

```sh
gcloud builds submit pipeline/automotive_cloud \
  --config=pipeline/automotive_cloud/cloudbuild.yaml \
  --project=czbudget-janrezab --region=europe-west1 \
  --service-account=projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com \
  --gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source \
  --async
```

Each successful run preserves its serving JSON, raw-object hash receipts and
completion checksum under a new `processing-runs/automotive/<build-id>/` prefix.
Review the result and update `data/trade/automotive-release.v1.json` with its
immutable generation, size and SHA-256. Do not overwrite previous cloud runs.
The normal website Cloud Build hydrates only that pinned serving JSON with
`scripts/hydrate-automotive.py`. Local verification uses synthetic fixtures;
no checkpoint, raw archive or generated serving snapshot is restored to the Mac.

Initial extraction: `90a2e9f4-d0c2-484f-acd9-751754a16bf0`; 1,347 verified
source objects; October 2025–July 2026; 30 fixed importing markets; 899 published
market/month/segment observations. The unmatched observation remains a gap.
