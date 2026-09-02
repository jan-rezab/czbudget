#!/usr/bin/env python3
"""Fetch cached sample or complete contract history from Hlídač státu API v2."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_URL = "https://api.hlidacstatu.cz/api/v2/smlouvy/hledat"
DEFAULT_ICO = "00075370"
DEFAULT_OUTPUT = ROOT / "data/contracts/00075370.v1.json"
DEFAULT_FULL_OUTPUT = ROOT / "data/contracts/00075370.full.v1.json.gz"
DEFAULT_CHECKPOINT = ROOT / ".cache/contracts/00075370.full.checkpoint.jsonl"
DEFAULT_BUDGET_PROFILE = ROOT / ".warehouse-profiles/cze/00075370.json"
MAX_PAGES = 100
API_MAX_PAGES = 200
MIN_INTERVAL_SECONDS = 0.5

CATEGORY_RULES = [
    ("professional", "Professional services", ("poraden", "právn", "audit", "studie", "dokumentac", "dozor", "projektov")),
    ("construction", "Construction & infrastructure", ("stavb", "rekonstruk", "oprava", "most", "komunikac", "chodník", "kanaliz", "vodovod", "demolic")),
    ("property", "Property & land", ("nájem", "pronájem", "pozem", "nemovit", "služebnost", "věcné břemeno")),
    ("digital", "IT & digital", ("software", "licenc", "implement", "aplikac", "server", "datov", "kyber", "informační systém")),
    ("transport", "Transport & mobility", ("doprava", "vozid", "tramvaj", "autobus", "parkov", "silnic", "cyklo")),
    ("environment", "Environment & waste", ("odpad", "zeleň", "sadov", "strom", "sběrný dvůr", "ekolog", "výsadb")),
    ("community", "Culture, sport & community", ("kultur", "divadl", "festival", "sport", "výstav", "muze", "koncert", "akce")),
    ("public_services", "Education, health & social", ("škol", "vzděl", "sociální", "zdravot", "senior", "dětsk", "dítě")),
    ("supplies", "Supplies & equipment", ("dodávka", "nákup", "zařízení", "materiál", "vybavení", "tisk", "polep")),
    ("grants", "Grants & cooperation", ("dotace", "darovac", "spolupráce", "partnerství")),
]

BUDGET_ITEM_LABELS = {
    "5139": "Nákup materiálu jinde nezařazený",
    "5151": "Studená voda včetně stočného a poplatku za odvod dešťových vod",
    "5153": "Plyn",
    "5154": "Elektrická energie",
    "5156": "Pohonné hmoty a maziva",
    "5161": "Poštovní služby",
    "5162": "Služby elektronických komunikací",
    "5163": "Služby peněžních ústavů",
    "5164": "Nájemné",
    "5166": "Konzultační, poradenské a právní služby",
    "5167": "Služby školení a vzdělávání",
    "5168": "Zpracování dat a ICT služby",
    "5169": "Nákup ostatních služeb",
    "5171": "Opravy a udržování",
    "5213": "Neinvestiční transfery nefinančním podnikatelům – právnickým osobám",
    "5221": "Neinvestiční transfery fundacím, ústavům a obecně prospěšným společnostem",
    "5222": "Neinvestiční transfery spolkům",
    "5223": "Neinvestiční transfery církvím a náboženským společnostem",
    "5331": "Neinvestiční příspěvky zřízeným příspěvkovým organizacím",
    "6121": "Stavby",
    "6122": "Stroje, přístroje a zařízení",
    "6123": "Dopravní prostředky",
    "6130": "Pozemky",
    "6351": "Investiční transfery zřízeným příspěvkovým organizacím",
}

BUDGET_RULES = [
    (("poraden", "právn", "audit", "konzulta"), ("5166",), "high", "consulting_legal_or_audit"),
    (("projektová dokument", "zpracování pd", "technický dozor", "dozor projektanta", "autorský dozor", "bozp", "studie", "posudek", "geodet"), ("5166",), "medium", "technical_professional_service"),
    (("školení", "kurz", "vzdělávání"), ("5167",), "high", "training"),
    (("software", "licenc", "informační systém", "informačního systém", "datov", "aplikac", "kyber"), ("5168",), "medium", "ict_service_or_software"),
    (("telekomunika", "telefon", "mobilní služby", "internetové připojení", "datové připojení"), ("5162",), "medium", "electronic_communications"),
    (("poštovní", "poštovné", "kurýr"), ("5161",), "high", "postal_or_courier"),
    (("pojišť", "bankovní služ", "platební styk"), ("5163",), "high", "insurance_or_banking"),
    (("elektrická energie", "dodávka elektřiny", "dodávky elektřiny"), ("5154",), "high", "electricity"),
    (("dodávka plynu", "dodávky plynu"), ("5153",), "high", "gas"),
    (("vodné", "stočné", "dodávka vody"), ("5151",), "high", "water"),
    (("pohonné hmot", "benzín", "motorová nafta", "palivo"), ("5156",), "high", "fuel"),
    (("oprav", "údržb", "servis", "rekonstruk"), ("5171",), "high", "repair_or_maintenance"),
    (("výměna", "výměny", "odstranění závad", "revize elektro", "podlah", "oken", "dveří", "elektroinstal"), ("5171",), "medium", "replacement_or_remedial_work"),
    (("nájem", "pronájem"), ("5164",), "high", "rent"),
    (("pozemek", "pozemk", "parcela"), ("6130",), "medium", "land"),
    (("vozid", "automobil", "tramvaj", "autobus"), ("6123",), "medium", "vehicle"),
    (("stavb", "staveb", "výstavb", "vícepráce", "parkovací dům", "most", "chodník", "komunikac", "kanaliz", "vodovod"), ("6121",), "medium", "construction"),
    (("stroj", "přístroj", "technolog", "zařízení"), ("6122",), "medium", "equipment"),
    (("materiál", "dodávka materiálu"), ("5139",), "medium", "material"),
    (("dotace", "darovac", "grant", "příspěvek"), ("5213", "5221", "5222", "5223", "5331", "6351"), "low", "grant_or_transfer"),
    (("úklid", "ostraha", "tisk", "distribuc", "catering", "zálivk", "řez strom", "řez dřevin", "kácen", "veterin", "inzert", "reklam", "propagac", "produkce", "zajištění akce"), ("5169",), "low", "other_operating_service"),
]

CATEGORY_BUDGET_FALLBACKS = {
    "professional": ("5166",),
    "construction": ("6121",),
    "property": ("5164", "6130"),
    "digital": ("5168",),
    "transport": ("5169", "6123"),
    "environment": ("5169",),
    "community": ("5169",),
    "public_services": ("5169",),
    "supplies": ("5139", "6122"),
    "grants": ("5213", "5221", "5222", "5223", "5331", "6351"),
}


def first(mapping: dict, *names: str):
    for name in names:
        if name in mapping:
            return mapping[name]
    return None


def compact_party(party: dict | None) -> dict | None:
    if not party:
        return None
    return {
        "name": first(party, "nazev", "Nazev", "name", "Name"),
        "ico": first(party, "ico", "Ico", "ICO"),
    }


def categorize(subject: str | None) -> dict:
    normalized = (subject or "").casefold()
    for category_id, label, needles in CATEGORY_RULES:
        if any(needle in normalized for needle in needles):
            return {"id": category_id, "label": label, "method": "subject_keyword_v1"}
    return {"id": "other", "label": "Other", "method": "subject_keyword_v1"}


def compact_contract(item: dict) -> dict:
    recipients = first(item, "prijemce", "Prijemce", "recipients", "Recipients") or []
    contract_id = first(item, "id", "Id")
    source_url = first(item, "odkaz", "Odkaz")
    subject = first(item, "predmet", "Predmet")
    classification = first(item, "classification", "Classification") or {}
    value_czk = first(item, "calculatedPriceWithVATinCZK", "CalculatedPriceWithVATinCZK")
    return {
        "id": contract_id,
        "subject": subject,
        "signed_at": first(item, "datumUzavreni", "DatumUzavreni"),
        "published_at": first(item, "casZverejneni", "CasZverejneni"),
        "value_czk": value_czk if value_czk else None,
        "payer": compact_party(first(item, "platce", "Platce")),
        "suppliers": [party for party in (compact_party(value) for value in recipients) if party],
        "category": categorize(subject),
        "source_classification": {
            "version": first(classification, "version", "Version"),
            "type_values": [
                first(value, "typeValue", "TypeValue")
                for key in ("class1", "class2", "class3")
                if (value := first(classification, key, key.capitalize())) and first(value, "typeValue", "TypeValue") is not None
            ],
        },
        "source_url": source_url or (f"https://www.hlidacstatu.cz/Detail/{contract_id}" if contract_id else None),
        "parent_contract_id": first(item, "navazanyZaznam", "NavazanyZaznam"),
    }


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def add_recency_tags(contracts: list[dict]) -> str | None:
    dates = [parsed for item in contracts if (parsed := parse_date(item.get("published_at")))]
    if not dates:
        return None
    latest = max(dates)
    for item in contracts:
        published = parse_date(item.get("published_at"))
        if published is None:
            item["recency"] = {"band": "unknown", "days_from_latest": None}
            continue
        days = max(0, (latest.date() - published.date()).days)
        band = "last_7_days" if days <= 7 else "last_30_days" if days <= 30 else "last_90_days" if days <= 90 else "older"
        item["recency"] = {"band": band, "days_from_latest": days}
    return latest.isoformat()


def infer_budget_match(subject: str | None, available_codes: set[str] | None = None, category_id: str | None = None) -> dict:
    normalized = (subject or "").casefold()
    for needles, codes, confidence, rule in BUDGET_RULES:
        if any(needle in normalized for needle in needles):
            selected = [code for code in codes if available_codes is None or code in available_codes]
            if not selected:
                break
            return {
                "status": "inferred",
                "dimension": "economic_item",
                "codes": selected,
                "labels": [BUDGET_ITEM_LABELS[code] for code in selected],
                "confidence": confidence,
                "rule": rule,
                "method": "subject_to_economic_item_v1",
            }
    fallback_codes = CATEGORY_BUDGET_FALLBACKS.get(category_id or "", ())
    selected = [code for code in fallback_codes if available_codes is None or code in available_codes]
    if selected:
        return {
            "status": "inferred",
            "dimension": "economic_item",
            "codes": selected,
            "labels": [BUDGET_ITEM_LABELS[code] for code in selected],
            "confidence": "low",
            "rule": f"category_fallback:{category_id}",
            "method": "category_to_economic_item_v1",
        }
    return {"status": "unmatched", "dimension": "economic_item", "method": "subject_to_economic_item_v1"}


def load_budget_context(path: Path | None) -> dict | None:
    if path is None or not path.exists():
        return None
    profile = json.loads(path.read_text(encoding="utf-8"))
    rows = [
        row for row in profile.get("detail", [])
        if row.get("year") == 2025 and row.get("stage") == "actual" and row.get("side") == "expenditure"
        and str(row.get("code")) in BUDGET_ITEM_LABELS
    ]
    items = {
        str(row["code"]): {"code": str(row["code"]), "label": BUDGET_ITEM_LABELS[str(row["code"])], "actual_czk": row.get("amount")}
        for row in rows
    }
    return {
        "year": 2025,
        "stage": "actual",
        "side": "expenditure",
        "dimension": "economic_item",
        "items": items,
        "comparison_warning": "Contract values and 2025 cash expenditure are not an accounting reconciliation.",
    }


def enrich_payload(payload: dict, budget_context: dict | None) -> dict:
    contracts = payload.get("contracts", [])
    latest = add_recency_tags(contracts)
    available_codes = set((budget_context or {}).get("items", {})) or None
    for item in contracts:
        item["budget_match"] = infer_budget_match(item.get("subject"), available_codes, item.get("category", {}).get("id"))
    contracts_by_id = {str(item.get("id")): item for item in contracts if item.get("id")}
    confidence_step_down = {"high": "medium", "medium": "low", "low": "low"}
    for _ in range(4):
        inherited = 0
        for item in contracts:
            if item.get("budget_match", {}).get("status") != "unmatched" or not item.get("parent_contract_id"):
                continue
            parent = contracts_by_id.get(str(item["parent_contract_id"]))
            parent_match = (parent or {}).get("budget_match", {})
            if parent_match.get("status") != "inferred":
                continue
            item["budget_match"] = {
                **parent_match,
                "confidence": confidence_step_down.get(parent_match.get("confidence"), "low"),
                "rule": "inherited_from_related_contract",
                "method": "related_contract_inheritance_v1",
                "inherited_from": str(parent["id"]),
            }
            inherited += 1
        if not inherited:
            break
    payload["recency_reference"] = {
        "latest_published_at": latest,
        "method": "relative_to_dataset_max_published_at_v1",
    }
    if budget_context:
        payload["budget_context"] = budget_context
    payload["schema_version"] = "1.1.0"
    return payload


def fetch_page(token: str, query: str, page: int, retries: int = 8) -> dict:
    url = API_URL + "?" + urllib.parse.urlencode({"dotaz": query, "strana": page, "razeni": 1})
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Token {token}",
            "User-Agent": "PublicSpendingData/contract-importer (+https://publicspendingdata.org)",
        },
    )
    for attempt in range(retries):
        retry_delay = min(60.0, 2.0 ** attempt) + random.uniform(0.1, 0.5)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == retries - 1:
                raise
            if error.code == 429:
                try:
                    retry_delay = max(retry_delay, float(error.headers.get("Retry-After", "15")))
                except (TypeError, ValueError):
                    retry_delay = max(retry_delay, 15.0)
        except (TimeoutError, urllib.error.URLError):
            if attempt == retries - 1:
                raise
        time.sleep(retry_delay)
    raise RuntimeError("Hlídač státu request failed")


def yearly_windows(start: date, end: date) -> list[tuple[date, date]]:
    windows = []
    cursor = start
    while cursor <= end:
        window_end = min(end, date(cursor.year, 12, 31))
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def split_window(start: date, end: date) -> tuple[tuple[date, date], tuple[date, date]]:
    midpoint = start + timedelta(days=(end - start).days // 2)
    return (start, midpoint), (midpoint + timedelta(days=1), end)


def window_query(ico: str, start: date, end: date) -> str:
    return f"icoPlatce:{ico} AND zverejneno:[{start.isoformat()} TO {end.isoformat()}]"


def load_checkpoint(path: Path) -> tuple[set[tuple[str, str, int]], list[dict]]:
    completed: set[tuple[str, str, int]] = set()
    contracts: list[dict] = []
    if not path.exists():
        return completed, contracts
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            key = (record["start"], record["end"], int(record["page"]))
            completed.add(key)
            contracts.extend(record.get("contracts", []))
    return completed, contracts


def append_checkpoint(path: Path, start: date, end: date, page: int, contracts: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"start": start.isoformat(), "end": end.isoformat(), "page": page, "contracts": contracts}, ensure_ascii=False) + "\n")
        handle.flush()


def fetch_full_history(token: str, ico: str, start: date, end: date, checkpoint: Path) -> tuple[list[dict], int, int]:
    completed, cached_contracts = load_checkpoint(checkpoint)
    requests_made = 0
    windows_completed = 0
    pending = yearly_windows(start, end)
    while pending:
        window_start, window_end = pending.pop(0)
        query = window_query(ico, window_start, window_end)
        time.sleep(MIN_INTERVAL_SECONDS if requests_made else 0)
        first_page = fetch_page(token, query, 1)
        requests_made += 1
        results = first(first_page, "results", "Results") or []
        total = int(first(first_page, "total", "Total") or len(results))
        page_size = len(results) or 25
        pages = max(1, (total + page_size - 1) // page_size)
        if pages > API_MAX_PAGES:
            capped_keys = {(window_start.isoformat(), window_end.isoformat(), page) for page in range(1, API_MAX_PAGES + 1)}
            if capped_keys.issubset(completed):
                published = [
                    parsed.date() for item in cached_contracts
                    if (parsed := parse_date(item.get("published_at"))) and window_start <= parsed.date() <= window_end
                ]
                oldest_cached = min(published) if published else None
                if oldest_cached and oldest_cached > window_start:
                    pending.insert(0, (window_start, oldest_cached))
                    print(f"overflow tail {window_start}..{oldest_cached}: full window already cached through page {API_MAX_PAGES}", flush=True)
                    continue
            if window_start >= window_end:
                raise RuntimeError(f"Single-day window exceeds {API_MAX_PAGES} pages: {window_start} ({total} contracts)")
            left, right = split_window(window_start, window_end)
            pending[:0] = [left, right]
            print(f"split {window_start}..{window_end}: {total} contracts", flush=True)
            continue

        first_key = (window_start.isoformat(), window_end.isoformat(), 1)
        if first_key not in completed:
            compacted = [compact_contract(item) for item in results]
            append_checkpoint(checkpoint, window_start, window_end, 1, compacted)
            cached_contracts.extend(compacted)
            completed.add(first_key)
        for page_number in range(2, pages + 1):
            key = (window_start.isoformat(), window_end.isoformat(), page_number)
            if key in completed:
                continue
            time.sleep(MIN_INTERVAL_SECONDS)
            page = fetch_page(token, query, page_number)
            requests_made += 1
            compacted = [compact_contract(item) for item in (first(page, "results", "Results") or [])]
            append_checkpoint(checkpoint, window_start, window_end, page_number, compacted)
            cached_contracts.extend(compacted)
            completed.add(key)
            if page_number % 25 == 0 or page_number == pages:
                print(f"window {window_start}..{window_end}: page {page_number}/{pages}", flush=True)
        windows_completed += 1

    deduplicated = {item.get("id"): item for item in cached_contracts if item.get("id")}
    contracts = sorted(deduplicated.values(), key=lambda item: item.get("published_at") or "", reverse=True)
    return contracts, requests_made, windows_completed


def write_payload(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    if path.suffix == ".gz":
        with gzip.open(path, "wt", encoding="utf-8", compresslevel=6) as handle:
            handle.write(serialized)
    else:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_payload(path: Path) -> dict:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ico", default=DEFAULT_ICO, help="payer IČO")
    parser.add_argument("--pages", type=int, default=1, help=f"pages to fetch (1-{MAX_PAGES})")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--budget-profile", type=Path, default=DEFAULT_BUDGET_PROFILE)
    parser.add_argument("--reuse-existing", action="store_true", help="enrich the cached output without calling the API")
    parser.add_argument("--full", action="store_true", help="fetch the complete publication history using resumable date windows")
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2016, 7, 1))
    parser.add_argument("--end-date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    args = parser.parse_args()
    if args.full and args.output == DEFAULT_OUTPUT:
        args.output = DEFAULT_FULL_OUTPUT
    if not 1 <= args.pages <= MAX_PAGES:
        parser.error(f"--pages must be between 1 and {MAX_PAGES}")

    budget_context = load_budget_context(args.budget_profile)
    if args.reuse_existing:
        if not args.output.exists():
            raise SystemExit(f"Cached output does not exist: {args.output}")
        payload = enrich_payload(read_payload(args.output), budget_context)
        write_payload(args.output, payload)
        print(json.dumps(payload["summary"], ensure_ascii=False))
        return

    token = os.environ.get("HLIDACSTATU_API_TOKEN", "").strip()
    if not token:
        raise SystemExit("Set HLIDACSTATU_API_TOKEN; the token is never written to the output file.")

    if args.full:
        contracts, requests_made, windows_completed = fetch_full_history(token, args.ico, args.start_date, args.end_date, args.checkpoint)
        payload = {
            "schema_version": "1.1.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": {"name": "Hlídač státu API v2", "url": API_URL, "query": f"icoPlatce:{args.ico}", "sort": "newest_published_first"},
            "entity": {"country_code": "CZE", "ico": args.ico},
            "summary": {"matching_contracts": len(contracts), "downloaded_contracts": len(contracts), "pages_fetched": len(load_checkpoint(args.checkpoint)[0]), "requests_this_run": requests_made, "date_windows": windows_completed},
            "contracts": contracts,
        }
        enrich_payload(payload, budget_context)
        write_payload(args.output, payload)
        print(json.dumps(payload["summary"], ensure_ascii=False))
        return

    query = f"icoPlatce:{args.ico}"
    pages: list[dict] = []
    for page_number in range(1, args.pages + 1):
        if page_number > 1:
            time.sleep(MIN_INTERVAL_SECONDS)
        pages.append(fetch_page(token, query, page_number))

    contracts = [compact_contract(item) for page in pages for item in (first(page, "results", "Results") or [])]
    total = first(pages[0], "total", "Total") or len(contracts)
    payload = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "Hlídač státu API v2",
            "url": API_URL,
            "query": query,
            "sort": "newest_published_first",
        },
        "entity": {"country_code": "CZE", "ico": args.ico},
        "summary": {"matching_contracts": total, "downloaded_contracts": len(contracts), "pages_fetched": len(pages)},
        "contracts": contracts,
    }
    enrich_payload(payload, budget_context)
    write_payload(args.output, payload)
    print(json.dumps(payload["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
