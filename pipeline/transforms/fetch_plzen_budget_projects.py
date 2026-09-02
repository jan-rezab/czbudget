#!/usr/bin/env python3
"""Cache Plzen's public investment-project tree and payment details.

The city application exposes its data through Next.js server actions rather than a
documented public API.  This fetcher is deliberately sequential, rate limited and
writes one local snapshot so the public website never calls the city application.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WEB = Path(__file__).resolve().parents[2]
OUTPUT = WEB / "data/contracts/00075370.plzen-projects.v1.json"
ENDPOINT = "https://rozpocetmesta.plzen.eu/stavebni-investice"

# These opaque IDs belong to the current public Next.js deployment.  If the city
# deploys a new build, update them from createServerReference() in its JS chunks.
GET_NODE_ACTION = "706c446877ec52f5485e42d26bd9ecb8b13b103a52"
GET_BUILDING_NODE_ACTION = "60e001fef762c75516e0c5b120d491b61a805e488b"
GET_DETAIL_ACTION = "4095dda5734b0fa8cf815f0c4a4d05cda3a65634b2"


class CityClient:
    def __init__(self, delay: float, max_requests: int) -> None:
        self.delay = delay
        self.max_requests = max_requests
        self.requests = 0
        self.last_request = 0.0

    def call(self, action: str, args: list[Any]) -> dict[str, Any]:
        if self.requests >= self.max_requests:
            raise RuntimeError(f"Safety cap of {self.max_requests} requests reached")
        remaining = self.delay - (time.monotonic() - self.last_request)
        if remaining > 0:
            time.sleep(remaining)

        request = urllib.request.Request(
            ENDPOINT,
            data=json.dumps(args, ensure_ascii=False).encode("utf-8"),
            headers={
                "Accept": "text/x-component",
                "Content-Type": "text/plain;charset=UTF-8",
                "Next-Action": action,
                "User-Agent": "czbudget-data-cache/1.0 (+local snapshot; sequential)",
            },
            method="POST",
        )
        error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    body = response.read().decode("utf-8")
                self.requests += 1
                self.last_request = time.monotonic()
                for line in body.splitlines():
                    if line.startswith("1:"):
                        payload = json.loads(line[2:])
                        if payload.get("isError"):
                            raise RuntimeError(payload.get("message") or "City action failed")
                        return payload
                raise RuntimeError("Unexpected React server-action response")
            except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
                error = exc
                if attempt < 2:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"City request failed after retries: {error}")


def clean_node(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": node.get("title"),
        "node_id": None if node.get("nodeId") in (None, "$undefined", "-1") else node.get("nodeId"),
        "detail_id": None if node.get("detailId") in (None, "$undefined") else node.get("detailId"),
        "approved_thousand_czk": node.get("approved"),
        "adjusted_thousand_czk": node.get("edited"),
        "actual_thousand_czk": node.get("real"),
        "has_children": bool(node.get("hasChild")),
    }


def crawl_year(client: CityClient, year: int) -> list[dict[str, Any]]:
    root = client.call(GET_NODE_ACTION, ["39", "MMP", str(year)]).get("data") or []
    queue: deque[tuple[dict[str, Any], list[str]]] = deque((node, []) for node in root)
    rows: list[dict[str, Any]] = []
    visited: set[str] = set()

    while queue:
        raw, parents = queue.popleft()
        node = clean_node(raw)
        row = {**node, "year": year, "path": parents + [node["title"]]}
        rows.append(row)
        node_id = node["node_id"]
        if not node["has_children"] or node_id is None or str(node_id) in visited:
            continue
        visited.add(str(node_id))
        children = client.call(GET_BUILDING_NODE_ACTION, [node_id, str(year)]).get("data") or []
        queue.extend((child, row["path"]) for child in children)
    return rows


def compact_detail(detail: dict[str, Any]) -> dict[str, Any]:
    suppliers: dict[str, dict[str, Any]] = {}
    phases = []
    for source_key, kind in (("priprava", "preparation"), ("realizace", "delivery")):
        for item in detail.get(source_key) or []:
            ico = item.get("IC")
            name = (item.get("Dodavatel") or "").strip()
            if ico or name:
                suppliers[ico or name] = {"name": name, "ico": ico}
            phases.append({
                "kind": kind,
                "stage": item.get("Stupen"),
                "status": item.get("StavStupne"),
                "started_at": item.get("Zahajeno"),
                "finished_at": item.get("Dokonceno"),
                "price_czk": item.get("Cena"),
                "supplier_name": name or None,
                "supplier_ico": ico,
            })

    return {
        "code": detail.get("Akce"),
        "title": detail.get("Nazev"),
        "as_of": detail.get("StavDatum"),
        "preparation_status": detail.get("StavProjektovePripravyText"),
        "delivery_status": detail.get("StavRealizaceText"),
        "preparation_started_at": detail.get("DatumZahajeniPRP"),
        "preparation_finished_at": detail.get("DatumDokonceniPRP"),
        "delivery_started_at": detail.get("DatumZahajeniRealizace"),
        "delivery_finished_at": detail.get("DatumDokonceniRealizace"),
        "preparation_cost_czk": detail.get("CelkoveNakladyPRP"),
        "delivery_cost_czk": detail.get("CelkoveNakladyRealizace"),
        "construction_cost_czk": detail.get("StavebniNakladyRealizace"),
        "invoiced_czk": detail.get("Vyfakturovano"),
        "paid_czk": detail.get("Uhrazeno"),
        "paid_by_fiscal_year": [
            {"year": item.get("fiskalniRok"), "amount_czk": item.get("castka")}
            for item in (detail.get("uhrazenoStruktura") or [])
        ],
        "suppliers": list(suppliers.values()),
        "phases": phases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=2018)
    parser.add_argument("--to-year", type=int, default=2026)
    parser.add_argument("--delay", type=float, default=0.25, help="Minimum seconds between requests")
    parser.add_argument("--max-requests", type=int, default=900)
    args = parser.parse_args()
    if args.delay < 0.1:
        raise SystemExit("Refusing a delay below 0.1 seconds")

    client = CityClient(args.delay, args.max_requests)
    rows = []
    for year in range(args.from_year, args.to_year + 1):
        print(f"Crawling project tree {year}…", flush=True)
        rows.extend(crawl_year(client, year))

    detail_ids = sorted({row["detail_id"] for row in rows if row["detail_id"]})
    details = []
    for index, detail_id in enumerate(detail_ids, 1):
        if index == 1 or index % 50 == 0:
            print(f"Fetching project details {index}/{len(detail_ids)}…", flush=True)
        detail = client.call(GET_DETAIL_ACTION, [detail_id]).get("data")
        if detail:
            details.append(compact_detail(detail))

    payload = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity": {"name": "statutární město Plzeň", "ico": "00075370"},
        "period": {"from": args.from_year, "to": args.to_year},
        "source": {
            "name": "Rozpočet města Plzně — stavební investice MMP",
            "url": "https://rozpocetmesta.plzen.eu/stavebni-investice",
            "access": "cached Next.js server-action snapshot",
            "scope": "Stavební investice Magistrátu města Plzně shown by the city application",
        },
        "request_policy": {
            "sequential": True,
            "minimum_delay_seconds": args.delay,
            "safety_cap": args.max_requests,
            "requests_this_run": client.requests,
            "website_runtime_requests": 0,
        },
        "budget_rows": rows,
        "projects": details,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "budget_rows": len(rows),
        "project_ids": len(detail_ids),
        "project_details": len(details),
        "requests": client.requests,
        "output": str(OUTPUT),
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
