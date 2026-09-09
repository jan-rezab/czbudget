#!/usr/bin/env python3
"""Build the normalized, static CityVizor financial-record layer used by PSD.

The source snapshot stays outside the web repository.  The generated layer keeps
every published accounting, event, plan and preferred invoice-view row in
small deterministic gzip shards and adds compact organization/year summaries.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", WEB_ROOT.parent))
SCHEMA_VERSION = "1.0.0"
DETAIL_SCHEMA_VERSION = "1.0.0"
DEFAULT_SHARD_ROWS = 5_000
MONEY_FIELDS = (
    "incomeAmount",
    "budgetIncomeAmount",
    "expenditureAmount",
    "budgetExpenditureAmount",
)
PAYMENT_MONEY_FIELDS = ("incomeAmount", "expenditureAmount")
PAYMENT_COLUMNS = (
    "row_id",
    "date",
    "income_cents",
    "expenditure_cents",
    "counterparty_id",
    "counterparty_name",
    "description",
    "paragraph",
    "item",
    "unit",
    "event",
)
ACCOUNTING_COLUMNS = (
    "type",
    "paragraph",
    "item",
    "unit",
    "event",
    "income_actual_cents",
    "income_budget_cents",
    "expenditure_actual_cents",
    "expenditure_budget_cents",
)
EVENT_COLUMNS = (
    "event",
    "name",
    "income_actual_cents",
    "income_budget_cents",
    "expenditure_actual_cents",
    "expenditure_budget_cents",
)
PLAN_COLUMNS = (
    "synthetic_account",
    "analytic_account",
    "analytic_label",
    "income_actual_cents",
    "income_budget_cents",
    "expenditure_actual_cents",
    "expenditure_budget_cents",
)
ACCOUNTING_TYPE_DEFINITIONS = {
    "ROZ": "Adjusted budget record (upraveny rozpocet).",
    "KDF": "Incoming invoice record (dosla faktura).",
    "KOF": "Outgoing invoice record (odeslana faktura).",
    "other": "Other/provider-specific accounting record; the source does not publish a universal expansion for every code.",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"), parse_float=Decimal)


def read_gzip_json(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle, parse_float=Decimal)


def json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(type(value).__name__)


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, default=json_default) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def gzip_bytes(value: bytes) -> bytes:
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", compresslevel=9, mtime=0) as handle:
        handle.write(value)
    return output.getvalue()


def write_json(path: Path, value) -> dict:
    raw = json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return {"path": path.name, "bytes": len(raw), "sha256": sha256_bytes(raw)}


def write_gzip_asset(directory: Path, stem: str, payload: dict, rows: int) -> dict:
    raw = json_bytes(payload)
    raw_sha = sha256_bytes(raw)
    compressed = gzip_bytes(raw)
    filename = f"{stem}.{raw_sha[:12]}.json.gz"
    path = directory / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compressed)
    return {
        "file": filename,
        "rows": rows,
        "bytes": len(compressed),
        "uncompressed_bytes": len(raw),
        "sha256": sha256_bytes(compressed),
        "content_sha256": raw_sha,
    }


def cents(value, field: str) -> int:
    try:
        amount = Decimal(str(value or 0)) * 100
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid monetary value for {field}: {value!r}") from exc
    if not amount.is_finite() or amount != amount.to_integral_value():
        raise ValueError(f"Non-cent monetary value for {field}: {value!r}")
    return int(amount)


def code(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def normalize_date(value):
    if value in (None, ""):
        return None
    text = str(value).strip()
    if re.fullmatch(r"-?\d+", text):
        return datetime.fromtimestamp(int(text) / 1000, tz=timezone.utc).date().isoformat()
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", text)
    if not match:
        raise ValueError(f"Invalid payment date: {value!r}")
    return match.group(1)


def normalized_name(value):
    value = unicodedata.normalize("NFKC", str(value or ""))
    return " ".join(value.casefold().split())


def valid_czech_ico(value: str | None) -> bool:
    if not value or not re.fullmatch(r"\d{8}", value):
        return False
    weighted = sum(int(value[i]) * (8 - i) for i in range(7)) % 11
    check = (11 - weighted) % 10
    return check == int(value[-1])


def counterparty_key(identifier, name):
    identifier = code(identifier)
    if identifier:
        return "id:" + identifier
    name_key = normalized_name(name)
    return "name:" + name_key if name_key else "unknown"


def profile_path(key: str) -> Path:
    host, identifier = key.split("/", 1)
    safe_host = re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")
    if not re.fullmatch(r"\d+", identifier):
        raise ValueError(f"Unsafe CityVizor profile key: {key}")
    return Path("profiles") / safe_host / identifier


def source_rows_from_zip(path: Path, member: str):
    with zipfile.ZipFile(path) as archive:
        with archive.open(member) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")


def summary_bucket():
    return {
        "rows": 0,
        "income_cents": 0,
        "expenditure_cents": 0,
        "income_positive_cents": 0,
        "income_negative_cents": 0,
        "expenditure_positive_cents": 0,
        "expenditure_negative_cents": 0,
    }


def finance_bucket():
    return {
        "rows": 0,
        "income_actual_cents": 0,
        "income_budget_cents": 0,
        "expenditure_actual_cents": 0,
        "expenditure_budget_cents": 0,
    }


def add_finance(bucket, income_actual: int, income_budget: int, expenditure_actual: int, expenditure_budget: int):
    bucket["rows"] += 1
    bucket["income_actual_cents"] += income_actual
    bucket["income_budget_cents"] += income_budget
    bucket["expenditure_actual_cents"] += expenditure_actual
    bucket["expenditure_budget_cents"] += expenditure_budget


def sorted_finance(mapping, labels=None):
    labels = labels or {}
    return sorted(
        ({"key": key, "label": labels.get(key), **value} for key, value in mapping.items()),
        key=lambda row: (-abs(row["expenditure_actual_cents"]) - abs(row["income_actual_cents"]), str(row["key"])),
    )


def add_money(bucket, income: int, expenditure: int):
    bucket["rows"] += 1
    bucket["income_cents"] += income
    bucket["expenditure_cents"] += expenditure
    bucket["income_positive_cents"] += max(income, 0)
    bucket["income_negative_cents"] += min(income, 0)
    bucket["expenditure_positive_cents"] += max(expenditure, 0)
    bucket["expenditure_negative_cents"] += min(expenditure, 0)


def sorted_buckets(mapping, labels=None):
    labels = labels or {}
    output = []
    for key, value in mapping.items():
        output.append({"key": key, "label": labels.get(key), **value})
    return sorted(output, key=lambda row: (-abs(row["expenditure_cents"]) - abs(row["income_cents"]), str(row["key"])))


def codelist_lookup(rows, year: int):
    matches = []
    for row in rows:
        start = int(str(row.get("validFrom") or "0000")[:4])
        till = int(str(row.get("validTill") or "9999")[:4])
        if start <= year <= till:
            matches.append(row)
    return {str(row["id"]): row.get("name") for row in matches}


def payment_row(native, profile_key: str, year: int, occurrence: Counter):
    if int(native["year"]) != year:
        raise ValueError(f"Payment year mismatch in {profile_key}: {native.get('year')} != {year}")
    values = [
        normalize_date(native.get("date")),
        cents(native.get("incomeAmount"), "incomeAmount"),
        cents(native.get("expenditureAmount"), "expenditureAmount"),
        code(native.get("counterpartyId")),
        str(native.get("counterpartyName") or "").strip() or None,
        str(native.get("description") or "").strip() or None,
        code(native.get("paragraph")),
        code(native.get("item")),
        code(native.get("unit")),
        code(native.get("event")),
    ]
    identity = json_bytes([profile_key, year, *values])
    digest = hashlib.sha256(identity).hexdigest()[:20]
    ordinal = occurrence[digest]
    occurrence[digest] += 1
    return [f"{digest}-{ordinal}", *values], digest, ordinal


def accounting_row(native, profile_id: int, year: int):
    if str(native.get("profileId")) != str(profile_id) or int(native["year"]) != year:
        raise ValueError("Accounting row identity mismatch")
    return [
        code(native.get("type")),
        code(native.get("paragraph")),
        code(native.get("item")),
        code(native.get("unit")),
        code(native.get("event")),
        cents(native.get("incomeAmount"), "incomeAmount"),
        cents(native.get("budgetIncomeAmount"), "budgetIncomeAmount"),
        cents(native.get("expenditureAmount"), "expenditureAmount"),
        cents(native.get("budgetExpenditureAmount"), "budgetExpenditureAmount"),
    ]


def event_row(native, year: int):
    if int(native["year"]) != year:
        raise ValueError("Event row year mismatch")
    return [
        code(native.get("id")),
        str(native.get("name") or "").strip() or None,
        cents(native.get("incomeAmount"), "incomeAmount"),
        cents(native.get("budgetIncomeAmount"), "budgetIncomeAmount"),
        cents(native.get("expenditureAmount"), "expenditureAmount"),
        cents(native.get("budgetExpenditureAmount"), "budgetExpenditureAmount"),
    ]


def load_plan_labels(snapshot: Path, key: str, year: int):
    labels = {}
    for path in sorted((snapshot / key / str(year)).glob("plan-labels-*.json.gz")):
        for row in read_gzip_json(path):
            name = str(row.get("name") or "").strip() or None
            for item in row.get("items") or []:
                pair = (code(item.get("sa")), code(item.get("aa")))
                prior = labels.get(pair)
                if prior and name and prior != name:
                    raise ValueError(f"Conflicting PBO analytic label {key}/{year}/{pair}")
                if name:
                    labels[pair] = name
    return labels


def plan_row(native, profile_id: int, year: int, labels):
    if str(native.get("profileId")) != str(profile_id) or int(native["year"]) != year:
        raise ValueError("Plan row identity mismatch")
    sa, aa = code(native.get("sa")), code(native.get("aa"))
    return [
        sa,
        aa,
        labels.get((sa, aa)),
        cents(native.get("incomeAmount"), "incomeAmount"),
        cents(native.get("budgetIncomeAmount"), "budgetIncomeAmount"),
        cents(native.get("expenditureAmount"), "expenditureAmount"),
        cents(native.get("budgetExpenditureAmount"), "budgetExpenditureAmount"),
    ]


def shard_rows(directory: Path, kind: str, profile_key: str, year: int, columns, rows, shard_size: int):
    assets = []
    for index in range(0, len(rows), shard_size):
        subset = rows[index : index + shard_size]
        payload = {
            "schema_version": DETAIL_SCHEMA_VERSION,
            "kind": kind,
            "profile_key": profile_key,
            "year": year,
            "columns": list(columns),
            "rows": subset,
        }
        assets.append(write_gzip_asset(directory, f"{kind}-{index // shard_size + 1:04d}", payload, len(subset)))
    return assets


def money_totals(rows, indexes):
    result = {name: 0 for name in indexes}
    for row in rows:
        for name, index in indexes.items():
            result[name] += row[index]
    return result


def load_preferred_payments(snapshot: Path, profile: dict):
    key = profile["key"]
    if profile["profile"]["type"] == "pbo":
        pages = (profile.get("pbo_payments") or {}).get("pages", [])
        rows = []
        for page in pages:
            rows.extend(read_gzip_json(snapshot / page["path"]))
        expected = (profile.get("pbo_payments") or {}).get("rows", 0)
        if len(rows) != expected:
            raise ValueError(f"PBO payment row count mismatch for {key}")
        return "pbo_public_payments_api", rows
    recovery = snapshot / "json-payment-recovery" / key / "manifest.json"
    if recovery.exists():
        manifest = read_json(recovery)
        if not manifest.get("complete") or not manifest.get("terminal_empty_page"):
            raise ValueError(f"Incomplete payment recovery for {key}")
        rows = []
        for page in manifest["pages"]:
            path = snapshot / "json-payment-recovery" / page["path"]
            if sha256_file(path) != page["sha256"]:
                raise ValueError(f"Payment recovery checksum mismatch: {path}")
            rows.extend(read_gzip_json(path))
        if len(rows) != manifest["rows"]:
            raise ValueError(f"Recovered payment row count mismatch for {key}")
        return "municipal_public_payments_json_recovery", rows
    return "municipal_bulk_export_csv", None


def build_year(snapshot: Path, target: Path, profile: dict, year_meta: dict, preferred_kind: str, preferred_rows, codelists, shard_size: int):
    key = profile["key"]
    native = profile["profile"]
    year = int(year_meta["year"])
    source_zip = snapshot / year_meta["path"]
    if sha256_file(source_zip) != year_meta["sha256"]:
        raise ValueError(f"Source ZIP checksum mismatch: {source_zip}")
    relative = profile_path(key) / str(year)
    directory = target / relative

    raw_bulk_payments = list(source_rows_from_zip(source_zip, "payments.csv"))
    if preferred_rows is None:
        raw_payments = raw_bulk_payments
    else:
        raw_payments = [row for row in preferred_rows if int(row["year"]) == year]
    expected_payment_rows = year_meta["members"]["payments.csv"]["rows"]
    if preferred_kind == "municipal_public_payments_json_recovery":
        recovery = read_json(snapshot / "json-payment-recovery" / key / "manifest.json")
        expected_payment_rows = next(row["rows"] for row in recovery["years"] if int(row["year"]) == year)
    elif preferred_kind == "pbo_public_payments_api":
        # Row counts are independently reconciled by verify-cityvizor.py.
        expected_payment_rows = len(raw_payments)
    if len(raw_payments) != expected_payment_rows:
        raise ValueError(f"Preferred payment count mismatch for {key}/{year}")

    occurrence = Counter()
    duplicate_groups = Counter()
    payments = []
    counterparties = defaultdict(summary_bucket)
    paragraphs = defaultdict(summary_bucket)
    items = defaultdict(summary_bucket)
    units = defaultdict(summary_bucket)
    events = defaultdict(summary_bucket)
    months = defaultdict(summary_bucket)
    missing = Counter()
    first_date = last_date = None
    for native_row in raw_payments:
        row, digest, ordinal = payment_row(native_row, key, year, occurrence)
        duplicate_groups[digest] += 1
        payments.append(row)
        date, income, expenditure, cp_id, cp_name, description, paragraph, item, unit, event = row[1:]
        first_date = date if date and (first_date is None or date < first_date) else first_date
        last_date = date if date and (last_date is None or date > last_date) else last_date
        missing["date"] += date is None
        missing["counterparty_id"] += cp_id is None
        missing["counterparty_name"] += cp_name is None
        missing["description"] += description is None
        cp_key = counterparty_key(cp_id, cp_name)
        cp = counterparties[cp_key]
        add_money(cp, income, expenditure)
        cp.setdefault("counterparty_id", cp_id)
        cp.setdefault("counterparty_name", cp_name)
        cp["id_type"] = "czech_ico" if valid_czech_ico(cp_id) else ("source_id" if cp_id else "none")
        for mapping, category in ((paragraphs, paragraph), (items, item), (units, unit), (events, event), (months, date[:7] if date else None)):
            add_money(mapping[category or "unknown"], income, expenditure)
    payments.sort(key=lambda row: (row[1] is None, row[1] or "", row[0]), reverse=True)

    pbo_source_payments = []
    if native["type"] == "pbo":
        pbo_occurrence = Counter()
        pbo_source_payments = [payment_row(row, key, year, pbo_occurrence)[0] for row in raw_bulk_payments]
        pbo_source_payments.sort(key=lambda row: (row[1] is None, row[1] or "", row[0]), reverse=True)
        if len(pbo_source_payments) != len(payments):
            raise ValueError(f"PBO alternate payment view count mismatch for {key}/{year}")

    accounting = [accounting_row(row, native["id"], year) for row in source_rows_from_zip(source_zip, "accounting.csv")]
    event_rows = [event_row(row, year) for row in source_rows_from_zip(source_zip, "events.csv")]
    event_labels = {row[0]: row[1] for row in event_rows if row[0]}
    event_totals = [
        {"event": row[0], "name": row[1], "income_actual_cents": row[2], "income_budget_cents": row[3], "expenditure_actual_cents": row[4], "expenditure_budget_cents": row[5]}
        for row in event_rows
    ]

    plans_path = snapshot / key / str(year) / "plans.json.gz"
    plan_labels = load_plan_labels(snapshot, key, year)
    plans = []
    if plans_path.exists():
        plans = [plan_row(row, native["id"], year, plan_labels) for row in read_gzip_json(plans_path)]

    accounting_types = defaultdict(finance_bucket)
    accounting_paragraphs = defaultdict(finance_bucket)
    accounting_items = defaultdict(finance_bucket)
    accounting_events = defaultdict(finance_bucket)
    for row in accounting:
        for mapping, category in (
            (accounting_types, row[0]),
            (accounting_paragraphs, row[1]),
            (accounting_items, row[2]),
            (accounting_events, row[4]),
        ):
            add_finance(mapping[category or "unknown"], row[5], row[6], row[7], row[8])

    plan_totals = money_totals(plans, {"income_actual_cents": 3, "income_budget_cents": 4, "expenditure_actual_cents": 5, "expenditure_budget_cents": 6})
    accounting_totals = money_totals(accounting, {"income_actual_cents": 5, "income_budget_cents": 6, "expenditure_actual_cents": 7, "expenditure_budget_cents": 8})
    source_control = {
        "income_actual_cents": cents(year_meta.get("source_control", {}).get("incomeAmount"), "incomeAmount") if year_meta.get("source_control") else accounting_totals["income_actual_cents"],
        "income_budget_cents": cents(year_meta.get("source_control", {}).get("budgetIncomeAmount"), "budgetIncomeAmount") if year_meta.get("source_control") else accounting_totals["income_budget_cents"],
        "expenditure_actual_cents": cents(year_meta.get("source_control", {}).get("expenditureAmount"), "expenditureAmount") if year_meta.get("source_control") else accounting_totals["expenditure_actual_cents"],
        "expenditure_budget_cents": cents(year_meta.get("source_control", {}).get("budgetExpenditureAmount"), "budgetExpenditureAmount") if year_meta.get("source_control") else accounting_totals["expenditure_budget_cents"],
    }
    if source_control != accounting_totals:
        raise ValueError(f"Accounting total mismatch for {key}/{year}: {accounting_totals} != {source_control}")

    paragraph_labels = codelist_lookup(codelists["paragraphs"], year)
    item_labels = codelist_lookup(codelists["items"], year)
    pbo_account_labels = codelist_lookup(codelists["pbo-su"], year)
    plan_accounts = defaultdict(finance_bucket)
    for row in plans:
        add_finance(plan_accounts[row[0] or "unknown"], row[3], row[4], row[5], row[6])
    payment_summary = {
        "representation": preferred_kind,
        "record_class": "invoice_view_row",
        "rows": len(payments),
        "first_date": first_date,
        "last_date": last_date,
        "missing_fields": dict(missing),
        "exact_duplicate_groups": sum(1 for count in duplicate_groups.values() if count > 1),
        "rows_in_exact_duplicate_groups": sum(count for count in duplicate_groups.values() if count > 1),
        "totals": money_totals(payments, {"income_cents": 2, "expenditure_cents": 3}),
        "counterparties": sorted(
            ({"key": key, **value} for key, value in counterparties.items()),
            key=lambda row: (-abs(row["expenditure_cents"]) - abs(row["income_cents"]), row["key"]),
        ),
        "paragraphs": sorted_buckets(paragraphs, paragraph_labels),
        "items": sorted_buckets(items, item_labels if native["type"] != "pbo" else pbo_account_labels),
        "units": sorted_buckets(units),
        "events": sorted_buckets(events, event_labels),
        "months": sorted_buckets(months),
    }
    year_summary = {
        "year": year,
        "source_validity": year_meta.get("source_validity"),
        "source_bulk_export": {
            "url": f'{profile["instance"]}/api/exports/profiles/{native["id"]}/all/{year}',
            "retrieved_at": year_meta["retrieved_at"],
            "sha256": year_meta["sha256"],
            "bytes": year_meta["bytes"],
        },
        "annual_finance": {"source_api_control": source_control, "recomputed_from_accounting": accounting_totals},
        "payments": payment_summary,
        "accounting": {
            "rows": len(accounting),
            "totals": accounting_totals,
            "by_type": [{"type": key, **value} for key, value in sorted(accounting_types.items())],
            "by_paragraph": sorted_finance(accounting_paragraphs, paragraph_labels),
            "by_item": sorted_finance(accounting_items, item_labels if native["type"] != "pbo" else pbo_account_labels),
            "by_event": sorted_finance(accounting_events, event_labels),
        },
        "events": {"rows": len(event_rows), "records": event_totals},
        "plans": {
            "rows": len(plans),
            "totals": plan_totals,
            "has_budget_values": any(row[4] or row[6] for row in plans),
            "by_synthetic_account": sorted_finance(plan_accounts, pbo_account_labels),
        },
        "assets": {},
    }
    for kind, columns, rows in (
        ("payments", PAYMENT_COLUMNS, payments),
        ("accounting", ACCOUNTING_COLUMNS, accounting),
        ("events", EVENT_COLUMNS, event_rows),
        ("plans", PLAN_COLUMNS, plans),
    ):
        year_summary["assets"][kind] = shard_rows(directory, kind, key, year, columns, rows, shard_size)
        for asset in year_summary["assets"][kind]:
            asset["path"] = str(relative / asset.pop("file"))
    if pbo_source_payments:
        year_summary["alternate_pbo_payment_source_view"] = {
            "rows": len(pbo_source_payments),
            "definition": "Bulk-export import representation of the same PBO invoice-view rows. It retains the analytic unit and untransformed amount columns; do not add it to the preferred payments view.",
            "totals": money_totals(pbo_source_payments, {"income_cents": 2, "expenditure_cents": 3}),
            "assets": shard_rows(directory, "pbo-payment-source", key, year, PAYMENT_COLUMNS, pbo_source_payments, shard_size),
        }
        for asset in year_summary["alternate_pbo_payment_source_view"]["assets"]:
            asset["path"] = str(relative / asset.pop("file"))
    return year_summary


def add_source_controls(snapshot: Path, profile: dict):
    controls = {int(row["year"]): row for row in read_gzip_json(snapshot / profile["key"] / "years.json.gz")}
    result = []
    for year_meta in profile["years"]:
        copy = dict(year_meta)
        copy["source_control"] = controls.get(int(copy["year"]), {})
        result.append(copy)
    return result


def build(snapshot: Path, output: Path, shard_size: int, descriptor_path: Path | None = None):
    manifest = read_json(snapshot / "manifest.json")
    verification = read_json(snapshot / "verification.json")
    if not manifest.get("complete"):
        raise ValueError("CityVizor source manifest is incomplete")
    if verification.get("partial_run") or not verification.get("byte_and_row_integrity") or verification.get("source_control_exceptions"):
        raise ValueError("CityVizor source verification is incomplete or has unresolved controls")
    if verification.get("profiles") != manifest.get("profile_count"):
        raise ValueError("CityVizor verification profile count mismatch")
    source_manifest_sha256 = sha256_file(snapshot / "manifest.json")
    snapshot_date = str(manifest["completed_at"])[:10].replace("-", "")
    release_id = f"{snapshot_date}-{source_manifest_sha256[:12]}"

    temp = output.with_name(output.name + ".tmp")
    backup = output.with_name(output.name + ".old")
    shutil.rmtree(temp, ignore_errors=True)
    temp.mkdir(parents=True)
    try:
        instances = sorted(manifest["instances"])
        codelists = {}
        for name in ("items", "item-groups", "paragraphs", "paragraph-groups", "pbo-su", "pbo-su-exp-groups", "pbo-su-inc-groups"):
            merged = []
            seen = set()
            for instance in instances:
                host = instance.removeprefix("https://")
                path = snapshot / host / "codelists" / f"{name}.json.gz"
                if not path.exists():
                    continue
                for row in read_gzip_json(path):
                    identity = json.dumps(row, ensure_ascii=False, sort_keys=True, default=json_default)
                    if identity not in seen:
                        seen.add(identity)
                        merged.append(row)
            codelists[name] = sorted(merged, key=lambda row: (str(row.get("id")), str(row.get("validFrom")), str(row.get("validTill"))))
        codelist_asset = write_gzip_asset(
            temp,
            "codelists",
            {"schema_version": SCHEMA_VERSION, "country_code": "CZE", "codelists": codelists},
            sum(len(rows) for rows in codelists.values()),
        )

        recovery_anomalies = {(row["key"], int(row["year"])): row for row in verification.get("recovered_source_csv_anomalies", [])}
        profiles = []
        totals = Counter()
        output_files = [codelist_asset]
        for number, profile in enumerate(sorted(manifest["profiles"], key=lambda row: row["key"]), 1):
            key = profile["key"]
            native = profile["profile"]
            preferred_kind, preferred_rows = load_preferred_payments(snapshot, profile)
            years = []
            for year_meta in add_source_controls(snapshot, profile):
                year_summary = build_year(snapshot, temp, profile, year_meta, preferred_kind, preferred_rows, codelists, shard_size)
                if (key, year_summary["year"]) in recovery_anomalies:
                    year_summary["payments"]["source_csv_recovery"] = recovery_anomalies[(key, year_summary["year"])]
                totals["profile_years"] += 1
                for kind in ("payments", "accounting", "events", "plans"):
                    totals[kind] += year_summary[kind]["rows"]
                    output_files.extend(year_summary["assets"][kind])
                if "alternate_pbo_payment_source_view" in year_summary:
                    totals["pbo_payment_source_rows"] += year_summary["alternate_pbo_payment_source_view"]["rows"]
                    output_files.extend(year_summary["alternate_pbo_payment_source_view"]["assets"])
                year_relative = profile_path(key) / str(year_summary["year"])
                year_asset = write_gzip_asset(temp / year_relative, "summary", year_summary, year_summary["payments"]["rows"])
                year_asset["path"] = str(year_relative / year_asset.pop("file"))
                output_files.append(year_asset)
                years.append({
                    "year": year_summary["year"],
                    "source_validity": year_summary["source_validity"],
                    "annual_finance": year_summary["annual_finance"],
                    "record_counts": {kind: year_summary[kind]["rows"] for kind in ("payments", "accounting", "events", "plans")},
                    "payment_date_range": [year_summary["payments"]["first_date"], year_summary["payments"]["last_date"]],
                    "year_summary_asset": year_asset,
                })
            notices_path = snapshot / key / "noticeboard.json.gz"
            notices = read_gzip_json(notices_path) if notices_path.exists() else []
            normalized_notices = [
                {
                    "date": normalize_date(row.get("date")),
                    "title": row.get("title"),
                    "category": row.get("category"),
                    "document_url": row.get("documentUrl"),
                    "edesky_url": row.get("edeskyUrl"),
                    "preview_url": row.get("previewUrl"),
                }
                for row in notices
            ]
            profile_payload = {
                "schema_version": SCHEMA_VERSION,
                "profile": {
                    "key": key,
                    "source_profile_id": native["id"],
                    "name": native["name"],
                    "ico": code(native.get("ico")),
                    "email": str(native.get("email") or "").strip() or None,
                    "databox": code(native.get("databox")),
                    "type": native["type"],
                    "parent_profile_key": f'{profile["instance"].removeprefix("https://")}/{native["parent"]}' if native.get("parent") is not None else None,
                    "pbo_category_cs": native.get("pboCategoryCsName"),
                    "pbo_category_en": native.get("pboCategoryEnName"),
                    "profile_url": f'{profile["instance"]}/{native["url"]}',
                    "instance": profile["instance"],
                    "coordinates": [native.get("gpsY"), native.get("gpsX")] if native.get("gpsX") is not None and native.get("gpsY") is not None else None,
                    "source_integrations": {"edesky_id": native.get("edesky"), "mapa_samospravy_id": native.get("mapasamospravy")},
                },
                "years": years,
                "noticeboard": {"rows": len(normalized_notices), "records": normalized_notices},
                "contracts": {"rows": (profile.get("contracts") or {}).get("rows", 0), "records": []},
            }
            relative = profile_path(key)
            asset = write_gzip_asset(temp / relative, "profile", profile_payload, sum(year["record_counts"]["payments"] for year in years))
            asset["path"] = str(relative / asset.pop("file"))
            output_files.append(asset)
            profiles.append(
                {
                    **profile_payload["profile"],
                    "available_years": [year["year"] for year in years],
                    "payment_years": [year["year"] for year in years if year["record_counts"]["payments"]],
                    "record_counts": {
                        kind: sum(year["record_counts"][kind] for year in years) for kind in ("payments", "accounting", "events", "plans")
                    },
                    "noticeboard_rows": len(normalized_notices),
                    "profile_asset": asset,
                }
            )
            totals["noticeboard"] += len(normalized_notices)
            print(json.dumps({"profile": key, "done": number, "total": len(manifest["profiles"]), "payments": profiles[-1]["record_counts"]["payments"]}), flush=True)

        index = {
            "schema_version": SCHEMA_VERSION,
            "dataset_id": "cityvizor-normalized-financial-records",
            "release_id": release_id,
            "country_code": "CZE",
            "generated_from_snapshot_completed_at": manifest["completed_at"],
            "source_snapshot_sha256": source_manifest_sha256,
            "source_verification_sha256": sha256_file(snapshot / "verification.json"),
            "source_documentation": "https://cityvizor.cz/landing/dokumentace",
            "complete": True,
            "currency": "CZK",
            "money_unit": "integer_cents",
            "definitions": {
                "payment_record": "A row from CityVizor's KDF/KOF invoice view that preserves the source allocation. It is not a receipt, proof of bank settlement or a unique invoice identifier; a split invoice may appear in multiple rows.",
                "payment_identity": "row_id is a PSD-generated hash of all exposed fields plus an occurrence ordinal. It is not a CityVizor invoice ID. Exact duplicate rows are retained.",
                "accounting": "Accounting/budget records used by CityVizor to calculate annual actual and adjusted-budget totals. Invoice records overlap this layer and must not be added to it.",
                "events": "Source-defined event/project aggregates. They are another grouping of accounting activity and must not be added to accounting or invoice totals.",
                "plans": "PBO synthetic/analytic account plan-versus-actual rows. PBO plans, accounting and payment views overlap and are not additive.",
                "pbo_payment_views": "The preferred PBO payments API maps expense-account activity to expenditure and omits the analytic unit. A separate bulk source view preserves the unit and raw import columns. Both contain the same row population and must never be added.",
                "profiles": "Parent municipality and child PBO profiles may overlap. Summing profiles does not produce a consolidated municipal total.",
                "amounts": "Signed integer cents exactly preserve source CZK values. Negative values are corrections/refunds and are not removed.",
                "dates": "The source-published date from CityVizor's invoice view. Null remains null, and the date does not prove bank settlement. Snapshot retrieval time is not substituted.",
                "coverage": "Voluntary publication. Profiles and years without invoice rows remain explicit.",
                "snapshot": "Verified but non-atomic public-source snapshot. Each source archive retains its own retrieval time, validity date and checksum.",
            },
            "accounting_type_definitions": ACCOUNTING_TYPE_DEFINITIONS,
            "detail_schemas": {
                "payments": list(PAYMENT_COLUMNS),
                "pbo_payment_source_rows": list(PAYMENT_COLUMNS),
                "accounting": list(ACCOUNTING_COLUMNS),
                "events": list(EVENT_COLUMNS),
                "plans": list(PLAN_COLUMNS),
            },
            "profile_count": len(profiles),
            "profiles_with_payments": sum(profile["record_counts"]["payments"] > 0 for profile in profiles),
            "record_counts": dict(totals),
            "codelist_asset": codelist_asset,
            "profiles": profiles,
        }
        if totals["payments"] != 1_270_458:
            raise ValueError(f"Unexpected preferred payment total: {totals['payments']}")
        if totals["accounting"] != 493_800 or totals["events"] != 76_106 or totals["plans"] != 111_004:
            raise ValueError(f"Unexpected structured record totals: {dict(totals)}")
        if totals["pbo_payment_source_rows"] != 71_632:
            raise ValueError(f"Unexpected alternate PBO payment rows: {totals['pbo_payment_source_rows']}")
        index_asset = write_gzip_asset(temp, "index", index, len(profiles))
        output_files.append(index_asset)
        file_count = sum(1 for path in temp.rglob("*") if path.is_file())
        total_bytes = sum(path.stat().st_size for path in temp.rglob("*") if path.is_file())
        build_report = {
            "schema_version": SCHEMA_VERSION,
            "complete": True,
            "profile_count": len(profiles),
            "profiles_with_payments": index["profiles_with_payments"],
            "record_counts": dict(totals),
            "files": file_count + 1,
            "bytes": total_bytes,
            "index_sha256": index_asset["content_sha256"],
            "index_asset": index_asset,
            "shard_rows": shard_size,
        }
        write_json(temp / "build-report.json", build_report)
        shutil.rmtree(backup, ignore_errors=True)
        if output.exists():
            output.rename(backup)
        temp.rename(output)
        shutil.rmtree(backup, ignore_errors=True)
        descriptor = {
            "schema_version": SCHEMA_VERSION,
            "dataset_id": index["dataset_id"],
            "release_id": release_id,
            "status": "prepared_not_published",
            "source_snapshot": {
                "completed_at": manifest["completed_at"],
                "manifest_sha256": source_manifest_sha256,
                "verification_sha256": index["source_verification_sha256"],
            },
            "release_prefix": f"releases/{release_id}/",
            "index_asset": {
                "object_key": f"releases/{release_id}/{index_asset['file']}",
                **index_asset,
            },
            "current_pointer": {
                "schema_version": SCHEMA_VERSION,
                "dataset_id": index["dataset_id"],
                "release_id": release_id,
                "index": f"releases/{release_id}/{index_asset['file']}",
                "published_at": None,
            },
            "profile_count": index["profile_count"],
            "profiles_with_payments": index["profiles_with_payments"],
            "record_counts": index["record_counts"],
            "serving_tree": {
                "files": build_report["files"],
                "payload_bytes_excluding_build_report": build_report["bytes"],
                "max_rows_per_detail_shard": shard_size,
                "largest_lazy_asset_bytes": max(asset["bytes"] for asset in output_files),
                "bundling_policy": "Upload under the immutable release prefix; keep the serving tree outside the application image and commit only this descriptor.",
            },
        }
        if descriptor_path:
            descriptor_path.parent.mkdir(parents=True, exist_ok=True)
            descriptor_path.write_bytes(json_bytes(descriptor))
        print(json.dumps(build_report, ensure_ascii=False, indent=2))
    except Exception:
        shutil.rmtree(temp, ignore_errors=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=WORKSPACE_ROOT / "data/source_cache/cityvizor/2026-09-09")
    parser.add_argument("--output", type=Path, default=WORKSPACE_ROOT / "outputs/cityvizor-explorer-2026-09-09/release")
    parser.add_argument("--descriptor", type=Path, help="Optional compact release descriptor to write outside the serving tree")
    parser.add_argument("--shard-rows", type=int, default=DEFAULT_SHARD_ROWS)
    args = parser.parse_args()
    if args.shard_rows < 100 or args.shard_rows > 20_000:
        parser.error("--shard-rows must be between 100 and 20000")
    build(args.snapshot.resolve(), args.output.resolve(), args.shard_rows, args.descriptor.resolve() if args.descriptor else None)


if __name__ == "__main__":
    main()
