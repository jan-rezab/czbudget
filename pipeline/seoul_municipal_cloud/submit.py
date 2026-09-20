#!/usr/bin/env python3
"""Submit the Seoul adapter to an ephemeral Cloud Build worker."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile


HERE = Path(__file__).resolve().parent
CONTRACT = HERE.parent / "config" / "seoul_budget_source.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--account")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="seoul-budget-submit-") as temp:
        context = Path(temp)
        for name in ("export_worker.py", "cloudbuild.yaml", "requirements.txt"):
            shutil.copy2(HERE / name, context / name)
        shutil.copy2(CONTRACT, context / "seoul_budget_source.json")
        command = [
            "gcloud", "builds", "submit", str(context),
            "--config=" + str(context / "cloudbuild.yaml"),
            "--project=czbudget-janrezab", "--region=us-central1",
            "--service-account=projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com",
            "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
            "--async", "--format=json",
        ]
        if args.account:
            command.append("--account=" + args.account)
        if args.dry_run:
            print("Packaged: " + ", ".join(sorted(path.name for path in context.iterdir())))
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
