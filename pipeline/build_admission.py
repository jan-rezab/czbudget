"""Fail closed before submitting overlapping PSD data builds."""
from __future__ import annotations

import json
import subprocess


def assert_data_plane_idle(project: str, region: str, *, run=subprocess.run) -> None:
    result = run(
        [
            "gcloud", "builds", "list", "--project=" + project,
            "--region=" + region,
            "--filter=status=WORKING OR status=QUEUED",
            "--limit=100", "--format=json", "--verbosity=error",
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    builds = json.loads(result.stdout or "[]")
    active = [
        build for build in builds
        if "plane-data" in build.get("tags", [])
        and build.get("status") in {"WORKING", "QUEUED"}
    ]
    if active:
        summary = ", ".join(
            f"{build.get('id', 'unknown')} ({build.get('status', 'unknown')})"
            for build in active
        )
        raise RuntimeError(
            "Data build submission blocked: the isolated data plane already has " + summary
        )
