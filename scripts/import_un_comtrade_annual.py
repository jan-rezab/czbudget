#!/usr/bin/env python3
"""Fetch and normalize annual HS2 merchandise trade from UN Comtrade.

The importer is deliberately resumable. Each reporter/flow response is written
atomically before the next API call, and existing valid responses are reused.
The default 195-country run needs at most 390 data calls (imports + exports),
which stays below the configured 400-call run budget and the documented
500-call daily allowance for a free registered account.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[1]
WORKSPACE = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", REPO.parent))
CONFIG_PATH = REPO / "pipeline/config/un_comtrade_source.v1.json"
UNIVERSE_PATH = REPO / "pipeline/config/sovereign_country_universe.json"
OUTPUT_DIR = REPO / "data/trade"
USER_AGENT = "publicspendingdata.org/1.0 annual UN Comtrade importer"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def atomic_json(path: Path, payload: Any, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":") if compact else None,
        indent=None if compact else 2,
    ) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)
    path.chmod(0o644)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class RateLimiter:
    def __init__(self, minimum_interval: float) -> None:
        self.minimum_interval = minimum_interval
        self.last_call_at: float | None = None

    def wait(self) -> None:
        if self.last_call_at is not None:
            remaining = self.minimum_interval - (time.monotonic() - self.last_call_at)
            if remaining > 0:
                time.sleep(remaining)
        self.last_call_at = time.monotonic()


def request_json(url: str, *, rate_limiter: RateLimiter | None = None, retries: int = 5) -> dict[str, Any]:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    request = urllib.request.Request(url, headers=headers)
    for attempt in range(retries):
        if rate_limiter:
            rate_limiter.wait()
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8-sig"))
            if not isinstance(payload, dict):
                raise RuntimeError(f"Expected a JSON object from {url}")
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code not in {429, 500, 502, 503, 504} or attempt == retries - 1:
                raise
            retry_after = exc.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else min(2 ** (attempt + 1), 30)
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == retries - 1:
                raise
            time.sleep(min(2 ** (attempt + 1), 30))
    raise RuntimeError(f"Failed to retrieve {url}")


def gdp_for_country(country_code: str, year: int) -> tuple[float | None, int | None]:
    profile_path = REPO / "data/countries" / country_code.lower() / "profile.v1.json"
    if not profile_path.exists():
        return None, None
    profile = read_json(profile_path)
    values = profile.get("data", {}).get("sovereign", {}).get("series", {}).get("metrics", {}).get("nominal_gdp_usd_bn", {}).get("values", [])
    candidates = [row for row in values if isinstance(row.get("value"), (int, float)) and int(row.get("year", 0)) <= year]
    if not candidates:
        return None, None
    selected = max(candidates, key=lambda row: int(row["year"]))
    return float(selected["value"]), int(selected["year"])


def ranked_countries(universe: list[dict[str, Any]], year: int) -> list[dict[str, Any]]:
    ranked = []
    for country in universe:
        gdp, gdp_year = gdp_for_country(country["iso3"], year)
        ranked.append({**country, "ranking_gdp_usd_bn": gdp, "ranking_gdp_year": gdp_year})
    ranked.sort(key=lambda country: (
        country["ranking_gdp_usd_bn"] is None,
        -(country["ranking_gdp_usd_bn"] or 0),
        country["name_en"],
    ))
    for index, country in enumerate(ranked, start=1):
        country["gdp_rank"] = index if country["ranking_gdp_usd_bn"] is not None else None
    return ranked


def active_reporters(reference: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in reference.get("results", []):
        iso3 = str(row.get("reporterCodeIsoAlpha3", "")).strip().upper()
        if len(iso3) != 3 or row.get("isGroup") or row.get("entryExpiredDate"):
            continue
        result[iso3] = row
    return result


def product_chapters(reference: dict[str, Any]) -> dict[str, str]:
    chapters: dict[str, str] = {}
    for row in reference.get("results", []):
        code = str(row.get("id", ""))
        if int(row.get("aggrlevel", -1)) != 2 or len(code) != 2:
            continue
        text = str(row.get("text", code))
        prefix = f"{code} - "
        chapters[code] = text[len(prefix):] if text.startswith(prefix) else text
    return dict(sorted(chapters.items()))


def safe_api_url(config: dict[str, Any], year: int, reporter_code: int, flow_code: str, api_key: str | None) -> tuple[str, str]:
    access = config["access"]
    request = config["request"]
    endpoint = access["authenticated_endpoint"] if api_key else access["anonymous_endpoint"]
    path = f"{config['api_base']}{endpoint}/{request['type_code']}/{request['frequency_code']}/{request['classification_code']}"
    params = {
        "period": str(year),
        "reporterCode": str(reporter_code),
        "partnerCode": str(request["partner_code"]),
        "partner2Code": str(request["second_partner_code"]),
        "customsCode": request["customs_code"],
        "motCode": str(request["mode_of_transport_code"]),
        "flowCode": flow_code,
        "cmdCode": request["commodity_code"],
        "maxRecords": str(access["anonymous_record_limit_per_call"]),
    }
    safe_url = f"{path}?{urllib.parse.urlencode(params)}"
    if api_key:
        params["subscription-key"] = api_key
    return f"{path}?{urllib.parse.urlencode(params)}", safe_url


def valid_raw_response(payload: dict[str, Any], year: int, reporter_code: int, flow_code: str) -> bool:
    rows = payload.get("data")
    if not isinstance(rows, list):
        return False
    seen_codes: set[str] = set()
    for row in rows:
        code = str(row.get("cmdCode", ""))
        if (
            int(row.get("refYear", year)) != year
            or int(row.get("reporterCode", reporter_code)) != reporter_code
            or row.get("flowCode") != flow_code
            or int(row.get("partnerCode", 0)) != 0
            or int(row.get("partner2Code", 0)) != 0
            or row.get("customsCode") != "C00"
            or int(row.get("motCode", 0)) != 0
            or code in seen_codes
        ):
            return False
        seen_codes.add(code)
    return True


def normalized_flow(payload: dict[str, Any], chapters: dict[str, str]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_code: dict[str, dict[str, Any]] = {}
    classifications: set[str] = set()
    for source in payload.get("data", []):
        code = str(source.get("cmdCode", ""))
        value = source.get("primaryValue")
        if code not in chapters or not isinstance(value, (int, float)):
            continue
        classifications.add(str(source.get("classificationCode", "")))
        by_code[code] = {
            "product_code": code,
            "value_usd": round(float(value), 2),
            "net_weight_kg": round(float(source["netWgt"]), 3) if isinstance(source.get("netWgt"), (int, float)) and source.get("netWgt") else None,
            "value_is_reported": bool(source.get("isReported")),
            "value_is_aggregate": bool(source.get("isAggregate")),
        }
    rows = sorted(by_code.values(), key=lambda row: (-row["value_usd"], row["product_code"]))
    return rows, {
        "total_value_usd": round(sum(row["value_usd"] for row in rows), 2),
        "product_count": len(rows),
        "classification_codes": sorted(code for code in classifications if code),
    }


def build_output(
    config: dict[str, Any],
    countries: list[dict[str, Any]],
    reporters: dict[str, dict[str, Any]],
    chapters: dict[str, str],
    raw_dir: Path,
    year: int,
    generated_at: str,
) -> dict[str, Any]:
    output_countries = []
    flow_names = config["request"]["flows"]
    for country in countries:
        reporter = reporters.get(country["iso3"])
        record: dict[str, Any] = {
            "country_code": country["iso3"],
            "name_cs": country["name_cs"],
            "name_en": country["name_en"],
            "gdp_rank": country["gdp_rank"],
            "ranking_gdp_usd_bn": country["ranking_gdp_usd_bn"],
            "ranking_gdp_year": country["ranking_gdp_year"],
            "reporter_code": reporter.get("reporterCode") if reporter else None,
            "status": "reporter_not_mapped" if not reporter else "not_fetched",
            "flows": {},
        }
        if reporter:
            for flow_code, flow_name in flow_names.items():
                raw_path = raw_dir / f"{country['iso3']}-{flow_code}.json"
                if not raw_path.exists():
                    record["flows"][flow_name] = {"status": "not_fetched", "products": []}
                    continue
                payload = read_json(raw_path)
                if not valid_raw_response(payload, year, int(reporter["reporterCode"]), flow_code):
                    record["flows"][flow_name] = {"status": "invalid_cache", "products": []}
                    continue
                rows, summary = normalized_flow(payload, chapters)
                record["flows"][flow_name] = {"status": "loaded" if rows else "no_data", **summary, "products": rows}
            statuses = [flow["status"] for flow in record["flows"].values()]
            record["status"] = "loaded" if statuses and all(status == "loaded" for status in statuses) else "partial" if "loaded" in statuses else "no_data" if statuses and all(status == "no_data" for status in statuses) else "not_fetched"
        imports = record["flows"].get("imports", {})
        exports = record["flows"].get("exports", {})
        if isinstance(imports.get("total_value_usd"), (int, float)) and isinstance(exports.get("total_value_usd"), (int, float)):
            record["trade_balance_usd"] = round(exports["total_value_usd"] - imports["total_value_usd"], 2)
        output_countries.append(record)

    statuses = {status: sum(country["status"] == status for country in output_countries) for status in sorted({country["status"] for country in output_countries})}
    return {
        "schema_version": "1.0.0",
        "dataset_id": f"un-comtrade-annual-hs2-{year}",
        "generated_at": generated_at,
        "period": {"frequency": "annual", "year": year, "calendar_period": f"{year}-01-01/{year}-12-31"},
        "source": {
            "source_id": config["source_id"],
            "title": config["title"],
            "publisher": config["publisher"],
            "homepage": config["homepage"],
            "documentation": config["documentation"],
            "data_availability": config["data_availability"],
            "retrieved_at": generated_at,
        },
        "grain": config["grain"],
        "dimensions": {
            "product_type": "merchandise",
            "frequency_code": config["request"]["frequency_code"],
            "classification_request": config["request"]["classification_code"],
            "aggregation": "HS two-digit chapter",
            "partner_code": config["request"]["partner_code"],
            "partner": "World",
            "customs_code": config["request"]["customs_code"],
            "mode_of_transport_code": config["request"]["mode_of_transport_code"],
            "flow_codes": config["request"]["flows"],
            "value_field": config["value"]["field"],
            "value_unit": config["value"]["unit"],
        },
        "ranking": config["ranking"],
        "coverage": {
            "target_country_count": len(output_countries),
            "mapped_reporter_count": sum(country["reporter_code"] is not None for country in output_countries),
            "status_counts": statuses,
            "loaded_flow_count": sum(flow.get("status") == "loaded" for country in output_countries for flow in country["flows"].values()),
        },
        "product_chapters": chapters,
        "countries": output_countries,
        "limitations": config["limitations"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, help="Calendar year to fetch (default from source contract)")
    parser.add_argument("--snapshot-date", default=date.today().isoformat(), help="Raw snapshot directory date (YYYY-MM-DD)")
    parser.add_argument("--limit", type=int, help="Attempt only the N largest selected countries")
    parser.add_argument("--countries", help="Comma-separated ISO3 reporters; still ordered largest to smallest")
    parser.add_argument("--max-calls", type=int, help="Maximum new data calls in this invocation")
    parser.add_argument("--refresh", action="store_true", help="Refetch responses already present in this snapshot")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = read_json(CONFIG_PATH)
    year = args.year or int(config["default_year"])
    max_calls = args.max_calls if args.max_calls is not None else int(config["access"]["pipeline_call_budget_per_run"])
    if max_calls < 0 or max_calls > int(config["access"]["free_account_calls_per_day"]):
        raise SystemExit(f"--max-calls must be between 0 and {config['access']['free_account_calls_per_day']}")

    raw_dir = WORKSPACE / "data/sources/trade" / args.snapshot_date / "un-comtrade" / "annual" / str(year)
    reference_dir = raw_dir.parent.parent / "reference"
    reference_dir.mkdir(parents=True, exist_ok=True)
    reporters_path = reference_dir / "Reporters.json"
    products_path = reference_dir / "H6.json"
    reference_urls = {
        reporters_path: f"{config['api_base']}/files/v1/app/reference/Reporters.json",
        products_path: f"{config['api_base']}/files/v1/app/reference/H6.json",
    }
    for path, url in reference_urls.items():
        if args.refresh or not path.exists():
            atomic_json(path, request_json(url), compact=True)

    reporters = active_reporters(read_json(reporters_path))
    chapters = product_chapters(read_json(products_path))
    universe = read_json(UNIVERSE_PATH)["countries"]
    countries = ranked_countries(universe, year)
    if args.countries:
        selected = {code.strip().upper() for code in args.countries.split(",") if code.strip()}
        unknown = selected - {country["iso3"] for country in countries}
        if unknown:
            raise SystemExit(f"Unknown sovereign country code(s): {', '.join(sorted(unknown))}")
        countries = [country for country in countries if country["iso3"] in selected]
    if args.limit is not None:
        if args.limit < 1:
            raise SystemExit("--limit must be positive")
        countries = countries[:args.limit]

    api_key = os.environ.get(config["access"]["api_key_environment_variable"])
    rate_limiter = RateLimiter(float(config["access"]["minimum_seconds_between_calls"]))
    flow_names = config["request"]["flows"]
    calls = 0
    cached = 0
    failures: list[dict[str, Any]] = []
    raw_dir.mkdir(parents=True, exist_ok=True)

    print(f"UN Comtrade annual {year}: {len(countries)} reporters, largest to smallest; call budget {max_calls}", flush=True)
    for index, country in enumerate(countries, start=1):
        reporter = reporters.get(country["iso3"])
        if not reporter:
            print(f"[{index}/{len(countries)}] {country['iso3']}: no active Comtrade reporter mapping", flush=True)
            continue
        flow_results = []
        for flow_code, flow_name in flow_names.items():
            raw_path = raw_dir / f"{country['iso3']}-{flow_code}.json"
            if raw_path.exists() and not args.refresh:
                payload = read_json(raw_path)
                if valid_raw_response(payload, year, int(reporter["reporterCode"]), flow_code):
                    cached += 1
                    flow_results.append(f"{flow_name}=cached:{len(payload.get('data', []))}")
                    continue
            if calls >= max_calls:
                flow_results.append(f"{flow_name}=deferred")
                continue
            url, safe_url = safe_api_url(config, year, int(reporter["reporterCode"]), flow_code, api_key)
            try:
                payload = request_json(url, rate_limiter=rate_limiter)
                calls += 1
                if not valid_raw_response(payload, year, int(reporter["reporterCode"]), flow_code):
                    raise RuntimeError("Response dimensions did not match the request")
                payload["_psd_request"] = {
                    "url": safe_url,
                    "retrieved_at": now_iso(),
                    "country_code": country["iso3"],
                    "flow_name": flow_name,
                }
                atomic_json(raw_path, payload, compact=True)
                flow_results.append(f"{flow_name}=downloaded:{len(payload.get('data', []))}")
            except Exception as exc:  # keep the run resumable across country-specific failures
                failures.append({"country_code": country["iso3"], "flow_code": flow_code, "error": f"{type(exc).__name__}: {exc}"})
                flow_results.append(f"{flow_name}=failed")
        print(f"[{index}/{len(countries)}] {country['iso3']} #{country['gdp_rank'] or '-'}: {', '.join(flow_results)}", flush=True)

    generated_at = now_iso()
    output = build_output(config, countries, reporters, chapters, raw_dir, year, generated_at)
    output_path = OUTPUT_DIR / f"annual-hs2-{year}.v1.json"
    atomic_json(output_path, output, compact=True)
    manifest = {
        "schema_version": "1.0.0",
        "source_id": config["source_id"],
        "generated_at": generated_at,
        "year": year,
        "snapshot_date": args.snapshot_date,
        "selection": [country["iso3"] for country in countries],
        "order": "nominal_gdp_usd_desc",
        "api_mode": "authenticated" if api_key else "anonymous_preview",
        "new_data_calls": calls,
        "cached_responses": cached,
        "failures": failures,
        "output": {
            "path": str(output_path.relative_to(REPO)),
            "bytes": output_path.stat().st_size,
            "sha256": sha256(output_path),
            "coverage": output["coverage"],
        },
        "references": [
            {"path": str(path.relative_to(WORKSPACE)), "bytes": path.stat().st_size, "sha256": sha256(path), "url": url}
            for path, url in reference_urls.items()
        ],
    }
    atomic_json(raw_dir / "manifest.json", manifest)
    print(f"Wrote {output_path.relative_to(REPO)}; calls={calls}, cached={cached}, failures={len(failures)}, statuses={output['coverage']['status_counts']}", flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
