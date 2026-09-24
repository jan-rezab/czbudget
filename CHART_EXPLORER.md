# Government finance chart explorer

`/chart-explorer.html` is a noindex review surface using the existing published
IMF benchmark (2005–2024). It adds no loader, data pointer, hosting provider or
production navigation entry.

- `lib/chart-explorer-model.js` owns country/period selection, actual-year
  boundaries and percentage-point calculations. Missing baseline values stay
  missing. Stock debt and annual flow measures have separate definitions.
- `chart-explorer.js` owns the controls, selected-year comparison and source
  context. Trend and ranking use `PSDPlot`; the shared `PSDChart` rail supplies
  the exact table, CSV, attributed PNG and citation.
- `lib/chart-renderer.js` adds opt-in end labels with collision handling,
  dash patterns, series emphasis, axis formatting and aligned bar values.
  Existing consumers retain their defaults.
- Country, metric, range, comparison year, view and level/change mode survive
  in the shareable URL. Up to four countries keep the comparison readable.

The source drawer identifies the artifact, vintage, exact IMF source file,
indicator, institutional composition and the compact artifact's status limits.
The explorer excludes points after each metric's latest actual-year boundary.
It does not recreate OWID's nineteenth-century data coverage or provide a map.
The preview UI is English; existing global navigation retains its language switch.

Focused checks:

```sh
node --test tests/unit/chart-explorer.spec.mjs tests/unit/chart-renderer.spec.mjs tests/unit/chart-registry.spec.mjs
npm run check:chart-assets
npm run check:chart-ownership
npm run check:chart-coverage
```

`tests/browser/chart-explorer.spec.mjs` covers browser state and selection in the
existing cloud browser lane. Follow the machine-wide resource guard rules for
local checks/previews. Structural release requires full exact-commit cloud
verification; local browser verification is not a production release receipt.
