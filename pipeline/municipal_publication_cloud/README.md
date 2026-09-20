# Municipal publication candidates

This data-plane job standardizes the step between a country being present in
the municipal warehouse and becoming eligible for the public site.

It runs only in Cloud Build `europe-west4`, under `psd-data-builder`, with the
`plane-data` tag. The submitted source bundle contains loader code and reviewed
small registries only. Warehouse selections and generated profiles never write
to the website checkout.

The initial supported country is Poland (`POL`). A run performs:

1. a partition-pruned warehouse selection;
2. immutable archival under
   `gs://czbudget-janrezab-data-layers/processing-runs/municipal-publication/<build-id>/raw/`;
3. profile and proof generation under the same run's `candidate/` prefix;
4. validation and an immutable `completed.json` receipt.

The receipt distinguishes `processing_status` from `publication_status` and
records source lineage, loader Git SHA, Cloud Build ID, service account, region,
row/profile counts, coverage, checks, artifact hashes, and intended website
destinations.

This candidate job deliberately does **not** move
`gs://czbudget-janrezab-public-snapshots/municipal/current.json`. Public
publication is a separate atomic promotion after the complete municipal release
and the country-directory consumer pass validation together.

Submit from a clean dedicated worktree:

```sh
python3 pipeline/municipal_publication_cloud/submit.py --country POL
```

Use `--wait` to keep the submission attached or `--dry-run` to inspect the
exact source bundle and command.
