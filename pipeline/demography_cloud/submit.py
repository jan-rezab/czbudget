#!/usr/bin/env python3
"""Submit the universal demography build without staging bulk data on the Mac."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROJECT = "czbudget-janrezab"
REGION = "europe-west1"
STAGING = "gs://czbudget-janrezab-data-layers/processing-build-source"
SERVICE_ACCOUNT = "projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com"


def build_command(context: Path, account: str | None) -> list[str]:
    command = [
        "gcloud", "builds", "submit", str(context),
        "--config=" + str(context / "cloudbuild.yaml"),
        "--project=" + PROJECT,
        "--region=" + REGION,
        "--service-account=" + SERVICE_ACCOUNT,
        "--gcs-source-staging-dir=" + STAGING,
        "--async",
        "--format=json",
    ]
    if account:
        command.append("--account=" + account)
    return command


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", help="Already-authenticated gcloud account")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sources = {
        HERE / "worker.py": "worker.py",
        HERE / "cloudbuild.yaml": "cloudbuild.yaml",
        HERE / "requirements.txt": "requirements.txt",
        ROOT / "scripts" / "build-country-demography.py": "build-country-demography.py",
        ROOT / "data" / "country-parity.v1.json": "country-parity.v1.json",
    }
    with tempfile.TemporaryDirectory(prefix="country-demography-submit-") as temporary:
        context = Path(temporary)
        for source, name in sources.items():
            shutil.copy2(source, context / name)
        command = build_command(context, args.account)
        if args.dry_run:
            print("Packaged: " + ", ".join(sorted(path.name for path in context.iterdir())))
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
