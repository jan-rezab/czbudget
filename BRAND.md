# Public Spending Data — brand

The mark, the wordmark and the colours. The chart grammar that uses them is in
[CHART_SYSTEM.md](CHART_SYSTEM.md).

Status: adopted. The site, generated Czech pages, favicon and social cards all
ship the primary percent-sign mark.

## Primary mark

A percent sign built from the palette. Every headline number on the portal is a
share of GDP, so the unit becomes the mark. The green and red squares carry over
from the four-square grid; a paper slash between them turns the grid into a
percent sign that still reads at favicon size.

- `assets/logo.svg` — the mark, 64 grid, rounded tile
- `assets/logo-lockup.svg` — mark and wordmark for paper backgrounds
- `assets/logo-lockup-dark.svg` — the same lockup for ink backgrounds, tile in `#242724`

Open `brand-preview.html` for the rendered sheet, the size ladder and the chart
treatment. That page is internal: it is excluded from the container image and
carries `noindex`.

## Palette

No new colour. These are the values already in `chart-system.css` and
`styles-v2.css`.

| Role         | Hex       | Token                          |
| ------------ | --------- | ------------------------------ |
| Ink          | `#171918` | `--ink`, `--chart-ink`         |
| Ink raised   | `#242724` | `--ink2`                       |
| Paper        | `#f1ede3` | `--paper`                      |
| White        | `#faf7ef` | `--white`, `--chart-paper`     |
| Data green   | `#a8b63f` | `--acid`, `--chart-green`      |
| Deficit red  | `#c93237` | `--coral`, `--chart-red`       |
| Neutral      | `#8b8d83` | `--mint`, `--chart-neutral`    |
| Grid         | `#d2ccc1` | `--chart-grid`                 |

Green carries the primary series. Red is reserved for deficits, expenditure
pressure and the one selected row. The mark is the only place both appear as
equals, because there it is typography rather than data.

Known inconsistency worth folding in while adopting: the white square is
`#FFFEFA` in `assets/favicon.svg`, `#fff` in the `.brand-grid` CSS and
`#faf7ef` as the token. The new assets use `#FAF7EF` throughout.

## Wordmark

Two lines, set in Arial to match the site body font. "Public Spending" in ink at
regular weight, "Data" underneath in deficit red at bold. Never set the wordmark
on one line, never letterspace it, never restate the name next to a lockup that
already contains it.

Clear space is half the tile height on every side. Minimum sizes: 16px for the
mark on its own, 120px wide for a lockup. Below that, use the mark.

## Alternates

Both were drafted in the same palette and kept so the decision stays visible.
Neither is wired to anything.

- `assets/logo-alt-treemap.svg` — B, budget blocks. The four squares become a
  treemap, so the tile shows a spending split instead of a decorative grid.
- `assets/logo-alt-rows.svg` — C, league table. The comparison chart itself as
  the mark, red row standing in for the selected country.

## Chart treatment

`brand-preview.html` section 04 is a working reference implementation, not a new
chart type. It keeps the homepage hero grammar (ink panel, monospace furniture,
one green series, a single red highlight, source line below the plot) and adds
country identity: the flag from `assets/flags/` with the ISO-3 code as a tag
across its lower edge, so a reader finds their country without reading every
label. The tag inherits the row's colour, which is how the selected row stays
obvious once flags are in play.

Its numbers are read from `lib/data/sovereign-benchmark.v1.json`
(`gross_debt_pct_gdp`, 2024 actuals) so the sheet cannot drift from the data.

## Adopting the mark

The header lockup is markup plus CSS, not an image, so this is a real change and
not a file swap. In order:

1. Replace `assets/favicon.svg` with the contents of `assets/logo.svg`.
2. Rewrite `.brand-grid` in `styles-v2.css`. The current rule builds the tile
   from four `<i>` children on a CSS grid; the new mark needs the diagonal, so
   either point the class at `assets/logo.svg` as a background image or inline
   the SVG in the markup.
3. Update the header in the five hand-written pages: `index.html`,
   `country.html`, `municipalities.html`, `eu-capitals.html`,
   `cesky-rozpocet.html`.
4. Update the same header in `pipeline/transforms/build_czech_site.py`, which is
   the single source of the remaining 6,271 pages under `cz/`, then regenerate.
5. Regenerate the three `assets/og-*.png` social cards, which carry the old mark
   as bitmap.
6. Run `npm run validate` and `npm run test:browser`.

Steps 3 and 4 have to land together. A half-adopted header means the generated
municipal pages and the hand-written pages disagree, which is visible on every
navigation between them.
