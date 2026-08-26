# Country parity contract

`data/country-parity.v1.json` is the public ledger for every data layer used by
the shared country profile. It does not force national accounts into a Czech
classification. Each country keeps its native accounting perimeter,
classification, currency, fiscal stage and source lineage; harmonised IMF,
OECD/COFOG and SHA series are separate modules.

Build the contract and country-scoped artifacts with:

```sh
npm run build:country-parity
```

The build writes one `data/countries/<iso3>/profile.v1.json` bundle for each of
the 17 published country profiles. Countries with a loaded municipal census also get a
`municipalities.v1.json` directory shard. The browser can therefore request one
country without downloading the complete international directory.

Every module has a `status`, a human-readable `coverage` statement and an
explicit `missing_dimensions` array. Missing, pending and not-applicable facts
must never be represented as zero. The JSON Schema is published at
`data/contracts/country-parity.schema.json`.

National-scale municipal line facts remain in the BigQuery warehouse rather
than browser bundles. The parity manifest records reviewed warehouse bundle
counts when their local manifests are present. Loading remains idempotent via
`pipeline/warehouse/load_international_municipal.sh`.
