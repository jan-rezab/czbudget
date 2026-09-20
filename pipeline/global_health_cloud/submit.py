#!/usr/bin/env python3
"""Submit the small global-health source bundle to Cloud Build."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FILES = (
    "scripts/build-global-health-baseline.mjs",
    "scripts/lib/global-health-baseline.mjs",
    "pipeline/config/sovereign_country_universe.json",
    "pipeline/global_health_cloud/cloudbuild.yaml",
)


def stage_bundle(target: Path) -> None:
    for relative in FILES:
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    shutil.copy2(target / "pipeline/global_health_cloud/cloudbuild.yaml", target / "cloudbuild.yaml")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="czbudget-janrezab")
    parser.add_argument("--region", default="europe-west1")
    parser.add_argument("--account")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, required=True)
    parser.add_argument("--async", dest="asynchronous", action="store_true")
    args = parser.parse_args()
    if not 1960 <= args.start_year <= args.end_year <= 2100:
        parser.error("expected 1960 <= start-year <= end-year <= 2100")

    with tempfile.TemporaryDirectory(prefix="czbudget-global-health-") as directory:
        bundle = Path(directory)
        stage_bundle(bundle)
        command = [
            "gcloud", "builds", "submit", str(bundle), f"--config={bundle / 'cloudbuild.yaml'}",
            f"--project={args.project}", f"--region={args.region}",
            "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
            f"--substitutions=_START_YEAR={args.start_year},_END_YEAR={args.end_year}",
        ]
        if args.account:
            command.append(f"--account={args.account}")
        if args.asynchronous:
            command.append("--async")
        subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
