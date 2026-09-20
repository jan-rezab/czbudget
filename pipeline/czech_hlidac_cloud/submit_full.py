#!/usr/bin/env python3
"""Submit the complete Top-100 Czech municipality Hlídač history load."""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west1"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "258433468858-compute@developer.gserviceaccount.com"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    command = [
        "gcloud", "builds", "submit", str(ROOT),
        "--ignore-file=" + str(HERE / ".gcloudignore"),
        "--config=" + str(HERE / "full_cloudbuild.yaml"),
        "--project=" + PROJECT,
        "--region=" + REGION,
        "--service-account=" + SERVICE_ACCOUNT,
        "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
        "--account=" + args.account,
        "--format=json",
    ]
    if not args.wait:
        command.append("--async")
    subprocess.run(command, check=True, timeout=76800 if args.wait else 180)


if __name__ == "__main__":
    main()
