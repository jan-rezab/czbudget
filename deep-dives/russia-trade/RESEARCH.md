# Russia trade: research notes for the aggregate view

Audit: 26 September 2026 UTC. Code review only; deployment is on hold at the user’s request.

## Question and identification

Did growth in goods supplied to Kazakhstan and Kyrgyzstan coincide with growth in their exports to Russia? Which suppliers and product groups account for the pattern? The hypothesis is not that the entire fall in direct exports mechanically moved to these two markets.

This is a descriptive investigation, not a causal estimate or a sanctions-violation finding. Broad HS2 matches cannot identify the same HS6 products, let alone the same shipments. Domestic demand, local production, inventories, price and exchange-rate changes, classification changes and reporting differences are competing explanations. A causal research extension needs a dated HS6 sanctions concordance, stable product/reporter panels, an explicit control group and event-study/pre-trend checks.

## Published warehouse basis

- Table: `czbudget-janrezab.budget_detail.trade_observations`; areas: `budget_detail.trade_areas`. No loading or warehouse mutation was performed.
- All figures below are **calculated sums of available original HS6 records**, nominal/current USD. They are not official all-merchandise TOTAL observations. See executable `RUSSIA_AGGREGATE_SQL` and `RUSSIA_SUPPLIERS_SQL` in `server/russia-trade-store.mjs`.
- One newest observation per period, reporter, flow, partner and HS6 code before aggregation. Original HS classifications only; total customs/transport/second-partner dimensions only. Regional area groups are excluded. World rows and bilateral rows are separate; neither are added to their mirror reports.
- Annual and monthly data are queried separately. The warehouse has annual observations for both hubs for 2019–2025. Monthly starts in January 2024; missing months remain null. The default selects the latest period with all four hub observations, not necessarily complete source reporting.
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

Added 27 September 2026 UTC. Each hub has a separate stacked dollar chart for 2019–2025, using the same annual warehouse observations described above. The flow control selects World-partner imports or Russia-partner exports; these are separate declarations.

For the selected end year, rank HS2 chapters by positive `end-year USD − 2019 USD`, retain the largest five, and hold that category cohort fixed across the timeline. Rank by absolute growth so a tiny starting value cannot dominate solely through a large percentage increase. The companion table shows the dollar change and `(end-year / 2019 − 1) × 100`; a zero baseline has no percentage. Grey is the observed annual subtotal minus the highlighted categories, including all remaining or declining chapters. This is a composition chart, not a stack of the changes themselves.

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
