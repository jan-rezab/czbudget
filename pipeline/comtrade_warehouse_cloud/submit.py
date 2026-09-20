#!/usr/bin/env python3
"""Submit the cloud-only UN Comtrade BigQuery transformer/loader."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile


HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parents[1]
PROJECT = "czbudget-janrezab"
REGION = "europe-west1"
ALLOWED_REGIONS = ("europe-west1", "europe-west3", "europe-west4", "europe-north1")
SERVICE_ACCOUNT = "projects/czbudget-janrezab/serviceAccounts/comtrade-builder@czbudget-janrezab.iam.gserviceaccount.com"
SOURCE_FILES = (
    "pipeline/transforms/run_un_comtrade_warehouse.py",
    "pipeline/transforms/prepare_un_comtrade_warehouse.py",
    "pipeline/transforms/crawl_un_comtrade.py",
    "pipeline/config/un_comtrade_source.v1.json",
    "pipeline/config/sovereign_country_universe.json",
    "pipeline/warehouse/un_comtrade_schema.sql",
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--region", choices=ALLOWED_REGIONS, default=REGION)
    parser.add_argument("--frequency", choices=["A", "M"])
    parser.add_argument("--period")
    parser.add_argument("--references-only", action="store_true")
    parser.add_argument("--max-tasks", type=int, default=20000)
    parser.add_argument("--max-periods", type=int, default=1)
    parser.add_argument("--chunk-rows", type=int, default=1_000_000)
    parser.add_argument("--wait", action="store_true", help="Wait for the build instead of returning its ID")
    args = parser.parse_args()
    if bool(args.frequency) != bool(args.period):
        parser.error("--frequency and --period must be supplied together")
    if args.references_only and (args.frequency or args.period):
        parser.error("--references-only cannot be combined with a period")
    if not 1 <= args.max_tasks <= 50000:
        parser.error("--max-tasks must be between 1 and 50000")
    if not 1 <= args.max_periods <= 20:
        parser.error("--max-periods must be between 1 and 20")
    if not 1000 <= args.chunk_rows <= 2_000_000:
        parser.error("--chunk-rows must be between 1000 and 2000000")
    return args


def main() -> None:
    args = parse_args()
    substitutions = {
        "_FREQUENCY": args.frequency or "AUTO",
        "_PERIOD": args.period or "AUTO",
        "_MAX_TASKS": str(args.max_tasks),
        "_MAX_PERIODS": str(args.max_periods),
        "_CHUNK_ROWS": str(args.chunk_rows),
        "_REFERENCES_ONLY": str(args.references_only).lower(),
    }
    with tempfile.TemporaryDirectory(prefix="comtrade-warehouse-source-") as temporary:
        source = Path(temporary)
        build_bundle(source)
        command = [
            "gcloud", "builds", "submit", str(source),
            "--config=" + str(source / "cloudbuild.yaml"),
            "--project=" + PROJECT,
            "--region=" + args.region,
            "--service-account=" + SERVICE_ACCOUNT,
            "--gcs-source-staging-dir=gs://czbudget-janrezab-un-comtrade-raw/build-source-warehouse",
            "--substitutions=" + ",".join(f"{key}={value}" for key, value in substitutions.items()),
            "--account=" + args.account,
            "--format=json",
        ]
        if not args.wait:
            command.append("--async")
        subprocess.run(command, check=True, timeout=14760 if args.wait else 180)


if __name__ == "__main__":
    main()
