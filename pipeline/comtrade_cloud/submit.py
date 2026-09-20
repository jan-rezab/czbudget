#!/usr/bin/env python3
"""Submit the bounded UN Comtrade crawler to an ephemeral Cloud Build worker."""
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
WEBSITE = HERE.parents[1]
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = "projects/czbudget-janrezab/serviceAccounts/comtrade-builder@czbudget-janrezab.iam.gserviceaccount.com"
SOURCE_FILES = (
    "pipeline/transforms/run_un_comtrade_direct.py",
    "pipeline/transforms/crawl_un_comtrade.py",
    "pipeline/transforms/archive_un_comtrade_raw.py",
    "pipeline/config/un_comtrade_source.v1.json",
    "pipeline/config/sovereign_country_universe.json",
)


def build_bundle(destination: Path) -> None:
    for relative in SOURCE_FILES:
        source = WEBSITE / relative
        if not source.is_file():
            raise FileNotFoundError(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    shutil.copy2(HERE / "cloudbuild.yaml", destination / "cloudbuild.yaml")
    shutil.copy2(HERE / ".gcloudignore", destination / ".gcloudignore")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com", help="Already-authenticated submitting account")
    parser.add_argument("--max-calls-per-account", type=int, default=500)
    args = parser.parse_args()
    if not 1 <= args.max_calls_per_account <= 500:
        parser.error("--max-calls-per-account must be between 1 and 500")

    assert_data_plane_idle(PROJECT, REGION)

    with tempfile.TemporaryDirectory(prefix="comtrade-cloud-source-") as temporary:
        source = Path(temporary)
        build_bundle(source)
        command = [
            "gcloud", "builds", "submit", str(source),
            "--config=" + str(source / "cloudbuild.yaml"),
            "--project=" + PROJECT,
            "--region=" + REGION,
            "--service-account=" + SERVICE_ACCOUNT,
            "--gcs-source-staging-dir=gs://czbudget-janrezab-un-comtrade-raw/build-source",
            "--substitutions=_MAX_CALLS=" + str(args.max_calls_per_account),
            "--account=" + args.account,
            "--async", "--format=json",
        ]
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
