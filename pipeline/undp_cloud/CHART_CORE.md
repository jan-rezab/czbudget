# Canonical chart review transforms

`chart_core.py` builds a review artifact from exact warehouse release IDs. It never changes a publication pointer or runs a source acquisition. Cloud execution requires `BUILD_ID`. The root worker can import its pure functions without invoking the CLI.

Inputs match the published `metric_observations`, `survey_answers`, `survey_respondents`, `variable_metadata`, `report_source_records` and `report_source_catalog` schemas. WDI queries the physical source records with all country/indicator metadata joins pinned to the same release; it never depends on a moving current view. Provider source metadata attaches original/newer/related relations and retrieval vintage. Cloud worker should execute from its temporary filesystem and upload the resulting artifact under immutable staging; semantic validation and atomic publication remain the root worker's responsibility.

```sh
python pipeline/undp_cloud/chart_core.py --undp-release VERIFIED_UNDP_RELEASE --report-release VERIFIED_PROVIDER_RELEASE --out /tmp/chart-core.json --gcp-contracts /tmp/verified-gcp-contracts.json
```

Outputs:

- HDRO country/area index and dimension series with missing-year coverage and one source vintage per chart. HDI/IHDI/PHDI rank descending and GII ascending at a common year. Calculated competition ranks are explicitly distinct from official annex ranks. GDI is a parity comparison, with no fabricated welfare ranking.
- Survey Q8/Q10–Q19/Q21 coded-question distributions aggregate in BigQuery before entering worker memory and preserve source response codes/labels, survey metadata, nonresponse categories, source provenance, unweighted counts, weight exclusions and two explicit weighted denominators. Pooled figures describe the surveyed countries under original respondent weights. They do not represent world population. Figure-specific recodes and design confidence intervals are not claimed without reviewed questionnaire/design contracts.
- Current WDI income/consumption shares and Gini remain separate from WID pretax national income share among equal-split adults. WID source fractions remain native proportions with age/pop and data-quality fields. Lowest40% candidate sums are held pending identical survey/welfare verification, rather than filled using WID.
- UNEP total material footprint, per-capita footprint and population remain in the source CSV's native units. Historical countries/aggregates keep provider names until an explicit geography concordance resolves them. Missing observations remain null; estimation/model status remains visible.
- GCP territorial fossil CO2 requires an explicit workbook contract from a verified cloud preview: SHA256, exact cached sheet, header row, country headers/column ordinals, geography kind and native unit. Header drift fails. CO2 consumption, land-use emissions, per-capita ratios and carbon-to-CO2 conversions cannot be silently interchanged. Both original and current workbooks get separate contracts and charts.

The review bundle is data for charts, not proof of exact original report figure reproduction. No observed value is reconstructed from a chart image. Source SHA, year, geography, unit, population/welfare denominator and vintage stay available beside chart values. Current mutable source exports are not the report's Jan2025 snapshot.

Six synthetic tests cover common-year ranking ties, GDI parity handling, survey missing-response denominators, source-native units, malformed workbook headers and held WDI calculations. No bulk source data is loaded locally.

Provider SQL selects only UNEP totals/ratios, WID income and GCP fossil workbooks. Each adapter consumes a query cursor; UIS, PISA, CDC and other unrelated provider records are never loaded into worker memory. Survey joins original respondent provenance before bin aggregation. The raw-answer pure helper exists only as a small-fixture reference, and the cloud CLI uses grouped bins.
