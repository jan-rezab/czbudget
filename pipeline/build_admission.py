"""Fail closed before submitting overlapping builds to the reserved data region."""
from __future__ import annotations

import json
import subprocess


ACTIVE_LIMIT = 1000


def assert_data_plane_idle(
    project: str, region: str, *, account: str | None = None, run=subprocess.run
) -> None:
    if region != "europe-west4":
        raise ValueError("PSD data builds may only run in europe-west4")
    command = [
        "gcloud", "builds", "list", "--project=" + project,
        "--region=" + region, "--ongoing",
        "--limit=" + str(ACTIVE_LIMIT), "--format=json", "--verbosity=error",
    ]
    if account:
        command.append("--account=" + account)
    result = run(
        command,
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    builds = json.loads(result.stdout or "[]")
    if not isinstance(builds, list) or len(builds) >= ACTIVE_LIMIT:
        raise RuntimeError("Data-plane build listing is incomplete or malformed")
    # --ongoing is the server-side active-state filter. Do not silently ignore
    # a newly introduced active status or an untagged scheduled data build.
    if builds:
        summary = ", ".join(
            f"{build.get('id', 'unknown')} ({build.get('status', 'unknown')})"
            for build in builds
        )
        raise RuntimeError(
            "Data build submission blocked: europe-west4 already has " + summary
        )
