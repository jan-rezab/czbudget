#!/usr/bin/env python3
"""Inspect the official EU mirror metadata for Greek local-government execution files."""
import hashlib
import json
import re

import requests

DATASET = "5554b44b-9e1a-4c84-81fc-0e956b391642"
API = f"https://data.europa.eu/api/hub/search/datasets/{DATASET}"
s = requests.Session()
s.headers["User-Agent"] = "Mozilla/5.0 (compatible; PublicSpendingData/1.0)"
r = s.get(API, timeout=90)
r.raise_for_status()
payload = r.json()["result"]
rows = []
for distribution in payload.get("distributions", []):
    title = distribution.get("title", {}).get("el") or distribution.get("title", {}).get("en")
    if title and ("Δήμοι" in title or "Municipal" in title):
        rows.append({
            "id": distribution.get("id"),
            "title": title,
            "format": distribution.get("format", {}).get("id"),
            "byte_size": distribution.get("byte_size"),
            "checksum": distribution.get("checksum"),
            "access_url": distribution.get("access_url"),
            "download_url": distribution.get("download_url"),
        })
landing = payload.get("landing_page", [{}])[0].get("resource")
landing_result = None
if landing:
    try:
        page = s.get(landing, timeout=90)
        signals = sorted(set(re.findall(r'''https?://[^\s"'<>]+|/[^\s"'<>]+''', page.text)))
        landing_result = {
            "url": page.url, "status": page.status_code,
            "content_type": page.headers.get("content-type"), "bytes": len(page.content),
            "sha256": hashlib.sha256(page.content).hexdigest(),
            "resource_signals": [value for value in signals if re.search(r"xlsx|resource|download|api", value, re.I)][:200],
        }
    except Exception as exc:
        landing_result = {"url": landing, "error": f"{type(exc).__name__}: {exc}"}
print(json.dumps({
    "metadata_url": API,
    "metadata_sha256": hashlib.sha256(r.content).hexdigest(),
    "landing_page": payload.get("landing_page"),
    "landing_probe": landing_result,
    "municipal_distributions": rows,
}, ensure_ascii=False))
