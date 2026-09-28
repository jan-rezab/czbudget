# Reviewed retention decisions, 28 September 2026

The failed PISA staging table stage_report_records_83c540f4_1b3a_408b_9f72_a2dc14054d02
belongs to the timed-out 83c540f4-1b3a-408b-9f72-a2dc14054d02 source run. The
current education pointer selects 69f17852-16ce-4ed1-a88e-aa4d52313378, a different
run. A different successful pointer alone is insufficient proof that this stage
is disposable. Keep it until its immutable raw/staging generations, source hashes,
counts and exact replay destination have been reconciled with a completed receipt.
It has no new expiration or deletion policy. No raw/archive/completion objects
may be expired. The existing report source loader removes its own stages only
after successful atomic publication and completion upload.

The native municipal stage says "awaiting exact-run promotion". Preserve it until
that owning run is reconciled; its name and age do not establish abandonment.
Job-market stages are small (or empty). Preserve them pending explicit receipt
and replay checks; prioritize broad scans over speculative byte cleanup.

Both Docker repositories have cleanup policies in dry-run mode. Tagged images,
20 recent versions per package and the live/tagged traffic revisions plus 10 ready
rollback revisions are kept. No image deletion has been enabled. Review the
registry's asynchronous dry-run evaluation before switching to active cleanup;
live traffic and retained rollback digests must still be protected at that time.

Do not switch datasets to physical billing from the old compression estimate:
project-wide TABLE_STORAGE access was denied for Jan's current identity, leaving
fail-safe/churn unmeasured. Physical billing separately charges these retained
bytes and locks a billing-model change for 14 days. Retain current billing and
time-travel settings until complete metadata and actual billing are available.
No permission expansion was made to bypass this restriction.

Keep the Comtrade raw bucket and historical US source artifacts unchanged.
Actual transfer SKUs must be checked before any move. New supplier export source
submissions now use the existing private EU data-layers bucket, avoiding new US
build-source placement without relocating or deleting historical objects.
