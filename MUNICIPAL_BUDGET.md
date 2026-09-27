# Municipal budget viewer

One page renders the budget of any Czech municipality, keyed by IČO:

- `/municipal-budget.html?ico=<eight digits>`: any municipality.
- `/praha-budget.html`: the same page with `data-ico="00064581"` on `#budget-app`.

Both are `noindex` while the viewer is being proven. The per-municipality profiles
under `/cz/municipalities/<slug>/` are unchanged; the viewer links back to them.

## Three data tiers, one page

Sections appear only when the municipality publishes their data. Nothing is
configured per city, and a missing tier hides a section rather than showing an
empty one.

| Tier | Who has it | Sections |
| --- | --- | --- |
| Shared | all 6,254 municipalities | Overview (MONITOR history 2010–2025), Where the money goes (the budget breakdown), Local life (PAQ), Sources |
| Records | municipalities whose own CityVizor profile carries their IČO (about a dozen outside Prague) | Published records: annual statements, projects and suppliers, all records, technology |
| Extension | an entry in `lib/municipal-budget-extensions.js` (Prague only) | Prague's 57 districts in Technology, city companies, contract lookups, the consolidation note |

A CityVizor profile attaches only when its name is the municipality's own name.
Districts of statutory cities sometimes publish under the city's IČO (Brno -
Medlánky under Brno), and their records are not the city's. An extension pins its
profile by key instead.

## Files

- `lib/municipal-budget-data.js`: the published-data client, `createClient({ ico })`.
  Every path is derived from the IČO; identities are checked on every response.
- `lib/municipal-budget-extensions.js`: city-specific sources. Add an entry only for a
  source that exists for that city alone.
- `lib/cz-budget-labels.js`: reader-facing English for classification codes, shared by
  every municipality. The published codebook is Czech only, so uncovered codes show Czech.
- `municipal-budget.js`: the page and its section registry.
- `municipal-statements.js`: annual statements of one CityVizor profile.
- `lib/praha-*-model.js`, `praha-invoice-view.js`: accounting logic and the invoice
  dialog. The names predate the generalisation; the logic is not Prague-specific.

## Layout rules

- One year picker and one per-resident switch drive every section. Records follow the
  page year; a profile that did not publish that year says so.
- Where the money goes is one explorer: a treemap and a ranked list of the same
  nodes, three views (services, type of cost, revenue) and three stages. A budget line
  opens a panel with its three stages and, in the records tier, its exact-code records.
- Caveats live once, in Sources and limits, plus one line where a scope changes
  (records overlap the budget). Do not repeat them inline.

## Adding a municipality

Nothing to do: every municipality with a MONITOR history works by IČO. To link it,
point the municipality profile at `/municipal-budget.html?ico=<IČO>`.
