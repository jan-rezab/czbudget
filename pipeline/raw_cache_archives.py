#!/usr/bin/env python3
"""Lossless local bundles for inactive BRA, UKR and NLD raw caches.

No network/BQ operations. Archives retain original (including already-gzipped)
bytes; the manifest hashes each member. Packing is explicit; readers restore on
demand. Existing archives are immutable and conflicting loose files are retained.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import tarfile
import tempfile
import time

GROUPS = {
    "BRA": "municipal-expansion/BRA",
    "UKR": "international_municipal/UKR",
    "NLD": "european_municipal_benchmarks/NLD",
}
ARCHIVE = ".raw-cache.tar.gz"
MANIFEST = ".raw-cache.manifest.json"


def digest(handle):
    value = hashlib.sha256()
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        value.update(chunk)
    return value.hexdigest()


def file_hash(path):
    with path.open("rb") as handle:
        return digest(handle)


def validate_root(root):
    root = Path(root).absolute()
    if root.resolve() != root:
        raise ValueError(f"Symlinked cache path refused: {root}")
    if not any(str(root).endswith("/data/source_cache/" + group) for group in GROUPS.values()):
        raise ValueError(f"Not an approved raw-cache group: {root}")
    return root


@contextmanager
def locked(root):
    root = validate_root(root)
    with (root / ".raw-cache.lock").open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield root


def loose_files(root):
    files = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        base = Path(directory)
        if ".in-flight" in names:
            raise ValueError(f"Active cache: {base}")
        for name in dirs + names:
            path = base / name
            if path.is_symlink():
                raise ValueError(f"Symlink refused: {path}")
        dirs[:] = sorted(name for name in dirs if not name.startswith("."))
        for name in sorted(names):
            # These are scratch/checkpoint files, never source archive members.
            if name.startswith("."):
                continue
            if name.endswith(".part") or re.search(r"\.(sqlite3?|db)(-(wal|shm|journal))?$", name):
                raise ValueError(f"Download/checkpoint present; refusing to pack: {base / name}")
            if re.search(r" \d+(\.[^./]+)?$", name):
                raise ValueError(f"Review duplicate before packing: {base / name}")
            path = base / name
            info = path.stat()
            if not stat.S_ISREG(info.st_mode):
                raise ValueError(f"Not a regular file: {path}")
            files.append(path)
    return sorted(files)


def record(path, root):
    before = path.stat()
    sha256 = file_hash(path)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
        raise ValueError(f"File changed while hashing: {path}")
    return {"name": path.relative_to(root).as_posix(), "bytes": after.st_size, "sha256": sha256}


def verify_archive(root, archive=None, manifest=None):
    root = validate_root(root)
    archive = archive or root / ARCHIVE
    manifest = manifest or json.loads((root / MANIFEST).read_text())
    if manifest.get("schema_version") != 1:
        raise ValueError("Unknown archive manifest schema")
    expected = {item["name"]: item for item in manifest["files"]}
    if len(expected) != len(manifest["files"]) or not expected:
        raise ValueError("Empty or duplicate archive manifest")
    seen = set()
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle:
            name = member.name
            parts = PurePosixPath(name).parts
            if (not member.isfile() or name.startswith("/") or ".." in parts
                    or any(part.startswith(".") for part in parts)
                    or name != PurePosixPath(name).as_posix()
                    or name not in expected or name in seen):
                raise ValueError(f"Unsafe or unexpected archive member: {name}")
            with bundle.extractfile(member) as handle:
                actual = {"name": name, "bytes": member.size, "sha256": digest(handle)}
            if actual != expected[name]:
                raise ValueError(f"Archive checksum mismatch: {name}")
            seen.add(name)
    if seen != set(expected):
        raise ValueError("Archive members missing")
    if file_hash(archive) != manifest["archive_sha256"]:
        raise ValueError("Compressed archive checksum mismatch")
    return manifest


def pack(root, remove=False, min_age_hours=24):
    with locked(root) as root:
        files = loose_files(root)
        if not files:
            manifest = verify_archive(root)
            return {"files": len(manifest["files"]), "removed": 0, "archive_bytes": (root / ARCHIVE).stat().st_size}
        if any(time.time() - file.stat().st_mtime < min_age_hours * 3600 for file in files):
            raise ValueError(f"Recently modified sources; leave inactive for {min_age_hours} hours: {root}")
        records = [record(file, root) for file in files]
        if (root / ARCHIVE).exists() or (root / MANIFEST).exists():
            manifest = verify_archive(root)
            archived = {item["name"]: item for item in manifest["files"]}
            if any(archived.get(item["name"]) != item for item in records):
                raise ValueError("Loose data differs from immutable archive; retain both and review before repacking")
        else:
            with tempfile.TemporaryDirectory(prefix=".raw-cache-build-", dir=root) as temporary:
                archive = Path(temporary) / "bundle.tar.gz"
                with tarfile.open(archive, "w:gz", compresslevel=6) as bundle:
                    for file in files:
                        bundle.add(file, arcname=file.relative_to(root).as_posix(), recursive=False)
                manifest = {"schema_version": 1, "files": records, "archive_sha256": file_hash(archive)}
                verify_archive(root, archive, manifest)
                manifest_file = Path(temporary) / "manifest.json"
                manifest_file.write_text(json.dumps(manifest, indent=2) + "\n")
                for path in (archive, manifest_file):
                    with path.open("rb") as handle:
                        os.fsync(handle.fileno())
                # Never overwrite an existing archive, even if another process creates one.
                os.link(archive, root / ARCHIVE)
                os.link(manifest_file, root / MANIFEST)
                directory_fd = os.open(root, os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
        # Validate the entire loose tree again before deleting a single source file.
        if [record(file, root) for file in loose_files(root)] != records:
            raise ValueError("Source tree changed during packing; nothing removed")
        removed = 0
        if remove:
            for item in records:
                file = root / item["name"]
                if file.is_symlink() or record(file, root) != item:
                    raise ValueError(f"Source changed; retaining it: {file}")
                file.unlink()
                removed += 1
        return {"files": len(manifest["files"]), "removed": removed,
                "source_bytes": sum(item["bytes"] for item in manifest["files"]),
                "archive_bytes": (root / ARCHIVE).stat().st_size}


def restore(root):
    """Restore missing members only; retain refreshed loose files and the archive."""
    root = Path(root).absolute()
    if not (root / ARCHIVE).exists() and not (root / MANIFEST).exists():
        return 0
    with locked(root) as root:
        manifest = verify_archive(root)
        expected = {item["name"]: item for item in manifest["files"]}
        # Preflight all paths. Never follow directory/file symlinks on extraction.
        for name in expected:
            target = root / name
            if target.resolve() != target or (target.exists() and not target.is_file()):
                raise ValueError(f"Unsafe restore target: {target}")
        restored = 0
        with tarfile.open(root / ARCHIVE, "r:gz") as bundle:
            for member in bundle:
                target = root / member.name
                if target.exists():
                    continue  # Explicit refreshes are authoritative; never overwrite them.
                target.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(prefix=".raw-cache-restore-", dir=target.parent) as temporary:
                    with bundle.extractfile(member) as source:
                        for chunk in iter(lambda: source.read(1024 * 1024), b""):
                            temporary.write(chunk)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                    if file_hash(Path(temporary.name)) != expected[member.name]["sha256"]:
                        raise ValueError(f"Restore checksum mismatch: {member.name}")
                    os.chmod(temporary.name, member.mode & 0o777)
                    os.utime(temporary.name, (member.mtime, member.mtime))
                    os.link(temporary.name, target)  # Exclusive publication, never overwrite.
                restored += 1
        return restored


def inventory(root):
    """Hash real archive bytes, then overlay loose source files after any refresh."""
    with locked(root) as root:
        manifest = verify_archive(root)
        entries = {item["name"]: item for item in manifest["files"]}
        for file in loose_files(root):
            item = record(file, root)
            entries[item["name"]] = item
        return sorted(entries.values(), key=lambda item: item["name"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["pack", "restore", "verify", "inventory"])
    parser.add_argument("group", choices=GROUPS, nargs="?")
    parser.add_argument("--directory", type=Path, help="Explicit approved cache directory (for manifest verification)")
    parser.add_argument("--workspace", type=Path, default=Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[2])))
    parser.add_argument("--remove-loose", action="store_true", help="Only after verified packing")
    args = parser.parse_args()
    if not args.directory and not args.group:
        parser.error("Provide group or --directory")
    if args.remove_loose and args.operation != "pack":
        parser.error("--remove-loose requires pack")
    root = args.directory or args.workspace / "data/source_cache" / GROUPS[args.group]
    if args.operation == "pack":
        result = pack(root, remove=args.remove_loose)
    elif args.operation == "restore":
        result = {"restored": restore(root)}
    elif args.operation == "inventory":
        result = inventory(root)
    else:
        manifest = verify_archive(root)
        result = {"verified_files": len(manifest["files"])}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
