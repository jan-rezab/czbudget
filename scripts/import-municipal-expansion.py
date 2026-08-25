#!/usr/bin/env python3
"""Build compact public profiles from official Spain, Japan and Brazil sources.

The importer keeps a small browser directory plus one JSON detail file per
municipality. Source caches are intentionally outside the deployable website.
"""

from __future__ import annotations

import argparse
import csv
import fcntl
import gzip
import html
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


WEB = Path(__file__).resolve().parents[1]
WORKSPACE = WEB.parent
CACHE = WORKSPACE / "data/source_cache/municipal-expansion"
OUTPUT = WORKSPACE / "outputs/municipal-expansion"
USER_AGENT = "publicspendingdata.org municipal importer/1.0"


def clean(value: object) -> str:
    return str(value or "").strip()


def number(value: object) -> float | None:
    text = clean(value).replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def slugify(value: str) -> str:
    import unicodedata
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "municipality"


def mdb_rows(database: Path, table: str) -> Iterable[dict[str, str]]:
    process = subprocess.Popen(["mdb-export", str(database), table], stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    assert process.stdout is not None
    yield from csv.DictReader(process.stdout)
    if process.wait() != 0:
        raise RuntimeError(f"mdb-export failed for {database.name}:{table}")


def trim_detail(rows: list[dict], limit: int = 240) -> list[dict]:
    rows.sort(key=lambda row: (len(row.get("code", "")), row.get("code", ""), row.get("stage", "")))
    return rows[:limit]


def import_spain() -> dict:
    budget_db = CACHE / "ESP/Presupuestos2026.accdb"
    actual_db = CACHE / "ESP/Liquidaciones2025.accdb"
    if not budget_db.exists() or not actual_db.exists():
        raise FileNotFoundError("Download and unzip the two official CONPREL Access files first")
    inventory: dict[str, dict] = {}
    internal_to_code: dict[str, str] = {}
    for database in (actual_db, budget_db):
        for row in mdb_rows(database, "tb_inventario"):
            code = clean(row.get("codbdgel"))
            entity_code = clean(row.get("codente"))
            # AA is the municipality tier in the national local-entity code.
            if len(code) != 10 or code[5:7] != "AA" or code != entity_code or clean(row.get("nsec")) != "1":
                continue
            name = clean(row.get("nombreppal")) or clean(row.get("nombreente"))
            inventory[code] = {"code": code, "name": name, "population": int(number(row.get("poblacion")) or 0)}
            internal_to_code[clean(row.get("idente"))] = code
    profiles = {code: {**entity, "country": "ESP", "currency": "EUR", "years": [2025, 2026], "history": {2025: {}, 2026: {}}, "detail": []} for code, entity in inventory.items()}

    for row in mdb_rows(budget_db, "tb_economica"):
        code = internal_to_code.get(clean(row.get("idente")))
        account = clean(row.get("cdcta"))
        side = "expenditure" if clean(row.get("tipreig")) == "G" else "revenue"
        amount = number(row.get("importe"))
        if not code or amount is None or not account:
            continue
        if len(account) == 1:
            profiles[code]["history"][2026][side] = profiles[code]["history"][2026].get(side, 0.0) + amount
        if len(account) <= 4 and amount:
            profiles[code]["detail"].append({"year": 2026, "stage": "enacted", "side": side, "code": account, "amount": amount})

    for row in mdb_rows(actual_db, "tb_economica"):
        code = internal_to_code.get(clean(row.get("idente")))
        account = clean(row.get("cdcta"))
        side = "expenditure" if clean(row.get("tipreig")) == "G" else "revenue"
        if not code or not account:
            continue
        measures = (("enacted", "imported"), ("revised", "importer"), ("actual", "importel"), ("cash", "importec"))
        for stage, field in measures:
            amount = number(row.get(field))
            if amount is None:
                continue
            if len(account) == 1 and stage == "actual":
                profiles[code]["history"][2025][side] = profiles[code]["history"][2025].get(side, 0.0) + amount
            if len(account) <= 4 and amount:
                profiles[code]["detail"].append({"year": 2025, "stage": stage, "side": side, "code": account, "amount": amount})

    for profile in profiles.values():
        for year in (2025, 2026):
            row = profile["history"][year]
            if row.get("revenue") is not None and row.get("expenditure") is not None:
                row["balance"] = row["revenue"] - row["expenditure"]
        profile["history"] = [{"year": year, **profile["history"][year]} for year in (2025, 2026)]
        profile["detail"] = trim_detail(profile["detail"])
        profile["url"] = f"/municipalities/spain/{slugify(profile['name'])}-{profile['code'].lower()}/"
    return {"country": "ESP", "generated_at": datetime.now(timezone.utc).isoformat(), "source": "https://serviciostelematicosext.hacienda.gob.es/sgfal/conprel", "entities": sorted(profiles.values(), key=lambda row: row["name"].casefold())}


def japan_catalog() -> list[dict[str, str]]:
    source = (WORKSPACE / "outputs/municipal-transparency-crawl/JPN/official-source.html").read_text(encoding="utf-8")
    result = []
    for block in re.findall(r'<article class="stat-dataset_list-item">(.*?)</article>', source, re.S):
        download = re.search(r"file-download\?statInfId=(\d+)&(?:amp;)?fileKind=1", block)
        title = re.search(r'class="stat-link_text[^>]*>\s*(.*?)\s*</a>', block, re.S)
        table = re.search(r'表番号.*?>(\d+)</span>', block, re.S)
        if download:
            result.append({"id": download.group(1), "table": table.group(1) if table else "cover", "title": re.sub(r"<.*?>", "", html.unescape(title.group(1) if title else "")).strip()})
    return result


def download(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=300) as response, path.open("wb") as handle:
        while chunk := response.read(1024 * 1024):
            handle.write(chunk)


def import_japan() -> dict:
    # Core settlement, revenue/expenditure, debt/funds, and ageing-related
    # health/care tables. The complete official catalogue remains linked.
    wanted_tables = {"2", "4", "7", "8", "9", "10", "11", "12", "13", "14", "29", "33", "63", "64", "94", "95"}
    catalog = [row for row in japan_catalog() if row["table"] in wanted_tables]
    raw_dir = CACHE / "JPN"
    for row in catalog:
        download(f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={row['id']}&fileKind=1", raw_dir / f"{row['id']}.csv")
    profiles: dict[str, dict] = {}
    for source in catalog:
        path = raw_dir / f"{source['id']}.csv"
        with path.open(encoding="cp932", errors="replace", newline="") as handle:
            reader = csv.reader(handle)
            header = next(reader, [])
            if len(header) < 10:
                continue
            for values in reader:
                if len(values) < 10:
                    continue
                code, prefecture, name = clean(values[2]), clean(values[3]), clean(values[4])
                entity_type = clean(values[5])
                # Types 6 and 7 are inter-municipal administrative unions and
                # special-purpose accounts. Types 1-5, 8 and 9 are Japan's
                # cities, Tokyo wards, towns and villages (1,741 bodies in FY2024).
                if not re.fullmatch(r"\d{6}", code) or not name or entity_type in {"6", "7"}:
                    continue
                profile = profiles.setdefault(code, {"code": code, "name": name, "region": prefecture, "country": "JPN", "currency": "JPY", "years": [2024], "history": [{"year": 2024}], "detail": []})
                row_code, row_label = clean(values[8]), clean(values[9])
                for column, raw in zip(header[10:], values[10:]):
                    amount = number(raw)
                    if amount in (None, 0):
                        continue
                    column_code = clean(column).split(":", 1)[0]
                    column_label = clean(column).split(":", 1)[-1]
                    native_code = ".".join(part for part in (row_code, column_code) if part)
                    label = " · ".join(part for part in (row_label, column_label) if part)
                    profile["detail"].append({"year": 2024, "stage": "actual", "table": source["table"], "table_title": source["title"], "code": native_code, "name": label, "amount": amount * 1000})
        # Table 2 is the settlement-summary table. Its first numeric fields are
        # retained as native detail; explicit totals are derived by label below.
    for profile in profiles.values():
        latest = profile["history"][0]
        for row in profile["detail"]:
            label = row.get("name", "")
            if row.get("table") == "2" and row.get("code", "").startswith("01."):
                if "歳入総額" in label and latest.get("revenue") is None: latest["revenue"] = row["amount"]
                elif "歳出総額" in label and latest.get("expenditure") is None: latest["expenditure"] = row["amount"]
                elif "実質収支" in label and latest.get("balance") is None: latest["balance"] = row["amount"]
            elif row.get("table") == "33" and row.get("code") == "97.009":
                latest["debt"] = row["amount"]
        profile["detail"] = trim_detail(profile["detail"], 360)
        profile["url"] = f"/municipalities/japan/{slugify(profile['name'])}-{profile['code'].lower()}/"
    return {"country": "JPN", "generated_at": datetime.now(timezone.utc).isoformat(), "source": "https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755", "tables": catalog, "entities": sorted(profiles.values(), key=lambda row: (row.get("region", ""), row["name"]))}


def request_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    last_error: Exception | None = None
    for attempt in range(1):
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                return json.load(response)
        except Exception as error:
            last_error = error
            if attempt == 0:
                break
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Official API failed after retries: {last_error}")


def paced_request_json(url: str) -> dict:
    """Start at most one SICONFI request per second across all cache workers."""
    lock_path = CACHE / "BRA/.request-rate.lock"
    stamp_path = CACHE / "BRA/.request-rate.timestamp"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            last_started = float(stamp_path.read_text(encoding="utf-8")) if stamp_path.exists() else 0.0
            time.sleep(max(0, 1.02 - (time.time() - last_started)))
            stamp_path.write_text(str(time.time()), encoding="utf-8")
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)
    return request_json(url)


def import_brazil(resume: bool = True, limit: int | None = None, shard_index: int = 0, shard_count: int = 1) -> dict:
    base = "https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt"
    entities = [row for row in paced_request_json(f"{base}/entes").get("items", []) if clean(row.get("esfera")) == "M"]
    if limit: entities = entities[:limit]
    if shard_count > 1: entities = entities[shard_index::shard_count]
    raw_dir = CACHE / "BRA/RREO-2025-P6"
    raw_dir.mkdir(parents=True, exist_ok=True)
    profiles = []
    errors = []

    def rreo_report(code: str, report_type: str, cache: Path) -> dict:
        if cache.exists() and resume:
            with gzip.open(cache, "rt", encoding="utf-8") as handle:
                return json.load(handle)
        params = urllib.parse.urlencode({"an_exercicio": 2025, "nr_periodo": 6, "co_tipo_demonstrativo": report_type, "no_anexo": "RREO-Anexo 01", "co_esfera": "M", "id_ente": code})
        payload = paced_request_json(f"{base}/rreo?{params}")
        cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(cache, "wt", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
        return payload

    def dca_report(code: str, annex: str, cache: Path) -> dict:
        if cache.exists() and resume:
            with gzip.open(cache, "rt", encoding="utf-8") as handle:
                return json.load(handle)
        params = urllib.parse.urlencode({"an_exercicio": 2024, "no_anexo": annex, "id_ente": code})
        payload = paced_request_json(f"{base}/dca?{params}")
        cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(cache, "wt", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
        return payload

    for index, entity in enumerate(entities, 1):
        code = str(entity["cod_ibge"])
        cache = raw_dir / f"{code}.json.gz"
        simplified_cache = raw_dir / "RREO-Simplificado" / f"{code}.json.gz"
        eligible_for_simplified = 0 < int(number(entity.get("populacao")) or 0) < 50_000
        payload = None
        reporting_basis = "RREO"
        try:
            # Small municipalities are the only bodies eligible to opt into
            # the simplified filing. Ask for that form first when no regular
            # response is already cached, avoiding a predictable empty call.
            if eligible_for_simplified and not cache.exists():
                simplified_payload = rreo_report(code, "RREO Simplificado", simplified_cache)
                if simplified_payload.get("items"):
                    payload = simplified_payload
                    reporting_basis = "RREO Simplificado"
            if payload is None:
                payload = rreo_report(code, "RREO", cache)
            if not payload.get("items") and eligible_for_simplified:
                payload = rreo_report(code, "RREO Simplificado", simplified_cache)
                reporting_basis = "RREO Simplificado" if payload.get("items") else "DCA fallback"
        except Exception as error:
            errors.append({"code": code, "name": clean(entity.get("ente")), "error": f"RREO: {error}"})
            print(f"Brazil RREO retry needed {code}: {error}", flush=True)
            continue
        # Municipalities below 50,000 inhabitants may opt for the official
        # simplified RREO. Only a miss in both 2025 forms reaches the annual
        # account fallback below.
        summary = {"year": 2025}
        detail = []
        for row in payload.get("items", []):
            account = clean(row.get("cod_conta"))
            label = clean(row.get("conta"))
            column = clean(row.get("coluna"))
            amount = number(row.get("valor"))
            if amount is None or "%" in column: continue
            upper_column = column.upper()
            if "INICIAL" in upper_column:
                stage = "enacted"
            elif "ATUALIZADA" in upper_column:
                stage = "revised"
            elif "PAGAS" in upper_column:
                stage = "cash"
            elif "EMPENHADAS" in upper_column:
                stage = "execution"
            elif any(term in upper_column for term in ("REALIZADAS", "LIQUIDADAS")) or upper_column.startswith("ATÉ O BIMESTRE"):
                stage = "actual"
            else:
                stage = "execution"
            side = "revenue" if "RECEITA" in clean(row.get("anexo")).upper() or "RECEITA" in label.upper() else "expenditure"
            if len(detail) < 360: detail.append({"year": 2025, "stage": stage, "side": side, "code": account, "name": label, "column": column, "amount": amount})
            upper = label.upper()
            is_revenue_total = "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS)" in upper or "RECEITAS (EXCETO INTRAORÇAMENTÁRIAS)" in upper
            is_expenditure_total = "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS)" in upper or "DESPESAS (EXCETO INTRAORÇAMENTÁRIAS)" in upper
            if is_revenue_total and upper_column.startswith("ATÉ O BIMESTRE"):
                summary.setdefault("revenue", amount)
            if is_expenditure_total and "LIQUIDADAS ATÉ O BIMESTRE" in upper_column:
                summary.setdefault("expenditure", amount)
        years = [2025]
        # Some directory municipalities have no RREO Annex 01 row. Preserve
        # that gap, but use their official 2024 DCA I-C/I-D annual accounts where
        # available instead of publishing an empty profile.
        if not payload.get("items"):
            reporting_basis = "DCA fallback"
            try:
                dca_revenue = dca_report(code, "DCA-Anexo I-C", raw_dir / "DCA-2024-I-C" / f"{code}.json.gz")
                dca_expenditure = dca_report(code, "DCA-Anexo I-D", raw_dir / "DCA-2024-I-D" / f"{code}.json.gz")
            except Exception as error:
                errors.append({"code": code, "name": clean(entity.get("ente")), "error": f"DCA fallback: {error}"})
                print(f"Brazil DCA retry needed {code}: {error}", flush=True)
                continue
            dca_items = [*dca_revenue.get("items", []), *dca_expenditure.get("items", [])]
            if dca_items:
                summary = {"year": 2024}
                years = [2024]
                for side, rows in (("revenue", dca_revenue.get("items", [])), ("expenditure", dca_expenditure.get("items", []))):
                    for row in rows:
                        account = clean(row.get("cod_conta")); label = clean(row.get("conta")); column = clean(row.get("coluna")); amount = number(row.get("valor"))
                        if amount is None: continue
                        upper_label, upper_column = label.upper(), column.upper()
                        stage = "cash" if "PAGAS" in upper_column else "execution" if "EMPENHADAS" in upper_column or "RESTOS A PAGAR" in upper_column else "actual"
                        if len(detail) < 360: detail.append({"year": 2024, "stage": stage, "side": side, "code": account, "name": label, "column": column, "amount": amount})
                        if side == "revenue" and "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS)" in upper_label and "BRUTAS REALIZADAS" in upper_column:
                            summary.setdefault("revenue", amount)
                        if side == "expenditure" and account == "TotalDespesas" and "LIQUIDADAS" in upper_column:
                            summary.setdefault("expenditure", amount)
        if summary.get("revenue") is not None and summary.get("expenditure") is not None: summary["balance"] = summary["revenue"] - summary["expenditure"]
        profiles.append({"code": code, "name": clean(entity.get("ente")), "region": clean(entity.get("uf")), "population": entity.get("populacao"), "country": "BRA", "currency": "BRL", "reporting_basis": reporting_basis, "years": years, "history": [summary], "detail": detail, "url": f"/municipalities/brazil/{slugify(clean(entity.get('ente')))}-{code}/"})
        if index % 100 == 0: print(f"Brazil {index}/{len(entities)}", flush=True)
    return {"country": "BRA", "generated_at": datetime.now(timezone.utc).isoformat(), "source": "https://apidatalake.tesouro.gov.br/docs/siconfi", "entities": profiles, "errors": errors}


def write_bundle(bundle: dict, filename: str | None = None) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    country = bundle["country"]
    target = OUTPUT / (filename or f"{country}.json")
    target.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"country": country, "entities": len(bundle["entities"]), "errors": len(bundle.get("errors", [])), "output": str(target)}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("country", choices=("ESP", "JPN", "BRA"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    args = parser.parse_args()
    if args.country == "ESP": write_bundle(import_spain())
    elif args.country == "JPN": write_bundle(import_japan())
    else:
        if not 0 <= args.shard_index < args.shard_count:
            parser.error("--shard-index must be between zero and --shard-count minus one")
        filename = f"BRA-shard-{args.shard_index}.json" if args.shard_count > 1 else None
        write_bundle(import_brazil(limit=args.limit, shard_index=args.shard_index, shard_count=args.shard_count), filename)


if __name__ == "__main__":
    main()
