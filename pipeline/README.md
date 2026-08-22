# Versioned data pipeline

This directory is the canonical, reviewable snapshot of the transformation and
warehouse definitions that produce the public datasets. Raw publications and
large generated exports are deliberately not committed. They are addressed by
path, byte size, and SHA-256 in `source-assets.manifest.json`.

The current local workspace keeps raw inputs one directory above this Git
repository. Pipeline scripts retain that workspace layout while the migration
is completed. Set `CZBUDGET_WORKSPACE_ROOT` when running from another checkout.
No pipeline writes to the quarantined legacy `gcp/site` tree.

Reproducibility contract:

1. Install Python dependencies from `requirements.lock` and use Node 22.
2. Verify raw inputs with `node pipeline/create-source-manifest.mjs --verify`.
3. Build the 2010–2025 per-municipality history with `python3 pipeline/transforms/prepare_municipal_history.py`.
4. Run transformations from the workspace root using the versioned scripts in
   `pipeline/transforms`.
5. Run `npm run validate` before publishing.
6. Production builds record `data/release-manifest.v1.json` and deploy the
   pushed image by digest.

`transforms/` contains preparation and generation code, `warehouse/` contains
the BigQuery schema/load definitions, `config/` contains reviewed source and
fiscal-scope registries, and `docs/` contains methodology notes.

The six-country municipal expansion is documented in
`docs/README_international_municipal.md`. Its source registry is
`config/international_municipal_sources.json`.
