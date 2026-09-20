#!/usr/bin/env python3
"""Submit the cloud-only Czech NRHZS provider-procedure ingestion."""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.build_admission import assert_data_plane_idle


HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    args = parser.parse_args()
    assert_data_plane_idle(PROJECT, REGION)
    command = [
        "gcloud", "builds", "submit", str(HERE),
        "--config=" + str(HERE / "cloudbuild.yaml"),
        "--project=" + PROJECT,
        "--region=" + REGION,
        "--service-account=" + SERVICE_ACCOUNT,
        "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
        "--account=" + args.account,
        "--async", "--format=json",
    ]
    subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
