#!/usr/bin/env python3
"""Submit the reviewed Latin-American major-city budget cloud job."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.build_admission import assert_data_plane_idle

HERE = Path(__file__).resolve().parent
PIPELINE = HERE.parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", help="Already-authenticated gcloud account")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION)
    with tempfile.TemporaryDirectory(prefix="latam-municipal-cloud-") as temp:
        context = Path(temp)
        copies = {
            HERE / "worker.py": "worker.py", HERE / "cloudbuild.yaml": "cloudbuild.yaml",
            HERE / "requirements.txt": "requirements.txt",
            PIPELINE / "config/latam_major_city_budget_sources.json": "latam_major_city_budget_sources.json",
            PIPELINE / "transforms/prepare_latam_major_city_budgets.py": "prepare_latam_major_city_budgets.py",
            PIPELINE / "warehouse/load_international_municipal.sh": "pipeline/warehouse/load_international_municipal.sh",
            PIPELINE / "warehouse/schema.sql": "pipeline/warehouse/schema.sql",
        }
        for source, name in copies.items():
            target = context / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        command = ["gcloud", "builds", "submit", str(context), "--config=" + str(context / "cloudbuild.yaml"),
            "--project=" + PROJECT, "--region=" + REGION,
            "--service-account=" + SERVICE_ACCOUNT,
            "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source", "--async", "--format=json"]
        if args.account:
            command.append("--account=" + args.account)
        if args.dry_run:
            print("Packaged: " + ", ".join(sorted(str(path.relative_to(context)) for path in context.rglob("*") if path.is_file())))
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
