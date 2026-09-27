#!/usr/bin/env python3
"""Submit the four-country source coverage job to the data plane."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = f"projects/{PROJECT}/serviceAccounts/psd-data-builder@{PROJECT}.iam.gserviceaccount.com"
STAGING = f"gs://{PROJECT}-data-layers/processing-build-source"
FILES = ("worker.py", "test_worker.py", "requirements.txt", "cloudbuild.yaml")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", help="Already authenticated gcloud account")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip():
        parser.error("commit the reviewed loader before submitting")
    with tempfile.TemporaryDirectory(prefix="psd-health-four-") as temporary:
        bundle = Path(temporary)
        destination = bundle / "pipeline" / "health_four_cloud"
        destination.mkdir(parents=True)
        for name in FILES:
            shutil.copy2(HERE / name, destination / name)
        command = [
            "gcloud", "builds", "submit", str(bundle),
            f"--config={destination / 'cloudbuild.yaml'}",
            f"--project={PROJECT}", f"--region={REGION}",
            f"--service-account={SERVICE_ACCOUNT}",
            f"--gcs-source-staging-dir={STAGING}",
            f"--substitutions=_LOADER_SHA={sha}",
            "--async", "--format=json",
        ]
        if args.account:
            command.append(f"--account={args.account}")
        if args.dry_run:
            print(json.dumps({"loader_sha": sha, "files": list(FILES), "command": command}, indent=2))
            return
        subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
