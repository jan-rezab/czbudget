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

Every release uses **one production build** after a main push. The production
build selects tests from the diff against the live revision's `git-sha` label.
Component changes run their focused desktop/mobile checks alongside image
creation. Broad changes (server, data, routing, build machinery, unregistered
pages) and unknown deployment provenance run the exhaustive suite in the same
build: it hydrates the pinned published releases, validates them and runs the
four browser shards after the candidate-image browser contract. Deployment waits
for whichever lane applies; a failed gate preserves the current live revision.
There is no separate verification build and no manual verification-to-promotion
handoff. The build fails closed at thirty minutes.

Fixed costs are kept off the critical path: `warm-browser-worker` pulls the
Playwright image and installs packages at second zero, while the diff is computed
from blobless fetches (`--filter=blob:none`, `--no-renames`). The push hook runs the
component-proven browser specs locally when Playwright is installed (about twenty
seconds; `PSD_SKIP_LOCAL_BROWSER=1` skips it). The exhaustive shards are CPU-bound
on `E2_HIGHCPU_8`; the project's default-pool quota is ten build CPUs per region,
so a larger worker needs a quota increase first.

`cloudbuild.ui.yaml` remains an optional read-only browser gate for interface previews.
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
Before submitting, the wrapper runs the UI environment and release contracts
from inside that exact temporary bundle. Missing bundle files fail locally,
before a Cloud Build worker is queued.
The packager includes only tracked inputs. In a clean sparse worktree it reads
an omitted input from the candidate Git commit, including the tracked files
inside its small asset/fixture directories. It never restores bulk data.
The pre-push hook checks the same bundle. The wrapper accepts only a clean,
committed component-lane candidate; structural changes go directly to the full
verifier instead of paying for both cloud gates.

- Config: `cloudbuild.verify.yaml`.
- Optional preview of a branch before it reaches main; production no longer requires
  its receipt because the production build runs the same exhaustive suite. Known
  component-only changes use the dependency-selected fast gate instead;
  `scripts/verification-plan.mjs` is the fail-closed selector. See `COMPONENT_RELEASES.md`.
- It may hydrate pinned published fixtures and run the exhaustive browser suite,
  but it is not the production promotion path.
- Never run it concurrently with another verification of the same commit. Reuse
  the successful build ID.

The full trigger reads `cloudbuild.verify.yaml` from `main`, even when its
`--sha` selects a candidate commit as source. When that YAML changes, run
`scripts/submit-full-config-verification.sh <base-sha>` on the clean committed
candidate first. It submits the candidate's YAML with source pinned to the
same Git SHA. Then run the normal full trigger for that exact SHA. The
production gate requires both successful receipts for a verifier-config
change; ordinary full-lane changes require only the trigger receipt. Record
both build IDs and the unchanged base SHA. Run the delivery guard before each
submission. Do not run this extra gate for ordinary dashboard changes.

The exhaustive gate runs a small country chapter/link browser contract in its
component preflight, in parallel with published fixture hydration. It checks
chapter anchors separately from national budget links. The full country/data
contract still runs in the browser shards against pinned published releases.
The four browser shards use the prepared Playwright image.
No repeated browser installation. Runtime image assembly happens once, in production; its
filesystem/HTTP and desktop/mobile browser contracts must pass before promotion.
The push hook runs the source validators the exhaustive gate starts with (about
ten seconds). The canonical production build then performs focused or exhaustive
verification before it may deploy. Unknown changed
paths cannot use component verification. Never submit the optional fast UI gate
and then repeat the same component checks in production for a routine release.
Local push checks remain source-only and never rescan/restore bulk data.
The exhaustive source-integrity pass explicitly uses `PSD_BUILD_MODE=local`:
its input is a checkout, not the obsolete in-web-build BigQuery merge. This
does not replace the separate mandatory immutable published-snapshot validators.

## Data plane

The static-data pack directories (`data/isred`, `data/industrial-intelligence`,
`data/czech-nku`, `data/contracts`, `data/czech-project-geography`, `data/industry`)
are no longer tracked in Git. They are published as immutable packs under
`gs://czbudget-janrezab-public-snapshots/static-assets/` and the server streams them
from there; the image never contained them. A future repack must restore its inputs
on a data-plane worker from the published packs or the raw snapshots, never from the
website checkout. Five small files the release manifest checks stay tracked.

The per-entity municipal fan-out (`data/municipal-history/<ico>.json`,
`data/municipal-benchmarks/<cc>/<id>.json`) is not tracked in Git either. Each input
is an immutable raw copy under `gs://czbudget-janrezab-data-layers/raw/<dataset>/<git-sha>/`,
written once by `cloudbuild.raw-fanout.yaml` and pinned by manifest hash and tree digest
in `pipeline/config/municipal-serving-inputs.v1.json`. `cloudbuild.data.yaml` restores
them with `scripts/hydrate-municipal-fanout.py --from gcs`, builds the municipal snapshot
release, and refuses to publish unless every Czech and benchmark payload equals the
active release (`scripts/compare-public-serving-releases.mjs`), unless a reviewed data
change sets `_IDENTITY_COUNTRIES=none`. Locally, `--from git` restores the same bytes
from Git history without network; validators read small fixtures instead.

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
