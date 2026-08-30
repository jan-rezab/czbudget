#!/usr/bin/env python3
"""Download raw education-finance sources for the ten-country comparison audit.

The downloader deliberately does not harmonise national classifications. It stores
official source responses, records their hashes in a manifest, and reuses two large
official files that are already cached by the municipal-finance pipelines.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[2]))
CACHE = ROOT / "data/source_cache/education"
MANIFEST = CACHE / "manifest.json"
USER_AGENT = "czbudget-public/1.0 education comparative source downloader"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def request(url: str, *, payload: dict[str, Any] | None = None, timeout: int = 900) -> bytes:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if data is not None:
        headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except Exception as exc:
            last_error = exc
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError(last_error)


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        temp_path = Path(handle.name)
        handle.write(content)
    temp_path.replace(path)
    path.chmod(0o644)


def fetch(url: str, path: Path, *, payload: dict[str, Any] | None = None, refresh: bool = False) -> str:
    if path.exists() and not refresh:
        return "cached"
    atomic_write(path, request(url, payload=payload))
    return "downloaded"


def pxweb_query(metadata: dict[str, Any], selections: dict[str, list[str]]) -> dict[str, Any]:
    query = []
    for variable in metadata["variables"]:
        code = variable["code"]
        values = selections.get(code)
        query.append({
            "code": code,
            "selection": {
                "filter": "item" if values is not None else "all",
                "values": values if values is not None else ["*"],
            },
        })
    return {"query": query, "response": {"format": "json-stat2"}}


def validate(path: Path) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"Empty or missing source asset: {path}")
    suffix = path.suffix.lower()
    if suffix == ".json":
        json.loads(path.read_text(encoding="utf-8-sig"))
    elif suffix in {".zip", ".xlsx"} and not zipfile.is_zipfile(path):
        raise RuntimeError(f"Invalid ZIP/XLSX container: {path}")


def asset_record(
    country_code: str,
    source_id: str,
    path: Path,
    source_url: str,
    request_url: str,
    period: str,
    scope: str,
    status: str,
    limitation: str,
) -> dict[str, Any]:
    validate(path)
    path.chmod(0o644)
    return {
        "country_code": country_code,
        "source_id": source_id,
        "period": period,
        "scope": scope,
        "limitation": limitation,
        "source_url": source_url,
        "request_url": request_url,
        "path": str(path.relative_to(ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "download_status": status,
    }


def download_pxweb(
    country_code: str,
    source_id: str,
    url: str,
    period: str,
    scope: str,
    limitation: str,
    selections: dict[str, list[str]],
    refresh: bool,
) -> list[dict[str, Any]]:
    root = CACHE / country_code
    metadata_path = root / f"{source_id}-metadata.json"
    metadata_status = fetch(url, metadata_path, refresh=refresh)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
    data_path = root / f"{source_id}-data.json"
    data_status = fetch(url, data_path, payload=pxweb_query(metadata, selections), refresh=refresh)
    return [
        asset_record(country_code, f"{source_id}-metadata", metadata_path, url, url, period, "Source table metadata", metadata_status, limitation),
        asset_record(country_code, source_id, data_path, url, url, period, scope, data_status, limitation),
    ]


def download_direct(
    country_code: str,
    source_id: str,
    url: str,
    filename: str,
    period: str,
    scope: str,
    limitation: str,
    refresh: bool,
    source_url: str | None = None,
) -> dict[str, Any]:
    path = CACHE / country_code / filename
    status = fetch(url, path, refresh=refresh)
    return asset_record(country_code, source_id, path, source_url or url, url, period, scope, status, limitation)


def reuse_or_download(
    country_code: str,
    source_id: str,
    url: str,
    reuse_path: str,
    period: str,
    scope: str,
    limitation: str,
    refresh: bool,
    source_url: str,
) -> dict[str, Any]:
    path = ROOT / reuse_path
    if path.exists() and not refresh:
        status = "reused_existing_cache"
    else:
        status = fetch(url, path, refresh=refresh)
    return asset_record(country_code, source_id, path, source_url, url, period, scope, status, limitation)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Redownload assets that already exist")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    assets: list[dict[str, Any]] = []

    assets.extend(download_pxweb(
        "CHE", "bfs-cantonal-education-expenditure-2023",
        "https://www.pxweb.bfs.admin.ch/api/v1/fr/px-x-1506010000_106/px-x-1506010000_106.px",
        "2023",
        "All cantons and their municipalities by education level and expenditure nature",
        "Excludes the federal layer; values are in CHF thousands.",
        {"Jahr": ["2023"]}, args.refresh,
    ))

    dnk_url = "https://api.statbank.dk/v1/data/UOE1/CSV?lang=en&valuePresentation=CodeAndValue&UDDNIV=*&UDTYPE=*&EJER=*&Tid=*"
    assets.append(download_direct(
        "DNK", "statbank-uoe1", dnk_url, "UOE1-2016-2024.csv", "2016-2024",
        "National education expenditure by education level, expenditure type and ownership",
        "National education-finance table; municipal transaction routing requires a separate StatBank join.",
        args.refresh, "https://www.statbank.dk/UOE1",
    ))
    assets.append(download_direct(
        "DNK", "statbank-uoe1-metadata", "https://api.statbank.dk/v1/tableinfo/UOE1?lang=en",
        "UOE1-metadata.json", "2016-2024", "Source table metadata",
        "National education-finance table; municipal transaction routing requires a separate StatBank join.",
        args.refresh, "https://www.statbank.dk/UOE1",
    ))

    assets.extend(download_pxweb(
        "FIN", "statfin-12g6-current-expenditure",
        "https://pxweb2.stat.fi/PxWeb/api/v1/en/StatFin/kotal/12g6.px",
        "2000-2024", "Current expenditure by type of expenditure, including total and GDP share",
        "National statistical expenditure table; government-sector routing is not present in this table.",
        {}, args.refresh,
    ))
    assets.extend(download_pxweb(
        "FIN", "statfin-12g7-per-student",
        "https://pxweb2.stat.fi/PxWeb/api/v1/en/StatFin/kotal/12g7.px",
        "2000-2024", "Current expenditure per student by education sector",
        "Per-student statistical series, not accounting transactions.",
        {}, args.refresh,
    ))

    assets.append(reuse_or_download(
        "FRA", "dgfip-functional-balances-2024",
        "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2024/attachments/balancespl_fonction_2024_dec2025_zip",
        "data/source_cache/international_municipal/FRA/BalanceSPL_Fonction_2024_Dec2025.zip",
        "2024", "Nationwide local public accounts crossed by economic nature and function",
        "Local public entities only; the central-government education layer must be joined separately.",
        args.refresh,
        "https://www.data.gouv.fr/datasets/balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2024",
    ))

    assets.append(download_direct(
        "GBR", "dfe-la-school-expenditure-2024-25",
        "https://content.explore-education-statistics.service.gov.uk/api/releases/d826124d-95f3-4b2f-a8ab-3425f84145fe/files?fromPage=ReleaseDownloads",
        "la-and-school-expenditure_2024-25.zip", "2024-25",
        "England local-authority and maintained-school income and expenditure release",
        "England only; excludes academies and does not cover Scotland, Wales or Northern Ireland.",
        args.refresh,
        "https://explore-education-statistics.service.gov.uk/find-statistics/la-and-school-expenditure/2024-25",
    ))

    nld_page = "https://duo.nl/open_onderwijsdata/onderwijs-algemeen/financiele-overzichten/financiele-verantwoording-uit-xbrl.jsp"
    for source_id, filename, scope in [
        ("duo-income-and-expenditure", "2.-staat-van-baten-en-lasten-2020-2024-standaard.xlsx", "Consolidated school-board income and expenditure statements"),
        ("duo-government-contributions", "12.-rijksbijdragen-2020-2024-standaard.xlsx", "Government contributions reported by school boards"),
        ("duo-segmentation", "19.-segmentatie-2020-2024-standaard.xlsx", "School-board financial reporting segmented by education sector"),
    ]:
        assets.append(download_direct(
            "NLD", source_id, f"https://duo.nl/open_onderwijsdata/images/{filename}", filename,
            "2020-2024", scope,
            "School-board XBRL accounts; municipal and central budget flows require separate joins.",
            args.refresh, nld_page,
        ))

    assets.extend(download_pxweb(
        "NOR", "ssb-kostra-12367-education-2025",
        "https://data.ssb.no/api/v0/en/table/12367",
        "2025", "Municipal and county gross operating expenditure for education-related KOSTRA functions",
        "Selected education functions and gross operating expenditure; native KOSTRA accounting scope B.",
        {
            "KOKregnskapsomfa0000": ["B"],
            "KOKfunksjon0000": ["201", "202", "211", "213", "215", "221", "222", "223", "383", "FGK7", "FGK8b"],
            "KOKart0000": ["AGD10"],
            "Tid": ["2025"],
        }, args.refresh,
    ))

    assets.append(reuse_or_download(
        "POL", "mf-rb28s-2025q4",
        "https://www.gov.pl/attachment/1eb59fb5-ab95-4f0d-8d62-4ef07c1a9910",
        "data/source_cache/international_municipal/POL/Rb28S_2025Q4.zip",
        "2025 Q4", "All local-government Rb-28S expenditure returns by budget chapter and economic item",
        "Local-government returns; central-government education spending requires a separate join.",
        args.refresh, "https://www.gov.pl/web/finanse/bazy-danych8",
    ))

    assets.extend(download_pxweb(
        "SWE", "scb-kostndr-education-2025",
        "https://api.scb.se/OV0104/v1/doris/en/ssd/OE/OE0107/OE0107B/KostnDR",
        "2025", "All municipalities, education activities, total costs/income, net and production costs",
        "Municipal operational accounts; regional and central education layers require separate joins.",
        {
            "Verksomrkom": ["490", "400", "407", "412", "415", "425", "435", "440", "443", "450", "453", "470", "472", "476", "474", "475", "478"],
            "Tid": ["2025"],
        }, args.refresh,
    ))

    assets.append(download_direct(
        "USA", "census-f33-all-data-items-2024",
        "https://www2.census.gov/programs-surveys/school-finances/tables/2024/secondary-education-finance/elsec24.xlsx",
        "elsec24-all-data-items.xlsx", "2024",
        "All F-33 public elementary-secondary school-system finance data items",
        "School-district layer only; higher education requires IPEDS and other public layers require joins.",
        args.refresh,
        "https://www.census.gov/data/tables/2024/econ/school-finances/secondary-education-finance.html",
    ))

    countries = sorted({asset["country_code"] for asset in assets})
    manifest = {
        "schema_version": "1.0.0",
        "dataset_id": "education-comparative-raw-sources",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "country_count": len(countries),
        "countries": countries,
        "asset_count": len(assets),
        "total_bytes": sum(asset["bytes"] for asset in assets),
        "normalisation_status": "raw_only",
        "warning": "National classifications and accounting perimeters are not harmonised; assets must not be summed or ranked without country adapters.",
        "assets": sorted(assets, key=lambda row: (row["country_code"], row["source_id"])),
    }
    atomic_write(MANIFEST, (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(f"Wrote {MANIFEST.relative_to(ROOT)} with {len(assets)} assets for {len(countries)} countries")
    for country in countries:
        country_assets = [asset for asset in assets if asset["country_code"] == country]
        print(f"{country}: {len(country_assets)} assets, {sum(asset['bytes'] for asset in country_assets):,} bytes")


if __name__ == "__main__":
    main()
