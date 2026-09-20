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

`cloudbuild.ui.yaml` is the fast code-only browser gate for interface changes.
Its source bundle contains only UI code and the small published contracts used
by the focused tests. It has a ten-minute hard timeout and cannot publish data,
push an image or deploy. It uses `E2_MEDIUM`; the gate is too small to justify
paying for or waiting on a high-CPU worker.

- Identity: `psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com`.
- Permissions: Cloud Build worker plus read-only access to published snapshot
  objects. It has no BigQuery role and no Cloud Run deployment role.

Submit that gate with `scripts/submit-ui-verification.sh`. The wrapper creates
the explicit context with `scripts/prepare-ui-build-context.mjs`, selects the
read-only verifier and removes the temporary bundle afterward. The context
contains the interface files and small published contracts needed by those
pages; it excludes ingestion inputs, transforms, warehouses, snapshots, and
deployment credentials. Never run `gcloud builds submit .` from this
repository: the tracked data history makes the checkout a multi-gigabyte build
source even when the selected YAML is code-only.

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
- PAQ shards, automotive monthly data and the municipal budget codebook are
  published as the `serving-contracts` pack by `cloudbuild.serving-assets.yaml`.
  The web runtime reads that pack through the same generation-pinned
  `static-assets/current.json` lock as the other independently released assets.
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
