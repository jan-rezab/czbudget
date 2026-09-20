#!/usr/bin/env python3
"""Submit a municipal warehouse-to-publication release candidate in Europe 4."""
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
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)
STAGING = "gs://czbudget-janrezab-data-layers/processing-build-source/municipal-publication"
SUPPORTED_COUNTRIES = ("POL",)
SOURCE_FILES = (
    "pipeline/municipal_publication_cloud/worker.py",
    "pipeline/municipal_publication_cloud/cloudbuild.yaml",
    "pipeline/municipal_publication_cloud/.gcloudignore",
    "pipeline/config/municipal_headline_rules.json",
    "data/registry/municipal-entities/POL.v1.json",
    "data/registry/municipal-item-labels.v1.json",
)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=WEBSITE, text=True).strip()


def assert_dedicated_clean_worktree() -> str:
    branch = git("branch", "--show-current")
    if branch in {"", "main", "master"}:
        raise SystemExit("Municipal publication must run from a dedicated non-main branch/worktree")
    if git("status", "--porcelain"):
        raise SystemExit("Commit or remove worktree changes before submission so the loader SHA is exact")
    return git("rev-parse", "HEAD")


def build_bundle(destination: Path) -> None:
    for relative in SOURCE_FILES:
        source = WEBSITE / relative
        if not source.is_file():
            raise FileNotFoundError(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    shutil.copy2(HERE / "worker.py", destination / "worker.py")
    shutil.copy2(HERE / "cloudbuild.yaml", destination / "cloudbuild.yaml")
    shutil.copy2(HERE / ".gcloudignore", destination / ".gcloudignore")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", choices=SUPPORTED_COUNTRIES, default="POL")
    parser.add_argument("--account", default="jan@ravineo.com")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    loader_sha = assert_dedicated_clean_worktree()
    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION)

    with tempfile.TemporaryDirectory(prefix="municipal-publication-source-") as temporary:
        context = Path(temporary)
        build_bundle(context)
        command = [
            "gcloud", "builds", "submit", str(context),
            "--config=" + str(context / "cloudbuild.yaml"),
            "--project=" + PROJECT,
            "--region=" + REGION,
            "--service-account=" + SERVICE_ACCOUNT,
            "--gcs-source-staging-dir=" + STAGING,
            "--substitutions=_COUNTRY=" + args.country + ",_LOADER_GIT_SHA=" + loader_sha,
            "--account=" + args.account,
            "--format=json",
        ]
        if not args.wait:
            command.append("--async")
        if args.dry_run:
            print("loader_git_sha=" + loader_sha)
            print("packaged_files=" + ",".join(sorted(str(p.relative_to(context)) for p in context.rglob("*") if p.is_file())))
            print("command=" + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=3900 if args.wait else 180)


if __name__ == "__main__":
    main()
