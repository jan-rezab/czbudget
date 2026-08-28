# International regional finance pipeline

Regional governments are not municipalities and their budgets are not parent
totals for municipalities inside the same territory. This pipeline therefore
uses a separate regional jurisdiction dimension and a separate budget fact
table, linked to the shared `public_entities` dimension only by a stable
`public_entity_id`.

## Current normalized coverage

| Country | Regional tiers | Years | Source stage |
| --- | --- | --- | --- |
| France | regions and departments | 2024–2025 | actual accounting balances |
| Poland | 16 voivodeships | 2024–2025 | revised and actual Q4 returns |
| Sweden | 21 regions | 2024–2025 | actual annual accounts by activity |
| Denmark | 5 regions | 2024–2025 | actual annual accounts; coverage is measured per year |

The source registry also records reviewed next adapters for Spain, Germany,
Switzerland, the United States and Slovakia, plus discovery work for Austria,
Belgium, Italy and the Netherlands. A queued source is never counted as loaded.

## Comparable OECD/EU baseline

The OECD/EU Disaggregated Regional Government Finance database (REGOFI) is
loaded as a second, harmonised observation layer. The archived API snapshot
currently contains 479,759 observations for 493 source-region codes in 23
countries over 2010–2022. It includes 29 measures, COFOG functions and values
in national currency, per-capita units and purchasing-power-parity units.

REGOFI observations are stored in
`regional_comparable_finance_observations`, not in the source-native
`regional_budget_line_facts`. Its territorial codes first enter
`regional_source_entities`. A source entity is linked to
`regional_governments` only after a reviewed crosswalk; this prevents old and
new French or Norwegian boundaries from becoming duplicate current regions.

Generate and load the full archived snapshot:

```sh
python3 website/pipeline/transforms/prepare_oecd_regofi.py
website/pipeline/warehouse/load_oecd_regofi.sh \
  czbudget-janrezab budget_detail outputs/oecd-regofi
```

The country/prefix contract and its known source limitations are in
`pipeline/config/oecd_regofi_country_map.v1.json`.

## Does a country have a regional government?

This is not a binary NUTS question. We distinguish a government that approves
and executes a separate budget from a statistical region, a deconcentrated
state office and a special-purpose regional body. Every country in the current
17-country fiscal-scope registry has some regional public-finance layer, but
the constitutional types differ:

- federal/state layer: Germany, United States, Switzerland and Brazil;
- elected territorial region: Czechia, Poland, France, Sweden, Spain, Japan,
  Netherlands, Norway and Greece;
- elected but mainly functional region: Denmark and Finland;
- asymmetric devolved government: United Kingdom;
- regional budget combined with state-administration complexity: Ukraine.

Budget transfers are supporting evidence, not a sufficient test. A transfer
may go to a state field office, a hospital authority, an inter-municipal body
or a statistical programme. A tier is treated as a regional government only
after its legal identity, budget-approval power and accounting perimeter are
identified.

France and Poland reuse official all-subnational archives already cached by the
municipal acquisition pipeline. The regional adapter selects `REG`/`DEPT` in
the French DGFiP file and `Województwo` in the Polish JST dictionary instead of
downloading duplicate copies.

## Run

Install the pinned pipeline dependencies, then run from the workspace root:

```sh
python3 -m pip install -r website/pipeline/requirements.txt
python3 website/pipeline/transforms/prepare_international_regional_data.py \
  --countries FRA,POL,SWE,DNK \
  --years 2024,2025 \
  --raw-mode sample \
  --gzip \
  --output-dir outputs/international-regional
```

Downloaded Nordic responses are cached under
`data/source_cache/international_regional`. Use `--offline` for a deterministic
cache-only rerun. The French and Polish raw archives remain under
`data/source_cache/international_municipal` and are referenced by hash.

For an end-to-end smoke test without changing the full output:

```sh
python3 website/pipeline/transforms/prepare_international_regional_data.py \
  --countries FRA,POL,SWE,DNK \
  --years 2025 \
  --max-entities 1 \
  --output-dir /tmp/czbudget-regional-smoke
```

## BigQuery model

- `regional_governments`: jurisdiction/tier dimension; supports multiple
  regional tiers such as French regions and departments.
- `regional_budget_line_facts`: source-native entity × period × stage ×
  function × economic-item facts. It is range-partitioned by fiscal year and
  clustered by country, entity, stage and function.
- `regional_budget_coverage`: measured entity and fact coverage by country,
  tier and year. Missing reporters remain explicit.
- `regional_budget_line_details`: labels source-native classifications.
- `regional_budget_year_summary`: aggregates only non-summary,
  non-consolidation facts and keeps reporting scopes separate.
- `regional_budget_canonical_facts`: exposes only reviewed, versioned mappings
  from native functional nodes to common categories. Unmapped rows never gain
  an inferred category.
- `regional_source_entities`: source-specific regional identities awaiting or
  recording a reviewed crosswalk to the canonical jurisdiction dimension.
- `regional_comparable_finance_observations`: harmonised REGOFI measures,
  partitioned by fiscal year and kept separate from native line-item facts.
- `regional_comparable_finance_coverage`: measured REGOFI source coverage by
  country and year; it never equates source presence with a legal census.

Apply the schema and load the generated bundle idempotently:

```sh
website/pipeline/warehouse/load_international_regional.sh \
  czbudget-janrezab budget_detail outputs/international-regional
```

The loader replaces only matching dimensions and ingestion-run partitions. It
does not delete municipal data and it does not publish the warehouse contents
to the website.

## Accounting boundary

Regional and municipal facts must not be added until intergovernmental
transfers can be matched by sender, recipient, programme, period, stage and
amount. Geographic containment is not a budget-parent relationship. Hybrid
city-regions such as Berlin, Vienna, Paris and Prague require explicit dual-role
handling before any consolidated comparison.
