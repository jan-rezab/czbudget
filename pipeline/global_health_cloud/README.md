# Global health baseline cloud job

This job retrieves the eleven declared World Development Indicators for the
195-country sovereign registry on an ephemeral Cloud Build worker. Four health
financing indicators are WHO Global Health Expenditure Database series
redistributed through WDI. Capacity, workforce and outcome series retain their
named upstream custodian in the serving contract.

The worker stores the complete paginated API responses, the compact serving
artifact, the coverage report, a checksum list covering every raw and derived
file, and a SHA-256 completion receipt under the
immutable prefix
`gs://czbudget-janrezab-data-layers/processing-runs/global-health/<build-id>/`.
`completed.json` is uploaded last. Existing objects are never overwritten.

Submit the reviewed small source bundle; do not download the global payloads to
the Mac:

```sh
python3 pipeline/global_health_cloud/submit.py \
  --account jan@ravineo.com --end-year 2026 --async
```

Review the coverage artifact and completion hashes in Cloud Storage before
pinning a serving release. Local development uses the deterministic transformer
with small fixtures or already-reviewed inputs; it must not use `--fetch`.

## Verified run

Build `06d7f5f2-52ff-48e0-81ab-e3494dde5767` completed on 20 September 2026.
Its derived serving file has SHA-256
`7020800e23cae04f92f3aa9fa1ade824b73cddb993169bba39dfbb5122a464f5`.
The coverage receipt reports at least one health metric for 194 of 195 sovereign
profiles, complete four-series financing coverage for 193, and explicit missing
data for North Korea and Vatican City. The pinned serving copies are
`data/global-health-baseline.v1.json` and `data/global-health-coverage.v1.json`.
