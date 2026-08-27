# International municipal finance pipeline

`prepare_international_municipal_data.py` downloads and normalizes official
municipal sources for Poland, Denmark, Ukraine, France, Sweden, Paraguay, and
devolved United Kingdom collections, plus explicitly partial city/canton
collections for Germany, the United States and Switzerland.

The output uses the same public-entity and municipal fact tables as the Czech
FIN 2-12 M pipeline. National classifications remain intact. Missing stages are
left missing: an annual-accounts source is never presented as an approved or
revised budget.

## Run

From the workspace root:

```sh
python3 website/pipeline/transforms/prepare_international_municipal_data.py \
  --countries POL,DNK,UKR,FRA,SWE,GBR \
  --years 2024,2025 \
  --gzip \
  --output-dir outputs/international-municipal
```

For a fast deterministic source/schema check:

```sh
python3 website/pipeline/transforms/prepare_international_municipal_data.py \
  --countries POL,DNK,FRA,SWE,GBR \
  --max-entities 1 \
  --raw-mode sample \
  --raw-limit 1000 \
  --output-dir /tmp/czbudget-international-smoke
```

Downloaded source files are cached under
`data/source_cache/international_municipal`. Use `--refresh` to replace a cached
publication and `--offline` to prohibit network access. A reviewed local source
snapshot can be supplied with repeated
`--source-file SOURCE_ID=/absolute/path` options.

Use `--gzip` for national-scale runs. The warehouse loader accepts both
`.jsonl` and `.jsonl.gz` bundles.

## Credentials

No credential is ever stored in `pipeline/config/international_municipal_sources.json`.
A source that needs one declares only the *name* of the environment variable
holding it, via `api_key_env`; the transform resolves the value at run time
through `source_api_key()` and never logs, echoes, or writes it into an error
message, a cache file, or a run record.

| Environment variable | Needed by | When |
| --- | --- | --- |
| `STADT_ZURICH_API_KEY` | `ch-zurich-city-finance-api-2026` (Switzerland, Zürich city budget API) | Only when the Zürich source is actually fetched, i.e. `--countries CHE` with `--refresh` or an empty cache |
| `OPENBUDGET_API_TOKEN` | Ukraine (`api.openbudget.gov.ua`); may also be passed as `--openbudget-token` | Optional bearer token for the Ukrainian per-budget downloads |

Export the variable in the shell that runs the transform:

```sh
export STADT_ZURICH_API_KEY='…'   # obtain from the Stadt Zürich API portal
python3 website/pipeline/transforms/prepare_international_municipal_data.py --countries CHE --refresh
```

If `STADT_ZURICH_API_KEY` is unset or empty the Swiss refresh **fails loudly**.
It does not fall back to an unauthenticated request: an anonymous call to that
API returns an error or a truncated payload, and silently loading a partial
Zürich budget would be worse than not loading one. Runs that use `--offline`,
or that find the source already in `data/source_cache/international_municipal`,
need no credential at all.

> **Rotate the Stadt Zürich key.** A literal `api_key` value for
> `ch-zurich-city-finance-api-2026` was previously committed to this
> repository's configuration and is present in the public git history at and
> before `ed580e9527`. Removing it from the working tree does **not** remove it
> from history or from any clone or fork. The key must be revoked and reissued
> in the Stadt Zürich API portal by the account owner; only then should the new
> value be exported as `STADT_ZURICH_API_KEY`. Treat the old key as
> compromised.

## Country behavior

| Country | Facts produced | Important limitation |
| --- | --- | --- |
| Poland | revised and actual revenue/expenditure | Rb-27S/Rb-28S Q4 does not expose the original enacted plan |
| Denmark | enacted and actual revenue/expenditure/financing | source values in DKK thousands are converted to DKK |
| Ukraine | enacted, revised, and actual revenue/expenditure | 1,467 territorial-community budgets including Kyiv; official API is downloaded per budget |
| France | actual debit/credit execution and signed closing balances for all communes; function detail where published; current enacted-budget CSVs for six verified cities | enacted-budget coverage is a decentralized published subset; main and supplementary actuals remain separate scopes |
| Sweden | actual costs/income and closing balance sheet | latest annual SCB values are marked preliminary |
| United Kingdom | England council revenue-outturn actuals and 2026 enacted Revenue Account budgets; Scottish council provisional outturn and enacted revenue/capital budgets; Welsh unitary-authority enacted revenue budgets | police, fire, parks, waste and combined-authority returns are excluded; Northern Ireland's 11 district councils remain outside the loaded collection |
| Germany | enacted or forward-plan lines from 11 official structured city publications | decentralized subset, not a national census; source schemas remain city-native |
| Switzerland | enacted HRM2 budgets for all Lucerne municipalities and Zürich's account-level city budget API | decentralized subset, not national coverage |
| Paraguay | modified and paid municipal expenditure lines for 2006-2022; approved (enacted) lines only for 2021 and 2022 | BOOST is historical, economic-only at municipal level and not a current census; the approved layer does not cover 2006-2020 |

Ukraine uses the documented public API at `api.openbudget.gov.ua` and the
official `BUDG` directory. Year-end cumulative fourth-quarter rows are retained;
oblast and district budgets are excluded from the municipality comparison tier.
Use `--api-workers` to control concurrent per-budget downloads (default: 4).

France combines the DGFiP commune census balances with the separate
nature-function publication. The functional file is used wherever a commune
appears in it; the census file fills the remaining communes. This preserves
functional detail without loading the same account execution twice.

England's enacted-budget adapter reads ODS directly with the Python standard
library. It includes the general-purpose `E06`, `E07`, `E08`, `E09` and `E10`
GSS authority classes and excludes special-purpose reporting bodies. German
city sources are enumerated explicitly in the configuration; adding a city is
a reviewed source-contract change, not an inference from a catalog search.

The Paraguay adapter reads only the `Municipalidades` worksheet from the
officially endorsed BOOST distribution. It never mixes the separate central
government worksheet into municipal facts.

## Warehouse load

After review, apply the schema and load idempotently:

```sh
website/pipeline/warehouse/load_international_municipal.sh \
  czbudget-janrezab budget_detail outputs/international-municipal
```

The shared schema stores `functional_classification_id`,
`economic_classification_id`, `coverage_type`, and `is_imputed` on facts. The
`international_municipal_budget_line_details` view resolves national labels
without the Czech-only classification join used by the existing municipal
view.

## A warehouse load is not publication

Loading a country into `czbudget-janrezab.budget_detail` makes its facts
queryable internally. It does not publish anything, and it must never be
counted as published coverage on the site.

`data/municipal-itemized-coverage.v1.json` is the public contract for that
distinction, and every number in it is measured rather than asserted:

- `published_profile_count` (mirrored as `profile_count`) is obtained by
  reading the per-municipality artifacts the site actually serves — under
  `data/municipal-expansion/<cc>/`, `data/municipal-benchmarks/<cc>/` and the
  Czech layer — and counting only those that carry a non-empty native
  line-item array. This is the only figure that feeds the public
  "published data entries" KPI.
- `warehouse_profile_count` and the nested `warehouse` object carry the
  BigQuery figures. A country loaded here but not yet published on the site
  gets `publication_status: "warehouse_only"`, `status: "warehouse_only"` and
  a published count of zero. It is never dropped and never counted.
- `period`, `stages`, `actual_period` and `plan_period` are measured from the
  published line items themselves, so an enacted plan year can never be
  presented as an observed actual.

After adding or extending an adapter, regenerate the contract with
`npm run build:municipal-itemized-coverage`; publishing the per-municipality
artifacts is a separate, explicit step.
