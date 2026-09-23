#!/usr/bin/env python3
"""Submit a code-only job-market serving export to the data plane."""

from pathlib import Path
import argparse
import shutil
import subprocess
import tempfile
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from pipeline.build_admission import assert_data_plane_idle

HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = f"projects/{PROJECT}/serviceAccounts/psd-data-builder@{PROJECT}.iam.gserviceaccount.com"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, check=True,
                         capture_output=True, text=True).stdout.strip()
    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION)
    with tempfile.TemporaryDirectory(prefix="job-market-serving-submit-") as directory:
        context = Path(directory)
        for name in ("worker.py", "cloudbuild.yaml"):
            shutil.copy2(HERE / name, context / name)
        command = ["gcloud", "builds", "submit", str(context),
                   "--config=" + str(context / "cloudbuild.yaml"),
                   "--project=" + PROJECT, "--region=" + REGION,
                   "--service-account=" + SERVICE_ACCOUNT,
                   "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
                   "--substitutions=_LOADER_SHA=" + sha,
                   "--account=" + args.account, "--async", "--format=json"]
        if args.dry_run:
            print("Packaged worker.py and cloudbuild.yaml")
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
