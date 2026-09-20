#!/usr/bin/env python3
"""Bounded probe of the City of Athens' official legacy open-budget API."""
import hashlib
import json

import requests

BASE = "https://old.cityofathens.gr/khe/proypologismos"
s = requests.Session()
s.headers["User-Agent"] = "Mozilla/5.0 (compatible; PublicSpendingData/1.0)"
out = []
for year in (2026, 2025, 2024):
    url = f"{BASE}/json?pro_fyear={year}&cdief_list=1"
    try:
        r = s.get(url, timeout=90)
        record = {
            "kind": "directorates", "year": year, "url": r.url,
            "status": r.status_code, "content_type": r.headers.get("content-type"),
            "bytes": len(r.content), "sha256": hashlib.sha256(r.content).hexdigest(),
        }
        if r.ok:
            data = r.json()
            record["directorate_count"] = len(data)
            record["directorates"] = data
            first = sorted(data, key=lambda value: int(value))[0]
            for side in (0, 1):
                item_url = f"{BASE}/json?pro_fyear={year}&pro_cdief={first}&pro_esex={side}"
                item = s.get(item_url, timeout=90)
                detail = {
                    "kind": "items", "year": year, "side": side, "directorate": first,
                    "url": item.url, "status": item.status_code,
                    "content_type": item.headers.get("content-type"), "bytes": len(item.content),
                    "sha256": hashlib.sha256(item.content).hexdigest(),
                }
                if item.ok:
                    rows = item.json()
                    detail["row_count"] = len(rows)
                    detail["fields"] = sorted(rows[0]) if rows else []
                    detail["first_row"] = rows[0] if rows else None
                out.append(detail)
        out.append(record)
    except Exception as exc:
        out.append({"kind": "error", "year": year, "url": url, "error": f"{type(exc).__name__}: {exc}"})
print(json.dumps(out, ensure_ascii=False))
