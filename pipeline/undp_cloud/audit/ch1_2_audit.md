# HDR2025 overview and chapters1–2 source audit

The prior UNDP load contains source microdata for survey figures and historical composite indices, but does not contain every cited study behind the report. This audit is not an ingestion receipt.

| Evidence | Report page | Status / original source |
|---|---|---|
| O.1, O.4, O.6, O.7, 1.1, 1.3, 2.1 | 3, 7, 9, 10, 18, 20, 47 | published_source_microdata_present — HDRO based on UNDP Survey on AI and Human Development |
| O.2, O.3, 1.2 | 4, 5, 19 | historical_undp_components_present_report_projections_not_verified — HDRO calculations based on Barro and Lee2018; IMF2024; UNDESA2024c; UIS2024; UNSD2025; WB2024d |
| O.5 | 8 | not_in_undp_load_delegated_ch3_4 — Thiagarajan, Newson and Swaminathan2025 |
| O.8, 2.4 | 10, 62 | absent_dataset_endpoint_unresolved — Atari, Xue, Park, Blasi and Henrich2025; Which Humans, PsyArXiv5b26t |
| 1.4 | 24 | absent_licensed_raw_public_study_results_available — Liu and Wang2024, World Bank Policy Research Working Paper10870 |
| 1.6 | 26 | absent_legacy_xls_unresolved — Nordhaus2007 Two Centuries of Productivity Growth in Computing |
| 1.8 | 32 | absent_proprietary_microdata — Brynjolfsson, Li and Raymond2025 Generative AI at Work QJE140(2)889–942 |
| related_to_1.4_and_ai_usage | 24 | absent_fetch_ready — OpenAI Signals v2.0 data dictionary |
| chapter2_note93 | 61 | absent_public_data_record_identified — Vlasceanu et al2024 Science Advances10(6)eadj5778 |
| 1.5 | 25 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |
| 1.7 | 29 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |
| S1.2.1 | 41 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |
| 2.2 | 48 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |
| 2.3 | 55 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |
| Table2.1 | 50 | not_measured_data — HDRO; Figure2.3 based on Brinkmann et al2023 |

Verified cloud-fetch URLs are in `ch1_2_fetch.json`. OpenAI Signals is newer **related** primary data, not a replacement for Semrush visits or representative UNDP survey respondents. World Bank2025 publicly releases result CSVs, but explicitly excludes licensed underlying Semrush country/month traffic and2024internal regression dataset.

Report HDI2024 projections/extrapolations are not observed2024 metric cells. Exact forecast replication remains unresolved. GPT cultural correlation also requires model responses and cultural-distance analysis beyond World Values Survey alone.

The narrative-evidence ledger retains21 additional numerical source contexts, including fixed historical studies, valuation calculations, school/worker/startup surveys, road-safety effects and skills estimates. Some source-note resolutions and original dataset endpoints remain pending; therefore all-report completeness must not be claimed.

Source evidence: [World Bank reproducibility catalog](https://reproducibility.worldbank.org/catalog/332), [OpenAI Signals dictionary](https://cdn.openai.com/signals/data-dictionary.pdf), [QJE data-availability statement](https://doi.org/10.1093/qje/qjae044), [author-hosted Which Humans manuscript](https://henrich.fas.harvard.edu/sites/g/files/omnuum5811/files/henrich/files/which_humans_09222023.pdf), [climate study author repository](https://github.com/josephbb/ManyLabsClimate).

Source fidelity contract: stable source key, immutable original and hash, exact numeric string, period/geography/denominator/footnotes; separate observations from calculations and report vintage from newer releases. Missing licensed, firm-specific or experimental data stays a coverage gap; proxies cannot silently fill it.

Original RAND source exposes a report mismatch:25%overall surveyed ELA/math/science teachers use AI versus near40%ELA/science subgroup. The HDR sentence generalizes40%to teachers. Preserve the exact original denominator. Newer RAND school survey2025 and youth2026 reports exist, but bulk respondent endpoints remain unresolved.
