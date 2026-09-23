# Public employer and labour-status coverage, 2024

Research checked 2026-09-23. The observed service divisions, industry-by-ownership
figures and labour-status figures are now published in the EU `job_market`
BigQuery dataset through separate verified release pointers. Service release:
`051963cd-9d28-4c22-b9f1-fae58ba9e645` (270 rows). Ownership and labour-status
release: `d6a77bbc-afa2-4ddd-a88e-5ba64e7a672c` (167 + 30 rows). The broader
World Bank/ILO modelled three-sector series is a separate release
`f32cc45c-2aa4-4839-b869-c15bc5280ac7` (18 rows). Reporting views live in
`pipeline/job_market_workforce_2024/reporting_views.sql`; query those views to
select only pointed releases and retain exact source values and URLs.
The source-specific Czech and German national totals are published separately as
release `9fc333ba-6a62-4aeb-bbc5-b640ba2d0149` (eight rows) in
`current_national_public_employment`. Their exact official HTML inputs and
hashes are in that release's immutable completion receipt.

## Meaning of public employment

ILOSTAT's institutional public sector includes government institutions, enterprises at least 50% state owned, and government-controlled non-profits. It therefore answers the question about public employers including state-owned companies, but its public/private indicator does **not** split government from state-owned enterprises. Industry O/P/Q alone is not a measure of public employment: P (education) and Q (health/social care) contain private employers.

Primary definition: <https://ilostat.ilo.org/resources/lfs-toolkit/lfs-questionnaire-viewer/>

## Industry × ownership: ILOSTAT

Indicator `EMP_TEMP_SEX_ECO_INS_NB`, total sex, ISIC Rev. 4 sections, 2024, values in thousands of employed persons. Direct official extract:

<https://rplumber.ilo.org/data/indicator/?id=EMP_TEMP_SEX_ECO_INS_NB&ref_area=USA+CZE+DEU+FRA+GBR+POL&timefrom=2024&timeto=2024>

| Market | Public / all employed | Public / O+P+Q employed | Public / O | Public / P | Public / Q | ILO coverage |
|---|---:|---:|---:|---:|---:|---|
| United States | 13.5% | 37.0% | 91.6% | 61.1% | 7.4% | Yes |
| Czechia | — | — | — | — | — | No 2024 observation |
| Germany | — | — | — | — | — | No 2024 observation |
| France | 20.2% | 61.1% | 87.7% | 80.2% | 34.0% | Yes |
| United Kingdom | 23.5% | 62.1% | 78.0% | 69.4% | 48.3% | Yes |
| Poland | 24.6% | 82.3% | 100.0% | 83.3% | 62.6% | Yes |

For example, the US O+P+Q total is 44,090.0 thousand employed persons and the public subset is 16,335.2 thousand. The ratio is 37.0%. All published ratios above were calculated from unrounded ILO source counts, and 2024 source rows have no observation-status flag. The ILO source reports employment by institutional sector; the survey basis and minimum working age differ by country. US CPS covers age 16+; country comparisons should retain source and age notes.

## National sources for the two missing markets

- **Czechia:** The [CZSO Public Sector Satellite Account](https://csu.gov.cz/public-sector-satellite-account) reports 1,112,290 public-sector FTE jobs in 2024, 24.2% of 4,588,564 total-economy FTE jobs. General government is 947,878 FTE; the residual 164,412 FTE is public corporations (derived). The account does not provide the ILO-style O/P/Q ownership cross-tab in this table. These national observations are published in `job_market.current_national_public_employment`; separate Czech source observations also exist in `pipeline/source_data/cze_public_employment_observations.csv`.
- **Germany:** [Destatis public employers](https://www.destatis.de/EN/Themes/Government/Public-Service/Tables/public-service-personnel-public-employers.html) reports 5.380 million public-service staff and another 1.558 million staff in majority-public institutions/enterprises with private legal status on 30 June 2024 (6.938 million total). Its [2024 annual employment denominator](https://www.destatis.de/EN/Themes/Labour/Labour-Market/Employment/Tables/persons-employment-sectors-economic.html) currently reports 45.960 million persons, yielding an *indicative* 15.1% with mixed snapshot/annual bases. The annual denominator was revised from 45.987 million on the source page after the earlier research check. This is not directly interchangeable with an ILO annual household-survey share. Detailed German administrative publication: <https://www.destatis.de/DE/Themen/Staat/Oeffentlicher-Dienst/Publikationen/Downloads-Oeffentlicher-Dienst/statistischer-bericht-personalstand-oeffentlicher-dienst-2140600247005.html>.

## Labour-force status: ILOSTAT

The same 2024 ILO country survey sources have total-sex age-15+ (US age-16+) counts for employment `EMP_TEMP_SEX_AGE_NB`, labour force `EAP_TEAP_SEX_AGE_NB`, and persons outside the labour force `EIP_TEIP_SEX_AGE_NB`, all six markets. Unemployed count = labour force − employed. Annual unemployment-rate indicator `UNE_DEAP_SEX_AGE_RT` independently reconciles with that calculation. Direct official endpoint pattern:

`https://rplumber.ilo.org/data/indicator/?id=<INDICATOR>&ref_area=USA+CZE+DEU+FRA+GBR+POL&timefrom=2024&timeto=2024`

| Market | Employed / population | Unemployed / population | Outside labour force / population | Unemployed / labour force |
|---|---:|---:|---:|---:|
| United States | 60.1% | 2.5% | 37.4% | 4.0% |
| Czechia | 59.0% | 1.6% | 39.4% | 2.6% |
| Germany | 59.8% | 2.1% | 38.2% | 3.4% |
| France | 52.4% | 4.2% | 43.4% | 7.4% |
| United Kingdom | 59.3% | 2.7% | 38.0% | 4.4% |
| Poland | 57.1% | 1.6% | 41.2% | 2.8% |

These three population shares sum to 100% except rounding. The unemployment rate uses labour force as denominator; it must not be added to an industry-share pie. Outside the labour force includes people such as retirees and students and is not synonymous with unemployment. For broader labour-market slack, ILOSTAT also publishes potential labour force and LU4 underutilization measures; check exact 2024 country coverage before including them.

## Publication rules for a future data layer

Keep four separate measures and denominators: (1) industry shares among employed persons; (2) institutional public/private shares within each industry; (3) employment, unemployment and outside-labour-force shares of working-age population; (4) unemployment rate within the labour force. Preserve survey source, country-specific age frame, person versus FTE units, and quality flags. Do not fill Czech or German industry-ownership cells using national aggregate totals or assume every O/P/Q worker is publicly employed. For an SOE-specific series, collect national public-corporation employment separately with its own coverage and reference date.
