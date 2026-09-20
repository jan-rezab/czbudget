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
query limit and waits at least 0.5 seconds between requests. Each municipality
is independently deduplicated by contract ID, loaded into BigQuery, and then
published under the immutable campaign prefix
`processing-runs/czech-hlidac-municipality-contracts/top100-2025-07-01-v1/`.
The completion marker is written last. A rerun skips municipalities that already
have a completed attempt, while an interrupted municipality is safely retried
under a new build-specific attempt prefix.

The warehouse table is a municipality-to-contract match table, so the same
contract may appear for more than one municipality. Never add its rows to claim
a unique national contract count without first deduplicating `contract_id`.
