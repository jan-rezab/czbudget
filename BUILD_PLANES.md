# Public Spending Data build planes

The public interface and data processing are separate release systems. A data
job may never deploy Cloud Run, and a web deployment may never ingest, query,
merge, or publish data.

## Web plane

- Region: `europe-west1`.
- Trigger: `czbudget-public-main`.
- Config: `cloudbuild.yaml`.
- Identity: `psd-web-deployer@czbudget-janrezab.iam.gserviceaccount.com`.
- Allowed work: source contracts, code-only runtime assembly, container smoke,
  Artifact Registry push, `czbudget-public` deployment and deployment receipt.
- Forbidden work: BigQuery queries, source downloads, data transformations,
  static-asset packing and any `current.json` data-pointer update.
- Queue TTL: 10 minutes. A production build must fail visibly rather than wait
  behind data processing.

## Verification plane

- Config: `cloudbuild.verify.yaml`.
- Runs explicitly before merge when a change affects the public application.
- It may hydrate pinned published fixtures and run the exhaustive browser suite,
  but it is not the production promotion path.
- Never run it concurrently with another verification of the same commit. Reuse
  the successful build ID.

## Data plane

- Region: `europe-west4`.
- Identity: a dedicated data builder (`psd-data-builder` or the narrower
  `comtrade-builder`). Neither identity has Cloud Run deployment permission.
- Every config carries a `plane-data` tag.
- Data runs write immutable outputs under `processing-runs/<dataset>/<build-id>/`
  and finish with a validated completion receipt.
- Publication changes one small `current.json` pointer only after validation.
  The website keeps reading the previous pointer while staging or failed jobs
  exist.
- Data submitters return a build ID asynchronously. Pausing a local task does
  not cancel a submitted build; use `gcloud builds cancel` when cancellation is
  intended.

## Runtime boundary

Cloud Run reads municipal, CityVizor and static-asset releases through published
GCS pointers. Their data is not baked into the code image. Pointer documents
identify immutable release IDs and checksum/generation-pinned objects, so code
rollout and data rollback are independent.

## Incident limits

- Do not submit a second build for the same commit or data run while one is
  queued or working.
- Web and data alerts must filter their plane tags; retain the global build-start
  alert as a final retry-storm backstop.
- Record Git SHA, build ID, image digest and active data release IDs in every web
  deployment receipt.
