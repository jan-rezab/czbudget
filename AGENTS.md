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
