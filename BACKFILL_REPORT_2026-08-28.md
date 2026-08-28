# PublicSpendingData backfill report — 2026-08-28

This report records the remediation of the 2026-08-28 integrity-audit gaps. A status downgrade is intentional when the authoritative data needed for a defensible value could not be obtained. No total was synthesized from overlapping accounting rows.

## Raw-source inventory added in this run

| File | Exact URL | Bytes | Parsed content |
|---|---|---:|---:|
| `data/source_cache/international_municipal/FRA/ofgl-base-communes-2024-2025.csv` | `https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-communes/exports/csv?select=exer%2Ccom_code%2Ccom_name%2Creg_code%2Creg_name%2Cdep_code%2Cdep_name%2Cptot%2Cpresence_budget%2Cagregat%2Cmontant&where=year%28exer%29%3E%3D2024%20and%20cbudg%3D%221%22%20and%20agregat%20in%20%28%22Recettes%20totales%22%2C%22D%C3%A9penses%20totales%22%2C%22Recettes%20de%20fonctionnement%22%2C%22D%C3%A9penses%20de%20fonctionnement%22%2C%22Encours%20de%20dette%22%2C%22Epargne%20brute%22%29&use_labels=false` | 39,048,046 | 418,260 CSV data rows; required OFGL fields parsed; 34,875 current commune profiles written, 34,778 with 2025 data |
| `data/source_cache/demography/WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz` | `https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz` | 66,954,143 | gzip/CSV parsed; 4,316,235 data rows; `ISO3_code`, `Time`, age and sex fields present |
| `data/source_cache/source-link-repairs/JPN-mhlw-health-insurance-overview.pdf` | `https://www.mhlw.go.jp/content/12400000/001406614.pdf` | 1,120,907 | valid PDF, 12 pages, current MHLW health-insurance overview |
| `data/source_cache/source-link-repairs/CHE-efv-open-government-data.html` | `https://www.efv.admin.ch/de/open-government-data-de` | 120,777 | HTML parsed; EFV Open Government Data / financial-statistics markers present |
| `data/source_cache/source-link-repairs/CHE-efv-federal-enterprises.html` | `https://www.efv.admin.ch/de/unternehmen-anstalten-bundes` | 231,698 | HTML parsed; federal enterprises heading and Swisscom entry present |
| `data/source_cache/source-link-repairs/NLD-mobiliteitsfonds-2026.html` | `https://www.rijksoverheid.nl/documenten/2025/09/16/a-mobiliteitsfonds-rijksbegroting-2026` | 224,202 | HTML parsed; 2026 Mobility Fund budget marker present |
| `data/source_cache/source-link-repairs/GBR-statswales-budgeted-revenue.html` | `https://stats.gov.wales/en-GB/88384d5e-1a50-4496-849c-7195ddd4185f` | 114,911 | HTML parsed; exact live dataset title present |

The previously archived Welsh CSV is 2,916,750 bytes and 20,785 data rows. Its retired POST URL remains in the acquisition registry strictly as historical archive provenance; `landing_url` is the current public citation. New and existing raw sources are hashed by `pipeline/source-assets.manifest.json`.

## Gap 1 — capital core-municipality populations

- Reverified the perimeter defect and retained the old greater-city population for map/tourism uses.
- Added `benchmarks.core_municipality_population` with independent value, year, geography, source and missing reason. The budget-per-resident code now uses only this perimeter-matched field and renders unavailable safely.
- Reused the archived Eurostat `urb_cpop1` response (`eurostat-urb-cpop1-DE1001V.json`, 317,516 bytes, 17,091 observations) and the existing Prague entity record. No new raw download was required.
- Exact Eurostat API family: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/urb_cpop1`; configuration and city identifiers are in `pipeline/config/eu_capital_benchmark_sources.json`.
- Defensible matches were published for 12 of 28 capitals: Berlin, Helsinki, Ljubljana, Prague, Riga, Rome, Sofia, Tallinn, Vilnius, Warsaw, Zagreb and London. The other 16 are explicitly unavailable because the available population geography does not match the stated budget perimeter.
- Prague is 1,398,674 at 2025-07-01 from CSU DataStat `OBY01B01_9379W`. Every numeric KPI is between EUR 50 and EUR 30,000 per resident.

## Gap 2 — municipal headline finance

- Reverified DNK 98/0/0, GBR 318/0/0, POL 2,486/0/0, SWE 290/0/0 and UKR 1,467/0/0 for entity/revenue/expenditure.
- No complete, non-overlapping revenue/expenditure pair for every directory entity was present in the retained source collections. All five countries are now `aggregate_only`, with `missing_dimensions` for entity revenue, expenditure and balance and a bilingual explanation that synthetic sums are prohibited.
- Corrected Denmark's documented StatBank table from `BUDK32` to `BUDK100`; exact source location is `https://www.statbank.dk/BUDK100` alongside `REGK100` final accounts.
- The OFGL download listed above was acquired and parsed so the full 34,875-commune France headline layer remained intact while the international directory was rebuilt. France has 34,778 provisional 2025 profiles; 97 are explicitly missing the latest year.
- Could not obtain defensible five-country headline values in this run. The honest downgrade is the shipped result.

## Gap 3 — Costa Rica and Colombia line items

- No new SIPP or CUIPO account-level export was obtained. Existing CRI data has one code (`TOTAL`); COL has two roots (`1`, `2`); KOR has four roots.
- Added a five-distinct-code publication threshold. Five is the smallest threshold that rejects totals/two-root trees while retaining the thinnest healthy comparator, Italy at ten codes.
- CRI, COL and KOR are now `headline_only`, publish zero itemized profiles in the KPI, and retain their profile pages as headline data. This removes 1,429 pseudo-itemized profiles from the count.
- Wrote the threshold, measured distinct-code count, rationale and publication status to `municipal-itemized-coverage.v1.json` and propagated it through municipal transparency, methodology and global transparency.

## Gap 4 — eight dead citations

- UN WPP: replaced the dead portal URL with the exact 66,954,143-byte archive above and rebuilt both demography artifacts.
- CHE transport: replaced `/en/data-fs` with EFV's working OGD location above; the Eurostat transport observations remain the numeric source.
- CHE municipalities: `/de/fs-daten` is indexed again but returned 404 to the raw client. The entity layer remains honestly `aggregate_only`; EFV OGD was archived as the current official discovery location.
- CHE public entities: replaced `/de/unternehmen-anstalten` with `/de/unternehmen-anstalten-bundes` and propagated it into coverage and directory artifacts.
- JPN health: replaced the dead directory URL with the archived current 12-page MHLW overview PDF. Numeric SHA observations continue to cite OECD separately.
- NLD transport: replaced the retired Infrastructuurfonds topic with the exact 2026 Mobility Fund budget page above.
- ESP transport: no stable like-for-like current Ministry budget location could be verified. The dead secondary link was removed, the national bridge was downgraded to fragmented, and the loaded numeric layer continues to cite Eurostat/OECD only.
- GBR Wales: archived and parsed live dataset page plus the existing 20,785-row CSV. The historical POST endpoint is labelled as provenance and is no longer presented as the live citation.

## Gap 5 — Brazil health and transport

- OECD SHA returned no numeric Brazil leaves in the retained artifact. A refresh attempt on 2026-08-28 was rate-limited with HTTP 429; no response body was accepted as data.
- BRA health is now `not_loaded` with missing dimensions for SHA expenditure, financing shares, provider shares and beds. Existing performance-only content remains separate.
- BRA transport has no spending or performance observations and now has `vintage_type: none`, `coverage_status: unavailable`, not an invented actual year.

## Gap 6 — Ukraine health

- No new financing profile was obtained. The freshness generator now unions health-financing and health-performance country keys.
- Ukraine is visible as `performance_only`, with actual observations spanning 2015–2024 in the current performance artifact. It is no longer rendered not researched.

## Gap 7 — Poland and Ukraine provider registers

- No bulk RPWDL or NHSU register was obtained, so no provider files or counts were invented.
- Both countries now render `not_loaded`, `vintage_type: none`, and explicitly say that the adapter/register artifact is pending. They no longer render LIVE.
- Replaced the frozen `20260822` date cutoff in the provider generator with the UTC build date.
- The cross-country comparability warning is retained. A country cannot become loaded until it has a positive facility count and a records artifact with a documented filter.

## Gap 8 — Paraguay

- No new municipal directory was found. The already validated World Bank BOOST warehouse entry is now an explicit 28th coverage row: `warehouse_only`, 263 profiles, 281,957 line facts, 2006–2022.
- Exact existing source: `https://datacatalogfiles.worldbank.org/ddh-published/0038079/2/DR0092933/Paraguay%20BOOST%20PS%202006-22%20%28SP%29.xlsx`.
- Paraguay is no longer shown as not researched and is not falsely counted as published.

## Gap 9 — sovereign metrics

- Reused the already archived IMF April 2026 WEO workbook, `data/sources/international_fiscal/WEOApr2026all.xlsx`: 5,585,205 bytes, SHA-256 `b29239cb48f8b895d1e526070c4fde01147bc8f6bd3b86f636363bb6bd87fe7a`, 8,668 data rows on the `Countries` sheet. No new sovereign source was downloaded.
- Expanded the sovereign contract from 191 to all 195 states. CUB, MCO, PRK and VAT now have explicit `not_loaded` all-null series and country pages rather than silent absence.
- Missing WEO metrics remain null with `not_available` status; they were not imputed.
- Freshness periods now come from actual non-null observations: SYR 2005–2010, ERI 2005–2019, YEM 2014–2024, SOM 2011–2024 and SSD 2011–2024.

## Gap 10 — lower-priority checks

- Switzerland remains `aggregate_only`; no defensible all-commune entity extraction was obtained.
- Transport for GBR, JPN, UKR and USA retains unavailable/empty coverage but now uses `vintage_type: none` instead of actual years over empty arrays.
- The existing warning remains: 500 of 637 comparable public entities lack a 2024 statement. No statements were invented or relabelled.
- Czech municipality count remains 6,254. The task's correction was confirmed: Doupovské Hradiště and Luboměř pod Strážnou are present. No evidence supported changing the fixed reporting-universe tripwires.

## Deliberate tripwire changes

| Guard | Old | New | Reason |
|---|---:|---:|---|
| sovereign countries | 191 | 195 | four explicit WEO-unavailable states |
| itemized coverage countries | 27 | 28 | explicit PRY warehouse-only row |
| itemized published-profile floor | 35,810 | 34,381 | remove 1,429 headline/root-only profiles |
| published data-entry floor | 362,446 | 361,017 | same counter correction |
| methodology loaded-row floor | 374 | 370 | five false municipal headline loads removed; UKR performance health added |
| methodology ledger rows | 2,128 | 2,173 | 195-state and 28-country coverage contracts |
| sovereign estimate-vintage rows | 20 | 19 | ERI correctly ends at actual 2019 |

`municipalUnitsInScope` remains 107,537, the Czech municipality guard remains 6,254, and all other fixed integrity counts remain unchanged.

## Final reconciled totals and validation

- Backfill freshness contract: 195 countries, 15 modules, 449 records, 107,537 municipal units, 105,416 entity rows, 27 directory countries, 28 itemized-coverage countries and 34,381 published itemized profiles. (A separate concurrent OECD-overlay change in the shared checkout adds a sixteenth module; it is not part of this commit.)
- Integrity report: 42,545 production JSON files, 35,892 HTML files, 567,981 local references, 6,254 Czech municipalities, 100,021 municipal-history rows, 195 sovereign states and 361,017 published data entries.
- Required commands run from `website/`: `npm run validate`; `node scripts/validate-integrity.mjs`; and `node pipeline/create-source-manifest.mjs --verify`.
- Source manifest verification: 147 entries, 16,075 files and 3,865,763,052 bytes.
- Python dependencies were already installed; the chained Python validation completed. The only acquisition failure accepted in this run was OECD HTTP 429 during an attempted health refresh, after which the last validated artifact was retained and Brazil remained honestly `not_loaded`.
