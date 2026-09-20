# CZ Budget deployment target

- GOLDEN RULE: The only permitted production path is this Git repository through Google Cloud Build to the single canonical Cloud Run service.
- Never add alternate-hosting configuration, source repositories, previews, deployment integrations, or provider-specific project metadata.
- Use GitHub, Google Cloud Build, and Cloud Run only.
- This directory is the canonical source for the CZ Budget public website.
- Production deploys from GitHub commits through Google Cloud Build.
- Google Cloud project: `czbudget-janrezab`.
- Cloud Run service: `czbudget-public`.
- Region: `europe-west1`.
- Never create or deploy `czbudget-web` or any other `czbudget-*` Cloud Run
  service. `czbudget-public` is the sole production service, and the build
  enforces this invariant.
- Never modify or deploy the Riverdata repository or `riverdata.org` from this project.
- Keep Czech and English navigation available on all municipal and regional pages.
- Brand assets, the palette and the adopted logo rules are in `BRAND.md`; the
  chart grammar is in `CHART_SYSTEM.md`. Preserve the primary mark and wordmark
  rules across hand-written and generated pages.

## Working agreement

- The Git repository is `~/dev/czbudget/website`. The directory above it is a
  workspace, not a checkout; `git` fails there by design. See `CLAUDE.md` for the
  operational detail behind the rules below — it applies to every agent here.
- Work on `main` and keep this checkout clean. A long-lived dirty branch strands
  work: on 20 September 2026 this tree was 106 commits behind `main` on a branch
  last touched on 8 September, carrying a whole unpublished report and the
  `pipeline/cloud_processing` tooling that existed in no commit anywhere.
- For a parallel line of work use `git worktree add`, and remove the worktree
  when the work lands. Do not leave deploy checkouts behind.
- Codex and Claude both push here. Fetch before starting and expect `main` to
  move while you build.

## Deployment rules

- `git push origin main` is the only production path: trigger
  `czbudget-public-main`, region `europe-west1`. It is code-only and must not
  ingest, query, merge or publish data. See `BUILD_PLANES.md`.
- All data Cloud Builds run in `europe-west4`, use a dedicated data service
  account and carry the `plane-data` tag. Never submit a data build in
  `europe-west1`; that region is reserved for web verification and production.
- Pausing a local task does not cancel its cloud worker. Explicitly cancel a
  queued or running data build when the user pauses that loader.
- A build that passes every gate still skips deployment if `main` moved while it
  ran (step 27 `assert-current-main`), and it reports SUCCESS anyway. Land one
  change at a time and check the build log for `Deployed immutable image` versus
  `Skipping deployment` before believing a release happened.
- Confirm the change on `https://publicspendingdata.org` with a cache-busting
  query. Build status is not evidence.
- A gate-passed image that was skipped can be deployed straight from Artifact
  Registry with the `gcloud run deploy --image <repo>@<digest>` line in
  `scripts/deploy-immutable.sh`; rollback is `gcloud run services update-traffic`.

## Shared chart and release rules

- Read `COMPONENT_RELEASES.md` before changing charts, page adapters, assets or verification.
- `chart-components.json` is the single chart ownership/consumer/test/release registry;
  `chart-coverage.json` is its generated coverage report. Never hand-edit the report.
- One chart family has one renderer. Use `window.PSDPlot` via `chart-runtime.js`;
  do not copy SVG geometry, axes, tooltips or interactions into a page script.
  Reuse `PSDChart` for the existing table/download/citation/source rail.
- Pages own layout and adapters own accounting semantics; renderers own drawing.
  Keep actual/plan, stock/flow, currency, missing values and country boundaries explicit.
- New charts must support hover, keyboard focus/arrow navigation, Escape dismissal
  and touch selection, with the same values available in a table. Preserve sources.
- Do not change page headers, footers or section ordering as part of a component update.
- Run `npm run build:chart-assets` after renderer/style edits, then
  `npm run check:chart-assets`. Never edit or delete content-addressed prior releases.
- Map changed paths to `scripts/verification-plan.mjs`. Unknown paths, shared shell,
  routing and release machinery require full verification. Never force the fast lane.
- Every registered adapter is content-versioned during runtime staging. Validate the
  actual production trigger against `scripts/validate-release-contract.mjs` before push.
- Cheap shared navigation and component contracts run before exhaustive browser tests.
  Report failed test names immediately. Do not retry deterministic contract failures.
- Reuse only successful cloud verification for the exact commit and current test contract;
  a different commit, fixture version or configuration invalidates that evidence.
- Routine component verification targets 180 seconds of execution; report measured queue,
  setup, tests and promotion separately. This target is not permission to skip tests.
- Build the production image once, smoke-test that image, then promote its immutable digest.
  Never use build SUCCESS alone as proof of deployment; verify the actual revision/live page.

## Report catalogue

- `deep-dives/reports.json` is the single source of truth for every deep-dive
  report: its shelf, its theme cluster, both languages of the title and blurb,
  the source tag and the coverage badge.
- Run `npm run build:reports-index` after editing it. The generator rewrites the
  marked blocks in `deep-dives/index.html`, `deep-dives.js` and `global-nav.js`.
  Never edit those blocks by hand; `npm run validate` fails when they drift.
- A new report needs a registry entry, not new cards or menu links. The build
  fails if a published page under `deep-dives/` is missing from the registry, or
  if a translated key has no Czech or English value.
- Two shelves only: `compare` for cross-country reports that carry the country
  switch, and `regional` for reports scoped to one country or city.
