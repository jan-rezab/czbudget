#!/usr/bin/env python3
"""Run small, reproducible probes of official municipal-finance sources.

This is a source-discovery crawl, not a claim that a national import is complete.
It stores bounded response samples and a manifest that records exactly what was
reachable. Large national loads remain separate, resumable ingestion jobs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import requests


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = ROOT / "outputs/municipal-transparency-crawl"
USER_AGENT = "publicspendingdata.org municipal-transparency research/1.0"


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def save(path: Path, payload: Any) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(payload, bytes):
        raw = payload
    else:
        raw = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()
    path.write_bytes(raw)
    return {"file": str(path.relative_to(ROOT)), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def get(session: requests.Session, url: str, **kwargs: Any) -> requests.Response:
    response = session.get(url, timeout=90, **kwargs)
    response.raise_for_status()
    return response


def post(session: requests.Session, url: str, payload: dict[str, Any]) -> requests.Response:
    response = session.post(url, json=payload, timeout=180)
    response.raise_for_status()
    return response


def statbank_probe(session: requests.Session, output: Path) -> dict[str, Any]:
    results = []
    for table, stage in (("BUDK100", "enacted"), ("REGK100", "actual")):
        meta_url = f"https://api.statbank.dk/v1/tableinfo/{table}?lang=en"
        meta = get(session, meta_url).json()
        variables = {item["id"]: item for item in meta["variables"]}
        query = {"table": table, "format": "CSV", "lang": "en", "variables": []}
        for variable in meta["variables"]:
            code = variable["id"]
            available = [item["id"] for item in variable["values"]]
            if code == "OMRÅDE": values = ["101"]
            elif code == "FUNKTION": values = available[:4]
            elif code == "GRUPPERING": values = available[:8]
            elif code == "ART": values = [value for value in available if value not in {"TOT", "UE", "I", "U"} and not value.startswith("S")][:8]
            elif code == "PRISENHED": values = ["LOBM"]
            elif variable.get("time") or code == "Tid": values = ["2025"]
            else: values = available
            query["variables"].append({"code": code, "values": values})
        response = post(session, "https://api.statbank.dk/v1/data", query)
        item = save(output / "DNK" / f"{table}-copenhagen-2025.csv", response.content)
        item.update({"table": table, "stage": stage, "source": meta_url, "dimensions": {key: len(value["values"]) for key, value in variables.items()}})
        results.append(item)
    return {"status": "sampled", "samples": results}


def netherlands_probe(session: requests.Session, output: Path) -> dict[str, Any]:
    catalog_url = "https://dataderden.cbs.nl/ODataCatalog/Tables?$format=json&$filter=Catalog%20eq%20%27IV3%27"
    catalog = get(session, catalog_url).json()
    title = "Gemeenten 2025 onbewerkte Iv3-data"
    table = next(row["Identifier"] for row in catalog["value"] if row.get("Title", "").strip() == title)
    api = f"https://dataderden.cbs.nl/ODataApi/OData/{table}"
    stages = get(session, f"{api}/Verslagsoort?$format=json").json()["value"]
    # CBS dimension keys are fixed-width strings; the trailing spaces are part
    # of the OData value and must be retained in filters.
    sample_filter = "Verslagsoort eq '2025X000' and Gemeenten eq 'GM0363   '"
    params = urlencode({"$format": "json", "$filter": sample_filter, "$top": 100})
    rows = get(session, f"https://dataderden.cbs.nl/ODataFeed/OData/{table}/TypedDataSet?{params}").json()
    item = save(output / "NLD" / f"{table}-amsterdam-budget-sample.json", rows)
    item.update({"table": table, "source": catalog_url, "stages": [{"code": row["Key"], "name": row["Title"]} for row in stages], "rows": len(rows.get("value", []))})
    return {"status": "sampled", **item}


def norway_probe(session: requests.Session, output: Path) -> dict[str, Any]:
    url = "https://data.ssb.no/api/v0/en/table/12367"
    meta = get(session, url).json()
    wanted = {
        "KOKkommuneregion0000": ["3101"], "KOKregnskapsomfa0000": ["B"],
        "KOKfunksjon0000": meta["variables"][2]["values"][:8],
        "KOKart0000": meta["variables"][3]["values"], "ContentsCode": ["KOSbelop0000"], "Tid": ["2025"],
    }
    query = {"query": [{"code": variable["code"], "selection": {"filter": "item", "values": wanted[variable["code"]]}} for variable in meta["variables"]], "response": {"format": "json-stat2"}}
    rows = post(session, url, query).json()
    item = save(output / "NOR" / "12367-halden-2025-sample.json", rows)
    item.update({"table": "12367", "source": url, "functions": len(meta["variables"][2]["values"]), "types": len(meta["variables"][3]["values"])})
    return {"status": "sampled", **item}


def brazil_probe(session: requests.Session, output: Path) -> dict[str, Any]:
    base = "https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt"
    params = {"an_exercicio": 2025, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO", "no_anexo": "RREO-Anexo 01", "co_esfera": "M", "id_ente": 3550308}
    url = f"{base}/rreo?{urlencode(params, quote_via=quote)}"
    rows = get(session, url).json()
    item = save(output / "BRA" / "rreo-sao-paulo-2025-p6-anexo01.json", rows)
    item.update({"source": url, "rows": len(rows.get("items", [])), "paging": {key: rows.get(key) for key in ("hasMore", "limit", "offset", "count")}})
    return {"status": "sampled", **item}


def landing_probe(session: requests.Session, output: Path, country: str, url: str) -> dict[str, Any]:
    response = get(session, url)
    item = save(output / country / "official-source.html", response.content)
    item.update({"source": url, "status_code": response.status_code, "content_type": response.headers.get("content-type")})
    return {"status": "catalogued", **item}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json,text/html,*/*"})
    probes = {
        "DNK": lambda: statbank_probe(session, args.output),
        "NLD": lambda: netherlands_probe(session, args.output),
        "NOR": lambda: norway_probe(session, args.output),
        "BRA": lambda: brazil_probe(session, args.output),
        "ESP": lambda: landing_probe(session, args.output, "ESP", "https://serviciostelematicosext.hacienda.gob.es/sgfal/conprel"),
        "JPN": lambda: landing_probe(session, args.output, "JPN", "https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&tclass1=000001077756&tclass2=000001077757&toukei=00200251&tstat=000001077755&year=20250"),
        "KOR": lambda: landing_probe(session, args.output, "KOR", "https://www.lofin365.go.kr/portal/LF5110000.do"),
    }
    results: dict[str, Any] = {}
    for country, probe in probes.items():
        try:
            results[country] = probe()
        except Exception as exc:
            results[country] = {"status": "failed", "error": f"{type(exc).__name__}: {exc}"}
    manifest = {"schema_version": "1.0.0", "generated_at": now(), "scope": "bounded official-source discovery crawl", "countries": results}
    save(args.output / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
