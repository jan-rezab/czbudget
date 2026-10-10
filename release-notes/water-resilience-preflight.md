# Water in the landscape — pre-release record

Task clock: approximately 2026-10-10 14:31 UTC (first response; epoch 1791642660). Structural-work checkpoint: 45 minutes. Requested result: a Czech water-retention scorecard with money, completed projects, measured outcomes, and a source-backed European wetlands comparison. This candidate has not been pushed to production.

## Candidate and acceptance

- Branch/worktree: `codex/water-resilience-20261010` in `/Users/johnwick/dev/czbudget/work-water-resilience`, based on `origin/main` at `dfa23836a4`.
- Route: `/deep-dives/water-resilience/`, registered as a Czech regional report, with Czech and English copy, catalogue/menu entry and sitemap URL.
- The three views distinguish expenditure/awards/project budgets, named completed works and outcome evidence. The wetlands benchmark separates annual delivery, matched programme spending and delivery, completed multi-year projects, and cumulative stock. Missing Czech totals remain missing.
- Scope excludes drinking water, sewage and standalone flood protection. No data ingestion or website data-plane work was run.

## Browser asset cache gate

Changed browser JavaScript: `global-nav.js` and `deep-dives.js`, both generated from `deep-dives/reports.json`. Changed browser CSS: none external; the new page's inline CSS and inline language-sync script are served at the new route with no previous URL. Direct and indirect HTML, template, import and test references for the two JavaScript assets are recorded in [water-resilience-consumers.txt](water-resilience-consumers.txt) (76 and 16 references/mentions respectively). No imported JavaScript or CSS dependency changed.

| Asset | Previous live browser URL (from live `/deep-dives/` HTML) | Candidate staged browser URL | Version mechanism |
| --- | --- | --- | --- |
| `global-nav.js` | `/global-nav.js?v=92bb9d676128f923b970260271ca236d2b0eb320f0e6756b8a3938b35784dcb0` | `/global-nav.js?v=095c44bdc3814843c980fb0deff167a1308ceaa4a3bfa87634b5cd55845a6305` | `scripts/stage-runtime.py` SHA-256 of authored adapter; rewrites all staged HTML/JS/MJS references. |
| `deep-dives.js` | `/deep-dives.js?v=ea2196a69ab0028e962233a79d96f60c8095576bc8e28783cf0dafca9a9a9dff` | `/deep-dives.js?v=d8127453cf6c1c3849df250e3fdcbcb2cadb163e6dc24c1841bb49db9b6f93a6` | Same registered-adapter staging. |
| New report HTML | No prior route | `/deep-dives/water-resilience/` | New URL; inline behavior and styles travel with HTML. |

At 2026-10-10 14:44 UTC, public HEAD responses for both *actual previous hashed URLs* returned `Cache-Control: max-age=14400, must-revalidate`, no `Age` header, and `CF-Cache-Status: REVALIDATED`. The older unversioned query forms returned the same cache policy with `CF-Cache-Status: MISS`; they are not used as the old-key evidence.

Focused staging: `scripts/stage-runtime.py` assembled 1,367 runtime files (106,909,810 bytes in the final staging after the wetland-baseline addition) and rewrote registered references. The staged report referenced candidate `global-nav.js` hash `095c44...`; the staged catalogue referenced `deep-dives.js` hash `d81274...`. HTTP requests to those exact URLs on the temporary staged preview returned bytes identical to the staged files. Served SHA-256: `global-nav.js` `ea3434522a502e298f6e1cb02c35246c83859044d8d652c670474d6014171997` (staging also rewrites its self-reference), `deep-dives.js` `d8127453cf6c1c3849df250e3fdcbcb2cadb163e6dc24c1841bb49db9b6f93a6`. The source-content hash remains a deterministic cache key even though staging changes the navigation script's self-reference bytes.

Built-in browser preflight: staged report loaded the hashed navigation URL; English and Czech language switches updated the title, heading and navigation; the wetlands investment cards appeared; desktop width 1280 and mobile width 360 had no horizontal overflow. Catalogue card opened the report.

## Checks and remaining release gates

- Passed: `npm run build:reports-index`, `npm run validate:reports-index`, `npm run validate:localized-shells`, `node scripts/validate-release-contract.mjs` against the live `czbudget-public-main` trigger definition, `git diff --check`, and staged browser checks. The trigger includes `deep-dives/**` and root `*.js` files and selects `cloudbuild.yaml` in `europe-west1`.
- Local `npm run validate` stopped at `validate:regional-finance`: default `/usr/bin/python3` lacks `requests`. This is a local dependency failure, not a report assertion. The cloud full lane installs `pipeline/requirements.txt` before its Python tests.
- Local `node scripts/validate-site.mjs` and `node scripts/validate-integrity.mjs` stopped because the sandbox cannot read published static-asset packs. No bulk data was downloaded locally. The cloud full lane is the required exact-commit verification for this new route.
- Failed local verification attempts: three (one aggregate run and two focused scripts). Failed cloud submissions: zero. Live cache acceptance failures: zero, because no release has occurred.
- Before any production push: re-read `DELIVERY_GUARDRAILS.md`, run the delivery guard with the original timestamp and cumulative failure record, and verify the final staged HTML after any edits. After deployment: ordinary reload in a preserved pre-release built-in browser session, inspect loaded hashed URLs, translations, behavior and console, then confirm a fresh load and live revision/traffic. No browser cache clearing.
