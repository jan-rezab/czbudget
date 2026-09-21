# Czech municipality Hlídač inventory

This cloud-only adapter checks contract coverage for the 100 largest Czech
municipalities through the authenticated Hlídač státu API. It intentionally
stores only municipality-level coverage metadata (matching contract count,
latest publication date and source query), not a second general-purpose copy of
Hlídač's contract corpus.

The scope is generated from PSD's ČSÚ-backed municipality snapshot in
`pipeline/config/czech-hlidac-municipalities.v1.json`. Plzeň remains the
existing detailed baseline. The inventory determines how to batch subsequent
incremental, checkpointed history imports for the other municipalities.

Run it with:

```sh
python3 pipeline/czech_hlidac_cloud/submit.py --account jan@ravineo.com
```

The API token is injected from Secret Manager only in the Cloud Build step and
is never written to an output. Results and a completion receipt are stored at
`gs://czbudget-janrezab-data-layers/processing-runs/czech-hlidac-municipalities/<build-id>/`
and the current inventory is loaded into
`budget_detail.hlidac_municipality_contract_inventory`.

Required attribution: `Zdroj: Hlídač státu (hlidacstatu.cz)` (CC BY 3.0).

## Complete Top-100 histories

After reviewing the inventory, submit the full, resumable extraction with:

```sh
python3 pipeline/czech_hlidac_cloud/submit_full.py --account jan@ravineo.com
```

The full worker uses publication-date windows to stay below the API's 200-page
query limit and waits at least 0.5 seconds between requests. It retains every
accepted API page as immutable gzip JSONL, writes a normalized municipality
snapshot and a warehouse import object, and records SHA-256 hashes plus Cloud
Storage generations in the receipt. These files live below the immutable
campaign prefix
`processing-runs/czech-hlidac-municipality-contracts/top100-2025-07-01-v2/`.

The campaign is pinned to a 20 September 2026 history cutoff. Each build
processes at most one new municipality by default, writes an immutable
`runs/<build-id>/partial.json` progress receipt, then yields the data plane.
Repeat the submission after other queued data work clears; already completed
municipalities are reused. Use `--max-municipalities 2` or `3` only when the
selected cities can finish within the eight-hour step limit. The final build
publishes only after all 100 pinned-snapshot receipts exist.

After all 100 municipality attempts complete, the worker loads a build-scoped
BigQuery staging table, reconciles counts per municipality, rejects null keys or
duplicate `(municipality_ico, contract_id)` pairs, and creates an immutable
release table. Only a validated release may replace `current.json`, using a
Cloud Storage generation precondition. The release completion receipt is
uploaded before the pointer changes; consumers must require that receipt and
verify its hash against the pointer. A receipt alone means validated, while a
matching `current.json` pointer proves publication. No cloud writes follow the
pointer change. This data job does not deploy or modify the website.

A rerun reuses only municipality attempts with a valid v2 completion receipt.
An interrupted attempt remains immutable and is safely retried under a new
Cloud Build ID.

The warehouse table is a municipality-to-contract match table, so the same
contract may appear for more than one municipality. Never add its rows to claim
a unique national contract count without first deduplicating `contract_id`.
