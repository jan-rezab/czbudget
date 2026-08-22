# International municipal finance pipeline

`prepare_international_municipal_data.py` downloads and normalizes the six
municipal sources selected for the first international expansion: Poland,
Denmark, Ukraine, France, Sweden, and the United Kingdom's England collection.

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

## Country behavior

| Country | Facts produced | Important limitation |
| --- | --- | --- |
| Poland | revised and actual revenue/expenditure | Rb-27S/Rb-28S Q4 does not expose the original enacted plan |
| Denmark | enacted and actual revenue/expenditure/financing | source values in DKK thousands are converted to DKK |
| Ukraine | enacted, revised, and actual revenue/expenditure | 1,473 territorial-community budgets including Kyiv; official API is downloaded per budget |
| France | actual debit/credit execution and signed closing balances for all communes; function detail where published | main and supplementary budgets remain separate scopes |
| Sweden | actual costs/income and closing balance sheet | latest annual SCB values are marked preliminary |
| United Kingdom | England council revenue outturn actuals | police, fire, parks, waste and combined-authority returns are excluded; Scotland, Wales, and Northern Ireland need separate adapters before claiming full UK coverage |

Ukraine uses the documented public API at `api.openbudget.gov.ua` and the
official `BUDG` directory. Year-end cumulative fourth-quarter rows are retained;
oblast and district budgets are excluded from the municipality comparison tier.
Use `--api-workers` to control concurrent per-budget downloads (default: 4).

France combines the DGFiP commune census balances with the separate
nature-function publication. The functional file is used wherever a commune
appears in it; the census file fills the remaining communes. This preserves
functional detail without loading the same account execution twice.

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
