#!/usr/bin/env python3
"""Append independently published UI contracts to the generation-pinned asset lock."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess

BUCKET = "czbudget-janrezab-public-snapshots"
LOCK_OBJECT = f"gs://{BUCKET}/static-assets/current.json"
PACK_PREFIX = f"gs://{BUCKET}/static-assets/v1"
MAX_FILE = 32 * 1024 * 1024
PACK_NAME = "serving-contracts"


def selected(root):
    files = []
    paq = root / "data" / "paq"
    if not paq.is_dir() or paq.is_symlink():
        raise ValueError("Missing or unsafe PAQ serving directory")
    files.extend(path for path in sorted(paq.rglob("*")) if path.is_file())
    files.extend([
        root / "data" / "trade" / "automotive-monthly.v1.json",
        root / "data" / "municipal-budget-codebook.v1.json",
    ])
    for path in files:
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Missing or unsafe serving contract: {path}")
        relative = path.relative_to(root)
        if any(part.startswith(".") for part in relative.parts):
            raise ValueError(f"Hidden serving contract is forbidden: {relative}")
        if path.stat().st_size > MAX_FILE:
            raise ValueError(f"Serving contract exceeds response limit: {relative}")
    required = {
        "data/paq/index.json",
        "data/paq/catalog.json.gz",
        "data/paq/panels.json",
        "data/trade/automotive-monthly.v1.json",
        "data/municipal-budget-codebook.v1.json",
    }
    present = {path.relative_to(root).as_posix() for path in files}
    if not required <= present:
        raise ValueError(f"Missing required serving contracts: {sorted(required - present)}")
    return files


def assemble(root, base_lock, output):
    lock = json.loads(base_lock.read_text())
    if lock.get("version") != 1 or lock.get("bucket") != BUCKET:
        raise ValueError("Invalid base static-asset lock")
    lock["files"] = {url: item for url, item in lock["files"].items() if item.get("pack") != PACK_NAME}
    lock["packs"].pop(PACK_NAME, None)

    output.mkdir(parents=True, exist_ok=False)
    temporary = output / f"{PACK_NAME}.tmp"
    sha256 = hashlib.sha256()
    md5 = hashlib.md5()
    offset = 0
    entries = {}
    with temporary.open("wb") as destination:
        for source in selected(root):
            body = source.read_bytes()
            url = "/" + source.relative_to(root).as_posix()
            entries[url] = {
                "pack": PACK_NAME,
                "offset": offset,
                "size": len(body),
                "sha256": hashlib.sha256(body).hexdigest(),
            }
            destination.write(body)
            sha256.update(body)
            md5.update(body)
            offset += len(body)
    digest = sha256.hexdigest()
    filename = f"{digest}.pack"
    temporary.replace(output / filename)
    descriptor = {
        "key": f"static-assets/v1/{filename}",
        "file": filename,
        "size": offset,
        "md5": base64.b64encode(md5.digest()).decode(),
        "sha256": digest,
    }
    lock["packs"][PACK_NAME] = descriptor
    lock["files"].update(entries)
    return lock, descriptor


def command(*args):
    return subprocess.check_output(args, text=True, timeout=900).strip()


def publish(lock, descriptor, output, base_generation):
    if not os.environ.get("BUILD_ID") or os.environ.get("PROJECT_ID") != "czbudget-janrezab":
        raise RuntimeError("Serving-contract publication runs only on the canonical cloud worker")
    pack_uri = f"{PACK_PREFIX}/{descriptor['file']}"
    local_pack = output / descriptor["file"]
    try:
        remote = json.loads(command("gcloud", "storage", "objects", "describe", pack_uri, "--format=json"))
        reused = True
    except subprocess.CalledProcessError:
        subprocess.run([
            "gcloud", "storage", "cp", str(local_pack), pack_uri,
            "--if-generation-match=0", "--content-type=application/octet-stream", "--quiet",
        ], check=True, timeout=900)
        remote = json.loads(command("gcloud", "storage", "objects", "describe", pack_uri, "--format=json"))
        reused = False
    if (int(remote["size"]) != descriptor["size"]
            or remote.get("md5_hash") != descriptor["md5"]
            or not str(remote.get("generation", "")).isdigit()):
        raise ValueError("Published serving pack failed size/generation verification")
    descriptor["generation"] = str(remote["generation"])
    lock["release_id"] = f"static-assets:{os.environ['BUILD_ID']}"
    lock["published_at"] = command("date", "-u", "+%Y-%m-%dT%H:%M:%SZ")
    lock_path = output / "current.json"
    lock_path.write_text(json.dumps(lock, separators=(",", ":"), sort_keys=True) + "\n")
    subprocess.run([
        "gcloud", "storage", "cp", str(lock_path), LOCK_OBJECT,
        f"--if-generation-match={base_generation}", "--content-type=application/json", "--quiet",
    ], check=True, timeout=300)
    print(json.dumps({
        "pack": pack_uri,
        "pack_bytes": descriptor["size"],
        "files": sum(1 for item in lock["files"].values() if item["pack"] == PACK_NAME),
        "generation": descriptor["generation"],
        "reused": reused,
    }), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--base-lock", type=Path, required=True)
    parser.add_argument("--base-generation", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    lock, descriptor = assemble(args.root.resolve(), args.base_lock.resolve(), args.output.resolve())
    if args.publish:
        publish(lock, descriptor, args.output.resolve(), args.base_generation)
    else:
        descriptor["generation"] = "1"
        (args.output / "current.json").write_text(json.dumps(lock, sort_keys=True) + "\n")
        print(json.dumps({"pack_bytes": descriptor["size"], "files": len(lock["files"])}))


if __name__ == "__main__":
    main()
