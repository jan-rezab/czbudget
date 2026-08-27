# Government accountability layer

The accountability contract answers questions that a budget total cannot:

- which institutions are actual governments rather than statistical regions;
- whether one tier is a geographic parent, budget parent, or administrative supervisor;
- who sets rules, finances, allocates, owns, commissions, delivers and audits each service;
- who sets a revenue instrument's rate, who collects it and how the recipient may use it;
- which actor must answer to which forum and through what mechanism;
- whether transfer counterparties are known well enough to consolidate.

The reviewed Czech baseline is
`pipeline/config/government_accountability_cze.v1.json`. Build it with:

```sh
npm run build:accountability
```

The build reconciles the reviewed institutional model with the fourteen 2025
regional accounting entities in `data/benchmark.v1.json`. It writes the public
contract to `data/accountability/cze-regions.v1.json` and table-grain JSONL files
to `data/accountability/warehouse/`.

Validate reproducibility and invariants with:

```sh
npm run validate:accountability
```

The public JSON shape is documented by
`data/contracts/government-accountability.schema.json`. The matching BigQuery
tables are in `pipeline/warehouse/schema.sql`; the idempotent loader is
`pipeline/warehouse/load_government_accountability.sh`.

## Integrity boundary

The 2025 FIN summary identifies each region's total received transfers, but not
every payer, programme and onward recipient. The build therefore emits a
received-transfer fact with a null sender, explicit quality flags and
`is_consolidation_matchable = false`. Do not infer a counterparty or eliminate
the amount in a consolidated view until detailed payer-recipient facts match on
programme, period, stage, amount and accounting perimeter.

Likewise, the accounting category `tax_revenue` is not tax autonomy. Czech
regional tax revenue is predominantly a nationally determined share of taxes.
The contract stores rate setter, collector, allocator, earmarking and recipient
discretion as separate attributes.

## Initial coverage

- Czech regional budget summaries: 14/14, actual 2025.
- Reviewed public functions: 10.
- Atomic responsibility assignments: 93.
- Revenue instruments: 7.
- Accountability mechanisms: 6.
- International comparison: institutional archetypes only; foreign regional
  entity budgets remain explicitly not loaded.

Next fact layers are programme-level transfers and counterparties, provider
ownership and accounts, debt instruments, procurement, workforce, service
outputs and outcomes. These should remain separate grains linked by stable
entity, programme, function, period and source identifiers.
