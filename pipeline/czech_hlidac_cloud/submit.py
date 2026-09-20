#!/usr/bin/env python3
"""Submit the Top-100 Czech municipality Hlídač inventory crawl."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.build_admission import assert_data_plane_idle


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)
SOURCE_FILES = (
    "pipeline/czech_hlidac_cloud/worker.py",
    "pipeline/config/czech-hlidac-municipalities.v1.json",
)


def build_bundle(destination: Path) -> None:
    for relative in SOURCE_FILES:
        source = ROOT / relative
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    shutil.copy2(HERE / "cloudbuild.yaml", destination / "cloudbuild.yaml")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    args = parser.parse_args()
    assert_data_plane_idle(PROJECT, REGION)
    with tempfile.TemporaryDirectory(prefix="czech-hlidac-inventory-submit-") as temporary:
        source = Path(temporary)
        build_bundle(source)
        command = [
            "gcloud", "builds", "submit", str(source),
            "--config=" + str(source / "cloudbuild.yaml"),
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
