#!/usr/bin/env python3
"""Archive verified UN Comtrade source responses in private Cloud Storage."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[2]
WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", REPO.parent))
CONFIG_PATH = REPO / "pipeline/config/un_comtrade_source.v1.json"


def now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def checksums(path: Path) -> tuple[str, str]:
    md5 = hashlib.md5(usedforsecurity=False)
    sha256 = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            md5.update(block)
            sha256.update(block)
    return base64.b64encode(md5.digest()).decode("ascii"), sha256.hexdigest()


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(command, check=True, text=True, capture_output=capture)
    return result.stdout if capture else ""


def local_inventory(raw_root: Path) -> list[dict[str, Any]]:
    inventory = []
    for path in sorted(raw_root.rglob("*.json.gz")):
        if not path.is_file():
            continue
        md5, sha256 = checksums(path)
        inventory.append({
            "key": path.relative_to(raw_root).as_posix(),
            "bytes": path.stat().st_size,
            "md5_base64": md5,
            "sha256": sha256,
        })
    return inventory


def remote_inventory(gcloud: str, raw_uri: str, raw_prefix: str) -> dict[str, dict[str, Any]]:
    output = run(
        [gcloud, "storage", "objects", "list", f"{raw_uri}/**", "--format=json(name,size,md5_hash)"],
        capture=True,
    )
    rows = json.loads(output or "[]")
    prefix = raw_prefix.strip("/") + "/"
    inventory: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = str(row.get("name") or "")
        if not name.startswith(prefix):
            continue
        inventory[name.removeprefix(prefix)] = row
    return inventory


def verify_inventory(local: list[dict[str, Any]], remote: dict[str, dict[str, Any]]) -> None:
    mismatches = []
    for item in local:
        archived = remote.get(str(item["key"]))
        remote_md5 = (archived or {}).get("md5Hash") or (archived or {}).get("md5_hash")
        if (
            archived is None
            or int(archived.get("size") or -1) != int(item["bytes"])
            or remote_md5 != item["md5_base64"]
        ):
            mismatches.append(str(item["key"]))
    if mismatches:
        preview = ", ".join(mismatches[:5])
        raise RuntimeError(f"Cloud archive verification failed for {len(mismatches)} object(s): {preview}")


def sqlite_backup(source_path: Path, destination_path: Path) -> None:
    source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
        result = destination.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            raise RuntimeError(f"SQLite backup integrity check failed: {result}")
    finally:
        destination.close()
        source.close()


def remove_local_raw(raw_root: Path, inventory: list[dict[str, Any]]) -> None:
    resolved_root = raw_root.resolve()
    for item in inventory:
        path = (raw_root / str(item["key"])).resolve()
        if resolved_root not in path.parents:
            raise RuntimeError(f"Refusing to delete path outside raw root: {path}")
        path.unlink()
    for directory in sorted((path for path in raw_root.rglob("*") if path.is_dir()), reverse=True):
        try:
            directory.rmdir()
        except OSError:
            pass


def remove_warehouse_bundle(output_root: Path) -> int:
    removed = 0
    for path in [*output_root.glob("*.jsonl.gz"), output_root / "manifest.json"]:
        if path.is_file():
            path.unlink()
            removed += 1
    return removed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delete-local-raw", action="store_true", help="Delete raw files only after remote checksum verification")
    parser.add_argument("--delete-warehouse", action="store_true", help="Delete the reproducible local warehouse bundle")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    crawl = config["warehouse_crawl"]
    archive = crawl["archive"]
    bucket_uri = str(archive["bucket_uri"]).rstrip("/")
    raw_prefix = str(archive["raw_prefix"]).strip("/")
    raw_uri = f"{bucket_uri}/{raw_prefix}"
    raw_root = WORKSPACE / crawl["raw_path"]
    availability_root = WORKSPACE / crawl["availability_path"]
    reference_root = WORKSPACE / "data/sources/trade/crawler/reference"
    state_path = WORKSPACE / crawl["state_path"]
    output_root = WORKSPACE / crawl["output_path"]
    gcloud = shutil.which("gcloud")
    if not gcloud:
        raise SystemExit("gcloud is required to archive UN Comtrade responses")
    if not state_path.is_file():
        raise SystemExit(f"Missing crawl checkpoint: {state_path}")

    inventory = local_inventory(raw_root)
    if inventory:
        run([gcloud, "storage", "rsync", str(raw_root), raw_uri, "--recursive", "--checksums-only"])
        verify_inventory(inventory, remote_inventory(gcloud, raw_uri, raw_prefix))

    for local_root, prefix_key in [
        (availability_root, "availability_prefix"),
        (reference_root, "reference_prefix"),
    ]:
        if local_root.is_dir():
            run([
                gcloud, "storage", "rsync", str(local_root),
                f"{bucket_uri}/{str(archive[prefix_key]).strip('/')}",
                "--recursive", "--checksums-only",
            ])

    archive_id = now_compact()
    with tempfile.TemporaryDirectory(prefix="un-comtrade-archive-") as directory:
        temporary = Path(directory)
        checkpoint = temporary / "crawl.sqlite3"
        sqlite_backup(state_path, checkpoint)
        checkpoint_md5, checkpoint_sha256 = checksums(checkpoint)
        checkpoint_prefix = str(archive["checkpoint_prefix"]).strip("/")
        for target in [
            f"{bucket_uri}/{checkpoint_prefix}/{archive_id}/crawl.sqlite3",
            f"{bucket_uri}/{checkpoint_prefix}/latest/crawl.sqlite3",
        ]:
            run([gcloud, "storage", "cp", str(checkpoint), target])

        warehouse_manifest = output_root / "manifest.json"
        warehouse_manifest_payload = json.loads(warehouse_manifest.read_text()) if warehouse_manifest.is_file() else None
        archive_manifest = {
            "schema_version": "1.0.0",
            "archive_id": archive_id,
            "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "bucket_uri": bucket_uri,
            "raw_prefix": raw_prefix,
            "raw_object_count": len(inventory),
            "raw_bytes": sum(int(item["bytes"]) for item in inventory),
            "raw_objects": inventory,
            "checkpoint": {
                "source": str(state_path.relative_to(WORKSPACE)),
                "bytes": checkpoint.stat().st_size,
                "md5_base64": checkpoint_md5,
                "sha256": checkpoint_sha256,
            },
            "warehouse_manifest": warehouse_manifest_payload,
        }
        manifest_path = temporary / "archive-manifest.json"
        manifest_path.write_text(json.dumps(archive_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest_prefix = str(archive["manifest_prefix"]).strip("/")
        for target in [
            f"{bucket_uri}/{manifest_prefix}/{archive_id}.json",
            f"{bucket_uri}/{manifest_prefix}/latest.json",
        ]:
            run([gcloud, "storage", "cp", str(manifest_path), target])

    if args.delete_local_raw:
        remove_local_raw(raw_root, inventory)
    removed_warehouse_files = remove_warehouse_bundle(output_root) if args.delete_warehouse else 0
    print(json.dumps({
        "status": "archived",
        "bucket_uri": bucket_uri,
        "archive_id": archive_id,
        "verified_raw_objects": len(inventory),
        "verified_raw_bytes": sum(int(item["bytes"]) for item in inventory),
        "deleted_local_raw_objects": len(inventory) if args.delete_local_raw else 0,
        "deleted_warehouse_files": removed_warehouse_files,
        "checkpoint_retained_locally": str(state_path),
    }, indent=2))


if __name__ == "__main__":
    main()
