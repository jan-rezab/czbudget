# Official BRFSS full-delivery gap, 27 September 2026

The bounded cloud access probe `154fc60b-c14f-4825-a9ba-fe9c1849a918` demonstrated HEAD200 and GET206 for the first4096 compressed bytes of the2023–2025 official ASCII archives. It did **not** establish that an ordinary full download succeeds. The subsequent source worker `15b9c7ea-7c11-45ac-94f6-abe3e959a2a4` failed with HTTP403 on ordinary full GET for all three archives before immutable source acquisition. No respondent rows were parsed or published; the fixed-width adapter was not exercised against real records. Its source-layout fixtures remain code evidence only.

The exact blocked full-download sources are:

- 2023: `https://www.cdc.gov/brfss/annual_data/2023/files/LLCP2023ASC.zip`
- 2024: `https://www.cdc.gov/brfss/annual_data/2024/files/LLCP2024ASC.zip`
- 2025: `https://www.cdc.gov/brfss/annual_data/2025/files/LLCP2025ASC.ZIP`

These remain the ASCII links in the official annual pages. The [2025 module-analysis instructions](https://www.cdc.gov/brfss/annual_data/2025/pdf/Complex-Sampling-Weights-and-Preparing-Module-Data-for-Analysis-2025-508.pdf) direct analysts to the annual page's ASCII/SAS Transport datasets and separate questionnaire-version files where applicable. They do not document a required ranged-transfer protocol. The [current data-documentation index](https://www.cdc.gov/brfss/data_documentation/index.htm) and [annual index](https://www.cdc.gov/brfss/annual_data/annual_data.htm) provide no verified alternate full respondent-data delivery endpoint.

The [official CDC FTP `/pub/data/` directory](https://ftp.cdc.gov/pub/data/) lists DASH, GSHS, MINING and YRBS. No BRFSS directory is listed. Opening the historically cited `https://ftp.cdc.gov/pub/data/brfss/` did not produce an accessible directory through the web tool. This is not proof that every possible FTP path is absent; it is also not evidence of a verified current official mirror. No2023–2025 FTP archive URL was verified and none was guessed or admitted.

The official [Socrata BRFSS prevalence catalogue](https://data.cdc.gov/Behavioral-Risk-Factors/Behavioral-Risk-Factor-Surveillance-System-BRFSS-P/dttw-5yxu/data) has27 columns describing year/state/question/response/breakout, sample size, prevalence and confidence limits. It is not the original respondent file with the survey's300-plus named fields and sampling weights. The official [BRFSS mental-health indicators](https://data.cdc.gov/Mental-Health/Behavioral-Risk-Factor-Surveillance-System-BRFSS-M/5eh7-pjx8) has12 columns of state-level estimates and explicitly states that nationwide estimates are unavailable. Neither API can replace the original age-by-sex, life-satisfaction and exactly30-days mental-health microdata calculations in HDR Figures S3.1.1/S3.1.2. SMART/PLACES products have different samples, weights or modeled geographic estimates and are also unsuitable replacements.

No supported full-microdata alternative was established using official sources. The fullGET403 remains an explicit access gap. No range chunks were assembled; no browser/authentication/User-Agent spoofing, proxy, third-party mirror substitution, desktop control or bulk Mac download was used. No further ingestion job was submitted. Historical1991–2025 intake remains a metadata plan, not a completed load.
