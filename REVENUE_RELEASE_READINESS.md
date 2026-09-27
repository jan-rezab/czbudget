# Revenue visual candidate — preparation only

27 September 2026. User prohibited push and deployment; these remain prohibited.

The page adapter now reads `/api/v1/revenue/current`, backed by a generation-pinned,
SHA-verified private GCS export. Web builds and runtime never query BigQuery or
invoke loaders. Export code lives in the dedicated data branch, not this checkout.

The shared `funding-flow` renderer owns animated paths and source/recipient cards.
Clicking a source shows only independently supplied tax-specific allocations.
Unknown allocations remain unavailable; aggregate transfers never allocate VAT.
Reported ESA counterpart payments can produce separate dashed onward routes.
Motion pauses for reduced-motion, hidden tabs, offscreen charts and user pause.
The same amounts and primary source URLs appear in an accessible value table.

Czech cash examples use cited 2023 figures and have a separate date/basis note.
Other countries use their actual OECD tax year and recipient levels. German VAT
cash shares apply only to 2023. Original nominal OECD source observations are
available when a tax source is selected. Transfer/grant and health-financing
observations retain units, periods and bases in separate tables; overlapping health
parents/children are never summed into taxes. Tax percentages and the residual
category are labelled as calculations. Incomplete tax pies are withheld, missing
observations are not zero, and low-coverage countries are excluded.

## Verified locally

- 19 focused cloud-model tests; 10 focused JavaScript/API/registry contracts.
- Generated shared assets and coverage registry validated; no new page-owned SVG.
- Built-in browser with explicitly synthetic country fixtures: Czech VAT selected
  municipal amount146.56/share25.84; German VAT local share2.8; Australian unknown
  allocation remains unavailable; pause; keyboard arrows/Escape; country filter;
  excluded-USA URL disclosure;390px viewport has no horizontal overflow.
- Ancillary OECD rate/trend requests return404 in the deliberately sparse synthetic
  preview. They are not evidence of failure or coverage in the real serving data.
- Cloud-loaded serving data must still be independently verified after publication;
  synthetic fixtures are never production source observations.

## Release prerequisites still pending

1. Verified transfer release and private serving export completion receipt.
2. Read access for `psd-web-runtime` restricted to the revenue-serving object prefix.
   It currently has no access to the private bucket; broad warehouse/raw access is
   unnecessary and must not be granted.
3. Current-main integration and exhaustive exact-commit website verification.
   Server/routing changed, so the full lane applies. No cloud website verification
   or production build has been submitted during this preparation.
4. Explicit user authorization to push/deploy. This file does not authorize it.
