#!/usr/bin/env python3
"""Transform a pinned UN Comtrade checkpoint in Cloud Build and load BigQuery.

The crawler owns its SQLite checkpoint. This worker never mutates or republishes
that checkpoint: it pins one immutable version, reads archived responses
individually, and records successful task/hash pairs in BigQuery only after an
atomic, validated warehouse transaction succeeds.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import threading
import time
from typing import Any, Iterable
import urllib.error
import urllib.parse
import urllib.request

import crawl_un_comtrade as crawler
import prepare_un_comtrade_warehouse as prepare


REPO = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO / "pipeline/config/un_comtrade_source.v1.json"
SCHEMA_PATH = REPO / "pipeline/warehouse/un_comtrade_schema.sql"
PROJECT = "czbudget-janrezab"
DATASET = "budget_detail"
RESULTS_BUCKET = "gs://czbudget-janrezab-data-layers"
RESULTS_PREFIX = "processing-runs/un-comtrade"

OBSERVATION_COLUMNS = (
    "trade_observation_id", "period_start", "period_end", "period", "ref_year", "ref_month",
    "frequency", "product_type", "reporter_area_code", "reporter_iso3", "reporter_name",
    "flow_code", "flow_name", "partner_area_code", "partner_iso3", "partner_name",
    "partner2_area_code", "partner2_iso3", "partner2_name", "classification_code",
    "classification_search_code", "is_original_classification", "product_code", "product_name",
    "aggregation_level", "is_leaf", "customs_code", "customs_name", "mode_of_transport_code",
    "mode_of_transport_name", "quantity_unit_code", "quantity_unit_abbr", "quantity",
    "quantity_is_estimated", "alternate_quantity_unit_code", "alternate_quantity_unit_abbr",
    "alternate_quantity", "alternate_quantity_is_estimated", "net_weight_kg",
    "net_weight_is_estimated", "gross_weight_kg", "gross_weight_is_estimated", "cif_value_usd",
    "fob_value_usd", "primary_value_usd", "legacy_estimation_flag", "is_reported",
    "is_aggregate", "source_dataset_code", "source_dataset_checksum", "source_last_released",
    "source_response_sha256", "crawl_task_id", "ingestion_run_id", "retrieved_at", "loaded_at",
)
COVERAGE_COLUMNS = (
    "coverage_id", "period_start", "period", "frequency", "product_type", "reporter_area_code",
    "reporter_iso3", "classification_code", "source_dataset_code", "source_dataset_checksum",
    "source_total_records", "source_first_released", "source_last_released", "crawl_status",
    "queued_task_count", "completed_task_count", "no_data_task_count", "split_task_count",
    "error_task_count", "loaded_row_count", "assessed_at", "loaded_at",
)
RUN_COLUMNS = (
    "ingestion_run_id", "started_at", "completed_at", "status", "source_id", "source_vintage",
    "queue_database_sha256", "raw_response_count", "rows_read", "rows_loaded", "warning_count",
    "error_count", "loaded_at",
)
RESPONSE_COLUMNS = (
    "crawl_task_id", "source_response_sha256", "period_start", "period", "frequency",
    "product_type", "reporter_area_code", "reporter_iso3", "classification_code",
    "source_record_count", "normalized_row_count", "source_status", "checkpoint_archive_id",
    "ingestion_run_id", "loaded_at",
)
AREA_COLUMNS = (
    "area_code", "iso2", "iso3", "name", "note", "is_group", "is_reporter", "is_partner",
    "effective_from", "effective_to", "loaded_at",
)
PRODUCT_COLUMNS = (
    "product_type", "classification_code", "product_code", "product_name", "parent_product_code",
    "aggregation_level", "is_leaf", "standard_unit_abbr", "source_url", "loaded_at",
)


def now_iso() -> str:
    return prepare.now_iso()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(command: list[str], *, input_text: str | None = None, timeout: int = 14400) -> str:
    result = subprocess.run(
        command,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    if result.returncode:
        detail = (result.stderr + "\n" + result.stdout)[-8000:]
        raise RuntimeError(
            f"Command failed ({command[0]} {command[1] if len(command) > 1 else ''}): "
            f"{detail}"
        )
    return result.stdout


class Cloud:
    """Small authenticated Cloud Storage JSON API client for Cloud Build."""

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = threading.Lock()

    @staticmethod
    def split_uri(uri: str) -> tuple[str, str]:
        parsed = urllib.parse.urlsplit(uri)
        if parsed.scheme != "gs" or not parsed.netloc or not parsed.path.lstrip("/"):
            raise ValueError(f"Invalid Cloud Storage URI: {uri}")
        return parsed.netloc, parsed.path.lstrip("/")

    def _access_token(self) -> str:
        with self._token_lock:
            if self._token and time.monotonic() < self._token_expires_at:
                return self._token
            request = urllib.request.Request(
                "http://metadata.google.internal/computeMetadata/v1/instance/"
                "service-accounts/default/token",
                headers={"Metadata-Flavor": "Google"},
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read())
            self._token = payload["access_token"]
            self._token_expires_at = time.monotonic() + max(1, int(payload.get("expires_in", 300)) - 60)
            return self._token

    def _open(self, request: urllib.request.Request, *, retry_auth: bool = True) -> bytes:
        request.add_header("Authorization", f"Bearer {self._access_token()}")
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 401 and retry_auth:
                with self._token_lock:
                    self._token = None
                    self._token_expires_at = 0.0
                request.remove_header("Authorization")
                return self._open(request, retry_auth=False)
            raise

    def get(self, uri: str) -> bytes:
        bucket, name = self.split_uri(uri)
        url = (
            "https://storage.googleapis.com/download/storage/v1/b/"
            f"{urllib.parse.quote(bucket, safe='')}/o/{urllib.parse.quote(name, safe='')}?alt=media"
        )
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                return self._open(urllib.request.Request(url, method="GET"))
            except (OSError, urllib.error.HTTPError) as exc:
                last_error = exc
                if isinstance(exc, urllib.error.HTTPError) and exc.code not in {429, 500, 502, 503, 504}:
                    raise
                time.sleep(2**attempt)
        raise RuntimeError(f"Cloud Storage download failed: {uri}") from last_error

    def metadata(self, uri: str) -> dict[str, Any]:
        bucket, name = self.split_uri(uri)
        url = (
            "https://storage.googleapis.com/storage/v1/b/"
            f"{urllib.parse.quote(bucket, safe='')}/o/{urllib.parse.quote(name, safe='')}"
        )
        return json.loads(self._open(urllib.request.Request(url, method="GET")))

    def put(self, uri: str, data: bytes, *, immutable: bool = True) -> dict[str, Any]:
        bucket, name = self.split_uri(uri)
        query = {"uploadType": "media", "name": name}
        if immutable:
            query["ifGenerationMatch"] = "0"
        url = (
            "https://storage.googleapis.com/upload/storage/v1/b/"
            f"{urllib.parse.quote(bucket, safe='')}/o?{urllib.parse.urlencode(query)}"
        )
        request = urllib.request.Request(
            url,
            data=data,
            method="POST",
            headers={"Content-Type": "application/octet-stream"},
        )
        try:
            metadata = json.loads(self._open(request))
        except urllib.error.HTTPError as exc:
            if not immutable or exc.code != 412:
                raise
            metadata = self.metadata(uri)
        expected_md5 = base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode("ascii")
        if (
            int(metadata.get("size", -1)) != len(data)
            or metadata.get("md5Hash") != expected_md5
            or not metadata.get("generation")
        ):
            raise RuntimeError(f"Cloud Storage verification failed: {uri}")
        return {
            "uri": uri,
            "bytes": len(data),
            "sha256": sha256_bytes(data),
            "md5_hash": expected_md5,
            "generation": metadata["generation"],
        }


def bq_query(sql: str, *, json_output: bool = False, timeout: int = 14400) -> Any:
    command = [
        "bq", "query", f"--project_id={PROJECT}", "--use_legacy_sql=false", "--quiet",
    ]
    if json_output:
        command.append("--format=json")
    output = run(command, input_text=sql, timeout=timeout)
    return json.loads(output or "[]") if json_output else output


def bq_load(table: str, uri: str | list[str]) -> None:
    source = ",".join(uri) if isinstance(uri, list) else uri
    run([
        "bq", "load", f"--project_id={PROJECT}", "--source_format=NEWLINE_DELIMITED_JSON",
        f"{DATASET}.{table}", source,
    ])


def bq_remove(table: str) -> None:
    run(["bq", "rm", f"--project_id={PROJECT}", "--force", "--table", f"{DATASET}.{table}"])


def create_stage(table: str, target: str) -> None:
    bq_query(f"""
CREATE OR REPLACE TABLE `{PROJECT}.{DATASET}.{table}`
LIKE `{PROJECT}.{DATASET}.{target}`;
ALTER TABLE `{PROJECT}.{DATASET}.{table}`
SET OPTIONS (expiration_timestamp = TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 2 DAY));
""")


def load_schema() -> None:
    bq_query(SCHEMA_PATH.read_text(encoding="utf-8"))


def bootstrap_legacy_response_ledger() -> None:
    bq_query(f"""
DECLARE existing_ledger_rows INT64 DEFAULT (
  SELECT COUNT(*)
  FROM `{PROJECT}.{DATASET}.trade_source_responses`
  WHERE period_start BETWEEN DATE '1900-01-01' AND CURRENT_DATE()
);
IF existing_ledger_rows = 0 THEN
  INSERT INTO `{PROJECT}.{DATASET}.trade_source_responses` (
    {', '.join(RESPONSE_COLUMNS)}
  )
  SELECT
    crawl_task_id,
    source_response_sha256,
    period_start,
    ANY_VALUE(period),
    ANY_VALUE(frequency),
    ANY_VALUE(product_type),
    ANY_VALUE(reporter_area_code),
    ANY_VALUE(reporter_iso3),
    ANY_VALUE(classification_code),
    COUNT(*),
    COUNT(*),
    'completed',
    'legacy-bq-bootstrap',
    'legacy-bq-bootstrap',
    MAX(loaded_at)
  FROM `{PROJECT}.{DATASET}.trade_observations`
  WHERE period_start BETWEEN DATE '1900-01-01' AND CURRENT_DATE()
  GROUP BY crawl_task_id, source_response_sha256, period_start;
END IF;
""")


def restore_controls(cloud: Cloud, temporary: Path, config: dict[str, Any]) -> tuple[dict[str, Any], Path, Path]:
    archive = config["warehouse_crawl"]["archive"]
    bucket = archive["bucket_uri"].rstrip("/")
    manifest_uri = f"{bucket}/{archive['manifest_prefix'].strip('/')}/latest.json"
    manifest = json.loads(cloud.get(manifest_uri))
    checkpoint_uri = manifest["checkpoint"]["uri"]
    checkpoint = cloud.get(checkpoint_uri)
    if sha256_bytes(checkpoint) != manifest["checkpoint"]["sha256"]:
        raise RuntimeError("Pinned crawler checkpoint checksum mismatch")
    state = temporary / "crawl.sqlite3"
    state.write_bytes(checkpoint)
    references = temporary / "reference"
    references.mkdir()
    for path in crawler.reference_paths(references).values():
        data = cloud.get(f"{bucket}/{archive['reference_prefix'].strip('/')}/{path.name}")
        if not isinstance(json.loads(data), dict):
            raise RuntimeError(f"Invalid reference payload: {path.name}")
        path.write_bytes(data)
    return manifest, state, references


def upload_jsonl(cloud: Cloud, uri: str, rows: Iterable[dict[str, Any]], temporary: Path) -> tuple[dict[str, Any], int]:
    path = temporary / (uri.rsplit("/", 1)[-1])
    count = prepare.write_jsonl_gz(path, rows)
    receipt = cloud.put(uri, path.read_bytes())
    path.unlink()
    return receipt, count


def table_token(value: str) -> str:
    token = re.sub(r"[^A-Za-z0-9_]", "_", value)
    if not token or not token[0].isalpha():
        token = "r_" + token
    return token[:80]


def reference_merge_sql(area_stage: str, product_stage: str) -> str:
    return f"""
BEGIN TRANSACTION;
MERGE `{PROJECT}.{DATASET}.trade_areas` AS target
USING `{PROJECT}.{DATASET}.{area_stage}` AS source
ON target.area_code = source.area_code
WHEN MATCHED THEN UPDATE SET
  iso2=source.iso2, iso3=source.iso3, name=source.name, note=source.note,
  is_group=source.is_group, is_reporter=source.is_reporter, is_partner=source.is_partner,
  effective_from=source.effective_from, effective_to=source.effective_to, loaded_at=source.loaded_at
WHEN NOT MATCHED THEN INSERT ({', '.join(AREA_COLUMNS)})
VALUES ({', '.join('source.' + column for column in AREA_COLUMNS)});

MERGE `{PROJECT}.{DATASET}.trade_products` AS target
USING `{PROJECT}.{DATASET}.{product_stage}` AS source
ON target.product_type = source.product_type
 AND target.classification_code = source.classification_code
 AND target.product_code = source.product_code
WHEN MATCHED THEN UPDATE SET
  product_name=source.product_name, parent_product_code=source.parent_product_code,
  aggregation_level=source.aggregation_level, is_leaf=source.is_leaf,
  standard_unit_abbr=source.standard_unit_abbr, source_url=source.source_url,
  loaded_at=source.loaded_at
WHEN NOT MATCHED THEN INSERT ({', '.join(PRODUCT_COLUMNS)})
VALUES ({', '.join('source.' + column for column in PRODUCT_COLUMNS)});
COMMIT TRANSACTION;
"""


def load_references(
    cloud: Cloud,
    references: Path,
    temporary: Path,
    run_prefix: str,
    token: str,
) -> dict[str, Any]:
    loaded_at = now_iso()
    areas, _ = prepare.area_rows(references, loaded_at)
    products, _ = prepare.product_rows(references, loaded_at)
    area_uri = f"{run_prefix}/trade_areas.jsonl.gz"
    product_uri = f"{run_prefix}/trade_products.jsonl.gz"
    area_receipt, area_count = upload_jsonl(cloud, area_uri, areas, temporary)
    product_receipt, product_count = upload_jsonl(cloud, product_uri, products, temporary)
    area_stage = table_token(f"_un_comtrade_ref_{token}_areas")
    product_stage = table_token(f"_un_comtrade_ref_{token}_products")
    create_stage(area_stage, "trade_areas")
    create_stage(product_stage, "trade_products")
    bq_load(area_stage, area_uri)
    bq_load(product_stage, product_uri)
    bq_query(reference_merge_sql(area_stage, product_stage))
    bq_remove(area_stage)
    bq_remove(product_stage)
    bootstrap_legacy_response_ledger()
    return {
        "areas": area_count,
        "products": product_count,
        "files": [area_receipt, product_receipt],
        "legacy_ledger_bootstrapped": True,
    }


def period_start(period: str, frequency: str) -> str:
    return prepare.period_bounds(period, frequency)[0]


def loaded_responses(period: str, frequency: str) -> dict[tuple[str, str], dict[str, Any]]:
    start = period_start(period, frequency)
    rows = bq_query(f"""
SELECT crawl_task_id, source_response_sha256, normalized_row_count, source_status
FROM `{PROJECT}.{DATASET}.trade_source_responses`
WHERE period_start = DATE '{start}'
""", json_output=True)
    return {
        (row["crawl_task_id"], row["source_response_sha256"]): {
            "normalized_row_count": int(row["normalized_row_count"]),
            "source_status": row["source_status"],
        }
        for row in rows
    }


def source_tasks(connection: sqlite3.Connection, period: str, frequency: str) -> list[sqlite3.Row]:
    connection.row_factory = sqlite3.Row
    return list(connection.execute(
        """SELECT * FROM tasks
           WHERE frequency=? AND period=? AND status IN ('completed','no_data')
             AND raw_path IS NOT NULL AND response_sha256 IS NOT NULL
           ORDER BY updated_at, task_id""",
        (frequency, period),
    ))


class ObservationChunks:
    def __init__(self, cloud: Cloud, temporary: Path, prefix: str, chunk_rows: int) -> None:
        self.cloud = cloud
        self.temporary = temporary
        self.prefix = prefix
        self.chunk_rows = chunk_rows
        self.receipts: list[dict[str, Any]] = []
        self.total_rows = 0
        self._chunk_rows = 0
        self._index = 0
        self._path: Path | None = None
        self._handle: Any = None

    def _open(self) -> None:
        self._path = self.temporary / f"trade_observations-{self._index:05d}.jsonl.gz"
        self._handle = gzip.open(self._path, "wt", encoding="utf-8", compresslevel=6)

    def write(self, row: dict[str, Any]) -> None:
        if self._handle is None:
            self._open()
        self._handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.total_rows += 1
        self._chunk_rows += 1
        if self._chunk_rows >= self.chunk_rows:
            self._close_chunk()

    def _close_chunk(self) -> None:
        if self._handle is None or self._path is None:
            return
        self._handle.close()
        uri = f"{self.prefix}/{self._path.name}"
        receipt = self.cloud.put(uri, self._path.read_bytes())
        receipt["rows"] = self._chunk_rows
        self.receipts.append(receipt)
        self._path.unlink()
        self._index += 1
        self._chunk_rows = 0
        self._path = None
        self._handle = None

    def close(self) -> None:
        self._close_chunk()


def raw_uri(config: dict[str, Any], raw_path: str) -> str:
    crawl = config["warehouse_crawl"]
    relative = prepare.raw_relative_path(raw_path, str(crawl["raw_path"]))
    archive = crawl["archive"]
    return (
        f"{archive['bucket_uri'].rstrip('/')}/{archive['raw_prefix'].strip('/')}/"
        f"{relative.as_posix()}"
    )


def coverage_for_period(
    connection: sqlite3.Connection,
    period: str,
    frequency: str,
    committed: dict[tuple[str, str], dict[str, Any]],
    loaded_at: str,
) -> list[dict[str, Any]]:
    connection.row_factory = sqlite3.Row
    result: list[dict[str, Any]] = []
    availabilities = connection.execute(
        "SELECT * FROM availability WHERE frequency=? AND period=? ORDER BY reporter_code",
        (frequency, period),
    ).fetchall()
    for available in availabilities:
        tasks = connection.execute(
            """SELECT * FROM tasks
               WHERE product_type=? AND frequency=? AND period=?
                 AND reporter_code=? AND classification_code=?""",
            (
                available["product_type"], available["frequency"], available["period"],
                available["reporter_code"], available["classification_code"],
            ),
        ).fetchall()
        completed_count = no_data_count = split_count = error_count = pending_count = 0
        loaded_rows = 0
        for task in tasks:
            key = (task["task_id"], task["response_sha256"] or "")
            if task["status"] == "split":
                split_count += 1
            elif task["status"] == "error":
                error_count += 1
            elif task["status"] in {"completed", "no_data"} and key in committed:
                if task["status"] == "completed":
                    completed_count += 1
                else:
                    no_data_count += 1
                loaded_rows += int(committed[key]["normalized_row_count"])
            else:
                pending_count += 1
        if error_count:
            status = "error"
        elif pending_count:
            status = "partial" if completed_count or no_data_count or split_count else "queued"
        elif completed_count:
            status = "loaded"
        elif no_data_count:
            status = "no_data"
        else:
            status = "available"
        result.append({
            "coverage_id": available["availability_id"],
            "period_start": period_start(period, frequency),
            "period": period,
            "frequency": frequency,
            "product_type": available["product_type"],
            "reporter_area_code": available["reporter_code"],
            "reporter_iso3": available["reporter_iso3"],
            "classification_code": available["classification_code"],
            "source_dataset_code": available["dataset_code"],
            "source_dataset_checksum": available["dataset_checksum"],
            "source_total_records": available["total_records"],
            "source_first_released": available["first_released"],
            "source_last_released": available["last_released"],
            "crawl_status": status,
            "queued_task_count": len(tasks),
            "completed_task_count": completed_count,
            "no_data_task_count": no_data_count,
            "split_task_count": split_count,
            "error_task_count": error_count,
            "loaded_row_count": loaded_rows,
            "assessed_at": loaded_at,
            "loaded_at": loaded_at,
        })
    return result


def insert_sql(table: str, columns: tuple[str, ...], source: str) -> str:
    names = ", ".join(columns)
    return f"INSERT INTO `{PROJECT}.{DATASET}.{table}` ({names}) SELECT {names} FROM {source};"


def period_transaction_sql(stages: dict[str, str], start: str, run_date: str) -> str:
    obs_columns = ", ".join(OBSERVATION_COLUMNS)
    coverage_columns = ", ".join(COVERAGE_COLUMNS)
    run_columns = ", ".join(RUN_COLUMNS)
    response_columns = ", ".join(RESPONSE_COLUMNS)
    obs_stage = f"`{PROJECT}.{DATASET}.{stages['observations']}`"
    coverage_stage = f"`{PROJECT}.{DATASET}.{stages['coverage']}`"
    run_stage = f"`{PROJECT}.{DATASET}.{stages['runs']}`"
    response_stage = f"`{PROJECT}.{DATASET}.{stages['responses']}`"
    return f"""
DECLARE load_period DATE DEFAULT DATE '{start}';
DECLARE run_date DATE DEFAULT DATE '{run_date}';

CREATE TEMP TABLE dedup_observations AS
SELECT {obs_columns}
FROM {obs_stage}
WHERE period_start = load_period
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY trade_observation_id ORDER BY retrieved_at DESC, loaded_at DESC
) = 1;

CREATE TEMP TABLE dedup_coverage AS
SELECT {coverage_columns}
FROM {coverage_stage}
WHERE period_start = load_period
QUALIFY ROW_NUMBER() OVER (PARTITION BY coverage_id ORDER BY assessed_at DESC) = 1;

CREATE TEMP TABLE dedup_responses AS
SELECT {response_columns}
FROM {response_stage}
WHERE period_start = load_period
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY crawl_task_id, source_response_sha256 ORDER BY loaded_at DESC
) = 1;

CREATE TEMP TABLE dedup_runs AS
SELECT {run_columns}
FROM {run_stage}
WHERE DATE(started_at) = run_date
QUALIFY ROW_NUMBER() OVER (PARTITION BY ingestion_run_id ORDER BY loaded_at DESC) = 1;

BEGIN TRANSACTION;
DELETE FROM `{PROJECT}.{DATASET}.trade_observations`
WHERE period_start = load_period
  AND trade_observation_id IN (SELECT trade_observation_id FROM dedup_observations);
{insert_sql('trade_observations', OBSERVATION_COLUMNS, 'dedup_observations')}

DELETE FROM `{PROJECT}.{DATASET}.trade_dataset_coverage`
WHERE period_start = load_period
  AND coverage_id IN (SELECT coverage_id FROM dedup_coverage);
{insert_sql('trade_dataset_coverage', COVERAGE_COLUMNS, 'dedup_coverage')}

DELETE FROM `{PROJECT}.{DATASET}.trade_ingestion_runs`
WHERE DATE(started_at) = run_date
  AND ingestion_run_id IN (SELECT ingestion_run_id FROM dedup_runs);
{insert_sql('trade_ingestion_runs', RUN_COLUMNS, 'dedup_runs')}

DELETE FROM `{PROJECT}.{DATASET}.trade_source_responses`
WHERE period_start = load_period
  AND STRUCT(crawl_task_id, source_response_sha256) IN (
    SELECT AS STRUCT crawl_task_id, source_response_sha256 FROM dedup_responses
  );
{insert_sql('trade_source_responses', RESPONSE_COLUMNS, 'dedup_responses')}

ASSERT (
  SELECT COUNT(*)
  FROM `{PROJECT}.{DATASET}.trade_observations` AS target
  JOIN dedup_observations AS source
    ON target.period_start = load_period
   AND target.trade_observation_id = source.trade_observation_id
) = (SELECT COUNT(*) FROM dedup_observations)
AS 'Every staged observation must exist exactly once after loading';

ASSERT (
  SELECT COUNT(*)
  FROM `{PROJECT}.{DATASET}.trade_source_responses` AS target
  JOIN dedup_responses AS source
    ON target.period_start = load_period
   AND target.crawl_task_id = source.crawl_task_id
   AND target.source_response_sha256 = source.source_response_sha256
) = (SELECT COUNT(*) FROM dedup_responses)
AS 'Every task/hash pair must be acknowledged exactly once';
COMMIT TRANSACTION;
"""


def process_period(
    cloud: Cloud,
    config: dict[str, Any],
    manifest: dict[str, Any],
    connection: sqlite3.Connection,
    references: Path,
    temporary: Path,
    frequency: str,
    period: str,
    max_tasks: int,
    chunk_rows: int,
    run_id: str,
) -> dict[str, Any]:
    start_time = now_iso()
    already_loaded = loaded_responses(period, frequency)
    tasks = source_tasks(connection, period, frequency)
    pending = [
        task for task in tasks
        if (task["task_id"], task["response_sha256"]) not in already_loaded
    ]
    selected = pending[:max_tasks]
    if not selected:
        return {
            "frequency": frequency,
            "period": period,
            "status": "no_pending_responses",
            "available_responses": len(tasks),
            "already_loaded_responses": len(already_loaded),
        }

    loaded_at = now_iso()
    ingestion_run_id = f"un-comtrade-{run_id}-{frequency}{period}"
    period_prefix = f"{RESULTS_BUCKET}/{RESULTS_PREFIX}/{run_id}/{frequency}/{period}"
    _, area_lookup = prepare.area_rows(references, loaded_at)
    _, product_lookup = prepare.product_rows(references, loaded_at)
    availability = prepare.availability_lookup(connection)
    chunks = ObservationChunks(cloud, temporary, period_prefix, chunk_rows)
    response_rows: list[dict[str, Any]] = []
    source_rows = skipped_rows = 0

    for index, task in enumerate(selected, start=1):
        uri = raw_uri(config, task["raw_path"])
        raw = cloud.get(uri)
        response_hash = sha256_bytes(raw)
        if response_hash != task["response_sha256"]:
            raise RuntimeError(f"Raw response checksum mismatch for {task['task_id']}")
        payload = json.loads(gzip.decompress(raw))
        embedded_task = payload.get("_psd_task", {}).get("task_id")
        if embedded_task and embedded_task != task["task_id"]:
            raise RuntimeError(f"Raw response task mismatch for {task['task_id']}")
        rows = payload.get("data")
        if not isinstance(rows, list) or len(rows) != int(task["record_count"] or 0):
            raise RuntimeError(f"Raw response row-count mismatch for {task['task_id']}")
        metadata = {
            "task_id": task["task_id"],
            "product_type": task["product_type"],
            "frequency": task["frequency"],
            "period": task["period"],
            "reporter_code": task["reporter_code"],
            "classification_code": task["classification_code"],
            "retrieved_at": payload.get("_psd_task", {}).get("retrieved_at") or task["updated_at"],
        }
        normalized_count = 0
        for source in rows:
            source_rows += 1
            row = prepare.observation(
                source, metadata, area_lookup, product_lookup, availability,
                ingestion_run_id, loaded_at, response_hash,
            )
            if row is None:
                skipped_rows += 1
                continue
            chunks.write(row)
            normalized_count += 1
        response_rows.append({
            "crawl_task_id": task["task_id"],
            "source_response_sha256": response_hash,
            "period_start": period_start(period, frequency),
            "period": period,
            "frequency": frequency,
            "product_type": task["product_type"],
            "reporter_area_code": task["reporter_code"],
            "reporter_iso3": task["reporter_iso3"],
            "classification_code": task["classification_code"],
            "source_record_count": len(rows),
            "normalized_row_count": normalized_count,
            "source_status": task["status"],
            "checkpoint_archive_id": manifest["archive_id"],
            "ingestion_run_id": ingestion_run_id,
            "loaded_at": loaded_at,
        })
        if index % 100 == 0 or index == len(selected):
            print(json.dumps({
                "event": "normalize_progress", "frequency": frequency, "period": period,
                "responses": index, "response_total": len(selected), "rows": chunks.total_rows,
            }), flush=True)
    chunks.close()

    committed = dict(already_loaded)
    for row in response_rows:
        committed[(row["crawl_task_id"], row["source_response_sha256"])] = {
            "normalized_row_count": row["normalized_row_count"],
            "source_status": row["source_status"],
        }
    coverage_rows = coverage_for_period(connection, period, frequency, committed, loaded_at)
    completed_at = now_iso()
    run_row = {
        "ingestion_run_id": ingestion_run_id,
        "started_at": start_time,
        "completed_at": completed_at,
        "status": "completed",
        "source_id": config["source_id"],
        "source_vintage": f"checkpoint {manifest['archive_id']} ({frequency}{period})",
        "queue_database_sha256": manifest["checkpoint"]["sha256"],
        "raw_response_count": len(selected),
        "rows_read": source_rows,
        "rows_loaded": chunks.total_rows,
        "warning_count": skipped_rows,
        "error_count": 0,
        "loaded_at": completed_at,
    }

    response_uri = f"{period_prefix}/trade_source_responses.jsonl.gz"
    coverage_uri = f"{period_prefix}/trade_dataset_coverage.jsonl.gz"
    run_uri = f"{period_prefix}/trade_ingestion_runs.jsonl.gz"
    response_receipt, _ = upload_jsonl(cloud, response_uri, response_rows, temporary)
    coverage_receipt, _ = upload_jsonl(cloud, coverage_uri, coverage_rows, temporary)
    run_receipt, _ = upload_jsonl(cloud, run_uri, [run_row], temporary)

    token = table_token(f"{run_id}_{frequency}{period}")
    stages = {
        "observations": table_token(f"_un_comtrade_{token}_observations"),
        "coverage": table_token(f"_un_comtrade_{token}_coverage"),
        "runs": table_token(f"_un_comtrade_{token}_runs"),
        "responses": table_token(f"_un_comtrade_{token}_responses"),
    }
    targets = {
        "observations": "trade_observations",
        "coverage": "trade_dataset_coverage",
        "runs": "trade_ingestion_runs",
        "responses": "trade_source_responses",
    }
    for key, stage in stages.items():
        create_stage(stage, targets[key])
    if chunks.total_rows:
        # Explicit immutable objects avoid a bucket-wide list permission merely
        # to expand a wildcard; the builder can read only this processing prefix.
        bq_load(stages["observations"], [item["uri"] for item in chunks.receipts])
    bq_load(stages["coverage"], coverage_uri)
    bq_load(stages["runs"], run_uri)
    bq_load(stages["responses"], response_uri)
    bq_query(period_transaction_sql(stages, period_start(period, frequency), start_time[:10]))

    receipt = {
        "schema_version": "1.0.0",
        "status": "completed",
        "run_id": run_id,
        "ingestion_run_id": ingestion_run_id,
        "frequency": frequency,
        "period": period,
        "period_start": period_start(period, frequency),
        "checkpoint_archive_id": manifest["archive_id"],
        "checkpoint_sha256": manifest["checkpoint"]["sha256"],
        "raw_response_count": len(selected),
        "source_rows": source_rows,
        "normalized_rows": chunks.total_rows,
        "skipped_rows": skipped_rows,
        "remaining_responses_in_pinned_checkpoint": len(pending) - len(selected),
        "completed_at": now_iso(),
        "files": chunks.receipts + [response_receipt, coverage_receipt, run_receipt],
    }
    completed_uri = f"{period_prefix}/completed.json"
    receipt["completed_marker"] = cloud.put(
        completed_uri,
        (json.dumps(receipt, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )
    for stage in stages.values():
        bq_remove(stage)
    return receipt


def candidate_periods(
    connection: sqlite3.Connection,
    frequency: str | None,
    period: str | None,
) -> list[tuple[str, str]]:
    if frequency and period:
        period_start(period, frequency)
        return [(frequency, period)]
    rows = connection.execute(
        """SELECT DISTINCT frequency, period FROM tasks
           WHERE status IN ('completed','no_data') AND raw_path IS NOT NULL"""
    ).fetchall()
    values = [(str(row[0]), str(row[1])) for row in rows]
    return sorted(values, key=lambda item: (item[0] != "M", -int(item[1])))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frequency", choices=["A", "M"])
    parser.add_argument("--period")
    parser.add_argument("--max-tasks", type=int, default=20000)
    parser.add_argument("--max-periods", type=int, default=1)
    parser.add_argument("--chunk-rows", type=int, default=1_000_000)
    parser.add_argument("--references-only", action="store_true")
    args = parser.parse_args()
    if bool(args.frequency) != bool(args.period):
        parser.error("--frequency and --period must be supplied together")
    if not 1 <= args.max_tasks <= 50000:
        parser.error("--max-tasks must be between 1 and 50000")
    if not 1 <= args.max_periods <= 20:
        parser.error("--max-periods must be between 1 and 20")
    if not 1000 <= args.chunk_rows <= 2_000_000:
        parser.error("--chunk-rows must be between 1000 and 2000000")
    return args


def main() -> None:
    args = parse_args()
    config = prepare.read_json(CONFIG_PATH)
    cloud = Cloud()
    build_id = os.environ.get("BUILD_ID") or time.strftime("local-%Y%m%dT%H%M%SZ", time.gmtime())
    run_id = table_token(build_id)
    run_prefix = f"{RESULTS_BUCKET}/{RESULTS_PREFIX}/{run_id}/control"
    with tempfile.TemporaryDirectory(prefix="un-comtrade-warehouse-") as directory:
        temporary = Path(directory)
        manifest, state, references = restore_controls(cloud, temporary, config)
        connection = sqlite3.connect(state)
        connection.row_factory = sqlite3.Row
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Crawler checkpoint failed SQLite integrity check")
        load_schema()
        if args.references_only:
            reference_result = load_references(cloud, references, temporary, run_prefix, run_id)
            result = {
                "schema_version": "1.0.0", "status": "completed", "run_id": run_id,
                "mode": "references_only", "checkpoint_archive_id": manifest["archive_id"],
                "completed_at": now_iso(), "references": reference_result,
            }
            result["completed_marker"] = cloud.put(
                f"{run_prefix}/completed.json",
                (json.dumps(result, indent=2) + "\n").encode("utf-8"),
            )
            print(json.dumps(result, indent=2), flush=True)
            connection.close()
            return

        # The one-time reference initialization seeds the ledger from legacy
        # BigQuery rows. This guard is idempotent, so period retries remain safe.
        bootstrap_legacy_response_ledger()

        processed: list[dict[str, Any]] = []
        for frequency, period in candidate_periods(connection, args.frequency, args.period):
            if len([item for item in processed if item.get("status") == "completed"]) >= args.max_periods:
                break
            result = process_period(
                cloud, config, manifest, connection, references, temporary,
                frequency, period, args.max_tasks, args.chunk_rows, run_id,
            )
            processed.append(result)
            if args.frequency and args.period:
                break
        connection.close()
    summary = {
        "schema_version": "1.0.0", "status": "completed", "run_id": run_id,
        "checkpoint_archive_id": manifest["archive_id"], "completed_at": now_iso(),
        "periods": processed,
    }
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
