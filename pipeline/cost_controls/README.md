# PSD audit cost controls

This directory applies narrowly scoped operational fixes from the 27 September cost audit. It never deletes source/staging data, cancels builds, deploys Cloud Run, or changes the monthly budget. Run it from the dedicated cost-safeguards checkout, never the canonical website checkout.

`python pipeline/cost_controls/control.py --output /absolute/receipt/directory inspect` records current jobs, alerts, serving permissions, HDR layout, repositories and live revisions. `apply` repairs the two named municipal serving-table grants, changes only the existing alert documentation, adds source/release clustering to the existing HDR source table, and installs non-destructive image cleanup dry-run policies. Every write reads the existing resource first, preserves unrelated configuration, records before/after evidence and verifies readback. It fails closed on unexpected metadata.

Image policies preserve existing rules, tagged versions, the twenty newest versions per package, live traffic digests and ten recent ready rollback revisions. New cleanup rules are evaluated in dry-run mode only. This is a cloud registry assessment, not local cleanup or permission to delete raw data.

Billing export requires the official Cloud Billing console. The script can prepare an EU-only `psd_cost_control` dataset but cannot falsely report the export as enabled. Staging retention and physical-storage billing need current warehouse/control-sum and replay assessments before any mutation. Protected raw objects, historical backups, completion receipts and active staging are retained.

All records are small metadata/usage receipts. API tokens are held in process memory and are never written into receipts. Re-run after fixing access; completed operations are idempotent and independent failures are recorded.

References: https://docs.cloud.google.com/artifact-registry/docs/repositories/cleanup-policy and https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-setup
