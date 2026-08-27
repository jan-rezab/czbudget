# Transform inventory and the sibling `scripts/` directory

`README.md` states that the site's transforms are versioned in `pipeline/`.
That was not fully true: part of the production pipeline lived in
`/Users/johnwick/dev/czbudget/scripts/`, a sibling directory that is **not a
Git repository**. Four generators existed there and nowhere else, yet wrote
artifacts the site ships — including `data/countries/<cc>/providers.v1.json`,
which is listed in the release manifest. Those artifacts were therefore not
reproducible from a clean checkout.

This document records what was moved, what was changed on the way in, and what
deliberately stayed outside.

## Imported into `pipeline/transforms/`

| Transform | Writes | Network | Notes |
| --- | --- | --- | --- |
| `prepare_hospital_ownership.py` | `outputs/<date>-hospital-ownership/hospital-ownership.v1.json` | none | Reads the tracked `website/data/countries/*/providers.v1.json` and `website/data/cz-health-budget.v1.json`. Stdlib only. |
| `prepare_care_envelope.py` | `outputs/<date>-care-envelope/care-envelope.v1.json` | none | Reads `website/data/municipal-benchmarks/{nor,nld}.json`, which are outputs of `build_european_municipal_profiles.py`. Stdlib only. |
| `import_european_municipal_benchmarks.py` | `outputs/<date>-european-municipal-benchmarks/{municipal_benchmark_facts.jsonl.gz,municipal_benchmark_entities.json,manifest.json}` | **yes** — SSB (NO), CBS (NL), Statistics Finland | Replays fully offline from `data/source_cache/european_municipal_benchmarks` when `--refresh` is omitted. Stdlib only. |
| `build_european_municipal_profiles.py` | ~1,010 profile pages and JSON shards under `website/municipalities/` and `website/data/municipal-benchmarks/`, plus `website/sitemap.xml` | yes | Imports `COUNTRY_META`, `ROOT` and `slugify` from `import_european_municipal_benchmarks`, so the two must stay in the same directory. |

### What was fixed on import

Nothing was copied blindly. Every one of these had at least one assumption that
only held while the file sat in `scripts/`:

- **Workspace root.** All three self-rooting files computed their root by
  walking up from `__file__` (`.parent.parent`, or `parents[1]`), which
  resolves to `website/pipeline` — the wrong directory — once the file lives in
  `pipeline/transforms/`. Each now uses the repo convention:
  `CZBUDGET_WORKSPACE_ROOT` when set, otherwise `parents[3]`.
  `build_european_municipal_profiles.py` inherits `ROOT` from its sibling and
  so is fixed transitively; its own `CZBUDGET_WEB_ROOT` override was dropped
  because that variable was spelled differently from every other transform and
  was set nowhere in the tree.
- **The private deployment origin.** `build_european_municipal_profiles.py`
  hard-coded the Cloud Run hostname — GCP project number included — in five
  places, including the `<loc>` entries it writes into `website/sitemap.xml`.
  Running it would have replaced canonical `publicspendingdata.org` sitemap
  URLs with internal `run.app` ones. All five now use a single `SITE_BASE`,
  which defaults to `https://publicspendingdata.org` and is overridable via
  `PUBLIC_ORIGIN` for a staging run, but never defaults to an internal host.
- **Frozen provenance stamps.** `prepare_hospital_ownership.py` and
  `prepare_care_envelope.py` hard-coded `generated_at`, so every rerun
  re-published the same claim about its own freshness. Both now report the real
  generation date, with `CZBUDGET_GENERATED_AT` available to pin it for a
  reproducible build. Their dated output directories are unchanged by default
  (they identify a specific published run) but are overridable via
  `HOSPITAL_OWNERSHIP_OUT` / `CARE_ENVELOPE_OUT`.
- **A manifest that always claimed success.**
  `import_european_municipal_benchmarks.py` wrote
  `"validation": {"status": "passed", "errors": []}` unconditionally, which made
  it a claim about nothing. It now reports what was observed: a country that
  produced no entities or no facts is recorded as a failure.
- **Housekeeping.** Its `User-Agent` now matches the identifying string the
  other source-fetching transforms use, so API operators can attribute the
  traffic; two unused imports (`csv`, `io`) were dropped.

No secrets or absolute machine paths were found in any of the four.

### `build_european_municipal_profiles.py` is imported but **not runnable as-is**

Its `update_existing_navigation()` patches `municipalities-country.js` and
`municipalities.js` by exact string match, and every one of those literals
encodes a superseded "7 countries → 10 countries" migration. The route map it
expects has since grown to 24 countries, so a run without `--profiles-only`
raises `RuntimeError("municipalities-country.js route map changed
unexpectedly")` before writing anything, and the five `municipalities.js`
replacements would be silent no-ops. That failure is loud and safe, and it has
been left loud on purpose.

**Only `--profiles-only` is currently safe to run.** Refreshing the navigation
literals is a separate, reviewed change. Note also that the asset
cache-busting stamps this file bakes into generated HTML (`?v=20260822-…`,
`?v=20260824-…`) are frozen and should be checked before any regeneration.

## Deliberately left in the sibling directory

The four originals remain in `scripts/`. They are still referenced there, by
the runbook at `data/README_european_municipal_benchmarks.md` and by prose
citations in two published reports under `outputs/`. They were not deleted, but
**`pipeline/transforms/` is now canonical** — do not edit or run the sibling
copies, and update that runbook to invoke `website/pipeline/transforms/...`.

Two adjacent files also belong to this pipeline and are still outside the repo:

- `data/README_european_municipal_benchmarks.md` — the only runbook for the two
  European transforms. Its peers already live in `pipeline/docs/`.
- `gcp/bigquery/load_european_municipal_benchmarks.sh` — creates and loads
  `budget_detail.municipal_benchmark_facts`. Its peers already live in
  `pipeline/warehouse/`.

## Retired duplicates

Three files in `scripts/` were unversioned copies of transforms already
versioned here. Nothing in the workspace referenced them — every reference
(`package.json`, `scripts/validate-site.mjs`, `README.md`, `BRAND.md`) points at
`pipeline/transforms/`. They were moved to
`scripts/_quarantined_repo_duplicates_20260827/` rather than deleted, because
that directory is outside Git and a deletion there is unrecoverable:

- `build_czech_site.py` — stale: private Cloud Run origin, retired `/cz/obce/`
  route, no `CZBUDGET_WORKSPACE_ROOT`, no shared header/footer components.
- `build_public_entity_web_dataset.py` — stale: the repo copy is a strict
  superset that also emits `data/cz-public-entity-history.v1.json`.
- `prepare_municipal_budgets.py` — was byte-identical, a pure duplicate.
