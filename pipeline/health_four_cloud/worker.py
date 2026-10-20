#!/usr/bin/env python3
"""Preserve and audit health source responses for four deferred dashboards."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
import base64
import hashlib
from io import StringIO
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from google.cloud import storage
from openpyxl import load_workbook


PROJECT = "czbudget-janrezab"
REGION = "europe-west4"
ACCOUNT = f"psd-data-builder@{PROJECT}.iam.gserviceaccount.com"
BUCKET = f"{PROJECT}-data-layers"
DATASET = "health-four-source-coverage"
WHO_URL = "https://apps.who.int/nha/database/Home/IndicatorsDownload/en"
SHA = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD,DSD_SHA@DF_SHA,1.1"
BEDS = "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD,DSD_HEALTH_REAC_HOSP@DF_BEDS_FUNC,1.1"
COUNTRIES = {"UKR": "Ukraine", "BRA": "Brazil", "JPN": "Japan", "NOR": "Norway"}
KEYS = {
    "public_compulsory": "EXP_HEALTH.PT_EXP_HLTH.HF1._Z._T._T._T._Z._Z._Z",
    "out_of_pocket": "EXP_HEALTH.PT_EXP_HLTH.HF3._Z._T._T._T._Z._Z._Z",
    "hospitals": "EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP1._Z._Z._Z",
    "residential_ltc": "EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP2._Z._Z._Z",
    "ambulatory": "EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP3._Z._Z._Z",
    "retailers": "EXP_HEALTH.PT_EXP_HLTH._T._Z._T._T.HP5._Z._Z._Z",
    "health_gdp_pct": "EXP_HEALTH.PT_B1GQ._T._Z._T._T._T._Z._Z._Z",
    "per_capita_ppp": "EXP_HEALTH.USD_PPP_PS._T._Z._T._T._T._Z._Z.Q",
    "per_capita_local": "EXP_HEALTH.XDC_PS._T._Z._T._T._T._Z._Z.V",
}


def utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, accept: str) -> bytes:
    for attempt in range(4):
        try:
            request = Request(url, headers={"Accept": accept, "User-Agent": "PublicSpendingData/1.0"})
            with urlopen(request, timeout=120) as response:
                if response.status != 200:
                    raise ValueError(f"source returned HTTP {response.status}: {url}")
                payload = response.read()
                if not payload:
                    raise ValueError(f"empty source response: {url}")
                return payload
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 3 or isinstance(error, HTTPError) and error.code in (400, 401, 403, 404):
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def parse_oecd(data: bytes, code: str, key: str) -> tuple[dict, dict]:
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))
    required = {"REF_AREA", "TIME_PERIOD", "OBS_VALUE"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError(f"OECD schema changed for {code}/{key}: {reader.fieldnames}")
    received = accepted = rejected = duplicates = 0
    observations = {}
    for row in reader:
        received += 1
        if row["REF_AREA"] != code:
            rejected += 1
            continue
        try:
            year = int(row["TIME_PERIOD"])
            value = float(row["OBS_VALUE"])
        except (TypeError, ValueError):
            rejected += 1
            continue
        if not 2022 <= year <= 2024:
            rejected += 1
            continue
        if year in observations:
            duplicates += 1
            continue
        accepted += 1
        observations[year] = {"year": year, "value": value, "status": row.get("OBS_STATUS") or None}
    return ({"source_rows": received, "accepted_rows": accepted, "rejected_rows": rejected, "deduplicated_rows": duplicates},
            {"metric": key, "country_code": code, "observations": [observations[year] for year in sorted(observations)]})


def inspect_who(path: Path) -> dict:
    workbook = load_workbook(path, read_only=True, data_only=True)
    counts = {code: 0 for code in COUNTRIES}
    locations = {code: [] for code in COUNTRIES}
    sheet_names = list(workbook.sheetnames)
    for sheet in workbook:
        for row_number, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            values = {str(value).strip().casefold() for value in row[:8] if value is not None}
            for code, name in COUNTRIES.items():
                if code.casefold() in values or name.casefold() in values:
                    counts[code] += 1
                    if len(locations[code]) < 5:
                        locations[code].append({"sheet": sheet.title, "row": row_number})
    workbook.close()
    return {"sheets": sheet_names, "country_row_counts": counts, "country_row_samples": locations}


def upload_immutable(bucket, name: str, content: bytes, content_type: str) -> dict:
    blob = bucket.blob(name)
    existing = bucket.get_blob(name)
    if existing:
        expected_md5 = base64.b64encode(hashlib.md5(content).digest()).decode()
        if existing.md5_hash and existing.md5_hash != expected_md5:
            raise ValueError(f"immutable object differs: {name}")
        if not existing.md5_hash and digest(existing.download_as_bytes()) != digest(content):
            raise ValueError(f"immutable object differs: {name}")
        return {"name": name, "generation": int(existing.generation), "sha256": digest(content)}
    blob.upload_from_string(content, content_type=content_type, if_generation_match=0)
    return {"name": name, "generation": int(blob.generation), "sha256": digest(content)}


def main() -> None:
    started = utc()
    build_id = os.environ["BUILD_ID"]
    loader_sha = os.environ["LOADER_SHA"]
    raw_prefix = f"processing-runs/{DATASET}/{build_id}/raw/"
    staging_prefix = f"processing-runs/{DATASET}/{build_id}/staging/"
    release_id = f"{DATASET}-{build_id}"
    pointer_name = f"{DATASET}/current.json"
    output = Path("out")
    output.mkdir(exist_ok=True)
    raw_files = {}
    source_rows = {}
    candidates = {code: {} for code in COUNTRIES}
    who_bytes = fetch(WHO_URL, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    who_path = output / "who-ghed.xlsx"
    who_path.write_bytes(who_bytes)
    who_audit = inspect_who(who_path)
    raw_files["who-ghed.xlsx"] = {"url": WHO_URL, "bytes": who_bytes}
    for code in ("BRA", "JPN", "NOR"):
        for key, suffix in KEYS.items():
            url = f"{SHA}/{code}.A.{suffix}?startPeriod=2022&endPeriod=2024"
            payload = fetch(url, "text/csv")
            counts, candidate = parse_oecd(payload, code, key)
            raw_files[f"{code.lower()}-{key}.csv"] = {"url": url, "bytes": payload}
            source_rows[f"{code}/{key}"] = counts
            candidates[code][key] = candidate
        url = f"{BEDS}/{code}..10P3HB...._T..?startPeriod=2022&endPeriod=2024"
        payload = fetch(url, "text/csv")
        counts, candidate = parse_oecd(payload, code, "beds_per_1000")
        raw_files[f"{code.lower()}-beds.csv"] = {"url": url, "bytes": payload}
        source_rows[f"{code}/beds_per_1000"] = counts
        candidates[code]["beds_per_1000"] = candidate
    if not who_audit["sheets"] or not who_audit["country_row_counts"]["UKR"]:
        raise ValueError("WHO workbook did not expose identifiable Ukraine rows; publication aborted")
    for code in ("BRA", "JPN", "NOR"):
        if not any(candidate["observations"] for candidate in candidates[code].values()):
            raise ValueError(f"No numeric OECD health observation for {code}; publication aborted")
    coverage = {
        "dataset": DATASET,
        "country_codes": list(COUNTRIES),
        "source_rows": source_rows,
        "who_workbook": who_audit,
        "candidate_metric_counts": {code: sum(bool(item["observations"]) for item in metrics.values()) for code, metrics in candidates.items()},
        "interpretation": "Source snapshot and candidate observations only. Missing provider or financing dimensions remain unavailable until a separate reviewed profile release.",
    }
    client = storage.Client(project=PROJECT)
    bucket = client.bucket(BUCKET)
    sources = []
    for name, item in raw_files.items():
        item_bytes = item["bytes"]
        uploaded = upload_immutable(bucket, raw_prefix + name, item_bytes, "application/octet-stream")
        sources.append({"url": item["url"], "sha256": uploaded["sha256"], "bytes": len(item_bytes), "object": uploaded["name"], "generation": uploaded["generation"]})
    artifacts = {}
    for name, value in {"candidates.json": candidates, "coverage.json": coverage}.items():
        encoded = (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()
        artifacts[name] = upload_immutable(bucket, staging_prefix + name, encoded, "application/json")
    receipt = {
        "dataset": DATASET, "processing_status": "validated", "publication_status": "ready_to_publish",
        "build_id": build_id, "loader_git_sha": loader_sha, "service_account": ACCOUNT, "region": REGION,
        "started_at": started, "completed_at": utc(), "source_objects": sources,
        "source_totals": {"responses": len(sources), "bytes": sum(source["bytes"] for source in sources)},
        "normalized_totals": {"country_count": len(COUNTRIES), "candidate_metrics": sum(coverage["candidate_metric_counts"].values())},
        "row_counts": {"received": sum(row["source_rows"] for row in source_rows.values()), "accepted": sum(row["accepted_rows"] for row in source_rows.values()), "rejected": sum(row["rejected_rows"] for row in source_rows.values()), "deduplicated": sum(row["deduplicated_rows"] for row in source_rows.values())},
        "coverage": coverage, "validation": {"raw_hashes": "verified", "oecd_schema": "verified", "who_xlsx": "verified", "ukraine_presence": "verified"},
        "published_release_id": release_id, "staging_objects": artifacts,
        "publication_pointer": f"gs://{BUCKET}/{pointer_name}", "website_destinations": [],
    }
    completed = (json.dumps(receipt, indent=2, sort_keys=True) + "\n").encode()
    completed_blob = upload_immutable(bucket, f"processing-runs/{DATASET}/{build_id}/completed.json", completed, "application/json")
    pointer = bucket.get_blob(pointer_name)
    pointer_content = {"release_id": release_id, "completed": completed_blob["name"], "completed_sha256": completed_blob["sha256"]}
    if pointer and json.loads(pointer.download_as_text()) == pointer_content:
        new_pointer = pointer
    else:
        previous_generation = int(pointer.generation) if pointer else 0
        new_pointer = bucket.blob(pointer_name)
        new_pointer.upload_from_string(json.dumps(pointer_content) + "\n", content_type="application/json", if_generation_match=previous_generation)
    publication = {
        "dataset": DATASET, "build_id": build_id, "release_id": release_id,
        "processing_status": "validated", "publication_status": "published",
        "pointer": f"gs://{BUCKET}/{pointer_name}", "pointer_generation": int(new_pointer.generation),
        "completed_sha256": completed_blob["sha256"], "published_at": utc(), "website_destinations": [],
    }
    upload_immutable(bucket, f"processing-runs/{DATASET}/{build_id}/published.json", (json.dumps(publication, indent=2, sort_keys=True) + "\n").encode(), "application/json")
    print(json.dumps({"build_id": build_id, "release_id": release_id, "pointer_generation": int(new_pointer.generation), "candidate_metrics": receipt["normalized_totals"]["candidate_metrics"]}))


if __name__ == "__main__":
    main()
