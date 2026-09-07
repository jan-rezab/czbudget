# Pensions today

`python3 scripts/build-pensions-today.py` rebuilds `data/pensions-today.v1.json`
from archived sources in `pipeline/source_data/pensions/`. Dependencies: openpyxl,
xlrd. No network access is needed to reproduce the output. `--stage czech` builds
only the initial Czech distribution. The default builds the complete dataset.

## Coverage and definitions

- Czechia: ČSSZ statistical yearbook 2025, table 07.03, standalone old-age
  pensions paid domestically at 31 December 2025. The three sex sheets and
  all/regular/early columns retain published counts and means. Band counts
  reconcile to published totals and across sexes. The median is a band, never an
  invented exact amount. Survivor combinations, foreign payments and pensions
  administered outside ČSSZ are excluded. The separate age table cannot establish
  an age-by-current-payment or retirement-year-by-current-payment distribution.
- OECD: Pensions at a Glance 2025, tables 7.1 and 7.2 (Statlinks crov86 and 2sqwtk).
  Comparable household disposable income and relative poverty for 37 countries;
  Colombia is missing, and Brazil/Ukraine are outside these tables. The report's
  17-country selector includes 15 observed OECD profiles. The benchmark toggle
  exposes all 37. Age splits are 66–75 and 76+, with country-specific observation
  years (2017–2023). Income is equivalised, after tax, from all sources; it is not
  an individual pension payment. Poverty uses 50% of national median income.
  The OECD income-index reference is a ratio of published age-group averages,
  not an average of the country ratios. Age and sex cuts are separate.
- USA: SSA Annual Statistical Supplement 2026, table 5.A1.1, December 2025.
  Archived CSV transcribes published retired-worker age/sex counts and means;
  counts and weighted means reconcile to totals. Includes beneficiaries abroad.
- UK: DWP benefit statistics February 2026, Figure 4 and accompanying text,
  August 2025 observations. Archived CSV transcribes weekly means by scheme and
  sex. The new system applies to people reaching State Pension age from 6 April
  2016, not simply those making a new claim. DWP covers Great Britain and overseas
  cases; separately administered Northern Ireland cases are excluded.
- France: DREES Les retraités et les retraites 2025, Fiches 05 and 06. Means for
  resident direct-pension recipients are 2023, detailed amount distributions are
  EIR 2020. Birth cohorts 1930–1953 share the end-2020 snapshot; later rows using
  ANCETRE 2021–2023 are excluded. All-career and full-career means are separate.
  Source distribution shares are rounded and are not forced to sum to 100%.

All source URLs, table identifiers, archive SHA-256 hashes, extraction methods
(for manual CSV transcriptions), publication years and observation dates are
included in the generated JSON. National payment measures are deliberately not
ranked together because their benefit coverage, units and populations differ.
An observed age/cohort gap does not isolate effects of pension rules: earnings,
contribution histories, claiming age, household composition and survivorship
must be considered before drawing a conclusion about fairness.

## UI and verification

The bilingual ageing deep dive loads `pensions-today.js` independently of the
existing population projection. Payment filters and benchmark state persist in
the URL. Every chart uses the shared PSDChart table/CSV/PNG/citation/source rail.
The table and CSV contain the plotted bands; the complete JSON preserves the
original detailed bands and additional precision. Table/CSV numeric values are
rounded to at most two decimals; counts remain integers.

Run `node --test tests/unit/pensions-today.spec.mjs` for reconciliations, coverage,
source hashes and observation-period safeguards. Run the builder again and
check the generated JSON has no diff for reproducibility.
