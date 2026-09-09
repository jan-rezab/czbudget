# Czech Ministry of Finance and grant expansions

These are separate source perimeters and financial stages. Do not combine their totals without an explicit reconciliation.

| Manifest | Detail | Meaning |
| --- | --- | --- |
| czech-mf-budget-detail.v1.json | Four complete source workbooks plus normalized series | State budget actual 2022–2025, approved 2026, proposal 2027 |
| czech-mf-monthly-2026.v1.json | Monthly cumulative cash rows | Partial-year actual 2026; future months null |
| czech-consolidated-accounts.v1.json | 2016–2024 accrual observations, original perimeter sheets | Consolidated accounting; not S.13 cash totals |
| czech-mf-employment-2025.v1.json | Tables 50–51 and exact source cells | Regulated state workforce; latest actual 2025 |
| czech-monitor-2026.v1.json | monitor-2026/unit-facts-NNN.ndjson.gz (four shards) and partner-facts.ndjson.gz | C063 municipal cash facts; actual is YTD; native partner111 is aggregate |
| czech-monitor-grants.v1.json | monitor-grants/paid-facts.ndjson.gz | RISPF monthly state grant/repayable-assistance payment facts |
| czech-isred-grants.v1.json | isred/*.csv.gz, listed per table | Source relational tables; source-export date is not retrieval date; check core_tables_complete |
| czech-dotaceeu-operations.v1.json | dotaceeu/operation-rows.ndjson.gz; financial-instrument annex embedded | Legal-act operations, payment applications and procurement rows; project amounts repeat |

ISReD source IRIs, MONITOR EDS/SMVS/ZED IDs and DotaceEU project-registration IDs are kept separately. IČO links recipient identities but does not prove that grant/project records match. No automatic cross-register sums are published.

Raw downloads live in the shared parent data/source_cache directory. Reproducible fetchers are scripts/fetch-czech-mf-sources.py and scripts/fetch-czech-grants.py. Standalone builders are named for each manifest. The employment refresh updates pipeline/source_data/cze_public_employment_observations.csv before pipeline/transforms/build_czech_public_employment.py rebuilds the explorer.

Tax source controls in czech-budget.v1.json independently reconcile historical income categories. Original rows and the three final-account income revisions are retained. Residual-to-display reconciliation alone is not treated as a correctness check. Source numeric absence fails extraction rather than becoming zero.

ČEZ issuer enrichment: `cez-issuer-2025.v1.json` preserves final 2025 consolidated ESEF facts (496 numeric tags, 148 native tables), 250 individual statement observations, and original primary-statement page text. Group 2024 figures are restated comparators in the 2025 report; the MF 2024 individual card is retained. Fiscal period, authorisation for issue, issuer publication, taxonomy publication and download dates are distinct; regulator/Justice filing date is unknown. Rebuild with `python3 scripts/build-cez-issuer-2025.py`; add `--fetch` to refresh the two verified issuer sources and retrieval/digest sidecars. Requires lxml and Poppler `pdftotext`. The individual statement PDF is explicitly the issuer's unofficial readable version; the ESEF ZIP is the official version.

Historical consolidation lists: `czech-mf-perimeter-history.v1.json` links eight declared reporting-register editions2016–2023 and seven published change workbooks (147,077 native nonempty rows including headers), plus the actual2020 list of18,159 entities released by MF under FOI on2December2021. These are distinct evidence types. Final entity lists were not found for2016–2019 or2021–2023 in the checked annual-account attachments/public MF searches; the availability matrix records those limitations and URLs. Existing2024 final-perimeter workbook remains in `czech-consolidated-accounts.v1.json`. No backcasting fromcurrentmembership or ownership inference is performed. `scripts/build-czech-perimeter-history.py --fetch` refreshes the known native workbook editions; source checksums and date columns are preserved. The originalFOI request quoted18,163 but the response/workbook explicitly identifies2020 and contains18,159 records.
