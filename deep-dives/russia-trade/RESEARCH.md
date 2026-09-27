# Russia trade: research notes for the aggregate view

Audit: 26 September 2026 UTC. Code review only; deployment is on hold at the user’s request.

## Question and identification

Did growth in goods supplied to Kazakhstan and Kyrgyzstan coincide with growth in their exports to Russia? Which suppliers and product groups account for the pattern? The hypothesis is not that the entire fall in direct exports mechanically moved to these two markets.

This is a descriptive investigation, not a causal estimate or a sanctions-violation finding. Broad HS2 matches cannot identify the same HS6 products, let alone the same shipments. Domestic demand, local production, inventories, price and exchange-rate changes, classification changes and reporting differences are competing explanations. A causal research extension needs a dated HS6 sanctions concordance, stable product/reporter panels, an explicit control group and event-study/pre-trend checks.

## Published warehouse basis

- Table: `czbudget-janrezab.budget_detail.trade_observations`; areas: `budget_detail.trade_areas`. No loading or warehouse mutation was performed.
- All figures below are **calculated sums of available original HS6 records**, nominal/current USD. They are not official all-merchandise TOTAL observations. See executable `RUSSIA_AGGREGATE_SQL` and `RUSSIA_SUPPLIERS_SQL` in `server/russia-trade-store.mjs`.
- One newest observation per period, reporter, flow, partner and HS6 code before aggregation. Original HS classifications only; total customs/transport/second-partner dimensions only. Regional area groups are excluded. World rows and bilateral rows are separate; neither are added to their mirror reports.
- Annual and monthly data are queried separately. The warehouse has annual observations for both hubs for 2014–2025. Monthly starts in January 2024; missing months remain null. The default selects the latest period with all four hub observations, not necessarily complete source reporting.
- Reference year: 2019, the first of the three pre-invasion years requested. The 2020–2022 Kazakhstan detail has a material gap versus national totals; a 2019–2021 mean would not be a defensible all-market baseline.
- Ingestion IDs identify contributing loads, not an immutable snapshot. Exact decimal aggregate strings, product counts, release IDs and source-response hashes are exposed by the API/CSV. Floating-point UI changes are calculations; original aggregate strings are retained.

## Aggregate evidence

Coverage: all available original HS6 World-partner import records and Russia-partner export records for each hub/year.

| Hub | Year | Calculated imports from World, USD | Calculated exports to Russia, USD | Import HS6 count | Import ingestion release |
|---|---:|---:|---:|---:|---|
| KAZ | 2019 | 39708836450.91 | 5670903385.47 | 4901 | `un-comtrade-ce02ecee_a628_4629_b650_c28502be7c1b-A2019` |
| KAZ | 2024 | 59787310605.21 | 9546501217.33 | 5022 | `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2024` |
| KAZ | 2025 | 65430964027.14 | 8248320168.08 | 4962 | `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2025` |
| KGZ | 2019 | 4988946048 | 281252923 | 3819 | `un-comtrade-ce02ecee_a628_4629_b650_c28502be7c1b-A2019` |
| KGZ | 2024 | 11907253050 | 976059109 | 4109 | `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2024` |
| KGZ | 2025 | 12006693772 | 493334841 | 4119 | `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2025` |

## Product dependencies

Ranking score = min(positive change in World imports, positive change in exports to Russia), versus 2019, within each hub/HS2 chapter. Rank is an exploratory ordering, **not** a dollar estimate or upper bound of rerouted trade. Russia reliance = Russia exports / World exports for that same hub/chapter/year.

| Hub / chapter | 2019 imports USD | 2025 imports USD | 2019 exports to Russia USD | 2025 exports to Russia USD | 2025 World exports USD (share denominator) |
|---|---:|---:|---:|---:|---:|
| KAZ / HS 84 | 8219833378.18 | 10973271024.13 | 162521670.04 | 830365864.66 | 1917253460.43 |
| KAZ / HS 85 | 4312327065.06 | 6532840975.89 | 112385243.22 | 561062377.5 | 1112328557.69 |
| KGZ / HS 84 | 498310585 | 2155946162 | 1163539 | 141658731 | 180260919 |
| KGZ / HS 90 | 55119747 | 193095447 | 630674 | 31670927 | 34388940 |
| KGZ / HS 87 | 171917811 | 1876537421 | 16068121 | 36318507 | 93420738 |

Machinery (84) and electrical equipment (85) are clear candidates for closer product-level work in Kazakhstan; machinery (84) and optical/medical instruments (90) stand out in Kyrgyzstan. This conclusion describes the observed baskets and does not equate the goods on the inbound and outbound sides.

## Annual category stacks

Added 27 September 2026 UTC. Each hub has a separate stacked dollar chart for 2014–2025, using the same annual warehouse observations described above. The flow control selects World-partner imports or Russia-partner exports; these are separate declarations.

For the selected end year, rank HS2 chapters by positive `end-year USD − baseline-year USD` (2019 by default), retain the largest five, and hold that category cohort fixed across the timeline. Rank by absolute growth so a tiny starting value cannot dominate solely through a large percentage increase. The companion table shows the dollar change and `(end-year / baseline-year − 1) × 100`; a zero baseline has no percentage. Grey is the observed annual subtotal minus the highlighted categories, including all remaining or declining chapters. This is a composition chart, not a stack of the changes themselves.

Columns use current USD, not 100% shares. Each hub has its own clearly disclosed vertical scale. Missing highlighted categories or an inconsistent negative remainder leave a column blank, rather than treating unknown data as zero. Annual categories remain available when the main view switches to monthly or a selected product. The existing Kazakhstan 2020–2022 coverage warning applies to these columns too. All source-figure limitations and release metadata above remain applicable.

## Mirror discrepancies are central evidence

Coverage: available original HS6 China-export and hub-import declarations, annual 2024, nominal USD. Export values generally use FOB and import values CIF. Definitions, product coverage, valuation and timing differ.

| Route | China-reported export subtotal USD | Hub-reported import subtotal USD | Calculated export minus import USD | Hub import source-response SHA-256 |
|---|---:|---:|---:|---|
| CHN → KAZ | 27954331004 | 15153469835.46 | 12800861168.54 | `64d50f56c58f3d9e68b6676778e3ec2e456b26c3b65ce93f34700fe8bb0e54da` |
| CHN → KGZ | 19904739264 | 5451009328 | 14453729936 | `dc4f2e8973e6c931764b2e00fe25ddc02631617d143583f11d0757d553bee557` |

Both sides contribute from ingestion release `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2024`. A mirror gap is a research lead, not proof of hidden exports into Russia. The page exposes both declarations without combining them.

## Direct versus hub comparison

The annual exporter panel requires reported values on all three bilateral links (RUS, KAZ, KGZ) in both 2019 and the selected year. It excludes the hubs themselves and Russia and removes geographic groups such as the EU to avoid country/group double counting. Missing bilateral records are not zeros.

- 2024 panel: 69 of 158 observed suppliers. Calculated change in direct Russia exports: USD −9,953,204,369.590; change in exports to the two hubs: USD +45,340,848,132.404. These are sums of reporter-level 2024 minus 2019 changes, not a global total or an offset estimate.
- China alone increased its calculated direct exports to Russia from USD 49,748,486,510 in 2019 to USD 115,275,861,485 in 2024. Its combined calculated exports to the hubs increased by USD 28,849,449,645. This directly contradicts a universal “direct trade disappeared and simply moved to neighbours” explanation.
- Germany’s corresponding calculated direct-Russia change was USD −22,277,722,231.724, versus a combined hub increase of USD 2,140,225,825.201. Different suppliers follow different patterns.
- 2025 panel: 61 of 158 observed suppliers; China lacks a complete annual panel and is excluded. The page names major excluded suppliers and lists the others. Comparisons between the 2024 and 2025 panel sums are not like-for-like.

## External validation and research sources

1. [Kazakhstan Ministry, 2021 trade](https://www.gov.kz/memleket/entities/mti/press/news/details/326171?lang=en): reported all-merchandise imports **USD 41.2 billion**, Kazakhstan, calendar 2021. The warehouse HS6 sum is **USD 27,751,611,648.923**. Different vintage and detail coverage are retained; no adjustment is inserted into the series.
2. [Kazakhstan in figures, 2023 edition, printed p.17](https://stat.gov.kz/upload/iblock/cde/io7mclsii6ir2hljujzhjbrkrdoyxfxl/%D0%A1-06-%D0%93%20%282020-2022%29%20%D0%B0%D0%BD%D0%B3%D0%BB.pdf): national import total **38,929.1 million USD (2020)** and **41,415.4 million USD (2021)**, all merchandise, Kazakhstan. The 2021 figure is a later source vintage than the ministry release. The printed 2022 total appears inconsistent with its component rows, so it is not used to calculate an adjustment.
3. [Chupilkin, Javorcik and Plekhanov, EBRD Working Paper 276](https://www.ebrd.com/home/news-and-events/publications/economics/working-papers/the-eurasian-roundabout.html): HS6 monthly research on intermediated trade and sanctioned-product differences. Its identification strategy is stronger than our descriptive HS2 ranking; its results are not inserted as warehouse observations.
4. [UN Comtrade confidentiality guidance](https://uncomtrade.org/docs/data-confidentiality-in-un-comtrade/): detail and parent totals can differ because of confidentiality and national reporting. This possibility does not establish the cause of this specific warehouse gap.
5. [WCO HS 2022 impact table, Annex IV-B](https://www.wcoomd.org/-/media/wco/public/global/pdf/topics/origin/instruments-and-tools/guidelines/annex-iv_b-impact-of-hs-2022-amendments-on-rules-of-origin_en.pdf): the selectable HS6 examples 854231, 847130, 845710 and 848210 are unchanged between HS 2017 and HS 2022. Broad chapter composition may still change.

## Verification and release boundary

Read-only BigQuery aggregate queries were executed in EU with bounded scan limits; no new data pipeline or publication was initiated. Local source/API/model checks and the built-in-browser review are recorded in the task receipt. The exhaustive cloud gate and production promotion remain pending, deliberately: the user asked not to deploy during deployment optimization.

## Earlier history and preparedness question — 27 September 2026

The annual consumer query now starts in 2014. A bounded, read-only warehouse coverage query verified observations for both hubs for each year 2014–2018, separately for World imports, World exports and Russia exports. The exact earlier aggregate query output is retained outside the website checkout for local review; no source ingestion, warehouse mutation or data publication took place. The query retains original HS classifications: Kyrgyzstan uses H3 in 2014, H4 in 2015–2016 and H5 in 2017–2018; Kazakhstan uses H4 in 2014–2016 and H5 in 2017–2018. HS2 chapters are broad and their composition can change across revisions; no detailed-code concordance is claimed.

The stack controls support selecting a pre-invasion baseline (2014–2021) and a later comparison year. Selecting 2014 → 2021 investigates whether these declared baskets were already expanding before the full-scale invasion. The default remains 2019 → latest. The earlier annual history is descriptive context; the dependency and supplier comparison tables retain their explicitly labelled 2019 reference. The supplier panel starts in 2019 and is unavailable for earlier years. Kazakhstan’s known 2020–2022 detail gap materially limits any conclusion about a pre-invasion buildup.

[Bank of Russia, Nabiullina speech, 18 April 2022](https://www.cbr.ru/eng/press/event/?id=12843) is a retrospective official account. It describes diversification of reserves and reduced foreign-currency exposure since 2014, and development of a domestic financial messaging alternative following the threat of SWIFT disconnection in 2014. This supports a specific claim of financial sanctions preparedness. It does not establish advance preparation of these merchandise routes or the timing of a decision to invade. The same speech says manufacturers would need to find new partners and logistics routes after import restrictions; this is relevant counterevidence to a claim that everything was already arranged.

[EBRD Working Paper 276](https://www.ebrd.com/content/dam/ebrd_dxp/assets/pdfs/office-of-the-chief-economist/working-papers/working-papers-2023/WP-276.pdf) identifies sharp changes in direct and intermediated trade following sanctions in March 2022, using HS6 monthly data. The current annual descriptive charts cannot distinguish preparation from ordinary market growth, Eurasian integration, prices or pandemic effects without additional identification. The preparedness framing is therefore an investigable question, not the chart’s asserted conclusion.

## Kursiv precedent — 27 September 2026

[Svyatoslav Polyakov, Kursiv Uzbekistan, 9 July 2026](https://uz.kursiv.media/2026-07-09/chto-izmenilos-v-torgovle-kyrgyzstana-posle-fevralya-2022-goda-i-prichem-zdes-sankczii/) informs the five-supplier selection and product questions in the page. Article findings remain attributed research leads, rather than newly verified observations.

The added chart uses independently queried warehouse exporter declarations to Kyrgyzstan, for South Korea, Georgia, Germany, Türkiye and Italy together. Annual values remain annual when the main view switches to monthly. It respects the selected product, preserves missing years, and exports the same values used by the plot. The table uses the selected year when observed, otherwise the latest available annual year at or before it, explicitly disclosed. It never substitutes a later year for an earlier selection. It calculates that year minus 2019 in current USD, alongside percentage change; missing baselines yield no change and zero baselines yield no percentage. Its cohort is editorially selected and is not an exhaustive or ranked supplier panel.

The page does not insert the article’s rounded source figures, monthly curves, rolling averages or inferred break dates. Our warehouse consumer lacks monthly observations before 2024. Annual points cannot verify an intra-year 2022 breakpoint or a monthly plateau. HS2 vehicles and precious metals chapters cannot isolate passenger cars or jewellery; validating those questions requires original HS4/HS6 detail, classification concordances, complete monthly panels and source code mappings. No sensitive-product or sanctions status is assigned to an entire HS2 chapter.

Further independent checks should compare stable reporter/product coverage, absolute versus relative changes, nominal value versus reported quantity, importer/exporter valuation differences, and competing domestic-demand explanations. Those are validation requirements, not findings claimed by the new chart.


## Other direct suppliers and China’s bilateral composition — 27 September 2026

This iteration adds a separate direct-supplier ranking, annual country–Russia history in both directions, and an HS2 composition chart. It is saved locally for review and is not deployed. The ranking uses every available supplier with both 2019 and the selected year; countries with missing endpoints are named separately. It is an absolute current-USD change ranking, not a sanctions or military-supply score. South Korea (KOR) must not be confused with North Korea (PRK).

Coverage for the following figures: supplier-reported annual exports to Russia, calculated sums of deduplicated original HS6 merchandise observations in `czbudget-janrezab.budget_detail.trade_observations`. World rows, parent aggregates and Russia’s mirror declarations are excluded. All values are current USD. The comparison is 2019 → 2024, a shared observed endpoint for China and the countries below; it is not a complete global panel. Source: executable `RUSSIA_SUPPLIERS_SQL` in `server/russia-trade-store.mjs`, existing bounded audit output. Contributing loads are `un-comtrade-ce02ecee_a628_4629_b650_c28502be7c1b-A2019` and `un-comtrade-r_5c184e3f_c7b6_4629_be5e_2db16aa9ba7f-A2024`; these are ingestion identifiers, not immutable snapshot releases.

| Supplier → Russia | 2019 current USD | 2024 current USD |
|---|---:|---:|
| China | 49,748,486,510 | 115,275,861,485 |
| Türkiye | 4,152,137,036 | 8,561,685,561 |
| Kazakhstan | 5,670,903,385.47 | 9,546,501,217.33 |
| Armenia | 718,464,052.87 | 3,136,776,864.11 |
| India | 2,871,228,560.869 | 4,841,029,765.424 |
| Kyrgyzstan | 281,252,923 | 976,059,109 |
| South Korea | 7,774,022,013 | 4,523,886,991 |

South Korea’s direct exports decrease in this comparison. Its growth into Kyrgyzstan is a different declared route and cannot establish Korean goods’ final destination. China and Türkiye’s direct-route expansion is also consistent with the patterns described in [EBRD’s research summary](https://www.ebrd.com/home/news-and-events/news/2023/ebrd-analyses-trade-flows-between-russia-caucasus-and-central-asia.html); that paper’s earlier period and methods are not interchangeable with this table.

A new bounded **read-only** BigQuery EU audit of `RUSSIA_BILATERAL_SQL`, parameter `country=CHN`, returned 2,087 annual aggregate rows. The dry-run upper bound was 1,501,197,271 bytes, with a 4,000,000,000-byte billing cap. No source download, ingestion, warehouse mutation or data publication was performed. Original-classification leaves are deduplicated before independently constructing TOTAL and HS2 sums. X is China’s declared exports to Russia, M is China’s declared imports from Russia. Customs/transport/second-partner total dimensions only; no Russian mirror reports are added. Available annual observations extend from 2014 through 2024; China’s 2025 observations are absent in this view.

| China-reported flow | 2019 current USD | 2021 current USD | 2024 current USD |
|---|---:|---:|---:|
| Exports to Russia | 49,748,486,510 | 67,196,722,796 | 115,275,861,485 |
| Imports from Russia | 61,190,631,855 | 79,593,503,788 | 129,881,357,745 |

Category ranking is calculated as endpoint minus baseline in current USD. The five largest positive chapter changes are held fixed across annual columns; grey is the remaining observed subtotal. Every other chapter, including declining or incomplete comparisons, stays in the companion table. Selecting imports changes the reporting flow, not the reporter; these are Chinese declarations in both directions. Missing years/categories remain gaps. Pre-invasion baselines are selectable; this is not evidence of deliberate wartime preparation. Imports are generally CIF and exports FOB; nominal value changes reflect quantities and prices, especially fuels.

| China-reported category and direction | HS2 | 2019 current USD | 2024 current USD | Calculated change, current USD |
|---|---:|---:|---:|---:|
| Vehicles → Russia | 87 | 2,157,423,406 | 25,483,658,123 | 23,326,234,717 |
| Machinery → Russia | 84 | 9,306,270,646 | 27,289,230,378 | 17,982,959,732 |
| Electrical equipment → Russia | 85 | 9,472,861,819 | 15,949,785,894 | 6,476,924,075 |
| Mineral fuels from Russia | 27 | 42,755,152,567 | 95,201,432,124 | 52,446,279,557 |
| Aluminium from Russia | 76 | 85,233,955 | 3,818,712,138 | 3,733,478,183 |
| Ores from Russia | 26 | 2,233,209,266 | 5,640,737,247 | 3,407,527,981 |

The exact source is the warehouse table and executable query above, audited 27 September 2026, with the same 2019/2024 ingestion loads. These are available HS6 subtotals, not official TOTAL observations, shipment tracking or evidence of end use. Broad chapters do not designate sanctioned or dual-use products.

North Korean military support has separate documented evidence: the [Multilateral Sanctions Monitoring Team’s 29 May 2025 report](https://msmt.info/view/save/2025/05/29/1085cade-a4b1-4405-94c0-7c980c24fd21-Unlawful_Military_Cooperation_including_Arms_Transfers_between_North_Korea_and_Russia_%28MSMT_2025_1%29.pdf), executive summary on PDF p.3. MSMT is a government monitoring team, not the UN Panel of Experts. Its report documents arms transfers to Russia; it is not used to fill missing Comtrade observations. No numerical arms-transfer estimate is inserted into these commercial charts.


## Delta story accounting — 27 September 2026

The new story layer fixes the baseline at 2019 and uses one selected annual endpoint for every panel. Its default is the latest year shared by the selected country's bilateral TOTAL directions, direct supplier declaration and both hub routes; the audited China view resolves to 2024. An explicit later year remains selected and exposes missing endpoints. Monthly explorer filters do not change these annual comparisons.

All calculations below use the same warehouse query, coverage, current-USD units and 2019/2024 ingestion IDs documented above. The existing bounded aggregate audit was reused; this UI task did not query, ingest or publish data. Decimal source strings are added/subtracted at nine-place precision, preserving the warehouse NUMERIC scale. Shares are calculated from positive delta / sum of positive deltas and displayed to at most nine decimal places. Plot coordinates and compact labels are not accounting inputs.

| China-reported direction, 2019 → 2024 | Sum of positive changes, USD | Sum of declines, USD | Matched-category net change, USD | Full observed-basket net change, USD |
|---|---:|---:|---:|---:|
| Exports to Russia | 69,173,997,371 | −3,646,622,396 | 65,527,374,975 | 65,527,374,975 |
| Imports from Russia | 70,552,877,155 | −1,850,041,653 | 68,702,835,502 | 68,690,725,890 |

Exports pair all 97 historically observed chapters. Imports pair 89 of 97 chapters: 14, 24, 46, 50 and 66 lack one endpoint; 06, 36 and 45 lack both endpoints but appear elsewhere in the historical view. The calculated bridge between full-basket and paired-category import net change is −12,109,612 USD. Missing observations are never interpreted as zero. This difference is disclosed beside the donut and does not enter its positive-change denominator.

Each donut shows the five largest positive category changes plus the exact sum of all remaining positive changes. The canonical CSV records original endpoint decimal strings, calculated delta, positive-change denominator, share, included HS chapter codes, reporter, flow, years and ingestion IDs. Full category tables retain declines, observed zeros and missing comparisons. The supplier story also retains every historically observed reporter; rankings show ten increases and ten declines on equal dollar scales, with matched-panel coverage disclosed. Kazakhstan and Kyrgyzstan World imports and exports to Russia are shown independently, never added together or treated as the same shipment.

The complete-comparison CSV also retains every supplier and category comparison, full observed-basket totals and both independent hub routes. Missing-both, missing-baseline and missing-endpoint states are explicit; source hashes and ingestion identifiers accompany the exact values. Hub routes have no combined net or denominator.

The same supplier-query coverage yields 115 paired suppliers out of 160 historically observed reporters for 2019 → 2024: calculated positive changes 82,341,920,258.023 current USD, declines −89,131,669,964.379 current USD and matched-panel net −6,789,749,706.356 current USD. This is not a complete global estimate. The complete comparison contains 360 audit rows (160 suppliers, 194 directional categories, two directional full baskets and four independent hub routes), including 53 comparisons with missing endpoints.
