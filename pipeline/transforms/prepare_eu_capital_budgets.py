#!/usr/bin/env python3
"""Download official capital-city budget sources and build the website dataset."""

from __future__ import annotations

import os

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from country_registry import to_alpha2, to_alpha3


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
DEFAULT_REGISTRY = ROOT / "data" / "eu_capital_budget_sources_2026.json"
DEFAULT_OUTPUT = ROOT / "data" / "eu_capital_budgets_2026.json"
DEFAULT_CACHE = ROOT / "data" / "source_cache" / "eu_capital_budgets_2026"
PUBLIC_OUTPUTS = (
    ROOT / "website" / "data" / "eu-capital-budgets.v1.json",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def content_matches_extension(path: Path) -> bool:
    head = path.read_bytes()[:16]
    extension = path.suffix.lower()
    if extension == ".pdf":
        return head.startswith(b"%PDF")
    if extension in {".xlsx", ".zip"}:
        return head.startswith(b"PK")
    return True


def download(city: dict, cache_dir: Path, refresh: bool) -> dict:
    attempts = []
    candidates = [
        {
            "url": city["download_url"],
            "filename": city["source_filename"],
            "archive_kind": "official_source",
        },
        {
            "url": city["landing_page_url"],
            "filename": city["source_filename"],
            "archive_kind": "official_source",
        },
        *city.get("archive_fallbacks", []),
    ]
    unique_candidates = []
    seen = set()
    for candidate in candidates:
        key = (candidate["url"], candidate["filename"])
        if key not in seen:
            unique_candidates.append(candidate)
            seen.add(key)
    cache_dir.mkdir(parents=True, exist_ok=True)
    if not refresh:
        for candidate in unique_candidates:
            target = cache_dir / candidate["filename"]
            if target.exists() and target.stat().st_size:
                return {
                    "path": target,
                    "url": candidate["url"],
                    "download_status": "cached",
                    "archive_kind": candidate.get("archive_kind", "official_source"),
                }
    for candidate in unique_candidates:
        url = candidate["url"]
        target = cache_dir / candidate["filename"]
        suffix = target.suffix or ".bin"
        with tempfile.NamedTemporaryFile(dir=cache_dir, suffix=suffix, delete=False) as temp:
            temp_path = Path(temp.name)
        cmd = [
            "curl", "--location", "--fail", "--silent", "--show-error",
            "--retry", "2", "--connect-timeout", "20", "--max-time", "180",
            "--user-agent", "czbudget-source-archiver/1.0 (+https://czbudget.com)",
            "--output", str(temp_path), url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if (
            result.returncode == 0
            and temp_path.exists()
            and temp_path.stat().st_size
            and content_matches_extension(temp_path)
        ):
            temp_path.replace(target)
            return {
                "path": target,
                "url": url,
                "download_status": "downloaded",
                "archive_kind": candidate.get("archive_kind", "official_source"),
            }
        detail = result.stderr.strip() or "empty or unexpected response type"
        attempts.append(f"{url}: {detail}")
        temp_path.unlink(missing_ok=True)
    snapshot = city.get("archive_snapshot")
    if snapshot:
        target = cache_dir / snapshot["filename"]
        payload = {
            "archive_kind": "reviewed_official_source_snapshot",
            "official_source_url": city["download_url"],
            "landing_page_url": city["landing_page_url"],
            "captured_facts": snapshot["captured_facts"],
            "reason": snapshot["reason"],
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return {
            "path": target,
            "url": city["download_url"],
            "download_status": "registry_snapshot",
            "archive_kind": "reviewed_official_source_snapshot",
        }
    raise RuntimeError(" | ".join(attempts))


def decimal_json(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def amount_payload(local_amount: Decimal, currency: str, rate: Decimal) -> dict:
    eur_amount = (local_amount / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "local_amount": decimal_json(local_amount),
        "local_currency": currency,
        "eur_amount": decimal_json(eur_amount),
    }


def component_kind(code: str) -> str:
    if code.startswith("functional_"):
        return "functional"
    if code.endswith("_revenue") or code in {
        "service_income", "property_tax_and_general_grant", "commercial_rates", "credit_balance_funding"
    }:
        return "revenue"
    if any(token in code for token in ("capital", "investment", "fixed_asset")):
        return "capital"
    if "financing" in code:
        return "financing"
    if code.endswith("_expenditure") or code.endswith("_expense"):
        return "operating"
    if any(token in code for token in (
        "operating", "current", "service", "transfer", "personnel", "maintenance", "administration",
        "depreciation", "housing", "transport", "water", "development", "environment", "recreation",
        "agriculture", "miscellaneous",
    )):
        return "operating"
    return "other"


def build_fiscal_details(source: dict, local_amount: Decimal, currency: str, rate: Decimal) -> dict:
    raw_components = source.get("components", {})
    source_detail = source.get("fiscal_detail", {})
    revenue = Decimal(raw_components["revenue"]) if raw_components.get("revenue") is not None else None
    if source_detail.get("balance_local_amount") is not None:
        balance = Decimal(source_detail["balance_local_amount"])
    elif raw_components.get("deficit") is not None:
        balance = -Decimal(raw_components["deficit"])
    elif raw_components.get("surplus") is not None:
        balance = Decimal(raw_components["surplus"])
    elif revenue is not None:
        balance = revenue - local_amount
    else:
        balance = None

    components = []
    for code, value in raw_components.items():
        if code in {"revenue", "deficit", "surplus"}:
            continue
        amount = Decimal(value)
        payload = amount_payload(amount, currency, rate)
        payload.update({
            "component_code": code,
            "component_kind": component_kind(code),
            "share_of_headline_pct": decimal_json(
                (amount / local_amount * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ) if local_amount else None,
        })
        components.append(payload)

    if balance is None:
        classification = "unavailable"
    elif balance > 0:
        classification = "surplus"
    elif balance < 0:
        classification = "deficit"
    else:
        classification = "balanced"
    if revenue is not None and len(components) >= 2:
        completeness = "detailed"
    elif revenue is not None or components:
        completeness = "partial"
    else:
        completeness = "headline_only"

    return {
        "revenue": amount_payload(revenue, currency, rate) if revenue is not None else None,
        "expenditure": amount_payload(local_amount, currency, rate),
        "balance": amount_payload(balance, currency, rate) if balance is not None else None,
        "balance_classification": classification,
        "balance_basis": source_detail.get(
            "balance_basis",
            "reported_deficit" if raw_components.get("deficit") is not None else
            "reported_surplus" if raw_components.get("surplus") is not None else
            "revenue_minus_headline_expenditure" if balance is not None else "not_available",
        ),
        "balance_note_en": source_detail.get(
            "balance_note_en",
            "Calculated as reported revenue minus the displayed expenditure measure." if balance is not None else
            "The current source extraction does not contain a revenue total, so a defensible budget balance cannot be calculated.",
        ),
        "balance_note_cs": source_detail.get(
            "balance_note_cs",
            "Výpočet používá vykázané příjmy minus zobrazenou hodnotu výdajů." if balance is not None else
            "Současná extrakce zdroje neobsahuje celkové příjmy, proto nelze spolehlivě vypočítat saldo rozpočtu.",
        ),
        "balance_margin_pct": decimal_json(
            (balance / revenue * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        ) if balance is not None and revenue else None,
        "components": components,
        "data_completeness": completeness,
    }


def archive_and_validate_fx(fx: dict, cache_dir: Path, refresh: bool) -> dict:
    target = cache_dir / f"ecb-euro-reference-rates-{fx['date']}.xml"
    if refresh or not target.exists() or not target.stat().st_size:
        cache_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=cache_dir, suffix=".xml", delete=False) as temp:
            temp_path = Path(temp.name)
        result = subprocess.run(
            [
                "curl", "--location", "--fail", "--silent", "--show-error",
                "--retry", "2", "--connect-timeout", "20", "--max-time", "120",
                "--user-agent", "czbudget-source-archiver/1.0 (+https://czbudget.com)",
                "--output", str(temp_path), fx["source_url"],
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not temp_path.stat().st_size:
            temp_path.unlink(missing_ok=True)
            raise RuntimeError(f"ECB rate archive failed: {result.stderr.strip()}")
        temp_path.replace(target)

    document = ET.parse(target).getroot()
    dated_rates = None
    for element in document.iter():
        if element.attrib.get("time") == fx["date"]:
            dated_rates = {child.attrib["currency"]: child.attrib["rate"] for child in element}
            break
    if dated_rates is None:
        raise ValueError(f"ECB archive has no rate set for {fx['date']}")
    for currency, expected in fx["rates"].items():
        if currency in {"EUR", "BGN"}:
            continue
        actual = dated_rates.get(currency)
        if actual is None or Decimal(actual) != Decimal(expected):
            raise ValueError(f"ECB rate mismatch for {currency}: expected {expected}, found {actual}")
    return {
        "file": str(target.relative_to(ROOT)),
        "sha256": sha256(target),
        "bytes": target.stat().st_size,
        "downloaded_from": fx["source_url"],
        "download_status": "downloaded" if refresh else "cached_or_downloaded",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-downloads", action="store_true")
    args = parser.parse_args()

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    cities = registry["cities"]
    if len(cities) != 28:
        raise ValueError(f"Expected 28 cities (27 EU capitals + London), found {len(cities)}")
    ids = [city["city_id"] for city in cities]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate city_id in registry")

    download_results: dict[str, dict] = {}
    failures: dict[str, str] = {}
    if not args.skip_downloads:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(download, city, args.cache_dir, args.refresh): city
                for city in cities
            }
            for future in concurrent.futures.as_completed(futures):
                city = futures[future]
                try:
                    download_results[city["city_id"]] = future.result()
                except Exception as exc:  # keep the registry usable while making gaps explicit
                    failures[city["city_id"]] = str(exc)

    fx = registry["methodology"]["fx"]
    fx_archive = archive_and_validate_fx(fx, args.cache_dir, args.refresh)
    rates = {key: Decimal(value) for key, value in fx["rates"].items()}
    normalized = []
    for source in cities:
        currency = source["currency_code"]
        if currency not in rates:
            raise ValueError(f"Missing ECB rate for {currency}")
        local = Decimal(source["local_amount"])
        eur = (local / rates[currency]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        record = {key: value for key, value in source.items() if key not in {"local_amount", "fiscal_detail"}}
        # B2 — the source registry records whatever form the upstream publisher uses; the
        # published artifact carries the canonical one. Canonicalise on write, not upstream.
        record["country_code"] = to_alpha3(record["country_code"])
        # Display APIs (Intl.DisplayNames, flag assets) key on alpha-2 and throw on alpha-3,
        # so the artifact carries both: the canonical code for identity, alpha-2 for display.
        record["alpha2"] = to_alpha2(record["country_code"])
        record["budget"] = {
            "local_amount": decimal_json(local),
            "local_currency": currency,
            "eur_amount": decimal_json(eur),
            "eur_conversion_rate": decimal_json(rates[currency]),
            "eur_conversion_formula": "local_amount / local_currency_units_per_eur",
        }
        record["fiscal_details"] = build_fiscal_details(source, local, currency, rates[currency])
        result = download_results.get(source["city_id"])
        if result:
            path = result["path"]
            record["source_archive"] = {
                "file": str(path.relative_to(ROOT)),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "downloaded_from": result["url"],
                "download_status": result["download_status"],
                "archive_kind": result["archive_kind"],
            }
        elif source["city_id"] in failures:
            record["source_archive"] = {
                "download_status": "failed",
                "error": failures[source["city_id"]],
            }
        normalized.append(record)

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    methodology = json.loads(json.dumps(registry["methodology"]))
    methodology["fx"]["source_archive"] = fx_archive
    output = {
        "schema_version": "1.0.0",
        "dataset_id": registry["dataset_id"],
        "generated_at": now,
        "coverage": {
            "city_count": len(normalized),
            "eu_capital_count": sum(1 for city in normalized if city["eu_capital"]),
            "extra_city_count": sum(1 for city in normalized if city.get("extra_city")),
            "source_archives_downloaded": sum(
                1 for city in normalized if city.get("source_archive", {}).get("download_status") in {"downloaded", "cached"}
            ),
            "source_archives_available": sum(1 for city in normalized if city.get("source_archive", {}).get("file")),
            "reviewed_source_snapshots": sum(
                1 for city in normalized if city.get("source_archive", {}).get("download_status") == "registry_snapshot"
            ),
            "source_archive_failures": len(failures),
        },
        "methodology": methodology,
        "cities": normalized,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for destination in PUBLIC_OUTPUTS:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(args.output, destination)

    print(f"Wrote {len(normalized)} city records to {args.output}")
    print(f"Archived {output['coverage']['source_archives_downloaded']} sources; {len(failures)} failed")
    for city_id, error in sorted(failures.items()):
        print(f"FAILED {city_id}: {error}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
