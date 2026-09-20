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

The build writes one `data/countries/<iso3>/profile.v1.json` bundle for all 195
sovereign states. The April 2026 IMF WEO workbook supplies numeric revenue and
expenditure baselines for 191 of them; those baselines are separate modules
from national tax and budget classifications. IMF WEO supplies numeric
unemployment series for 112 countries; the already-loaded World Bank WDI panel
adds 71 country fallbacks, bringing the published baseline to 183. The residual
12 countries remain explicit gaps. Seventeen countries have the full
national dashboard; the remaining profiles publish the harmonised macro-fiscal
spine and mark every unavailable native layer explicitly. Cuba, Monaco, North
Korea and Vatican City have no WEO economy series. Countries with
a loaded municipal census also get a `municipalities.v1.json` directory shard.
The browser can therefore request one country without downloading the complete
international directory.

Every module has a `status`, a human-readable `coverage` statement and an
explicit `missing_dimensions` array. Missing, pending and not-applicable facts
must never be represented as zero. The JSON Schema is published at
`data/contracts/country-parity.schema.json`.

`data/country-core-gaps.v1.json` is the machine-readable coverage gap manifest.
Its source and merge rules are fixed in
`data/contracts/universal-country-core.v1.json`. The compact
`data/global-unemployment.v1.json` artifact uses the complete IMF country
series where present and World Bank only for countries whose IMF series is
empty. It retains the source, year, observation status and fallback flag; the
residual missing countries stay explicit.

National-scale municipal line facts remain in the BigQuery warehouse rather
than browser bundles. The parity manifest records reviewed warehouse bundle
counts when their local manifests are present. Loading remains idempotent via
`pipeline/warehouse/load_international_municipal.sh`.
