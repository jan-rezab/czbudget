#!/usr/bin/env python3
"""Submit code and the reviewed registry; all data work happens in Cloud Build."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.build_admission import assert_data_plane_idle


HERE = Path(__file__).resolve().parent
DEFAULT_REGISTRY = HERE.parent / "config" / "us_major_cities_sources.json"
PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
STAGING = "gs://czbudget-janrezab-data-layers/processing-build-source"
SERVICE_ACCOUNT = (
    "projects/czbudget-janrezab/serviceAccounts/"
    "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
)
SOURCE_FILES = ("worker.py", "cloudbuild.yaml", "requirements.txt")


def filtered_registry(registry: dict, source_ids: set[str]) -> dict:
    """Create a run manifest containing only explicitly selected source IDs."""
    available = {
        source["id"]
        for source in registry.get("sources", [])
        if source.get("status") == "import_ready"
    }
    available.update(
        source["id"]
        for city in registry.get("cities", [])
        for source in city.get("sources", [])
        if source.get("status") == "import_ready"
    )
    unknown = source_ids - available
    if unknown:
        raise ValueError(
            "unknown or non-import-ready source IDs: " + ", ".join(sorted(unknown))
        )

    selected = dict(registry)
    selected["sources"] = [
        source for source in registry.get("sources", [])
        if source.get("id") in source_ids
    ]
    selected["cities"] = []
    for city in registry.get("cities", []):
        chosen = [
            source for source in city.get("sources", [])
            if source.get("id") in source_ids
        ]
        chosen_broad = [
            source_id
            for source_id in city.get("broad_source_ids", [])
            if source_id in source_ids
        ]
        if not chosen and not chosen_broad:
            continue
        city_copy = dict(city)
        city_copy["sources"] = chosen
        city_copy["broad_source_ids"] = chosen_broad
        selected["cities"].append(city_copy)
    return selected


def build_command(source_dir: Path, account: str | None) -> list[str]:
    command = [
        "gcloud", "builds", "submit", str(source_dir),
        "--config=" + str(source_dir / "cloudbuild.yaml"),
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
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--account", help="Already-authenticated gcloud account")
    parser.add_argument("--dry-run", action="store_true", help="Show packaged files and command")
    parser.add_argument(
        "--source-id",
        action="append",
        default=[],
        help="Only acquire this import-ready source ID (repeatable)",
    )
    args = parser.parse_args()

    if not args.dry_run:
        assert_data_plane_idle(PROJECT, REGION, account=args.account)

    registry = args.registry.resolve()
    if not registry.is_file():
        parser.error(f"registry does not exist: {registry}")

    with tempfile.TemporaryDirectory(prefix="us-major-cities-submit-") as temp:
        context = Path(temp)
        for filename in SOURCE_FILES:
            shutil.copy2(HERE / filename, context / filename)
        packaged_registry = context / "us_major_cities_sources.json"
        if args.source_id:
            value = json.loads(registry.read_text(encoding="utf-8"))
            value = filtered_registry(value, set(args.source_id))
            packaged_registry.write_text(
                json.dumps(value, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        else:
            shutil.copy2(registry, packaged_registry)
        command = build_command(context, args.account)
        if args.dry_run:
            print("Packaged: " + ", ".join(sorted(p.name for p in context.iterdir())))
            print("Command: " + " ".join(command))
            return
        subprocess.run(command, check=True, timeout=180)


if __name__ == "__main__":
    main()
