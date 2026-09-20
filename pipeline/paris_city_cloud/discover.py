#!/usr/bin/env python3
import hashlib
import json

import requests

BASE = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets"
s = requests.Session()
s.headers["User-Agent"] = "Mozilla/5.0 (compatible; PublicSpendingData/1.0)"
results = []
seen = set()
for term in ("budget", "compte administratif", "compte financier", "finances"):
    response = s.get(BASE, params={"where": f'search("{term}")', "limit": 100}, timeout=120)
    response.raise_for_status()
    for dataset in response.json().get("results", []):
        dataset_id = dataset.get("dataset_id")
        if not dataset_id or dataset_id in seen:
            continue
        seen.add(dataset_id)
        metas = dataset.get("metas", {}).get("default", {})
        fields = dataset.get("fields", [])
        results.append({
            "dataset_id": dataset_id,
            "title": metas.get("title"),
            "description": str(metas.get("description", ""))[:1200],
            "modified": metas.get("modified"),
            "records_count": metas.get("records_count"),
            "fields": [{"name": field.get("name"), "label": field.get("label"), "type": field.get("type")} for field in fields],
        })
print(json.dumps({"catalog_url": BASE, "dataset_count": len(results), "datasets": results}, ensure_ascii=False))
