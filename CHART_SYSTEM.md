# Public Spending Data — chart system

The charts use one compact editorial grammar across the portal. The system is influenced by the Financial Times Visual Vocabulary without copying FT branding.

## Core tokens

- Ink: `#171918`
- Paper: `#FAF7EF`
- Data green: `#A8B63F`
- Deficit / warning red: `#C93237`
- Neutral comparison: `#8B8D83`
- Grid: `#D2CCC1`
- Chart typeface: Arial / Helvetica / sans-serif

## Supported charts

1. **Line chart** — change over time. Use a maximum of four lines, direct end labels when space permits, four or five horizontal grid lines, and no decorative area fill.
2. **Column chart** — composition or annual totals. Use consistent column width, square corners, restrained gaps and the shared baseline.
3. **Horizontal bar chart** — ranking and comparison. Sort deliberately, align values on the right and highlight only the selected or editorially important row.

## Required anatomy

Every chart contains a title, unit, plot, shared legend treatment when needed, and a source line immediately below the plot. Axes use sentence case, tabular numbers and no rotated unit label. Green carries the primary series; red is reserved for deficits, expenditure pressure or the selected comparison.


## Identifiers

One principle covers chart slugs and entity IDs, because both are minted once and permanent
afterwards: **readable, hand-authored, validator-enforced, and stable under data change.**

A slug derived from a content hash changes whenever the data changes, which breaks every embed
and every citation on every rebuild. That is the failure this rule exists to prevent.

- **Chart slug** — `<surface>-<subject>-<cut>`, lowercase, hyphens only, ASCII.
  Examples: `cz-budget-revenue-expenditure`, `eu-capitals-debt-per-capita`.
- **Entity ID** — `psd:<kind>:<country>:<national-id>`, e.g. `psd:muni:CZE:00254398`.
- Slugs are declared by hand, never generated. Renaming one is a breaking change to somebody
  else's article and requires a redirect, not an edit.
- The build fails if a chart has no slug, or if two charts share one. That check is written as a
  **relationship, not a count** — it belongs with the invariants, not in the count ledger.

## The affordance rail

Every chart is an addressable object, not a rendered picture. One wrapper in the chart system
carries the rail so no page reimplements it.

1. **Slug** — stable, unique, enforced by the build.
2. **State in the URL** — selected entities, year range, unit toggle. A copied link reopens what
   the reader saw.
3. **Table** — the same rows, beside the plot. This is the accessibility answer as much as the
   data one, and it is on every chart; the exception list is where this rots.
4. **Download** — the chart's own rows as CSV, and the plot as PNG at 2x.
5. **Cite** — a formatted citation carrying the vintage and the extraction date.

The rail is built against an **abstract data accessor**, never against today's artifact shapes.
When the fact store lands, what sits behind the rail is swapped without touching the rail.

## Source line

The source line below the plot resolves to a drawer, not a provider homepage. It carries the
definition, what the series excludes, the comparability caveat in the reader's language, the
exact source table identifier as text, the extraction date, the vintage type
(plan / outturn / projection / live register) and a download of the rows.

Until row-level provenance lands, the drawer is populated at **series level** from
`data/catalog.v1.json` and is labelled as series-level in the UI. Honest and shippable beats
precise and blocked.
