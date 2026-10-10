# Czech municipal budget ranking candidate

- Request start: 2026-10-10 13:21:15 UTC (first observed response time; approximate).
- Scope: show the 13 largest 2025 municipal budgets and split each total into official current expenditure (opex) and capital expenditure (capex). Leave surplus and deficit rankings at eight each.
- Status: local candidate only. No push, cloud build, or deployment. Live returning-browser acceptance remains for the later deployment.
- Checkpoint: 20 minutes from request start. Cloud verification submissions: 0. Local preview failures: 1 (the standard preview could not read the static asset pack because unattended `gcloud` reauthentication failed); a short-lived read-only public-data proxy corrected local preview access. No website or data-plane files were written for that correction.

## Browser asset cache gate

| Changed asset | Browser consumer | Previous public URL | Candidate URL | Versioning |
| --- | --- | --- | --- | --- |
| `municipalities-czechia.js` | `municipalities/czechia/index.html` script; no importing module | `/municipalities-czechia.js?v=6f24a6b6b7be4d39887b80ee3984c61a6cc2b1d03c874ce806515b3fead19c9a` (actual public HTML); authored source previously used `?v=20260911-chart-tooltips` | `/municipalities-czechia.js?v=64b5b57b889169f9d283d82295ecbb410fba34c185ad4b5d0468891f2e2f3cce` | Full SHA-256 of asset bytes in the authored HTML and in the runtime staging registry. The script continues to import unchanged `chart-runtime.js` and conditionally loads unchanged `municipality-country-picker.js`. |
| New `municipalities-czechia-ranking.css` | `municipalities/czechia/index.html` stylesheet link only | None | `/municipalities-czechia-ranking.css?v=e9394049046d96001183d79dedc13d24b023c8539519b1c3051afa22a9a9749a` | Full SHA-256 of CSS bytes in its only consuming HTML reference. The existing shared `municipalities-navigator.css` is unchanged. |

Observed browser-facing public headers on 2026-10-10: the previous exact JavaScript URL returned `Cache-Control: max-age=14400, must-revalidate`, `CF-Cache-Status: REVALIDATED`, and no `Age` header. The unchanged `/municipalities-navigator.css?v=20260911-chart-tooltips` returned the same cache-control policy, `CF-Cache-Status: REVALIDATED`, and no `Age` header. The page HTML returned `CF-Cache-Status: DYNAMIC` and no `Cache-Control` header. The new CSS has no previous public URL or public headers yet.

Local runtime staging produced 973 files and rewrote the registered JavaScript adapter URL to the candidate SHA-256. The staged HTML references both candidate URLs; SHA-256 of each staged asset equals its URL version. The short-lived local preview loaded the candidate JS/CSS and the public municipal snapshot in memory. English and Czech each showed 13 budgets, from Praha through Havířov, with current and capital amounts; desktop and 390 px mobile layouts were inspected. The public 2025 snapshot's top 13 current plus capital amounts reconcile to their actual expenditure totals to within CZK 1. The change does not modify data.

Focused checks after the final code edit: `npm run test:chart-model` passed all 48 tests; `node --check` passed for the changed JavaScript and browser spec; `node scripts/validate-release-contract.mjs` and `git diff --check` passed. The new browser assertion is committed for the later production verification lane; local browser interaction used Codex's built-in browser and did not run Playwright's external Chromium.

Before a later production push, the deployment chat must include this candidate with any further requested changes, rerun the required final checks against the combined revision, inspect the production trigger, and retain this cache evidence. After deployment, reload the preserved pre-release browser session without clearing cache, verify the loaded JS/CSS URLs and ranking behavior, and check a fresh page load and console errors. Record any live cache failure separately from cloud gate failures.
