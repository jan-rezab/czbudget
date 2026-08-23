# Ten-country public-entity registry

The crawl completed on **2026-08-23 at 20:12:23 CEST**. Raw official downloads are retained outside the published site at `../data/source_cache/public_entities/`; their byte sizes and SHA-256 hashes are recorded in `pipeline/public-entity-source-assets.manifest.json`.

## Rebuild

```sh
python3 pipeline/transforms/prepare_public_entity_registry.py
npm run build:public-entities-web
```

The first transform produces one normalized, deterministic gzip CSV per country plus two explicit contracts:

- `data/public-entity-coverage.v1.json` separates row-level coverage, represented bodies, broader aggregate-only populations, source lineage, and unresolved layers.
- `data/public-entity-aggregates.v1.json` stores every located economic/count observation with period, unit, perimeter and dimensions.
- `data/public-entities/{ISO}.v1.csv.gz` stores source-scoped entity records. Empty economic cells mean unavailable and must never be converted to zero.

The browser build creates compact, dictionary-encoded country shards under `data/public-entity-directory/`. Only the selected country is loaded in the UI. The manifest must reconcile to **121,199 rows**:

| ISO | Rows |
| --- | ---: |
| CZE | 18,238 |
| POL | 406 |
| DEU | 124 |
| GBR | 2,267 |
| FRA | 87 |
| USA | 96,984 |
| CHE | 22 |
| SWE | 38 |
| DNK | 24 |
| UKR | 3,009 |

## Comparison rule

Entity counts are not intrinsically comparable. Some sources enumerate state shareholder portfolios, some national-accounts public-sector units, and some government units across all levels. The frontend therefore shows the selected comparison perimeter and the broader official aggregate separately and never adds overlapping source layers.

Entity-level efficiency diagnostics use medians only where both numerator and denominator are present. They are diagnostic descriptions, not a cross-country ranking.
