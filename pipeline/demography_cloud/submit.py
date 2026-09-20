#!/usr/bin/env python3
"""Submit the demography loader's code-only context to the data plane."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
STAGING = "gs://czbudget-janrezab-data-layers/processing-build-source"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)

sys.path.insert(0, str(ROOT))
from pipeline.build_admission import assert_data_plane_idle


def git_sha() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, timeout=30
    ).strip()


def build_command(context: Path, account: str | None, loader_sha: str, started_at: str) -> list[str]:
    command = [
        "gcloud", "builds", "submit", str(context),
        "--config=" + str(context / "cloudbuild.yaml"),
        "--project=" + PROJECT,
        "--region=" + REGION,
        "--service-account=" + SERVICE_ACCOUNT,
        "--gcs-source-staging-dir=" + STAGING,
        "--substitutions=_LOADER_GIT_SHA=" + loader_sha + ",_BUILD_STARTED_AT=" + started_at,
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
    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION)
    loader_sha = git_sha()
    started_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    sources = {
        HERE / "worker.py": "worker.py",
        HERE / "normalizer.py": "normalizer.py",
        HERE / "cloudbuild.yaml": "cloudbuild.yaml",
        HERE / "requirements.txt": "requirements.txt",
        HERE / "sources.json": "sources.json",
        ROOT / "pipeline/config/sovereign_country_universe.json": "sovereign_country_universe.json",
    }
    with tempfile.TemporaryDirectory(prefix="country-demography-data-plane-") as temporary:
        context = Path(temporary)
        for source, name in sources.items():
            shutil.copy2(source, context / name)
        command = build_command(context, args.account, loader_sha, started_at)
        if args.dry_run:
            print(json.dumps({
                "files": sorted(path.name for path in context.iterdir()),
                "command": command,
                "region": REGION,
                "service_account": SERVICE_ACCOUNT,
            }, indent=2))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
