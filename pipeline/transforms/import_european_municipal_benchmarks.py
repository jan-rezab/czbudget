#!/usr/bin/env python3
"""Import benchmark-ready municipal finance data from official European APIs.

The importer deliberately keeps each country's native account/classification codes.
It writes a common long fact table for analysis and a compact entity dataset for the
public website. Network responses are cached so a failed or interrupted build can be
resumed without re-downloading completed sources.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


# Imported from the unversioned sibling scripts/ directory. Workspace root is
# resolved as in every other transform here: CZBUDGET_WORKSPACE_ROOT when set,
# otherwise three levels up (website/pipeline/transforms -> workspace root).
# The previous parents[1] assumed the file lived in scripts/ and silently
# resolves to website/pipeline once the file moves.
ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
CACHE = ROOT / "data/source_cache/european_municipal_benchmarks"
DEFAULT_OUTPUT = ROOT / "outputs/20260822-european-municipal-benchmarks"
# Matches the identifying User-Agent used by the other source-fetching
# transforms (prepare_international_municipal_data.py), so the operators of the
# official open-data APIs can attribute and contact this traffic.
USER_AGENT = "czbudget-municipal-pipeline/1.0 (+https://www.czbudget.cz)"

NORWAY_TABLE = "12364"
NORWAY_URL = f"https://data.ssb.no/api/v0/en/table/{NORWAY_TABLE}"
NORWAY_DETAIL_TABLE = "12367"
NORWAY_DETAIL_URL = f"https://data.ssb.no/api/v0/en/table/{NORWAY_DETAIL_TABLE}"
NETHERLANDS_CATALOG = "https://dataderden.cbs.nl/ODataCatalog/Tables?$format=json&$filter=Catalog%20eq%20%27IV3%27"
NETHERLANDS_API = "https://dataderden.cbs.nl/ODataApi/OData/{table}"
NETHERLANDS_FEED = "https://dataderden.cbs.nl/ODataFeed/OData/{table}/TypedDataSet"
FINLAND_BASE = "https://pxdata.stat.fi/PxWeb/api/v1/en/Kuntien_talous_ja_toiminta/Kunnat/1._Ulkoiset_tilinpaatoslaskelmat"

COUNTRY_META = {
    "NOR": {"name_en": "Norway", "name_cs": "Norsko", "currency": "NOK", "slug": "norway"},
    "NLD": {"name_en": "Netherlands", "name_cs": "Nizozemsko", "currency": "EUR", "slug": "netherlands"},
    "FIN": {"name_en": "Finland", "name_cs": "Finsko", "currency": "EUR", "slug": "finland"},
}


def request(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None, timeout: int = 300) -> bytes:
    merged = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        merged.update(headers)
    req = urllib.request.Request(url, data=data, headers=merged, method="POST" if data is not None else "GET")
    last: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except Exception as exc:  # retry official APIs on transient failures
            last = exc
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError(last)


def cached_json(path: Path, url: str, *, data: dict[str, Any] | None = None, refresh: bool = False) -> Any:
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))
    payload = None if data is None else json.dumps(data).encode("utf-8")
    raw = request(url, data=payload, headers={"Content-Type": "application/json"} if payload else None)
    value = json.loads(raw)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def number(value: Any, multiplier: float = 1.0) -> float | None:
    if value in (None, "", ".", "..", "..."):
        return None
    try:
        return float(value) * multiplier
    except (TypeError, ValueError):
        return None


def slugify(value: str) -> str:
    import unicodedata

    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-") or "municipality"


def write_fact(handle: gzip.GzipFile, row: dict[str, Any]) -> None:
    handle.write((json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))


def pxweb_rows(metadata: dict[str, Any], result: dict[str, Any]) -> Iterable[tuple[list[str], float | None]]:
    """Expand a JSON-stat2 PxWeb response without materialising all combinations."""
    dimension = result["dimension"]
    ids = result["id"]
    sizes = result["size"]
    labels: list[list[str]] = []
    for code in ids:
        category = dimension[code]["category"]
        ordered = sorted(category["index"].items(), key=lambda pair: pair[1]) if isinstance(category["index"], dict) else []
        labels.append([key for key, _ in ordered])
    values = result["value"]
    total = 1
    for size in sizes:
        total *= size
    for flat in range(total):
        remainder = flat
        coords = [0] * len(sizes)
        for index in range(len(sizes) - 1, -1, -1):
            coords[index] = remainder % sizes[index]
            remainder //= sizes[index]
        yield [labels[index][coord] for index, coord in enumerate(coords)], number(values[flat])


def norway(output: Path, facts: gzip.GzipFile, refresh: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    cache = CACHE / "NOR"
    meta = cached_json(cache / "12364-metadata.json", NORWAY_URL, refresh=refresh)
    query = {
        "query": [{"code": variable["code"], "selection": {"filter": "all", "values": ["*"]}} for variable in meta["variables"]],
        "response": {"format": "json-stat2"},
    }
    result = cached_json(cache / "12364-all-2015-2025.json", NORWAY_URL, data=query, refresh=refresh)
    variables = {variable["code"]: variable for variable in meta["variables"]}
    region_var, concept_var, _, year_var = [variable["code"] for variable in meta["variables"]]
    region_names = dict(zip(variables[region_var]["values"], variables[region_var]["valueTexts"]))
    concept_names = dict(zip(variables[concept_var]["values"], variables[concept_var]["valueTexts"]))
    by_entity: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    fact_count = 0
    for keys, value in pxweb_rows(meta, result):
        region, concept, _, year_text = keys
        if value is None or not re.fullmatch(r"\d{4}", region):
            continue
        year = int(year_text)
        amount = value * 1000.0
        by_entity[region][year][concept] = amount
        write_fact(facts, {
            "country_code": "NOR", "entity_id": f"NO:{region}", "national_code": region,
            "entity_name": region_names[region], "fiscal_year": year, "budget_stage": "actual",
            "classification": "NO_KOSTRA_ACCOUNTING_CONCEPT", "function_code": None, "function_name": None,
            "account_code": concept, "account_name": concept_names[concept], "measure": "accounting_amount",
            "amount_local": amount, "currency_code": "NOK", "source_url": NORWAY_URL,
        })
        fact_count += 1

    # Only codes with a 2025 observation are active municipalities in the latest vintage.
    entities = []
    for code, years in by_entity.items():
        if 2025 not in years:
            continue
        history = []
        for year, concepts in sorted(years.items()):
            labelled = {concept_names[key].casefold(): value for key, value in concepts.items()}
            def find(*phrases: str) -> float | None:
                for label, value in labelled.items():
                    if all(phrase in label for phrase in phrases):
                        return value
                return None
            revenue = find("gross operating revenues") or find("total operating revenues")
            expenditure = find("gross operating expenditure") or find("total operating expenditure")
            result_value = find("net operating result")
            debt = find("long-term debt") or find("net loan debt")
            history.append({
                "year": year, "revenue": revenue, "expenditure": expenditure, "balance": result_value, "debt": debt,
                "_native_measures": [
                    {"code": key, "name": concept_names[key], "amount": value}
                    for key, value in sorted(concepts.items(), key=lambda item: concept_names[item[0]].casefold())
                ],
            })
        entities.append(entity_payload("NOR", code, region_names[code], history, source=NORWAY_URL, measures=len(concept_names)))

    # Table 12367 adds the latest functional detail. Two non-overlapping gross
    # measures retain the complete 97-function service view without publishing
    # redundant subtotal variants from all 35 account measures.
    detail_meta = cached_json(cache / "12367-metadata.json", NORWAY_DETAIL_URL, refresh=refresh)
    detail_variables = {variable["code"]: variable for variable in detail_meta["variables"]}
    function_var = detail_meta["variables"][2]
    account_var = detail_meta["variables"][3]
    function_names = dict(zip(function_var["values"], function_var["valueTexts"]))
    account_names = dict(zip(account_var["values"], account_var["valueTexts"]))
    selected_accounts = ["AGD10", "AGD14"]  # gross operating expenditure / revenue
    detail_by_entity: dict[str, list[dict[str, Any]]] = defaultdict(list)
    active_codes = [entity["code"] for entity in entities]
    for offset in range(0, len(active_codes), 40):
        batch = active_codes[offset:offset + 40]
        selections = {
            detail_meta["variables"][0]["code"]: batch,
            detail_meta["variables"][1]["code"]: ["B"],
            function_var["code"]: function_var["values"],
            account_var["code"]: selected_accounts,
            detail_meta["variables"][4]["code"]: detail_meta["variables"][4]["values"],
            detail_meta["variables"][5]["code"]: ["2025"],
        }
        detail_query = {
            "query": [
                {"code": variable["code"], "selection": {"filter": "item", "values": selections[variable["code"]]}}
                for variable in detail_meta["variables"]
            ],
            "response": {"format": "json-stat2"},
        }
        detail_result = cached_json(cache / f"12367-2025-functions-{offset:04d}.json", NORWAY_DETAIL_URL, data=detail_query, refresh=refresh)
        for keys, value in pxweb_rows(detail_meta, detail_result):
            region, _, function, account, _, year_text = keys
            if value is None or value == 0:
                continue
            amount = value * 1000.0
            detail_by_entity[region].append({
                "code": f"{function}:{account}",
                "name": f"{function_names[function]} — {account_names[account]}",
                "amount": amount,
            })
            write_fact(facts, {
                "country_code": "NOR", "entity_id": f"NO:{region}", "national_code": region,
                "entity_name": region_names[region], "fiscal_year": int(year_text), "budget_stage": "actual",
                "classification": "NO_KOSTRA_FUNCTION_ACCOUNT", "function_code": function,
                "function_name": function_names[function], "account_code": account,
                "account_name": account_names[account], "measure": "accounting_amount",
                "amount_local": amount, "currency_code": "NOK", "source_url": NORWAY_DETAIL_URL,
            })
            fact_count += 1
    for entity in entities:
        entity["breakdown"] = sorted(detail_by_entity[entity["code"]], key=lambda row: row["code"])
        entity["breakdown_kind"] = "native_measures"
        entity["measure_count"] = len(entity["breakdown"])
        entity["source_url"] = NORWAY_DETAIL_URL
    return entities, {"facts": fact_count, "entities": len(entities), "years": [2015, 2025], "measures": "80 summary + 97 functions × 2 gross measures"}


def cbs_collection(table: str, name: str, refresh: bool) -> list[dict[str, Any]]:
    return cached_json(CACHE / "NLD" / f"{table}-{name}.json", f"{NETHERLANDS_API.format(table=table)}/{name}?$format=json", refresh=refresh)["value"]


def netherlands_table_for_year(year: int, refresh: bool) -> str:
    catalog = cached_json(CACHE / "NLD" / "catalog.json", NETHERLANDS_CATALOG, refresh=refresh)
    title = f"Gemeenten {year} onbewerkte Iv3-data"
    matches = [row for row in catalog["value"] if row.get("Title", "").strip() == title]
    if not matches:
        raise RuntimeError(f"CBS Iv3 table not found for {year}")
    return matches[0]["Identifier"]


def cbs_pages(base_url: str, page_dir: Path, refresh: bool) -> Iterable[dict[str, Any]]:
    """Fetch independent OData continuation offsets concurrently and in order."""
    page_size, workers, start = 10_000, 6, 0

    def load(index: int) -> dict[str, Any]:
        page_path = page_dir / f"page-{index:05d}.json.gz"
        if page_path.exists() and not refresh:
            with gzip.open(page_path, "rt", encoding="utf-8") as handle:
                return json.load(handle)
        separator = "&" if "?" in base_url else "?"
        raw = request(f"{base_url}{separator}$skip={index * page_size}", timeout=900)
        with gzip.open(page_path, "wb", compresslevel=6) as handle:
            handle.write(raw)
        return json.loads(raw)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        while True:
            indexes = list(range(start, start + workers))
            pages = list(pool.map(load, indexes))
            complete = False
            for page in pages:
                if not page.get("value"):
                    return
                yield page
                if len(page["value"]) < page_size:
                    complete = True
                    break
            if complete:
                return
            start += workers


def netherlands(output: Path, facts: gzip.GzipFile, years: list[int], refresh: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_entity: dict[str, dict[int, dict[str, Any]]] = defaultdict(dict)
    names: dict[str, str] = {}
    fact_count = 0
    for year in years:
        table = netherlands_table_for_year(year, refresh)
        municipalities = cbs_collection(table, "Gemeenten", refresh)
        tasks = cbs_collection(table, "TaakveldBalanspost", refresh)
        categories = cbs_collection(table, "Categorie", refresh)
        names.update({row["Key"].strip().removeprefix("GM"): row["Title"] for row in municipalities})
        task_names = {row["Key"].strip(): row["Title"] for row in tasks}
        category_names = {row["Key"].strip(): row["Title"] for row in categories}
        stage = f"{year}X005"
        # The Iv3 table is a sparse Cartesian cube. Filtering null observations
        # server-side reduces hundreds of empty continuation pages without
        # dropping a single reported accounting value.
        observation_filter = f"Verslagsoort eq '{stage}' and ((k_1ePlaatsing_1 ne null and k_1ePlaatsing_1 ne 0) or (k_2ePlaatsing_2 ne null and k_2ePlaatsing_2 ne 0))"
        params = urllib.parse.urlencode({"$format": "json", "$filter": observation_filter})
        page_dir = CACHE / "NLD" / f"{table}-annual-account-nonzero-pages"
        page_dir.mkdir(parents=True, exist_ok=True)
        page_url = f"{NETHERLANDS_FEED.format(table=table)}?{params}"
        summaries: dict[str, dict[str, Any]] = defaultdict(lambda: {"revenue": 0.0, "expenditure": 0.0, "balance": 0.0, "functions": defaultdict(lambda: {"revenue": 0.0, "expenditure": 0.0})})
        for page in cbs_pages(page_url, page_dir, refresh):
            for row in page["value"]:
                amount = number(row.get("k_2ePlaatsing_2"))
                if amount is None:
                    amount = number(row.get("k_1ePlaatsing_1"))
                if amount is None:
                    continue
                amount *= 1000.0
                code = row["Gemeenten"].strip().removeprefix("GM")
                task = row["TaakveldBalanspost"].strip()
                account = row["Categorie"].strip()
                is_function = bool(re.fullmatch(r"\d+(?:\.\d+)?", task))
                measure = "expenditure" if account.startswith("L") else "revenue" if account.startswith("B") else "balance_sheet"
                # 0.10 (reserve mutations) and 0.11 (closing result allocation)
                # are financing/closing fields. Including them makes revenue and
                # expenditure converge by construction and obscures the operating
                # result used for municipal benchmarking.
                if is_function and task not in {"0.10", "0.11"} and measure in {"revenue", "expenditure"}:
                    summaries[code][measure] += amount
                    summaries[code]["functions"][task][measure] += amount
                    summaries[code]["balance"] = summaries[code]["revenue"] - summaries[code]["expenditure"]
                write_fact(facts, {
                    "country_code": "NLD", "entity_id": f"NL:{code}", "national_code": code,
                    "entity_name": names.get(code, code), "fiscal_year": year, "budget_stage": "actual",
                    "classification": "NL_IV3_BBV", "function_code": task, "function_name": task_names.get(task),
                    "account_code": account, "account_name": category_names.get(account), "measure": measure,
                    "amount_local": amount, "currency_code": "EUR",
                    "source_url": NETHERLANDS_API.format(table=table),
                })
                fact_count += 1
        for code, summary in summaries.items():
            top = sorted(({"code": key, "name": task_names.get(key, key), **values} for key, values in summary["functions"].items()), key=lambda item: item["expenditure"], reverse=True)
            by_entity[code][year] = {"year": year, "revenue": summary["revenue"], "expenditure": summary["expenditure"], "balance": summary["balance"], "functions": top}
    entities = [entity_payload("NLD", code, names[code], [by_entity[code][year] for year in sorted(by_entity[code])], source="https://www.cbs.nl/nl-nl/onze-diensten/open-data/iv3", measures=78) for code in sorted(by_entity)]
    return entities, {"facts": fact_count, "entities": len(entities), "years": [min(years), max(years)], "measures": 78}


def finland(output: Path, facts: gzip.GzipFile, years: list[int], refresh: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    listing = cached_json(CACHE / "FIN" / "financial-statements-list.json", FINLAND_BASE + "/", refresh=refresh)
    tables = {int(re.search(r"(20\d{2})", row["text"]).group(1)): row["id"] for row in listing if re.search(r"(20\d{2})", row["text"])}
    by_entity: dict[str, dict[int, dict[str, float | int]]] = defaultdict(dict)
    names: dict[str, str] = {}
    fact_count = 0
    for year in years:
        table = tables.get(year)
        if not table:
            continue
        url = f"{FINLAND_BASE}/{table}"
        meta = cached_json(CACHE / "FIN" / f"{year}-metadata.json", url, refresh=refresh)
        query = {"query": [{"code": variable["code"], "selection": {"filter": "all", "values": ["*"]}} for variable in meta["variables"]], "response": {"format": "json-stat2"}}
        result = cached_json(CACHE / "FIN" / f"{year}-all.json", url, data=query, refresh=refresh)
        region, item, time_code = [variable["code"] for variable in meta["variables"]]
        region_names = dict(zip(meta["variables"][0]["values"], meta["variables"][0]["valueTexts"]))
        item_names = dict(zip(meta["variables"][1]["values"], meta["variables"][1]["valueTexts"]))
        names.update(region_names)
        for keys, value in pxweb_rows(meta, result):
            # Statistics Finland adds an eliminated single-value content
            # dimension to JSON-stat2 ahead of the three requested dimensions.
            if len(keys) == 4:
                _, code, item_code, year_text = keys
            else:
                code, item_code, year_text = keys
            if value is None:
                continue
            value *= 1000.0  # table unit is EUR 1,000
            write_fact(facts, {
                "country_code": "FIN", "entity_id": f"FI:{code}", "national_code": code,
                "entity_name": region_names[code], "fiscal_year": int(year_text), "budget_stage": "actual",
                "classification": "FI_MUNICIPAL_FINANCIAL_STATEMENT", "function_code": None, "function_name": None,
                "account_code": item_code, "account_name": item_names[item_code], "measure": "accounting_amount",
                "amount_local": value, "currency_code": "EUR", "source_url": url,
            })
            fact_count += 1
            label = item_names[item_code].casefold()
            summary = by_entity[code].setdefault(year, {"year": year})
            summary.setdefault("_native_measures", []).append({"code": item_code, "name": item_names[item_code], "amount": value})
            revenue_components = {
                "operating revenue total", "tax revenue", "central government transfers to local government",
                "interest income", "other financing income", "extraordinary income",
            }
            expenditure_components = {
                "operating expenses total", "interest expenses", "other financing expenses",
                "extraordinary expenses", "depreciations and reduction in value",
            }
            if label in revenue_components:
                summary["_revenue_components"] = float(summary.get("_revenue_components", 0.0)) + value
                summary["revenue"] = float(summary["_revenue_components"])
            elif label in expenditure_components:
                summary["_expenditure_components"] = float(summary.get("_expenditure_components", 0.0)) + abs(value)
                summary["expenditure"] = float(summary["_expenditure_components"])
            elif label == "surplus/ deficit for the accounting period +/-":
                summary["balance"] = value
            elif label == "long-term liabilities":
                summary["debt"] = abs(value)
    latest_year = max(years)
    entities = [
        entity_payload("FIN", code, names[code], [by_entity[code][year] for year in sorted(by_entity[code])], source=FINLAND_BASE, measures=203)
        for code in sorted(by_entity) if latest_year in by_entity[code]
    ]
    return entities, {"facts": fact_count, "entities": len(entities), "years": [min(years), max(years)], "measures": 203}


def entity_payload(country: str, code: str, name: str, history: list[dict[str, Any]], *, source: str, measures: int) -> dict[str, Any]:
    meta = COUNTRY_META[country]
    latest = history[-1]
    clean_history = [{key: value for key, value in row.items() if key != "functions" and not key.startswith("_")} for row in history]
    return {
        "id": f"{country}:{code}", "country": country, "code": code, "name": name,
        "currency": meta["currency"], "years": [row["year"] for row in history],
        "latest": {key: value for key, value in latest.items() if key != "functions" and not key.startswith("_")},
        "history": clean_history, "breakdown": latest.get("functions") or latest.get("_native_measures", []),
        "breakdown_kind": "functions" if latest.get("functions") else "native_measures",
        "source_url": source, "measure_count": measures,
        "url": f"/municipalities/{meta['slug']}/{slugify(name)}-{code.lower()}/",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--countries", default="NOR,NLD,FIN")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--nld-years", default="2024,2025")
    parser.add_argument("--fin-years", default="2015,2016,2017,2018,2019,2020")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    requested = [value.strip().upper() for value in args.countries.split(",") if value.strip()]
    args.output.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    all_entities: list[dict[str, Any]] = []
    stats: dict[str, Any] = {}
    facts_path = args.output / "municipal_benchmark_facts.jsonl.gz"
    with gzip.open(facts_path, "wb", compresslevel=6) as facts:
        if "NOR" in requested:
            entities, stats["NOR"] = norway(args.output, facts, args.refresh)
            all_entities.extend(entities)
        if "NLD" in requested:
            entities, stats["NLD"] = netherlands(args.output, facts, [int(value) for value in args.nld_years.split(",")], args.refresh)
            all_entities.extend(entities)
        if "FIN" in requested:
            entities, stats["FIN"] = finland(args.output, facts, [int(value) for value in args.fin_years.split(",")], args.refresh)
            all_entities.extend(entities)
    generated = datetime.now(timezone.utc).isoformat()
    dataset = {"schema_version": "1.0.0", "generated_at": generated, "countries": requested, "entities": all_entities}
    (args.output / "municipal_benchmark_entities.json").write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # The manifest asserted "passed" unconditionally, which made it a claim
    # about nothing. Report what was actually observed instead: a country that
    # yielded no entities or no facts is a failed import, not a silent pass.
    errors = [
        f"{code}: imported {item.get('facts', 0)} facts for {item.get('entities', 0)} entities"
        for code, item in stats.items()
        if not item.get("facts") or not item.get("entities")
    ]
    manifest = {
        "schema_version": "1.0.0", "generated_at": generated, "countries": stats,
        "output_rows": {"entities": len(all_entities), "facts": sum(item["facts"] for item in stats.values())},
        "validation": {"status": "failed" if errors else "passed", "errors": errors},
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
