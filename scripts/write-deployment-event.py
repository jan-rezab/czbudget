#!/usr/bin/env python3
"""Write one immutable Cloud Build deployment receipt."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    if len(sys.argv) not in (5, 6):
        raise ValueError("usage: write-deployment-event.py OUTCOME DIGEST GIT_SHA BUILD_ID [PR_NUMBER]")
    outcome, image_digest, git_sha, build_id = sys.argv[1:5]
    pr_number = sys.argv[5] if len(sys.argv) == 6 else ""
    if outcome not in {"deployed", "skipped"}:
        raise ValueError("outcome must be deployed or skipped")
    if not re.fullmatch(r"[a-f0-9]{40}", git_sha):
        raise ValueError("git SHA is required")
    if not build_id:
        raise ValueError("Cloud Build ID is required")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image_digest):
        raise ValueError("immutable image digest is required")

    release = read_json(Path("data/release-manifest.v1.json"))
    try:
        municipal = read_json(Path(os.environ.get("PUBLIC_SNAPSHOT_POINTER", "/workspace/.public-serving-build/current.json")))
    except FileNotFoundError:
        municipal = {}
    try:
        cityvizor = read_json(Path("data/cityvizor-current.v1.json"))
    except FileNotFoundError:
        cityvizor = {}
    release_ids = []
    for value in (
        f"{git_sha}-{build_id}",
        release.get("municipal_ingestion_run_id"),
        municipal.get("release_id"),
        cityvizor.get("release_id"),
    ):
        if value and value not in release_ids:
            release_ids.append(value)

    event = {
        "schema_version": "1.0.0",
        "event_type": "deployment",
        "event_id": f"deployment:{build_id}",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "outcome": outcome,
        "git_sha": git_sha,
        "pr_number": int(pr_number) if re.fullmatch(r"\d+", pr_number) else None,
        "cloud_build_id": build_id,
        "image_digest": image_digest,
        "data_release_ids": release_ids,
    }
    Path(os.environ.get("DEPLOYMENT_EVENT_OUTPUT", "/workspace/.deployment-event.json")).write_text(
        json.dumps(event, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Recorded {outcome} deployment event {event['event_id']}")


if __name__ == "__main__":
    main()
