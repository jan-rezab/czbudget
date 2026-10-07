# Scheduled cost monitor

This metadata-only control job replaces the quarter-hour Cloud Build invocation.
It uses the existing psd-cost-controller identity, exact project-only billing view,
private state prefix, warning channels, thresholds, period latches and fail-closed
behavior. It never ingests data, deploys the website or cancels another worker.

Build only this directory with its cloudbuild.yaml in europe-west1, tagged
plane-control, using the web deployer identity. Pin the resulting image digest in
Cloud Run job psd-cost-monitor: 1 task, parallelism 1, 1 CPU, 512 MiB,
180-second task timeout and zero retries. Runtime uses metadata credentials;
there is no Cloud SDK, package installation or source download per execution.

Run a PSD_COST_DRY_RUN=1 execution and verify its calculated state first, then run
an active execution and verify current.json. Only after that succeeds, retarget
the existing psd-project-cost-cap Scheduler in europe-west4 to the job's :run API.
Preserve */15 * * * *, Europe/Prague, enabled/paused state and existing channels.
Set Scheduler retryCount to zero; a failed execution is handled by existing
monitor-failure alerts and the website's unchanged 30-minute stale-state cutoff.
Grant run.invoker only on this job to the existing Scheduler identity.

Rollback restores the saved Scheduler httpTarget (the generation-pinned legacy
source remains retained). Never create a second recurring schedule. The Cloud
Run job is a control worker, not a second website service. No data-plane work runs
here. Cloud Run Jobs have a one-minute billing minimum; savings should be checked
against actual billed usage after migration, not assumed from task duration alone.

Validate with python3 -m unittest discover -s ops/cost_monitor -p 'test_*.py'.
