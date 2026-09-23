#!/usr/bin/env python3
"""Submit the 2024 ILOSTAT service-sector load in the isolated data plane."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.build_admission import assert_data_plane_idle

HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)
STAGING = "gs://czbudget-janrezab-data-layers/processing-build-source"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, check=True,
                         capture_output=True, text=True).stdout.strip()
    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION)
    with tempfile.TemporaryDirectory(prefix="job-market-services-submit-") as directory:
        context = Path(directory)
        for name in ("cloudbuild.yaml", "manifest.json", "worker.py"):
            shutil.copy2(HERE / name, context / name)
        command = ["gcloud", "builds", "submit", str(context),
                   "--config=" + str(context / "cloudbuild.yaml"),
                   "--project=" + PROJECT, "--region=" + REGION,
                   "--service-account=" + SERVICE_ACCOUNT,
                   "--gcs-source-staging-dir=" + STAGING,
                   "--substitutions=_LOADER_SHA=" + sha,
                   "--account=" + args.account, "--async", "--format=json"]
        if args.dry_run:
            print("Packaged: cloudbuild.yaml, manifest.json, worker.py")
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
