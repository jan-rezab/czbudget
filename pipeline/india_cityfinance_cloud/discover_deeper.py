#!/usr/bin/env python3
"""Cloud-only probe of City Finance's public standardized ledger dump endpoint."""

import hashlib
import json
import os
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

BASE = "https://www.cityfinance.in/api/v1/ledger/getLedgerDump"
PROBES = [
    ("MH", "2022-23", "incomeStatement"),
    ("KA", "2023-24", "incomeStatement"),
    ("WB", "2022-23", "incomeStatement"),
]


def workbook_profile(path: Path) -> dict:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
          "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in strings.findall("m:si", ns):
                shared.append("".join(node.text or "" for node in item.iter() if node.tag.endswith("}t")))
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        rels = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        sheets = []
        for sheet in workbook.findall("m:sheets/m:sheet", ns):
            target = targets[sheet.attrib[f"{{{ns['r']}}}id"]].lstrip("/")
            target = target if target.startswith("xl/") else "xl/" + target
            xml = ElementTree.fromstring(archive.read(target))
            rows = xml.findall("m:sheetData/m:row", ns)
            cells = xml.findall(".//m:c", ns)
            samples = []
            matches = []
            for row in rows:
                values = []
                for cell in row.findall("m:c", ns):
                    value = cell.find("m:v", ns)
                    text = "" if value is None else value.text or ""
                    if cell.attrib.get("t") == "s" and text:
                        text = shared[int(text)]
                    values.append(text[:240])
                if len(samples) < 4:
                    samples.append(values)
                joined = " | ".join(values).lower()
                if any(name in joined for name in ("mumbai", "bengaluru", "bangalore", "kolkata")):
                    matches.append(values)
            sheets.append({
                "title": sheet.attrib["name"], "rows": len(rows), "cells": len(cells),
                "first_rows": samples, "target_city_rows": matches[:20],
            })
    return {"sheets": sheets}


def main() -> None:
    run_id = os.environ["BUILD_ID"]
    results = []
    for state, year, module in PROBES:
        params = urllib.parse.urlencode({
                "financialData": "true",
                "isStandardizable": "true",
                "stateCode": state,
                "year": year,
                "module": module,
            })
        request = urllib.request.Request(
            BASE + "?" + params,
            headers={"User-Agent": "PublicSpendingData/CityFinance-depth-audit (+https://publicspendingdata.org)"},
        )
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                content = response.read()
                status_code = response.status
                headers = response.headers
                query_url = response.url
        except urllib.error.HTTPError as exc:
            content = exc.read()
            status_code = exc.code
            headers = exc.headers
            query_url = exc.url
        item = {
            "query_url": query_url,
            "status_code": status_code,
            "content_type": headers.get("content-type"),
            "content_disposition": headers.get("content-disposition"),
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        if status_code < 400 and content.startswith(b"PK\x03\x04"):
            path = Path(f"/workspace/{state}-{year}-{module}.xlsx")
            path.write_bytes(content)
            item["workbook"] = workbook_profile(path)
        else:
            item["response_prefix"] = content[:1000].decode("utf-8", errors="replace")
        results.append(item)
    report = {
        "run_id": run_id,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "publisher": "City Finance, Ministry of Housing and Urban Affairs, Government of India",
        "purpose": "Depth audit only; this report does not assert warehouse loading.",
        "results": results,
    }
    output = Path("/workspace/india-cityfinance-depth-audit.json")
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
