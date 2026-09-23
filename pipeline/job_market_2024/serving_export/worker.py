#!/usr/bin/env python3
"""Export validated, already published job-market views to a versioned GCS object."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

PROJECT = "czbudget-janrezab"
PRIVATE_PREFIX = "gs://czbudget-janrezab-data-layers/processing-runs/job-market-serving-2024"
PUBLIC_PREFIX = "gs://czbudget-janrezab-public-snapshots/static-assets/job-market"
ACCOUNT = "psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com"
SERIES = {
    "employment_shares": ("current_employment_shares", 18, 6),
    "service_divisions": ("current_service_divisions", 270, 6),
    "ownership": ("current_ownership", 167, 4),
    "labour_status": ("current_labour_status", 30, 6),
    "national_public": ("current_national_public_employment", 8, 2),
}


def run(*args: str, timeout: int = 180) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed: {(result.stderr + result.stdout).strip()}")
    return result.stdout.strip()


def query(view: str) -> list[dict]:
    raw = run("bq", "--project_id=" + PROJECT, "--location=EU", "query",
              "--use_legacy_sql=false", "--format=json", "--max_rows=1000",
              f"SELECT * FROM `{PROJECT}.job_market.{view}` ORDER BY country_code")
    return json.loads(raw)


def immutable(path: Path, uri: str) -> None:
    existing = subprocess.run(["gcloud", "storage", "cat", uri], capture_output=True, timeout=60)
    if existing.returncode == 0:
        if hashlib.sha256(existing.stdout).digest() != hashlib.sha256(path.read_bytes()).digest():
            raise ValueError(f"Immutable object changed: {uri}")
        return
    run("gcloud", "storage", "cp", "--if-generation-match=0", str(path), uri)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-id", required=True)
    parser.add_argument("--loader-sha", required=True)
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    work = Path("/workspace/job-market-serving-2024")
    work.mkdir(parents=True, exist_ok=True)
    output = {"schema_version": "1.0.0", "period": 2024, "series": {}, "releases": {}}
    validation = {}
    for key, (view, expected_rows, expected_markets) in SERIES.items():
        rows = query(view)
        markets = {row["country_code"] for row in rows}
        release_ids = {row["release_id"] for row in rows}
        if len(rows) != expected_rows or len(markets) != expected_markets or len(release_ids) != 1:
            raise ValueError(f"Published view changed: {view}: {len(rows)} rows, {len(markets)} markets, {release_ids}")
        if any(str(row["period"]) != "2024" or not row.get("source_url", "").startswith("https://") for row in rows):
            raise ValueError(f"Source evidence missing from {view}")
        output["series"][key] = rows
        output["releases"][key] = release_ids.pop()
        validation[key] = {"rows": len(rows), "markets": sorted(markets)}
    payload = work / "job-market-2024.json"
    payload.write_text(json.dumps(output, separators=(",", ":"), sort_keys=True, ensure_ascii=False) + "\n")
    digest = hashlib.sha256(payload.read_bytes()).hexdigest()
    private_uri = f"{PRIVATE_PREFIX}/{args.build_id}/staging/job-market-2024.json"
    release_uri = f"{PUBLIC_PREFIX}/releases/{args.build_id}/job-market-2024.json"
    immutable(payload, private_uri)
    immutable(payload, release_uri)
    pointer_uri = f"{PUBLIC_PREFIX}/current.json"
    prior = subprocess.run(["gcloud", "storage", "objects", "describe", pointer_uri,
                            "--format=value(generation)"], capture_output=True, text=True, timeout=60)
    if prior.returncode and "not found" not in prior.stderr.lower():
        raise RuntimeError(prior.stderr.strip())
    generation = prior.stdout.strip() if prior.returncode == 0 else "0"
    pointer = {"schema_version": "1.0.0", "release_id": args.build_id,
               "bucket": "czbudget-janrezab-public-snapshots",
               "object": f"static-assets/job-market/releases/{args.build_id}/job-market-2024.json",
               "sha256": digest, "bytes": payload.stat().st_size,
               "published_at": datetime.now(timezone.utc).isoformat()}
    pointer_path = work / "current.json"
    pointer_path.write_text(json.dumps(pointer, sort_keys=True) + "\n")
    run("gcloud", "storage", "cp", "--if-generation-match=" + generation,
        str(pointer_path), pointer_uri)
    receipt = {"dataset_id": "job_market_serving_2024", "status": "published",
               "processing_status": "succeeded", "publication_status": "succeeded",
               "build_id": args.build_id, "loader_git_sha": args.loader_sha,
               "service_account": ACCOUNT, "region": "europe-west4",
               "started_at": started, "completed_at": datetime.now(timezone.utc).isoformat(),
               "received_rows": sum(item[1] for item in SERIES.values()),
               "accepted_rows": sum(item[1] for item in SERIES.values()),
               "rejected_rows": 0, "deduplicated_rows": 0,
               "warehouse_releases": output["releases"], "validation": validation,
               "staging_destination": private_uri, "staging_sha256": digest,
               "published_release_id": args.build_id, "destination": release_uri,
               "publication_pointer": pointer_uri, "publication_pointer_prior_generation": generation,
               "website_destinations": ["/api/v1/job-market/2024"]}
    completed = work / "completed.json"
    completed.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    immutable(completed, f"{PRIVATE_PREFIX}/{args.build_id}/completed.json")
    print(json.dumps({"release_id": args.build_id, "sha256": digest,
                      "rows": receipt["accepted_rows"], "pointer": pointer_uri}))


if __name__ == "__main__":
    main()
