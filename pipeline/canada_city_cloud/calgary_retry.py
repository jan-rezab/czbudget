#!/usr/bin/env python3
"""Bounded cloud probe for official City of Calgary machine-readable budgets."""
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests


URLS = {
    "calgary_open_budget_data": "https://data.calgary.ca/resource/fqax-i3nz.json?$limit=50000",
    "calgary_open_budget_metadata": "https://data.calgary.ca/api/views/fqax-i3nz",
    "budget_overview_2026_api": "https://data.calgary.ca/resource/d3ez-qhmr.json?$limit=50000",
    "budget_overview_2026_metadata": "https://data.calgary.ca/api/views/d3ez-qhmr",
    "calgary_catalog_budget": "https://api.us.socrata.com/api/catalog/v1?q=budget&search_context=data.calgary.ca&limit=100",
    "calgary_catalog_operating": "https://api.us.socrata.com/api/catalog/v1?q=operating%20budget&search_context=data.calgary.ca&limit=100",
    "calgary_catalog_capital": "https://api.us.socrata.com/api/catalog/v1?q=capital%20budget&search_context=data.calgary.ca&limit=100",
    "calgary_arcgis_capital_projects": "https://www.arcgis.com/sharing/rest/search?f=json&num=100&q=%28title%3A%22Capital%20Projects%20Map%22%29%20AND%20%28owner%3Athecityofcalgary%20OR%20orgid%3Auc4c9TYQi9qazHmu%29",
}


def fetch(url):
    attempts = []
    for attempt, delay in enumerate((0, 2, 5), 1):
        if delay:
            time.sleep(delay)
        try:
            response = requests.get(url, timeout=45, headers={"User-Agent": "PublicSpendingData/1.0"})
            attempts.append({"attempt": attempt, "status": response.status_code, "bytes": len(response.content)})
            if response.ok:
                return response, attempts
        except requests.RequestException as error:
            attempts.append({"attempt": attempt, "error": type(error).__name__, "message": str(error)[:300]})
    return None, attempts


def main():
    checked_at = datetime.now(timezone.utc).isoformat()
    output = {"checked_at": checked_at, "sources": {}}
    for name, url in URLS.items():
        response, attempts = fetch(url)
        item = {"url": url, "attempts": attempts}
        if response is not None:
            item.update({
                "status": response.status_code,
                "bytes": len(response.content),
                "sha256": hashlib.sha256(response.content).hexdigest(),
                "content_type": response.headers.get("content-type"),
            })
            try:
                payload = response.json()
                if name.startswith("calgary_catalog"):
                    item["results"] = [{
                        "id": row.get("resource", {}).get("id"),
                        "name": row.get("resource", {}).get("name"),
                        "type": row.get("resource", {}).get("type"),
                        "permalink": row.get("permalink"),
                        "description": str(row.get("resource", {}).get("description") or "")[:500],
                    } for row in payload.get("results", [])]
                elif name == "calgary_arcgis_capital_projects":
                    item["results"] = [{key: row.get(key) for key in ("id", "title", "type", "url", "owner", "modified")} for row in payload.get("results", [])]
                else:
                    item["sample"] = payload[:5] if isinstance(payload, list) else payload
            except ValueError:
                item["sample"] = response.text[:2000]
        output["sources"][name] = item
    Path("/workspace/calgary-retry.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({name: source.get("status", source["attempts"][-1]) for name, source in output["sources"].items()}))


if __name__ == "__main__":
    main()
