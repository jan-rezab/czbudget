# European politics: governments, crawled programs and observed policy

Route: `/deep-dives/european-politics/`, Czech and English. Native static website stack; linked from the deep-dive index and shared navigation. Historical scope is **2015–2024**, not current incumbents. The original benchmark is CZE, UKR, POL, DEU, GBR, FRA, USA, CHE, SWE and DNK. The US is the non-European comparator.

## Coverage and evidence

The report contains 51 government periods, 47 linked government/coalition documents, ten downloaded party election programs and 11 manually reviewed fiscal commitments. All ten party programs and all 11 outcome/baseline sources were downloaded and extracted. The wider government-document crawl has explicit download/extraction failures; a linked document is never counted as a successful download just because its URL exists.

The party selection is one governing-party program per country, including a Socialdemokratiet welfare proposal and Macron's presidential election program. It is **not** every party, historical manifesto, or fiscal commitment. Full documents are parsed for fiscal/numeric candidate passages; candidates can include background statistics and are not automatically classified as promises. Only the reviewed selection receives normalized targets and outcome commentary. Opposition programs and systematic whole-manifesto adjudication remain a coverage gap.

Reviewed topics: Czech employer contributions; German wealth tax; Danish education cuts and demographic welfare funding; French corporation tax; UK National Insurance; Polish minimum pension; Swedish incineration tax; Swiss VAT position; Ukrainian defence spending; US corporation tax. Each record has an exact short source excerpt, PDF page where applicable, original URL, government references, observation date, target/deadline, comparability status, bilingual explanation and outcome evidence.

## Reproduction

```sh
npm run crawl:european-politics
npm run audit:european-politics
npm run build:european-politics
npm run validate:european-politics
npx playwright test tests/browser/european-politics.spec.mjs
```

- `scripts/crawl-politics-programs.py` uses requests, BeautifulSoup and Poppler `pdftotext`. Defaults to the private cache `../outputs/politics-source-crawl`, outside the serving repository. It rejects cache paths inside this repository. Full PDF/HTML files, per-page text and candidate passages remain private. Distinct document bodies are preserved in SHA-256-addressed snapshots with dated retrieval metadata. Successful unchanged URLs use the cached body; `--refresh` fetches again.
- Source seeds: `pipeline/config/politics_manifestos.v1.json`, `politics_outcome_sources.v1.json`, and optional government documents from `european_politics.v1.json`.
- `data/politics-source-crawl.v1.json` publishes provenance/status/counts, not full copyrighted program text. A failed extraction is retained as failed and does not produce an invented outcome.
- `pipeline/config/politics_promises.v1.json` is the reviewed dataset. Source hashes are frozen at review. Changing a crawled body fails the serving build until the associated records have been reviewed again. Do not automatically update reviewed hashes to silence this check.
- `scripts/audit-politics-evidence.py` verifies all 22 source and outcome text/page references against the private raw bytes and frozen hashes. It needs the crawl cache; normal CI validation intentionally runs without that private cache.
- `scripts/build-european-politics.mjs` joins political records to the established IMF WEO benchmark and portrait metadata, emitting `data/european-politics.v1.json`. `--check` verifies byte-for-byte reproducibility. No network fetch is required to serve or validate the page.
- `scripts/fetch-politics-portraits.py` downloads 36 distinct leader thumbnails from Wikimedia, preserving source, author, license and image date. It requires Pillow in addition to requests/BeautifulSoup. Source JPEGs and credits are in `assets/politics/`. Images are embedded into the serving JSON so SVG-to-PNG export remains self-contained. The report and exports link to attribution; photographs are illustrations of the person and can postdate the plotted term. Switzerland is identified as a collective council, not by a fictitious prime minister.

## Interpretation

The 51 records represent prime minister tenures and selected coalition changes, US presidential terms, and Swiss legislative periods. They do not mean 51 distinct cabinets. Start dates are inclusive and ends exclusive. `end: null` means still in scope at **2024-12-31**, not still incumbent today. Outgoing caretaker time is retained until the successor takes office. Reappointments/reshuffles under the same premier are grouped for France/UK, with Cameron's coalition change split. France identifies presidents in the political context. Swiss annual presidential rotation does not create a new government.

47 linked government documents cover 50 periods. Bayrou's statement was in January 2025 and is outside scope. Reused or later documents retain real publication dates and notes. Shmyhal's 2020 program was a government proposal not approved by Parliament; it predates the full-scale invasion. Summaries of these government documents are distinct from reviewed party pledges.

Promise assessments are editorial, item-specific and dated. “Implemented” means the specified measure is observed in the cited evidence, not a score for an entire party. Unspecified deadlines are not invented. The UK NI increase remains a breach during the Parliament even though it was reversed. The US pledge only specifies an increase, so 21% is a strict comparison threshold, not an invented exact target. An uncollected German wealth tax is not a statutory 0% rate. The Danish 2025 welfare envelope is outside the report and has no matching outturn. Swiss opposition to VAT increases is a party position; the 2024 rate change is subsequent context, not an individual-party mandate score. Ukraine's broad security/defence resources including guarantees do not match defence expenditure alone, so no fulfilment rating or common-scale bar chart is assigned to that comparison.

## Economic charts and interaction

The reference's visual structure is implemented as leader portraits, GDP columns, public-debt line, government bands, event markers and headline changes. Columns remain genuinely annual; quarterly observations are not fabricated to mimic the reference's denser bars. Country scales differ. Colors identify data and selected periods, not ideology.

GDP is nominal USD billions; debt covers general government. Dollar debt is derived as `GDP_USD × debt_pct_GDP / 100`, an approximate conversion of an end-year stock with annual GDP/exchange-rate conventions. Real GDP is indexed to 100 in 2015 and chains growth for 2016–2024. Missing growth breaks the index. Headline changes cover the whole 2015–2024 interval. Annual rows list every overlapping government; annual results are not attributed to one cabinet. GDP/debt changes are context, not a promise score or causal estimate.

Country, government, view and language persist in the URL; back/reload work. All economic charts and promise comparisons use the shared PSDChart table, CSV, citation and source rail. Matched numerical charts also export PNG. Non-comparable/textual outcomes provide tables and CSV without a misleading numerical PNG. Embedding is disabled because these charts are not registered in the public oEmbed service. Hand-authored slugs remain stable. Narrow-screen timelines scroll inside their cards; promise values remain readable above the scrollable plot.

Validation covers original benchmark membership, continuous political coverage, source hashes, fiscal value/status preservation, missing/future/incomparable observations, strict targets, the NI reversal and portrait attribution. Browser tests cover both languages, all ten countries, short terms, selection/history, evidence links, tables, CSV/PNG downloads and viewport overflow.
