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
