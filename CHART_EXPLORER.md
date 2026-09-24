# Government finance chart explorer

`/chart-explorer.html` is a noindex review surface using the existing published
IMF benchmark (2005–2024). It adds no loader, data pointer, hosting provider or
production navigation entry.

- `lib/chart-explorer-model.js` owns country/period selection, actual-year
  boundaries and percentage-point calculations. Missing baseline values stay
  missing. Stock debt and annual flow measures have separate definitions.
- `chart-explorer.js` owns the compact controls, inline country readout and source
  context. It mounts controls once, keeps the timeline attached during pointer
  capture, and coalesces live range changes into animation frames. Trend and
  ranking use `PSDPlot`; the shared `PSDChart` rail supplies
  the exact table, CSV, attributed PNG and citation.
- `lib/chart-renderer.js` adds opt-in end labels with collision handling,
  dash patterns, series emphasis, axis formatting and aligned bar values. Its
  reusable range navigator supports dragging either edge, panning the selected
  window, clicking outside to recenter, and keyboard control. The main plot can
  brush-select a year range in either direction; double-click resets it. Line
  geometry transitions in 190 ms, with live dragging applied immediately and
  reduced-motion preferences respected. These interactions are opt-in.
  Existing consumers retain their defaults.
- Country, metric, range, comparison year, view, axis scale and level/change mode survive
  in the shareable URL. Up to four countries keep the comparison readable.
- All/10/5/3-year presets, exact year selectors, undo and reset supplement the
  drag controls. Trend axes fit the visible values by default and disclose this
  explicitly; the zero-baseline toggle is shareable. Rankings always use zero.

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

`tests/browser/chart-explorer.spec.mjs` covers browser state, live timeline dragging,
plot brushing, keyboard movement, reset/undo, reduced motion and exports in the
existing cloud browser lane. Follow the machine-wide resource guard rules for
local checks/previews. Structural release requires full exact-commit cloud
verification; local browser verification is not a production release receipt.
