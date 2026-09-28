# Frozen trade serving reports

The deployed web reader (source SQL commit 0ce7663d34bda0f0fac0b92da83358584e9a888f)
reads one atomic immutable release. Export the exact existing report semantics,
not new source data: countries, country profiles, product partners, energy periods
and flows, annual explorer, Russia hub baskets, bilateral declarations and the
three unlinked routing legs. Existing independently validated Russia supplier
release 351ee83a-a765-482a-9ca4-a81c7a304dee is copied by exact generation/hash.
Every warehouse query uses its same 2026-09-28 10:37:44.312451 UTC time pin.

Run only from this dedicated data checkout/branch, with cloudbuild.yaml in
europe-west4 as psd-data-builder and plane-data. It never deploys Cloud Run,
invokes a website build, writes warehouse observations or downloads new sources.
Raw aggregate extracts are immutable gzip in private
processing-runs/trade-reports/<raw-run>/raw/; accepted staging JSON and receipts
are under processing-runs/trade-reports/<build-id>/. Published generation/hash
references are under static-assets/trade-reports/releases/<build-id>/.
The current.json pointer changes by generation CAS only after every object has
been reread, its size/hash/count checked, reader bounds checked, and representative
partitions reconciled with the original pinned reader SQL. A competing release
prevents publication. Previous releases are preserved.

Per-query dry-run allowance is 512 GiB; cumulative run allowance 2 TiB including
original-query reconciliation. Deterministic query IDs prevent repeated scans
on retries. Reuse --raw-run <original-build-id> in a new bounded cloud build to
reuse exact source queries/checkpoints; never change the pin or source SQL while
reusing one. The receipt distinguishes aggregate output counts from underlying
leaf observation counts. Annual/monthly, World/bilateral, TOTAL/HS2/HS6 and
profile row kinds remain separate and must not be added across those scopes.

Local checks use small synthetic fixtures only:
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest pipeline.trade_reports.test_publish
The worker also validates finite values without rounding source numeric tokens.
Only labels (nondeterministic ANY_VALUE) and unordered provenance list ordering
are normalized during reconciliation; counts, amounts, identities, dates and
source IDs must agree exactly. No missing row is filled with a zero or proxy.

After verified publication, enable reports_only in the shared cost-control
config and run the cost controller once. This activates the already deployed
reader without another website release. All covered report requests then have
no warehouse fallback. Unknown coverage remains a visible missing-data response.
