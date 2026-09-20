#!/usr/bin/env python3
"""Validate and load the Czech NRHZS provider-procedure distribution in Cloud Build."""
from __future__ import annotations

import csv
import datetime as dt
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import urllib.request


PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
SOURCE_ID = "CZE_UZIS_NRHZS_NR_04_02"
SOURCE_URL = (
    "https://datanzis.uzis.gov.cz/data/NR-04-NRHZS/NR-04-02/"
    "Otevrena-data-NR-04-02-vykony-ico.csv.gz"
)
LANDING_URL = (
    "https://www.nzip.cz/data/1745-vykony-zdravotni-pece-verejne-zdravotni-"
    "pojisteni-poskytovatel-zdravotnich-sluzeb-otevrena-data"
)
EXPECTED_HEADER = (
    "rok", "ICO", "kod", "diagnoza", "mnozstvi", "pocet_pacientu", "pocet_kontaktu"
)
BUCKET = "gs://czbudget-janrezab-data-layers"
HERE = Path(__file__).resolve().parent


def run(command: list[str], *, input_text: str | None = None) -> str:
    completed = subprocess.run(
        command,
        input=input_text,
        text=True,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if completed.stdout:
        print(completed.stdout, end="", flush=True)
    return completed.stdout


def bq_query(sql: str) -> list[dict]:
    output = subprocess.check_output(
        [
            "bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false",
            "--format=json", "--quiet", sql,
        ],
        text=True,
    )
    return json.loads(output or "[]")


def download(destination: Path) -> dict:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "PublicSpendingData/1.0"})
    digest = hashlib.sha256()
    retrieved_at = dt.datetime.now(dt.timezone.utc)
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as target:
        headers = dict(response.headers.items())
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            target.write(chunk)
    return {
        "retrieved_at": retrieved_at.isoformat(),
        "sha256": digest.hexdigest(),
        "bytes": destination.stat().st_size,
        "etag": headers.get("ETag"),
        "last_modified": headers.get("Last-Modified"),
        "content_length": headers.get("Content-Length"),
    }


def nonnegative_int(value: str, field: str, row_number: int) -> int:
    parsed = int(value)
    if parsed < 0:
        raise ValueError(f"negative {field} on row {row_number}")
    return parsed


def validate(
    path: Path,
    *,
    minimum_rows: int = 1_000_000,
    expected_first_year: int = 2019,
    minimum_last_year: int = 2024,
) -> dict:
    rows = 0
    years: dict[int, int] = {}
    providers: set[str] = set()
    procedures: set[str] = set()
    diagnoses: set[str] = set()
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if tuple(reader.fieldnames or ()) != EXPECTED_HEADER:
            raise ValueError(f"unexpected source header: {reader.fieldnames!r}")
        for row_number, row in enumerate(reader, 2):
            year = int(row["rok"])
            if not 2010 <= year <= dt.datetime.now().year:
                raise ValueError(f"invalid year {year} on row {row_number}")
            ico = row["ICO"].strip()
            if not ico.isdigit() or not 1 <= len(ico) <= 8:
                raise ValueError(f"invalid IČO {ico!r} on row {row_number}")
            procedure = row["kod"].strip()
            if not procedure:
                raise ValueError(f"empty procedure code on row {row_number}")
            quantity = float(row["mnozstvi"])
            patients = nonnegative_int(row["pocet_pacientu"], "patient count", row_number)
            contacts = nonnegative_int(row["pocet_kontaktu"], "contact count", row_number)
            if not math.isfinite(quantity) or quantity < 0:
                raise ValueError(f"invalid procedure quantity on row {row_number}")
            if patients > contacts:
                raise ValueError(f"patients exceed contacts on row {row_number}")
            rows += 1
            years[year] = years.get(year, 0) + 1
            providers.add(ico.zfill(8))
            procedures.add(procedure)
            if row["diagnoza"].strip():
                diagnoses.add(row["diagnoza"].strip())
            if rows % 5_000_000 == 0:
                print(f"validated {rows:,} rows", flush=True)
    if rows < minimum_rows:
        raise ValueError(f"implausibly small source: {rows} rows")
    if min(years) != expected_first_year or max(years) < minimum_last_year:
        raise ValueError(f"unexpected year coverage: {sorted(years)}")
    return {
        "rows": rows,
        "years": {str(key): value for key, value in sorted(years.items())},
        "first_year": min(years),
        "last_year": max(years),
        "provider_count": len(providers),
        "procedure_count": len(procedures),
        "diagnosis_count": len(diagnoses),
        "header": list(EXPECTED_HEADER),
    }


def upload(path: Path, uri: str) -> None:
    run(["gcloud", "storage", "cp", "--no-clobber", str(path), uri])


def sql_string(value: object) -> str:
    """Return a BigQuery Standard SQL string literal."""
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def main() -> None:
    build_id = os.environ.get("BUILD_ID")
    if not build_id:
        raise RuntimeError("Cloud Build only: bulk NRHZS data must not be downloaded locally")
    run_id = build_id
    safe_id = "nrhzs_" + "".join(character if character.isalnum() else "_" for character in build_id)
    prefix = f"{BUCKET}/processing-runs/czech-health-procedures/{build_id}"
    raw_uri = f"{prefix}/raw/Otevrena-data-NR-04-02-vykony-ico.csv.gz"
    local_source = Path("/workspace/nrhzs-provider-procedures.csv.gz")

    source = download(local_source)
    if source["content_length"] and int(source["content_length"]) != source["bytes"]:
        raise ValueError("downloaded byte count does not match Content-Length")
    coverage = validate(local_source)
    source_vintage = source["last_modified"] or source["etag"] or source["sha256"]
    receipt = {
        "schema_version": "1.0.0",
        "source_id": SOURCE_ID,
        "source_url": SOURCE_URL,
        "landing_url": LANDING_URL,
        "license": "CC BY 4.0",
        "source": source,
        "coverage": coverage,
        "definitions": {
            "grain": "year × provider IČO × procedure code × three-character main diagnosis",
            "procedure_quantity": "Reported procedure quantity, not a cash payment.",
            "unique_patients": "Unique only within a source row; never additive across rows.",
            "scope": "Public-health-insurance reported services; excludes self-pay, supplementary insurance and services not reported as individual procedures.",
        },
    }
    Path("validation.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    upload(local_source, raw_uri)
    raw_generation = run([
        "gcloud", "storage", "objects", "describe", raw_uri,
        "--format=value(generation)",
    ]).strip()
    if not raw_generation:
        raise ValueError("raw object generation was not returned")
    upload(Path("validation.json"), f"{prefix}/validation.json")

    schema_sql = (HERE / "schema.sql").read_text()
    run(["bq", "--project_id=" + PROJECT, "query", "--use_legacy_sql=false", "--quiet"], input_text=schema_sql)
    staging = f"{PROJECT}:{DATASET}.{safe_id}"
    staging_schema = (
        "rok:INTEGER,ICO:STRING,kod:STRING,diagnoza:STRING,mnozstvi:FLOAT,"
        "pocet_pacientu:INTEGER,pocet_kontaktu:INTEGER"
    )
    run([
        "bq", "--project_id=" + PROJECT, "load", "--replace", "--quiet",
        "--source_format=CSV", "--skip_leading_rows=1", "--encoding=UTF-8",
        staging, raw_uri, staging_schema,
    ])
    run(["bq", "--project_id=" + PROJECT, "update", "--expiration", "86400", staging])

    staging_ref = f"`{PROJECT}.{DATASET}.{safe_id}`"
    checks = bq_query(f"""
      SELECT
        COUNT(*) AS row_count,
        COUNT(DISTINCT LPAD(ICO, 8, '0')) AS provider_count,
        MIN(rok) AS first_year,
        MAX(rok) AS last_year,
        COUNTIF(rok IS NULL OR ICO IS NULL OR kod IS NULL OR mnozstvi IS NULL
                OR pocet_pacientu IS NULL OR pocet_kontaktu IS NULL) AS null_required
      FROM {staging_ref}
    """)[0]
    if int(checks["row_count"]) != coverage["rows"]:
        raise ValueError(f"BigQuery/source row mismatch: {checks['row_count']} != {coverage['rows']}")
    if int(checks["provider_count"]) != coverage["provider_count"] or int(checks["null_required"]):
        raise ValueError(f"BigQuery validation failed: {checks}")
    duplicates = bq_query(f"""
      SELECT COUNT(*) AS duplicate_groups FROM (
        SELECT rok, LPAD(ICO, 8, '0') AS provider_ico, kod, NULLIF(diagnoza, '') AS diagnosis_code
        FROM {staging_ref}
        GROUP BY rok, provider_ico, kod, diagnosis_code
        HAVING COUNT(*) > 1
      )
    """)[0]
    if int(duplicates["duplicate_groups"]):
        raise ValueError(f"duplicate source keys: {duplicates['duplicate_groups']}")

    retrieved_at = source["retrieved_at"]
    source_id_sql = sql_string(SOURCE_ID)
    source_url_sql = sql_string(SOURCE_URL)
    source_hash_sql = sql_string(source["sha256"])
    source_vintage_sql = sql_string(source_vintage)
    run_id_sql = sql_string(run_id)
    raw_uri_sql = sql_string(raw_uri)
    raw_generation_sql = sql_string(raw_generation)
    transaction = f"""
    BEGIN TRANSACTION;
    DELETE FROM `{PROJECT}.{DATASET}.czech_healthcare_procedure_observations`
      WHERE year BETWEEN 2010 AND 2030 AND source_id = {source_id_sql};
    INSERT INTO `{PROJECT}.{DATASET}.czech_healthcare_procedure_observations`
    SELECT
      rok,
      LPAD(ICO, 8, '0'),
      kod,
      NULLIF(diagnoza, ''),
      mnozstvi,
      pocet_pacientu,
      pocet_kontaktu,
      {source_id_sql},
      {source_url_sql},
      {source_hash_sql},
      {source_vintage_sql},
      {run_id_sql},
      TIMESTAMP('{retrieved_at}'),
      CURRENT_TIMESTAMP()
    FROM {staging_ref};
    INSERT INTO `{PROJECT}.{DATASET}.czech_healthcare_procedure_ingestion_runs`
    VALUES (
      {run_id_sql}, {source_id_sql}, {source_url_sql}, {source_hash_sql},
      {source_vintage_sql}, {source['bytes']}, {coverage['rows']},
      {coverage['first_year']}, {coverage['last_year']}, {coverage['provider_count']},
      TIMESTAMP('{retrieved_at}'), CURRENT_TIMESTAMP(), {raw_uri_sql}, {raw_generation_sql}
    );
    COMMIT TRANSACTION;
    """
    bq_query(transaction)
    final = bq_query(f"""
      SELECT COUNT(*) AS row_count, COUNT(DISTINCT provider_ico) AS provider_count,
             MIN(year) AS first_year, MAX(year) AS last_year
      FROM `{PROJECT}.{DATASET}.czech_healthcare_procedure_observations`
      WHERE year BETWEEN {coverage['first_year']} AND {coverage['last_year']}
        AND source_id = {source_id_sql}
    """)[0]
    if int(final["row_count"]) != coverage["rows"] or int(final["provider_count"]) != coverage["provider_count"]:
        raise ValueError(f"promoted table failed reconciliation: {final}")

    run(["bq", "--project_id=" + PROJECT, "rm", "-f", "-t", staging])
    completion = {
        "status": "complete",
        "ingestion_run_id": run_id,
        "source_sha256": source["sha256"],
        "raw_object_uri": raw_uri,
        "raw_object_generation": raw_generation,
        "table": f"{PROJECT}.{DATASET}.czech_healthcare_procedure_observations",
        "coverage": coverage,
        "warehouse": final,
    }
    Path("completed.json").write_text(json.dumps(completion, ensure_ascii=False, indent=2) + "\n")
    upload(Path("completed.json"), f"{prefix}/completed.json")
    print(json.dumps(completion, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
