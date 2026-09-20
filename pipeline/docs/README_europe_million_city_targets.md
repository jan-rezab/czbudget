# European UN million-city municipal budget targets

This layer makes the Europe part of the UN WUP 2025 million-city audit
reproducible and loadable without claiming that a legal municipality equals a
UN Degree-of-Urbanization city.

## Result checked 2026-09-19

- UN denominator: 45 European built-up cities with at least one million people
  in 2025.
- Explicit legal-government anchors: 24.
- Already published as static line-detail artifacts: 12.
- Verified in BigQuery but not yet published as per-city static artifacts: 11.
- Official structured source configured but not present in the warehouse:
  Essen (1).
- No line-detail adapter: 21.

The 11 warehouse-only anchors contain **53,525 rows**. The verification query
is `pipeline/warehouse/verify_europe_million_city_targets.sql`; its result is
recorded in the source configuration so the generated artifact does not imply
coverage from the mere existence of a country adapter.

## Exact anchor set with lines

Published artifacts: Prague, Copenhagen, Helsinki, Milan, Naples, Rome, Turin,
Amsterdam, Rotterdam, Barcelona, Madrid and Valencia.

Warehouse verified and connected to focused dynamic profile routes: Paris,
Lyon, Birmingham, Leeds, Liverpool, Manchester, Greater London Authority,
Warsaw, Stockholm, Kyiv and Kharkiv. The routes are implemented by
`server/million-city-profiles.mjs` and load their source rows through
`/public-data/municipality-lines`. London means the GLA only; it excludes the
boroughs and City of London. Paris has only 12 commune-level OFGL accounting
summary rows in the current warehouse (8 revenue/expenditure rows are served
after excluding financing), so it is valid but materially shallower than
Lyon's function-level extract.

Configured but not loaded: Essen's official 2025/26 machine-readable city
budget. Berlin, Cologne, Hamburg and Munich currently have no matching
structured city-budget adapter in the source registry; country-level German
headline rows are not counted as line coverage.

## Sources

- Denominator: UN DESA, *World Urbanization Prospects 2025*, File 21,
  `https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx`.
  The generated artifact retains the workbook SHA-256.
- Fiscal sources and exact official URLs are in
  `pipeline/config/international_municipal_sources.json`. Relevant collections
  are Denmark StatBank, France DGFiP, Poland Ministry of Finance, Sweden SCB,
  Ukraine Open Budget, England's MHCLG returns and Essen's official open-budget
  publication.
- Existing published national layers for Czechia, Finland, Italy, the
  Netherlands and Spain retain their source URLs and native classifications in
  their country artifacts and provenance registry.

## Rebuild

Keep the UN workbook temporary or run the build on a cloud worker; do not add a
second bulk source cache to this Mac.

```sh
python3 pipeline/transforms/build_europe_million_city_targets.py \
  --workbook /path/to/WUP2025-F21-DEGURBA-Cities_Pop.xlsx
```

The output is `data/europe-million-city-budget-targets.v1.json`. Every mapped
record says `anchor_legal_government_only`. A future agglomeration-wide claim
requires a polygon-to-municipality crosswalk and explicit handling of
overlapping local-government tiers.
