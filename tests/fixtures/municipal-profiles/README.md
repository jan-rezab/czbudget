# Municipal profile validation fixtures

These compressed profiles keep `scripts/validate-site.mjs` hermetic after the
generated `data/municipal-expansion/` serving fan-out moved out of Git.

They are unchanged representative profiles from the last committed fan-out
snapshot (`6ebfd1c375^`) and per-entity snapshot (`74d16ace3e^`). They cover
the validator's Czechia, Denmark, Spain, Japan and Brazil rendering and
accounting-contract checks. Production still hydrates the complete serving
layers from their generation-pinned Google Cloud snapshots.
