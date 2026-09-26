# Chapter 3–4 source chart transformations

`chart_ch3_4.py` transforms immutable cloud source records without making network calls or writing warehouse tables. The caller is responsible for admission, validation and atomic publication. A transformation becomes usable only when its schema binding has been reviewed against the source preview and pins the exact source SHA256. A missing or invalid binding returns an explicit unresolved result with no observations.

## Current readiness

| Family | Implemented method | Actual source binding |
| --- | --- | --- |
| WIPO assistive patents | Exact workbook cells, with offices, units, periods and categories individually specified | Awaiting cloud workbook preview |
| Sapien public aggregate workbooks | Exact publisher aggregate cells; no respondent records | Awaiting cloud workbook preview; exact HDR pooled smartphone calculations may remain unavailable |
| CDC BRFSS 2023/2024/2025 | Weighted valid-response prevalence and weighted means using explicit source-code mappings; sex/age grouping and eligibility filters | Awaiting cloud source metadata/codebook preview |
| ITU connectivity | Exact cells preserving country, observation year and source age band | Awaiting cloud workbook preview; regional aggregates cannot recreate country/age tables |
| Ada Lovelace original/new survey | Weighted modular-question proportions, explicit assigned sample and codebook labels | Awaiting original/new CSV and codebook previews |

The source audit and download manifests identify available sources; they do not establish that a chart has been reconstructed. No production source column names or coordinates have been guessed in this module.

## Cloud input contract

Each input record supplies `source_id`, `source_sha256`, `member`, `row_number`, and `record_json`, matching the source-record warehouse. `record_json` may be an already parsed object or serialized JSON. CSV data records preserve `columns` and `values`; statistical-file respondent records use named fields. Workbook records preserve the sheet's cached values separately from formulas.

Each binding supplies `source_id`, exact 64-character `source_sha256`, `binding_verified: true`, `schema_evidence` pointing to the immutable schema preview/codebook receipt, `period`, `geography`, `unit`, `denominator`, `metric`, and `method_version`. Original report and updated releases use separate bindings and method versions. The source vintage must be established from source metadata rather than the time of ingestion.

For survey estimates the binding explicitly sets `answer_column`, `weight_column`, `valid_codes`, `numerator_codes`, and `group_columns`. Every group column requires an explicit `group_labels` code mapping. Optional `filters` restrict assigned modules or other eligibility with reviewed exact source codes. Codes are compared as strings without guessed coercion. Missing, nonfinite or nonpositive weights are excluded and counted. Invalid or unassigned answers are excluded before the weighted denominator is formed. An unmapped age/sex group is excluded and counted rather than given an invented label.

A `weighted_proportion` is `100 × sum(valid numerator weights) / sum(valid response weights)` and requires unit `percent`. A `weighted_mean` requires `numeric_value_map` for every valid code, preserving coded zero responses separately from their numerical meaning. Its result is `sum(mapped value × weight) / sum(valid weights)`. The map is retained with the output. No coded missing response may become a zero merely because it has a high numeric source code.

For workbook extraction each selection pins `member`, `row_number`, zero-based `column_index`, `period`, `geography`, `category`, `unit` and `denominator`. Source values remain alongside parsed numerical values. Missing and nonnumeric cells remain visible. Partial coordinate matches, duplicate coordinates and formula records fail the entire chart.

## Coverage and interpretation

BRFSS years remain separate. Full historical 1993–2024 source inputs are not currently available in this task; the module cannot reconstruct that historical trend from 2023–2025 alone. Preserve the 2011 design break and annual state coverage. 2024 excludes Tennessee; 2025 excludes California, Mississippi, Nevada and the US Virgin Islands. Cross-year national changes can reflect coverage as well as changes in respondent outcomes. BRFSS mental-health symptom days are self-reported days, not diagnoses. A valid-source-code map and question timeframe must be recorded before estimating means or frequent distress.

Ada Lovelace wave 1 covers Great Britain, while the newer wave covers the United Kingdom. Total completed sample sizes are not the technology-specific denominator: respondents answered assigned modules. The newer repository README has an inconsistent fieldwork date relative to its title; the technical report must settle the period before comparison. A reported concern about robotic care cannot use a facial-recognition percentage with similar wording. The audit identifies the original robot-care accountability concern as 45%, while the HDR uses 48%.

Sapien results describe an internet-enabled self-selected sample. Public aggregate releases must remain distinct from the exact unpublished HDR pooled smartphone analysis and from restricted respondent data. Clinical concern classifications are not confirmed clinical diagnoses. Age at first smartphone is a retrospective association and does not establish causation.

WIPO office rows, including regional offices, are not countries. Patent-family counts, patent applications, filing office, applicant origin and technology taxonomy remain separate. The workbook landscape dates must be checked rather than inheriting the HDR caption's 2000–2010 label automatically.

ITU source age bands and country years remain literal. Percentages for separate age groups cannot be summed to report overall internet use. Updated annual estimates are not a real-time population census.

The module does not calculate design-based survey confidence intervals. Output labels variance status unresolved, with a null interval. Reproducing report error bars requires a separately verified strata/PSU/replicate-weight design and variance method; ordinary weighted proportions alone do not establish valid intervals.

## Validation

Run `python3 -m unittest discover -s pipeline/undp_cloud -p test_chart_ch3_4.py`. Seven tiny synthetic tests cover weighted denominators, modular eligibility, missing and unmapped values, hash mismatch, source-code zero-day mapping, source decimal precision, separate years, and rejection of formulas or absent workbook cells. These tests validate transformation mechanics; they do not verify source-specific bindings or reconstructed charts.
