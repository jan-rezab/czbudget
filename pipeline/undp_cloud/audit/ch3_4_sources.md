# HDR 2025 chapters 3–4 original source audit

Audited 27 September 2026. This is a source inventory, not an ingestion receipt. All figures are mapped; narrative quantitative claims remain a separate verification queue. No bulk dataset was stored locally.

## Priority cloud acquisitions

- WIPO original conventional/emerging XLSX patent landscapes.
- Sapien original public 2024 and current 2025 aggregate tables; live respondent CSV is restricted.
- CDC BRFSS historical and latest 2025 XPT, codebook and complex survey design.
- Original author Zenodo cortical thickness CSV and quality controls.
- Childlight original 2024 structured index data, keeping 2025 country release separate.
- ITU 2025 global/regional XLSX and exact country-age series; WDI upstream internet series.

## Figure inventory

| Item | PDF / printed page | Source | Type |
|---|---|---|---|
| 3.1 AI use by occupation | 82 / 68 | undp_ai | numeric |
| 3.2 Invest inform include | 83 / 69 | Authors conceptual framework | conceptual |
| 3.3 MRI white matter and screen time | 84 / 70 | hutton | scientific_image |
| Box3.1/F1 Online child sexual abuse regional prevalence | 85 / 71 | childlight | numeric |
| Box3.2/F1 AI tailors lessons without internet | 87 / 73 | Authors conceptual framework | conceptual |
| 3.4 US mathematics assessment historical scores | 88 / 74 | nces | numeric |
| 3.5 Covid accelerated cortical thinning | 90 / 76 | corrigan | scientific_image |
| Box3.3/F1 Young internet use by income group | 92 / 78 | itu | numeric |
| Box3.3/F2 Internet use regional1990onward | 92 / 78 | wdi_internet | numeric |
| 3.6 Internet access by poverty and education | 93 / 79 | mpi_microdata | numeric |
| 3.7 Authenticity autonomy agency | 94 / 80 | Authors conceptual framework | conceptual |
| 3.8 Chatbot frustration | 96 / 82 | ujet | numeric |
| 3.9 Internet users by age/country | 98 / 84 | itu | numeric |
| 3.10 Internet users75+bycountryHDI | 99 / 85 | itu | numeric |
| 3.11 MHQ distress byageandregion | 100 / 86 | sapien | numeric |
| 3.12 Healthcare bias framework | 101 / 87 | Authors conceptual framework | conceptual |
| 3.13 AI human development framework | 101 / 87 | Authors conceptual framework | conceptual |
| S3.1.1 US life satisfaction/despair byage | 103 / 89 | brfss | numeric |
| S3.1.2 US despair time series1993–2023 | 104 / 90 | brfss | numeric |
| S3.1.3 MHQ score byageandregion | 105 / 91 | sapien | numeric |
| S3.1.4 First smartphone age/MHQ | 106 / 92 | sapien | numeric |
| S3.2.1 PreferworldwithoutInstagram/TikTok | 108 / 94 | social_trap | numeric |
| S3.2.2 Socialmediawelfaremeasures | 109 / 95 | social_trap | numeric |
| TableS3.2.1 CAREframework | 113 / 99 | Authors conceptual framework | conceptual |
| 4.1 Disability internet gaps | 120 / 106 | disability | numeric |
| 4.2 Conventionalassistivepatents | 121 / 107 | wipo | numeric |
| 4.3 Emergingassistivepatents | 122 / 108 | wipo | numeric |
| 4.4 ExpectedAIagencybyage/HDI | 125 / 111 | undp_ai | numeric |
| 4.5 FemaleSTEMgraduatecrosssection | 128 / 114 | uis_stem | numeric |
| 4.6 FemaleSTEMgraduate2010/2020 | 129 / 115 | uis_stem | numeric |
| Box4.1/F1 ICTskillsbysexandhouseholdchildren | 130 / 116 | mics_care | numeric |
| Box4.2 Onlinegender-basedviolencestudypercentages | 132 / 118 | gender_violence | numeric_box |
| O.5 YounginternetusersMHQ | 22 / 8 | sapien | numeric |

## undp_ai: UNDP AI and Human Development Survey

Report vintage: HDR2025 survey. Newest verified: HDR2025 survey. Cadence: One-off survey; no live replacement verified.

21 countries; country weights and occupation/age/sex groups

Already loaded respondent data; reproduce report weighting and category definitions.

Access/interpretation: Verify publisher terms before serving raw data; preserve attribution.

- [Original source 1](https://hdr.undp.org/explore-and-download-survey-data)

## hutton: Hutton et al. JAMA Pediatrics

Report vintage: 2020 article. Newest verified: 2020 article. Cadence: One-off study.

Preschool MRI study, not a national health series

Original article/supplement; no public raw MRI endpoint verified. Request author data if needed.

Access/interpretation: Verify publisher terms before serving raw data; preserve attribution.

- [Original source 1](https://doi.org/10.1001/jamapediatrics.2019.3869)

## childlight: Childlight Into the Light Index

Report vintage: 2024 regional index. Newest verified: 2025 index verified; 2026 release not yet verified. Cadence: Annual releases; pooled studies with varying observation periods.

Under18 past-year/lifetime victimisation; regional pooled estimates and confidence intervals

Fetch original JS; strip var mapData assignment then JSON parse properties. py_dpos/py_dpib past-year solicitation/image prevalence; CIs and source counts. Current2025 country release separate.

Access/interpretation: Published aggregate index; no abuse imagery required or requested. Source terms must be preserved.

- [Original source 1](https://www.childlight.org/into-the-light-2024/indicator-1.html)
- [Original source 2](https://www.childlight.org/into-the-light-2024/js/masterMapData.js)
- [Original source 3](https://www.childlight.org/uploads/publications/technical-note-1.pdf)
- [Original source 4](https://research.childlight.org/ITL2025/executive-summary.php)

## nces: US NCES / NAEP Long-term Trend

Report vintage: 1973–2012 mathematics scores published2013. Newest verified: Official landing announces2025 ages9/13 results; exact data export not verified. Cadence: Periodic assessments.

US ages9,13,17; assessment format break and significance retained

Fetch original source report numeric tables; current public NAEP result export. Raw student files require restricted-use license.

Access/interpretation: Public aggregate results; restricted respondent data requires NCES application.

- [Original source 1](https://nces.ed.gov/nationsreportcard/subject/publications/main2012/pdf/2013456.pdf)
- [Original source 2](https://nces.ed.gov/nationsreportcard/ltt/)
- [Original source 3](https://nces.ed.gov/use-work/dataset/naep-1971-2023-national-mathematics-and-reading-long-term-trend-restricted-use-data-files)

## corrigan: Corrigan/Rokem/Kuhl author deposit

Report vintage: 2024 article/deposit. Newest verified: 2024 article/deposit. Cadence: Fixed study.

US adolescent cortical-thickness/demographic longitudinal cohort

Cloud fetch CSV128411 bytes; published MD5 83ddd7acb8a2913a9f9299c1f65ded2f; preserve region/sex/visit. Companion euler QC CSVs and code deposited.

Access/interpretation: CC-BY4.0 verified Zenodo metadata; do not infer MRI brain images from CSV.

- [Original source 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC11420155/)
- [Original source 2](https://zenodo.org/api/records/13227189)
- [Original source 3](https://zenodo.org/api/records/13227189/files/Adol_CortThick_data.csv/content)
- [Original source 4](https://github.com/nevacorr/Adolescent_Normative_Modeling_CT_2024)

## mpi_microdata: Original national DHS and UNICEF MICS surveys behind UNDP MPI

Report vintage: MPI2024; survey vintages vary. Newest verified: MPI2024; survey vintages vary. Cadence: Country survey rounds; not real-time.

94 countries; nearly8.1million individuals ages19–64 in figure3.6

MPI aggregate workbook already loaded does NOT reproduce education×internet×poverty cross-tab; obtain survey-specific approved microdata, code and survey selection list.

Access/interpretation: DHS project registration/approval; MICS national ownership and access terms; exact pooled estimator/code missing.

- [Original source 1](https://hdr.undp.org/content/2024-global-multidimensional-poverty-index-mpi)
- [Original source 2](https://dhsprogram.com/data/)
- [Original source 3](https://mics.unicef.org/surveys)

## itu: International Telecommunication Union

Report vintage: 2024 source downloaded March2025. Newest verified: 2025 estimates and country2024 observations verified. Cadence: Annual and rolling country updates; not a real-time internet census.

Internet use within last3months by age; national survey populations; regional/income aggregates

Cloud fetch official2025 XLSX; obtain country-age series through DataHub download. API endpoint not verified.

Access/interpretation: ITU publisher terms; country age bands differ/missing. Figure3.9 label25–75 is inconsistent with ITU25–74; retain source age code.

- [Original source 1](https://datahub.itu.int/data/?i=11624&v=chart&d=Age&g=9224)
- [Original source 2](https://www.itu.int/en/ITU-D/Statistics/pages/stat/default.aspx)
- [Original source 3](https://www.itu.int/en/ITU-D/Statistics/Documents/facts/ITU_regional_global_Key_ICT_indicator_aggregates_Nov_2025.xlsx)

## wdi_internet: World Bank WDI, upstream ITU

Report vintage: WDI2024 extract. Newest verified: Fetch current API; latest per country varies. Cadence: Rolling API revisions; annual years.

Country/region internet users percent population

Cloud fetch API with pagination; retain World Bank aggregates separately from countries.

Access/interpretation: WDI open data terms/attribution; annual series not equivalent to real-time activity.

- [Original source 1](https://api.worldbank.org/v2/country/all/indicator/IT.NET.USER.ZS?format=json&per_page=20000)

## ujet: UJET original consumer study

Report vintage: 2022 consumer study. Newest verified: 2026 agent survey PDF available, different measure. Cadence: Ad hoc studies.

Nearly1700 consumers; primary release has80% frustrated,78%forced human,63%no resolution,72%waste time

Ingest published original HTML aggregates with exact question denominators; raw response file not published. HDR20%/22%are complements, derived not observed.

Access/interpretation: Publisher copyright; newer2026 agent sample has different denominator and cannot replace consumer series.

- [Original source 1](https://ujet.cx/press-releases/ujet-research-reveals-chatbots-increase-frustration)
- [Original source 2](https://ujet.cx/blog/report-why-service-automation-is-falling-short)
- [Original source 3](https://assets.ujet.cx/resource-center-pdfs/UJET-Agent_Survey_Report.pdf)

## sapien: Sapien Labs Global Mind Project

Report vintage: 2020–2024 data; unpublished2025 HDR background paper. Newest verified: 2025 annual report publishedFeb2026; liveBrainbase verified. Cadence: Brainbase continuously updated1000–2000responses/day; annual public tables.

Internet-enabled voluntary online respondents; country/region/age/sex MHQ, NOT whole-population representative estimates

Cloud fetch public annual aggregate tables; exact HDR pooled smartphone cross-tab may require background paper/Brainbase microdata. Restricted live CSV access requires successful application.

Access/interpretation: Non-commercial eligibility/application; authorized users only; respondent data redistribution prohibited. Do not publish raw respondent layer with website access.

- [Original source 1](https://sapienlabs.org/global-mind-project/researcher-hub/)
- [Original source 2](https://sapienlabs.org/global-mind-project-data-access-and-usage-policy/)
- [Original source 3](https://sapienlabs.org/whats_new/)
- [Original source 4](https://sapienlabs.org/wp-content/uploads/2025/02/MSW-2024-Data-Tables.xlsx)
- [Original source 5](https://sapienlabs.org/wp-content/uploads/2026/04/GMP2025-Data-Tables.zip)
- [Original source 6](https://sapienlabs.org/wp-content/uploads/2025/01/Youth-Report-Data-Tables.xlsx)

## brfss: US CDC BRFSS

Report vintage: 1993–2024 underlying figure ranges. Newest verified: 2025 releasedAugust2026;356158records/284variables. Cadence: Annual releases; interviews monthly but no monthly public real-time feed verified.

US adult landline/cellphone complex survey; age,sex,MENTHLTH,LIFESAT where fielded; 2011 redesign

Cloud fetch report-era year files and latest2025XPT; preserve weights/strata/PSU, nonresponse and variable availability; reproduce researcher estimator separately.

Access/interpretation: Public-use CDC data;2025excludesCA/MS/NV/USVI;2024excludesTN; 2011design break.2025variable counts differ.

- [Original source 1](https://www.cdc.gov/brfss/annual_data/annual_data.htm)
- [Original source 2](https://www.cdc.gov/brfss/annual_data/annual_2025.html)
- [Original source 3](https://www.cdc.gov/brfss/annual_data/2025/files/LLCP2025XPT.zip)
- [Original source 4](https://www.cdc.gov/brfss/annual_data/2025/zip/codebook25_llcp-v2-508.zip)

## social_trap: Bursztyn/Handel/Jimenez-Duran/Roth original experiment

Report vintage: 2023working paper revisedJuly2024. Newest verified: 2025AER public replication packageV1 released2025-10-28. Cadence: Fixed experiments; publication versions.

US college student Instagram/TikTok incentivized experiments; welfare dollars/fraction negative

Cloud acquire author replication package via openICPSR; authenticate/agree repository terms if required; working-paper and2025AER package separate.

Access/interpretation: Repository terms/license not yet inspected; no proxy platform usage data.

- [Original source 1](https://www.nber.org/papers/w31771.pdf)
- [Original source 2](https://bfi.uchicago.edu/wp-content/uploads/2023/10/BFI_WP_2023-131.pdf)
- [Original source 3](https://www.openicpsr.org/openicpsr/project/220221/version/V1/view)
- [Original source 4](https://doi.org/10.3886/E220221V1)

## disability: UN DESA Disability and Development Report

Report vintage: 2024report;2021or latest surveys. Newest verified: 2024report;2021or latest surveys. Cadence: Irregular flagship reports; survey releases.

46countries/areas, disabled/non-disabled; WashingtonGroup or ModelDisabilitySurvey definitions

Original report numeric tables then underlying national microdata/WHO/ECLAC/DHS/SINTEF. No exact universal original API verified.

Access/interpretation: Different disability instruments; no ordinary internet-rate proxy for missing disability split.

- [Original source 1](https://desapublications.un.org/publications/un-flagship-report-disability-and-development-2024)
- [Original source 2](https://social.desa.un.org/issues/disability/un-disability-and-development-report-ddr)

## wipo: WIPO Assistive Technology patent landscape

Report vintage: 2021landscape;HDRfigureslabel2000–2010. Newest verified: No refreshed same-definition assistive landscape found. Cadence: Fixed patent search landscape; livePATENTSCOPEdifferent query.

Patent country/office counts; conventional vs emerging seven domains

Cloud fetch both ORIGINAL XLSX datasets; inspect year range before normalizing: HDRfigure2000–2010 may be transcription discrepancy versus landscape2000–2018. Recompute exact report range only if evidence.

Access/interpretation: Office WIPO/EPO regional offices are not countries; preserve patent-family/applications distinction; workbook license needs verification.

- [Original source 1](https://www.wipo.int/publications/en/details.jsp?id=4541)
- [Original source 2](https://www.wipo.int/edocs/pubdocs/en/wipo_pub_1055_2021-tech1.xlsx)
- [Original source 3](https://www.wipo.int/edocs/pubdocs/en/wipo_pub_1055_2021-tech2.xlsx)

## uis_stem: UNESCO GEM Technology on Her Terms, upstream UIS

Report vintage: 2024GEM;2010/2020STEMfemale graduate shares. Newest verified: UISFeb2026releaseverified. Cadence: UISperiodic annual releases.

Tertiary STEMgraduate sex shares; countryregional groups; no imputation

Root handlesUISBDDScurrent and source release; exactSTEMfield/ISCEDindicator mapping required.

Access/interpretation: UNESCO attribution/license; missingcountryyearsvisible.

- [Original source 1](https://www.unesco.org/gem-report/en/2024-gender-report)
- [Original source 2](https://databrowser.uis.unesco.org/resources/bulk)
- [Original source 3](https://apiportal.uis.unesco.org/bdds)

## mics_care: UNICEF MICS round6

Report vintage: MICS6multi-country pooled microdata. Newest verified: MICS6multi-country pooled microdata. Cadence: Country rounds; MICS7newer where available.

Women/men ICTSkillsIndex by householdnumberchildren; smaller male sample

Exact cross-tab requires selectedMICS6microdata/code; generalUNICEFSDMXICTaggregate not same statistic. Countryselection/indexdefinition/weighting must be resolved.

Access/interpretation: Microdata nationalownership/accessconditions; no reportchart-derived proxy.

- [Original source 1](https://mics.unicef.org/surveys)
- [Original source 2](https://data.unicef.org/sdmx-api-documentation/)

## gender_violence: Original study publishers EIU,Plan,SecurityHero,UNESCO,IPU

Report vintage: EIU2021/Plan2020/SecurityHero2023/UNESCO2020/IPU2021. Newest verified: PlannewerDigitalResiliencereport exists; no like-for-like update verified. Cadence: Ad hoc studies; not live harmonized series.

Different samples ofwomen,girls,journalists,parliamentarians,online videos

Originalpublisherreportaggregate extraction possible; exactEIU/UNESCO/IPUpages need resolving; rawsurveydata not verified.

Access/interpretation: Do not merge denominators. HDRPlan31-countrycaption differs primaryquantitative22/qualitative16countrycoverage; verify fullreport.

- [Original source 1](https://plan-international.org/publications/free-to-be-online/)
- [Original source 2](https://www.securityhero.io/state-of-deepfakes/assets/pdf/state-of-deepfake-infographic-2023.pdf)
- [Original source 3](https://unesdoc.unesco.org/)
- [Original source 4](https://www.ipu.org/)

## Remaining scope

48 narrative quantitative candidate passages are retained in the JSON with exact PDF pages. They need endnote-by-endnote checks; do not describe all PDF data as loaded based on structured UNDP tables alone.

DHS/MICS pooled derived figures need selected survey vintages, estimator code and access. Scientific images are study outputs, not country indicators. Proprietary or author-held data remain explicit gaps.

## Additional verified original online violence sources

- [unesco_journalist_violence2020](https://www.unesco.org/en/articles/unescos-global-survey-online-violence-against-women-journalists): Published survey aggregate 73% of women journalists; over900 participants/125countries; women subset denominator must be preserved.
- [unesco_journalist_violence2025](https://www.unesco.org/en/articles/global-survey-reveals-rising-violence-against-women-journalists?hub=67972): 2025 75% among354 women journalist respondents versus reported2020 73% among625 responding to question. Same construct, different sample; metadata essential.
- [ipu_parliament_violence2021](https://www.ipu.org/news/press-releases/2021-11/widespread-sexism-and-violence-against-women-in-african-parliaments-according-new-ipu-report): Original46%Africaand58%Europe sexist-online attacks; Africa137womenMPs plus separate87staff interview sample,50countries; not population representative universal administrative counts.
- [plan_online_harassment2020](https://plan-international.org/publications/free-to-be-online/): Original publisher landing with report; full PDF needed for58% and exact country coverage. Different national Plan summaries use31/32countrycounts; quantitative22countryvsqualitative16countrycoverage must be resolved.
