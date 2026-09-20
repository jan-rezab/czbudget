# Shared components and bounded releases

## The contract

Change one shared component and release it once. Every consuming municipality
uses it; do not rebuild municipal datasets or regenerate per-city HTML to change
chart presentation. Country adapters preserve original values and accounting
boundaries. Page layout, titles, tables and sources remain owned by the page.

`lib/chart-renderer.js` owns line, column, percentage-stack and horizontal-bar
geometry, signed axes, gaps, hover/focus/touch tooltips and keyboard movement.
`shared-charts.css` styles only chart panels. `psd-chart.js` remains the existing
table/CSV/PNG/citation/source wrapper, not a second plotting implementation.

## Migrated consumers

- `municipal-expanded-profile.js`: Czech and international municipality profile
  history (the shared runtime template, plus France/Germany query profiles).
- `cz-history.js`: large-city history, plan/actual, per-person and composition.
- `municipalities-czechia.js`: nationwide Czech municipal history.
- `stories/tariff-charts.js`: trade lines, monthly customs bars and tariff
  comparisons. Tooltips show reported observations, never interpolated actuals.

Country-specific normalization, currency conversion, methodological warnings,
source links and tables stay in adapters. Migration must not turn cash into debt,
plans into actuals or a missing year into zero. Independent specialized charts
remain legacy until their semantics have a tested shared adapter; never migrate
them by scraping rendered text or guessing the intended denominator.

## Asset release

1. Edit renderer/style source, not generated copies.
2. Run `npm run build:chart-assets` and commit the generated manifest and new files.
3. `npm run check:chart-assets` verifies current content and every retained hash.
4. `chart-runtime.js` revalidates `assets/chart-releases/current.json`, then loads
   exactly the JS/CSS pair it names with browser subresource integrity checks.
5. Prior content-addressed files are retained across releases. Rollback uses the
   previous image/manifest. Stable legacy JS/CSS URLs revalidate, rather than
   remaining fresh for an hour. HTML for runtime municipal profiles revalidates.

One production promotion updates new loads across all routes. Existing open tabs
keep their loaded version until refresh; no forced mid-interaction replacement.
The first release cannot revoke responses already cached under an older policy.

## Verification selection

`node scripts/verification-plan.mjs <base-sha> <head-sha>` computes the affected
families from an explicit ancestor base. Chart-only and story-only edits use the
component lane. Navigation smoke is always included. Unknown files, global styles,
server/routing, country directories and CI changes select the full lane.

`node scripts/run-component-gate.mjs [plan.json]` runs model contracts followed
by the selected desktop/mobile browser checks with immediate line reporting,
zero automatic retries and first-failure termination. Without a plan it runs all
component groups; it cannot silently run an empty test set.

The full gate still exercises published-data integration. Data releases remain
separate in europe-west4; web verification/promotion stays in europe-west1.
Small synthetic chart fixtures are local; no bulk restores for UI tests.
`chart-legacy-inventory.json` records existing drawing sites (including icons).
The ownership validator rejects new page-owned SVG sites. It is a migration
inventory, not a claim that every historical visualization has been migrated.
Never raise its ceilings simply to make a new renderer pass.

## Timing and evidence

Routine gate target: <=180 seconds execution, excluding cloud queue/startup.
Record actual timing before claiming a speedup. Full structural migrations can
take longer and must not be disguised as routine component changes. Evidence
must identify exact SHA, base, test contract and active fixture releases.

The full lane has four two-worker browser shards on the existing 8 GB worker;
two shards run at a time. Each shard has a 90-second no-output watchdog,
seven-minute Playwright deadline and eight-minute outer command deadline. Each
two-shard Cloud Build step is capped at eighteen minutes, the entire full build
at twenty minutes, and queue time at ten minutes. A stalled run must fail, not
silently consume forty minutes. These caps do not apply to the independent data
plane. A larger worker needs a regional quota change and is not assumed available.

Do not start duplicate builds for the same candidate. A failed candidate needs a
new commit and new verification. The production image is tested before immutable
promotion; no data processing or alternate hosting is introduced.
