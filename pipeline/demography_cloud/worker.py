#!/usr/bin/env python3
"""Cloud-only acquisition, processing and immutable publication for demography."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request


WPP_URL = "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz"
BUCKET = "gs://czbudget-janrezab-data-layers"
RUN_PREFIX = "processing-runs/country-demography"


def require_cloud(run_id: str) -> None:
    build_id = os.environ.get("BUILD_ID")
    if not build_id or build_id != run_id:
        raise RuntimeError("Cloud Build only: BUILD_ID must match --run-id")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(work: Path, run_id: str) -> None:
    require_cloud(run_id)
    raw = work / "raw"
    receipts = work / "receipts"
    raw.mkdir(parents=True, exist_ok=True)
    receipts.mkdir(parents=True, exist_ok=True)
    target = raw / "WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz"
    request = urllib.request.Request(WPP_URL, headers={"User-Agent": "PublicSpendingData/1.0"})
    with urllib.request.urlopen(request, timeout=300) as response, target.open("wb") as output:
        while block := response.read(1024 * 1024):
            output.write(block)
    if target.stat().st_size < 1_000_000:
        raise RuntimeError(f"UN WPP download is unexpectedly small: {target.stat().st_size} bytes")
    receipt = {"url": WPP_URL, "bytes": target.stat().st_size, "sha256": sha256(target)}
    (receipts / "wpp-source.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")


def process(work: Path, run_id: str) -> None:
    require_cloud(run_id)
    output = work / "output"
    source = work / "raw" / "WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz"
    command = [
        "python", "build-country-demography.py",
        "--countries", "all",
        "--source-policy", "preferred",
        "--universe", "country-parity.v1.json",
        "--un-wpp-file", str(source),
        "--output-root", str(output),
        "--missing-report", str(output / "data" / "country-demography-missing.v1.json"),
        "--download-archive-dir", str(work / "raw" / "preferred"),
        "--allow-network",
    ]
    subprocess.run(command, check=True)
    dataset = json.loads((output / "data" / "country-demography.v1.json").read_text(encoding="utf-8"))
    missing = json.loads((output / "data" / "country-demography-missing.v1.json").read_text(encoding="utf-8"))
    if len(dataset["countries"]) != 195 or missing["missing_country_count"] != 0:
        raise RuntimeError(
            f"Universal demography validation failed: {len(dataset['countries'])}/195 loaded, "
            f"{missing['missing_country_count']} missing"
        )
    shards = list((output / "data" / "countries").glob("*/demography.v1.json"))
    if len(shards) != 195:
        raise RuntimeError(f"Expected 195 country shards, found {len(shards)}")


def publish(work: Path, run_id: str) -> None:
    require_cloud(run_id)
    output = work / "output"
    raw = work / "raw"
    receipts = work / "receipts"
    prefix = f"{BUCKET}/{RUN_PREFIX}/{run_id}"
    files = sorted(path for path in output.rglob("*") if path.is_file())
    completed = {
        "status": "complete",
        "run_id": run_id,
        "country_count": 195,
        "source": json.loads((receipts / "wpp-source.json").read_text(encoding="utf-8")),
        "files": {
            str(path.relative_to(output)): {"bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in files
        },
    }
    completed_path = work / "completed.json"
    completed_path.write_text(json.dumps(completed, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["gcloud", "storage", "cp", "--recursive", "--no-clobber", str(output / "data"), f"{prefix}/output/"], check=True)
    subprocess.run(["gcloud", "storage", "cp", "--recursive", "--no-clobber", str(raw), f"{prefix}/raw/"], check=True)
    subprocess.run(["gcloud", "storage", "cp", "--recursive", "--no-clobber", str(receipts), f"{prefix}/receipts/"], check=True)
    # The completion marker is intentionally published last. Consumers must require it.
    subprocess.run(["gcloud", "storage", "cp", "--no-clobber", str(completed_path), f"{prefix}/completed.json"], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "process", "publish"))
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "process": process, "publish": publish}[args.command](args.work, args.run_id)


if __name__ == "__main__":
    main()
