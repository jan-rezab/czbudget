# HDR2025 chapters5–6 original-source audit

All labelled figures and tables in chapters5–6 and spotlights; selected prose source families. This is a source audit, not an ingestion receipt. Narrative research claims outside these families remain to be fully enumerated.

This audit does not certify ingestion. The prior UNDP load covers only the UNDP survey/HDR files; third-party source families remain separate. Exact report snapshots and newer observations must retain distinct vintages.

| Report object | PDF / printed page | Type | Source families |
|---|---:|---|---|
| Figure 5.1 | 152 / 138 | quantitative | bis_ai_supply_chain |
| Table 5.1 | 153 / 139 | conceptual_qualitative | Conceptual, no metric series |
| Figure 5.2 | 154 / 140 | conceptual_qualitative | Conceptual, no metric series |
| Figure 5.3 | 155 / 141 | conceptual_qualitative | Conceptual, no metric series |
| Figure 5.4 | 159 / 145 | quantitative | deepmind_habermas |
| Table 5.2 | 163 / 149 | quantitative | stanford_vibrancy, oxford_ai_readiness, imf_ai_preparedness, tortoise_global_ai |
| Figure 5.6 | 164 / 150 | quantitative | lucidity_ai_investment |
| Figure 5.5 | 164 / 150 | quantitative | epoch_models |
| Figure 5.7 | 165 / 151 | quantitative | oecd_linkedin_ai |
| Figure 5.8 | 165 / 151 | quantitative | oecd_linkedin_ai |
| Figure 5.9 | 166 / 152 | conceptual_qualitative | Conceptual, no metric series |
| Table 5.3 | 169 / 155 | conceptual_qualitative | Conceptual, no metric series |
| Figure 6.1 | 179 / 165 | quantitative | ilo_exposure |
| Figure 6.2 | 180 / 166 | quantitative | undp_ai_survey |
| Figure 6.3 | 180 / 166 | quantitative | undp_ai_survey |
| Figure 6.4 | 181 / 167 | quantitative | undp_ai_survey |
| Figure 6.5 | 182 / 168 | quantitative | undp_ai_survey |
| Figure 6.6 | 189 / 175 | quantitative | park_disruption |
| Figure 6.7 | 189 / 175 | quantitative | shin_go |
| Figure 6.8 | 193 / 179 | quantitative | lutz_slamys |
| Figure 6.9 | 194 / 180 | quantitative | oecd_pisa2022 |
| Figure 6.10 | 195 / 181 | quantitative | oecd_pisa2022 |
| Figure 6.11 | 199 / 185 | quantitative | harvard_eci, oxford_ai_readiness, gust_basic_skills |
| Figure S6.1.1 | 202 / 188 | quantitative | hadcrut5, rupp_transistors, top500_linpack |
| Spotlight 6.2 | 207 / 193 | quantitative_prose | itu_connectivity |

## bis_ai_supply_chain

Original source: Gambacorta and Shreeti 2025, BIS Paper 154. Report vintage: GPU revenue 2023; cloud revenue Q1 2024; capital invested 2023; visits date unspecified.

Coverage: Global producer/provider market shares. PitchBook data explicitly cited for investment. GPU/cloud/visits original provider must be recovered from BIS graph notes; not inferred.

Newer/live: BIS 2026 Global giants in AI supply chain exists; structured original market-share data/API not verified.

Access: PitchBook transaction-level records proprietary. BIS public paper does not grant access to underlying commercial database.

Cloud ingestion: Preserve exact paper graph facts as cited observations; original commercial data require rights/access. Do not relabel annual reports or other datasets as exact original source.

Status: **blocked_original_endpoints**.

- [https://www.bis.org/publications/paper-154-ai-supply-chain](https://www.bis.org/publications/paper-154-ai-supply-chain)
- [https://www.bis.org/publ/bppdf/bispap154.pdf](https://www.bis.org/publ/bppdf/bispap154.pdf)

## deepmind_habermas

Original source: Tessler et al. 2024, AI can help humans find common ground in democratic deliberation. Report vintage: 2024 study.

Coverage: UK experimental deliberation participants; unit is statement rating/comparison, not population estimate.

Newer/live: Static study; no real-time country metric. Repository includes prompted model which differs from study fine-tuned model.

Access: CC-BY 4.0 data/materials; Apache-2.0 software. README confirms downloads total ~450MB.

Cloud ingestion: Fetch all four Parquets on cloud worker; retain all columns and study flags; reproduce endorsement histogram only after validating cohort/model/human-mediator filters.

Status: **not_loaded**.

- [https://github.com/google-deepmind/habermas_machine](https://github.com/google-deepmind/habermas_machine)
- [https://storage.googleapis.com/habermas_machine/datasets/hm_all_candidate_comparisons.parquet](https://storage.googleapis.com/habermas_machine/datasets/hm_all_candidate_comparisons.parquet)
- [https://storage.googleapis.com/habermas_machine/datasets/hm_all_final_preference_rankings.parquet](https://storage.googleapis.com/habermas_machine/datasets/hm_all_final_preference_rankings.parquet)
- [https://storage.googleapis.com/habermas_machine/datasets/hm_all_position_statement_ratings.parquet](https://storage.googleapis.com/habermas_machine/datasets/hm_all_position_statement_ratings.parquet)
- [https://storage.googleapis.com/habermas_machine/datasets/hm_all_round_survey_responses.parquet](https://storage.googleapis.com/habermas_machine/datasets/hm_all_round_survey_responses.parquet)

## epoch_models

Original source: Epoch AI 2024d. Report vintage: Report chart 2020–2025.

Coverage: Model/developer country of HQ. Large scale: known/estimated training compute >1e23 FLOP. Multinational developer rule differs from simple HQ counts.

Newer/live: Source model database updated 2026-09-25; weekly automated discovery; major models normally added within two weeks. Chart export last updated 2025-11-24. CSV all_ai_models.csv explicitly documented. Large-scale CSV exact URL needs cloud-side discovery.

Access: CC-BY with attribution. Nonexhaustive curated database; uncertainty and speculative estimates remain explicit.

Cloud ingestion: Acquire documented all_ai_models CSV; preserve original fields and flags. Derive >1e23 sample separately, model date, country and multinational logic; retain report snapshot separate from latest.

Status: **not_loaded**.

- [https://epoch.ai/data-insights/large-scale-models-by-country](https://epoch.ai/data-insights/large-scale-models-by-country)
- [https://epoch.ai/data/ai-models](https://epoch.ai/data/ai-models)
- [https://epoch.ai/data/all_ai_models.csv](https://epoch.ai/data/all_ai_models.csv)

## lucidity_ai_investment

Original source: Lucidity Insights Research Team 2024. Report vintage: 2024; source article dated 27 November 2024.

Coverage: Four global categories; US 70.2, China 6.5, Middle East 0.7, rest of world 19.9 USD billion. Article does not disclose detailed original transaction database or cutoff.

Newer/live: No structured CSV/API or newer directly comparable vintage verified.

Access: Public infographic/article; rights and original transaction source unresolved.

Cloud ingestion: Acquire article as immutable raw citation; store four exact article facts with vintage/cutoff uncertainty. Cannot claim full transaction ingestion.

Status: **blocked_original_endpoints**.

- [https://lucidityinsights.com/infobytes/global-ai-investment-2024](https://lucidityinsights.com/infobytes/global-ai-investment-2024)

## oecd_linkedin_ai

Original source: OECD 2025a; OECD.AI visualisations using LinkedIn aggregate data. Report vintage: Net migration 2023; skills penetration report latest snapshot.

Coverage: Select eligible countries, LinkedIn self-added skills and profile location updates; migration denominator LinkedIn members ×10,000; penetration ratio against overlapping occupations global benchmark.

Newer/live: OECD live dashboard, updated annual aggregates with 2024 migration verified in OECD 2026 publication; monthly hiring/job metrics additionally available. Current methodology has AI engineering/literacy distinction from 2023. Not real-time national workforce census.

Access: Aggregates downloadable via chart CSV. Member microdata not public. Dashboard CSV endpoint must be resolved, not guessed.

Cloud ingestion: Cloud worker discover documented CSV export for migration and penetration; retain source vintage, method, occupational country coverage and exact denominator.

Status: **awaiting_export_endpoint**.

- [https://oecd.ai/en/data?selectedArea=ai-jobs-and-skills](https://oecd.ai/en/data?selectedArea=ai-jobs-and-skills)
- [https://oecd.ai/en/linkedin](https://oecd.ai/en/linkedin)
- [https://oecd-aiobservatory.ijs.si/visualizations/Jobs/AiJobSkillsMigration?date.resume=false&date.slider=2022&subset=OECD](https://oecd-aiobservatory.ijs.si/visualizations/Jobs/AiJobSkillsMigration?date.resume=false&date.slider=2022&subset=OECD)

## stanford_vibrancy

Original source: Stanford HAI 2025, Global AI Vibrancy Tool. Report vintage: Report table refers 36 evaluated countries.

Coverage: 36-country rankings; current tool offers individual metrics for wider 66-country set.

Newer/live: Current rankings 2017–2024 and 39 metric time-series; annual. Earlier 2024 tool described 42 metrics; pin version/schema.

Access: Public source and dashboard download; bulk endpoint and data-specific terms not verified.

Cloud ingestion: Discover dashboard download; preserve ranking weights/scaled metrics separately from original observations.

Status: **awaiting_export_endpoint**.

- [https://hai.stanford.edu/ai-index/global-vibrancy-tool](https://hai.stanford.edu/ai-index/global-vibrancy-tool)
- [https://hai.stanford.edu/assets/files/global_ai_vibrancy_tool_paper_november2024.pdf](https://hai.stanford.edu/assets/files/global_ai_vibrancy_tool_paper_november2024.pdf)

## oxford_ai_readiness

Original source: Oxford Insights 2023/2024. Report vintage: Table 5.2 source 2023 despite discussion 2024; Fig6.11 source 2024.

Coverage: Government readiness index, country and pillar scores.

Newer/live: 2025 vintage covers 195 governments and changes methodology; annual, not live. Current page provides 2023/2024/2025 Index Data but links are hidden behind form.

Access: Form requests identity/organisation/country and marketing consent. No submission or consent made. Public rankings visible; reuse terms/structured exports unresolved.

Cloud ingestion: Acquire public authorised data exports once accessible; archive each vintage separately; do not silently concatenate changed methodology.

Status: **access_unresolved**.

- [https://oxfordinsights.com/ai-readiness/government-ai-readiness-index-2025/](https://oxfordinsights.com/ai-readiness/government-ai-readiness-index-2025/)

## imf_ai_preparedness

Original source: AIPI 2025 / IMF AI Preparedness Index. Report vintage: Index assesses 2023 readiness.

Coverage: 174 economies, score 0–1 and four dimensions; perceptions partly included.

Newer/live: No newer equivalent observation vintage verified; IMF 2026 discusses complementary Skill Imbalance/Readiness indices which are separate.

Access: Public dashboard exports; note says data available upon request. Original component redistribution may be restricted by eight provider terms.

Cloud ingestion: Resolve current DataMapper Excel/API series; preserve dataset period 2023 separately from 2025 citation year.

Status: **awaiting_export_endpoint**.

- [https://www.imf.org/external/datamapper/datasets/AIPI](https://www.imf.org/external/datamapper/datasets/AIPI)
- [https://www.imf.org/external/datamapper/AIPINote.pdf](https://www.imf.org/external/datamapper/AIPINote.pdf)

## tortoise_global_ai

Original source: Tortoise Media 2025 Global AI Index. Report vintage: Report describes 83 countries.

Coverage: National AI composite rank/score.

Newer/live: Newer 2025 edition exists according to secondary discovery; exact primary current export not verified.

Access: No public bulk endpoint or licence confirmed.

Cloud ingestion: Do not substitute Stanford or Oxford scores for Tortoise. Resolve primary export and methodology first.

Status: **access_unresolved**.

- [https://www.tortoisemedia.com/intelligence/global-ai/](https://www.tortoisemedia.com/intelligence/global-ai/)

## ilo_exposure

Original source: ILO Harmonized Microdata Repository; Gmyrek, Berg and Bescond 2023. Report vintage: 2022 HDI groups; underlying employment period not specified on chart.

Coverage: Share of employment by augmentation/automation/big unknown, grouped by 2022 HDI. HDR custom calculation requires exact country sample and weights.

Newer/live: ILO 2025 refined occupational exposure index released 20 May 2025 (4 gradients) is newer but method differs; not interchangeable with 2023 categories. ILOSTAT current employment downloadable/API series.

Access: Country labour microdata access varies; harmonized repository not necessarily public for all records. Occupational task scores and public aggregate exports can be acquired; exact HDR microdata panel not yet verified.

Cloud ingestion: Acquire 2023 score mapping and public occupation employment; publish derived estimates labelled separately. Exact HDR chart needs sample/weights before claiming reproduction.

Status: **exact_hdr_calculation_unresolved**.

- [https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure](https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure)
- [https://ilostat.ilo.org/data/](https://ilostat.ilo.org/data/)

## undp_ai_survey

Original source: UNDP Survey on AI and Human Development. Report vintage: HDR2025 survey.

Coverage: 21 countries; work/education/sex/occupation answers, labels, weights; already published warehouse respondent layer.

Newer/live: Static survey; no newer same-wave/live source verified.

Access: Official UNDP public files, retained codebook and missing codes.

Cloud ingestion: No duplicate acquisition necessary; derive report chart values with exact pooling, weights, occupation and neutral-response treatment; keep derived output separate.

Status: **already_loaded_raw_survey**.

- [https://hdr.undp.org/explore-and-download-survey-data](https://hdr.undp.org/explore-and-download-survey-data)

## park_disruption

Original source: Park, Leahey and Funk 2023. Report vintage: Papers 1945–2010; patents 1976–2010; CD5 requires five-year forward citation window.

Coverage: Field/year mean CD5, study based on 45M papers and 3.9M patents across six source databases.

Newer/live: Static replication package; not live. Modern OpenAlex would be a separately defined method/source, not exact replacement.

Access: Zenodo 1.5GB package md5 41c0a5a9f32913a45041c26834f5fea7. MAG/PatentsView/PubMed analyses complete; WoS/APS/JSTOR only limited public versions, full require publisher permission.

Cloud ingestion: Cloud fetch exact Zenodo package, hash/check archive safely, retain source components/license restrictions. Prefer public source-data aggregate tables; do not claim all licensed microdata loaded.

Status: **not_loaded**.

- [https://www.nature.com/articles/s41586-022-05543-x](https://www.nature.com/articles/s41586-022-05543-x)
- [https://zenodo.org/records/7258379](https://zenodo.org/records/7258379)
- [https://zenodo.org/records/7258379/files/nature_disruption_open_access.tar.gz?download=1](https://zenodo.org/records/7258379/files/nature_disruption_open_access.tar.gz?download=1)

## shin_go

Original source: Shin, Kim, van Opheusden and Griffiths 2023. Report vintage: Professional Go games 1950–2021.

Coverage: Median human Go decision quality; first 60 moves; confidence intervals and post-2016 novelty analysis.

Newer/live: Static study; no live refresh.

Access: Article explicitly supplies replication AI simulation data and code via OSF. Exact file list/licence unresolved because OSF API unavailable through browsing tool. GoGoD original games have independent terms.

Cloud ingestion: Cloud list OSF file metadata, pin file versions/checksums, acquire replication data/code. Do not bulk download paid GoGoD or assume study licence extends to full original game archive.

Status: **awaiting_export_endpoint**.

- [https://pmc.ncbi.nlm.nih.gov/articles/PMC10041097/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10041097/)
- [https://osf.io/xpf3q/](https://osf.io/xpf3q/)
- [https://api.osf.io/v2/nodes/xpf3q/files/osfstorage/](https://api.osf.io/v2/nodes/xpf3q/files/osfstorage/)

## lutz_slamys

Original source: Lutz et al. 2021, Skills-adjusted human capital shows rising global gap. Report vintage: 1970–2015; report change 2000–2015.

Coverage: 185 countries representing 99.2% of world 2015 population, working-age literacy-adjusted years of schooling.

Newer/live: Static study; no newer same-method dataset verified.

Access: All study data stated to be article/supporting information; supplemental PDF encountered bot challenge. Exact tables must be inspected.

Cloud ingestion: Cloud archive original article/SI; extract SI tabular observations with source page; compute 2000–2015 changes and report HDI grouping separately.

Status: **awaiting_supplement_verification**.

- [https://pmc.ncbi.nlm.nih.gov/articles/PMC7896344/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7896344/)
- [https://pmc.ncbi.nlm.nih.gov/articles/instance/7896344/bin/pnas.2015826118.sapp.pdf](https://pmc.ncbi.nlm.nih.gov/articles/instance/7896344/bin/pnas.2015826118.sapp.pdf)

## oecd_pisa2022

Original source: OECD PISA 2022 student public-use records. Report vintage: 2022.

Coverage: Fig6.9 52 countries; 15-year-old enrolled students, plausible values/weights, trust question; Fig6.10 equal country weights, proficiency level ≥4 in any subject proxy, not validated direct critical-thinking score.

Newer/live: PISA periodic surveys, not live. Index currently displays 2025 placeholders/links; actual usable 2025 data must be HTTP/content/schema/date verified before claiming release.

Access: Public-use data; OECD terms, anonymised respondent identifiers. Low response-rate adjudication warnings retained for 2022.

Cloud ingestion: Cloud download official ZIP; retain codebooks, questionnaire, replicate weights, plausible values, missing codes and country coverage; exact HDR filtering/proxy derivation and equal-country weights are separate outputs.

Status: **not_loaded**.

- [https://www.oecd.org/en/data/datasets/pisa-2022-database.html](https://www.oecd.org/en/data/datasets/pisa-2022-database.html)
- [https://webfs.oecd.org/pisa2022/index.html](https://webfs.oecd.org/pisa2022/index.html)
- [https://webfs.oecd.org/pisa2022/STU_QQQ_SPSS.zip](https://webfs.oecd.org/pisa2022/STU_QQQ_SPSS.zip)

## harvard_eci

Original source: Harvard Growth Lab 2025 Atlas of Economic Complexity. Report vintage: Figure6.11 source year 2025, underlying trade year unspecified.

Coverage: Export basket diversity/complexity country ECI; Fig6.11 joins 2023 HDI with Oxford readiness and basic skills.

Newer/live: Annual ECI and trade updates; downloadable bulk and documented GraphQL API. Bulk revisions can lag dashboard slightly. Not real-time ECI.

Access: Data access procedures/API limits documented at linked GitHub; exact ECI export/vintage must be resolved.

Cloud ingestion: Query country/year ECI from original Growth Lab, not calculate a Comtrade proxy. Preserve classification, release and country coverage.

Status: **awaiting_export_endpoint**.

- [https://atlas.hks.harvard.edu/data-downloads/](https://atlas.hks.harvard.edu/data-downloads/)
- [https://github.com/harvard-growth-lab/api-docs/blob/main/atlas.md](https://github.com/harvard-growth-lab/api-docs/blob/main/atlas.md)

## gust_basic_skills

Original source: Gust, Hanushek and Woessmann 2024a. Report vintage: Global universal basic skills, JDE166 103205.

Coverage: Share of children with basic math/science skills, including correction for children outside school; not merely enrolled PISA participants.

Newer/live: Static research estimates; no live equivalent verified.

Access: Public author paper; exact replication country data/files and licence not yet verified.

Cloud ingestion: Recover original country observations/replication file; retain observed vs modelled/out-of-school correction. Do not substitute PISA-only country results.

Status: **awaiting_replication_data**.

- [https://hanushek.stanford.edu/sites/default/files/Gust%2BHanushek%2BWoessmann%202024%20JDE%20166.pdf](https://hanushek.stanford.edu/sites/default/files/Gust%2BHanushek%2BWoessmann%202024%20JDE%20166.pdf)

## hadcrut5

Original source: Morice et al. 2021, Met Office/CRU HadCRUT5. Report vintage: Report temp relative to 1850–1900 baseline.

Coverage: Global monthly/annual temperature anomalies and uncertainty since 1850, default reference 1961–1990.

Newer/live: Version5.2.0.0 released 2026-09-18; download page updated2026-09-21. Monthly series available; no real-time daily same-source series. Annual file URLs resolve from official download links, fetch not verified here.

Access: Crown copyright; original data-use conditions must be retained.

Cloud ingestion: Cloud snapshot versioned monthly/annual CSV; preserve native baseline and uncertainty; calculate 1850–1900 rebasing explicitly, retain original values.

Status: **not_loaded**.

- [https://www.metoffice.gov.uk/hadobs/hadcrut5/](https://www.metoffice.gov.uk/hadobs/hadcrut5/)
- [https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/download.html](https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/download.html)
- [https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.annual.csv](https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.annual.csv)
- [https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.monthly.csv](https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.monthly.csv)

## rupp_transistors

Original source: Karl Rupp 2022, processed by Our World in Data per HDR reference. Report vintage: 2022.

Coverage: Transistor count for historical microprocessors. Report specifically cites OWID-processed Rupp2022; original vs OWID transformations must be mapped.

Newer/live: Repository offers 50yrs data, original endpoint and exact report processed vintage unresolved; sporadic updates, not live.

Access: CC-BY4.0 as verified LICENSE.txt.

Cloud ingestion: Cloud pin Git commit and raw .dat; preserve counts and provenance; retain OWID2022 original snapshot separately if available.

Status: **not_loaded**.

- [https://github.com/karlrupp/microprocessor-trend-data](https://github.com/karlrupp/microprocessor-trend-data)
- [https://github.com/karlrupp/microprocessor-trend-data/blob/master/50yrs/transistors.dat](https://github.com/karlrupp/microprocessor-trend-data/blob/master/50yrs/transistors.dat)
- [https://raw.githubusercontent.com/karlrupp/microprocessor-trend-data/master/50yrs/transistors.dat](https://raw.githubusercontent.com/karlrupp/microprocessor-trend-data/master/50yrs/transistors.dat)

## top500_linpack

Original source: Dongarra, Luszczek and Petitet 2003 Linpack; TOP500 historical benchmark capacity. Report vintage: Report supercomputer performance through latest report chart.

Coverage: Floating-point operations/sec; exact report selection (fastest vs aggregate) must be confirmed from chart/source before use.

Newer/live: TOP500 semiannual June/November rankings through2026; current lists downloadable but XLS endpoint not verified.

Access: Public rankings; reuse/data terms not verified.

Cloud ingestion: Acquire historical lists/export and exact LINPACK Rmax unit; do not confuse Rpeak with Rmax or aggregate capacity with fastest machine.

Status: **awaiting_export_endpoint**.

- [https://www.top500.org/lists/top500/](https://www.top500.org/lists/top500/)

## itu_connectivity

Original source: ITU2024d Measuring digital development Facts and Figures2024. Report vintage: Spotlight note1 all figures estimates2024 unless indicated.

Coverage: World/region/income/sex/urban-rural internet use, network coverage, subscriptions, affordability, traffic. 1990 mobile subscription count separate historical vintage.

Newer/live: Annual2025 estimates official workbook Nov2025; countries via DataHub, not real-time.

Access: Official public Excel download verified as link; actual workbook content not downloaded. No stable public DataHub API verified.

Cloud ingestion: Cloud fetch exact2024 and2025 source workbooks and historical1990 series; preserve geography aggregates and category denominators; country estimates separate from aggregates.

Status: **not_loaded**.

- [https://datahub.itu.int/](https://datahub.itu.int/)
- [https://www.itu.int/en/ITU-D/Statistics/Pages/facts/default.aspx](https://www.itu.int/en/ITU-D/Statistics/Pages/facts/default.aspx)
- [https://www.itu.int/en/ITU-D/Statistics/Documents/facts/ITU_regional_global_Key_ICT_indicator_aggregates_Nov_2025.xlsx](https://www.itu.int/en/ITU-D/Statistics/Documents/facts/ITU_regional_global_Key_ICT_indicator_aggregates_Nov_2025.xlsx)

## Remaining exact-source gaps

- Exact original vendor endpoints for BIS concentration graphs
- Exact report figure5.5 snapshot not replaceable by updated model counts
- HDR custom computation country samples/weights for exposure, PISA and basic skills joins
- Study narrative claims in boxes/chapter text beyond labelled figures require claim-by-claim original-study audit
- Spotlight5.1 subjective agency research citations are qualitative theories; no quantitative figure dataset
- Spotlight6.3 social-dialogue case studies are qualitative case records; numerical dates/counts need original ILO case-study appendix, not country metrics

## Material source-integrity correction

Chapter6 PDF190/printed176 cites Toner-Rodgers2024 (note116) for +44% materials, +39% patents and +17% innovation. The original paper was withdrawn by arXiv administrators20May2025. MIT16May2025 reported concerns about provenance, reliability and validity; these claims must be kept only as historical withdrawn citations and excluded from verified-current metrics. [MIT original statement](https://economics.mit.edu/news/assuring-accurate-research-record), [arXiv withdrawal](https://arxiv.org/abs/2412.17866).

The same page cites Merchant2023 GNoME for2.2million predictions. Its downloadable stable-material subset has a different denominator and CC-BY-NC4.0 data licence. Preserve restrictions and do not treat the stable subset as all predicted crystals. [Original repository](https://github.com/google-deepmind/materials_discovery).

Author-original ILO2023 taxonomy JSON (CC0) and refined2025 occupation/task XLSX links are now in the fetch manifest. These are exposure scores, not the HDR country employment-weighted custom calculation.

Additional verified Park original source: [Nature Source Data Fig.2 XLSX](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41586-022-05543-x/MediaObjects/41586_2022_5543_MOESM4_ESM.xlsx). The public replication archive is 1.5GB (advertised MD541c0a5a9f32913a45041c26834f5fea7); no blanket reuse license was confirmed, and WoS/APS/JSTOR components contain only limited public extracts. Preserve privately pending component terms. PISA ZIP contains SPSS .SAV; extraction must retain user-defined missing codes and their metadata.
