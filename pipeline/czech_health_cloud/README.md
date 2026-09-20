# Czech provider procedure data

This pipeline loads the PSD-owned Czech healthcare procedure layer from the
official NRHZS open-data distribution. It deliberately does not run on a
workstation: the current source is roughly 543 MB compressed and expands to a
multi-gigabyte CSV.

The source grain is one aggregate for:

`year × provider IČO × procedure code × three-character main diagnosis`

with reported procedure quantity, unique patients and healthcare contacts.
These are reported public-health-insurance services, not cash payments, patient
records or all healthcare activity. Self-pay care, supplementary insurance and
services not reported as individual procedures are outside the source.

Submit the small reviewed worker bundle:

```sh
python3 pipeline/czech_health_cloud/submit.py --account jan@ravineo.com
```

The Cloud Build worker:

1. downloads the official gzip distribution on the ephemeral worker;
2. streams through every row and validates the schema, types and coverage;
3. writes the untouched gzip, its hash and validation receipt to a new immutable
   `processing-runs/czech-health-procedures/<build-id>/` prefix;
4. loads a build-scoped BigQuery staging table;
5. rejects duplicate source keys and reconciles warehouse/source row counts;
6. replaces this exact source layer in one BigQuery transaction; and
7. publishes `completed.json` last.

The destination is
`czbudget-janrezab.budget_detail.czech_healthcare_procedure_observations`.
Consumers must use the completed receipt and must not add unique-patient counts
across diagnoses, procedures or providers.

Source: ÚZIS ČR, NRHZS dataset NR-04-02, CC BY 4.0.
