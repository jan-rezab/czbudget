# EU budget programme detail

`scripts/build-eu-budget-flows.py` imports the European Commission DG Budget
workbook linked in `data/eu-budget-flows.v1.json` under `sources.download_url`.
The input is cached at `../data/source_cache/eu_budget_flows/` relative to the
website repository. The generated source metadata records its SHA-256.

Run `python3 scripts/build-eu-budget-flows.py` to reuse the cache, or pass
`--input PATH` for a reviewed workbook. `--force-download` refreshes the source.
The historical series covers 2000–2024; programme detail uses the comparable
2021–2024 headings. New source vintages require review of the period labels and
source metadata as well as the parser's reconciliation checks.

For every member state, a programme is a leaf code in column A. Heading,
subheading and cluster rows are excluded to avoid double counting. Country
columns in the main expenditure table are combined with the same programme
code in the separately reported NGEU table. Do not use the workbook's Total or
earmarked columns as national expenditure: those columns have different scope.

Each programme retains the original English label, a Czech display label from
`pipeline/config/eu-budget-programmes.cs.json`, both spending components and
the source sheet/cell references. Repeated generic actions remain separate
programme codes. Nonzero negative adjustments are preserved. Programmes with
both components zero are omitted. Missing entries in the separate NGEU table
mean no separately reported NGEU amount for that programme.

Both components must reconcile to the independently reported heading within
0.0001 million EUR (EUR 100, allowing for six-decimal rounding); the import fails
otherwise. An existing outside-heading remainder remains explicitly separate
and is not assigned to an invented programme. Headline country totals retain
their existing definitions.

The report offers native keyboard-accessible disclosures, programme tables in
EUR million, shares within the heading, source-cell references, the workbook
link and CSV export for the selected country/year. Before 2021 it explains the
coverage boundary. This source describes country-attributed annual expenditure;
it does not identify individual projects or final beneficiaries.

Focused validation: `python3 -m unittest discover -s tests -p test_eu_budget_programmes.py`.
