# Municipal profile validation fixtures

These compressed profiles keep `scripts/validate-site.mjs` hermetic after the
generated `data/municipal-expansion/` serving fan-out moved out of Git.

They are unchanged representative profiles from the last committed fan-out
snapshot (`6ebfd1c375^`) and per-entity snapshot (`74d16ace3e^`). They cover
the validator's Czechia, Denmark, Spain, Japan and Brazil rendering and
accounting-contract checks. Production still hydrates the complete serving
layers from their generation-pinned Google Cloud snapshots.

`NOR-0301`, `NLD-0363` and `FIN-091` are unchanged benchmark profiles from
`data/municipal-benchmarks/<cc>/<id>.json` at `98abd60e2049`, the commit that
fan-out is pinned to in `pipeline/config/municipal-serving-inputs.v1.json`
after it left Git. The three `<cc>.json` indexes stay tracked.
