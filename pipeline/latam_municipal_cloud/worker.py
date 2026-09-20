#!/usr/bin/env python3
"""Acquire, validate, publish and receipt LATAM major-city municipal data."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import zipfile

BUCKET = "gs://czbudget-janrezab-data-layers"
PREFIX = "processing-runs/latam-major-cities"


def run(*args):
    subprocess.run(args, check=True, timeout=1800)


def source(registry):
    rows = json.loads(Path(registry).read_text())["sources"]
    ready = [row for row in rows if row["status"] == "adapter_ready"]
    if len(ready) != 1:
        raise ValueError("Cloud job requires exactly one adapter-ready source")
    return ready[0]


def fetch_transform(registry, work, run_id):
    item = source(registry); work = Path(work); work.mkdir(parents=True, exist_ok=False)
    suffix = ".zip" if item.get("resource_urls") else Path(item["resource_url"].split("?", 1)[0]).suffix.lower()
    archive = work / ("source" + (suffix or ".bin"))
    if item.get("resource_urls"):
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for side, url in sorted(item["resource_urls"].items()):
                request = urllib.request.Request(url, headers={"User-Agent": item.get("user_agent", "PublicSpendingData/1.0")})
                with urllib.request.urlopen(request, timeout=300) as response:
                    bundle.writestr(side + ".csv", response.read())
    else:
        if item.get("tls_verify") is False:
            import requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry
            session = requests.Session()
            session.mount("https://", HTTPAdapter(max_retries=Retry(
                total=4, connect=4, read=2, backoff_factor=2,
                status_forcelist=(429, 500, 502, 503, 504),
                allowed_methods=frozenset(("GET",)),
            )))
            response = session.get(
                item["resource_url"],
                headers={"User-Agent": "PublicSpendingData/1.0"},
                timeout=(30, 300), verify=False,
            )
            response.raise_for_status(); archive.write_bytes(response.content)
        else:
            request = urllib.request.Request(item["resource_url"], headers={"User-Agent": item.get("user_agent", "PublicSpendingData/1.0")})
            with urllib.request.urlopen(request, timeout=300) as response, archive.open("wb") as output:
                while block := response.read(1024 * 1024): output.write(block)
    run("python3", "prepare_latam_major_city_budgets.py", "--source-id", item["id"], "--config", str(registry), "--archive", str(archive), "--output", str(work / "output"))
    manifest = json.loads((work / "output/manifest.json").read_text())
    expected = {"ar-buenos-aires-budget-execution-2025-q4": (140829, 45444), "uy-montevideo-budget-execution-2024": (33015, 21619), "ar-mendoza-budget-execution-2024-april": (187, 169), "ec-guayaquil-budget-execution-2025-october": (852, 195), "pa-panama-city-budget-execution-2025-december": (516, 146), "br-distrito-federal-siconfi-rreo-2025": (312, 638), "co-bogota-cuipo-2025": (42420, 15505), "co-four-major-cities-cuipo-2025": (56059, 21950), "cr-san-jose-budget-execution-2025-june": (855, 855), "br-sao-paulo-budget-execution-2025": (24604, 8070), "pe-lima-mef-budget-execution-2024": (38284, 18423), "br-rio-de-janeiro-budget-execution-2025": (35101, 14003)}[item["id"]]
    if (expected[0] is not None and manifest["facts"] != expected[0]) or (expected[1] is not None and manifest["rows_read"] != expected[1]):
        raise ValueError(f"Reviewed source counts changed: {manifest}")
    # The warehouse run key is build-specific while the source hash remains stable.
    facts = work / "output/municipal_budget_line_facts.jsonl"
    fact_rows = [json.loads(line) for line in facts.read_text().splitlines()]
    for row in fact_rows: row["ingestion_run_id"] = item["id"] + "-" + run_id
    facts.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in fact_rows))
    runs = work / "output/ingestion_runs.jsonl"
    run_rows = [json.loads(line) for line in runs.read_text().splitlines()]
    for row in run_rows: row["ingestion_run_id"] = item["id"] + "-" + run_id
    runs.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in run_rows))


def publish(registry, work, run_id):
    source(registry); work = Path(work); destination = f"{BUCKET}/{PREFIX}/{run_id}"
    archives = list(work.glob("source.*"))
    if len(archives) != 1:
        raise ValueError(f"Expected one acquired source file, found {archives}")
    run("gcloud", "storage", "cp", str(archives[0]), destination + "/source/" + archives[0].name, "--if-generation-match=0")
    run("gcloud", "storage", "cp", "--recursive", str(work / "output"), destination + "/validated")
    (work / "published.json").write_text(json.dumps({"status": "validated", "run_id": run_id, "uri": destination + "/validated"}) + "\n")


def complete(registry, work, run_id, warehouse_rows):
    item = source(registry); work = Path(work); destination = f"{BUCKET}/{PREFIX}/{run_id}"
    manifest = json.loads((work / "output/manifest.json").read_text())
    if int(warehouse_rows) == 0:
        query = ("SELECT COUNT(*) FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` "
                 f"WHERE fiscal_year={int(item['year'])} AND ingestion_run_id='{item['id']}-{run_id}'")
        output = subprocess.check_output(["bq","query","--project_id=czbudget-janrezab","--use_legacy_sql=false","--format=csv","--quiet",query], text=True, timeout=300)
        warehouse_rows = output.strip().splitlines()[-1]
    if int(warehouse_rows) != manifest["facts"]:
        raise ValueError(f"Warehouse count {warehouse_rows} != validated facts {manifest['facts']}")
    replacement = manifest.get("replacement")
    replaced_rows = 0
    if replacement:
        entity = replacement["public_entity_id"]
        year = int(replacement["fiscal_year"])
        source_id = replacement["source_id"]
        expected_rows = int(replacement["expected_rows"])
        count_query = ("SELECT COUNT(*) FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` "
                       f"WHERE fiscal_year={year} AND public_entity_id='{entity}' AND source_id='{source_id}'")
        count_output = subprocess.check_output(["bq","query","--project_id=czbudget-janrezab","--use_legacy_sql=false","--format=csv","--quiet",count_query], text=True, timeout=300)
        replaced_rows = int(count_output.strip().splitlines()[-1])
        if replaced_rows != expected_rows:
            raise ValueError(f"Replacement guard expected {expected_rows} old rows, found {replaced_rows}")
        delete_query = ("DELETE FROM `czbudget-janrezab.budget_detail.municipal_budget_line_facts` "
                        f"WHERE fiscal_year={year} AND public_entity_id='{entity}' AND source_id='{source_id}'")
        subprocess.run(["bq","query","--project_id=czbudget-janrezab","--use_legacy_sql=false","--quiet",delete_query], check=True, timeout=300)
    marker = {"status": "complete", "run_id": run_id, "source_id": item["id"], "source_sha256": manifest["source_sha256"],
              "source_rows": manifest["rows_read"], "warehouse_table": "czbudget-janrezab.budget_detail.municipal_budget_line_facts",
              "warehouse_rows": int(warehouse_rows), "replaced_rows": replaced_rows, "fiscal_boundary": item["fiscal_boundary"]}
    path = work / "completed.json"; path.write_text(json.dumps(marker, indent=2) + "\n")
    run("gcloud", "storage", "cp", str(path), destination + "/completed.json", "--if-generation-match=0")
    print(json.dumps(marker))


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("stage", choices=["fetch-transform", "publish", "complete"])
    parser.add_argument("--registry", required=True); parser.add_argument("--work", required=True); parser.add_argument("--run-id", required=True)
    parser.add_argument("--warehouse-rows", default="0"); args = parser.parse_args()
    if args.stage == "fetch-transform": fetch_transform(args.registry, args.work, args.run_id)
    elif args.stage == "publish": publish(args.registry, args.work, args.run_id)
    else: complete(args.registry, args.work, args.run_id, args.warehouse_rows)


if __name__ == "__main__": main()
