#!/usr/bin/env python3
"""Validate a generated CityVizor explorer release without the source cache."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = WEB_ROOT.parent
EXPECTED = {
    "profile_years": 1_688,
    "payments": 1_270_458,
    "accounting": 493_800,
    "events": 76_106,
    "plans": 111_004,
    "noticeboard": 700,
    "pbo_payment_source_rows": 71_632,
}
MONEY_INDEXES = {
    "payments": (2, 3),
    "pbo-payment-source": (2, 3),
    "accounting": (5, 6, 7, 8),
    "events": (2, 3, 4, 5),
    "plans": (3, 4, 5, 6),
}


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def safe(root: Path, relative: str) -> Path:
    if relative.startswith("/") or ".." in Path(relative).parts:
        raise ValueError(f"Unsafe asset path: {relative}")
    path = (root / relative).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        raise ValueError(f"Asset escapes release root: {relative}")
    return path


def asset(root: Path, descriptor: dict, expected_kind: str | None = None):
    path = safe(root, descriptor["path"])
    compressed = path.read_bytes()
    if len(compressed) != descriptor["bytes"] or digest(compressed) != descriptor["sha256"]:
        raise ValueError(f"Compressed asset integrity failure: {descriptor['path']}")
    raw = gzip.decompress(compressed)
    if len(raw) != descriptor["uncompressed_bytes"] or digest(raw) != descriptor["content_sha256"]:
        raise ValueError(f"Asset content integrity failure: {descriptor['path']}")
    payload = json.loads(raw)
    if expected_kind and payload.get("kind") != expected_kind:
        raise ValueError(f"Asset kind mismatch: {descriptor['path']}")
    if "rows" in payload and descriptor["rows"] != len(payload["rows"]):
        raise ValueError(f"Asset row count mismatch: {descriptor['path']}")
    return payload


def validate(root: Path):
    report = json.loads((root / "build-report.json").read_text())
    index_asset_descriptor = {**report["index_asset"], "path": report["index_asset"]["file"]}
    index = asset(root, index_asset_descriptor)
    if report["index_sha256"] != report["index_asset"]["content_sha256"]:
        raise ValueError("Index checksum mismatch")
    if not index.get("complete") or index.get("schema_version") != "1.0.0":
        raise ValueError("Explorer index is incomplete or has an unsupported schema")
    if index.get("profile_count") != 557 or len(index.get("profiles", [])) != 557:
        raise ValueError("Profile count mismatch")
    if index.get("profiles_with_payments") != 105:
        raise ValueError("Publishing profile count mismatch")
    if index.get("record_counts") != EXPECTED or report.get("record_counts") != EXPECTED:
        raise ValueError("Global record totals mismatch")
    if report["index_asset"]["uncompressed_bytes"] > 750_000:
        raise ValueError("Initial explorer index exceeds 750 KB")

    codelists = asset(root, {**index["codelist_asset"], "path": index["codelist_asset"]["file"]})
    if not codelists.get("codelists", {}).get("items") or not codelists["codelists"].get("paragraphs"):
        raise ValueError("Core budget codelists are absent")

    files = {path.resolve() for path in root.rglob("*") if path.is_file()}
    referenced = {
        (root / "build-report.json").resolve(),
        safe(root, index["codelist_asset"]["file"]),
        safe(root, report["index_asset"]["file"]),
    }
    totals = Counter()
    profile_keys = set()
    generated_ids = set()
    max_asset_bytes = 0
    for profile in index["profiles"]:
        key = profile["key"]
        if key in profile_keys:
            raise ValueError(f"Duplicate profile key: {key}")
        profile_keys.add(key)
        descriptor = profile["profile_asset"]
        referenced.add(safe(root, descriptor["path"]))
        max_asset_bytes = max(max_asset_bytes, descriptor["bytes"])
        profile_doc = asset(root, descriptor)
        if profile_doc["profile"]["key"] != key:
            raise ValueError(f"Profile payload mismatch: {key}")
        totals["noticeboard"] += profile_doc["noticeboard"]["rows"]
        for year_entry in profile_doc["years"]:
            totals["profile_years"] += 1
            summary_descriptor = year_entry["year_summary_asset"]
            referenced.add(safe(root, summary_descriptor["path"]))
            max_asset_bytes = max(max_asset_bytes, summary_descriptor["bytes"])
            year = asset(root, summary_descriptor)
            if year["year"] != year_entry["year"]:
                raise ValueError(f"Year summary mismatch: {key}/{year_entry['year']}")
            if year["annual_finance"]["source_api_control"] != year["annual_finance"]["recomputed_from_accounting"]:
                raise ValueError(f"Annual finance controls differ: {key}/{year['year']}")
            for kind in ("payments", "accounting", "events", "plans"):
                expected_rows = year[kind]["rows"]
                actual_rows = 0
                for descriptor in year["assets"][kind]:
                    referenced.add(safe(root, descriptor["path"]))
                    max_asset_bytes = max(max_asset_bytes, descriptor["bytes"])
                    payload = asset(root, descriptor, kind)
                    if payload["profile_key"] != key or payload["year"] != year["year"]:
                        raise ValueError(f"Shard identity mismatch: {descriptor['path']}")
                    if len(payload["rows"]) > report["shard_rows"]:
                        raise ValueError(f"Shard row bound exceeded: {descriptor['path']}")
                    for row in payload["rows"]:
                        if len(row) != len(payload["columns"]):
                            raise ValueError(f"Row width mismatch: {descriptor['path']}")
                        for index_value in MONEY_INDEXES[kind]:
                            if not isinstance(row[index_value], int):
                                raise ValueError(f"Non-integer cents: {descriptor['path']}")
                        if kind == "payments":
                            row_id = (key, year["year"], row[0])
                            if row_id in generated_ids or not re.fullmatch(r"[0-9a-f]{20}-\d+", row[0]):
                                raise ValueError(f"Invalid or duplicate generated row ID: {row_id}")
                            generated_ids.add(row_id)
                    actual_rows += len(payload["rows"])
                if actual_rows != expected_rows:
                    raise ValueError(f"Year asset row mismatch: {key}/{year['year']}/{kind}")
                totals[kind] += actual_rows
            alternate = year.get("alternate_pbo_payment_source_view")
            if alternate:
                rows = 0
                for descriptor in alternate["assets"]:
                    referenced.add(safe(root, descriptor["path"]))
                    max_asset_bytes = max(max_asset_bytes, descriptor["bytes"])
                    payload = asset(root, descriptor, "pbo-payment-source")
                    rows += len(payload["rows"])
                if rows != alternate["rows"] or rows != year["payments"]["rows"]:
                    raise ValueError(f"PBO alternate-view mismatch: {key}/{year['year']}")
                totals["pbo_payment_source_rows"] += rows
    if dict(totals) != EXPECTED:
        raise ValueError(f"Validated totals mismatch: {dict(totals)}")
    orphaned = files - referenced
    if orphaned:
        raise ValueError(f"Unreferenced output files: {sorted(str(path.relative_to(root)) for path in orphaned)[:5]}")
    if max_asset_bytes > 1_000_000:
        raise ValueError(f"Lazy-loaded asset exceeds 1 MB: {max_asset_bytes}")
    print(json.dumps({
        "status": "ok",
        "profiles": len(profile_keys),
        "generated_payment_ids": len(generated_ids),
        "record_counts": dict(totals),
        "referenced_files": len(referenced),
        "index_bytes": report["index_asset"]["bytes"],
        "index_uncompressed_bytes": report["index_asset"]["uncompressed_bytes"],
        "largest_lazy_asset_bytes": max_asset_bytes,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=WORKSPACE_ROOT / "outputs/cityvizor-explorer-2026-09-09/release")
    validate(parser.parse_args().root.resolve())
