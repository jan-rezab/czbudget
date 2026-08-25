#!/usr/bin/env python3
"""Download and normalize municipal finance data for six benchmark countries.

The adapters preserve national codes and classifications.  They do not invent
missing budget stages, consolidate supplementary budgets, or claim census
coverage where the source does not provide it.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import itertools
import json
import os
import struct
import sys
import time
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable, Iterator

import requests
from openpyxl import load_workbook
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
DEFAULT_CONFIG = ROOT / "website/pipeline/config/international_municipal_sources.json"
DEFAULT_CACHE = ROOT / "data/source_cache/international_municipal"
DEFAULT_OUTPUT = ROOT / "outputs/international-municipal"
USER_AGENT = "czbudget-municipal-pipeline/1.0 (+https://www.czbudget.cz)"

TABLE_FILES = (
    "public_entities",
    "public_entity_sources",
    "classification_versions",
    "budget_nodes",
    "raw_budget_lines",
    "municipal_budget_line_facts",
    "public_entity_balance_sheet_facts",
    "public_entity_cash_facts",
    "ingestion_runs",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def decimal_value(value: Any) -> Decimal:
    if value is None:
        return Decimal(0)
    text = str(value).strip().replace("\u00a0", "").replace(" ", "")
    if not text or text in {"..", ":", "-", "—", "nan", "None"}:
        return Decimal(0)
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Not a decimal value: {value!r}") from exc


def numeric_json(value: Decimal) -> str:
    return format(value, "f")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_code(value: Any) -> str:
    return str(value or "").strip()


def configured_years(args: argparse.Namespace, cfg: dict[str, Any]) -> list[int]:
    """Resolve requested years while keeping the original --year interface."""
    if args.year:
        return [args.year]
    if args.years:
        return sorted({int(value.strip()) for value in args.years.split(",") if value.strip()})
    return [int(value) for value in cfg.get("years", [cfg["year"]])]


def config_for_year(cfg: dict[str, Any], year: int) -> dict[str, Any]:
    result = dict(cfg)
    result["year"] = year
    result["sources"] = [
        source for source in cfg["sources"]
        if source.get("year") in (None, year)
    ]
    return result


class JsonlBundle:
    def __init__(self, output: Path, raw_mode: str, raw_limit: int, gzip_output: bool = False):
        output.mkdir(parents=True, exist_ok=True)
        self.output = output
        self.gzip_output = gzip_output
        self.handles = {}
        for name in TABLE_FILES:
            path = output / f"{name}.jsonl{'.gz' if gzip_output else ''}"
            self.handles[name] = gzip.open(path, "wt", encoding="utf-8") if gzip_output else path.open("w", encoding="utf-8")
        self.counts: Counter[str] = Counter()
        self.raw_mode = raw_mode
        self.raw_limit = raw_limit
        self._seen_entities: set[str] = set()
        self._seen_nodes: set[str] = set()
        self._seen_versions: set[str] = set()

    def write(self, table: str, row: dict[str, Any]) -> None:
        self.handles[table].write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.counts[table] += 1

    def raw(self, row: dict[str, Any]) -> None:
        if self.raw_mode == "none":
            return
        if self.raw_mode == "sample" and self.counts["raw_budget_lines"] >= self.raw_limit:
            return
        self.write("raw_budget_lines", row)

    def entity(self, row: dict[str, Any]) -> bool:
        key = row["public_entity_id"]
        if key in self._seen_entities:
            return False
        self._seen_entities.add(key)
        self.write("public_entities", row)
        return True

    def classification(self, row: dict[str, Any]) -> None:
        key = row["classification_id"]
        if key not in self._seen_versions:
            self._seen_versions.add(key)
            self.write("classification_versions", row)

    def node(self, row: dict[str, Any]) -> None:
        key = row["budget_node_id"]
        if key not in self._seen_nodes:
            self._seen_nodes.add(key)
            self.write("budget_nodes", row)

    def close(self) -> None:
        for handle in self.handles.values():
            handle.close()


class Context:
    def __init__(self, config: dict[str, Any], args: argparse.Namespace, bundle: JsonlBundle):
        self.config = config
        self.args = args
        self.bundle = bundle
        self.loaded_at = utc_now()
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
        retry = Retry(total=4, connect=4, read=4, backoff_factor=1.0, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET", "POST"))
        self.session.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=max(10, args.api_workers), pool_maxsize=max(10, args.api_workers)))
        self.overrides = {}
        for item in args.source_file:
            if "=" not in item:
                raise SystemExit(f"--source-file must be SOURCE_ID=PATH, got {item!r}")
            source_id, path = item.split("=", 1)
            self.overrides[source_id] = Path(path).expanduser().resolve()

    def cache_path(self, country: str, source: dict[str, Any]) -> Path:
        if source["id"] in self.overrides:
            return self.overrides[source["id"]]
        filename = source.get("filename") or f"{source['id']}.json"
        return self.args.cache_dir / country / filename

    def download(self, country: str, source: dict[str, Any], optional: bool = False) -> Path | None:
        path = self.cache_path(country, source)
        if path.exists() and not self.args.refresh:
            return path
        if self.args.offline:
            if optional:
                return None
            raise FileNotFoundError(f"Offline source missing: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        headers = {}
        token = self.args.openbudget_token or os.environ.get("OPENBUDGET_API_TOKEN")
        if token and country == "UKR":
            headers["Authorization"] = f"Bearer {token}"
        try:
            with self.session.get(source["url"], headers=headers, timeout=120, stream=True) as response:
                response.raise_for_status()
                temporary = path.with_suffix(path.suffix + ".part")
                with temporary.open("wb") as handle:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            handle.write(chunk)
                temporary.replace(path)
        except requests.RequestException:
            if optional:
                return None
            raise
        return path

    def api_json(self, method: str, url: str, **kwargs: Any) -> Any:
        response = self.session.request(method, url, timeout=120, **kwargs)
        response.raise_for_status()
        return response.json()

    def source_row(self, entity_id: str | None, source: dict[str, Any], country: str, notes: str) -> None:
        path = self.cache_path(country, source)
        self.bundle.write("public_entity_sources", {
            "source_id": source["id"], "public_entity_id": entity_id,
            "source_type": source["kind"], "source_name": source["id"],
            "source_url": source["url"], "dataset_code": source.get("table"),
            "archive_file": str(path.relative_to(ROOT)) if path.exists() and path.is_relative_to(ROOT) else (str(path) if path.exists() else None),
            "archive_sha256": sha256(path) if path.exists() else None,
            "retrieved_at": self.loaded_at, "notes": notes, "loaded_at": self.loaded_at,
        })


def entity_row(country: str, code: str, name: str, currency: str, loaded_at: str, **extra: Any) -> dict[str, Any]:
    alpha2 = {"POL": "PL", "DNK": "DK", "UKR": "UA", "FRA": "FR", "SWE": "SE", "GBR": "GB"}[country]
    return {
        "public_entity_id": f"{alpha2}:{code}", "entity_name": name,
        "entity_type": extra.pop("entity_type", "municipality"),
        "country_code_alpha2": alpha2, "country_code_alpha3": country,
        "national_entity_code": code, "national_entity_code_type": extra.pop("code_type", f"{alpha2}_MUNICIPALITY_CODE"),
        "is_eu_capital": False, "is_extra_city": False, "default_currency_code": currency,
        "eurostat_city_code": None, "eurostat_geography_name": None,
        "administrative_region_code": extra.pop("region_code", None),
        "administrative_region_name": extra.pop("region_name", None),
        "administrative_district_code": extra.pop("district_code", None),
        "administrative_district_name": extra.pop("district_name", None),
        "national_geography_code": extra.pop("geography_code", code),
        "national_geography_code_type": extra.pop("geography_type", f"{alpha2}_MUNICIPALITY_CODE"),
        "valid_from": None, "valid_to": None, "loaded_at": loaded_at,
    }


def classification_row(country: str, classification_id: str, side: str, name: str, source_url: str, year: int, loaded_at: str) -> dict[str, Any]:
    return {
        "classification_id": classification_id, "country_code": country, "budget_side": side,
        "government_scope": "municipal", "valid_from_year": year, "valid_to_year": None,
        "classification_name": name, "legal_basis": None, "source_url": source_url,
        "notes": "National source classification preserved without cross-country remapping.", "loaded_at": loaded_at,
    }


def node_row(country: str, classification_id: str, side: str, code: str, name: str, year: int, loaded_at: str) -> dict[str, Any]:
    return {
        "budget_node_id": f"{country}:{classification_id}:{code}", "classification_id": classification_id,
        "country_code": country, "budget_side": side, "government_scope": "municipal",
        "node_code": code, "node_name_native": name or code, "node_name_en": None, "node_name_cs": None,
        "parent_budget_node_id": None, "hierarchy_level": 1, "hierarchy_path": [], "is_chapter": False,
        "effective_from_year": year, "effective_to_year": None, "loaded_at": loaded_at,
    }


def fact_row(
    country: str, entity_id: str, year: int, stage: str, side: str, function_code: str | None,
    economic_code: str, amount: Decimal, currency: str, source: dict[str, Any], run_id: str,
    loaded_at: str, function_class: str | None, economic_class: str, **extra: Any,
) -> dict[str, Any]:
    return {
        "public_entity_id": entity_id, "fiscal_year": year, "fiscal_period": extra.pop("period", "FY"),
        "reporting_scope": extra.pop("scope", "standalone_municipality"), "budget_stage": stage,
        "budget_side": side, "source_budget_item_type_code": extra.pop("item_type", None),
        "functional_paragraph_code": function_code, "economic_item_code": economic_code,
        "functional_classification_id": function_class, "economic_classification_id": economic_class,
        "amount_local": numeric_json(amount), "currency_code": currency, "amount_eur": None, "fx_date": None,
        "is_consolidation_item": False, "is_financing": side == "financing", "is_summary_row": extra.pop("summary", False),
        "source_row_number": extra.pop("row_number", None), "source_sheet": extra.pop("sheet", None),
        "source_id": source["id"], "ingestion_run_id": run_id,
        "coverage_type": extra.pop("coverage_type", "census"), "is_imputed": extra.pop("is_imputed", False),
        "quality_flags": extra.pop("quality_flags", []), "loaded_at": loaded_at,
    }


def raw_row(country: str, year: int, source: dict[str, Any], run_id: str, row_number: int, sheet: str, payload: dict[str, Any], loaded_at: str) -> dict[str, Any]:
    return {
        "country_code": country, "fiscal_year": year, "source_id": source["id"],
        "ingestion_run_id": run_id, "source_row_number": row_number, "source_sheet": sheet,
        "source_payload": payload, "source_url": source["url"], "loaded_at": loaded_at,
    }


def iter_dbf(handle: io.BufferedReader, encoding: str = "cp1250") -> Iterator[tuple[int, dict[str, Any]]]:
    header = handle.read(32)
    if len(header) != 32:
        raise ValueError("Invalid DBF header")
    record_count = struct.unpack("<I", header[4:8])[0]
    header_length = struct.unpack("<H", header[8:10])[0]
    record_length = struct.unpack("<H", header[10:12])[0]
    fields = []
    while handle.tell() < header_length - 1:
        descriptor = handle.read(32)
        if not descriptor or descriptor[0] == 0x0D:
            break
        name = descriptor[:11].split(b"\0", 1)[0].decode("ascii")
        fields.append((name, chr(descriptor[11]), descriptor[16], descriptor[17]))
    handle.seek(header_length)
    for row_number in range(1, record_count + 1):
        record = handle.read(record_length)
        if len(record) < record_length:
            break
        if record[:1] == b"*":
            continue
        position = 1
        row: dict[str, Any] = {}
        for name, kind, length, decimals in fields:
            raw = record[position:position + length]
            position += length
            text = raw.decode(encoding, errors="replace").strip()
            if kind in "NF" and text:
                row[name] = decimal_value(text)
            else:
                row[name] = text or None
        yield row_number, row


def _pl_dictionary(path: Path) -> dict[tuple[str, str, str, str, str], dict[str, str]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    rows = sheet.iter_rows(values_only=True)
    headers = [stable_code(value).replace("\u200b", "") for value in next(rows)]
    result = {}
    for values in rows:
        row = dict(zip(headers, values))
        key = tuple(stable_code(row.get(code)).zfill(2 if code != "GT" and code != "PT" else 1) for code in ("WK", "PK", "GK", "GT", "PT"))
        kind = stable_code(row.get("Typ Jst Nazwa"))
        if "gmina" in kind.lower() or "miasto na prawach" in kind.lower():
            result[key] = {"name": stable_code(row.get("Nazwa")), "code": stable_code(row.get("Kod GUS")).zfill(7), "type": kind}
    return result


def run_poland(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    sources = {source["kind"]: source for source in cfg["sources"]}
    paths = {kind: ctx.download(country, source) for kind, source in sources.items()}
    dictionary = _pl_dictionary(paths["entities"])
    selected = list(dictionary.values())[:ctx.args.max_entities or None]
    selected_codes = {item["code"] for item in selected}
    for key, item in dictionary.items():
        if item["code"] not in selected_codes:
            continue
        ctx.bundle.entity(entity_row(country, item["code"], item["name"], currency, ctx.loaded_at, code_type="PL_TERYT"))
    for side, kind in (("revenue", "revenue"), ("expenditure", "expenditure")):
        source = sources[kind]
        run_id = f"{source['id']}-v1"
        function_class = f"PL_JST_FUNCTION_{year}"
        economic_class = f"PL_JST_{side.upper()}_{year}"
        ctx.bundle.classification(classification_row(country, function_class, "mixed", "Polish JST division/chapter classification", source["url"], year, ctx.loaded_at))
        ctx.bundle.classification(classification_row(country, economic_class, side, f"Polish JST {side} paragraph classification", source["url"], year, ctx.loaded_at))
        rows_read = rows_loaded = 0
        with zipfile.ZipFile(paths[kind]) as archive:
            member = next(name for name in archive.namelist() if name.lower().endswith(".dbf"))
            with archive.open(member) as handle:
                for row_number, row in iter_dbf(handle):
                    key = tuple(stable_code(row.get(code)).zfill(2 if code not in ("GT", "PT") else 1) for code in ("WK", "PK", "GK", "GT", "PT"))
                    item = dictionary.get(key)
                    if not item or item["code"] not in selected_codes:
                        continue
                    rows_read += 1
                    payload = {key: numeric_json(value) if isinstance(value, Decimal) else value for key, value in row.items()}
                    ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, member, payload, ctx.loaded_at))
                    function = f"{stable_code(row.get('DZIAL')).zfill(3)}.{stable_code(row.get('ROZDZIAL')).zfill(5)}"
                    economic = f"{stable_code(row.get('PAR')).zfill(3)}{stable_code(row.get('PAR4'))}"
                    ctx.bundle.node(node_row(country, function_class, side, function, function, year, ctx.loaded_at))
                    ctx.bundle.node(node_row(country, economic_class, side, economic, economic, year, ctx.loaded_at))
                    for stage, column in (("revised", "R1"), ("actual", "R4")):
                        amount = decimal_value(row.get(column))
                        if not amount:
                            continue
                        ctx.bundle.write("municipal_budget_line_facts", fact_row(
                            country, f"PL:{item['code']}", year, stage, side, function, economic, amount,
                            currency, source, run_id, ctx.loaded_at, function_class, economic_class,
                            row_number=row_number, sheet=member, quality_flags=["quarter_four_return"],
                        ))
                        rows_loaded += 1
        write_run(ctx, run_id, source, year, paths[kind], rows_read, rows_loaded)
        ctx.source_row(None, source, country, cfg["coverage"])
    ctx.source_row(None, sources["entities"], country, cfg["coverage"])
    return {"entities": len(selected_codes)}


def statbank_metadata(ctx: Context, table: str) -> dict[str, Any]:
    return ctx.api_json("GET", f"https://api.statbank.dk/v1/tableinfo/{table}?lang=en")


def run_denmark(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    budget_table = next(source["table"] for source in cfg["sources"] if source["kind"] == "enacted")
    budget_meta = statbank_metadata(ctx, budget_table)
    region_var = budget_meta["variables"][0]
    aggregate_codes = {"000", "081", "082", "083", "084", "085", "910", "920", "930", "940", "960"}
    municipalities = [value for value in region_var["values"] if value["id"] not in aggregate_codes]
    municipalities = municipalities[:ctx.args.max_entities or None]
    for municipality in municipalities:
        ctx.bundle.entity(entity_row(country, municipality["id"], municipality["text"], currency, ctx.loaded_at, code_type="DK_KOMKODE"))
    for source in cfg["sources"]:
        meta = statbank_metadata(ctx, source["table"])
        variables = {item["id"]: item for item in meta["variables"]}
        region_code = meta["variables"][0]["id"]
        function_class = f"DK_{source['table']}_FUNCTION"
        # The 100-series tables expose the authorized account below the older
        # function x kind cube. Keep ownership and grouping in the normalized
        # economic key so equal ART codes are not silently collapsed.
        economic_class = f"DK_{source['table']}_ACCOUNT"
        ctx.bundle.classification(classification_row(country, function_class, "mixed", meta["text"] + " functions", source["url"], year, ctx.loaded_at))
        ctx.bundle.classification(classification_row(country, economic_class, "mixed", meta["text"] + " kinds", source["url"], year, ctx.loaded_at))
        function_names = {item["id"]: item["text"] for item in variables["FUNKTION"]["values"]}
        art_names = {item["id"]: item["text"] for item in variables["ART"]["values"]}
        owner_names = {item["id"]: item["text"] for item in variables.get("EJER", {}).get("values", [])}
        grouping_names = {item["id"]: item["text"] for item in variables.get("GRUPPERING", {}).get("values", [])}
        leaf_art = [code for code in art_names if code not in {"TOT", "UE", "I", "U"} and not code.startswith("S")]
        run_id = f"{source['id']}-{year}-v1"
        rows_read = rows_loaded = 0
        for municipality in municipalities:
            query = {"table": source["table"], "format": "BULK", "lang": "en", "variables": []}
            for variable in meta["variables"]:
                code = variable["id"]
                if code == region_code:
                    values = [municipality["id"]]
                elif code == "ART":
                    values = leaf_art
                elif code == "PRISENHED":
                    values = ["LOBM"]
                elif variable.get("time"):
                    values = [str(year)]
                else:
                    values = [item["id"] for item in variable["values"]]
                query["variables"].append({"code": code, "values": values})
            response = ctx.session.post(source["url"], json=query, timeout=180)
            response.raise_for_status()
            reader = csv.DictReader(io.StringIO(response.text), delimiter=";")
            for row_number, row in enumerate(reader, 2):
                rows_read += 1
                function, art = stable_code(row.get("FUNKTION")), stable_code(row.get("ART"))
                dranst = stable_code(row.get("DRANST"))
                owner = stable_code(row.get("EJER"))
                grouping = stable_code(row.get("GRUPPERING"))
                amount = decimal_value(row.get("INDHOLD")) * Decimal(1000)
                if not amount or not function or not art:
                    continue
                account = ".".join(part for part in (dranst, owner, grouping, art) if part)
                account_name = " · ".join(part for part in (owner_names.get(owner), grouping_names.get(grouping), art_names.get(art)) if part)
                side = "revenue" if art.startswith(("7", "8")) else ("financing" if dranst in {"5", "6", "7"} else "expenditure")
                ctx.bundle.node(node_row(country, function_class, side, function, function_names.get(function, function), year, ctx.loaded_at))
                ctx.bundle.node(node_row(country, economic_class, side, account, account_name or account, year, ctx.loaded_at))
                payload = dict(row)
                ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, source["table"], payload, ctx.loaded_at))
                ctx.bundle.write("municipal_budget_line_facts", fact_row(
                    country, f"DK:{municipality['id']}", year, source["kind"], side, function, account, amount,
                    currency, source, run_id, ctx.loaded_at, function_class, economic_class,
                    row_number=row_number, sheet=source["table"], item_type=dranst, quality_flags=["source_unit_dkk_thousands", "authorized_account_detail"],
                ))
                rows_loaded += 1
        write_run(ctx, run_id, source, year, None, rows_read, rows_loaded)
        ctx.source_row(None, source, country, cfg["coverage"])
    return {"entities": len(municipalities)}


def jsonstat_rows(dataset: dict[str, Any]) -> Iterator[dict[str, Any]]:
    dimensions = dataset["id"]
    categories = []
    for dimension in dimensions:
        category = dataset["dimension"][dimension]["category"]
        index = category["index"]
        codes = index if isinstance(index, list) else [code for code, _ in sorted(index.items(), key=lambda item: item[1])]
        labels = category.get("label", {})
        categories.append([(code, labels.get(code, code)) for code in codes])
    values = dataset["value"]
    for position, combination in enumerate(itertools.product(*categories)):
        value = values.get(str(position)) if isinstance(values, dict) else values[position]
        if value is None:
            continue
        row = {dimension: code_label[0] for dimension, code_label in zip(dimensions, combination)}
        row.update({f"{dimension}_label": code_label[1] for dimension, code_label in zip(dimensions, combination)})
        row["value"] = value
        yield row


def pxweb_query(ctx: Context, source: dict[str, Any], metadata: dict[str, Any], region: str, year: int) -> dict[str, Any]:
    query = []
    for variable in metadata["variables"]:
        if variable["code"] == "Region":
            values = [region]
        elif variable.get("time"):
            values = [str(year)]
        else:
            values = variable["values"]
        query.append({"code": variable["code"], "selection": {"filter": "item", "values": values}})
    return ctx.api_json("POST", source["url"], json={"query": query, "response": {"format": "json-stat2"}})


def run_sweden(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    metadata = {source["kind"]: ctx.api_json("GET", source["url"]) for source in cfg["sources"]}
    region_variable = metadata["expenditure"]["variables"][0]
    municipalities = [
        {"id": code, "text": text} for code, text in zip(region_variable["values"], region_variable["valueTexts"])
        if code != "00"
    ][:ctx.args.max_entities or None]
    for municipality in municipalities:
        ctx.bundle.entity(entity_row(country, municipality["id"], municipality["text"], currency, ctx.loaded_at, code_type="SE_KOMMUNKOD"))
    for source in cfg["sources"]:
        meta = metadata[source["kind"]]
        line_variable = next(item for item in meta["variables"] if item["code"] not in {"Region", "ContentsCode", "Tid"})
        line_names = dict(zip(line_variable["values"], line_variable["valueTexts"]))
        classification_id = f"SE_SCB_{source['table'].upper()}"
        side = source["kind"] if source["kind"] in {"revenue", "expenditure"} else "mixed"
        ctx.bundle.classification(classification_row(country, classification_id, side, meta["title"], source["url"], year, ctx.loaded_at))
        run_id = f"{source['id']}-{year}-v1"
        rows_read = rows_loaded = 0
        for municipality in municipalities:
            data = pxweb_query(ctx, source, meta, municipality["id"], year)
            for row_number, row in enumerate(jsonstat_rows(data), 1):
                rows_read += 1
                code = stable_code(row.get(line_variable["code"]))
                amount = decimal_value(row["value"]) * Decimal(1000)
                if not amount:
                    continue
                ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, source["table"], row, ctx.loaded_at))
                if source["kind"] == "balance":
                    ctx.bundle.write("public_entity_balance_sheet_facts", {
                        "public_entity_id": f"SE:{municipality['id']}", "statement_date": f"{year}-12-31",
                        "reporting_scope": "standalone_municipality", "statement_line_code": code,
                        "account_code": code, "account_name": line_names.get(code), "balance_measure": "current_net",
                        "amount_local": numeric_json(amount), "currency_code": currency, "amount_eur": None, "fx_date": None,
                        "source_id": source["id"], "ingestion_run_id": run_id, "source_row_number": row_number,
                        "source_sheet": source["table"], "coverage_type": "census", "is_imputed": False,
                        "quality_flags": ["source_unit_sek_thousands", "preliminary_latest_year"], "loaded_at": ctx.loaded_at,
                    })
                else:
                    ctx.bundle.node(node_row(country, classification_id, side, code, line_names.get(code, code), year, ctx.loaded_at))
                    ctx.bundle.write("municipal_budget_line_facts", fact_row(
                        country, f"SE:{municipality['id']}", year, "actual", side, None, code, amount,
                        currency, source, run_id, ctx.loaded_at, None, classification_id,
                        row_number=row_number, sheet=source["table"],
                        summary="total" in line_names.get(code, "").lower(),
                        quality_flags=["source_unit_sek_thousands", "preliminary_latest_year"],
                    ))
                rows_loaded += 1
        write_run(ctx, run_id, source, year, None, rows_read, rows_loaded)
        ctx.source_row(None, source, country, cfg["coverage"])
    return {"entities": len(municipalities)}


def french_insee(row: dict[str, Any]) -> str:
    department = stable_code(row.get("NDEPT"))
    if len(department) == 3 and department.startswith("0"):
        department = department[1:]
    commune = stable_code(row.get("INSEE")).zfill(3)
    return department + commune


def french_csv_rows(path: Path) -> Iterator[tuple[int, str, dict[str, Any]]]:
    with zipfile.ZipFile(path) as archive:
        member = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        with archive.open(member) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="cp1252", newline=""), delimiter=";")
            for row_number, row in enumerate(reader, 2):
                yield row_number, member, row


def run_france(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    sources = {source.get("detail"): source for source in cfg["sources"]}
    census_source, function_source = sources.get("census"), sources.get("function")
    if not census_source or not function_source:
        raise ValueError(f"France {year} requires census and function sources")
    census_path = ctx.download(country, census_source)
    function_path = ctx.download(country, function_source)
    function_class, economic_class = f"FR_DGFIP_FUNCTION_{year}", f"FR_DGFIP_ACCOUNT_{year}"
    ctx.bundle.classification(classification_row(country, function_class, "mixed", "DGFiP functional classification", function_source["url"], year, ctx.loaded_at))
    ctx.bundle.classification(classification_row(country, economic_class, "mixed", "DGFiP local chart of accounts", census_source["url"], year, ctx.loaded_at))
    selected: set[str] = set()
    functional_codes: set[str] = set()
    run_counts: dict[str, list[int]] = {source["id"]: [0, 0] for source in (function_source, census_source)}

    def load(source: dict[str, Any], path: Path, *, functional: bool) -> None:
        run_id = f"{source['id']}-v1"
        for row_number, member, row in french_csv_rows(path):
            if row.get("CATEG") != "Commune":
                continue
            code = french_insee(row)
            if code not in selected:
                if ctx.args.max_entities and len(selected) >= ctx.args.max_entities:
                    continue
                selected.add(code)
                ctx.bundle.entity(entity_row(country, code, stable_code(row.get("LBUDG")) or code, currency, ctx.loaded_at, code_type="FR_CODE_INSEE", region_code=row.get("CREGI"), district_code=row.get("NDEPT")))
            if functional:
                functional_codes.add(code)
            elif code in functional_codes:
                continue
            run_counts[source["id"]][0] += 1
            ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, member, row, ctx.loaded_at))
            function = stable_code(row.get("FONCTION")) or ("UNSPECIFIED" if functional else None)
            account = stable_code(row.get("COMPTE"))
            if not account:
                continue
            scope = "main_budget" if stable_code(row.get("CBUDG")) == "1" else "supplementary_budget"
            if function:
                ctx.bundle.node(node_row(country, function_class, "mixed", function, function, year, ctx.loaded_at))
            ctx.bundle.node(node_row(country, economic_class, "mixed", account, account, year, ctx.loaded_at))
            flags = [f"nomenclature:{stable_code(row.get('NOMEN'))}", "accounting_balance_execution"]
            if not functional:
                flags.append("functional_detail_not_published")
            for side, column in (("expenditure", "OBNETDEB"), ("revenue", "OBNETCRE")):
                amount = decimal_value(row.get(column))
                if not amount:
                    continue
                ctx.bundle.write("municipal_budget_line_facts", fact_row(
                    country, f"FR:{code}", year, "actual", side, function, account, amount,
                    currency, source, run_id, ctx.loaded_at, function_class if function else None, economic_class,
                    row_number=row_number, sheet=member, scope=scope, quality_flags=flags,
                ))
                run_counts[source["id"]][1] += 1
            debit, credit = decimal_value(row.get("SD")), decimal_value(row.get("SC"))
            if debit or credit:
                signed = debit - credit
                ctx.bundle.write("public_entity_balance_sheet_facts", {
                    "public_entity_id": f"FR:{code}", "statement_date": f"{year}-12-31", "reporting_scope": scope,
                    "statement_line_code": function or account, "account_code": account, "account_name": None,
                    "balance_measure": "current_net_signed_debit", "amount_local": numeric_json(signed),
                    "currency_code": currency, "amount_eur": numeric_json(signed), "fx_date": f"{year}-12-31",
                    "source_id": source["id"], "ingestion_run_id": run_id, "source_row_number": row_number,
                    "source_sheet": member, "coverage_type": "census", "is_imputed": False,
                    "quality_flags": ["debit_minus_credit", *flags], "loaded_at": ctx.loaded_at,
                })
                run_counts[source["id"]][1] += 1

    load(function_source, function_path, functional=True)
    load(census_source, census_path, functional=False)
    for source, path in ((function_source, function_path), (census_source, census_path)):
        rows_read, rows_loaded = run_counts[source["id"]]
        write_run(ctx, f"{source['id']}-v1", source, year, path, rows_read, rows_loaded)
        ctx.source_row(None, source, country, cfg["coverage"])
    return {"entities": len(selected), "functional_entities": len(functional_codes)}


def uk_side(variable: str) -> str:
    lower = variable.lower()
    if any(token in lower for token in ("income", "receipt", "grant", "sales", "fees")):
        return "revenue"
    if any(token in lower for token in ("reserve", "financing", "interest", "debt")):
        return "financing"
    return "expenditure"


def run_england(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    source = cfg["sources"][0]
    path = ctx.download(country, source)
    currency = cfg["currency"]
    classification_id = "GB_ENGLAND_MHCLG_RO"
    ctx.bundle.classification(classification_row(country, classification_id, "mixed", "England Revenue Outturn variables", source["url"], 2017, ctx.loaded_at))
    target_year = cfg["year"]
    run_id = f"{source['id']}-{target_year}-v1"
    identifier_columns = {"year_ending", "ONS_code", "LA_LGF_code", "LA_name", "status", "LA_class", "LA_subclass"}
    rows_read = rows_loaded = 0
    selected: set[str] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, 2):
            year_ending = int(stable_code(row.get("year_ending"))[:4])
            if year_ending != target_year:
                continue
            allowed_subclasses = {"Shire District", "Unitary Authority", "Met District", "London", "Shire County", "UA", "GLA"}
            if stable_code(row.get("status")) != "submitted" or stable_code(row.get("LA_subclass")) not in allowed_subclasses:
                continue
            code = stable_code(row.get("ONS_code") or row.get("LA_LGF_code"))
            if not code:
                continue
            if code not in selected:
                if ctx.args.max_entities and len(selected) >= ctx.args.max_entities:
                    continue
                selected.add(code)
                ctx.bundle.entity(entity_row(country, code, stable_code(row.get("LA_name")) or code, currency, ctx.loaded_at, code_type="GB_ONS_LOCAL_AUTHORITY", region_name="England", entity_type="local_authority"))
            rows_read += 1
            ctx.bundle.raw(raw_row(country, year_ending, source, run_id, row_number, "Revenue Outturn", row, ctx.loaded_at))
            for variable, value in row.items():
                if variable in identifier_columns:
                    continue
                amount = decimal_value(value) * Decimal(1000)
                if not amount:
                    continue
                side = uk_side(variable)
                ctx.bundle.node(node_row(country, classification_id, side, variable, variable, year_ending, ctx.loaded_at))
                ctx.bundle.write("municipal_budget_line_facts", fact_row(
                    country, f"GB:{code}", year_ending, "actual", side, None, variable, amount,
                    currency, source, run_id, ctx.loaded_at, None, classification_id,
                    row_number=row_number, sheet="Revenue Outturn", period=f"FY-{year_ending}",
                    scope="england_statistical_return",
                    summary=("_tot_" in variable.lower() or variable.lower().endswith(("_tot", "_total"))),
                    quality_flags=["source_unit_gbp_thousands", "wide_return_unpivoted"],
                ))
                rows_loaded += 1
    write_run(ctx, run_id, source, target_year, path, rows_read, rows_loaded)
    ctx.source_row(None, source, country, cfg["coverage"])
    return {"entities": len(selected)}


def find_record_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list) and (not payload or isinstance(payload[0], dict)):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items", "records", "content"):
            if key in payload:
                found = find_record_list(payload[key])
                if found:
                    return found
    return []


def first_value(row: dict[str, Any], aliases: Iterable[str]) -> Any:
    lowered = {key.lower(): value for key, value in row.items()}
    for alias in aliases:
        if alias.lower() in lowered and lowered[alias.lower()] not in (None, ""):
            return lowered[alias.lower()]
    return None


def run_ukraine(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    source = cfg["sources"][0]
    path = ctx.download(country, source, optional=True)
    if path is None:
        message = f"Open Budget source unavailable; provide --openbudget-token or --source-file {source['id']}=/path/snapshot.json"
        ctx.bundle.write("ingestion_runs", {
            "ingestion_run_id": f"{source['id']}-v1", "source_id": source["id"], "started_at": ctx.loaded_at,
            "completed_at": ctx.loaded_at, "status": "blocked", "source_vintage": str(year), "source_sha256": None,
            "rows_read": 0, "rows_loaded": 0, "warning_count": 1, "error_message": message,
        })
        ctx.source_row(None, source, country, message)
        return {"entities": 0, "blocked": message}
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    records = find_record_list(payload)
    function_class, economic_class = f"UA_LOCAL_FUNCTION_{year}", f"UA_LOCAL_ECONOMIC_{year}"
    ctx.bundle.classification(classification_row(country, function_class, "mixed", "Ukraine local budget programme/function", source["url"], year, ctx.loaded_at))
    ctx.bundle.classification(classification_row(country, economic_class, "mixed", "Ukraine local budget economic classification", source["url"], year, ctx.loaded_at))
    run_id = f"{source['id']}-v1"
    selected: set[str] = set()
    rows_loaded = 0
    for row_number, row in enumerate(records, 1):
        code = stable_code(first_value(row, ("local_budget_code", "budget_code", "budgetCode", "kod_biudzhetu")))
        if not code:
            continue
        if code not in selected:
            if ctx.args.max_entities and len(selected) >= ctx.args.max_entities:
                continue
            selected.add(code)
            name = stable_code(first_value(row, ("local_budget_name", "budget_name", "budgetName", "name"))) or code
            ctx.bundle.entity(entity_row(country, code, name, currency, ctx.loaded_at, code_type="UA_LOCAL_BUDGET_CODE"))
        function = stable_code(first_value(row, ("program_code", "functional_code", "function_code", "kpkvk"))) or "UNSPECIFIED"
        economic = stable_code(first_value(row, ("economic_code", "kekv", "revenue_code", "classification_code"))) or "UNSPECIFIED"
        side_text = stable_code(first_value(row, ("budget_side", "type", "direction"))).lower()
        side = "revenue" if any(word in side_text for word in ("income", "revenue", "дох")) else "expenditure"
        ctx.bundle.node(node_row(country, function_class, side, function, stable_code(first_value(row, ("program_name", "function_name"))) or function, year, ctx.loaded_at))
        ctx.bundle.node(node_row(country, economic_class, side, economic, stable_code(first_value(row, ("economic_name", "classification_name"))) or economic, year, ctx.loaded_at))
        ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, "OpenBudget API", row, ctx.loaded_at))
        for stage, aliases in (
            ("enacted", ("initial_plan", "approved_plan", "plan")),
            ("revised", ("revised_plan", "adjusted_plan", "plan_updated")),
            ("actual", ("executed", "actual", "fact", "cash_execution")),
        ):
            amount = decimal_value(first_value(row, aliases))
            if not amount:
                continue
            ctx.bundle.write("municipal_budget_line_facts", fact_row(
                country, f"UA:{code}", year, stage, side, function, economic, amount,
                currency, source, run_id, ctx.loaded_at, function_class, economic_class,
                row_number=row_number, sheet="OpenBudget API", quality_flags=["api_schema_alias_normalized"],
            ))
            rows_loaded += 1
    write_run(ctx, run_id, source, year, path, len(records), rows_loaded)
    ctx.source_row(None, source, country, cfg["coverage"])
    return {"entities": len(selected)}


def _ukraine_budget_directory(path: Path, year: int) -> list[dict[str, Any]]:
    records = json.loads(path.read_text(encoding="utf-8-sig"))
    start, end = f"{year}-01-01", f"{year}-12-31"
    latest: dict[str, dict[str, Any]] = {}
    for row in records:
        code = stable_code(row.get("codebudg"))
        if not code or row.get("details") != 1:
            continue
        if stable_code(row.get("beginDate")) > end:
            continue
        if row.get("endDate") and stable_code(row["endDate"]) < start:
            continue
        previous = latest.get(code)
        if previous is None or stable_code(row.get("beginDate")) > stable_code(previous.get("beginDate")):
            latest[code] = row
    # Territorial-community budgets are the comparable municipal tier. Kyiv is
    # a city with special status and does not use the phrase in its directory name.
    return sorted([
        row for code, row in latest.items()
        if "територіальної громади" in stable_code(row.get("namebudg")).lower() or code == "2600000000"
    ], key=lambda row: row["codebudg"])


def _ukraine_download_csv(ctx: Context, country: str, source: dict[str, Any], year: int, code: str) -> Path:
    cache = ctx.args.cache_dir / country / str(year) / source["kind"] / f"{code}.csv.gz"
    if cache.exists() and not ctx.args.refresh:
        return cache
    if ctx.args.offline:
        raise FileNotFoundError(f"Offline source missing: {cache}")
    params = {"budgetCode": code, "budgetItem": source["budget_item"], "period": "QUARTER", "year": year}
    if source.get("classification_type"):
        params["classificationType"] = source["classification_type"]
    response = None
    for attempt in range(5):
        response = ctx.session.get(source["url"], params=params, timeout=240)
        response.raise_for_status()
        if "text/csv" in response.headers.get("content-type", ""):
            break
        if attempt < 4:
            time.sleep(2 ** attempt)
    assert response is not None
    if "text/csv" not in response.headers.get("content-type", ""):
        raise ValueError(f"Ukraine API returned {response.headers.get('content-type')} for {code}: {response.text[:160]}")
    cache.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache.with_suffix(cache.suffix + ".part")
    with gzip.open(temporary, "wb") as handle:
        handle.write(response.content)
    temporary.replace(cache)
    return cache


def run_ukraine_public_api(ctx: Context, country: str, cfg: dict[str, Any]) -> dict[str, Any]:
    year, currency = cfg["year"], cfg["currency"]
    sources = {source["kind"]: source for source in cfg["sources"]}
    directory_source = sources["entities"]
    directory_path = ctx.download(country, directory_source)
    municipalities = _ukraine_budget_directory(directory_path, year)[:ctx.args.max_entities or None]
    for municipality in municipalities:
        code = municipality["codebudg"]
        ctx.bundle.entity(entity_row(
            country, code, stable_code(municipality.get("namebudg")) or code, currency, ctx.loaded_at,
            code_type="UA_LOCAL_BUDGET_CODE", region_code=municipality.get("codeRegion"),
            geography_code=municipality.get("katottg"), geography_type="UA_KATOTTG",
        ))
    ctx.source_row(None, directory_source, country, cfg["coverage"])

    failures: list[str] = []
    total_loaded = 0
    for side in ("expenditure", "revenue"):
        source = sources[side]
        run_id = f"{source['id']}-{year}-v1"
        function_class = f"UA_LOCAL_FUNCTION_{year}" if side == "expenditure" else None
        economic_class = f"UA_LOCAL_{side.upper()}_{year}"
        if function_class:
            ctx.bundle.classification(classification_row(country, function_class, side, "Ukraine local budget programme and function", source["url"], year, ctx.loaded_at))
        ctx.bundle.classification(classification_row(country, economic_class, side, f"Ukraine local budget {side} classification", source["url"], year, ctx.loaded_at))
        rows_read = rows_loaded = 0
        with ThreadPoolExecutor(max_workers=ctx.args.api_workers) as executor:
            futures = {
                executor.submit(_ukraine_download_csv, ctx, country, source, year, municipality["codebudg"]): municipality
                for municipality in municipalities
            }
            for future in as_completed(futures):
                municipality = futures[future]
                code = municipality["codebudg"]
                try:
                    path = future.result()
                    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as handle:
                        reader = csv.DictReader(handle, delimiter=";")
                        for row_number, row in enumerate(reader, 2):
                            if stable_code(row.get("REP_PERIOD")) != f"12.{year}":
                                continue
                            rows_read += 1
                            function = stable_code(row.get("COD_CONS_MB_FK")) or None
                            economic = stable_code(row.get("COD_CONS_EK") or row.get("COD_INCO"))
                            if not economic:
                                continue
                            if function_class and function:
                                ctx.bundle.node(node_row(country, function_class, side, function, stable_code(row.get("COD_CONS_MB_FK_NAME")) or function, year, ctx.loaded_at))
                            ctx.bundle.node(node_row(
                                country, economic_class, side, economic,
                                stable_code(row.get("COD_CONS_EK_NAME") or row.get("NAME_INC")) or economic,
                                year, ctx.loaded_at,
                            ))
                            ctx.bundle.raw(raw_row(country, year, source, run_id, row_number, f"{code}.csv", row, ctx.loaded_at))
                            for stage, column in (("enacted", "ZAT_AMT"), ("revised", "PLANS_AMT"), ("actual", "FAKT_AMT")):
                                amount = decimal_value(row.get(column))
                                if not amount:
                                    continue
                                ctx.bundle.write("municipal_budget_line_facts", fact_row(
                                    country, f"UA:{code}", year, stage, side, function, economic, amount,
                                    currency, source, run_id, ctx.loaded_at, function_class, economic_class,
                                    row_number=row_number, sheet=f"{code}.csv", item_type=stable_code(row.get("FUND_TYP")),
                                    quality_flags=["year_end_cumulative_quarter", "official_openbudget_public_api"],
                                ))
                                rows_loaded += 1
                except Exception as exc:
                    failures.append(f"{code}:{side}:{type(exc).__name__}:{exc}")
        write_run(ctx, run_id, source, year, None, rows_read, rows_loaded)
        ctx.source_row(None, source, country, cfg["coverage"])
        total_loaded += rows_loaded
    if failures:
        raise RuntimeError(f"Ukraine API failed for {len(failures)} municipality/source requests; first: {failures[0]}")
    return {"entities": len(municipalities), "facts": total_loaded, "api_requests": len(municipalities) * 2}


def write_run(ctx: Context, run_id: str, source: dict[str, Any], year: int, path: Path | None, rows_read: int, rows_loaded: int) -> None:
    ctx.bundle.write("ingestion_runs", {
        "ingestion_run_id": run_id, "source_id": source["id"], "started_at": ctx.loaded_at,
        "completed_at": utc_now(), "status": "completed", "source_vintage": str(year),
        "source_sha256": sha256(path) if path and path.exists() else None,
        "rows_read": rows_read, "rows_loaded": rows_loaded, "warning_count": 0, "error_message": None,
    })


ADAPTERS = {
    "poland_dbf": run_poland,
    "denmark_statbank": run_denmark,
    "ukraine_openbudget": run_ukraine,
    "ukraine_openbudget_public_api": run_ukraine_public_api,
    "france_dgfip": run_france,
    "sweden_pxweb": run_sweden,
    "england_mhclg": run_england,
}


def bundle_path(output: Path, filename: str) -> Path:
    plain = output / filename
    compressed = output / f"{filename}.gz"
    return compressed if compressed.exists() else plain


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON in {path.name}:{line_number}: {exc}") from exc


def validate_bundle(output: Path) -> dict[str, Any]:
    errors: list[str] = []
    entities = set()
    for row in iter_jsonl(bundle_path(output, "public_entities.jsonl")):
        key = row["public_entity_id"]
        if key in entities:
            errors.append(f"duplicate public_entity_id: {key}")
        entities.add(key)
    classifications = {row["classification_id"] for row in iter_jsonl(bundle_path(output, "classification_versions.jsonl"))}
    nodes = set()
    for row in iter_jsonl(bundle_path(output, "budget_nodes.jsonl")):
        key = row["budget_node_id"]
        if key in nodes:
            errors.append(f"duplicate budget_node_id: {key}")
        nodes.add(key)
        if row["classification_id"] not in classifications:
            errors.append(f"node {key} has missing classification {row['classification_id']}")
    runs = {row["ingestion_run_id"] for row in iter_jsonl(bundle_path(output, "ingestion_runs.jsonl"))}
    fact_rows = 0
    for filename in ("municipal_budget_line_facts.jsonl", "public_entity_balance_sheet_facts.jsonl", "public_entity_cash_facts.jsonl"):
        for row in iter_jsonl(bundle_path(output, filename)):
            fact_rows += 1
            if row["public_entity_id"] not in entities:
                errors.append(f"{filename}: missing entity {row['public_entity_id']}")
            if row["ingestion_run_id"] not in runs:
                errors.append(f"{filename}: missing ingestion run {row['ingestion_run_id']}")
            if filename == "municipal_budget_line_facts.jsonl":
                if row["budget_stage"] not in {"proposal", "enacted", "revised", "actual"}:
                    errors.append(f"invalid budget stage: {row['budget_stage']}")
                if row["budget_side"] not in {"revenue", "expenditure", "financing"}:
                    errors.append(f"invalid budget side: {row['budget_side']}")
                for field in ("functional_classification_id", "economic_classification_id"):
                    value = row.get(field)
                    if value and value not in classifications:
                        errors.append(f"missing fact classification: {value}")
            if len(errors) >= 100:
                break
        if len(errors) >= 100:
            break
    return {"status": "passed" if not errors else "failed", "fact_rows_checked": fact_rows, "errors": errors}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--countries", default="POL,DNK,UKR,FRA,SWE,GBR", help="Comma-separated ISO alpha-3 list")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--year", type=int, help="Optional filter for multi-year source rows")
    parser.add_argument("--years", help="Comma-separated fiscal years; for example 2024,2025")
    parser.add_argument("--max-entities", type=int, help="Deterministic smoke-test limit per country")
    parser.add_argument("--raw-mode", choices=("all", "sample", "none"), default="all")
    parser.add_argument("--raw-limit", type=int, default=10000)
    parser.add_argument("--gzip", action="store_true", help="Write .jsonl.gz bundle files")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--source-file", action="append", default=[], help="Override as SOURCE_ID=/absolute/path")
    parser.add_argument("--openbudget-token")
    parser.add_argument("--api-workers", type=int, default=4, help="Concurrent workers for paged/per-entity public APIs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.year and args.years:
        raise SystemExit("Use either --year or --years, not both")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    requested = [country.strip().upper() for country in args.countries.split(",") if country.strip()]
    unknown = sorted(set(requested) - set(config["countries"]))
    if unknown:
        raise SystemExit(f"Unknown countries: {', '.join(unknown)}")
    bundle = JsonlBundle(args.output_dir, args.raw_mode, args.raw_limit, args.gzip)
    context = Context(config, args, bundle)
    results: dict[str, Any] = {}
    failures: dict[str, str] = {}
    try:
        for country in requested:
            cfg = config["countries"][country]
            try:
                yearly_results = {}
                for year in configured_years(args, cfg):
                    year_cfg = config_for_year(cfg, year)
                    if not year_cfg["sources"]:
                        yearly_results[str(year)] = {"entities": 0, "unavailable": "No configured official source for this year"}
                        continue
                    yearly_results[str(year)] = ADAPTERS[cfg["adapter"]](context, country, year_cfg)
                results[country] = yearly_results
            except Exception as exc:
                failures[country] = f"{type(exc).__name__}: {exc}"
                if not args.max_entities:
                    raise
    finally:
        bundle.close()
    validation = validate_bundle(args.output_dir)
    if validation["status"] != "passed":
        failures["bundle_validation"] = "; ".join(validation["errors"][:5])
    manifest = {
        "schema_version": "1.0.0", "generated_at": context.loaded_at, "countries_requested": requested,
        "country_results": results, "failures": failures, "output_rows": dict(bundle.counts), "validation": validation,
        "raw_mode": args.raw_mode, "max_entities": args.max_entities, "gzip": args.gzip,
        "coverage_warning": "GBR currently represents England only. Ukraine includes territorial-community budgets and Kyiv, not oblast or district budgets.",
    }
    (args.output_dir / "international_municipal_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
