# Bounded Hlídač stages

This replaces the audited 20-hour all-in-one worker with explicit stages.
Code restored from reviewed loader source 3a93552aeb184c7310913dd4e0fcec685c60eef6,
then changed on dedicated codex/bq-cost-safeguards-20260927 data branch.
No historical source or bulk output was restored to this Mac.

Each operator submission requires --history-end YYYY-MM-DD. Every stage for a
campaign uses the same cutoff; its private prefix includes that cutoff so old
municipality completions cannot be mixed into a new period silently. Source pages
are content-hashed, query/page-keyed immutable cloud checkpoints, uploaded and
read back before normalization. A new worker replays those same pages without
requesting them again, rebuilding raw accounting and deduplicated contracts.

Acquisition stops after 20 minutes or five minutes without source/checkpoint
progress. Retry loops check the guard before every attempt; subprocesses have
bounded timeouts. A stopped stage writes checkpointed.json with exact raw refs,
build/SHA, dates and completed municipality receipts, then exits without warehouse
loading or public publication. Resume explicitly with the same --history-end;
there is no automatic schedule or unbounded chain of workers.

Config pipeline/czech_hlidac_cloud/full_cloudbuild.yaml, europe-west4,
psd-data-builder, plane-data. Raw/checkpoints/staging/receipts remain under
gs://czbudget-janrezab-data-layers/processing-runs/czech-hlidac-municipality-contracts/
top100-2025-07-01-v2-staged-<cutoff>/. Only a stage that finishes all 100 municipalities
can enter existing staging/validation/atomic publication. Website deployment is
never invoked. The retained larger worker is unchanged pending measured memory
and CPU evidence; no unsupported cost-saving claim is made from its size alone.

This cost correction has synthetic replay/deadline/corruption checks. It has not
started a new source crawl or changed the existing published contract release.
