#!/usr/bin/env python3
"""Build and execute a freshness-aware, resumable UN Comtrade crawl queue.

Commands:
  init    refresh availability and queue only released fresh datasets
  crawl   execute a bounded number of API calls, checkpointing every response
  status  summarize queue and reporter-period coverage

Detailed authenticated tasks request HS6 goods and EBOPS services for batches
of bilateral partners. A response that reaches the endpoint record ceiling is
never accepted as complete: it is split into smaller partner or product tasks.
"""

from __future__ import annotations

import argparse
import calendar
import gzip
import hashlib
import json
import os
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


REPO = Path(__file__).resolve().parents[2]
WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", REPO.parent))
CONFIG_PATH = REPO / "pipeline/config/un_comtrade_source.v1.json"
UNIVERSE_PATH = REPO / "pipeline/config/sovereign_country_universe.json"
USER_AGENT = "publicspendingdata.org/1.0 detailed UN Comtrade crawler"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def resolve_api_key(config: dict[str, Any]) -> str | None:
    """Read the API key from the environment or the macOS login Keychain."""
    access = config["access"]
    value = os.environ.get(access["api_key_environment_variable"])
    if value:
        return value.strip()
    service = access.get("macos_keychain_service")
    security = Path("/usr/bin/security")
    if not service or not security.exists():
        return None
    try:
        result = subprocess.run(
            [str(security), "find-generic-password", "-s", str(service), "-w"],
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() or None


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def stable_id(*parts: Any) -> str:
    return hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()


def atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)
    path.chmod(0o644)


def atomic_json_gz(path: Path, payload: Any) -> None:
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n"
    atomic_bytes(path, gzip.compress(content, compresslevel=6))


class RateLimiter:
    def __init__(self, minimum_interval: float) -> None:
        self.minimum_interval = minimum_interval
        self.last_call: float | None = None

    def wait(self) -> None:
        if self.last_call is not None:
            remaining = self.minimum_interval - (time.monotonic() - self.last_call)
            if remaining > 0:
                time.sleep(remaining)
        self.last_call = time.monotonic()


def request_json(url: str, limiter: RateLimiter, retries: int = 4) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(retries):
        limiter.wait()
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.loads(response.read().decode("utf-8-sig"))
            if not isinstance(payload, dict):
                raise RuntimeError("UN Comtrade returned a non-object JSON response")
            if payload.get("statusCode") and int(payload["statusCode"]) >= 400:
                raise RuntimeError(str(payload.get("message") or payload))
            message = str(payload.get("message") or "")
            if "Rate limit" in message:
                raise urllib.error.HTTPError(url, 429, message, {}, None)
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise
            if exc.code not in {500, 502, 503, 504} or attempt == retries - 1:
                raise
            time.sleep(min(2 ** (attempt + 1), 30))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == retries - 1:
                raise
            time.sleep(min(2 ** (attempt + 1), 30))
    raise RuntimeError("UN Comtrade request failed")


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS availability (
          availability_id TEXT PRIMARY KEY,
          product_type TEXT NOT NULL,
          frequency TEXT NOT NULL,
          period TEXT NOT NULL,
          reporter_code INTEGER NOT NULL,
          reporter_iso3 TEXT,
          reporter_name TEXT,
          classification_code TEXT NOT NULL,
          classification_search_code TEXT,
          dataset_code TEXT,
          dataset_checksum INTEGER,
          total_records INTEGER,
          first_released TEXT,
          last_released TEXT,
          raw_path TEXT NOT NULL,
          discovered_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS availability_period_idx
          ON availability(product_type, frequency, period, reporter_code);
        CREATE TABLE IF NOT EXISTS tasks (
          task_id TEXT PRIMARY KEY,
          parent_task_id TEXT,
          profile_id TEXT NOT NULL,
          product_type TEXT NOT NULL,
          frequency TEXT NOT NULL,
          period TEXT NOT NULL,
          reporter_code INTEGER NOT NULL,
          reporter_iso3 TEXT,
          classification_code TEXT NOT NULL,
          flow_code TEXT NOT NULL,
          partner_codes TEXT NOT NULL,
          product_selector TEXT,
          priority INTEGER NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          not_before TEXT,
          raw_path TEXT,
          record_count INTEGER,
          response_sha256 TEXT,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tasks_queue_idx
          ON tasks(status, priority, not_before, created_at);
        CREATE INDEX IF NOT EXISTS tasks_dataset_idx
          ON tasks(product_type, frequency, period, reporter_code, classification_code);
        CREATE TABLE IF NOT EXISTS call_usage (
          utc_date TEXT PRIMARY KEY,
          call_count INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
    """)
    return connection


def record_call(connection: sqlite3.Connection) -> int:
    utc_date = datetime.now(timezone.utc).date().isoformat()
    timestamp = now_iso()
    connection.execute("""
      INSERT INTO call_usage (utc_date, call_count, updated_at) VALUES (?, 1, ?)
      ON CONFLICT(utc_date) DO UPDATE SET call_count = call_count + 1, updated_at = excluded.updated_at
    """, (utc_date, timestamp))
    connection.commit()
    row = connection.execute("SELECT call_count FROM call_usage WHERE utc_date = ?", (utc_date,)).fetchone()
    return int(row["call_count"])


def daily_calls(connection: sqlite3.Connection) -> int:
    utc_date = datetime.now(timezone.utc).date().isoformat()
    row = connection.execute("SELECT call_count FROM call_usage WHERE utc_date = ?", (utc_date,)).fetchone()
    return int(row["call_count"]) if row else 0


def reference_paths(root: Path) -> dict[str, Path]:
    return {
        "reporters": root / "Reporters.json",
        "partners": root / "partnerAreas.json",
        "H6": root / "H6.json",
        "EB": root / "EB.json",
        "EB10": root / "EB10.json",
        "EB10S": root / "EB10S.json",
    }


def sync_references(config: dict[str, Any], root: Path, limiter: RateLimiter) -> dict[str, Path]:
    paths = reference_paths(root)
    filenames = {
        "reporters": "Reporters.json",
        "partners": "partnerAreas.json",
        "H6": "H6.json",
        "EB": "EB.json",
        "EB10": "EB10.json",
        "EB10S": "EB10S.json",
    }
    for key, path in paths.items():
        if path.exists():
            continue
        url = f"{config['api_base']}/files/v1/app/reference/{filenames[key]}"
        payload = request_json(url, limiter)
        atomic_bytes(path, (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))
    return paths


def recent_complete_months(count: int, today: date | None = None) -> list[str]:
    cursor = (today or date.today()).replace(day=1) - timedelta(days=1)
    periods = []
    for _ in range(count):
        periods.append(f"{cursor.year:04d}{cursor.month:02d}")
        cursor = cursor.replace(day=1) - timedelta(days=1)
    return periods


def profile_periods(profile: dict[str, Any], config: dict[str, Any], annual_year: int | None, month_count: int | None) -> list[str]:
    freshness = config["warehouse_crawl"]["freshness"]
    if profile["frequency"] == "A":
        return [str(annual_year or (date.today().year - int(freshness["annual_year_offset"])))]
    return recent_complete_months(month_count or int(freshness["recent_complete_months"]))


def availability_url(config: dict[str, Any], profile: dict[str, Any], period: str) -> str:
    path = f"{config['api_base']}/public/v1/getDA/{profile['product_type']}/{profile['frequency']}/{profile['classification']}"
    return f"{path}?{urllib.parse.urlencode({'period': period, 'maxRecords': 500})}"


def sync_availability(
    connection: sqlite3.Connection,
    config: dict[str, Any],
    availability_root: Path,
    limiter: RateLimiter,
    annual_year: int | None,
    month_count: int | None,
    daily_limit: int,
) -> None:
    sovereign = {row["iso3"] for row in read_json(UNIVERSE_PATH)["countries"]}
    for profile in config["warehouse_crawl"]["profiles"]:
        for period in profile_periods(profile, config, annual_year, month_count):
            if daily_calls(connection) >= daily_limit:
                raise RuntimeError(f"UTC daily call budget {daily_limit} reached while refreshing availability")
            url = availability_url(config, profile, period)
            payload = request_json(url, limiter)
            record_call(connection)
            relative = Path(profile["product_type"]) / profile["frequency"] / f"{period}-{profile['classification']}.json.gz"
            path = availability_root / relative
            payload["_psd_request"] = {"url": url, "retrieved_at": now_iso(), "profile_id": profile["id"]}
            atomic_json_gz(path, payload)
            discovered_at = now_iso()
            for row in payload.get("data", []):
                iso3 = str(row.get("reporterISO") or "").strip().upper()
                if iso3 not in sovereign:
                    continue
                classification = str(row.get("classificationCode") or profile["classification"])
                availability_id = stable_id(profile["product_type"], profile["frequency"], period, row.get("reporterCode"), classification)
                connection.execute("""
                  INSERT INTO availability (
                    availability_id, product_type, frequency, period, reporter_code, reporter_iso3,
                    reporter_name, classification_code, classification_search_code, dataset_code,
                    dataset_checksum, total_records, first_released, last_released, raw_path, discovered_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(availability_id) DO UPDATE SET
                    reporter_iso3 = excluded.reporter_iso3,
                    reporter_name = excluded.reporter_name,
                    classification_search_code = excluded.classification_search_code,
                    dataset_code = excluded.dataset_code,
                    dataset_checksum = excluded.dataset_checksum,
                    total_records = excluded.total_records,
                    first_released = excluded.first_released,
                    last_released = excluded.last_released,
                    raw_path = excluded.raw_path,
                    discovered_at = excluded.discovered_at
                """, (
                    availability_id, profile["product_type"], profile["frequency"], period,
                    int(row["reporterCode"]), iso3, row.get("reporterDesc"), classification,
                    row.get("classificationSearchCode"), str(row.get("datasetCode")) if row.get("datasetCode") is not None else None,
                    row.get("datasetChecksum"), row.get("totalRecords"), row.get("firstReleased"), row.get("lastReleased"),
                    str(path.relative_to(WORKSPACE)), discovered_at,
                ))
            connection.commit()
            print(f"availability {profile['id']} {period}: {len(payload.get('data', []))} datasets", flush=True)


def country_ranks(year: int) -> dict[str, int]:
    countries = read_json(UNIVERSE_PATH)["countries"]
    values = []
    for country in countries:
        profile = REPO / "data/countries" / country["iso3"].lower() / "profile.v1.json"
        gdp = None
        if profile.exists():
            rows = read_json(profile).get("data", {}).get("sovereign", {}).get("series", {}).get("metrics", {}).get("nominal_gdp_usd_bn", {}).get("values", [])
            eligible = [row for row in rows if isinstance(row.get("value"), (int, float)) and int(row.get("year", 0)) <= year]
            if eligible:
                gdp = float(max(eligible, key=lambda row: int(row["year"]))["value"])
        values.append((country["iso3"], gdp, country["name_en"]))
    values.sort(key=lambda row: (row[1] is None, -(row[1] or 0), row[2]))
    return {iso3: index for index, (iso3, _, _) in enumerate(values, start=1)}


def active_partner_codes(reference: dict[str, Any], sovereign: set[str]) -> dict[str, int]:
    result = {}
    for row in reference.get("results", []):
        iso3 = str(row.get("PartnerCodeIsoAlpha3") or "").strip().upper()
        if iso3 in sovereign and not row.get("isGroup") and not row.get("entryExpiredDate"):
            result[iso3] = int(row["PartnerCode"])
    return result


def chunks(values: list[int], size: int) -> Iterable[list[int]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def insert_task(connection: sqlite3.Connection, task: dict[str, Any]) -> bool:
    timestamp = now_iso()
    task_id = stable_id(
        task["profile_id"], task["product_type"], task["frequency"], task["period"],
        task["reporter_code"], task["classification_code"], task["flow_code"],
        ",".join(str(code) for code in task["partner_codes"]), task.get("product_selector") or "ALL",
    )
    cursor = connection.execute("""
      INSERT OR IGNORE INTO tasks (
        task_id, parent_task_id, profile_id, product_type, frequency, period,
        reporter_code, reporter_iso3, classification_code, flow_code, partner_codes,
        product_selector, priority, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
    """, (
        task_id, task.get("parent_task_id"), task["profile_id"], task["product_type"], task["frequency"],
        task["period"], task["reporter_code"], task.get("reporter_iso3"), task["classification_code"],
        task["flow_code"], json.dumps(task["partner_codes"], separators=(",", ":")), task.get("product_selector"),
        int(task["priority"]), timestamp, timestamp,
    ))
    return cursor.rowcount > 0


def schedule_tasks(connection: sqlite3.Connection, config: dict[str, Any], partner_reference: dict[str, Any]) -> int:
    universe = read_json(UNIVERSE_PATH)["countries"]
    sovereign = {row["iso3"] for row in universe}
    partners = active_partner_codes(partner_reference, sovereign)
    ranks = country_ranks(date.today().year - 1)
    profiles = {(row["product_type"], row["frequency"]): row for row in config["warehouse_crawl"]["profiles"]}
    inserted = 0
    availability_rows = connection.execute("SELECT * FROM availability ORDER BY period DESC, reporter_iso3").fetchall()
    for available in availability_rows:
        profile = profiles.get((available["product_type"], available["frequency"]))
        if not profile:
            continue
        partner_values = [code for iso3, code in sorted(partners.items(), key=lambda item: (ranks.get(item[0], 999), item[0])) if iso3 != available["reporter_iso3"]]
        partner_batches = [[0], *list(chunks(partner_values, int(profile["partner_batch_size"])))]
        rank = ranks.get(available["reporter_iso3"], 999)
        for flow_index, flow_code in enumerate(("M", "X")):
            for batch_index, partner_batch in enumerate(partner_batches):
                priority = int(profile["priority"]) * 1_000_000 + rank * 1_000 + flow_index * 400 + batch_index
                inserted += insert_task(connection, {
                    "profile_id": profile["id"], "product_type": available["product_type"],
                    "frequency": available["frequency"], "period": available["period"],
                    "reporter_code": available["reporter_code"], "reporter_iso3": available["reporter_iso3"],
                    "classification_code": available["classification_code"], "flow_code": flow_code,
                    "partner_codes": partner_batch, "product_selector": profile.get("product_selector"),
                    "priority": priority,
                })
    connection.commit()
    return inserted


def safe_task_url(config: dict[str, Any], task: sqlite3.Row, api_key: str | None, max_records: int) -> tuple[str, str]:
    endpoint = "/data/v1/get" if api_key else "/public/v1/preview"
    search_classification = "HS" if task["product_type"] == "C" else "EB"
    path = f"{config['api_base']}{endpoint}/{task['product_type']}/{task['frequency']}/{search_classification}"
    params: dict[str, Any] = {
        "period": task["period"], "reporterCode": task["reporter_code"], "flowCode": task["flow_code"],
        "partnerCode": ",".join(str(code) for code in json.loads(task["partner_codes"])),
        "partner2Code": 0, "maxRecords": max_records, "includeDesc": "true", "breakdownMode": "classic",
    }
    if task["product_selector"]:
        params["cmdCode"] = task["product_selector"]
    if task["product_type"] == "C":
        params["customsCode"] = "C00"
        params["motCode"] = 0
    safe = f"{path}?{urllib.parse.urlencode(params)}"
    if api_key:
        params["subscription-key"] = api_key
    return f"{path}?{urllib.parse.urlencode(params)}", safe


def classification_leaf_codes(reference: dict[str, Any], classification: str) -> list[str]:
    rows = reference.get("results", [])
    if classification.startswith("H"):
        return sorted(str(row["id"]) for row in rows if int(row.get("aggrlevel", -1)) == 6 and len(str(row.get("id", ""))) == 6)
    parents = {str(row.get("parent")) for row in rows if row.get("parent") not in {None, "#"}}
    return sorted(str(row["id"]) for row in rows if str(row.get("id")) not in parents and str(row.get("id")) not in {"TOTAL", "200"})


def split_task(connection: sqlite3.Connection, task: sqlite3.Row, references: dict[str, dict[str, Any]], chunk_size: int) -> int:
    partners = json.loads(task["partner_codes"])
    children: list[tuple[list[int], str | None]] = []
    if len(partners) > 1:
        midpoint = (len(partners) + 1) // 2
        children = [(partners[:midpoint], task["product_selector"]), (partners[midpoint:], task["product_selector"])]
    else:
        selector = task["product_selector"]
        if selector and selector not in {"AG6", "AG4"} and "," in selector:
            codes = selector.split(",")
            midpoint = (len(codes) + 1) // 2
            children = [(partners, ",".join(codes[:midpoint])), (partners, ",".join(codes[midpoint:]))]
        else:
            key = task["classification_code"] if task["classification_code"] in references else "EB"
            leaves = classification_leaf_codes(references[key], task["classification_code"])
            children = [(partners, ",".join(batch)) for batch in chunks(leaves, chunk_size)]
    inserted = 0
    for index, (partner_batch, selector) in enumerate(children):
        if not partner_batch or not selector and task["product_type"] == "C":
            continue
        inserted += insert_task(connection, {
            "parent_task_id": task["task_id"], "profile_id": task["profile_id"],
            "product_type": task["product_type"], "frequency": task["frequency"], "period": task["period"],
            "reporter_code": task["reporter_code"], "reporter_iso3": task["reporter_iso3"],
            "classification_code": task["classification_code"], "flow_code": task["flow_code"],
            "partner_codes": partner_batch, "product_selector": selector,
            "priority": int(task["priority"]) + index,
        })
    connection.execute("UPDATE tasks SET status = 'split', record_count = NULL, updated_at = ?, error = NULL WHERE task_id = ?", (now_iso(), task["task_id"]))
    connection.commit()
    return inserted


def validate_task_response(task: sqlite3.Row, payload: dict[str, Any]) -> None:
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise RuntimeError("Response is missing its data array")
    partners = set(json.loads(task["partner_codes"]))
    for row in rows:
        if str(row.get("period")) != str(task["period"]):
            raise RuntimeError("Response period does not match task")
        if int(row.get("reporterCode", task["reporter_code"])) != int(task["reporter_code"]):
            raise RuntimeError("Response reporter does not match task")
        if row.get("flowCode") != task["flow_code"]:
            raise RuntimeError("Response flow does not match task")
        if int(row.get("partnerCode", 0)) not in partners:
            raise RuntimeError("Response partner falls outside task batch")


def crawl(connection: sqlite3.Connection, config: dict[str, Any], reference_paths_map: dict[str, Path], args: argparse.Namespace) -> None:
    crawl_config = config["warehouse_crawl"]
    api_key = resolve_api_key(config)
    if not api_key and not args.allow_preview:
        raise SystemExit("Detailed crawling requires UN_COMTRADE_API_KEY or the configured macOS Keychain item. Use --allow-preview only for slow, automatically split 500-row preview slices.")
    max_records = int(crawl_config["authenticated_max_records"] if api_key else crawl_config["anonymous_max_records"])
    max_calls = args.max_calls if args.max_calls is not None else int(crawl_config["calls_per_crawl_run"])
    daily_limit = args.daily_limit if args.daily_limit is not None else int(crawl_config["calls_per_utc_day"])
    minimum_interval = float(config["access"]["minimum_seconds_between_calls"])
    if not api_key:
        minimum_interval = max(minimum_interval, 2.2)
    limiter = RateLimiter(minimum_interval)
    references = {key: read_json(path) for key, path in reference_paths_map.items() if key in {"H6", "EB", "EB10", "EB10S"}}
    raw_root = WORKSPACE / crawl_config["raw_path"]
    # The queue is deliberately single-worker. A process interruption can only
    # leave its current task in `running`, so reclaim it before resuming.
    reclaimed = connection.execute(
        "UPDATE tasks SET status = 'queued', updated_at = ? WHERE status = 'running'",
        (now_iso(),),
    ).rowcount
    connection.commit()
    if reclaimed:
        print(f"reclaimed {reclaimed} interrupted task(s)", flush=True)
    calls = 0
    while calls < max_calls and daily_calls(connection) < daily_limit:
        task = connection.execute("""
          SELECT * FROM tasks
          WHERE status = 'queued' AND (not_before IS NULL OR not_before <= ?)
          ORDER BY priority, created_at, task_id
          LIMIT 1
        """, (now_iso(),)).fetchone()
        if not task:
            break
        connection.execute("UPDATE tasks SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE task_id = ?", (now_iso(), task["task_id"]))
        connection.commit()
        url, safe_url = safe_task_url(config, task, api_key, max_records)
        try:
            payload = request_json(url, limiter)
            calls += 1
            record_call(connection)
            validate_task_response(task, payload)
            rows = payload.get("data", [])
            if len(rows) >= max_records or int(payload.get("count") or 0) >= max_records:
                child_count = split_task(connection, task, references, int(crawl_config["anonymous_product_chunk_size"]))
                print(f"split {task['task_id'][:10]} {task['reporter_iso3']} {task['period']} rows={len(rows)} children={child_count}", flush=True)
                continue
            retrieved_at = now_iso()
            relative = Path(task["product_type"]) / task["frequency"] / task["period"] / task["reporter_iso3"] / f"{task['task_id']}.json.gz"
            path = raw_root / relative
            payload["_psd_task"] = {"task_id": task["task_id"], "url": safe_url, "retrieved_at": retrieved_at}
            atomic_json_gz(path, payload)
            response_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            status = "completed" if rows else "no_data"
            connection.execute("""
              UPDATE tasks SET status = ?, raw_path = ?, record_count = ?, response_sha256 = ?,
                error = NULL, not_before = NULL, updated_at = ? WHERE task_id = ?
            """, (status, str(path.relative_to(WORKSPACE)), len(rows), response_hash, retrieved_at, task["task_id"]))
            connection.commit()
            print(f"{status} {task['reporter_iso3']} {task['product_type']}{task['frequency']} {task['period']} {task['flow_code']} partners={task['partner_codes']} rows={len(rows)}", flush=True)
        except urllib.error.HTTPError as exc:
            calls += 1
            record_call(connection)
            if exc.code == 429:
                backoff_seconds = 10
                not_before = (datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                connection.execute("UPDATE tasks SET status = 'queued', not_before = ?, error = ?, updated_at = ? WHERE task_id = ?", (not_before, "HTTP 429", now_iso(), task["task_id"]))
                connection.commit()
                print(f"rate-limited; task deferred until {not_before}", flush=True)
                time.sleep(backoff_seconds)
                continue
            connection.execute("UPDATE tasks SET status = 'error', error = ?, updated_at = ? WHERE task_id = ?", (f"HTTP {exc.code}: {exc.reason}", now_iso(), task["task_id"]))
            connection.commit()
        except Exception as exc:
            calls += 1
            record_call(connection)
            status = "queued" if int(task["attempts"]) < 4 else "error"
            not_before = (datetime.now(timezone.utc) + timedelta(seconds=min(2 ** (int(task["attempts"]) + 1), 60))).replace(microsecond=0).isoformat().replace("+00:00", "Z") if status == "queued" else None
            connection.execute("UPDATE tasks SET status = ?, not_before = ?, error = ?, updated_at = ? WHERE task_id = ?", (status, not_before, f"{type(exc).__name__}: {exc}", now_iso(), task["task_id"]))
            connection.commit()
            print(f"{status} {task['task_id'][:10]}: {type(exc).__name__}: {exc}", flush=True)
    print(f"crawl calls={calls}; UTC daily state usage={daily_calls(connection)}/{daily_limit}", flush=True)


def print_status(connection: sqlite3.Connection) -> None:
    print("tasks by status")
    for row in connection.execute("SELECT status, COUNT(*) AS count, COALESCE(SUM(record_count), 0) AS rows FROM tasks GROUP BY status ORDER BY status"):
        print(f"  {row['status']}: {row['count']} tasks, {row['rows']} rows")
    print("availability by product/frequency/period")
    for row in connection.execute("SELECT product_type, frequency, period, COUNT(*) AS count, MAX(last_released) AS latest FROM availability GROUP BY product_type, frequency, period ORDER BY period DESC, product_type, frequency"):
        print(f"  {row['product_type']}{row['frequency']} {row['period']}: {row['count']} reporters; released through {row['latest']}")
    print(f"UTC calls recorded today: {daily_calls(connection)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    init = subparsers.add_parser("init", help="Refresh fresh availability and queue detailed work")
    init.add_argument("--annual-year", type=int)
    init.add_argument("--months", type=int)
    init.add_argument("--daily-limit", type=int)
    crawl_parser = subparsers.add_parser("crawl", help="Execute a bounded crawl slice")
    crawl_parser.add_argument("--max-calls", type=int)
    crawl_parser.add_argument("--daily-limit", type=int)
    crawl_parser.add_argument("--allow-preview", action="store_true")
    subparsers.add_parser("status", help="Show availability and queue progress")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = read_json(CONFIG_PATH)
    crawl_config = config["warehouse_crawl"]
    state_path = WORKSPACE / crawl_config["state_path"]
    connection = connect(state_path)
    limiter = RateLimiter(float(config["access"]["minimum_seconds_between_calls"]))
    references_root = WORKSPACE / "data/sources/trade/crawler/reference"
    references = sync_references(config, references_root, limiter)
    if args.command == "init":
        daily_limit = args.daily_limit if args.daily_limit is not None else int(crawl_config["calls_per_utc_day"])
        sync_availability(
            connection, config, WORKSPACE / crawl_config["availability_path"], limiter,
            args.annual_year, args.months, daily_limit,
        )
        inserted = schedule_tasks(connection, config, read_json(references["partners"]))
        print(f"queued {inserted} new tasks", flush=True)
        print_status(connection)
    elif args.command == "crawl":
        crawl(connection, config, references, args)
        print_status(connection)
    else:
        print_status(connection)
    connection.close()


if __name__ == "__main__":
    main()
