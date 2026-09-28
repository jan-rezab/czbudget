#!/usr/bin/env python3
"""Submit the complete Top-100 Czech municipality Hlídač history load."""
from __future__ import annotations

import argparse
from datetime import date
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
    "pipeline/czech_hlidac_cloud/full_worker.py",
    "pipeline/czech_hlidac_cloud/bounded_stage.py",
    "pipeline/russia_suppliers/cloud_clients.py",
    "pipeline/transforms/fetch_hlidac_contracts.py",
    "pipeline/config/czech-hlidac-municipalities.v1.json",
)
VERSIONED_BUNDLE_FILES = SOURCE_FILES + (
    "pipeline/czech_hlidac_cloud/full_cloudbuild.yaml",
)


def build_bundle(destination: Path) -> None:
    for relative in SOURCE_FILES:
        source = ROOT / relative
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    shutil.copy2(HERE / "full_cloudbuild.yaml", destination / "cloudbuild.yaml")


def assert_bundle_matches_head() -> None:
    clean = subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", *VERSIONED_BUNDLE_FILES],
        cwd=ROOT,
    )
    if clean.returncode != 0:
        raise RuntimeError(
            "loader bundle differs from HEAD; commit it before submission so the "
            "receipt Git SHA identifies the exact code"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--history-end", type=date.fromisoformat, required=True, help="Exact cutoff reused by every bounded stage")
    args = parser.parse_args()
    assert_bundle_matches_head()
    assert_data_plane_idle(PROJECT, REGION)
    loader_git_sha = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    with tempfile.TemporaryDirectory(prefix="czech-hlidac-full-submit-") as temporary:
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
            "--substitutions=_LOADER_GIT_SHA=" + loader_git_sha + ",_HISTORY_END=" + args.history_end.isoformat(),
            "--async", "--format=json",
        ]
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
