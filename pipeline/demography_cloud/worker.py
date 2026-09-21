#!/usr/bin/env python3
"""Cloud-only fetch, normalize, validate and atomically publish global demography."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import urllib.error
import urllib.request


PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
SERVICE_ACCOUNT = "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
BUCKET = "gs://czbudget-janrezab-data-layers"
RUNS = f"{BUCKET}/processing-runs/country-demography"
RAW = f"{BUCKET}/raw/country-demography/un-wpp-2024"
RELEASES = f"{BUCKET}/published/country-demography/releases"
POINTER = f"{BUCKET}/published/country-demography/current.json"


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require_cloud(run_id: str) -> None:
    expected = {
        "BUILD_ID": run_id,
        "PROJECT_ID": PROJECT,
        "DATA_REGION": REGION,
        "DATA_SERVICE_ACCOUNT": SERVICE_ACCOUNT,
        "LOADER_GIT_SHA": os.environ.get("LOADER_GIT_SHA", ""),
    }
    for name, value in expected.items():
        if not value or os.environ.get(name) != value:
            raise RuntimeError(f"Cloud data-plane contract failed: {name}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def md5_b64(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return base64.b64encode(digest.digest()).decode()


def command(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=check, text=True, capture_output=True, timeout=1200)


def upload_create_only(source: Path, target: str) -> None:
    result = command(
        "gcloud", "storage", "cp", str(source), target,
        "--if-generation-match=0", "--quiet", check=False,
    )
    if result.returncode == 0:
        return
    remote = command("gcloud", "storage", "objects", "describe", target, "--format=json", check=False)
    if remote.returncode != 0:
        raise RuntimeError(f"Upload failed for {target}: {result.stderr}")
    metadata = json.loads(remote.stdout)
    remote_md5 = metadata.get("md5_hash") or metadata.get("md5Hash")
    if int(metadata.get("size", -1)) != source.stat().st_size or remote_md5 != md5_b64(source):
        raise RuntimeError(f"Existing immutable object has different bytes: {target}")


def download(url: str, target: Path) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "PublicSpendingData/2.0"})
    with urllib.request.urlopen(request, timeout=600) as response, target.open("wb") as output:
        for block in iter(lambda: response.read(1024 * 1024), b""):
            output.write(block)
    if target.stat().st_size < 100_000:
        raise RuntimeError(f"Official source is unexpectedly small: {target.name}")
    return {
        "url": url,
        "filename": target.name,
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
        "retrieved_at": now(),
    }


def fetch(work: Path, run_id: str, sources_path: Path) -> None:
    require_cloud(run_id)
    raw = work / "raw"
    receipts = work / "receipts"
    raw.mkdir(parents=True, exist_ok=True)
    receipts.mkdir(parents=True, exist_ok=True)
    registry = json.loads(sources_path.read_text(encoding="utf-8"))
    source_receipts = []
    for source in registry["sources"]:
        target = raw / source["filename"]
        receipt = {"source_id": source["id"], **download(source["url"], target)}
        immutable = f"{RAW}/{receipt['sha256']}/{target.name}"
        upload_create_only(target, immutable)
        receipt["immutable_object"] = immutable
        source_receipts.append(receipt)
    payload = {
        "status": "raw_preserved",
        "dataset": registry["dataset"],
        "revision": registry["revision"],
        "build_id": run_id,
        "sources": source_receipts,
    }
    (receipts / "raw-sources.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def process(work: Path, run_id: str, sources_path: Path, universe_path: Path, normalizer_path: Path) -> None:
    require_cloud(run_id)
    raw = work / "raw"
    output = work / "staging"
    output.mkdir(parents=True, exist_ok=True)
    registry = json.loads(sources_path.read_text(encoding="utf-8"))
    by_id = {source["id"]: source for source in registry["sources"]}
    generated_at = now()
    command(
        "python", str(normalizer_path),
        "--age-source", str(raw / by_id["wpp2024-age5-sex-medium"]["filename"]),
        "--indicator-source", str(raw / by_id["wpp2024-demographic-indicators-medium"]["filename"]),
        "--universe", str(universe_path),
        "--sources", str(sources_path),
        "--output", str(output),
        "--generated-at", generated_at,
    )
    coverage_path = output / "data/demography/coverage.v2.json"
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    if coverage["country_count"] != 195 or coverage["countries_with_complete_age_structure"] != 195:
        raise RuntimeError("Demography coverage validation did not reach 195 countries")
    staged_files = sorted(path for path in output.rglob("*") if path.is_file())
    manifest = {
        "status": "processed",
        "dataset": registry["dataset"],
        "build_id": run_id,
        "processed_at": now(),
        "coverage": coverage,
        "files": {
            str(path.relative_to(output)): {"bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in staged_files
        },
    }
    manifest_path = work / "receipts/processed.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    prefix = f"{RUNS}/{run_id}/staging"
    for path in staged_files:
        upload_create_only(path, f"{prefix}/{path.relative_to(output).as_posix()}")
    upload_create_only(manifest_path, f"{RUNS}/{run_id}/processed.json")


def pointer_generation() -> str:
    result = command("gcloud", "storage", "objects", "describe", POINTER, "--format=json", check=False)
    if result.returncode != 0:
        return "0"
    metadata = json.loads(result.stdout)
    generation = str(metadata.get("generation", ""))
    if not generation.isdigit():
        raise RuntimeError("Existing publication pointer has no valid generation")
    return generation


def publish(work: Path, run_id: str, sources_path: Path) -> None:
    require_cloud(run_id)
    output = work / "staging"
    registry = json.loads(sources_path.read_text(encoding="utf-8"))
    raw_receipt = json.loads((work / "receipts/raw-sources.json").read_text(encoding="utf-8"))
    processed = json.loads((work / "receipts/processed.json").read_text(encoding="utf-8"))
    file_digest = hashlib.sha256(
        json.dumps(processed["files"], sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    release_id = f"wpp2024-{file_digest[:20]}-{run_id}"
    release_prefix = f"{RELEASES}/{release_id}"
    staged_files = sorted(path for path in output.rglob("*") if path.is_file())
    for path in staged_files:
        upload_create_only(path, f"{release_prefix}/{path.relative_to(output).as_posix()}")
    receipt = {
        "status": "validated",
        "processing_status": "complete",
        "publication_status": "validated_not_yet_current",
        "website_consumption_status": "pending_web_adapter",
        "dataset": registry["dataset"],
        "source_revision": registry["revision"],
        "source_objects": raw_receipt["sources"],
        "loader_git_sha": os.environ["LOADER_GIT_SHA"],
        "cloud_build_id": run_id,
        "service_account": SERVICE_ACCOUNT,
        "region": REGION,
        "started_at": os.environ.get("BUILD_STARTED_AT"),
        "validated_at": now(),
        "rows": {
            "received": sum(item["received"] for item in processed["coverage"]["source_rows"].values()),
            "accepted": sum(item["accepted"] for item in processed["coverage"]["source_rows"].values()),
            "rejected": sum(item["rejected"] for item in processed["coverage"]["source_rows"].values()),
            "deduplicated": sum(item["deduplicated"] for item in processed["coverage"]["source_rows"].values()),
        },
        "source_totals": processed["coverage"]["source_totals"],
        "normalized_totals": processed["coverage"]["normalized"],
        "coverage": {
            "countries": processed["coverage"]["country_count"],
            "period": processed["coverage"]["period"],
        },
        "validation": processed["coverage"]["validation"],
        "release_id": release_id,
        "release_prefix": release_prefix,
        "publication_pointer": POINTER,
        "website_destinations": registry["website_destinations"],
        "files": processed["files"],
    }
    release_receipt = work / "receipts/release.json"
    release_receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    upload_create_only(release_receipt, f"{release_prefix}/release.json")
    completed = work / "completed.json"
    completed.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    completed_uri = f"{RUNS}/{run_id}/completed.json"
    upload_create_only(completed, completed_uri)
    pointer = {
        "schema_version": "1.0.0",
        "dataset": registry["dataset"],
        "release_id": release_id,
        "release_prefix": release_prefix,
        "receipt": f"{release_prefix}/release.json",
        "completed_receipt": completed_uri,
        "completed_receipt_sha256": sha256(completed),
        "publication_status": "published_data_plane",
        "published_at": now(),
        "loader_git_sha": receipt["loader_git_sha"],
        "cloud_build_id": run_id,
    }
    pointer_path = work / "current.json"
    pointer_path.write_text(json.dumps(pointer, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    generation = pointer_generation()
    command(
        "gcloud", "storage", "cp", str(pointer_path), POINTER,
        f"--if-generation-match={generation}", "--content-type=application/json", "--quiet",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "process", "publish"))
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--sources", type=Path, default=Path("sources.json"))
    parser.add_argument("--universe", type=Path, default=Path("sovereign_country_universe.json"))
    parser.add_argument("--normalizer", type=Path, default=Path("normalizer.py"))
    args = parser.parse_args()
    if args.command == "fetch":
        fetch(args.work, args.run_id, args.sources)
    elif args.command == "process":
        process(args.work, args.run_id, args.sources, args.universe, args.normalizer)
    else:
        publish(args.work, args.run_id, args.sources)


if __name__ == "__main__":
    main()
